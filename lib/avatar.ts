// Deterministic per-name avatar accent color + initials — purely cosmetic,
// derived from a real name, so it needs no placeholder flag. Originally lived
// in lib/indexing-queue-fake-stats.ts (which re-exports these for backwards
// compatibility); pulled out here since the pattern now repeats across
// Indexing Queue, Website Audit, Weekly Reports, and Websites — see
// components/ui/avatar-chip.tsx for the shared rendering.

function hashString(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return Math.abs(hash);
}

export const AVATAR_COLORS = ["rose", "sky", "amber", "emerald", "violet", "cyan", "orange", "indigo"] as const;
export type AvatarColor = (typeof AVATAR_COLORS)[number];

export function avatarColor(name: string): AvatarColor {
  return AVATAR_COLORS[hashString(name) % AVATAR_COLORS.length];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
