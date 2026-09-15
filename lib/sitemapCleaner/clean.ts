export interface CleanItem {
  name: string;
  urls: string[];
  isIndex: boolean;
}

export interface DroppedFile {
  name: string;
  reason: "empty" | "wrong_domain";
}

export interface DuplicateRow {
  url: string;
  count: number;
  sitemaps: string[];
}

export interface CleanResult {
  outputFiles: { name: string; urls: string[] }[];
  droppedFiles: DroppedFile[];
  duplicates: DuplicateRow[];
  indexFilesDetected: number;
  totalUrlsKept: number;
  totalUrlsRemoved: number;
}

export function normalizeHost(hostname: string): string {
  const host = hostname.toLowerCase();
  return host.startsWith("www.") ? host.slice(4) : host;
}

export function isSameDomain(detectedHost: string, expectedHost: string): boolean {
  if (!detectedHost || !expectedHost) return false;
  const detected = normalizeHost(detectedHost);
  const expected = normalizeHost(expectedHost);
  return detected === expected || detected.endsWith(`.${expected}`);
}

function urlHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

// Parses a hostname out of a domain input, tolerating a missing scheme
// (e.g. "example.com" as well as "https://example.com/").
export function parseDomainHost(domain: string): string {
  const trimmed = domain.trim();
  try {
    return new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`).hostname;
  } catch {
    return "";
  }
}

// Canonical form for cross-file dedup: lowercase scheme+host, drop query and
// fragment, strip one trailing slash. Path case is preserved.
export function normalizeForDedup(url: string): string {
  try {
    const parsed = new URL(url);
    let path = parsed.pathname;
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    return `${parsed.protocol.toLowerCase()}//${parsed.host.toLowerCase()}${path}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

export function cleanSitemaps(items: CleanItem[], expectedHost: string): CleanResult {
  const indexItems = items.filter((i) => i.isIndex);
  const contentItems = items.filter((i) => !i.isIndex);

  // ── Pass 1: drop files that mostly belong to another domain ────────────────
  const droppedFiles: DroppedFile[] = [];
  const keptFiles: { name: string; urls: string[] }[] = [];

  for (const { name, urls } of contentItems) {
    const total = urls.length;
    if (total === 0) {
      droppedFiles.push({ name, reason: "empty" });
      continue;
    }
    const onDomain = urls.filter((u) => isSameDomain(urlHost(u), expectedHost));
    if (onDomain.length / total < 0.5) {
      droppedFiles.push({ name, reason: "wrong_domain" });
      continue;
    }
    keptFiles.push({ name, urls: onDomain });
  }

  // ── Build duplicate map (for the report) across all on-domain URLs ─────────
  const urlMap = new Map<string, Set<string>>();
  const rawForKey = new Map<string, string>();
  for (const { name, urls } of keptFiles) {
    for (const url of urls) {
      const key = normalizeForDedup(url);
      if (!urlMap.has(key)) urlMap.set(key, new Set());
      urlMap.get(key)!.add(name);
      if (!rawForKey.has(key)) rawForKey.set(key, url);
    }
  }

  const duplicates: DuplicateRow[] = [];
  urlMap.forEach((names, key) => {
    if (names.size > 1) {
      const sitemaps: string[] = [];
      names.forEach((name) => sitemaps.push(name));
      duplicates.push({ url: rawForKey.get(key)!, count: names.size, sitemaps: sitemaps.sort() });
    }
  });

  // ── Clean each file: first occurrence (by normalized key) wins ─────────────
  const seen = new Set<string>();
  let totalUrlsKept = 0;
  let totalUrlsRemoved = 0;
  const outputFiles: { name: string; urls: string[] }[] = [];

  for (const { name, urls } of keptFiles) {
    const kept: string[] = [];
    let removed = 0;
    for (const url of urls) {
      const key = normalizeForDedup(url);
      if (seen.has(key)) {
        removed += 1;
        continue;
      }
      seen.add(key);
      kept.push(url);
    }

    totalUrlsKept += kept.length;
    totalUrlsRemoved += removed;

    if (kept.length > 0) {
      outputFiles.push({ name, urls: kept });
    } else {
      droppedFiles.push({ name, reason: "empty" });
    }
  }

  return {
    outputFiles,
    droppedFiles,
    duplicates,
    indexFilesDetected: indexItems.length,
    totalUrlsKept,
    totalUrlsRemoved,
  };
}
