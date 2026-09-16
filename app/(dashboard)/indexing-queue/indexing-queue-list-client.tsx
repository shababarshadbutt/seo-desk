"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Download } from "lucide-react";
import { cn } from "@/lib/utils";

export interface QueueRow {
  id: string;
  name: string;
  url: string;
  sitemapCount: number;
  total: number;
  gscPending: number;
  gscSubmitted: number;
  gscFailed: number;
  bingPending: number;
  bingSubmitted: number;
  bingFailed: number;
}

interface Props {
  rows: QueueRow[];
}

type FilterTab = "all" | "pending" | "failures";

export function IndexingQueueListClient({ rows }: Props) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");

  const hasPendingCount = rows.filter((r) => r.gscPending > 0 || r.bingPending > 0).length;
  const hasFailuresCount = rows.filter((r) => r.gscFailed > 0 || r.bingFailed > 0).length;

  const filtered = rows.filter((r) => {
    const q = query.trim().toLowerCase();
    const matchesQuery = !q || r.name.toLowerCase().includes(q) || r.url.toLowerCase().includes(q);
    const matchesTab =
      tab === "all" ||
      (tab === "pending" && (r.gscPending > 0 || r.bingPending > 0)) ||
      (tab === "failures" && (r.gscFailed > 0 || r.bingFailed > 0));
    return matchesQuery && matchesTab;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by website name or URL…"
            className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex gap-1.5">
          {([
            ["all", `All (${rows.length})`],
            ["pending", `Has Pending (${hasPendingCount})`],
            ["failures", `Has Failures (${hasFailuresCount})`],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors border whitespace-nowrap",
                tab === value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <a
          href="/api/indexing-queue/export"
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          Export Queue CSV
        </a>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {rows.length === 0 ? "No automation-enabled websites found." : "No websites match your search or filter."}
        </p>
      ) : (
        <div className="rounded-xl border border-border overflow-x-auto bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Website</th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground">Sitemaps</th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground">Total URLs</th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground bg-emerald-500/10">GSC ✓</th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground bg-amber-500/10">GSC ⏳</th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground bg-rose-500/10">GSC ✗</th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground bg-emerald-500/10">Bing ✓</th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground bg-amber-500/10">Bing ⏳</th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground bg-rose-500/10">Bing ✗</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((row) => (
                <tr key={row.id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{row.name}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-xs">{row.url}</div>
                  </td>
                  <td className="px-3 py-3 text-center text-foreground/80">{row.sitemapCount}</td>
                  <td className="px-3 py-3 text-center font-medium text-foreground">{row.total.toLocaleString()}</td>
                  <td className="px-3 py-3 text-center text-emerald-700 dark:text-emerald-400 bg-emerald-500/5">{row.gscSubmitted.toLocaleString()}</td>
                  <td className="px-3 py-3 text-center text-amber-700 dark:text-amber-400 bg-amber-500/5">{row.gscPending.toLocaleString()}</td>
                  <td className="px-3 py-3 text-center text-rose-700 dark:text-rose-400 bg-rose-500/5">{row.gscFailed.toLocaleString()}</td>
                  <td className="px-3 py-3 text-center text-emerald-700 dark:text-emerald-400 bg-emerald-500/5">{row.bingSubmitted.toLocaleString()}</td>
                  <td className="px-3 py-3 text-center text-amber-700 dark:text-amber-400 bg-amber-500/5">{row.bingPending.toLocaleString()}</td>
                  <td className="px-3 py-3 text-center text-rose-700 dark:text-rose-400 bg-rose-500/5">{row.bingFailed.toLocaleString()}</td>
                  <td className="px-3 py-3 text-right">
                    <Link
                      href={`/indexing-queue/${row.id}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
