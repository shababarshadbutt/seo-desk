// Generic, deterministic-per-user job-title generator. Originally built for
// Daily Reports (Part D) as a purely client-side placeholder; now (Part F)
// used server-side too, as the seed value when a `UserProfile` document is
// auto-created on first read (see app/api/user-profiles/route.ts). The User
// model has no job-title field (only role: admin/sub-lead/super-admin), and
// adding one there would mean editing the protected lib/mongodb/models/User.ts
// — so real titles live in the new, separate `UserProfile` collection instead,
// seeded from this pool until a super-admin edits one to something real.
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
