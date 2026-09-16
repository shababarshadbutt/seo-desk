"use client";

import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Bell, Globe, Play, Loader2, Radar, Plus, Database, History } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { AuditHistoryDialog } from "@/components/audit-history-dialog";
import { randomCrawlerStatus } from "@/lib/crawler-status-fake-stats";
import { cn } from "@/lib/utils";

const pageTitles: Record<string, string> = {
  "/": "Overview",
  "/scripts": "Scripts",
  "/lastmod-updater": "Lastmod Updater",
  "/sitemap-cleaner": "Sitemap Cleaner",
  "/backlinks": "Backlinks",
  "/backlink-sites": "Backlink Sites",
  "/websites": "Websites",
  "/weekly-reports": "Weekly Reports",
  "/daily-reports": "Daily Reports",
  "/audit": "Website Audit",
  "/logs": "Execution Logs",
  "/indexing-queue": "Indexing Queue",
  "/users": "User Management",
  "/settings": "Settings",
};

function getTitle(pathname: string): string {
  // Exact match first
  if (pageTitles[pathname]) return pageTitles[pathname];
  // Prefix match (e.g. /scripts/url-indexer → "Scripts")
  const match = Object.keys(pageTitles).find(
    (key) => key !== "/" && pathname.startsWith(key)
  );
  return match ? pageTitles[match] : "ASAP Dashboard";
}

const SITEMAP_TOOL_LABELS: Record<string, string> = {
  "/lastmod-updater": "Lastmod Updater",
  "/sitemap-cleaner": "Sitemap Cleaner",
};

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const isBacklinks = pathname === "/backlinks";
  const sitemapToolLabel = SITEMAP_TOOL_LABELS[pathname];
  const isSuperAdmin = session?.user.role === "super-admin";
  const [auditOpen, setAuditOpen] = useState(false);

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background pl-14 pr-4 lg:px-6 gap-3">
      <h1 className="text-base font-semibold text-foreground shrink-0">
        {getTitle(pathname)}
      </h1>
      {isBacklinks && <CrawlerStatusPill />}
      {sitemapToolLabel && <S3PipelinePill />}
      <div className="flex-1 flex justify-end lg:justify-center max-w-md ml-auto">
        <GlobalSearch />
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <NotificationBell />
        <ThemeToggle />
        {isBacklinks && !isSuperAdmin && (
          <Button size="sm" onClick={() => router.push("/backlinks?add=1")}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Backlink</span>
          </Button>
        )}
        {sitemapToolLabel && (
          <Button variant="outline" size="sm" onClick={() => setAuditOpen(true)}>
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Audit History</span>
          </Button>
        )}
      </div>
      {sitemapToolLabel && (
        <AuditHistoryDialog open={auditOpen} onOpenChange={setAuditOpen} toolLabel={sitemapToolLabel} />
      )}
    </header>
  );
}

// ─── S3 pipeline status pill (Lastmod Updater / Sitemap Cleaner only) ──────────
// The bucket name is real (fetched from the existing, unmodified, super-admin-
// only GET /api/settings/storage) when the viewer can see it; "Sync Active" is
// presentational — no real sync/pipeline monitoring exists in this app.

function S3PipelinePill() {
  const { data: session } = useSession();
  const [bucket, setBucket] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user.role !== "super-admin") return;
    fetch("/api/settings/storage")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setBucket(data?.s3?.bucket || null))
      .catch(() => {});
  }, [session?.user.role]);

  return (
    <div
      className="hidden md:flex items-center gap-1.5 rounded-lg border border-border bg-sky-500/10 px-2.5 py-1 text-xs shrink-0"
      title="Sync status is presentational — no real pipeline/sync monitoring exists yet"
    >
      <Database className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
      <span className="font-medium text-sky-700 dark:text-sky-400">
        S3 Pipeline{bucket ? `: ${bucket}` : ""}
      </span>
      <span className="text-muted-foreground">Sync Active</span>
    </div>
  );
}

// ─── Crawler status pill (Backlinks only) ──────────────────────────────────────
// Presentational only — no crawler/bot monitoring system exists in this app.
// Rotates through a small preset pool on each load. See lib/crawler-status-fake-stats.ts.

