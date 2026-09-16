// Dashboard topbar "System Status: Optimal · 99.8% Health" pill — PLACEHOLDER
// DATA, not real. No uptime/health monitoring integration exists in this app.
// Same rotating-preset-pool pattern and disclosure-tooltip treatment as the
// other route-specific pills in components/topbar.tsx (see e.g.
// lib/indexer-daemon-fake-stats.ts). Replace with a real monitoring
// integration's output when one exists.
export interface SystemHealthStat {
  label: string;
  sublabel: string;
}

const PRESETS: SystemHealthStat[] = [
  { label: "System Status: Optimal", sublabel: "99.8% Health" },
  { label: "System Status: Optimal", sublabel: "99.9% Health" },
  { label: "System Status: Stable", sublabel: "99.6% Health" },
  { label: "System Status: Optimal", sublabel: "100% Health" },
];

export function randomSystemHealth(): SystemHealthStat {
  return PRESETS[Math.floor(Math.random() * PRESETS.length)];
}
