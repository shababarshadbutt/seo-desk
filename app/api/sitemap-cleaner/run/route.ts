import { readFile, readdir, unlink, mkdtemp, writeFile } from "fs/promises";
import { createWriteStream } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { randomUUID } from "crypto";
import { buffer as streamToBuffer } from "stream/consumers";
import archiver from "archiver";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, Settings, LastmodDomainCache } from "@/lib/mongodb";
import type { LastmodSource } from "@/lib/mongodb";
import { openSftpReadStream, listSftpSitemapFiles } from "@/lib/lastmod/sftpClient";
import { openS3ReadStream, uploadS3Buffer, s3KeyForDomainFile, listS3SitemapObjects } from "@/lib/lastmod/s3Client";
import { openSitemapBody } from "@/lib/lastmod/liveUrlDiscovery";
import { isGzipFilename, type SitemapStreamResult } from "@/lib/lastmod/xmlStream";
import { detectIndexFile } from "@/lib/lastmod/indexDetect";
import { cleanSitemaps, parseDomainHost, type CleanItem } from "@/lib/sitemapCleaner/clean";
import { buildUrlsetXml, buildSitemapIndexXml } from "@/lib/sitemapCleaner/xmlBuild";
import { createSitemapParser, type SitemapParser } from "@/lib/sitemapCleaner/workerPool";
import type { ParseSitemapInput } from "@/lib/sitemapCleaner/parseWorker";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type CleanerSource = "upload" | LastmodSource;

