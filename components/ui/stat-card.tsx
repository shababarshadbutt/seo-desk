import type { ElementType, ReactNode } from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatCardColor = "primary" | "emerald" | "amber" | "rose" | "orange" | "sky";

const COLOR_CLASSES: Record<StatCardColor, string> = {
  primary: "bg-primary/10 text-primary",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  amber:   "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  rose:    "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  orange:  "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  sky:     "bg-sky-500/10 text-sky-600 dark:text-sky-400",
};

const BREAKDOWN_TONE_CLASSES: Record<"primary" | "emerald" | "amber" | "rose" | "muted", string> = {
  primary: "text-primary",
  emerald: "text-emerald-600 dark:text-emerald-400",
  amber:   "text-amber-600 dark:text-amber-400",
  rose:    "text-rose-600 dark:text-rose-400",
  muted:   "text-muted-foreground",
};

export interface StatCardDelta {
  /** Percent change vs. prior period. null means "not enough history" — render as "—", never fabricate. */
  pct: number | null;
  caption?: string;
}

export interface StatCardBreakdownItem {
  label: string;
  value: number;
  tone?: keyof typeof BREAKDOWN_TONE_CLASSES;
}

export function StatCard({
  icon: Icon,
  label,
  value,
  color,
  delta,
  breakdown,
  caption,
  valueSuffix,
  badge,
  loading,
}: {
  icon: ElementType;
  label: string;
  value: number;
  color: StatCardColor;
  delta?: StatCardDelta;
  breakdown?: StatCardBreakdownItem[];
  caption?: ReactNode;
  /** Rendered right after the value, e.g. "/ 100". */
  valueSuffix?: string;
  /** Rendered at the end of the value row, e.g. a status Badge. */
  badge?: ReactNode;
  /** Shows a skeleton in place of the value — for data that loads after first paint. */
  loading?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <div className={cn("rounded-lg p-1.5 shrink-0", COLOR_CLASSES[color])}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>

      <div className="flex items-baseline gap-2">
        {loading ? (
          <span className="h-7 w-16 animate-pulse rounded bg-muted" />
        ) : (
          <p className="text-2xl font-bold text-foreground leading-none">{value.toLocaleString()}</p>
        )}
        {!loading && valueSuffix && <span className="text-xs font-medium text-muted-foreground">{valueSuffix}</span>}
        {!loading && badge && <span className="ml-auto">{badge}</span>}
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-medium",
              delta.pct == null
                ? "text-muted-foreground"
                : delta.pct > 0
                ? "text-emerald-600 dark:text-emerald-400"
                : delta.pct < 0
                ? "text-rose-600 dark:text-rose-400"
                : "text-muted-foreground"
            )}
          >
            {delta.pct == null ? (
              "—"
            ) : (
              <>
                {delta.pct > 0 ? (
                  <ArrowUp className="h-3 w-3" />
                ) : delta.pct < 0 ? (
                  <ArrowDown className="h-3 w-3" />
                ) : (
                  <Minus className="h-3 w-3" />
                )}
                {Math.abs(delta.pct)}%
              </>
            )}
          </span>
        )}
      </div>

      {delta?.caption && <p className="text-xs text-muted-foreground">{delta.caption}</p>}
      {caption && <p className="text-xs text-muted-foreground">{caption}</p>}

      {breakdown && breakdown.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 text-xs">
          {breakdown.map((item) => (
            <span key={item.label} className={cn("font-medium", BREAKDOWN_TONE_CLASSES[item.tone ?? "muted"])}>
              {item.value.toLocaleString()} {item.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
