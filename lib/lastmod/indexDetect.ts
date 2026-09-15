import type { ISftpConfig, IS3Config, LastmodSource, ILastmodFile } from "@/lib/mongodb";
import { peekRootElement, maybeGunzip, isGzipFilename } from "./xmlStream";
import { openSftpReadStream } from "./sftpClient";
import { openS3ReadStream } from "./s3Client";

const NAME_HEURISTIC = ["sitemap-index.xml", "sitemap_index.xml", "sitemapindex.xml", "sitemap.xml"];
const MAX_FALLBACK_PEEKS = 30;
const PEEK_CONCURRENCY = 8;

async function peekFile(
  source: LastmodSource,
  file: ILastmodFile,
  sftpCfg: ISftpConfig | null,
  s3Cfg: IS3Config | null
): Promise<boolean> {
  const isGzip = isGzipFilename(file.filename);
  try {
    if (source === "sftp") {
      if (!sftpCfg) return false;
      const { stream, close } = await openSftpReadStream(sftpCfg, file.loc);
      try {
        return (await peekRootElement(maybeGunzip(stream, isGzip))) === "sitemapindex";
      } finally {
        await close();
      }
    }
    if (source === "s3") {
      if (!s3Cfg) return false;
      const stream = await openS3ReadStream(s3Cfg, file.loc);
      return (await peekRootElement(maybeGunzip(stream, isGzip))) === "sitemapindex";
    }
    return false;
  } catch {
    return false;
  }
}

async function someLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<boolean>): Promise<T | null> {
  let nextIndex = 0;
  let found: T | null = null;
  let stopped = false;

  async function worker() {
    while (!stopped && nextIndex < items.length) {
      const item = items[nextIndex++];
      if (await fn(item)) {
        found = item;
        stopped = true;
        return;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return found;
}

// Finds which (if any) of a domain's listed files is a sitemap-index, without
// peeking every file when a conventional name is present. Bounded so a
// domain with thousands of leaf sitemap files never triggers thousands of
// peek requests — a heuristic, not an exhaustive guarantee (see
// app/api/lastmod-updater/fetch-files/route.ts for how "no index found"
// then prompts the user before assuming one is truly missing).
export async function detectIndexFile(
  source: LastmodSource,
  files: ILastmodFile[],
  sftpCfg: ISftpConfig | null,
  s3Cfg: IS3Config | null
): Promise<{ indexFilename: string | null; files: ILastmodFile[] }> {
  const byName = new Map(files.map((f) => [f.filename.toLowerCase(), f]));

  for (const candidate of NAME_HEURISTIC) {
    const file = byName.get(candidate);
    if (file && (await peekFile(source, file, sftpCfg, s3Cfg))) {
      return { indexFilename: file.filename, files: markIndex(files, file.filename) };
    }
  }

  const remaining = files
    .filter((f) => !NAME_HEURISTIC.includes(f.filename.toLowerCase()))
    .slice(0, MAX_FALLBACK_PEEKS);
  const found = await someLimit(remaining, PEEK_CONCURRENCY, (f) => peekFile(source, f, sftpCfg, s3Cfg));

  if (found) return { indexFilename: found.filename, files: markIndex(files, found.filename) };
  return { indexFilename: null, files };
}

function markIndex(files: ILastmodFile[], indexFilename: string): ILastmodFile[] {
  return files.map((f) => (f.filename === indexFilename ? { ...f, isIndex: true } : f));
}
