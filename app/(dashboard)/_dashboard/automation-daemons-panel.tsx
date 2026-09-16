"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { randomAutomationDaemons, type AutomationDaemonRow } from "@/lib/automation-daemons-fake-stats";

const STATUS_VARIANT: Record<AutomationDaemonRow["status"], "success" | "warning" | "secondary"> = {
  Synced: "success",
  Connected: "success",
  Running: "warning",
  Idle: "secondary",
};

// The status word + "synced"/"idle" wording below is presentational — see
// lib/automation-daemons-fake-stats.ts for why. The Indexing Queue backlog
// count is real, passed in from a live query.
export function AutomationDaemonsPanel({ indexingBacklog }: { indexingBacklog: number }) {
  const [rows, setRows] = useState<AutomationDaemonRow[] | null>(null);

  useEffect(() => {
    setRows(randomAutomationDaemons());
  }, []);

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-2">
        <CardTitle>Automation Daemons</CardTitle>
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
      </CardHeader>
      <CardContent className="space-y-3" title="Status wording is presentational — not yet backed by real daemon health monitoring">
        {(rows ?? []).map((row) => (
          <div key={row.name} className="flex items-start justify-between gap-2 rounded-lg border border-border p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{row.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {row.name === "Indexing Queue" ? `Queue: ${indexingBacklog.toLocaleString()} items waiting` : row.detail}
              </p>
            </div>
            <Badge variant={STATUS_VARIANT[row.status]} className="shrink-0">
              {row.status}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
