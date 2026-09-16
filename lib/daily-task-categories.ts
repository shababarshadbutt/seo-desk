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