// A single stalled file (out of a batch that can run into the thousands)
// must not hang the whole run — cap each file's fetch+parse at this ceiling
// and treat a timeout the same as any other per-file failure.
const PER_FILE_TIMEOUT_MS = 120_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolvePromise, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolvePromise(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

function sseEvent(data: object): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function buildDuplicatesCsv(duplicates: { url: string; count: number; sitemaps: string[] }[]): string {
  const rows = ["URL,Duplicate Count,Sitemaps"];
  for (const d of duplicates) {
    rows.push([csvField(d.url), String(d.count), csvField(d.sitemaps.join(", "))].join(","));
  }
  return rows.join("\n");
}

const FETCH_CONCURRENCY = 8;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return new Response("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => null);
  const source = body?.source as CleanerSource | undefined;
  const domain = (body?.domain as string | undefined)?.trim();
  const subfolder = ((body?.subfolder as string | undefined) || "sitemaps").trim() || "sitemaps";
  const output = body?.output as "zip" | "s3" | undefined;
  const sessionId = body?.sessionId as string | undefined;

  if (!source || !domain || !output) {
    return Response.json({ error: "source, domain, and output are required" }, { status: 400 });
  }
  if (source === "upload" && !sessionId) {
    return Response.json({ error: "sessionId is required for the upload source" }, { status: 400 });
  }

  const expectedHost = parseDomainHost(domain);
  if (!expectedHost) {
    return Response.json({ error: `Could not parse a hostname from domain: "${domain}"` }, { status: 400 });
  }

  await connectDB();
  const settings = await Settings.findOne({ singleton: true }).lean();

  if (output === "s3" && !settings?.s3Config?.bucket) {
    return Response.json({ error: "S3 is not configured. Add it in Settings first." }, { status: 400 });
  }
  if (source === "sftp" && !settings?.sftpConfig?.host) {
    return Response.json({ error: "SFTP is not configured. Add it in Settings first." }, { status: 400 });
  }
  if (source === "s3" && !settings?.s3Config?.bucket) {
    return Response.json({ error: "S3 is not configured. Add it in Settings first." }, { status: 400 });
  }

  let cacheFiles: { filename: string; loc: string; isIndex: boolean }[] = [];
  let cacheStaleNotice: string | null = null;
  if (source !== "upload") {
    const cache = await LastmodDomainCache.findOne({ domain, source });
    if (!cache || cache.files.length === 0) {
      return Response.json(
        { error: `No cached file list for "${domain}" (${source}) — fetch files first.` },
        { status: 400 }
      );
    }
    cacheFiles = cache.files;

    // The cached list is only refreshed when "Fetch Files" is clicked — if the
    // bucket/remote directory has grown or shrunk since then, re-listing here
    // (cheap compared to the fetch+parse pass below) keeps a run from silently
    // operating on a stale, smaller file count.
    if (source === "s3" || source === "sftp") {
      const liveFiles =
        source === "s3"
          ? await listS3SitemapObjects(settings!.s3Config, domain)
          : await listSftpSitemapFiles(settings!.sftpConfig, domain);

      const cachedKeys = new Set(cacheFiles.map((f) => f.loc));
      const liveKeys = new Set(liveFiles.map((f) => f.loc));
      const changed =
        cachedKeys.size !== liveKeys.size || liveFiles.some((f) => !cachedKeys.has(f.loc));

      if (changed && liveFiles.length > 0) {
        const { indexFilename, files: annotatedFiles } = await detectIndexFile(
          source,
          liveFiles.map((f) => ({ ...f, isIndex: false })),
          source === "sftp" ? settings!.sftpConfig : null,
          source === "s3" ? settings!.s3Config : null
        );
        await LastmodDomainCache.findOneAndUpdate(
          { domain, source },
          { $set: { files: annotatedFiles, indexFilename, fetchedAt: new Date() } }
        );
        cacheStaleNotice = `[INFO] Domain file list changed since last fetch — refreshed (${cacheFiles.length} → ${annotatedFiles.length} files)`;
        cacheFiles = annotatedFiles;
      }
    }
  }

  const runId = randomUUID();
  // Only the upload-batch temp files get cleaned up — the produced ZIP/report
  // must stay in tmpdir() so /api/logs/download can serve it afterward.
  const batchFilesToClean: string[] = [];

  let parser: SitemapParser | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (data: object) => controller.enqueue(sseEvent(data));
      const log = (line: string) => enqueue({ type: "output", line });

      try {
        if (cacheStaleNotice) log(cacheStaleNotice);

        // ── Resolve every file's [{name, urls, isIndex}] regardless of source ──
        let items: CleanItem[];

        if (source === "upload") {
          log("[INFO] Merging uploaded batches...");
          const tmpDir = resolve(tmpdir());
          const allFiles = (await readdir(tmpDir)).filter(
            (f) => f.startsWith(`asap_cleaner_${sessionId}_`) && f.endsWith(".json")
          );
          if (allFiles.length === 0) {
            throw new Error("No batch data found for this upload session.");
          }
          const parts: string[] = [];
          for (const f of allFiles) {
            batchFilesToClean.push(join(tmpDir, f));
            const content = (await readFile(join(tmpDir, f), "utf8")).trim();
            if (content.length <= 2) continue;
            parts.push(content.slice(1, -1).trim());
          }
          items = JSON.parse(`[${parts.filter(Boolean).join(",")}]`) as CleanItem[];
          log(`[INFO] Loaded ${items.length} sitemap(s) from ${allFiles.length} batch(es)`);
        } else {
          log(`[INFO] Fetching ${cacheFiles.length} sitemap file(s) via ${source}...`);
          const sftpConfig = settings!.sftpConfig;
          const s3Config = settings!.s3Config;
          let fetchedCount = 0;

          // Parsing (gunzip + XML streaming) is CPU-bound and, for a batch in
          // the thousands, can otherwise monopolize the main thread long enough
          // to delay the SSE progress pings below and look like a dead
          // connection to an idle-timeout proxy. Piscina fans that work out
          // across worker threads, scaled to this run's file count — but
          // falls back to (and, after repeated failures, stays on) in-process
          // parsing if the pool can't actually run tasks in this environment.
          parser = createSitemapParser(cacheFiles.length, () => {
            log("[WARN] Worker pool repeatedly unresponsive — parsing remaining files in-process.");
          });
          const activeParser = parser;

          items = await mapLimit(cacheFiles, FETCH_CONCURRENCY, async (file): Promise<CleanItem> => {
            const isGzip = isGzipFilename(file.filename);
            const fetchAndParse = async (): Promise<CleanItem> => {
              let raw: Buffer;
              if (source === "sftp") {
                const { stream: fileStream, close } = await openSftpReadStream(sftpConfig, file.loc);
                try {
                  raw = await streamToBuffer(fileStream);
                } finally {
                  await close();
                }
              } else if (source === "s3") {
                const fileStream = await openS3ReadStream(s3Config, file.loc);
                raw = await streamToBuffer(fileStream);
              } else {
                // source === "url"
                const fileStream = await openSitemapBody(file.loc);
                if (!fileStream) return { name: file.filename, urls: [], isIndex: file.isIndex };
                raw = await streamToBuffer(fileStream);
              }
              const parseInput: ParseSitemapInput = { buffer: raw, isGzip };
              const result: SitemapStreamResult = await activeParser.parse(parseInput);
              return { name: file.filename, urls: result.entries.map((e) => e.loc), isIndex: file.isIndex };
            };

            try {
              return await withTimeout(fetchAndParse(), PER_FILE_TIMEOUT_MS, `Fetching ${file.filename}`);
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              log(`[WARN] Failed to fetch ${file.filename}: ${message}`);
              return { name: file.filename, urls: [], isIndex: file.isIndex };
            } finally {
              // Keeps the SSE connection flowing during long bulk downloads — a
              // long silent gap here can otherwise be mistaken for a dead
              // connection by an idle-timeout proxy sitting in front of this route.
              fetchedCount++;
              log(`[INFO] Fetched ${fetchedCount}/${cacheFiles.length} sitemap(s)...`);
            }
          });
          log(`[INFO] Fetched ${items.length} sitemap(s)`);
        }

        // ── Clean ────────────────────────────────────────────────────────────
        log("[INFO] Filtering by domain and finding duplicates...");
        const result = cleanSitemaps(items, expectedHost);

        for (const d of result.droppedFiles) {
          log(`[INFO] Dropped ${d.name} (${d.reason})`);
        }
        log(`[INFO] Found ${result.duplicates.length} duplicate URL(s) across sitemaps`);
        for (const f of result.outputFiles) log(`[INFO] ${f.name} -> kept: ${f.urls.length} URLs`);

        log(`[INFO] Sitemaps kept      : ${result.outputFiles.length}`);
        log(`[INFO] Sitemaps dropped   : ${result.droppedFiles.length}`);
        log(`[INFO] Index files detected: ${result.indexFilesDetected}`);
        log(`[INFO] Total URLs kept    : ${result.totalUrlsKept}`);
        log(`[INFO] Total URLs removed : ${result.totalUrlsRemoved}`);

        const today = new Date().toISOString().slice(0, 10);
        const duplicatesCsv = buildDuplicatesCsv(result.duplicates);

        // ── Output ───────────────────────────────────────────────────────────
        if (output === "zip") {
          const outDir = await mkdtemp(join(tmpdir(), "asap_cleaner_"));
          const zipPath = join(outDir, `sitemap-cleaner-${runId}.zip`);

          await new Promise<void>((resolvePromise, reject) => {
            const archive = archiver("zip", { zlib: { level: 6 } });
            const out = createWriteStream(zipPath);
            out.on("close", () => resolvePromise());
            archive.on("error", reject);
            archive.pipe(out);

            for (const f of result.outputFiles) {
              archive.append(buildUrlsetXml(f.urls), { name: `clean_sitemaps/${f.name}` });
            }
            if (result.outputFiles.length > 0) {
              const indexXml = buildSitemapIndexXml(
                domain,
                subfolder,
                result.outputFiles.map((f) => f.name),
                today
              );
              archive.append(indexXml, { name: "clean_sitemaps/sitemap-index.xml" });
            }
            if (result.duplicates.length > 0) {
              archive.append(duplicatesCsv, { name: "duplicates/duplicates.csv" });
            }
            archive.finalize();
          });

          log("[DONE] Output ZIP ready. Contains clean_sitemaps/ + duplicates/");
          enqueue({ type: "done", exitCode: 0, runId, outputFilePath: zipPath });
        } else if (result.outputFiles.length === 0) {
          log("[DONE] Nothing to push — no files survived cleaning.");
          enqueue({ type: "done", exitCode: 0, runId, s3Keys: [], outputFilePath: null });
        } else {
          const s3Config = settings!.s3Config;
          log(`[INFO] Pushing ${result.outputFiles.length} cleaned file(s) to S3 (${s3Config.bucket})...`);
          const s3Keys: string[] = [];
          for (const f of result.outputFiles) {
            const key = s3KeyForDomainFile(s3Config, domain, f.name);
            await uploadS3Buffer(s3Config, Buffer.from(buildUrlsetXml(f.urls), "utf-8"), key);
            s3Keys.push(key);
          }
          const indexKey = s3KeyForDomainFile(s3Config, domain, "sitemap-index.xml");
          const indexXml = buildSitemapIndexXml(domain, subfolder, result.outputFiles.map((f) => f.name), today);
          await uploadS3Buffer(s3Config, Buffer.from(indexXml, "utf-8"), indexKey);
          s3Keys.push(indexKey);
          log(`[INFO] Pushed ${s3Keys.length} file(s) to S3.`);

          let reportPath: string | null = null;
          if (result.duplicates.length > 0) {
            const outDir = await mkdtemp(join(tmpdir(), "asap_cleaner_"));
            reportPath = join(outDir, "duplicates.csv");
            await writeFile(reportPath, duplicatesCsv, "utf-8");
          }

          log("[DONE] Cleaned files pushed to S3.");
          enqueue({ type: "done", exitCode: 0, runId, s3Keys, outputFilePath: reportPath });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log(`[ERROR] ${message}`);
        enqueue({ type: "done", exitCode: -1, runId, error: message });
      } finally {
        // Pool cleanup must never be able to prevent the stream from closing
        // — an unhandled rejection here would otherwise leave the SSE
        // response hanging instead of ending it.
        if (parser) await parser.destroy().catch(() => {});
        controller.close();
        await Promise.allSettled(batchFilesToClean.map((p) => unlink(p)));
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
