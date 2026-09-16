"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScriptRunner } from "@/components/script-runner";
import { scripts, type ScriptConfig } from "@/lib/scripts-config";

// Scripts most relevant to a quick health check of the automation pipeline —
// diagnostics mode narrows the picker to these rather than the full catalog.
const DIAGNOSTIC_SLUGS = ["indexing-checker", "sitemap-url-extractor"];

export function QuickAutomationDialog({
  open,
  onOpenChange,
  mode = "all",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "all" | "diagnostics";
}) {
  const [selected, setSelected] = useState<ScriptConfig | null>(null);

  const available = mode === "diagnostics" ? scripts.filter((s) => DIAGNOSTIC_SLUGS.includes(s.slug)) : scripts;

  function handleOpenChange(next: boolean) {
    if (!next) setSelected(null);
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {selected ? selected.name : mode === "diagnostics" ? "Run Core Diagnostics" : "Quick Automation"}
          </DialogTitle>
          <DialogDescription>
            {selected
              ? selected.description
              : mode === "diagnostics"
              ? "Pick a diagnostic script to run against a website — same engine that powers the Scripts page."
              : "Pick a script to run right away — same engine that powers the Scripts page."}
          </DialogDescription>
        </DialogHeader>

        {!selected ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {available.map((script) => {
              const Icon = script.icon;
              return (
                <button
                  key={script.slug}
                  onClick={() => setSelected(script)}
                  className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-muted/40"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{script.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{script.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to scripts
              </Button>
              <Link
                href={`/scripts/${selected.slug}`}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Open full page
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
            <ScriptRunner slug={selected.slug} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
