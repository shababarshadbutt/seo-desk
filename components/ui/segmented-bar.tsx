import { cn } from "@/lib/utils";

export type SegmentColor = "primary" | "emerald" | "amber" | "rose" | "muted";

const SEGMENT_CLASSES: Record<SegmentColor, string> = {
  primary: "bg-primary",
  emerald: "bg-emerald-500",
  amber:   "bg-amber-500",
  rose:    "bg-rose-500",
  muted:   "bg-muted-foreground/30",
};

export interface Segment {
  value: number;
  color: SegmentColor;
  label?: string;
}

export function SegmentedBar({
  segments,
  size = "md",
}: {
  segments: Segment[];
  size?: "sm" | "md";
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <div
      className={cn(
        "flex w-full overflow-hidden rounded-full bg-muted",
        size === "sm" ? "h-1.5" : "h-2.5"
      )}
    >
      {total > 0 &&
        segments
          .filter((s) => s.value > 0)
          .map((s, i) => (
            <div
              key={`${s.label ?? i}`}
              className={SEGMENT_CLASSES[s.color]}
              style={{ width: `${(s.value / total) * 100}%` }}
              title={s.label ? `${s.label}: ${s.value.toLocaleString()}` : undefined}
            />
          ))}
    </div>
  );
}
