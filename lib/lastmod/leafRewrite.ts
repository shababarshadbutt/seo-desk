import { createReadStream, createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { Transform, type TransformCallback } from "stream";
import { StringDecoder } from "string_decoder";
import { createGunzip, createGzip } from "zlib";

// Rewrites <lastmod> content inside a LEAF sitemap file (a <urlset>, as
// opposed to the small <sitemapindex> lib/lastmod/indexRewrite.ts already
// handles with a full-string regex). Leaf files can hold millions of <url>
// entries, so — mirroring the reference tool's
// Sitemap_Migration/backend/src/sitemaps/rewriteLocs.ts LastmodRewriteTransform —
// this streams the file chunk by chunk and only ever holds one element's text
// in memory at a time, rather than materializing the whole document.
//
// Simpler than the reference transform: seo-desk's lastmod scope is always a
// whole FILE (All Files / Selected Files / Vertical wise all resolve to a set
// of filenames, never a set of individual URLs within a file), so every
// <lastmod> found gets the same target date — no need to track the preceding
// <loc> to decide per-URL, just a single "<lastmod>...</lastmod>" marker.
//
// SCOPE (matches the reference tool's v1): only an EXISTING <lastmod>
// element's value is rewritten. A <url> block with no <lastmod> at all is
// left exactly as-is — inserting one byte-safely (indentation, placement
// relative to <changefreq>/<priority>) is a separate piece of work.
const LASTMOD_OPEN = "<lastmod>";
const LASTMOD_CLOSE = "</lastmod>";

function decodeXmlText(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function encodeXmlText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Replace a <lastmod> element's raw inner text with a new plain value,
// preserving whether the original was CDATA-wrapped and its surrounding
// whitespace padding.
function replaceInnerText(rawInner: string, newValue: string): string {
  const cdataMatch = rawInner.match(/^(\s*)<!\[CDATA\[([\s\S]*?)\]\]>(\s*)$/);
  if (cdataMatch) {
    const [, leading, , trailing] = cdataMatch;
    return `${leading}<![CDATA[${newValue}]]>${trailing}`;
  }
  const leading = rawInner.match(/^\s*/)?.[0] ?? "";
  const trailing = rawInner.match(/\s*$/)?.[0] ?? "";
  return `${leading}${encodeXmlText(newValue)}${trailing}`;
}

function decodeInnerText(rawInner: string): string {
  const cdataMatch = rawInner.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  if (cdataMatch) return cdataMatch[1].trim();
  return decodeXmlText(rawInner.trim());
}

class LastmodRewriteTransform extends Transform {
  private pending = "";
  private inLastmod = false;
  private captured = "";
  private readonly decoder = new StringDecoder("utf8");

  rewrittenCount = 0;

  constructor(private readonly newDate: string) {
    super({ decodeStrings: false, encoding: "utf8" });
  }

  override _transform(chunk: string | Buffer, _encoding: BufferEncoding, callback: TransformCallback) {
    const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    // StringDecoder buffers any partial multibyte sequence at the chunk
    // boundary so we never split a UTF-8 character mid-stream.
    this.pending += this.decoder.write(buffer);
    this.drain(false);
    callback();
  }

  override _flush(callback: TransformCallback) {
    this.pending += this.decoder.end();
    this.drain(true);

    if (this.inLastmod) {
      // Unterminated <lastmod>: emit what was captured verbatim rather than lose it.
      this.push(this.captured);
      this.captured = "";
      this.inLastmod = false;
    }
    if (this.pending) {
      this.push(this.pending);
      this.pending = "";
    }
    callback();
  }

  private drain(isEnd: boolean) {
    for (;;) {
      if (!this.inLastmod) {
        const openIndex = this.pending.indexOf(LASTMOD_OPEN);
        if (openIndex === -1) {
          // Hold back a tail that could be a partial "<lastmod>" straddling chunks.
          const keep = isEnd ? 0 : LASTMOD_OPEN.length - 1;
          const safeLength = Math.max(0, this.pending.length - keep);
          if (safeLength > 0) {
            this.push(this.pending.slice(0, safeLength));
            this.pending = this.pending.slice(safeLength);
          }
          return;
        }

        this.push(this.pending.slice(0, openIndex + LASTMOD_OPEN.length));
        this.pending = this.pending.slice(openIndex + LASTMOD_OPEN.length);
        this.inLastmod = true;
        this.captured = "";
      } else {
        const closeIndex = this.pending.indexOf(LASTMOD_CLOSE);
        if (closeIndex === -1) {
          const keep = isEnd ? 0 : LASTMOD_CLOSE.length - 1;
          const safeLength = Math.max(0, this.pending.length - keep);
          this.captured += this.pending.slice(0, safeLength);
          this.pending = this.pending.slice(safeLength);
          return;
        }

        this.captured += this.pending.slice(0, closeIndex);

        const currentValue = decodeInnerText(this.captured);
        if (currentValue !== this.newDate) {
          this.rewrittenCount += 1;
          this.push(replaceInnerText(this.captured, this.newDate));
        } else {
          this.push(this.captured);
        }

        this.push(LASTMOD_CLOSE);
        this.pending = this.pending.slice(closeIndex + LASTMOD_CLOSE.length);
        this.inLastmod = false;
        this.captured = "";
      }
    }
  }
}

// Stream `inputPath` through the <lastmod> rewriter into `outputPath`,
// decompressing/recompressing when the file is gzipped. Returns how many
// <lastmod> elements were actually changed (one already reading the target
// date, or a <url> block with no <lastmod> at all, does not count).
export async function rewriteLeafLastmodFile(options: {
  inputPath: string;
  outputPath: string;
  isGzip: boolean;
  newDate: string;
}): Promise<number> {
  const transform = new LastmodRewriteTransform(options.newDate);
  const readable = createReadStream(options.inputPath);
  const writable = createWriteStream(options.outputPath);
  const stages = options.isGzip
    ? [readable, createGunzip(), transform, createGzip(), writable]
    : [readable, transform, writable];

  await pipeline(stages);

  return transform.rewrittenCount;
}
