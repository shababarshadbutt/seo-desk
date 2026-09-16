// Dashboard "Automation Daemons" panel — PLACEHOLDER DATA, not real. The Stitch
// mock shows three long-running daemons (Lastmod Updater, Indexing Queue,
// Sitemap Cleaner) with health/last-sync status. No background daemon or
// health-tracking system exists anywhere in this app: Lastmod Updater and
// Sitemap Cleaner are synchronous, user-triggered processors, and the only
// genuinely recurring job is the Vercel cron at app/api/cron/daily-automation
// (which writes isAutomated ExecutionLog rows but publishes no health signal).
// Same rotating-preset-pool pattern as lib/indexer-daemon-fake-stats.ts.
// The Indexing Queue row's *backlog count* is real (passed in as a prop from
// a live IndexingQueue query) — only the status word and "synced" wording here
// are placeholder. Replace with a real integration's output when one exists.
export interface AutomationDaemonRow {
  name: string;
  status: "Synced" | "Running" | "Idle" | "Connected";
  detail: string;
}

const PRESETS: AutomationDaemonRow[][] = [
  [
    { name: "Lastmod Updater", status: "Synced", detail: "S3 bucket sync • 48ms latency" },
    { name: "Indexing Queue", status: "Running", detail: "Continuous poll (15m interval)" },
    { name: "Sitemap Cleaner", status: "Idle", detail: "Next pass in 2h 45m" },
  ],
  [
    { name: "Lastmod Updater", status: "Connected", detail: "S3 bucket sync • idle" },
    { name: "Indexing Queue", status: "Running", detail: "Polling GSC / Bing" },
    { name: "Sitemap Cleaner", status: "Synced", detail: "Rebuilt sub-sitemaps recently" },
  ],
  [
    { name: "Lastmod Updater", status: "Synced", detail: "S3 bucket sync • 52ms latency" },
    { name: "Indexing Queue", status: "Idle", detail: "Queue clear" },
    { name: "Sitemap Cleaner", status: "Running", detail: "Purging orphan URLs" },
  ],
];

export function randomAutomationDaemons(): AutomationDaemonRow[] {
  return PRESETS[Math.floor(Math.random() * PRESETS.length)];
}
