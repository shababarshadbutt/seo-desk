// Part G addition — deterministic-per-website CMS/tech-stack generator, used
// as the seed value when a `WebsiteProfile` document is auto-created/backfilled
// on first read (see app/api/website-profiles/route.ts). The Website model has
// no CMS/platform/stack field, so this isn't a display-only fake — it backs a
// real, separate `WebsiteProfile` collection, editable later via PATCH. Same
// pattern as lib/fake-website-industries.ts, but salted with a distinct suffix
// so a site's platform doesn't trivially correlate with its industry (both
// pools happen to be similarly sized, which would otherwise make `hash % n`
// pick the same index for both).
const FAKE_PLATFORM_POOL = [
  "WordPress",
  "Next.js",
  "Custom PHP",
  "Shopify",
  "Laravel",
  "Drupal",
];

function hashString(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return Math.abs(hash);
}

export function fakePlatformForWebsite(websiteId: string): string {
  return FAKE_PLATFORM_POOL[hashString(websiteId + "-platform") % FAKE_PLATFORM_POOL.length];
}
