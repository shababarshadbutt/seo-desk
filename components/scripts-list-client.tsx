"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { scripts } from "@/lib/scripts-config";
import { scriptCategories, getCategoryForSlug, type ScriptCategory } from "@/lib/script-categories";
import { ScriptCard } from "@/components/script-card";
import { cn } from "@/lib/utils";

// Imports the static scripts list directly (client-side) rather than receiving it
// as a prop from the server page — ScriptConfig.icon is a component reference
// (LucideIcon), which can't be serialized across the Server → Client Component
// boundary as a plain prop.
export function ScriptsListClient() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ScriptCategory | "All">("All");

  const filtered = scripts.filter((s) => {
    const matchesCategory = category === "All" || getCategoryForSlug(s.slug) === category;
    const q = query.trim().toLowerCase();
    const matchesQuery = !q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
    return matchesCategory && matchesQuery;
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
            placeholder="Search scripts…"
            className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(["All", ...scriptCategories] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
                category === c
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">No scripts match your search.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((script) => (
            <ScriptCard key={script.slug} script={script} />
          ))}
        </div>
      )}
    </div>
  );
}
