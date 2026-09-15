import type { IS3Config } from "@/lib/mongodb";
import { s3PublicUrlForFile } from "./s3Client";

// Naming convention matches the reference tool's INDEX_FILENAME fallback
// (Sitemap_Migration/backend/src/sitemaps/cleaner.ts) so generated indexes
// look the way an operator familiar with that tool already expects.
export const GENERATED_INDEX_FILENAME = "sitemap-index.xml";

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Builds a single sitemapindex referencing every discovered file — no
// pagination, matching the reference tool's buildPublishIndexXml (which also
// never splits an index across multiple files regardless of child count).
// <loc> always points at the S3 public URL since output always pushes to S3
// per the confirmed "push straight back to S3" behavior.
export function buildSitemapIndexXml(domain: string, filenames: string[], s3Cfg: IS3Config): string {
  const today = todayDateString();
  const entries = filenames
    .map((filename) => {
      const loc = s3PublicUrlForFile(s3Cfg, domain, filename);
      return `  <sitemap>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>\n`;
}
