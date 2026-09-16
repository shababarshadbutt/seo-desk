"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Play, Square, RotateCcw, Plus, Trash2, Download, ChevronDown, Search, Check, ExternalLink, BookmarkPlus, Bookmark, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { TerminalOutput, type RunStatus, type RunProgress } from "@/components/terminal-output";
import { cn } from "@/lib/utils";

const PROGRESS_RE = /^\[PROGRESS\]\s+done=(\d+)\s+queued=(\d+)\s+urls=(\d+)/;
const SUMMARY_RE = /^\[SUMMARY\]\s+indexed=(\d+)\s+not_indexed=(\d+)\s+total=(\d+)/;

function parseIndexingSummary(lines: string[]): { indexed: number; notIndexed: number; total: number } | null {
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(SUMMARY_RE);
    if (m) return { indexed: Number(m[1]), notIndexed: Number(m[2]), total: Number(m[3]) };
  }
  return null;
}
import { scripts, type ScriptConfig, type ScriptInput } from "@/lib/scripts-config";

interface ScriptRunnerProps {
  slug: string;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SiteEntry {
  id: number;
  label: string;
  urls: string;
  serviceAccount: string;
}

interface SiteRunState {
  status: RunStatus;
  lines: string[];
  csvPath: string | null;
  abortController: AbortController | null;
}

interface ScriptPreset {
  id: string;
  name: string;
  inputs: Record<string, string | number | boolean>;
  createdAt: string;
}

let siteIdCounter = 1;
function newSite(defaultAccount = ""): SiteEntry {
  return { id: siteIdCounter++, label: "", urls: "", serviceAccount: defaultAccount };
}

function defaultRunState(): SiteRunState {
  return { status: "idle", lines: [], csvPath: null, abortController: null };
}

// ─── URL Indexer run summary (plain-English translation of the raw log) ──────

interface IndexerRunSummary {
  submitted: number;
  skipped: number;
  perUrlErrors: number;
  fatalMessage: string | null;
}

function friendlyFatalMessage(rawLine: string): string {
  if (rawLine.includes("Missing required Python package")) {
    return "This tool is missing some required software on the server.";
  }
  if (rawLine.toLowerCase().includes("authenticate") || rawLine.toLowerCase().includes("service account")) {
    return "The service account file couldn't be used to sign in to Google — it may be missing, invalid, or expired.";
  }
  return "Something unexpected stopped this script before it could finish.";
}

function summarizeIndexerRun(lines: string[], status: RunStatus): IndexerRunSummary | null {
  if (status !== "success" && status !== "error") return null;

  let submitted = 0;
  let skipped = 0;
  let perUrlErrors = 0;
  let sawDone = false;
  let firstErrorLine: string | null = null;

  for (const line of lines) {
    if (line.startsWith("[DONE]")) sawDone = true;
    else if (/^\[INFO\] \[\d+\/\d+\] Submitted:/.test(line)) submitted++;
    else if (/^\[WARN\] \[\d+\/\d+\] Skipped:/.test(line)) skipped++;
    else if (/^\[ERROR\] \[\d+\/\d+\]/.test(line)) perUrlErrors++;
    else if (!firstErrorLine && line.startsWith("[ERROR]")) firstErrorLine = line;
  }

  const processedAny = submitted + skipped + perUrlErrors > 0;
  const fatalMessage =
    status === "error" && !sawDone && !processedAny && firstErrorLine
      ? friendlyFatalMessage(firstErrorLine)
      : null;

  return { submitted, skipped, perUrlErrors, fatalMessage };
}

// ─── Main runner ──────────────────────────────────────────────────────────────

export function ScriptRunner({ slug }: ScriptRunnerProps) {
  const router = useRouter();
  const script = scripts.find((s) => s.slug === slug) as ScriptConfig;

  const isMultiSite = script.inputs.some((i) => i.type === "multi-site-urls");

  // Standard script state
  const [fieldValues, setFieldValues] = useState<Record<string, string | File | FileList>>({});
  const [selectedAccount, setSelectedAccount] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [lines, setLines] = useState<string[]>([]);
  const [status, setStatus] = useState<RunStatus>("idle");
  const [outputFilePath, setOutputFilePath] = useState<string | null>(null);
  const [progress, setProgress] = useState<RunProgress | null>(null);

  // Saved input presets ("Custom Script" reinterpretation) — standard (non-multi-site) scripts only
  const [presets, setPresets] = useState<ScriptPreset[]>([]);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presetError, setPresetError] = useState("");
  const [presetBusy, setPresetBusy] = useState(false);
  const presetsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (presetsRef.current && !presetsRef.current.contains(e.target as Node)) setPresetsOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Multi-site state
  const [sites, setSites] = useState<SiteEntry[]>([newSite()]);
  const [siteRuns, setSiteRuns] = useState<Map<number, SiteRunState>>(new Map());
  const [accountNames, setAccountNames] = useState<string[]>([]);

