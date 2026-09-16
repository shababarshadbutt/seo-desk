"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Download, RotateCw, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { avatarColor, initials } from "@/lib/indexing-queue-fake-stats";

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
type EngineFilter = "all" | "gsc-failed" | "bing-failed" | "gsc-pending" | "bing-pending";

const ENGINE_FILTER_OPTIONS: { value: EngineFilter; label: string }[] = [
  { value: "all", label: "All Engine Statuses" },
  { value: "gsc-failed", label: "Has GSC Failed" },
  { value: "bing-failed", label: "Has Bing Failed" },
  { value: "gsc-pending", label: "Has GSC Pending" },
  { value: "bing-pending", label: "Has Bing Pending" },
];

const PAGE_SIZE = 10;

// Tailwind needs full class strings statically present in source to generate
// them — can't interpolate `bg-${color}-500/10` at runtime.
const AVATAR_COLOR_CLASSES: Record<string, string> = {
  rose:    "bg-rose-500/10 text-rose-700 dark:text-rose-400",
  sky:     "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  amber:   "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  emerald: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  violet:  "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  cyan:    "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
  orange:  "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  indigo:  "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
};

export function IndexingQueueListClient({ rows }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");
  const [engineFilter, setEngineFilter] = useState<EngineFilter>("all");
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);

  const hasPendingCount = rows.filter((r) => r.gscPending > 0 || r.bingPending > 0).length;
  const hasFailuresCount = rows.filter((r) => r.gscFailed > 0 || r.bingFailed > 0).length;

  const filtered = rows.filter((r) => {
    const q = query.trim().toLowerCase();
    const matchesQuery = !q || r.name.toLowerCase().includes(q) || r.url.toLowerCase().includes(q);
    const matchesTab =
      tab === "all" ||
      (tab === "pending" && (r.gscPending > 0 || r.bingPending > 0)) ||
      (tab === "failures" && (r.gscFailed > 0 || r.bingFailed > 0));
    const matchesEngine =
      engineFilter === "all" ||
      (engineFilter === "gsc-failed" && r.gscFailed > 0) ||
      (engineFilter === "bing-failed" && r.bingFailed > 0) ||
      (engineFilter === "gsc-pending" && r.gscPending > 0) ||
      (engineFilter === "bing-pending" && r.bingPending > 0);
    return matchesQuery && matchesTab && matchesEngine;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage]
  );

  function updateFilter<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }
  const setQueryAndResetPage = updateFilter(setQuery);
  const setTabAndResetPage = updateFilter(setTab);
  const setEngineFilterAndResetPage = updateFilter(setEngineFilter);

  function handleRefresh() {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 600);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5">
          {([
            ["all", `All Automated (${rows.length})`],
            ["pending", `Has Pending (${hasPendingCount})`],
            ["failures", `Has Failures (${hasFailuresCount})`],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTabAndResetPage(value)}
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
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-60"
        >
          <RotateCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQueryAndResetPage(e.target.value)}
            placeholder="Filter website by name or URL…"
            className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <select
          value={engineFilter}
          onChange={(e) => setEngineFilterAndResetPage(e.target.value as EngineFilter)}
          className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {ENGINE_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          Showing {paginated.length} of {filtered.length} website{filtered.length === 1 ? "" : "s"}
        </span>
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
              {paginated.map((row) => (
                <tr key={row.id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold",
                          AVATAR_COLOR_CLASSES[avatarColor(row.name)]
                        )}
                      >
                        {initials(row.name)}
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium text-foreground">{row.name}</div>
                        {row.url ? (
                          <a
                            href={row.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary truncate max-w-xs"
                          >
                            {row.url}
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                        ) : (
                          <div className="text-xs text-muted-foreground">—</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs text-foreground/80">
                      {row.sitemapCount} XML{row.sitemapCount === 1 ? "" : "s"}
                    </span>
                  </td>
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

      {filtered.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground text-xs">
            Page {currentPage} of {totalPages} ({filtered.length.toLocaleString()} total)
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
              className="p-1.5 rounded-lg border border-input disabled:opacity-40 hover:bg-muted transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setPage(currentPage + 1)}
              className="p-1.5 rounded-lg border border-input disabled:opacity-40 hover:bg-muted transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
