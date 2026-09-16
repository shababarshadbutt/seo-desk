// Daily Reports topbar status pill — PLACEHOLDER DATA, not real. The Stitch
// mock shows a "Realtime Sync Engine • Active (12m ago)" status pill, but no
// report-sync/aggregation engine exists anywhere in this app — reports are
// fetched directly from MongoDB on each page load. Same rotating-preset
// pattern as lib/crawler-status-fake-stats.ts. Replace with a real
// integration's output when one exists.
export interface SyncEngineStat {
  label: string;
  sublabel: string;
}

const PRESETS: SyncEngineStat[] = [
  { label: "Realtime Sync Engine", sublabel: "Active (12m ago)" },
  { label: "Realtime Sync Engine", sublabel: "Active (3m ago)" },
  { label: "Realtime Sync Engine", sublabel: "Active (7m ago)" },
  { label: "Realtime Sync Engine", sublabel: "Active (1m ago)" },
  { label: "Realtime Sync Engine", sublabel: "Active (9m ago)" },
];

export function randomSyncEngineStatus(): SyncEngineStat {
  return PRESETS[Math.floor(Math.random() * PRESETS.length)];
}
