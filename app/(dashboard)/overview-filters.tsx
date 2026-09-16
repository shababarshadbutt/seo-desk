"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

function toLocalISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

interface Preset {
  key: string;
  label: string;
  range: () => { from: string; to: string };
}

const PRESETS: Preset[] = [
  {
    key: "today",
    label: "Today",
    range: () => {
      const today = toLocalISODate(new Date());
      return { from: today, to: today };
    },
  },
  {
    key: "yesterday",
    label: "Yesterday",
    range: () => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const y = toLocalISODate(d);
      return { from: y, to: y };
    },
  },
  {
    key: "last7d",
    label: "Last 7d",
    range: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 6);
      return { from: toLocalISODate(start), to: toLocalISODate(end) };
    },
  },
  {
    key: "thisMonth",
    label: "This Month",
    range: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: toLocalISODate(start), to: toLocalISODate(now) };
    },
  },
];

export function OverviewFilters() {
  const router = useRouter();
  const params = useSearchParams();

  const [from, setFrom] = useState(params.get("from") ?? "");
  const [to, setTo] = useState(params.get("to") ?? "");

  function push(nextFrom: string, nextTo: string) {
    const q = new URLSearchParams();
    if (nextFrom) q.set("from", nextFrom);
    if (nextTo) q.set("to", nextTo);
    router.push(`/?${q.toString()}`);
  }

  function apply() {
    push(from, to);
  }

  function applyPreset(preset: Preset) {
    const range = preset.range();
    setFrom(range.from);
    setTo(range.to);
    push(range.from, range.to);
  }

  function reset() {
    setFrom("");
    setTo("");
    router.push("/");
  }

  const currentFrom = params.get("from") ?? "";
  const currentTo = params.get("to") ?? "";
  const isFiltered = !!currentFrom || !!currentTo;
  const activePresetKey = PRESETS.find((p) => {
    const r = p.range();
    return r.from === currentFrom && r.to === currentTo;
  })?.key;

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((preset) => (
          <Button
            key={preset.key}
            type="button"
            size="sm"
            variant={activePresetKey === preset.key ? "default" : "outline"}
            onClick={() => applyPreset(preset)}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">From</Label>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">To</Label>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <Button size="sm" onClick={apply} disabled={!from && !to}>
        Apply
      </Button>
      {isFiltered && (
        <Button size="sm" variant="outline" onClick={reset}>
          Clear
        </Button>
      )}
    </div>
  );
}
