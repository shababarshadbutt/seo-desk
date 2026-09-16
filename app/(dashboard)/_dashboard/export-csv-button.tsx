"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface DashboardExportData {
  generatedAt: string;
  exec: { total: number; success: number; error: number; running: number };
  backlinks: { total: number; live: number; pending: number; broken: number };
  domains: { websites: number; sitemapsSynced: number; indexedUrls: number };
  specialists: { activeSpecialists: number; totalSpecialists: number; tasksQueued: number };
  contentPipeline: { label: string; pending: number; inProgress: number; done: number; total: number }[];
  leaderboard: { name: string; role: string; backlinks: number; dailyReports: number; executions: number }[];
}

function toCsv(data: DashboardExportData): string {
  const lines: string[] = [];
  lines.push("Dashboard Export", data.generatedAt);
  lines.push("");
  lines.push("Metric,Value");
  lines.push(`Script Executions,${data.exec.total}`);
  lines.push(`Script Executions Succeeded,${data.exec.success}`);
  lines.push(`Script Executions Failed,${data.exec.error}`);
  lines.push(`Script Executions Running,${data.exec.running}`);
  lines.push(`Backlinks Total,${data.backlinks.total}`);
  lines.push(`Backlinks Live,${data.backlinks.live}`);
  lines.push(`Backlinks Pending,${data.backlinks.pending}`);
  lines.push(`Backlinks Broken,${data.backlinks.broken}`);
  lines.push(`Managed Domains,${data.domains.websites}`);
  lines.push(`Sitemaps Synced,${data.domains.sitemapsSynced}`);
  lines.push(`Indexed URLs,${data.domains.indexedUrls}`);
  lines.push(`Active Specialists,${data.specialists.activeSpecialists}`);
  lines.push(`Total Specialists,${data.specialists.totalSpecialists}`);
  lines.push(`Tasks Queued,${data.specialists.tasksQueued}`);
  lines.push("");
  lines.push("Content Pipeline,Pending,In Progress,Done,Total");
  for (const row of data.contentPipeline) {
    lines.push(`${row.label},${row.pending},${row.inProgress},${row.done},${row.total}`);
  }
  if (data.leaderboard.length > 0) {
    lines.push("");
    lines.push("Specialist,Role,Backlinks,Daily Reports,Executions");
    for (const row of data.leaderboard) {
      lines.push(`${row.name},${row.role},${row.backlinks},${row.dailyReports},${row.executions}`);
    }
  }
  return lines.join("\n");
}

export function ExportCsvButton({ data }: { data: DashboardExportData }) {
  function handleExport() {
    const csv = toCsv(data);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dashboard-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport}>
      <Download className="h-4 w-4" />
      <span className="hidden sm:inline">Export CSV</span>
    </Button>
  );
}
