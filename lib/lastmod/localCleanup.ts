import { unlink, stat } from "fs/promises";

// Pattern extraction stays fully streamed straight from SFTP/S3/live URLs,
// never touching local disk (that's what keeps it safe at 100M+ URLs — see
// lib/lastmod/sampling.ts). Rewriting does need a local footprint though: the
// small sitemap-index.xml it downloads/builds/rewrites, plus a temp copy of
// each leaf sitemap file it rewrites (lib/lastmod/leafRewrite.ts) — still
// streamed chunk by chunk rather than buffered in memory, just no longer
// disk-free. This registry tracks those paths per run so the UI can report
// how much space they used and delete them on confirmation.
const registry = new Map<string, Set<string>>();

export function trackLocalPath(runId: string, path: string): void {
  let set = registry.get(runId);
  if (!set) {
    set = new Set();
    registry.set(runId, set);
  }
  set.add(path);
}

export function getTrackedPaths(runId: string): string[] {
  return Array.from(registry.get(runId) ?? []);
}

export async function totalTrackedBytes(runId: string): Promise<number> {
  const paths = getTrackedPaths(runId);
  let total = 0;
  for (const p of paths) {
    try {
      total += (await stat(p)).size;
    } catch {
      // File already gone — nothing to count.
    }
  }
  return total;
}

export async function cleanupTrackedPaths(runId: string): Promise<number> {
  const paths = getTrackedPaths(runId);
  const results = await Promise.allSettled(paths.map((p) => unlink(p)));
  registry.delete(runId);
  return results.filter((r) => r.status === "fulfilled").length;
}

export function discardTracking(runId: string): void {
  registry.delete(runId);
}
