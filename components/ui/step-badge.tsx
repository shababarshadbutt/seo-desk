import { cn } from "@/lib/utils";

export type StepBadgeState = "complete" | "current" | "upcoming";

export function StepBadge({
  step,
  state = "current",
  className,
}: {
  step: number;
  state?: StepBadgeState;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
        state === "complete" && "border-transparent bg-primary text-primary-foreground",
        state === "current" && "border-primary/30 bg-primary/10 text-primary",
        state === "upcoming" && "border-border bg-muted/40 text-muted-foreground",
        className
      )}
    >
      {step}
    </span>
  );
}
