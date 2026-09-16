"use client";

import { useState, useCallback, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Search, Zap, RotateCw, Plus, Loader2, Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { TerminalOutput, type RunStatus } from "@/components/terminal-output";

type UrlRow = {
  id: string;
  url: string;
  discoveredAt: string | null;
  gscStatus: string;
  gscSubmittedAt: string | null;
  gscError: string | null;
  bingStatus: string;
  bingSubmittedAt: string | null;
  bingError: string | null;
};

type Sitemap = {
  url: string;
  discoveredAt: string | null;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type WebsiteInfo = {
  id: string;
  name: string;
  url: string;
  sitemapCount: number;
  sitemaps: Sitemap[];
};

type StatusCounts = {
  gscSubmitted: number; gscPending: number; gscFailed: number;
  bingSubmitted: number; bingPending: number; bingFailed: number;
};

type Props = {
  websiteId: string;
  initialWebsite: WebsiteInfo;
  initialUrls: UrlRow[];
  initialPagination: Pagination;
  statusCounts: StatusCounts;
};

function statusOptions(counts: { pending: number; submitted: number; failed: number }) {
  return [
    { value: "all",       label: "All" },
    { value: "pending",   label: `Pending (${counts.pending.toLocaleString()})` },
    { value: "submitted", label: `Submitted (${counts.submitted.toLocaleString()})` },
    { value: "failed",    label: `Failed (${counts.failed.toLocaleString()})` },
  ];
}

function httpCodeFrom(error: string | null): string | null {
  const match = error?.match(/\bHTTP\s?(\d{3})\b/i);
  return match ? match[1] : null;
}

function statusBadge(status: string, error: string | null) {
  if (status === "submitted") return <span className="inline-block rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 text-xs font-medium">Submitted</span>;
  if (status === "failed") {
    const httpCode = httpCodeFrom(error);
    return (
      <span className="inline-block rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-400 px-2 py-0.5 text-xs font-medium">
        Failed{httpCode ? ` (HTTP ${httpCode})` : ""}
      </span>
    );
  }
  return <span className="inline-block rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-0.5 text-xs font-medium">Pending</span>;
}

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// Small window of page numbers around the current page, with ellipses —
// pure display logic, no data fetching.
function pageNumbers(current: number, total: number): (number | "…")[] {
  const pages: (number | "…")[] = [];
  const radius = 1;
  for (let p = 1; p <= total; p++) {
    if (p === 1 || p === total || (p >= current - radius && p <= current + radius)) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== "…") {
      pages.push("…");
    }
  }
  return pages;
}

export function QueueClient({ websiteId, initialWebsite, initialUrls, initialPagination, statusCounts }: Props) {
  const router = useRouter();
  const [urls, setUrls]               = useState<UrlRow[]>(initialUrls);
  const [pagination, setPagination]   = useState<Pagination>(initialPagination);
  const [gscFilter, setGscFilter]     = useState("all");
  const [bingFilter, setBingFilter]   = useState("all");
  const [search, setSearch]           = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sitemapsOpen, setSitemapsOpen] = useState(false);
  const [isPending, startTransition]  = useTransition();
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy]       = useState(false);
  const [inspectRow, setInspectRow]   = useState<UrlRow | null>(null);
  const [refreshingStatus, setRefreshingStatus] = useState(false);

  // Dispatch / resubmit ("no invented functionality" gap — Part B)
  const [engine, setEngine]           = useState<"gsc" | "bing">("gsc");
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [dispatchLines, setDispatchLines] = useState<string[]>([]);
  const [dispatchStatus, setDispatchStatus] = useState<RunStatus>("idle");
  const [dispatchBusy, setDispatchBusy] = useState(false);
  const dispatchAbort = useRef<AbortController | null>(null);

  const [addUrlOpen, setAddUrlOpen]   = useState(false);
  const [newUrl, setNewUrl]           = useState("");
  const [addUrlError, setAddUrlError] = useState("");
  const [addUrlBusy, setAddUrlBusy]   = useState(false);

  const fetchUrls = useCallback(
    (page: number, gsc: string, bing: string, q: string) => {
      startTransition(async () => {
        const params = new URLSearchParams({
          page: String(page),
          gscStatus: gsc,
          bingStatus: bing,
          search: q,
        });
        const res = await fetch(`/api/indexing-queue/${websiteId}?${params}`);
        if (!res.ok) return;
        const data = await res.json();
        setUrls(data.urls);
        setPagination(data.pagination);
      });
    },
    [websiteId]
  );

  // Re-fetch when filters change (reset to page 1)
  useEffect(() => {
    fetchUrls(1, gscFilter, bingFilter, search);
  }, [gscFilter, bingFilter, search, fetchUrls]);

  function handleSearch() {
    setSearch(searchInput);
  }

  async function streamDispatch(url: string, body: Record<string, unknown>) {
    setDispatchOpen(true);
    setDispatchLines([]);
    setDispatchStatus("running");
    setDispatchBusy(true);

    const controller = new AbortController();
    dispatchAbort.current = controller;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setDispatchLines((prev) => [...prev, `[ERROR] ${data.error ?? "Failed to start the run."}`]);
        setDispatchStatus("error");
        setDispatchBusy(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalExitCode = -1;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const match = part.match(/^data: (.*)$/m);
          if (!match) continue;
          const evt = JSON.parse(match[1]);
          if (evt.type === "output") {
            setDispatchLines((prev) => [...prev, evt.line]);
          } else if (evt.type === "done") {
            finalExitCode = evt.exitCode;
          }
        }
      }

      setDispatchStatus(finalExitCode === 0 ? "success" : "error");
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setDispatchLines((prev) => [...prev, `[ERROR] ${(err as Error).message}`]);
        setDispatchStatus("error");
      }
    } finally {
      setDispatchBusy(false);
      // Give the fire-and-forget status-parsing on the server a moment to land,
      // then refresh this page's URL list so statuses reflect the run.
      setTimeout(() => fetchUrls(pagination.page, gscFilter, bingFilter, search), 800);
    }
  }

  function dispatchPending() {
    streamDispatch(`/api/indexing-queue/${websiteId}/dispatch`, { engine });
  }

  function forceReindex() {
    if (!confirm(`Force re-index ALL URLs for this website via ${engine === "gsc" ? "GSC" : "Bing"}? This re-submits URLs that were already submitted, not just pending ones.`)) return;
    streamDispatch(`/api/indexing-queue/${websiteId}/dispatch`, { engine, forceAll: true });
  }

  function resubmitOne(urlId: string, urlEngine: "gsc" | "bing") {
    streamDispatch(`/api/indexing-queue/${websiteId}/urls/${urlId}/resubmit`, { engine: urlEngine });
  }

  function toggleSelected(urlId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(urlId)) next.delete(urlId); else next.add(urlId);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === urls.length ? new Set() : new Set(urls.map((u) => u.id))));
  }

  // Bulk re-submit — reuses the existing per-row resubmit endpoint for each
  // selected row against the currently chosen engine, sequentially.
  async function bulkResubmitSelected() {
    if (selected.size === 0) return;
    setBulkBusy(true);
    for (const urlId of Array.from(selected)) {
      await fetch(`/api/indexing-queue/${websiteId}/urls/${urlId}/resubmit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engine }),
      }).catch(() => {});
    }
    setBulkBusy(false);
    setSelected(new Set());
    fetchUrls(pagination.page, gscFilter, bingFilter, search);
  }

  function handleRefreshStatus() {
    setRefreshingStatus(true);
    router.refresh();
    fetchUrls(pagination.page, gscFilter, bingFilter, search);
    setTimeout(() => setRefreshingStatus(false), 600);
  }

  // Client-side only — serializes the currently loaded/filtered page of URLs.
  // No backend touched.
  function exportCsv() {
    function cell(value: string): string {
      return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
    }
    const header = ["URL", "Discovered", "GSC Status", "GSC Submitted", "GSC Error", "Bing Status", "Bing Submitted", "Bing Error"];
    const rows = urls.map((u) => [
      u.url, fmt(u.discoveredAt), u.gscStatus, fmt(u.gscSubmittedAt), u.gscError ?? "",
      u.bingStatus, fmt(u.bingSubmittedAt), u.bingError ?? "",
    ]);
    const csv = [header, ...rows].map((row) => row.map(cell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${initialWebsite.name.replace(/\s+/g, "-").toLowerCase()}-indexing-queue-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function submitNewUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!newUrl.trim()) { setAddUrlError("Enter a URL."); return; }
    setAddUrlError(""); setAddUrlBusy(true);

    const res = await fetch(`/api/indexing-queue/${websiteId}/urls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: newUrl.trim() }),
    });

    setAddUrlBusy(false);
    if (!res.ok) { setAddUrlError((await res.json()).error ?? "Failed to add URL."); return; }

    setNewUrl("");
    setAddUrlOpen(false);
    fetchUrls(1, gscFilter, bingFilter, search);
  }

  return (
    <div className="space-y-6">
      {/* Sync actions */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-3">
        <span className="text-xs font-medium text-muted-foreground">Engine:</span>
        <div className="flex rounded-lg border border-input overflow-hidden">
          <button
            onClick={() => setEngine("gsc")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${engine === "gsc" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
          >
            GSC
          </button>
          <button
            onClick={() => setEngine("bing")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${engine === "bing" ? "bg-orange-500 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
          >
            Bing
          </button>
        </div>
        <Button size="sm" variant="outline" onClick={dispatchPending} disabled={dispatchBusy}>
          <Zap className="h-3.5 w-3.5" /> Dispatch Pending Batch
        </Button>
        <Button size="sm" variant="outline" onClick={forceReindex} disabled={dispatchBusy}>
          <RotateCw className="h-3.5 w-3.5" /> Force Re-index All
        </Button>
        <Button size="sm" variant="outline" onClick={handleRefreshStatus} disabled={refreshingStatus}>
          <RotateCw className={`h-3.5 w-3.5 ${refreshingStatus ? "animate-spin" : ""}`} /> Refresh Status
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setAddUrlOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add Single URL
          </Button>
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      {dispatchOpen && (
        <TerminalOutput lines={dispatchLines} status={dispatchStatus} />
      )}

      {/* Sitemaps collapsible */}
      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <button
          onClick={() => setSitemapsOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted transition-colors text-sm font-medium text-foreground"
        >
          <span>Sitemaps Discovered ({initialWebsite.sitemapCount})</span>
          {sitemapsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {sitemapsOpen && (
          <div className="p-4">
            {initialWebsite.sitemaps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sitemaps saved yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-h-72 overflow-y-auto">
                {initialWebsite.sitemaps.map((s, i) => (
                  <a
                    key={i}
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-border px-3 py-2.5 hover:bg-muted/40 transition-colors"
                  >
                    <p className="text-xs text-primary truncate">{s.url}</p>
                    <p className="text-xs text-muted-foreground mt-1">Discovered {fmt(s.discoveredAt)}</p>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="flex items-center gap-1 border border-input rounded-lg px-2 py-1.5 bg-background text-sm">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search URL..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="outline-none w-56 text-sm bg-transparent text-foreground placeholder:text-muted-foreground"
          />
          <button onClick={handleSearch} className="text-xs text-primary hover:text-primary/80 ml-1">Go</button>
        </div>

        {/* GSC filter */}
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground text-xs font-medium">GSC:</span>
          {statusOptions({ pending: statusCounts.gscPending, submitted: statusCounts.gscSubmitted, failed: statusCounts.gscFailed }).map((o) => (
            <button
              key={o.value}
              onClick={() => setGscFilter(o.value)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                gscFilter === o.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* Bing filter */}
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground text-xs font-medium">Bing:</span>
          {statusOptions({ pending: statusCounts.bingPending, submitted: statusCounts.bingSubmitted, failed: statusCounts.bingFailed }).map((o) => (
            <button
              key={o.value}
              onClick={() => setBingFilter(o.value)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                bingFilter === o.value
                  ? "bg-orange-500 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <span className="ml-auto text-xs text-muted-foreground">
          {pagination.total.toLocaleString()} URL(s)
        </span>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5">
          <span className="text-xs font-medium text-foreground">{selected.size} selected</span>
          <div className="flex items-center gap-2 sm:ml-auto">
            <Button size="sm" variant="outline" onClick={bulkResubmitSelected} disabled={bulkBusy}>
              {bulkBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
              Bulk Re-submit Selected ({engine === "gsc" ? "GSC" : "Bing"})
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        </div>
      )}

      {/* URL table */}
      <div className={`rounded-xl border border-border overflow-x-auto bg-card transition-opacity ${isPending ? "opacity-50" : ""}`}>
        {urls.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">No URLs match the current filters.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={selected.size === urls.length}
                    onChange={toggleSelectAll}
                    className="h-3.5 w-3.5 rounded border-input"
                    aria-label="Select all URLs on this page"
                  />
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">URL</th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground whitespace-nowrap">Discovered</th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground">GSC</th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground whitespace-nowrap">GSC Date</th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground">Bing</th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground whitespace-nowrap">Bing Date</th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {urls.map((row) => (
                <tr key={row.id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggleSelected(row.id)}
                      className="h-3.5 w-3.5 rounded border-input"
                      aria-label={`Select ${row.url}`}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline truncate block max-w-lg text-xs"
                    >
                      {row.url}
                    </a>
                    {row.gscError && (
                      <p className="text-xs text-rose-600 dark:text-rose-400 mt-0.5 truncate max-w-lg">GSC: {row.gscError}</p>
                    )}
                    {row.bingError && (
                      <p className="text-xs text-rose-600 dark:text-rose-400 mt-0.5 truncate max-w-lg">Bing: {row.bingError}</p>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center text-xs text-muted-foreground whitespace-nowrap">{fmt(row.discoveredAt)}</td>
                  <td className="px-3 py-2.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {statusBadge(row.gscStatus, row.gscError)}
                      {row.gscStatus === "failed" && (
                        <button
                          onClick={() => resubmitOne(row.id, "gsc")}
                          disabled={dispatchBusy}
                          title="Re-submit to GSC"
                          className="text-muted-foreground hover:text-primary disabled:opacity-40"
                        >
                          <RotateCw className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center text-xs text-muted-foreground whitespace-nowrap">{fmt(row.gscSubmittedAt)}</td>
                  <td className="px-3 py-2.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {statusBadge(row.bingStatus, row.bingError)}
                      {row.bingStatus === "failed" && (
                        <button
                          onClick={() => resubmitOne(row.id, "bing")}
                          disabled={dispatchBusy}
                          title="Re-submit to Bing"
                          className="text-muted-foreground hover:text-primary disabled:opacity-40"
                        >
                          <RotateCw className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center text-xs text-muted-foreground whitespace-nowrap">{fmt(row.bingSubmittedAt)}</td>
                  <td className="px-3 py-2.5 text-center">
                    <button
                      onClick={() => setInspectRow(row)}
                      title="Inspect"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                    >
                      <Eye className="h-3.5 w-3.5" /> Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground text-xs">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total.toLocaleString()} total)
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={pagination.page <= 1}
              onClick={() => fetchUrls(pagination.page - 1, gscFilter, bingFilter, search)}
              className="p-1.5 rounded-lg border border-input disabled:opacity-40 hover:bg-muted transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {pageNumbers(pagination.page, pagination.totalPages).map((p, i) =>
              p === "…" ? (
                <span key={`ellipsis-${i}`} className="px-1.5 text-xs text-muted-foreground">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => fetchUrls(p, gscFilter, bingFilter, search)}
                  className={`min-w-[2rem] px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    p === pagination.page
                      ? "bg-primary text-primary-foreground"
                      : "border border-input hover:bg-muted"
                  }`}
                >
                  {p}
                </button>
              )
            )}
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => fetchUrls(pagination.page + 1, gscFilter, bingFilter, search)}
              className="p-1.5 rounded-lg border border-input disabled:opacity-40 hover:bg-muted transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Inspect dialog */}
      <Dialog open={!!inspectRow} onOpenChange={(o) => !o && setInspectRow(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Inspect URL</DialogTitle>
            <DialogDescription className="break-all">{inspectRow?.url}</DialogDescription>
          </DialogHeader>
          {inspectRow && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Discovered</span>
                <span className="text-foreground">{fmt(inspectRow.discoveredAt)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">GSC Status</span>
                {statusBadge(inspectRow.gscStatus, inspectRow.gscError)}
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">GSC Submitted</span>
                <span className="text-foreground">{fmt(inspectRow.gscSubmittedAt)}</span>
              </div>
              {inspectRow.gscError && (
                <p className="text-xs text-rose-600 dark:text-rose-400">GSC error: {inspectRow.gscError}</p>
              )}
              <div className="flex justify-between gap-4 pt-2 border-t border-border">
                <span className="text-muted-foreground">Bing Status</span>
                {statusBadge(inspectRow.bingStatus, inspectRow.bingError)}
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Bing Submitted</span>
                <span className="text-foreground">{fmt(inspectRow.bingSubmittedAt)}</span>
              </div>
              {inspectRow.bingError && (
                <p className="text-xs text-rose-600 dark:text-rose-400">Bing error: {inspectRow.bingError}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Single URL dialog */}
      <Dialog open={addUrlOpen} onOpenChange={(o) => { setAddUrlOpen(o); if (!o) { setNewUrl(""); setAddUrlError(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add a single URL</DialogTitle>
            <DialogDescription>Queues one URL for this website — dispatch or resubmit it afterward to actually submit it.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitNewUrl} className="space-y-3">
            <div className="space-y-1.5">
              <Label>URL</Label>
              <Input
                type="url"
                placeholder="https://example.com/new-page"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                autoFocus
              />
            </div>
            {addUrlError && <p className="text-sm text-destructive">{addUrlError}</p>}
            <div className="flex gap-2 justify-end pt-1">
              <Button type="button" variant="outline" onClick={() => setAddUrlOpen(false)} disabled={addUrlBusy}>Cancel</Button>
              <Button type="submit" disabled={addUrlBusy}>
                {addUrlBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                Add URL
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
