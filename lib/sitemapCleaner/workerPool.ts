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

function tryCreatePool(fileCount: number): Piscina | null {
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
// If the pool fails/hangs this many times in a row, stop trying it for the
// rest of the run — an environment where worker_threads can't actually spawn
// (seen in some restricted/constrained containers) would otherwise make
// every single file pay the full timeout before falling back, and that
// compounding delay is exactly what trips a reverse proxy's idle timeout
// (e.g. nginx's default 60s proxy_read_timeout) even though each individual
// file does eventually complete.
const FAILURE_THRESHOLD = 3;

export interface SitemapParser {
  parse(input: ParseSitemapInput): Promise<SitemapStreamResult>;
  destroy(): Promise<void>;
}

// A stateful wrapper around the worker pool for a single run. Parses via the
// pool but never lets a stuck/unavailable worker stall the caller
// indefinitely — a hung or crashed task (or a pool that failed to construct
// at all) falls back to parsing in-process. After a few consecutive
// failures it stops trying the pool altogether for the remainder of this
// run, since a pool that's reliably failing will fail the same way on every
// subsequent file too.
export function createSitemapParser(fileCount: number, onPoolAbandoned?: () => void): SitemapParser {
  let pool: Piscina | null = tryCreatePool(fileCount);
  let consecutiveFailures = 0;

  async function parse(input: ParseSitemapInput): Promise<SitemapStreamResult> {
    if (pool) {
      const activePool = pool;
      try {
        const result = await new Promise<SitemapStreamResult>((resolvePromise, reject) => {
          const timer = setTimeout(() => reject(new Error("worker parse timed out")), WORKER_TASK_TIMEOUT_MS);
          activePool.run(input).then(
            (v) => { clearTimeout(timer); resolvePromise(v); },
            (e) => { clearTimeout(timer); reject(e); }
          );
        });
        consecutiveFailures = 0;
        return result;
      } catch {
        consecutiveFailures++;
        if (consecutiveFailures >= FAILURE_THRESHOLD && pool === activePool) {
          pool = null;
          activePool.destroy().catch(() => {});
          onPoolAbandoned?.();
        }
        // Fall through to in-process parsing below.
      }
    }
    return parseSitemapBuffer(input);
  }

  async function destroy(): Promise<void> {
    if (pool) await pool.destroy().catch(() => {});
  }

  return { parse, destroy };
}
