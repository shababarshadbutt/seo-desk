// Indexing Queue topbar status pill — PLACEHOLDER DATA, not real. The Stitch
// mock shows an "Indexer Daemon: Active • Auto-dispatching" status pill, but
// no background daemon/monitoring process exists anywhere in this app —
// dispatch only happens when a user clicks a dispatch/resubmit button. Same
// rotating-preset-pool pattern as lib/daily-reports-sync-fake-stats.ts /
// lib/crawler-status-fake-stats.ts. Replace with a real integration's output
// when one exists.
export interface IndexerDaemonStat {
  label: string;
  sublabel: string;
}

const PRESETS: IndexerDaemonStat[] = [
  { label: "Indexer Daemon: Active", sublabel: "Auto-dispatching" },
  { label: "Indexer Daemon: Active", sublabel: "Idle (queue clear)" },
  { label: "Indexer Daemon: Active", sublabel: "Batch running" },
  { label: "Indexer Daemon: Active", sublabel: "Auto-dispatching" },
  { label: "Indexer Daemon: Active", sublabel: "Polling GSC/Bing" },
];

export function randomIndexerDaemonStatus(): IndexerDaemonStat {
  return PRESETS[Math.floor(Math.random() * PRESETS.length)];
}
