// Ported from Sitemap_Migration/backend/src/jobs/extractPatternsJob.ts — same
// segment-position classification thresholds, applied here to small streamed
// per-file URL samples (never the full 100M-URL set) to group sitemap files
// into "verticals" for the Lastmod Updater's Vertical-wise scope.

const PARAM_SEGMENT_UNIQUE_THRESHOLD = 100;
const PARAM_SEGMENT_UNIQUE_RATIO_THRESHOLD = 0.6;
const PARAM_SEGMENT_MIN_OBSERVED_URLS = 3;
const MAX_SAMPLE_URLS_PER_VERTICAL = 20;

export interface FileUrlSample {
  filename: string;
  urls: string[];
}

export interface VerticalGroup {
  template: string;
  fileCount: number;
  totalSampledUrls: number;
  sampleUrls: string[];
  filenames: string[];
}

interface PositionStats {
  distinctValues: Set<string>;
  observedCount: number;
}

function splitPath(url: string): string[] {
  try {
    return new URL(url).pathname.split("/").filter(Boolean);
  } catch {
    return [];
  }
}

function classifyParamPositions(allSegments: string[][]): Set<number> {
  const positionStats = new Map<number, PositionStats>();

  for (const segments of allSegments) {
    segments.forEach((seg, i) => {
      let stats = positionStats.get(i);
      if (!stats) {
        stats = { distinctValues: new Set(), observedCount: 0 };
        positionStats.set(i, stats);
      }
      stats.distinctValues.add(seg);
      stats.observedCount++;
    });
  }

  const paramPositions = new Set<number>();
  positionStats.forEach((stats, pos) => {
    const unique = stats.distinctValues.size;
    const ratio = stats.observedCount > 0 ? unique / stats.observedCount : 0;
    const isParam =
      unique > PARAM_SEGMENT_UNIQUE_THRESHOLD ||
      (stats.observedCount >= PARAM_SEGMENT_MIN_OBSERVED_URLS && ratio >= PARAM_SEGMENT_UNIQUE_RATIO_THRESHOLD);
    if (isParam) paramPositions.add(pos);
  });
  return paramPositions;
}

function templateForPath(segments: string[], paramPositions: Set<number>): string {
  if (segments.length === 0) return "/";
  return "/" + segments.map((seg, i) => (paramPositions.has(i) ? "{param}" : seg)).join("/");
}

// Groups sampled URLs (and the files they came from) by detected path
// template. Every group keeps only a small bounded sample of example URLs —
// never the full per-template URL set — matching the reservoir-style memory
// discipline of the reference tool's pattern extraction.
export function extractVerticals(fileSamples: FileUrlSample[]): VerticalGroup[] {
  const allEntries: { filename: string; url: string; segments: string[] }[] = [];
  for (const file of fileSamples) {
    for (const url of file.urls) {
      allEntries.push({ filename: file.filename, url, segments: splitPath(url) });
    }
  }
  if (allEntries.length === 0) return [];

  const paramPositions = classifyParamPositions(allEntries.map((e) => e.segments));

  const groups = new Map<string, VerticalGroup>();
  const fileSets = new Map<string, Set<string>>();
  for (const entry of allEntries) {
    const template = templateForPath(entry.segments, paramPositions);
    let group = groups.get(template);
    let fileSet = fileSets.get(template);
    if (!group || !fileSet) {
      group = { template, fileCount: 0, totalSampledUrls: 0, sampleUrls: [], filenames: [] };
      fileSet = new Set();
      groups.set(template, group);
      fileSets.set(template, fileSet);
    }
    group.totalSampledUrls++;
    if (group.sampleUrls.length < MAX_SAMPLE_URLS_PER_VERTICAL) group.sampleUrls.push(entry.url);
    if (!fileSet.has(entry.filename)) {
      fileSet.add(entry.filename);
      group.filenames.push(entry.filename);
      group.fileCount++;
    }
  }

  return Array.from(groups.values()).sort((a, b) => b.fileCount - a.fileCount);
}
