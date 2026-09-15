import sax from "sax";
import { createGunzip } from "zlib";
import type { Readable } from "stream";

export function isGzipFilename(name: string): boolean {
  return /\.gz$/i.test(name);
}

// Wraps a raw byte stream with gunzip when needed — caller decides based on
// filename suffix or a Content-Encoding header, never by sniffing content.
export function maybeGunzip(stream: Readable, isGzip: boolean): Readable {
  if (!isGzip) return stream;
  const gunzip = createGunzip();
  stream.on("error", (err) => gunzip.destroy(err));
  stream.pipe(gunzip);
  return gunzip;
}

export interface SitemapLocEntry {
  loc: string;
  lastmod: string | null;
}

export interface SitemapStreamResult {
  rootElement: "sitemapindex" | "urlset" | "unknown";
  entries: SitemapLocEntry[];
  truncated: boolean;
}

// Streams a sitemap/sitemap-index XML document one tag at a time via `sax` —
// never materializes the full file in memory. Stops early once `maxEntries`
// <sitemap>/<url> entries are collected (critical for sampling a handful of
// URLs out of a file that may contain millions), and tolerates a mid-stream
// parse error by resolving with whatever was read so far, same as the
// reference tool's partial-parse handling for malformed sitemaps.
export function streamSitemapEntries(
  input: Readable,
  opts: { maxEntries?: number } = {}
): Promise<SitemapStreamResult> {
  const maxEntries = opts.maxEntries ?? Infinity;

  return new Promise((resolve, reject) => {
    const parser = sax.createStream(true, { trim: true, lowercase: true });

    const entries: SitemapLocEntry[] = [];
    let rootElement: SitemapStreamResult["rootElement"] = "unknown";
    let currentEntryTag: "sitemap" | "url" | null = null;
    let loc = "";
    let lastmod: string | null = null;
    let textBuf = "";
    let settled = false;

    const finish = (result: SitemapStreamResult) => {
      if (settled) return;
      settled = true;
      input.unpipe(parser);
      input.destroy();
      resolve(result);
    };

    parser.on("opentag", (node) => {
      const name = node.name;
      if (rootElement === "unknown" && (name === "sitemapindex" || name === "urlset")) {
        rootElement = name;
      }
      if (name === "sitemap" || name === "url") {
        currentEntryTag = name;
        loc = "";
        lastmod = null;
      }
      textBuf = "";
    });

    parser.on("text", (text) => {
      textBuf += text;
    });

    parser.on("closetag", (name: string) => {
      if (currentEntryTag) {
        if (name === "loc") loc = textBuf.trim();
        if (name === "lastmod") lastmod = textBuf.trim() || null;
      }
      textBuf = "";

      if (currentEntryTag && name === currentEntryTag) {
        if (loc) entries.push({ loc, lastmod });
        currentEntryTag = null;
        if (entries.length >= maxEntries) {
          finish({ rootElement, entries, truncated: true });
        }
      }
    });

    parser.on("end", () => finish({ rootElement, entries, truncated: false }));

    parser.on("error", () => {
      // Keep whatever completed entries were read before the malformed byte —
      // consistent with the reference tool keeping partial <loc> results.
      finish({ rootElement, entries, truncated: true });
    });

    input.on("error", (err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    });

    input.pipe(parser);
  });
}

// Reads only far enough to learn the document's root element, then destroys
// the stream — lets discovery tell a sitemap-index (small, safe to fully
// parse) apart from a bare urlset (which may hold 100M+ <url> entries we must
// never attempt to load) without reading past the opening tag.
export function peekRootElement(input: Readable): Promise<"sitemapindex" | "urlset" | "unknown"> {
  return new Promise((resolve, reject) => {
    const parser = sax.createStream(true, { trim: true, lowercase: true });
    let settled = false;

    const finish = (root: "sitemapindex" | "urlset" | "unknown") => {
      if (settled) return;
      settled = true;
      input.unpipe(parser);
      input.destroy();
      resolve(root);
    };

    parser.on("opentag", (node) => {
      if (node.name === "sitemapindex" || node.name === "urlset") finish(node.name);
      else finish("unknown");
    });
    parser.on("end", () => finish("unknown"));
    parser.on("error", () => finish("unknown"));
    input.on("error", (err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    });

    input.pipe(parser);
  });
}
