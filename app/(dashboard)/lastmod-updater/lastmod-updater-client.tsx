"use client";

import { useState } from "react";
import { Server, Cloud, Link as LinkIcon, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      } else {
        if (!selectedDomain) return;
        const res = await fetch("/api/lastmod-updater/fetch-files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: sourceTab, domain: selectedDomain }),
        });
        applyFetchResult(await readJson(res));
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
    <div className="space-y-6 max-w-3xl">
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* 1. Source */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div>
          <h3 className="font-semibold">1. Source</h3>
          <p className="text-sm text-muted-foreground">Choose where this domain&apos;s current sitemaps live.</p>
        </div>

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
      </div>

      {/* 2. Scope */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div>
          <h3 className="font-semibold">2. Scope</h3>
          <p className="text-sm text-muted-foreground">Choose which files get a new &lt;lastmod&gt;.</p>
        </div>

        {!hasFetched ? (
          <p className="text-sm text-muted-foreground">Fetch a domain&apos;s files above to choose a scope.</p>
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
              <div className="max-h-64 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                {leafFiles.map((f) => (
                  <label key={f.filename} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/40 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedFiles.has(f.filename)}
                      onChange={() => toggleFile(f.filename)}
                    />
                    <span className="font-mono truncate">{f.filename}</span>
                  </label>
                ))}
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
      </div>

      {/* 3. Date & push */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div>
          <h3 className="font-semibold">3. Date &amp; push</h3>
          <p className="text-sm text-muted-foreground">Defaults to today — pick another date if needed.</p>
        </div>

        <div className="space-y-2 max-w-xs">
          <Label htmlFor="lastmod-date">New lastmod date</Label>
          <Input id="lastmod-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <Button onClick={runUpdate} disabled={!canRun}>
          {status === "running" ? "Running…" : "Update lastmod & push to S3"}
        </Button>

        {status !== "idle" && <TerminalOutput lines={lines} status={status} />}
      </div>

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

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {children}
    </button>
  );
}
