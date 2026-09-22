import os from "os";
import path from "path";
import { Piscina } from "piscina";
import parseSitemapBuffer, { type ParseSitemapInput, type SitemapStreamResult } from "./parseWorker";

const isDev = process.env.NODE_ENV !== "production";

// In dev, Piscina loads the worker's TS source directly via tsx (registered
// through execArgv, same as the reference implementation this was adapted
// from). In prod it loads the pre-compiled output from `npm run build:worker`
// — Next's own bundler doesn't produce a Piscina-loadable worker entrypoint,
// so this file needs its own small tsc build step (see tsconfig.worker.json).
function workerFilePath(): string {
  return isDev
    ? path.join(process.cwd(), "lib", "sitemapCleaner", "parseWorker.ts")
    : path.join(process.cwd(), "dist-workers", "sitemapCleaner", "parseWorker.js");
}

// One worker per 200 files (1 for <=200, 2 for 201-400, 3 for 401-600, ...),
// capped at the number of CPU cores so a very large domain can't over-subscribe
// the Node process that's also serving other concurrent requests.
export function resolveWorkerCount(fileCount: number): number {
  const scaled = Math.ceil(fileCount / 200);
  return Math.max(1, Math.min(scaled, os.cpus().length));
}

// Returns null (rather than throwing) if the pool itself can't be
// constructed, so a caller can fall back to in-process parsing entirely
// instead of losing the whole run to an environment that can't spawn
// worker_threads at all (seen in some restricted/constrained containers).
export function createParsePool(fileCount: number): Piscina | null {
  try {
    return new Piscina({
      filename: workerFilePath(),
      minThreads: 1,
      maxThreads: resolveWorkerCount(fileCount),
      idleTimeout: 30_000,
      execArgv: isDev ? ["--import", "tsx"] : [],
    });
  } catch {
    return null;
  }
}

const WORKER_TASK_TIMEOUT_MS = 15_000;

// Parses via the worker pool, but never lets a stuck/unavailable pool stall
// the caller indefinitely — a hung or crashed worker (or a pool that failed
// to construct at all) falls back to parsing in-process instead. This is
// what keeps one slow file from turning into a multi-minute silent gap that
// an idle-timeout proxy in front of the app would otherwise kill the whole
// SSE connection over.
export async function parseWithFallback(pool: Piscina | null, input: ParseSitemapInput): Promise<SitemapStreamResult> {
  if (pool) {
    try {
      return await new Promise<SitemapStreamResult>((resolvePromise, reject) => {
        const timer = setTimeout(() => reject(new Error("worker parse timed out")), WORKER_TASK_TIMEOUT_MS);
        pool.run(input).then(
          (v) => { clearTimeout(timer); resolvePromise(v); },
          (e) => { clearTimeout(timer); reject(e); }
        );
      });
    } catch {
      // Fall through to in-process parsing below.
    }
  }
  return parseSitemapBuffer(input);
}
