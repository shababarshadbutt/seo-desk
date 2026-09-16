// Part E addition — PLACEHOLDER DATA, not real. The Login screen's "Organic
// Reach Tracker" card (Stitch mock) shows indexed-page counts, SERP rank
// tracking, and a live-health score — none of which exist anywhere in this
// app's real schema (no crawler, no rank tracker, no health-scoring system).
// Per explicit user instruction, this ships a rotating pool of plausible
// preset values — a different one is chosen each time the login page loads
// ("rotate on every login") — rather than one fixed fake number. Tracked in
// docs/design/screens/login.md's "Known Placeholders" list — replace with a
// real integration's output when one exists.
export interface LoginFakeStats {
  indexedPages: string;
  top3Rank: string;
  healthScore: string;
  deltaPct: string;
  requestsPerSec: string;
  progressPct: number;
}

const PRESETS: LoginFakeStats[] = [
  { indexedPages: "1.48M", top3Rank: "14,290", healthScore: "98.2%", deltaPct: "+28.4%", requestsPerSec: "120", progressPct: 82 },
  { indexedPages: "1.52M", top3Rank: "14,610", healthScore: "97.6%", deltaPct: "+24.1%", requestsPerSec: "134", progressPct: 76 },
  { indexedPages: "1.39M", top3Rank: "13,845", healthScore: "98.9%", deltaPct: "+31.7%", requestsPerSec: "108", progressPct: 88 },
  { indexedPages: "1.61M", top3Rank: "15,102", healthScore: "96.8%", deltaPct: "+19.3%", requestsPerSec: "142", progressPct: 71 },
  { indexedPages: "1.44M", top3Rank: "14,055", healthScore: "99.1%", deltaPct: "+33.2%", requestsPerSec: "115", progressPct: 91 },
  { indexedPages: "1.57M", top3Rank: "14,890", healthScore: "97.3%", deltaPct: "+22.6%", requestsPerSec: "127", progressPct: 79 },
  { indexedPages: "1.33M", top3Rank: "13,410", healthScore: "98.5%", deltaPct: "+27.9%", requestsPerSec: "99", progressPct: 85 },
  { indexedPages: "1.69M", top3Rank: "15,730", healthScore: "96.2%", deltaPct: "+17.8%", requestsPerSec: "151", progressPct: 68 },
  { indexedPages: "1.46M", top3Rank: "14,205", healthScore: "98.7%", deltaPct: "+29.5%", requestsPerSec: "118", progressPct: 87 },
  { indexedPages: "1.55M", top3Rank: "14,715", healthScore: "97.9%", deltaPct: "+25.4%", requestsPerSec: "131", progressPct: 80 },
  { indexedPages: "1.41M", top3Rank: "13,990", healthScore: "98.4%", deltaPct: "+30.1%", requestsPerSec: "112", progressPct: 84 },
  { indexedPages: "1.63M", top3Rank: "15,340", healthScore: "96.5%", deltaPct: "+20.9%", requestsPerSec: "146", progressPct: 73 },
];

export function randomLoginFakeStats(): LoginFakeStats {
  return PRESETS[Math.floor(Math.random() * PRESETS.length)];
}
