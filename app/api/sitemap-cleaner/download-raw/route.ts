import { mkdtemp, unlink, rmdir } from "fs/promises";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import archiver from "archiver";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, Settings, LastmodDomainCache } from "@/lib/mongodb";
import type { LastmodSource } from "@/lib/mongodb";
import { downloadSftpFile } from "@/lib/lastmod/sftpClient";
import { downloadS3Object } from "@/lib/lastmod/s3Client";
import { openSitemapBody } from "@/lib/lastmod/liveUrlDiscovery";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DOWNLOAD_CONCURRENCY = 8;

// A single stalled file (out of a batch that can run into the thousands)
// must not hang the whole run — cap each file's download at this ceiling and
// treat a timeout the same as any other per-file failure.
const PER_FILE_TIMEOUT_MS = 120_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

function sseEvent(data: object): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
  onSettle?: (completed: number, total: number) => void
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  let completed = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      results[i] = await fn(items[i]);
      completed++;
      onSettle?.(completed, items.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return new Response("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => null);
  const source = body?.source as LastmodSource | undefined;
  const domain = (body?.domain as string | undefined)?.trim();

  if (!source || !domain) {
    return Response.json({ error: "source and domain are required" }, { status: 400 });
  }

  await connectDB();
  const settings = await Settings.findOne({ singleton: true }).lean();

  if (source === "sftp" && !settings?.sftpConfig?.host) {
    return Response.json({ error: "SFTP is not configured. Add it in Settings first." }, { status: 400 });
  }
  if (source === "s3" && !settings?.s3Config?.bucket) {
    return Response.json({ error: "S3 is not configured. Add it in Settings first." }, { status: 400 });
  }

  const cache = await LastmodDomainCache.findOne({ domain, source });
  if (!cache || cache.files.length === 0) {
    return Response.json(
      { error: `No cached file list for "${domain}" (${source}) — fetch files first.` },
      { status: 400 }
    );
  }

  const runId = randomUUID();
  const sftpConfig = settings!.sftpConfig;
  const s3Config = settings!.s3Config;
  const files = cache.files;

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (data: object) => controller.enqueue(sseEvent(data));
      const log = (line: string) => enqueue({ type: "output", line });

      const scratchDir = await mkdtemp(join(tmpdir(), "asap_raw_dl_"));
      const downloaded: { filename: string; localPath: string }[] = [];
      const failures: string[] = [];

      try {
        log(`[INFO] Downloading ${files.length} raw sitemap file(s) via ${source}...`);

        // Only log roughly ~20 progress lines total regardless of batch size —
        // enough to show a large (thousands-of-files) run is still moving,
        // without flooding the terminal output with one line per file.
        const progressEvery = Math.max(1, Math.round(files.length / 20));

        await mapLimit(
          files,
          DOWNLOAD_CONCURRENCY,
          async (file) => {
            const localPath = join(scratchDir, `${randomUUID()}-${file.filename}`);
            const downloadOne = async () => {
              if (source === "sftp") {
                await downloadSftpFile(sftpConfig, file.loc, localPath);
              } else if (source === "s3") {
                await downloadS3Object(s3Config, file.loc, localPath);
              } else {
                const bodyStream = await openSitemapBody(file.loc);
                if (!bodyStream) throw new Error(`Could not fetch ${file.loc}`);
                await pipeline(bodyStream, createWriteStream(localPath));
              }
            };
            try {
              await withTimeout(downloadOne(), PER_FILE_TIMEOUT_MS, `Downloading ${file.filename}`);
              downloaded.push({ filename: file.filename, localPath });
            } catch {
              failures.push(file.filename);
            }
          },
          (completed, total) => {
            if (completed % progressEvery === 0 || completed === total) {
              log(`[INFO] Downloaded ${completed}/${total} raw sitemap file(s)...`);
            }
          }
        );

        if (failures.length > 0) {
          log(`[INFO] ${failures.length} file(s) failed to download and were skipped.`);
        }

        if (downloaded.length === 0) {
          log("[ERROR] Failed to download any of the cached sitemap files for this domain.");
          enqueue({ type: "done", exitCode: -1, runId, error: "Failed to download any of the cached sitemap files for this domain." });
          return;
        }

        const outDir = await mkdtemp(join(tmpdir(), "asap_raw_dl_zip_"));
        const zipPath = join(outDir, `raw-sitemaps-${runId}.zip`);

        await new Promise<void>((resolvePromise, reject) => {
          // level 0 (STORE) — sitemaps are already small XML/text, and at a few
          // thousand files, skipping deflate work cuts the zip-build time drastically.
          const archive = archiver("zip", { zlib: { level: 0 } });
          const out = createWriteStream(zipPath);
          out.on("close", () => resolvePromise());
          archive.on("error", reject);
          archive.pipe(out);
          for (const f of downloaded) {
            archive.file(f.localPath, { name: f.filename });
          }
          archive.finalize();
        });

        log(`[DONE] Raw ZIP ready — ${downloaded.length} file(s).`);
        enqueue({ type: "done", exitCode: 0, runId, downloadFilePath: zipPath, fileCount: downloaded.length, failures });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log(`[ERROR] ${message}`);
        enqueue({ type: "done", exitCode: -1, runId, error: message });
      } finally {
        controller.close();
        await Promise.allSettled(downloaded.map((f) => unlink(f.localPath)));
        await rmdir(scratchDir).catch(() => {});
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
