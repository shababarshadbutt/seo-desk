// Part G addition — deterministic-per-website SEO health score generator,
// used as the seed value when a `WebsiteProfile` document is auto-created/
// backfilled on first read (see app/api/website-profiles/route.ts). No health
// scoring/monitoring system exists anywhere in this app, so this isn't a
// display-only fake — it backs a real, separate `WebsiteProfile` collection,
// editable later via PATCH. Same pattern as lib/fake-website-industries.ts,
// salted with a distinct suffix so it doesn't correlate with the industry or
// platform hash of the same website.
//
// The SCORE below is a placeholder. The STATUS THRESHOLDS are not — they are
// real, shared policy (straight from the Stitch design's own filter copy:
// Healthy ≥ 90, Needs Attention 75–89, Critical < 75) so a score computed by
// any future real health-check would classify identically.

function hashString(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return Math.abs(hash);
}

// Skewed distribution so roughly ~4-5% of sites land "critical" and ~15%
// land "notice" — matching the ~14-of-309 "needs review" ratio shown in the
// Stitch mock, rather than a flat/uniform spread.
export function fakeHealthScoreForWebsite(websiteId: string): number {
  const h = hashString(websiteId + "-seo-health");
  const bucket = h % 1000;

  let min: number;
  let range: number;
  if (bucket < 45) {
    min = 62;
    range = 13; // 62.0 – 74.9 → critical
  } else if (bucket < 200) {
    min = 75;
    range = 15; // 75.0 – 89.9 → notice
  } else {
    min = 90;
    range = 10; // 90.0 – 99.9 → healthy
  }

  const fraction = (h % 1000) / 1000;
  return Math.round((min + fraction * range) * 10) / 10;
}

export type WebsiteHealthStatus = "healthy" | "notice" | "critical";

export function websiteHealthStatus(score: number): WebsiteHealthStatus {
  if (score >= 90) return "healthy";
  if (score >= 75) return "notice";
  return "critical";
}

export const HEALTH_STATUS_LABEL: Record<WebsiteHealthStatus, string> = {
  healthy: "Healthy",
  notice: "Notice",
  critical: "Critical",
};

export const HEALTH_STATUS_BADGE_VARIANT: Record<WebsiteHealthStatus, "success" | "warning" | "danger"> = {
  healthy: "success",
  notice: "warning",
  critical: "danger",
};
