import { avatarColor, initials } from "@/lib/avatar";
import { cn } from "@/lib/utils";

// Tailwind needs full class strings statically present in source to generate
// them — can't interpolate `bg-${color}-500/10` at runtime. This is the 4th
// occurrence of this exact map (Indexing Queue, Website Audit, Weekly
// Reports, Websites), so it's now a shared component per the design-system
// rule: reusable visual patterns shouldn't be copy/pasted across screens.
const COLOR_CLASSES: Record<string, string> = {
  rose:    "bg-rose-500/10 text-rose-700 dark:text-rose-400",
  sky:     "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  amber:   "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  emerald: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  violet:  "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  cyan:    "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
  orange:  "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  indigo:  "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
};

const SIZE_CLASSES = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
} as const;

export function AvatarChip({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg font-semibold",
        SIZE_CLASSES[size],
        COLOR_CLASSES[avatarColor(name)],
        className
      )}
    >
      {initials(name)}
    </span>
  );
}
