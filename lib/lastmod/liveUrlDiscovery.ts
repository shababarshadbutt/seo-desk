import { Readable } from "stream";
import { streamSitemapEntries, peekRootElement, maybeGunzip, isGzipFilename } from "./xmlStream";

const REQUEST_TIMEOUT_MS = 20_000;
const MAX_DEPTH = 6; // mirrors the bounded-recursion cap already used by scripts/python/sitemap_url_extractor.py
const MAX_FILES = 20_000; // safety valve against pathological/broken sitemap-index graphs
const CHILD_CONCURRENCY = 8; // matches the SITEMAP_CONCURRENCY already used in app/api/cron/daily-automation/route.ts
const USER_AGENT = "ASAPScripting-LastmodUpdater/1.0 (+https://tkxel.com)";

export interface DiscoveredFile {
  filename: string;
  loc: string; // absolute URL
  isIndex: boolean;
  sizeBytes: number;
}

export interface DiscoveryResult {
  files: DiscoveredFile[];
  indexFilename: string | null;
}

function normalizeOrigin(siteUrl: string): string {
  const withScheme = /^https?:\/\//i.test(siteUrl) ? siteUrl : `https://${siteUrl}`;
  return new URL(withScheme).origin;
}

function filenameFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    return path.split("/").filter(Boolean).pop() || "sitemap.xml";
  } catch {
    return "sitemap.xml";
  }
}

// Tracks *why* the most recent fetchWithTimeout call returned null/non-ok —
// swallowed entirely before this, which made a WAF/CDN block (403/challenge),
// a DNS/network failure, and a 20s timeout all look identical to the caller.
let lastFetchDiagnostic = "";

async function fetchWithTimeout(url: string): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": USER_AGENT, Accept: "application/xml,text/xml,*/*" },
    });
    lastFetchDiagnostic = res.ok ? "" : `HTTP ${res.status}`;
    return res;
  } catch (err) {
    lastFetchDiagnostic = controller.signal.aborted
      ? `timed out after ${REQUEST_TIMEOUT_MS}ms`
      : err instanceof Error
        ? err.message
        : String(err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function openSitemapBody(url: string): Promise<Readable | null> {
  const res = await fetchWithTimeout(url);
  if (!res || !res.ok || !res.body) return null;
  // fetch already transparently decompresses a gzip Content-Encoding response
  // (the body we get here is plain text even though the header still says
  // "gzip") — only treat the body as gzip when the file itself is a literal
  // .xml.gz resource, never based on the transport's Content-Encoding header.
  const isGzip = isGzipFilename(url);
  // fetch's Response.body is a WHATWG stream; Readable.fromWeb bridges it to Node's stream API.
  const nodeStream = Readable.fromWeb(res.body as unknown as import("stream/web").ReadableStream<Uint8Array>);
  return maybeGunzip(nodeStream, isGzip);
}

export async function discoverRobotsSitemaps(siteUrl: string): Promise<{ urls: string[]; attempts: string[] }> {
  const origin = normalizeOrigin(siteUrl);
  const attempts: string[] = [];
  const robots = await fetchWithTimeout(`${origin}/robots.txt`);
  const sitemapUrls: string[] = [];

  if (robots && robots.ok) {
    const text = await robots.text();
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*sitemap\s*:\s*(\S+)/i);
      if (match) sitemapUrls.push(match[1]);
    }
    if (sitemapUrls.length === 0) attempts.push(`${origin}/robots.txt: reachable but no "Sitemap:" line found`);
  } else {
    attempts.push(`${origin}/robots.txt: ${lastFetchDiagnostic || "unreachable"}`);
  }

  if (sitemapUrls.length === 0) {
    for (const candidate of ["/sitemap.xml", "/sitemap_index.xml"]) {
      const url = `${origin}${candidate}`;
      const res = await fetchWithTimeout(url);
      if (res && res.ok) {
        sitemapUrls.push(url);
        break;
      }
      attempts.push(`${url}: ${lastFetchDiagnostic || "unreachable"}`);
    }
  }

  return { urls: sitemapUrls, attempts };
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

// Discovers every sitemap file reachable for a site: robots.txt (falling back
// to /sitemap.xml, /sitemap_index.xml) → recursively expand any nested
// sitemap-index up to MAX_DEPTH. Never parses a leaf urlset's own <url>
// entries here — peekRootElement reads only the opening tag, so a file with
// 100M <url> children costs one HTTP request and a few bytes, not a full scan.
export async function discoverSitemapFiles(siteUrl: string): Promise<DiscoveryResult> {
  const { urls: roots, attempts } = await discoverRobotsSitemaps(siteUrl);
  if (roots.length === 0) {
    const detail = attempts.length > 0 ? ` Details: ${attempts.join("; ")}` : "";
    throw new Error(
      `No sitemap could be discovered — checked robots.txt for Sitemap: entries and fell back to /sitemap.xml and /sitemap_index.xml with no luck.${detail}`
    );
  }

  const files = new Map<string, DiscoveredFile>();
  let indexFilename: string | null = null;

  async function walk(url: string, depth: number) {
    if (depth > MAX_DEPTH || files.size >= MAX_FILES || files.has(url)) return;

    const peekBody = await openSitemapBody(url);
    if (!peekBody) return;
    const rootElement = await peekRootElement(peekBody);
    const filename = filenameFromUrl(url);

    if (rootElement === "sitemapindex") {
      files.set(url, { filename, loc: url, isIndex: true, sizeBytes: 0 });
      if (indexFilename === null) indexFilename = filename;

      // The peek already consumed/destroyed the stream to learn the root tag —
      // re-fetch to read the (small) full list of child <sitemap> entries.
      const fullBody = await openSitemapBody(url);
      if (!fullBody) return;
      const result = await streamSitemapEntries(fullBody, { maxEntries: MAX_FILES });
      const children = result.entries.slice(0, MAX_FILES - files.size);
      await mapLimit(children, CHILD_CONCURRENCY, (child) => walk(child.loc, depth + 1));
    } else {
      files.set(url, { filename, loc: url, isIndex: false, sizeBytes: 0 });
    }
  }

  await mapLimit(roots, CHILD_CONCURRENCY, (root) => walk(root, 0));

  return { files: Array.from(files.values()), indexFilename };
}

export { openSitemapBody };
