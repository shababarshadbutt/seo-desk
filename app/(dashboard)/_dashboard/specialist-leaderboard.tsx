"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LeaderboardRow } from "@/lib/dashboard-stats";

function roleLabel(role: string): string {
  if (role === "super-admin") return "Admin";
  if (role === "sub-lead") return "Supervisor";
  return "User";
}

function formatRelative(iso: string | null): string {
  if (!iso) return "No recent activity";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "Active now";
  if (mins < 60) return `Active ${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `Active ${hours}h ago`;
  return `Active ${Math.round(hours / 24)}d ago`;
}

export function SpecialistLeaderboard({ rows, totalUsers }: { rows: LeaderboardRow[]; totalUsers: number }) {
  const router = useRouter();
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const availableRoles = useMemo(() => Array.from(new Set(rows.map((r) => r.role))), [rows]);
  const filteredRows = roleFilter === "all" ? rows : rows.filter((r) => r.role === roleFilter);

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            Specialist Performance &amp; Workload Leaderboard
            <Badge variant="secondary">{totalUsers} Specialists</Badge>
          </CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Live tracking of team member contributions — verified links, daily reporting &amp; script operations
          </p>
        </div>
        <button
          onClick={() => router.push("/users")}
          className="shrink-0 text-xs font-medium text-primary hover:underline"
        >
          View All {totalUsers} →
        </button>
      </CardHeader>

      <div className="flex items-center gap-1.5 border-b border-border px-4 py-2 overflow-x-auto">
        <Button size="sm" variant={roleFilter === "all" ? "default" : "outline"} onClick={() => setRoleFilter("all")}>
          All Specialists
        </Button>
        {availableRoles.map((role) => (
          <Button key={role} size="sm" variant={roleFilter === role ? "default" : "outline"} onClick={() => setRoleFilter(role)}>
            {roleLabel(role)}
          </Button>
        ))}
      </div>

      <CardContent className="p-0">
        {filteredRows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">No specialists match this filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Team Member</th>
                  <th className="px-4 py-2.5 font-medium">Role</th>
                  <th className="px-4 py-2.5 font-medium text-right">Backlinks</th>
                  <th className="px-4 py-2.5 font-medium text-right">Daily Reports</th>
                  <th className="px-4 py-2.5 font-medium text-right">Executions</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRows.map((row) => (
                  <tr key={row.userId}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold uppercase">
                          {row.name[0] ?? "?"}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{row.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{row.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">{roleLabel(row.role)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">{row.backlinks.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">{row.dailyReports.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">{row.executions.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={cn("flex items-center gap-1.5 text-xs", row.isRecentlyActive ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", row.isRecentlyActive ? "bg-emerald-500" : "bg-muted-foreground/40")} />
                        {formatRelative(row.lastActiveAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => router.push("/users")}>
                        Inspect Workload
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