  useEffect(() => {
    if (!script.requiresServiceAccount) return;
    fetch("/api/settings/service-accounts")
      .then((r) => r.json())
      .then((names: string[]) => {
        setAccountNames(names);
        if (names.length === 1) {
          setSelectedAccount(names[0]);
          setSelectedAccounts(names);
          setSites((prev) => prev.map((s) => ({ ...s, serviceAccount: names[0] })));
        }
      })
      .catch(() => {});
  }, [script.requiresServiceAccount]);

  // ─── Saved input presets ("Custom Script") ─────────────────────────────────

  function loadPresets() {
    fetch(`/api/script-presets?scriptSlug=${encodeURIComponent(script.slug)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ScriptPreset[]) => setPresets(data))
      .catch(() => {});
  }

  useEffect(() => {
    if (!isMultiSite) loadPresets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script.slug]);

  function applyPreset(preset: ScriptPreset) {
    setFieldValues((prev) => {
      const next = { ...prev };
      for (const [key, value] of Object.entries(preset.inputs)) {
        next[key] = String(value);
      }
      return next;
    });
    setPresetsOpen(false);
  }

  async function savePreset() {
    if (!presetName.trim()) { setPresetError("Give this preset a name."); return; }
    setPresetError(""); setPresetBusy(true);

    const inputsToSave: Record<string, string> = {};
    for (const [key, value] of Object.entries(fieldValues)) {
      if (typeof value === "string") inputsToSave[key] = value;
    }

    const res = await fetch("/api/script-presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scriptSlug: script.slug, name: presetName.trim(), inputs: inputsToSave }),
    });

    setPresetBusy(false);
    if (!res.ok) { setPresetError((await res.json()).error ?? "Failed to save preset."); return; }

    setPresetName("");
    setSaveDialogOpen(false);
    loadPresets();
  }

  async function deletePreset(id: string) {
    await fetch(`/api/script-presets/${id}`, { method: "DELETE" });
    setPresets((prev) => prev.filter((p) => p.id !== id));
  }

  // ─── Site run state helpers ────────────────────────────────────────────────

  function getSiteRun(id: number): SiteRunState {
    return siteRuns.get(id) ?? defaultRunState();
  }

  function updateSiteRun(id: number, patch: Partial<SiteRunState>) {
    setSiteRuns((prev) => {
      const next = new Map(prev);
      next.set(id, { ...(prev.get(id) ?? defaultRunState()), ...patch });
      return next;
    });
  }

  function appendSiteLine(id: number, line: string) {
    setSiteRuns((prev) => {
      const next = new Map(prev);
      const cur = prev.get(id) ?? defaultRunState();
      next.set(id, { ...cur, lines: [...cur.lines, line] });
      return next;
    });
  }

  // ─── SSE stream reader (per-site) ─────────────────────────────────────────

  async function readSiteStream(
    id: number,
    response: Response,
    signal: AbortSignal
  ): Promise<{ exitCode: number; outputFilePath: string | null }> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let exitCode = -1;
    let outputFilePath: string | null = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (signal.aborted) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const dataLine = part.split("\n").find((l) => l.startsWith("data: "));
          if (!dataLine) continue;

          let event: {
            type: string;
            line?: string;
            exitCode?: number;
            outputFilePath?: string | null;
          };
          try { event = JSON.parse(dataLine.slice(6)); } catch { continue; }

          if (event.type === "output" && event.line) {
            appendSiteLine(id, event.line);
          } else if (event.type === "done") {
            exitCode = event.exitCode ?? -1;
            outputFilePath = event.outputFilePath ?? null;
          }
        }
      }
    } catch {
      // stream error or abort
    }

    return { exitCode, outputFilePath };
  }

  // ─── Per-site run / stop ───────────────────────────────────────────────────

  async function runSite(site: SiteEntry) {
    const ac = new AbortController();
    updateSiteRun(site.id, {
      status: "running", lines: [], csvPath: null, abortController: ac,
    });

    const urlList = site.urls.split("\n").map((u) => u.trim()).filter(Boolean).join("\n");

    const formData = new FormData();
    formData.append("slug", slug);
    formData.append("serviceAccountName", site.serviceAccount);
    formData.append("urls", urlList);

    let response: Response;
    try {
      response = await fetch("/api/scripts/run", {
        method: "POST",
        body: formData,
        signal: ac.signal,
      });
    } catch (err) {
      const isAbort = (err as Error).name === "AbortError";
      updateSiteRun(site.id, {
        status: isAbort ? "idle" : "error",
        lines: isAbort ? [] : ["[ERROR] Failed to reach the server."],
        abortController: null,
      });
      return;
    }

    if (!response.ok || !response.body) {
      const text = await response.text().catch(() => "Unknown error");
      updateSiteRun(site.id, {
        status: "error",
        lines: [`[ERROR] ${text}`],
        abortController: null,
      });
      return;
    }

    const { exitCode, outputFilePath } = await readSiteStream(site.id, response, ac.signal);

    updateSiteRun(site.id, {
      status: exitCode === 0 ? "success" : "error",
      csvPath: exitCode === 0 ? outputFilePath : null,
      abortController: null,
    });
    router.refresh();
  }

  function stopSite(id: number) {
    const run = getSiteRun(id);
    run.abortController?.abort();
    updateSiteRun(id, { status: "idle", abortController: null });
  }

  function resetSite(id: number) {
    updateSiteRun(id, defaultRunState());
  }

  // ─── Site list management ──────────────────────────────────────────────────

  function addSite() {
    const defaultAccount = accountNames.length === 1 ? accountNames[0] : "";
    setSites((prev) => [newSite(defaultAccount), ...prev]);
  }

  function removeSite(id: number) {
    stopSite(id);
    setSites((prev) => prev.filter((s) => s.id !== id));
    setSiteRuns((prev) => { const next = new Map(prev); next.delete(id); return next; });
  }

  function updateSite(id: number, field: keyof Omit<SiteEntry, "id">, value: string) {
    setSites((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  }

  // ─── Standard (non-multi-site) submit ─────────────────────────────────────

  function setField(name: string, value: string | File | FileList) {
    setFieldValues((prev) => ({ ...prev, [name]: value }));
  }

  async function handleStandardSubmit(e: React.FormEvent) {
    e.preventDefault();

    setLines([]);
    setStatus("running");
    setOutputFilePath(null);
    setProgress(null);

    // Determine which accounts to iterate over
    const accountsToRun = script.multiServiceAccount
      ? selectedAccounts
      : script.requiresServiceAccount
      ? [selectedAccount]
      : [""];

    let allSuccess = true;

    for (let i = 0; i < accountsToRun.length; i++) {
      const account = accountsToRun[i];

      // Print a separator when running multiple accounts
      if (script.multiServiceAccount && accountsToRun.length > 1) {
        setLines((p) => [
          ...p,
          `[INFO] ══════════ Account ${i + 1} of ${accountsToRun.length}: ${account} ══════════`,
        ]);
      }

      const formData = new FormData();
      formData.append("slug", slug);
      if (account) formData.append("serviceAccountName", account);

      for (const input of script.inputs) {
        const value = fieldValues[input.name];
        if (value instanceof FileList) {
          for (const file of Array.from(value)) formData.append(input.name, file);
        } else if (value instanceof File) {
          formData.append(input.name, value);
        } else if (typeof value === "string" && value.trim()) {
          formData.append(input.name, value.trim());
        }
      }

      let response: Response;
      try {
        response = await fetch("/api/scripts/run", { method: "POST", body: formData });
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        setLines((p) => [...p, `[ERROR] Failed to reach the server: ${detail}`]);
        allSuccess = false;
        break;
      }

      if (!response.ok || !response.body) {
        const text = await response.text().catch(() => "");
        const msg = text.trim().replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        setLines((p) => [...p, `[ERROR] HTTP ${response.status}${msg ? ": " + msg.slice(0, 300) : " (empty response)"}`]);
        allSuccess = false;
        break;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let exitCode = -1;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const dataLine = part.split("\n").find((l) => l.startsWith("data: "));
          if (!dataLine) continue;
          let event: { type: string; line?: string; exitCode?: number; outputFilePath?: string | null };
          try { event = JSON.parse(dataLine.slice(6)); } catch { continue; }
          if (event.type === "output" && event.line) {
            const m = event.line.match(PROGRESS_RE);
            if (m) setProgress({ done: Number(m[1]), queued: Number(m[2]), urls: Number(m[3]) });
            else setLines((p) => [...p, event.line!]);
          } else if (event.type === "done") {
            exitCode = event.exitCode ?? -1;
            if (event.outputFilePath) setOutputFilePath(event.outputFilePath);
          }
        }
      }

      if (exitCode !== 0) allSuccess = false;
    }

    setStatus(allSuccess ? "success" : "error");
    router.refresh();
  }

  const isRunning = status === "running";
  const totalUrls = isMultiSite
    ? sites.reduce((s, site) => s + site.urls.split("\n").filter((u) => u.trim()).length, 0)
    : 0;
  const indexingSummary =
    slug === "indexing-checker" && status === "success" ? parseIndexingSummary(lines) : null;

  // ─── Render ────────────────────────────────────────────────────────────────

  if (isMultiSite) {
    return (
      <div className="space-y-4">
        {/* Global header */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground shrink-0">
            {sites.length} site{sites.length !== 1 ? "s" : ""} · {totalUrls} URL{totalUrls !== 1 ? "s" : ""} total
          </p>
          {script.requiresServiceAccount && accountNames.length === 0 ? (
            <p className="text-sm text-destructive">
              No service accounts.{" "}
              <a href="/settings" className="underline">Go to Settings</a>
            </p>
          ) : (
            <Button variant="outline" size="sm" onClick={addSite}>
              <Plus className="h-4 w-4" />
              Add another website
            </Button>
          )}
        </div>

        {/* Per-site cards */}
        {sites.map((site, index) => (
          <SiteCard
            key={site.id}
            site={site}
            index={index}
            run={getSiteRun(site.id)}
            scriptSlug={script.slug}
            accountNames={accountNames}
            requiresServiceAccount={!!script.requiresServiceAccount}
            canRemove={sites.length > 1}
            onRun={() => runSite(site)}
            onStop={() => stopSite(site.id)}
            onReset={() => resetSite(site.id)}
            onRemove={() => removeSite(site.id)}
            onUpdate={(field, value) => updateSite(site.id, field, value)}
          />
        ))}
      </div>
    );
  }

  // Standard single-script layout
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Inputs</h3>
            <div ref={presetsRef} className="relative flex items-center gap-1.5">
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setSaveDialogOpen(true)}>
                <BookmarkPlus className="h-3.5 w-3.5" /> Save preset
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setPresetsOpen((v) => !v)}>
                <Bookmark className="h-3.5 w-3.5" /> Presets {presets.length > 0 && `(${presets.length})`}
                <ChevronDown className="h-3 w-3" />
              </Button>
              {presetsOpen && (
                <div className="absolute right-0 top-full mt-1 w-64 rounded-lg border border-border bg-popover shadow-md z-50">
                  {presets.length === 0 ? (
                    <p className="px-3 py-3 text-xs text-muted-foreground">No saved presets yet for this script.</p>
                  ) : (
                    <ul className="max-h-56 overflow-y-auto py-1">
                      {presets.map((p) => (
                        <li key={p.id} className="flex items-center gap-1 px-1">
                          <button
                            type="button"
                            onClick={() => applyPreset(p)}
                            className="flex-1 text-left px-2 py-1.5 text-sm rounded hover:bg-accent truncate"
                          >
                            {p.name}
                          </button>
                          <button
                            type="button"
                            onClick={() => deletePreset(p.id)}
                            aria-label={`Delete preset ${p.name}`}
                            className="p-1.5 text-muted-foreground hover:text-destructive shrink-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
          <form onSubmit={handleStandardSubmit} className="space-y-4">
            {script.requiresServiceAccount && (
              <div className="space-y-1.5">
                <Label>
                  Service Account{" "}
                  {script.multiServiceAccount
                    ? <span className="text-muted-foreground font-normal">(select one or more)</span>
                    : <span className="text-destructive">*</span>}
                </Label>
                {accountNames.length === 0 ? (
                  <p className="text-sm text-destructive">
                    No service accounts configured.{" "}
                    <a href="/settings" className="underline">Go to Settings</a> to add one.
                  </p>
                ) : script.multiServiceAccount ? (
                  <MultiAccountSelector
                    accountNames={accountNames}
                    selected={selectedAccounts}
                    onChange={setSelectedAccounts}
                    disabled={isRunning}
                  />
                ) : (
                  <SingleAccountSelector
                    accountNames={accountNames}
                    selected={selectedAccount}
                    onChange={setSelectedAccount}
                    disabled={isRunning}
                  />
                )}
              </div>
            )}

            {script.inputs.map((input) => (
              <ScriptField
                key={input.name}
                input={input}
                value={fieldValues[input.name] ?? ""}
                onChange={(v) => setField(input.name, v)}
                disabled={isRunning}
              />
            ))}

            <div className="flex gap-2 pt-2">
              <Button type="submit"
                disabled={
                  isRunning ||
                  (script.multiServiceAccount && selectedAccounts.length === 0) ||
                  (!script.multiServiceAccount && script.requiresServiceAccount && !selectedAccount)
                }
                className="flex-1">
                <Play className="h-4 w-4" />
                {isRunning ? "Running…" : "Run script"}
              </Button>
              {status !== "idle" && (
                <Button type="button" variant="outline"
                  onClick={() => { setLines([]); setStatus("idle"); setOutputFilePath(null); setProgress(null); }} disabled={isRunning}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
            </div>
            {indexingSummary && (
              <p className="text-sm text-center text-muted-foreground">
                {indexingSummary.indexed} indexed · {indexingSummary.notIndexed} not indexed
                {" "}(of {indexingSummary.total})
              </p>
            )}
            {status === "success" && outputFilePath && (
              <a
                href={`/api/logs/download?path=${encodeURIComponent(outputFilePath)}`}
                download
                className="flex items-center justify-center gap-2 w-full h-9 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors"
              >
                <Download className="h-4 w-4" />
                Download {outputFilePath.endsWith(".txt") ? "TXT" : "CSV"}
              </a>
            )}
            {status === "success" && script.sheetUrl && (
              <a
                href={script.sheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full h-9 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors shadow-sm shadow-emerald-500/25"
              >
                <ExternalLink className="h-4 w-4" />
                Open Google Sheet
              </a>
            )}
          </form>
        </div>
      </div>
      <div>
        <TerminalOutput lines={lines} status={status} progress={progress} />
      </div>

      {/* Save preset dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={(o) => { setSaveDialogOpen(o); if (!o) { setPresetName(""); setPresetError(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Save as preset</DialogTitle>
            <DialogDescription>Save the current input values so you can reuse them next time — file uploads aren&apos;t saved.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Preset name</Label>
              <Input
                placeholder="e.g. Weekly blog batch"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                autoFocus
              />
            </div>
            {presetError && <p className="text-sm text-destructive">{presetError}</p>}
            <div className="flex gap-2 justify-end pt-1">
              <Button type="button" variant="outline" onClick={() => setSaveDialogOpen(false)} disabled={presetBusy}>Cancel</Button>
              <Button type="button" onClick={savePreset} disabled={presetBusy}>
                {presetBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Per-site card ─────────────────────────────────────────────────────────────

interface SiteCardProps {
  site: SiteEntry;
  index: number;
  run: SiteRunState;
  scriptSlug: string;
  accountNames: string[];
  requiresServiceAccount: boolean;
  canRemove: boolean;
  onRun: () => void;
  onStop: () => void;
  onReset: () => void;
  onRemove: () => void;
  onUpdate: (field: keyof Omit<SiteEntry, "id">, value: string) => void;
}

function SiteCard({
  site, index, run, scriptSlug, accountNames, requiresServiceAccount, canRemove,
  onRun, onStop, onReset, onRemove, onUpdate,
}: SiteCardProps) {
  const urlCount = site.urls.split("\n").filter((u) => u.trim()).length;
  const isRunning = run.status === "running";
  const noAccounts = accountNames.length === 0;
  const indexerSummary =
    scriptSlug === "url-indexer" ? summarizeIndexerRun(run.lines, run.status) : null;

  const canRun =
    !isRunning &&
    (!requiresServiceAccount || (!noAccounts && !!site.serviceAccount)) &&
    urlCount > 0;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/30">
        <span className="text-sm font-semibold text-muted-foreground w-6 shrink-0">
          {index + 1}.
        </span>
        <Input
          placeholder="Website name (e.g. Aviation Axis)"
          value={site.label}
          onChange={(e) => onUpdate("label", e.target.value)}
          disabled={isRunning}
          className="h-8 text-sm flex-1"
        />
        {urlCount > 0 && (
          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
            {urlCount}/200 URLs
          </span>
        )}
        {canRemove && (
          <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0"
            onClick={onRemove} disabled={isRunning}>
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        )}
      </div>

      {/* Two-column body: inputs left, terminal right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x">
        {/* Left — inputs */}
        <div className="px-4 py-3 space-y-3">
          {/* Service account selector — only for scripts that need it */}
          {requiresServiceAccount && (
            <div className="space-y-1">
              <Label className="text-xs">Service Account <span className="text-destructive">*</span></Label>
              {noAccounts ? (
                <p className="text-xs text-destructive">
                  No accounts. <a href="/settings" className="underline">Go to Settings</a>
                </p>
              ) : (
                <SingleAccountSelector
                  accountNames={accountNames}
                  selected={site.serviceAccount}
                  onChange={(v) => onUpdate("serviceAccount", v)}
                  disabled={isRunning}
                  size="sm"
                />
              )}
            </div>
          )}

          {/* URLs textarea */}
          <div className="space-y-1">
            <Label className="text-xs">URLs <span className="text-destructive">*</span></Label>
            <textarea
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              rows={6}
              placeholder={"https://example.com/page-1\nhttps://example.com/page-2\n..."}
              value={site.urls}
              onChange={(e) => onUpdate("urls", e.target.value)}
              disabled={isRunning}
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            {!isRunning ? (
              <Button size="sm" onClick={onRun} disabled={!canRun} className="flex-1">
                <Play className="h-3.5 w-3.5" />
                Run
              </Button>
            ) : (
              <Button size="sm" variant="destructive" onClick={onStop} className="flex-1">
                <Square className="h-3.5 w-3.5" />
                Stop
              </Button>
            )}
            {run.status !== "idle" && !isRunning && (
              <Button size="sm" variant="outline" onClick={onReset}>
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            )}
            {run.status === "success" && run.csvPath && (
              <a
                href={`/api/logs/download?path=${encodeURIComponent(run.csvPath)}`}
                download
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-medium transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Download CSV
              </a>
            )}
          </div>
        </div>

        {/* Right — terminal (always visible) */}
        <div className="px-4 py-3">
          {indexerSummary && (
            <div
              className={cn(
                "mb-3 rounded-lg border p-3 text-sm",
                indexerSummary.fatalMessage
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "border-border bg-muted/30"
              )}
            >
              {indexerSummary.fatalMessage ? (
                <p>
                  <strong>Couldn&apos;t run this script.</strong> {indexerSummary.fatalMessage} Contact your developer and share the technical details below.
                </p>
              ) : (
                <ul className="space-y-1">
                  {indexerSummary.submitted > 0 && (
                    <li>✅ {indexerSummary.submitted} URL{indexerSummary.submitted === 1 ? "" : "s"} submitted for indexing.</li>
                  )}
                  {indexerSummary.skipped > 0 && (
                    <li>
                      ⚠️ {indexerSummary.skipped} URL{indexerSummary.skipped === 1 ? "" : "s"} skipped — these pages didn&apos;t load successfully
                      (broken link, redirect, or timeout), so Google can&apos;t index them yet. Double-check the links work in a browser.
                    </li>
                  )}
                  {indexerSummary.perUrlErrors > 0 && (
                    <li>
                      ❌ {indexerSummary.perUrlErrors} URL{indexerSummary.perUrlErrors === 1 ? "" : "s"} failed while submitting to Google —
                      contact your developer if this keeps happening.
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}
          <TerminalOutput lines={run.lines} status={run.status} />
        </div>
      </div>
    </div>
  );
}

// ─── Single-account selector (with search) ───────────────────────────────────

interface SingleAccountSelectorProps {
  accountNames: string[];
  selected: string;
  onChange: (v: string) => void;
  disabled: boolean;
  size?: "default" | "sm";
}

function SingleAccountSelector({
  accountNames, selected, onChange, disabled, size = "default",
}: SingleAccountSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isSmall = size === "sm";

  const filtered = accountNames.filter((n) =>
    n.toLowerCase().includes(search.toLowerCase())
  );

  function handleOpen() {
    if (buttonRef.current) setAnchorRect(buttonRef.current.getBoundingClientRect());
    setOpen((o) => !o);
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      const t = e.target as Node;
      if (
        buttonRef.current && !buttonRef.current.contains(t) &&
        dropdownRef.current && !dropdownRef.current.contains(t)
      ) {
        setOpen(false);
        setSearch("");
      }
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function handleSelect(name: string) {
    onChange(name);
    setOpen(false);
    setSearch("");
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        className={`${isSmall ? "h-8 text-xs" : "h-10 text-sm"} w-full flex items-center justify-between rounded-lg border border-input bg-background px-3 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
        onClick={handleOpen}
        disabled={disabled}
      >
        <span className={!selected ? "text-muted-foreground" : ""}>
          {selected || "— Select a service account —"}
        </span>
        <ChevronDown className={`${isSmall ? "h-3.5 w-3.5" : "h-4 w-4"} text-muted-foreground shrink-0`} />
      </button>

      {open && anchorRect && (
        <div
          ref={dropdownRef}
          style={{
            position: "fixed",
            top: anchorRect.bottom + 4,
            left: anchorRect.left,
            width: anchorRect.width,
            zIndex: 9999,
          }}
          className="rounded-lg border bg-popover shadow-md"
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              autoFocus
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Search accounts…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">No accounts match.</p>
            ) : (
              filtered.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent text-left"
                  onClick={() => handleSelect(name)}
                >
                  <div className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${selected === name ? "bg-primary border-primary" : "border-input"}`}>
                    {selected === name && <div className="h-2 w-2 rounded-full bg-primary-foreground" />}
                  </div>
                  <span className="truncate">{name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Multi-account selector ───────────────────────────────────────────────────

interface MultiAccountSelectorProps {
  accountNames: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  disabled: boolean;
}

function MultiAccountSelector({ accountNames, selected, onChange, disabled }: MultiAccountSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = accountNames.filter((n) =>
    n.toLowerCase().includes(search.toLowerCase())
  );

  const allSelected = selected.length === accountNames.length;
  const noneSelected = selected.length === 0;

  function toggleAccount(name: string) {
    onChange(
      selected.includes(name)
        ? selected.filter((n) => n !== name)
        : [...selected, name]
    );
  }

  function toggleAll() {
    onChange(allSelected ? [] : [...accountNames]);
  }

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const label = noneSelected
    ? "— Select service accounts —"
    : allSelected
    ? `All ${accountNames.length} accounts selected`
    : `${selected.length} of ${accountNames.length} selected`;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        className="h-10 w-full flex items-center justify-between rounded-lg border border-input bg-background px-3 text-sm disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
      >
        <span className={noneSelected ? "text-muted-foreground" : ""}>{label}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-md">
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 border-b">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              autoFocus
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Search accounts…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Select all row */}
          <button
            type="button"
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent border-b"
            onClick={toggleAll}
          >
            <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${allSelected ? "bg-primary border-primary" : "border-input"}`}>
              {allSelected && <Check className="h-3 w-3 text-primary-foreground" />}
            </div>
            <span className="font-medium">{allSelected ? "Deselect All" : "Select All"}</span>
            <span className="ml-auto text-xs text-muted-foreground">{accountNames.length} total</span>
          </button>

          {/* Account list */}
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">No accounts match.</p>
            ) : (
              filtered.map((name) => {
                const checked = selected.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent text-left"
                    onClick={() => toggleAccount(name)}
                  >
                    <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${checked ? "bg-primary border-primary" : "border-input"}`}>
                      {checked && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    <span className="truncate">{name}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Standard field renderer ──────────────────────────────────────────────────

interface ScriptFieldProps {
  input: ScriptInput;
  value: string | File | FileList;
  onChange: (v: string | File | FileList) => void;
  disabled: boolean;
}

function ScriptField({ input, value, onChange, disabled }: ScriptFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={input.name}>
        {input.label}
        {input.required && <span className="text-destructive ml-1">*</span>}
      </Label>

      {input.type === "textarea" ? (
        <textarea
          id={input.name}
          className="flex min-h-[100px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono resize-y"
          placeholder={input.placeholder}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          required={input.required}
        />
      ) : input.type === "file" ? (
        <div className="space-y-1">
          <input
            id={input.name}
            type="file"
            accept={input.accept}
            {...(input.folder ? { webkitdirectory: "", multiple: true } as React.InputHTMLAttributes<HTMLInputElement> : {})}
            onChange={(e) => onChange(
              input.folder
                ? (e.target.files ?? "")
                : (e.target.files?.[0] ?? "")
            )}
            disabled={disabled}
            required={input.required}
            className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
          {input.folder && value instanceof FileList && value.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {value.length} file{value.length !== 1 ? "s" : ""} selected
            </p>
          )}
        </div>
      ) : (
        <Input
          id={input.name}
          type={input.type}
          placeholder={input.placeholder}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          required={input.required}
        />
      )}

      {input.description && (
        <p className="text-xs text-muted-foreground">{input.description}</p>
      )}
    </div>
  );
}
