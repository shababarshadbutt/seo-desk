import { Readable } from "stream";
import { maybeGunzip, streamSitemapEntries, type SitemapStreamResult } from "../lastmod/xmlStream";

export interface ParseSitemapInput {
  buffer: Buffer;
  isGzip: boolean;
}

export type { SitemapStreamResult };

// Piscina task entrypoint — runs in a worker thread. The caller must hand us
// the whole file's bytes (a live network Readable can't cross a worker_threads
// boundary), so this is a deliberate streaming -> buffered trade-off in
// exchange for parallelizing the CPU-bound gunzip/XML-parse work.
export default async function parseSitemapBuffer(input: ParseSitemapInput): Promise<SitemapStreamResult> {
  // Structured-clone across the worker_threads boundary can deserialize a
  // Buffer as a plain Uint8Array — Readable.from() only special-cases an
  // actual Buffer instance (single chunk); anything else it treats as a
  // generic iterable and yields byte-by-byte, which silently breaks the XML
  // parser. Buffer.from() normalizes either shape back into a real Buffer.
  const buf = Buffer.isBuffer(input.buffer) ? input.buffer : Buffer.from(input.buffer);
  const stream = maybeGunzip(Readable.from(buf), input.isGzip);
  return streamSitemapEntries(stream);
}