function CrawlerStatusPill() {
  const [status, setStatus] = useState<{ label: string; sublabel: string } | null>(null);

  useEffect(() => {
    setStatus(randomCrawlerStatus());
  }, []);

  if (!status) return null;

  return (
    <div
      className="hidden md:flex items-center gap-1.5 rounded-lg border border-border bg-emerald-500/10 px-2.5 py-1 text-xs shrink-0"
      title="Presentational status indicator — not yet backed by a real monitoring integration"
    >
      <Radar className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
      <span className="font-medium text-emerald-700 dark:text-emerald-400">{status.label}</span>
      <span className="text-muted-foreground">{status.sublabel}</span>
    </div>
  );
}

// ─── Global search ────────────────────────────────────────────────────────────

interface SearchResults {
  websites: { id: string; name: string; url: string }[];
  scripts: { slug: string; name: string; description: string }[];
}

function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
      setLoading(false);
      if (res.ok) setResults(await res.json());
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const hasResults = results && (results.websites.length > 0 || results.scripts.length > 0);

  function go(href: string) {
    router.push(href);
    setOpen(false);
    setQuery("");
    setResults(null);
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search websites, scripts…"
          className="h-8 w-full rounded-lg border border-input bg-muted/40 pl-8 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:bg-background transition-colors"
        />
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute right-0 top-full mt-1 w-80 max-h-96 overflow-y-auto rounded-xl border border-border bg-card shadow-lg z-50">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
            </div>
          ) : !hasResults ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No matches for &ldquo;{query}&rdquo;.</p>
          ) : (
            <div className="py-1">
              {results!.websites.length > 0 && (
                <div className="px-1">
                  <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">Websites</p>
                  {results!.websites.map((w) => (
                    <button
                      key={w.id}
                      onClick={() => go("/websites")}
                      className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted/60 transition-colors"
                    >
                      <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{w.name}</span>
                    </button>
                  ))}
                </div>
              )}
              {results!.scripts.length > 0 && (
                <div className="px-1 border-t border-border mt-1 pt-1">
                  <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">Scripts</p>
                  {results!.scripts.map((s) => (
                    <button
                      key={s.slug}
                      onClick={() => go(`/scripts/${s.slug}`)}
                      className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted/60 transition-colors"
                    >
                      <Play className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{s.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Notification bell ────────────────────────────────────────────────────────

interface NotificationItem {
  id: string;
  kind: "script-error" | "indexing-error";
  message: string;
  at: string;
}

const LAST_SEEN_KEY = "seo-teamdesk:notifications-last-seen";

function NotificationBell() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/notifications");
    if (!res.ok) return;
    const data = await res.json();
    const list: NotificationItem[] = data.notifications ?? [];
    setItems(list);

    let lastSeen = "";
    try {
      lastSeen = localStorage.getItem(LAST_SEEN_KEY) ?? "";
    } catch {
      // localStorage unavailable (private mode, etc.) — treat everything as unread
    }
    setUnread(list.filter((n) => n.at > lastSeen).length);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function toggleOpen() {
    setOpen((v) => {
      const next = !v;
      if (next && items.length > 0) {
        try {
          localStorage.setItem(LAST_SEEN_KEY, items[0].at);
        } catch {
          // ignore — non-critical, worst case badge re-appears next load
        }
        setUnread(0);
      }
      return next;
    });
  }

  function formatRelative(iso: string) {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.round(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.round(hours / 24)}d ago`;
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        aria-label="Notifications"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-sm hover:text-foreground transition-colors"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 max-h-96 overflow-y-auto rounded-xl border border-border bg-card shadow-lg z-50">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold text-foreground">Notifications</p>
            <p className="text-xs text-muted-foreground mt-0.5">Recent script &amp; indexing failures</p>
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No recent failures. All clear.</p>
          ) : (
            <div className="divide-y divide-border">
              {items.map((n) => (
                <div key={n.id} className="px-4 py-3 flex items-start gap-2.5">
                  <span className={cn(
                    "mt-1 h-1.5 w-1.5 rounded-full shrink-0",
                    n.kind === "script-error" ? "bg-rose-500" : "bg-amber-500"
                  )} />
                  <div className="min-w-0">
                    <p className="text-sm text-foreground leading-snug">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatRelative(n.at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
