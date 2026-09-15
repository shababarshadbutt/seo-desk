import SftpClient from "ssh2-sftp-client";
import type { Readable } from "stream";
import type { ISftpConfig } from "@/lib/mongodb";

// Bounded-concurrency guard so we never open more SFTP sessions to one host
// than the server allows — mirrors the fair-FIFO semaphore pattern used by
// the reference Sitemap_Migration tool's sftpClient.ts.
class Semaphore {
  private active = 0;
  private queue: (() => void)[] = [];

  constructor(private readonly max: number) {}

  async acquire(): Promise<() => void> {
    if (this.active < this.max) {
      this.active++;
      return () => this.release();
    }
    return new Promise((resolve) => {
      this.queue.push(() => {
        this.active++;
        resolve(() => this.release());
      });
    });
  }

  private release() {
    this.active--;
    const next = this.queue.shift();
    if (next) next();
  }
}

const semaphores = new Map<string, Semaphore>();
function getSemaphore(cfg: ISftpConfig): Semaphore {
  const key = `${cfg.host}:${cfg.port}`;
  let sem = semaphores.get(key);
  if (!sem) {
    sem = new Semaphore(Math.max(1, cfg.maxConcurrentConnections || 4));
    semaphores.set(key, sem);
  }
  return sem;
}

export function assertSafeDomain(domain: string) {
  if (!domain || domain.includes("/") || domain.includes("\\") || domain.includes("..")) {
    throw new Error(`Unsafe domain name: "${domain}"`);
  }
}

function joinRemote(...parts: string[]): string {
  const joined = parts
    .map((p) => p.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
  return `/${joined}`;
}

const CONNECT_TIMEOUT_MS = 30_000;
const OPERATION_TIMEOUT_MS = 120_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`SFTP ${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

function connectOptions(cfg: ISftpConfig): SftpClient.ConnectOptions {
  const opts: SftpClient.ConnectOptions = {
    host: cfg.host,
    port: cfg.port || 22,
    username: cfg.username,
  };
  if (cfg.privateKey) opts.privateKey = cfg.privateKey;
  else opts.password = cfg.password;
  return opts;
}

async function withSftp<T>(cfg: ISftpConfig, fn: (client: SftpClient) => Promise<T>): Promise<T> {
  const sem = getSemaphore(cfg);
  const release = await sem.acquire();
  const client = new SftpClient();
  try {
    await withTimeout(client.connect(connectOptions(cfg)), CONNECT_TIMEOUT_MS, "connect");
    return await withTimeout(fn(client), OPERATION_TIMEOUT_MS, "operation");
  } finally {
    try { await client.end(); } catch { /* connection already dead — nothing to clean up */ }
    release();
  }
}

export async function listSftpDomains(cfg: ISftpConfig): Promise<string[]> {
  return withSftp(cfg, async (client) => {
    const entries = await client.list(cfg.basePath || "/");
    return entries.filter((e) => e.type === "d").map((e) => e.name).sort();
  });
}

export interface SftpSitemapFile {
  filename: string;
  loc: string;
  sizeBytes: number;
}

export async function listSftpSitemapFiles(cfg: ISftpConfig, domain: string): Promise<SftpSitemapFile[]> {
  assertSafeDomain(domain);
  const remoteDir = joinRemote(cfg.basePath, domain);
  return withSftp(cfg, async (client) => {
    const entries = await client.list(remoteDir);
    return entries
      .filter((e) => e.type === "-" && /\.xml(\.gz)?$/i.test(e.name))
      .map((e) => ({ filename: e.name, loc: joinRemote(remoteDir, e.name), sizeBytes: e.size }));
  });
}

// Opens a live read stream for a remote file without buffering it locally —
// caller is responsible for calling close() once done reading.
export async function openSftpReadStream(
  cfg: ISftpConfig,
  remotePath: string
): Promise<{ stream: Readable; close: () => Promise<void> }> {
  const sem = getSemaphore(cfg);
  const release = await sem.acquire();
  const client = new SftpClient();
  await withTimeout(client.connect(connectOptions(cfg)), CONNECT_TIMEOUT_MS, "connect");
  const stream = client.createReadStream(remotePath);
  const close = async () => {
    try { await client.end(); } catch { /* connection already dead — nothing to clean up */ }
    release();
  };
  return { stream, close };
}

// Streams straight to local disk — never buffers the whole file in the Node heap.
export async function downloadSftpFile(cfg: ISftpConfig, remotePath: string, localPath: string): Promise<void> {
  await withSftp(cfg, (client) => client.fastGet(remotePath, localPath));
}

export async function uploadSftpFile(cfg: ISftpConfig, localPath: string, remotePath: string): Promise<void> {
  await withSftp(cfg, (client) => client.fastPut(localPath, remotePath));
}
