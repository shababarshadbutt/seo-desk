// Indexing Queue pixel-fidelity pass — PLACEHOLDER DATA, not real. The Stitch
// mock shows a "Live Sync: XX% Health" badge and a per-website "Site ID"
// chip, but no sync-health scoring or site-ID system exists anywhere in this
// app (websites are identified by their Mongo ObjectId only). Per the same
// convention as lib/daily-report-fake-metadata.ts, these are deterministic
// (hash-derived from stable ids), not random-per-render, so they don't flicker
// on every reload. Tracked in docs/design/screens/indexing-queue.md's "Known
// Placeholders" list — replace with real health-scoring/site-ID output when
// approved.

function hashString(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return Math.abs(hash);
}

// Stable for a given calendar day (not per-render) — changes tomorrow.
export function fakeSyncHealthPct(dateStr: string): number {
  const h = hashString(dateStr + "-sync-health");
  return Math.round((97 + (h % 300) / 100) * 10) / 10; // 97.0 .. 99.9
}

export function fakeSiteId(websiteId: string): string {
  const h = hashString(websiteId + "-site-id");
  const prefix = websiteId.slice(0, 3).toLowerCase();
  const num = 1000 + (h % 9000);
  return `${prefix}-${num}-sync`;
}

// Moved to lib/avatar.ts (the pattern now repeats beyond Indexing Queue) —
// re-exported here so existing imports from this file keep working.
export { AVATAR_COLORS, avatarColor, initials, type AvatarColor } from "./avatar";
