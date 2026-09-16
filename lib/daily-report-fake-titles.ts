// Part D addition — PLACEHOLDER DATA, not real. The User model has no job-title
// field (only role: admin/sub-lead/super-admin); adding a real one would mean
// editing the protected lib/mongodb/models/User.ts. Per explicit user
// instruction, this ships a deterministic-per-user generic label purely for
// visual parity with the Stitch mock (same person always gets the same fake
// title, but it isn't tied to their real role/permissions). Tracked in
// docs/design/screens/daily-reports.md's "Known Placeholders" list — replace
// with a real per-user field when approved.
const FAKE_TITLE_POOL = [
  "SEO Specialist",
  "Senior Link Specialist",
  "Technical SEO Engineer",
  "Off-Page Lead",
  "Content Strategist",
  "Outreach Coordinator",
  "Indexing Analyst",
];

function hashString(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return Math.abs(hash);
}

export function fakeTitleForUser(userId: string): string {
  return FAKE_TITLE_POOL[hashString(userId) % FAKE_TITLE_POOL.length];
}
