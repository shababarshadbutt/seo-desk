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

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

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
  const scratchDir = await mkdtemp(join(tmpdir(), "asap_raw_dl_"));
  const sftpConfig = settings!.sftpConfig;
  const s3Config = settings!.s3Config;

  const downloaded: { filename: string; localPath: string }[] = [];
  const failures: string[] = [];

  await mapLimit(cache.files, DOWNLOAD_CONCURRENCY, async (file) => {
    const localPath = join(scratchDir, `${randomUUID()}-${file.filename}`);
    try {
      if (source === "sftp") {
        await downloadSftpFile(sftpConfig, file.loc, localPath);
      } else if (source === "s3") {
        await downloadS3Object(s3Config, file.loc, localPath);
      } else {
        const bodyStream = await openSitemapBody(file.loc);
        if (!bodyStream) throw new Error(`Could not fetch ${file.loc}`);
        await pipeline(bodyStream, createWriteStream(localPath));
      }
      downloaded.push({ filename: file.filename, localPath });
    } catch {
      failures.push(file.filename);
    }
  });

  try {
    if (downloaded.length === 0) {
      return Response.json(
        { error: "Failed to download any of the cached sitemap files for this domain." },
        { status: 502 }
      );
    }

    const outDir = await mkdtemp(join(tmpdir(), "asap_raw_dl_zip_"));
    const zipPath = join(outDir, `raw-sitemaps-${runId}.zip`);

    await new Promise<void>((resolvePromise, reject) => {
      const archive = archiver("zip", { zlib: { level: 6 } });
      const out = createWriteStream(zipPath);
      out.on("close", () => resolvePromise());
      archive.on("error", reject);
      archive.pipe(out);
      for (const f of downloaded) {
        archive.file(f.localPath, { name: f.filename });
      }
      archive.finalize();
    });

    return Response.json({ downloadFilePath: zipPath, fileCount: downloaded.length, failures });
  } finally {
    await Promise.allSettled(downloaded.map((f) => unlink(f.localPath)));
    await rmdir(scratchDir).catch(() => {});
  }
}
