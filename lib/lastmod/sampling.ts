import type { ISftpConfig, IS3Config, LastmodSource, ILastmodFile } from "@/lib/mongodb";
import { streamSitemapEntries, maybeGunzip, isGzipFilename } from "./xmlStream";
import { openSftpReadStream } from "./sftpClient";
import { openS3ReadStream } from "./s3Client";
import { openSitemapBody } from "./liveUrlDiscovery";
import type { FileUrlSample } from "./patternExtract";

const SAMPLE_URLS_PER_FILE = 300; // capped sample — never the full file, however large
const SAMPLE_CONCURRENCY = 8;

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

async function sampleOneFile(
  source: LastmodSource,
  file: ILastmodFile,
  sftpCfg: ISftpConfig | null,
  s3Cfg: IS3Config | null
): Promise<FileUrlSample> {
  const isGzip = isGzipFilename(file.filename);

  try {
    if (source === "sftp") {
      if (!sftpCfg) throw new Error("SFTP is not configured");
      const { stream, close } = await openSftpReadStream(sftpCfg, file.loc);
      try {
        const result = await streamSitemapEntries(maybeGunzip(stream, isGzip), { maxEntries: SAMPLE_URLS_PER_FILE });
        return { filename: file.filename, urls: result.entries.map((e) => e.loc) };
      } finally {
        await close();
      }
    }

    if (source === "s3") {
      if (!s3Cfg) throw new Error("S3 is not configured");
      const stream = await openS3ReadStream(s3Cfg, file.loc);
      const result = await streamSitemapEntries(maybeGunzip(stream, isGzip), { maxEntries: SAMPLE_URLS_PER_FILE });
      return { filename: file.filename, urls: result.entries.map((e) => e.loc) };
    }

    // source === "url"
    const body = await openSitemapBody(file.loc);
    if (!body) return { filename: file.filename, urls: [] };
    const result = await streamSitemapEntries(body, { maxEntries: SAMPLE_URLS_PER_FILE });
    return { filename: file.filename, urls: result.entries.map((e) => e.loc) };
  } catch {
    // A single unreachable/malformed file shouldn't abort vertical detection for the rest.
    return { filename: file.filename, urls: [] };
  }
}

// Streams a small capped sample of URLs from each non-index sitemap file so
// pattern extraction never has to load a 100M-URL file into memory.
export async function sampleUrlsForFiles(
  source: LastmodSource,
  files: ILastmodFile[],
  sftpCfg: ISftpConfig | null,
  s3Cfg: IS3Config | null
): Promise<FileUrlSample[]> {
  const leafFiles = files.filter((f) => !f.isIndex);
  return mapLimit(leafFiles, SAMPLE_CONCURRENCY, (file) => sampleOneFile(source, file, sftpCfg, s3Cfg));
}
