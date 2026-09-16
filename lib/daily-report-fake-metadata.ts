// Part D addition — PLACEHOLDER DATA, not real. No request logging exists on
// daily-report submissions, and no session/login-duration tracking exists
// anywhere in the app. Per explicit user instruction, this ships deterministic
// (not random-per-render) decorative values derived from the report's own id,
// purely for visual parity with the Stitch mock. Tracked in
// docs/design/screens/daily-reports.md's "Known Placeholders" list — replace
// with real request/session logging when approved.

function hashString(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return Math.abs(hash);
}

export function fakeIpAndWorkstation(recordId: string): { ip: string; workstation: string } {
  const h = hashString(recordId);
  const octet3 = (h % 254) + 1;
  const octet4 = ((h >> 8) % 254) + 1;
  const workstationNum = String(((h >> 16) % 40) + 1).padStart(2, "0");
  return { ip: `192.168.${octet3}.${octet4}`, workstation: `Workstation #${workstationNum}` };
}

export function fakeShiftDurationMinutes(recordId: string): number {
  const h = hashString(recordId + "-shift");
  // Plausible shift range: 5h30m (330min) to 9h (540min)
  return 330 + (h % 210);
}

export function formatShiftDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

export interface FakeDailyStats {
  backlinksVelocityPct: number;
  backlinksQuotaPct: number;
  rfqsPassed: number;
  rfqsHealthPct: number;
}

// One set of decorative numbers per calendar day (stable all day, changes
// tomorrow) — not tied to any real quota/QA/conversion-testing concept.
export function fakeDailyStats(dateStr: string): FakeDailyStats {
  const h = hashString(dateStr + "-daily-fake-stats");
  return {
    backlinksVelocityPct: Math.round((((h % 400) / 10) - 5) * 10) / 10, // -5.0..+35.0
    backlinksQuotaPct: 90 + (h % 60), // 90..149
    rfqsPassed: (h >> 4) % 20, // 0..19
    rfqsHealthPct: 85 + (h % 16), // 85..100
  };
}
