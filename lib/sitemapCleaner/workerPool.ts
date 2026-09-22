import os from "os";
import path from "path";
import { Piscina } from "piscina";

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

export function createParsePool(fileCount: number): Piscina {
  return new Piscina({
    filename: workerFilePath(),
    minThreads: 1,
    maxThreads: resolveWorkerCount(fileCount),
    idleTimeout: 30_000,
    execArgv: isDev ? ["--import", "tsx"] : [],
  });
}
