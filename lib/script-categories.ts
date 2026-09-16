import { scripts } from "@/lib/scripts-config";

// Part B addition — a supplementary, non-protected categorization layer for the
// Scripts screen's filter pills. Deliberately kept OUTSIDE `lib/scripts-config.ts`
// (protected) — this file only reads that module's exported slugs, never edits it.
export type ScriptCategory = "Indexing" | "Sitemaps" | "Analytics";

const categoryBySlug: Record<string, ScriptCategory> = {
  "sitemap-url-extractor": "Sitemaps",
  "url-indexer": "Indexing",
  "bing-indexnow": "Indexing",
  "indexing-checker": "Indexing",
  "gsc-sitemap-submitter": "Sitemaps",
  "sitemap-deleter": "Sitemaps",
  "ga4-reporter": "Analytics",
};

export const scriptCategories: ScriptCategory[] = ["Indexing", "Sitemaps", "Analytics"];

export function getCategoryForSlug(slug: string): ScriptCategory | null {
  return categoryBySlug[slug] ?? null;
}

// Sanity note: if a new script is ever added to lib/scripts-config.ts without a
// matching entry here, getCategoryForSlug returns null and the UI simply omits
// that script from category filtering (falls back to showing it under "All").
export const uncategorizedSlugs = scripts
  .map((s) => s.slug)
  .filter((slug) => !(slug in categoryBySlug));
