// Part C addition — shared, non-protected, client-safe category list for
// Daily Reports' "Today's Tasks" feature. Kept separate from
// lib/mongodb/models/DailyTask.ts so client components can import it without
// pulling mongoose into the browser bundle.
export const DAILY_TASK_CATEGORIES = [
  "Content Marketing",
  "Backlink Outreach",
  "Technical SEO",
  "Client Communication",
  "Reporting",
  "Other",
] as const;

export type DailyTaskCategory = (typeof DAILY_TASK_CATEGORIES)[number];

// Color used for this category's tag pill wherever it's shown (Today's Tasks
// board, per-entry report tags). Real data — these are the app's own
// category labels, just given a consistent accent color each.
export const DAILY_TASK_CATEGORY_COLORS: Record<DailyTaskCategory, "sky" | "violet" | "amber" | "emerald" | "rose" | "muted"> = {
  "Content Marketing": "violet",
  "Backlink Outreach": "sky",
  "Technical SEO": "emerald",
  "Client Communication": "amber",
  Reporting: "rose",
  Other: "muted",
};
