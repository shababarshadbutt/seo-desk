// Bumps <lastmod> only for the <sitemap> entries whose <loc> matches the
// selected scope, leaving every other byte of the index untouched — a
// sitemap-index is small (thousands of entries, not millions), so a targeted
// block-level find/replace is enough; no need for the reference tool's
// heavyweight streaming Transform built for rewriting 100M-<loc> leaf files.
const SITEMAP_BLOCK_RE = /<sitemap\b[^>]*>[\s\S]*?<\/sitemap>/gi;
const LOC_RE = /<loc\b[^>]*>([\s\S]*?)<\/loc>/i;
const LASTMOD_RE = /<lastmod\b[^>]*>[\s\S]*?<\/lastmod>/i;

function filenameFromLoc(loc: string): string {
  try {
    return new URL(loc).pathname.split("/").filter(Boolean).pop() || loc;
  } catch {
    return loc.split("/").filter(Boolean).pop() || loc;
  }
}

export interface IndexRewriteResult {
  xml: string;
  changedCount: number;
}

export function rewriteIndexLastmod(xml: string, scopeFilenames: Set<string>, newDate: string): IndexRewriteResult {
  let changedCount = 0;

  const rewritten = xml.replace(SITEMAP_BLOCK_RE, (block) => {
    const locMatch = block.match(LOC_RE);
    if (!locMatch) return block;

    const filename = filenameFromLoc(locMatch[1].trim());
    if (!scopeFilenames.has(filename)) return block;

    changedCount++;
    if (LASTMOD_RE.test(block)) {
      return block.replace(LASTMOD_RE, `<lastmod>${newDate}</lastmod>`);
    }
    return block.replace(LOC_RE, (locTag) => `${locTag}\n    <lastmod>${newDate}</lastmod>`);
  });

  return { xml: rewritten, changedCount };
}
