"use client";

// PLACEHOLDER DATA, not real. Neither the Lastmod Updater nor the Sitemap
// Cleaner run persists any history today (their /run routes never write to
// ExecutionLog or any other collection) — this ships the dialog shell with a
// small disclosed sample list, ready to be wired to a real query once run
// history is actually recorded. See docs/design/screens/lastmode.md and
// sitemap-cleaner.md.
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface SampleRun {
  domain: string;
  date: string;
  status: "success" | "error";
  detail: string;
}

const SAMPLE_RUNS: SampleRun[] = [
  { domain: "growthmarketing.io", date: "2026-09-14", status: "success", detail: "12 sitemaps updated, pushed to S3" },
  { domain: "aerohardwaresupply.com", date: "2026-09-13", status: "success", detail: "4 sitemaps updated, pushed to S3" },
  { domain: "nsndelivery.com", date: "2026-09-12", status: "error", detail: "SFTP connection timed out" },
  { domain: "rapidindustrials.com", date: "2026-09-11", status: "success", detail: "7 sitemaps updated, pushed to S3" },
  { domain: "cargodirectory.co", date: "2026-09-10", status: "success", detail: "1 sitemap updated, pushed to S3" },
  { domain: "bizforgeusa.com", date: "2026-09-09", status: "error", detail: "No sitemap-index.xml found" },
];

export function AuditHistoryDialog({
  open, onOpenChange, toolLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toolLabel: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Audit History — {toolLabel}</DialogTitle>
          <DialogDescription>
            Sample data — live run history will appear here once runs are recorded.
          </DialogDescription>
        </DialogHeader>
        <div
          className="max-h-80 overflow-y-auto rounded-lg border border-border divide-y divide-border"
          title="Placeholder — not backed by real run-history data yet"
        >
          {SAMPLE_RUNS.map((row) => (
            <div key={row.domain} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="font-medium truncate">{row.domain}</p>
                <p className="text-xs text-muted-foreground truncate">{row.detail}</p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={cn(
                  "text-xs font-medium",
                  row.status === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                )}>
                  {row.status === "success" ? "Success" : "Error"}
                </span>
                <span className="text-xs text-muted-foreground">{row.date}</span>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
