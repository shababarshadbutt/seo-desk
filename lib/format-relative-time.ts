// Shared across screens that show a "last updated" freshness label
// (Websites, Weekly Reports) — was previously duplicated as a local,
// unexported function.
export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  // Explicit locale — server and client can otherwise disagree on the
  // default locale (e.g. en-GB vs en-US), causing a hydration mismatch.
  return new Date(iso).toLocaleDateString("en-GB");
}
