// Backlinks Tracker topbar status pill — PLACEHOLDER DATA, not real. The
// Stitch mock shows a "Crawler: Active | 98.4% uptime" / "Bot Engine Active
// • 4m ago" status pill, but no crawler/bot monitoring system exists
// anywhere in this app. Per explicit user instruction (same pattern as
// lib/login-fake-stats.ts), this ships a rotating pool of plausible preset
// values — a different one is picked each time the page loads — rather than
// one fixed fake number. Replace with a real integration's output when one
// exists.
export interface CrawlerStatusStat {
  label: string;
  sublabel: string;
}

const PRESETS: CrawlerStatusStat[] = [
  { label: "Crawler Active", sublabel: "98.4% uptime" },
  { label: "Bot Engine Active", sublabel: "4m ago" },
  { label: "Crawler Active", sublabel: "97.9% uptime" },
  { label: "Bot Engine Active", sublabel: "1m ago" },
  { label: "Crawler Active", sublabel: "99.1% uptime" },
  { label: "Bot Engine Active", sublabel: "6m ago" },
  { label: "Crawler Active", sublabel: "98.7% uptime" },
  { label: "Bot Engine Active", sublabel: "2m ago" },
  { label: "Crawler Active", sublabel: "97.5% uptime" },
  { label: "Bot Engine Active", sublabel: "3m ago" },
];

export function randomCrawlerStatus(): CrawlerStatusStat {
  return PRESETS[Math.floor(Math.random() * PRESETS.length)];
}
