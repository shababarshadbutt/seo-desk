import { unlink, stat } from "fs/promises";

// Pattern extraction and index rewriting in this feature stream directly from
// SFTP/S3/live URLs rather than downloading whole sitemap files to disk
// first (that's what keeps it safe at 100M+ URLs — see lib/lastmod/sampling.ts).
// The only local footprint a run creates is the small sitemap-index.xml it
// downloads/builds/rewrites. This registry tracks those paths per run so the
// UI can report how much space they used and delete them on confirmation.
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
