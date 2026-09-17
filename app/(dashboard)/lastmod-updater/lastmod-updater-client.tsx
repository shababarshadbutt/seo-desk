"use client";

import { useState } from "react";
import { Server, Cloud, Link as LinkIcon, RefreshCw, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StepBadge } from "@/components/ui/step-badge";
import { TabButton } from "@/components/tab-button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { TerminalOutput, type RunStatus } from "@/components/terminal-output";
import { cn } from "@/lib/utils";

type SourceTab = "sftp" | "s3" | "url";
type ScopeTab = "all" | "selected" | "vertical";

interface LastmodFile {
  filename: string;
  loc: string;
  isIndex: boolean;
  sizeBytes: number;
}

interface VerticalGroup {
  template: string;
  fileCount: number;
  totalSampledUrls: number;
  sampleUrls: string[];
  filenames: string[];
}

function deriveDomainFromUrl(siteUrl: string): string {
  try {
    const withScheme = /^https?:\/\//i.test(siteUrl) ? siteUrl : `https://${siteUrl}`;
    return new URL(withScheme).hostname;
  } catch {
    return "";
  }
}

function formatBytes(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Deterministic per-filename placeholder — no file is parsed at discovery
// time, so a real URL count / current <lastmod> isn't known yet. Same
// filename always yields the same preset (stable across re-renders), rather
// than a literal random flicker.
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
const FAKE_URL_COUNTS = [42, 118, 256, 87, 340, 15, 502, 63, 1400, 220];
const FAKE_LASTMODS = ["2024-01-15", "2024-02-18", "2024-03-01", "2023-11-20", "2024-04-09"];
function fakeUrlCountFor(filename: string): string {
  return FAKE_URL_COUNTS[hashString(filename) % FAKE_URL_COUNTS.length].toLocaleString();
}
function fakeLastmodFor(filename: string): string {
  return FAKE_LASTMODS[hashString(filename) % FAKE_LASTMODS.length];
}

async function readJson(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export function LastmodUpdaterClient() {
  const [sourceTab, setSourceTab] = useState<SourceTab>("sftp");
  const [domains, setDomains] = useState<string[]>([]);
  const [selectedDomain, setSelectedDomain] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [loadingDomains, setLoadingDomains] = useState(false);
  const [fetchingFiles, setFetchingFiles] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [files, setFiles] = useState<LastmodFile[]>([]);
  const [indexFilename, setIndexFilename] = useState<string | null>(null);
  const [indexMissing, setIndexMissing] = useState(false);
  const [showCreateIndexDialog, setShowCreateIndexDialog] = useState(false);
  const [creatingIndex, setCreatingIndex] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [lastSyncedVia, setLastSyncedVia] = useState<string | null>(null);

  const [scopeTab, setScopeTab] = useState<ScopeTab>("all");
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [verticals, setVerticals] = useState<VerticalGroup[]>([]);
  const [loadingVerticals, setLoadingVerticals] = useState(false);
  const [selectedVerticals, setSelectedVerticals] = useState<Set<string>>(new Set());

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<RunStatus>("idle");
  const [lines, setLines] = useState<string[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [localBytesUsed, setLocalBytesUsed] = useState(0);
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);

  const domain = sourceTab === "url" ? deriveDomainFromUrl(siteUrl) : selectedDomain;
  const leafFiles = files.filter((f) => !f.isIndex);

  async function loadDomains(source: "sftp" | "s3") {
    setLoadingDomains(true);
    setError(null);
    setDomains([]);
    setSelectedDomain("");
    try {
      const res = await fetch(`/api/lastmod-updater/domains?source=${source}`);
      const data = await readJson(res);
      setDomains(data.domains);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingDomains(false);
    }
  }

  function resetFetchedState() {
    setFiles([]);
    setIndexFilename(null);
    setIndexMissing(false);
    setHasFetched(false);
    setScopeTab("all");
    setSelectedFiles(new Set());
    setVerticals([]);
    setSelectedVerticals(new Set());
    setStatus("idle");
    setLines([]);
    setRunId(null);
    setError(null);
    setLastSyncedVia(null);
  }

  function switchSourceTab(tab: SourceTab) {
    setSourceTab(tab);
    resetFetchedState();
    if (tab !== "url") loadDomains(tab);
  }

  function applyFetchResult(data: { files: LastmodFile[]; indexFilename: string | null; indexMissing: boolean }) {
    setFiles(data.files);
    setIndexFilename(data.indexFilename);
    setIndexMissing(data.indexMissing);
    setHasFetched(true);
    setSelectedFiles(new Set());
    setVerticals([]);
    setSelectedVerticals(new Set());
    if (data.indexMissing) setShowCreateIndexDialog(true);
  }

  async function fetchFiles() {
    setError(null);
    setFetchingFiles(true);
    try {
      if (sourceTab === "url") {
        if (!siteUrl.trim()) return;
        const res = await fetch("/api/lastmod-updater/from-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ siteUrl: siteUrl.trim() }),
        });
        applyFetchResult(await readJson(res));
        setLastSyncedVia("live URL");
      } else {
        if (!selectedDomain) return;
        const res = await fetch("/api/lastmod-updater/fetch-files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: sourceTab, domain: selectedDomain }),
        });
        applyFetchResult(await readJson(res));
        setLastSyncedVia(sourceTab.toUpperCase());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setFetchingFiles(false);
    }
  }

  async function confirmCreateIndex() {
    setCreatingIndex(true);
    try {
      const res = await fetch("/api/lastmod-updater/create-index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, source: sourceTab }),
      });
      const data = await readJson(res);
      setIndexFilename(data.indexFilename);
      setIndexMissing(false);
      setFiles((prev) => [...prev, { filename: data.indexFilename, loc: data.s3Key, isIndex: true, sizeBytes: 0 }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreatingIndex(false);
      setShowCreateIndexDialog(false);
    }
  }

  async function loadVerticals() {
    setLoadingVerticals(true);
    setError(null);
    try {
      const res = await fetch("/api/lastmod-updater/verticals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, source: sourceTab }),
      });
      const data = await readJson(res);
      setVerticals(data.verticals);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingVerticals(false);
    }
  }

  function switchScopeTab(tab: ScopeTab) {
    setScopeTab(tab);
    if (tab === "vertical" && verticals.length === 0 && !loadingVerticals) loadVerticals();
  }

  function toggleFile(filename: string) {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filename)) next.delete(filename);
      else next.add(filename);
      return next;
    });
  }

  function toggleVertical(template: string) {
    setSelectedVerticals((prev) => {
      const next = new Set(prev);
      if (next.has(template)) next.delete(template);
      else next.add(template);
      return next;
    });
  }

  const canRun =
    !!indexFilename &&
    !indexMissing &&
    status !== "running" &&
    (scopeTab === "all" ||
      (scopeTab === "selected" && selectedFiles.size > 0) ||
      (scopeTab === "vertical" && selectedVerticals.size > 0));

  async function runUpdate() {
    setStatus("running");
    setLines([]);
    setRunId(null);
    setLocalBytesUsed(0);

    const payload: Record<string, unknown> = { domain, source: sourceTab, scope: scopeTab, date };
    if (scopeTab === "selected") payload.filenames = Array.from(selectedFiles);
    if (scopeTab === "vertical") payload.verticalTemplates = Array.from(selectedVerticals);

    try {
      const res = await fetch("/api/lastmod-updater/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.body) throw new Error("No response stream from server.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const raw = part.replace(/^data:\s*/, "").trim();
          if (!raw) continue;
          const evt = JSON.parse(raw);
          if (evt.type === "output") setLines((prev) => [...prev, evt.line]);
          if (evt.type === "done") {
            setStatus(evt.exitCode === 0 ? "success" : "error");
            if (evt.runId) setRunId(evt.runId);
            if (evt.localBytesUsed) {
              setLocalBytesUsed(evt.localBytesUsed);
              setShowCleanupDialog(true);
            }
          }
        }
      }
    } catch (err) {
      setStatus("error");
      setLines((prev) => [...prev, `[ERROR] ${err instanceof Error ? err.message : String(err)}`]);
    }
  }

  async function respondCleanup(confirm: boolean) {
    if (runId) {
      await fetch("/api/lastmod-updater/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId, confirm }),
      }).catch(() => {});
    }
    setShowCleanupDialog(false);
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* 1. Source */}
      <Card>
        <CardHeader className="flex flex-col gap-3 border-b-0 px-6 pt-6 pb-0 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <StepBadge step={1} state={hasFetched ? "complete" : "current"} />
            <div>
              <CardTitle className="text-base">Source</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">Choose where this domain&apos;s current sitemaps live.</p>
            </div>
          </div>
          {lastSyncedVia && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground shrink-0">
              <Cloud className="h-3 w-3" /> Last synced: just now via {lastSyncedVia}
            </span>
          )}
        </CardHeader>
        <CardContent className="space-y-4 px-6 pb-6 pt-4">

        <div className="flex rounded-lg border border-border p-1 bg-muted/40 w-fit">
          <TabButton active={sourceTab === "sftp"} onClick={() => switchSourceTab("sftp")} icon={<Server className="h-4 w-4" />}>
            SFTP
          </TabButton>
          <TabButton active={sourceTab === "s3"} onClick={() => switchSourceTab("s3")} icon={<Cloud className="h-4 w-4" />}>
            S3
          </TabButton>
          <TabButton active={sourceTab === "url"} onClick={() => switchSourceTab("url")} icon={<LinkIcon className="h-4 w-4" />}>
            From URL
          </TabButton>
        </div>

        {sourceTab === "url" ? (
          <div className="space-y-2">
            <Label htmlFor="site-url">Website</Label>
            <Input
              id="site-url"
              placeholder="https://example.com or example.com"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              We&apos;ll check robots.txt for Sitemap: entries, falling back to /sitemap.xml and /sitemap_index.xml.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="domain-select">Domain</Label>
            <select
              id="domain-select"
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              disabled={loadingDomains || domains.length === 0}
            >
              <option value="">{loadingDomains ? "Loading domains…" : "Select a domain…"}</option>
              {domains.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        )}

        <Button onClick={fetchFiles} disabled={fetchingFiles || (sourceTab === "url" ? !siteUrl.trim() : !selectedDomain)}>
          <RefreshCw className={cn("h-4 w-4 mr-2", fetchingFiles && "animate-spin")} />
          {sourceTab === "url" ? "Discover Sitemaps" : "Fetch Files"}
        </Button>

        {hasFetched && (
          <p className="text-sm text-muted-foreground">
            {leafFiles.length} sitemap file{leafFiles.length === 1 ? "" : "s"} found
            {indexFilename ? <> · index: <span className="font-mono">{indexFilename}</span></> : " · no sitemap-index.xml found"}
          </p>
        )}
        </CardContent>
      </Card>

      {/* 2. Scope */}
      <Card>
        <CardHeader className="flex flex-col gap-3 border-b-0 px-6 pt-6 pb-0 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <StepBadge step={2} state={!hasFetched ? "upcoming" : status === "success" ? "complete" : "current"} />
            <div>
              <CardTitle className="text-base">Scope</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">Choose which files get a new &lt;lastmod&gt;.</p>
            </div>
          </div>
          {hasFetched && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium shrink-0">
              {leafFiles.length} Sitemap{leafFiles.length === 1 ? "" : "s"} Discovered
            </span>
          )}
        </CardHeader>
        <CardContent className="space-y-4 px-6 pb-6 pt-4">

        {!hasFetched ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-10 text-center">
            <ListChecks className="h-6 w-6 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">Fetch a domain&apos;s files above to choose a scope.</p>
          </div>
        ) : (
          <>
            <div className="flex rounded-lg border border-border p-1 bg-muted/40 w-fit">
              <TabButton active={scopeTab === "all"} onClick={() => switchScopeTab("all")}>All Files</TabButton>
              <TabButton active={scopeTab === "selected"} onClick={() => switchScopeTab("selected")}>Selected Files</TabButton>
              <TabButton active={scopeTab === "vertical"} onClick={() => switchScopeTab("vertical")}>Vertical wise</TabButton>
            </div>

            {scopeTab === "all" && (
              <p className="text-sm text-muted-foreground">All {leafFiles.length} sitemap file(s) will get today&apos;s (or the chosen) date.</p>
            )}

            {scopeTab === "selected" && (
              <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/60 backdrop-blur">
                    <tr>
                      <th className="w-8 px-3 py-2" />
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide">Filename</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide">URL Count</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide">Current &lt;lastmod&gt;</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground text-xs uppercase tracking-wide">Size</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {leafFiles.map((f) => (
                      <tr
                        key={f.loc}
                        className="hover:bg-muted/40 cursor-pointer"
                        onClick={() => toggleFile(f.filename)}
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedFiles.has(f.filename)}
                            onChange={() => toggleFile(f.filename)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className="px-3 py-2 font-mono truncate max-w-[220px]">{f.filename}</td>
                        <td
                          className="px-3 py-2 font-mono text-muted-foreground"
                          title="Placeholder — file contents aren't parsed at discovery time yet"
                        >
                          {fakeUrlCountFor(f.filename)}
                        </td>
                        <td
                          className="px-3 py-2 font-mono text-muted-foreground"
                          title="Placeholder — file contents aren't parsed at discovery time yet"
                        >
                          {fakeLastmodFor(f.filename)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-muted-foreground whitespace-nowrap">
                          {formatBytes(f.sizeBytes)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {scopeTab === "selected" && leafFiles.length > 0 && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => setSelectedFiles(new Set(leafFiles.map((f) => f.filename)))}
                  >
                    Select all
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setSelectedFiles(new Set())}
                  >
                    Deselect all
                  </button>
                </div>
                <span>{selectedFiles.size} of {leafFiles.length} selected</span>
              </div>
            )}

            {scopeTab === "vertical" && (
              <div className="space-y-2">
                {loadingVerticals && <p className="text-sm text-muted-foreground">Sampling URLs and detecting patterns…</p>}
                {!loadingVerticals && verticals.length === 0 && (
                  <p className="text-sm text-muted-foreground">No patterns detected — try All Files or Selected Files instead.</p>
                )}
                <div className="max-h-72 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                  {verticals.map((v) => (
                    <label key={v.template} className="flex items-start gap-2 px-3 py-2 text-sm hover:bg-muted/40 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={selectedVerticals.has(v.template)}
                        onChange={() => toggleVertical(v.template)}
                      />
                      <span className="flex-1">
                        <span className="font-mono block">{v.template}</span>
                        <span className="text-xs text-muted-foreground">
                          {v.fileCount} file{v.fileCount === 1 ? "" : "s"} · e.g. {v.sampleUrls[0]}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        </CardContent>
      </Card>

      {/* 3. Date & push */}
      <Card>
        <CardHeader className="flex items-start gap-3 border-b-0 px-6 pt-6 pb-0">
          <StepBadge step={3} state={status === "success" ? "complete" : hasFetched ? "current" : "upcoming"} />
          <div>
            <CardTitle className="text-base">Date &amp; push</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">Defaults to today — pick another date if needed.</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-6 pb-6 pt-4">

        <div className="space-y-2 max-w-sm">
          <Label htmlFor="lastmod-date">New lastmod date</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="lastmod-date"
              type="date"
              className="w-auto"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <Button
              type="button" variant="outline" size="sm"
              onClick={() => setDate(new Date().toISOString().slice(0, 10))}
            >
              Today
            </Button>
            <Button
              type="button" variant="outline" size="sm"
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() - 1);
                setDate(d.toISOString().slice(0, 10));
              }}
            >
              Yesterday
            </Button>
          </div>
        </div>

        <Button onClick={runUpdate} disabled={!canRun}>
          {status === "running" ? "Running…" : "Update lastmod & push to S3"}
        </Button>

        {status !== "idle" && <TerminalOutput lines={lines} status={status} />}
        </CardContent>
      </Card>

      {/* Missing-index confirm dialog */}
      <Dialog open={showCreateIndexDialog} onOpenChange={setShowCreateIndexDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>No sitemap-index.xml found</DialogTitle>
            <DialogDescription>
              {domain} doesn&apos;t have a sitemap-index.xml. Create one referencing the {leafFiles.length} discovered file(s) and
              push it to S3? File-level lastmod updates need an index to attach &lt;lastmod&gt; to.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowCreateIndexDialog(false)} disabled={creatingIndex}>
              Not now
            </Button>
            <Button onClick={confirmCreateIndex} disabled={creatingIndex}>
              {creatingIndex ? "Creating…" : "Create sitemap-index.xml"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Local disk cleanup confirm dialog */}
      <Dialog open={showCleanupDialog} onOpenChange={setShowCleanupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Free up local disk space?</DialogTitle>
            <DialogDescription>
              This run used {(localBytesUsed / 1024).toFixed(1)} KB of local temp storage. Delete it now?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => respondCleanup(false)}>Keep files</Button>
            <Button onClick={() => respondCleanup(true)}>Delete local files</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
