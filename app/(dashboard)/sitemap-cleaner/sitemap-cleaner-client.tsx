"use client";

import { useRef, useState } from "react";
import { Upload, Server, Cloud, Link as LinkIcon, RefreshCw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TerminalOutput, type RunStatus } from "@/components/terminal-output";
import { cn } from "@/lib/utils";

type SourceTab = "upload" | "sftp" | "s3" | "url";
type OutputTab = "zip" | "s3";

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

async function compressJson(data: unknown): Promise<ArrayBuffer> {
  const stream = new CompressionStream("gzip");
  const writer = stream.writable.getWriter();
  writer.write(new TextEncoder().encode(JSON.stringify(data)));
  writer.close();
  return new Response(stream.readable).arrayBuffer();
}

export function SitemapCleanerClient() {
  const [sourceTab, setSourceTab] = useState<SourceTab>("upload");
  const [outputTab, setOutputTab] = useState<OutputTab>("zip");
  const [subfolder, setSubfolder] = useState("sitemaps");
  const [error, setError] = useState<string | null>(null);

  // Upload source
  const [uploadDomain, setUploadDomain] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileCount, setFileCount] = useState(0);

  // SFTP / S3 source
  const [domains, setDomains] = useState<string[]>([]);
  const [selectedDomain, setSelectedDomain] = useState("");
  const [loadingDomains, setLoadingDomains] = useState(false);

  // URL source
  const [siteUrl, setSiteUrl] = useState("");

  // Fetched-file state (sftp/s3/url)
  const [fetchingFiles, setFetchingFiles] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [fetchedFileCount, setFetchedFileCount] = useState(0);
  const [fetchedIndexFilename, setFetchedIndexFilename] = useState<string | null>(null);

  // Run state
  const [status, setStatus] = useState<RunStatus>("idle");
  const [lines, setLines] = useState<string[]>([]);
  const [outputFilePath, setOutputFilePath] = useState<string | null>(null);
  const [s3Keys, setS3Keys] = useState<string[] | null>(null);

  const domain = sourceTab === "upload" ? uploadDomain.trim() : sourceTab === "url" ? deriveDomainFromUrl(siteUrl) : selectedDomain;

  function resetRunState() {
    setStatus("idle");
    setLines([]);
    setOutputFilePath(null);
    setS3Keys(null);
    setError(null);
  }

  function resetFetchState() {
    setHasFetched(false);
    setFetchedFileCount(0);
    setFetchedIndexFilename(null);
  }

  async function loadDomains(source: "sftp" | "s3") {
    setLoadingDomains(true);
    setError(null);
    setDomains([]);
    setSelectedDomain("");
    try {
      const res = await fetch(`/api/sitemap-cleaner/domains?source=${source}`);
      const data = await readJson(res);
      setDomains(data.domains);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingDomains(false);
    }
  }

  function switchSourceTab(tab: SourceTab) {
    setSourceTab(tab);
    resetFetchState();
    resetRunState();
    if (tab === "sftp" || tab === "s3") loadDomains(tab);
  }

  async function fetchFiles() {
    setError(null);
    setFetchingFiles(true);
    try {
      if (sourceTab === "url") {
        if (!siteUrl.trim()) return;
        const res = await fetch("/api/sitemap-cleaner/from-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ siteUrl: siteUrl.trim() }),
        });
        const data = await readJson(res);
        setFetchedFileCount(data.files.filter((f: { isIndex: boolean }) => !f.isIndex).length);
        setFetchedIndexFilename(data.indexFilename);
        setHasFetched(true);
      } else {
        if (!selectedDomain) return;
        const res = await fetch("/api/sitemap-cleaner/fetch-files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: sourceTab, domain: selectedDomain }),
        });
        const data = await readJson(res);
        setFetchedFileCount(data.files.filter((f: { isIndex: boolean }) => !f.isIndex).length);
        setFetchedIndexFilename(data.indexFilename);
        setHasFetched(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setFetchingFiles(false);
    }
  }

  const canRun =
    status !== "running" &&
    !!domain &&
    (sourceTab === "upload" ? fileCount > 0 : hasFetched);

  async function runUploadFlow(): Promise<{ sessionId: string; totalFiles: number } | null> {
    const files = fileInputRef.current?.files;
    if (!files || files.length === 0) return null;

    const BATCH_SIZE = 20;
    const totalFiles = files.length;
    const totalBatches = Math.ceil(totalFiles / BATCH_SIZE);
    let sessionId: string | null = null;

    for (let b = 0; b < totalBatches; b++) {
      const start = b * BATCH_SIZE;
      const batchFiles = Array.from(files).slice(start, start + BATCH_SIZE);
      setLines((p) => [...p, `[INFO] Parsing & uploading batch ${b + 1}/${totalBatches} (${start + batchFiles.length}/${totalFiles} files)...`]);

      const parsed: { name: string; urls: string[]; isIndex: boolean }[] = [];
      for (const file of batchFiles) {
        const basename = file.name.split(/[/\\]/).pop() || file.name;
        try {
          const text = await file.text();
          const doc = new DOMParser().parseFromString(text, "text/xml");
          const rootTag = (doc.documentElement?.localName || doc.documentElement?.tagName || "").toLowerCase();
          const urls = Array.from(doc.getElementsByTagNameNS("*", "loc"))
            .map((el) => (el.textContent || "").trim())
            .filter(Boolean);
          parsed.push({ name: basename, urls, isIndex: rootTag === "sitemapindex" });
        } catch {
          parsed.push({ name: basename, urls: [], isIndex: false });
        }
      }

      const compressed = await compressJson({ sessionId, batchNum: b, sitemaps: parsed });
      const fd = new FormData();
      fd.append("data", new Blob([compressed], { type: "application/octet-stream" }));
      const res = await fetch("/api/sitemap-cleaner/upload-batch", { method: "POST", body: fd });
      if (!res.ok) throw new Error(`Server rejected batch ${b + 1}: ${res.status}`);
      const data = await res.json();
      sessionId = data.sessionId;
    }

    setLines((p) => [...p, `[INFO] All ${totalFiles} sitemaps uploaded.`]);
    return { sessionId: sessionId!, totalFiles };
  }

  async function runClean() {
    setStatus("running");
    setLines([]);
    setOutputFilePath(null);
    setS3Keys(null);
    setError(null);

    try {
      let sessionId: string | undefined;
      if (sourceTab === "upload") {
        const uploadResult = await runUploadFlow();
        if (!uploadResult) {
          setStatus("error");
          setLines((p) => [...p, "[ERROR] No files selected."]);
          return;
        }
        sessionId = uploadResult.sessionId;
      }

      const res = await fetch("/api/sitemap-cleaner/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: sourceTab, domain, subfolder, output: outputTab, sessionId }),
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "Unknown error");
        setLines((p) => [...p, `[ERROR] ${text}`]);
        setStatus("error");
        return;
      }

      const reader = res.body.getReader();
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
          const raw = part.replace(/^data:\s*/, "").trim();
          if (!raw) continue;
          const evt = JSON.parse(raw);
          if (evt.type === "output") setLines((p) => [...p, evt.line]);
          if (evt.type === "done") {
            exitCode = evt.exitCode ?? -1;
            if (evt.outputFilePath) setOutputFilePath(evt.outputFilePath);
            if (evt.s3Keys) setS3Keys(evt.s3Keys);
          }
        }
      }

      setStatus(exitCode === 0 ? "success" : "error");
    } catch (err) {
      setStatus("error");
      setLines((p) => [...p, `[ERROR] ${err instanceof Error ? err.message : String(err)}`]);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Settings */}
      <div className="rounded-lg border bg-card p-6 shadow-sm space-y-4">
        <div>
          <h3 className="font-semibold">Settings</h3>
          <p className="text-sm text-muted-foreground">Only URLs belonging to this domain are kept.</p>
        </div>

        {sourceTab === "upload" && (
          <div className="space-y-2">
            <Label htmlFor="upload-domain">Website Domain</Label>
            <Input
              id="upload-domain"
              placeholder="https://example.com"
              value={uploadDomain}
              onChange={(e) => setUploadDomain(e.target.value)}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="subfolder">URL subfolder for sitemaps</Label>
          <Input id="subfolder" placeholder="sitemaps" value={subfolder} onChange={(e) => setSubfolder(e.target.value)} />
          <p className="text-xs text-muted-foreground">
            Resulting URL pattern: {(domain || "https://www.domain.com")}/{subfolder || "sitemaps"}/{"{filename}"}.xml
          </p>
        </div>
      </div>

      {/* Source */}
      <div className="rounded-lg border bg-card p-6 shadow-sm space-y-4">
        <div>
          <h3 className="font-semibold">Source</h3>
          <p className="text-sm text-muted-foreground">Choose where the sitemap files come from.</p>
        </div>

        <div className="flex flex-wrap rounded-md border p-1 bg-muted/40 w-fit">
          <TabButton active={sourceTab === "upload"} onClick={() => switchSourceTab("upload")} icon={<Upload className="h-4 w-4" />}>
            Upload
          </TabButton>
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

        {sourceTab === "upload" && (
          <div className="space-y-2">
            <Label htmlFor="sitemap-files">Sitemap XML files</Label>
            <input
              id="sitemap-files"
              ref={fileInputRef}
              type="file"
              accept=".xml"
              multiple
              onChange={(e) => setFileCount(e.target.files?.length ?? 0)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs"
            />
            {fileCount > 0 && <p className="text-sm text-muted-foreground">{fileCount} file(s) selected</p>}
          </div>
        )}

        {(sourceTab === "sftp" || sourceTab === "s3") && (
          <div className="space-y-2">
            <Label htmlFor="domain-select">Domain</Label>
            <select
              id="domain-select"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
              value={selectedDomain}
              onChange={(e) => {
                setSelectedDomain(e.target.value);
                resetFetchState();
              }}
              disabled={loadingDomains || domains.length === 0}
            >
              <option value="">{loadingDomains ? "Loading domains…" : "Select a domain…"}</option>
              {domains.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        )}

        {sourceTab === "url" && (
          <div className="space-y-2">
            <Label htmlFor="site-url">Website</Label>
            <Input
              id="site-url"
              placeholder="https://example.com or example.com"
              value={siteUrl}
              onChange={(e) => {
                setSiteUrl(e.target.value);
                resetFetchState();
              }}
            />
          </div>
        )}

        {sourceTab !== "upload" && (
          <>
            <Button
              onClick={fetchFiles}
              disabled={fetchingFiles || (sourceTab === "url" ? !siteUrl.trim() : !selectedDomain)}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", fetchingFiles && "animate-spin")} />
              {sourceTab === "url" ? "Discover Sitemaps" : "Fetch Files"}
            </Button>
            {hasFetched && (
              <p className="text-sm text-muted-foreground">
                {fetchedFileCount} sitemap file{fetchedFileCount === 1 ? "" : "s"} found
                {fetchedIndexFilename ? <> · index: <span className="font-mono">{fetchedIndexFilename}</span></> : " · no sitemap-index.xml found"}
              </p>
            )}
          </>
        )}
      </div>

      {/* Output */}
      <div className="rounded-lg border bg-card p-6 shadow-sm space-y-4">
        <div>
          <h3 className="font-semibold">Output</h3>
          <p className="text-sm text-muted-foreground">Choose what happens with the cleaned files.</p>
        </div>

        <div className="flex rounded-md border p-1 bg-muted/40 w-fit">
          <TabButton active={outputTab === "zip"} onClick={() => setOutputTab("zip")} icon={<Download className="h-4 w-4" />}>
            Download ZIP
          </TabButton>
          <TabButton active={outputTab === "s3"} onClick={() => setOutputTab("s3")} icon={<Cloud className="h-4 w-4" />}>
            Push to S3
          </TabButton>
        </div>

        <Button onClick={runClean} disabled={!canRun}>
          {status === "running" ? "Cleaning…" : "Clean Sitemaps"}
        </Button>

        {status !== "idle" && <TerminalOutput lines={lines} status={status} />}

        {status === "success" && outputFilePath && (
          <a
            href={`/api/logs/download?path=${encodeURIComponent(outputFilePath)}`}
            download
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <Download className="h-4 w-4" />
            Download {outputTab === "s3" ? "duplicates report" : "cleaned sitemaps ZIP"}
          </a>
        )}

        {status === "success" && s3Keys && s3Keys.length > 0 && (
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Pushed to S3:</p>
            <ul className="mt-1 space-y-0.5 font-mono text-xs">
              {s3Keys.map((k) => (
                <li key={k}>{k}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
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
        "flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {children}
    </button>
  );
}
