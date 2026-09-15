import { readFile, writeFile, mkdtemp } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, Settings, LastmodDomainCache } from "@/lib/mongodb";
import { downloadSftpFile, uploadSftpFile } from "@/lib/lastmod/sftpClient";
import { downloadS3Object, uploadS3File, s3KeyForDomainFile } from "@/lib/lastmod/s3Client";
import { rewriteIndexLastmod } from "@/lib/lastmod/indexRewrite";
import { trackLocalPath, totalTrackedBytes } from "@/lib/lastmod/localCleanup";
import type { LastmodSource } from "@/lib/mongodb";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function sseEvent(data: object): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

function todayIfEmpty(date: unknown): string {
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return new Date().toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return new Response("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => null);
  const domain = (body?.domain as string | undefined)?.trim();
  const source = body?.source as LastmodSource | undefined;
  const scope = body?.scope as "all" | "selected" | "vertical" | undefined;
  const filenames: string[] = Array.isArray(body?.filenames) ? body.filenames : [];
  const verticalTemplates: string[] = Array.isArray(body?.verticalTemplates) ? body.verticalTemplates : [];
  const date = todayIfEmpty(body?.date);

  if (!domain || !source || !scope) {
    return Response.json({ error: "domain, source, and scope are required" }, { status: 400 });
  }

  await connectDB();
  const [settings, cache] = await Promise.all([
    Settings.findOne({ singleton: true }).lean(),
    LastmodDomainCache.findOne({ domain, source }),
  ]);

  if (!cache || !cache.indexFilename) {
    return Response.json(
      { error: "No sitemap-index.xml is known for this domain yet — create one first." },
      { status: 400 }
    );
  }
  if (!settings?.s3Config?.bucket) {
    return Response.json({ error: "S3 is not configured. Add it in Settings — updates always push to S3." }, { status: 400 });
  }
  if (source === "sftp" && !settings?.sftpConfig?.host) {
    return Response.json({ error: "SFTP is not configured. Add it in Settings first." }, { status: 400 });
  }

  const indexFile = cache.files.find((f) => f.filename === cache.indexFilename);
  if (!indexFile) {
    return Response.json({ error: `Index file "${cache.indexFilename}" is missing from the cached file list.` }, { status: 500 });
  }
  if (/\.gz$/i.test(indexFile.filename)) {
    return Response.json({ error: "Gzip-compressed sitemap-index.xml files are not yet supported by the lastmod rewrite step." }, { status: 400 });
  }

  let scopeFilenames: Set<string>;
  if (scope === "all") {
    scopeFilenames = new Set(cache.files.filter((f) => !f.isIndex).map((f) => f.filename));
  } else if (scope === "selected") {
    scopeFilenames = new Set(filenames);
  } else {
    const chosen = cache.verticals.filter((v) => verticalTemplates.includes(v.template));
    scopeFilenames = new Set(chosen.flatMap((v) => v.filenames));
  }

  if (scopeFilenames.size === 0) {
    return Response.json({ error: "No files matched the selected scope." }, { status: 400 });
  }

  const runId = randomUUID();
  const s3Config = settings.s3Config;
  const sftpConfig = settings.sftpConfig;

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (data: object) => controller.enqueue(sseEvent(data));
      const log = (line: string) => enqueue({ type: "output", line });

      try {
        log(`[INFO] Starting lastmod update for ${domain} (${source}) — scope: ${scope}, date: ${date}`);
        log(`[INFO] ${scopeFilenames.size} file(s) in scope out of ${cache.files.filter((f) => !f.isIndex).length} total.`);

        const tempDir = await mkdtemp(join(tmpdir(), "asap_lastmod_"));
        const localIndexPath = join(tempDir, cache.indexFilename!);

        log(`[INFO] Downloading current ${cache.indexFilename} ...`);
        if (source === "sftp") {
          await downloadSftpFile(sftpConfig, indexFile.loc, localIndexPath);
        } else if (source === "s3") {
          await downloadS3Object(s3Config, indexFile.loc, localIndexPath);
        } else {
          const res = await fetch(indexFile.loc);
          if (!res.ok) throw new Error(`Failed to fetch index from ${indexFile.loc}: HTTP ${res.status}`);
          await writeFile(localIndexPath, await res.text(), "utf-8");
        }
        trackLocalPath(runId, localIndexPath);

        const xml = await readFile(localIndexPath, "utf-8");
        const { xml: rewritten, changedCount } = rewriteIndexLastmod(xml, scopeFilenames, date);
        log(`[INFO] Bumped <lastmod> on ${changedCount} <sitemap> entr${changedCount === 1 ? "y" : "ies"}.`);

        await writeFile(localIndexPath, rewritten, "utf-8");

        const s3Key = s3KeyForDomainFile(s3Config, domain, cache.indexFilename!);
        log(`[INFO] Pushing updated index to S3 (${s3Config.bucket}/${s3Key}) ...`);
        await uploadS3File(s3Config, localIndexPath, s3Key);

        if (source === "sftp") {
          log(`[INFO] Also pushing the updated index back to SFTP at ${indexFile.loc} ...`);
          await uploadSftpFile(sftpConfig, localIndexPath, indexFile.loc);
        }

        const localBytesUsed = await totalTrackedBytes(runId);
        log(`[DONE] Update complete. Local temp usage: ${(localBytesUsed / 1024).toFixed(1)} KB.`);

        enqueue({
          type: "done",
          exitCode: 0,
          runId,
          changedCount,
          localBytesUsed,
          s3Key,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log(`[ERROR] ${message}`);
        enqueue({ type: "done", exitCode: -1, runId, error: message });
      } finally {
        controller.close();
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
