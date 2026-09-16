import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { SegmentedBar } from "@/components/ui/segmented-bar";
import type { ContentStat } from "@/lib/dashboard-stats";

export function ContentPipelinePanel({ stats }: { stats: ContentStat[] }) {
  const totalItems = stats.reduce((sum, s) => sum + s.total, 0);

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-2">
        <div>
          <CardTitle>Content Operations Pipeline</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">Task lifecycle across landing pages and article publications</p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{totalItems.toLocaleString()} Total Items</span>
      </CardHeader>
      <CardContent className="space-y-4">
        {stats.map((s) => (
          <div key={s.type} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">{s.label}</p>
              <span className="text-sm font-semibold text-foreground">{s.total}</span>
            </div>
            <SegmentedBar
              segments={[
                { value: s.pending, color: "amber", label: "Pending" },
                { value: s.inProgress, color: "primary", label: "In Progress" },
                { value: s.done, color: "emerald", label: "Done" },
              ]}
            />
            <div className="flex gap-4 text-xs">
              <span className="text-amber-600 dark:text-amber-400 font-medium">{s.pending} Pending</span>
              <span className="text-primary font-medium">{s.inProgress} In Progress</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                {s.done} Done{s.total > 0 ? ` (${Math.round((s.done / s.total) * 100)}%)` : ""}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
