import { connectDB, IndexingQueue } from "@/lib/mongodb";

// Part B addition — non-protected helper shared by the Indexing Queue dispatch
// and resubmit API routes. Forwards server-to-server into the existing, protected
// `/api/scripts/run` SSE pipeline (reusing the real `url-indexer`/`bing-indexnow`
// scripts) rather than reimplementing GSC/IndexNow API clients. Never modifies
// that route or any Python script — only calls it over HTTP, like any client would.
export type IndexingEngine = "gsc" | "bing";

interface DispatchParams {
  websiteId: string;
  engine: IndexingEngine;
  urls: string[];
  serviceAccountName?: string;
  requestUrl: string;
  cookie: string;
}

export async function dispatchIndexingUrls({
  websiteId,
  engine,
  urls,
  serviceAccountName,
  requestUrl,
  cookie,
}: DispatchParams): Promise<Response> {
  const formData = new FormData();
  formData.set("slug", engine === "gsc" ? "url-indexer" : "bing-indexnow");
  formData.set("urls", urls.join("\n"));
  if (engine === "gsc") {
    formData.set("serviceAccountName", serviceAccountName ?? "");
  }

  const runUrl = new URL("/api/scripts/run", requestUrl);
  const upstream = await fetch(runUrl, {
    method: "POST",
    body: formData,
    headers: { cookie },
  });

  if (!upstream.ok || !upstream.body) {
    return Response.json({ error: "Failed to start the indexing run." }, { status: 502 });
  }

  const [clientStream, parseStream] = upstream.body.tee();

  // Fire-and-forget: parse the streamed script output and update IndexingQueue
  // statuses as results arrive, without delaying the response to the browser.
  void parseAndApplyResults(parseStream, websiteId, engine, urls);

  return new Response(clientStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

async function parseAndApplyResults(
  stream: ReadableStream<Uint8Array>,
  websiteId: string,
  engine: IndexingEngine,
  urls: string[]
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const urlSet = new Set(urls);
  const succeededUrls = new Set<string>();
  const failedUrls = new Set<string>();
  let sawDone = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const match = part.match(/^data: (.*)$/m);
        if (!match) continue;
        let evt: { type: string; line?: string };
        try {
          evt = JSON.parse(match[1]);
        } catch {
          continue;
        }
        if (evt.type !== "output" || !evt.line) continue;
        const line = evt.line;

        if (line.startsWith("[DONE]")) sawDone = true;

        if (engine === "gsc") {
          const submitMatch = line.match(/^\[INFO\] \[\d+\/\d+\] Submitted: (.+)$/);
          const errorMatch = line.match(/^\[ERROR\] \[\d+\/\d+\] (.+?) —/);
          const skipMatch = line.match(/^\[WARN\] \[\d+\/\d+\] Skipped: (.+?) —/);
          if (submitMatch && urlSet.has(submitMatch[1])) succeededUrls.add(submitMatch[1]);
          else if (errorMatch && urlSet.has(errorMatch[1])) failedUrls.add(errorMatch[1]);
          else if (skipMatch && urlSet.has(skipMatch[1])) failedUrls.add(skipMatch[1]);
        }
      }
    }
  } catch {
    // Stream read failed mid-run — fall through and apply whatever was parsed so far.
  }

  await connectDB();
  const now = new Date();

  if (engine === "gsc") {
    // GSC (url_indexer.py) reports true per-URL status — apply exactly what was seen.
    // Any pending URL never mentioned (e.g. a truncated/aborted run) is left untouched
    // rather than guessed at.
    if (succeededUrls.size > 0) {
      await IndexingQueue.updateMany(
        { websiteId, url: { $in: Array.from(succeededUrls) } },
        { $set: { gscStatus: "submitted", gscSubmittedAt: now, gscError: null } }
      );
    }
    if (failedUrls.size > 0) {
      await IndexingQueue.updateMany(
        { websiteId, url: { $in: Array.from(failedUrls) } },
        { $set: { gscStatus: "failed", gscSubmittedAt: now, gscError: "Submission failed — see the execution log for details." } }
      );
    }
  } else {
    // Bing (bing_indexnow.py) only reports batch-level success/failure, not per-URL —
    // this is the real granularity the script provides, not a simplification we chose.
    await IndexingQueue.updateMany(
      { websiteId, url: { $in: urls } },
      sawDone
        ? { $set: { bingStatus: "submitted", bingSubmittedAt: now, bingError: null } }
        : { $set: { bingStatus: "failed", bingSubmittedAt: now, bingError: "Batch submission failed — see the execution log for details." } }
    );
  }
}
