import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, Settings, LastmodDomainCache } from "@/lib/mongodb";
import { sampleUrlsForFiles } from "@/lib/lastmod/sampling";
import { extractVerticals } from "@/lib/lastmod/patternExtract";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

// POST /api/lastmod-updater/verticals  { domain: string, source: "sftp"|"s3"|"url", force?: boolean }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { domain, source, force } = body ?? {};
  if (!domain || (source !== "sftp" && source !== "s3" && source !== "url")) {
    return Response.json({ error: "domain and source ('sftp'|'s3'|'url') are required" }, { status: 400 });
  }

  await connectDB();
  const cache = await LastmodDomainCache.findOne({ domain, source });
  if (!cache) {
    return Response.json({ error: "No files cached for this domain yet — fetch files first." }, { status: 400 });
  }

  if (!force && cache.verticalsComputedAt && cache.verticals.length > 0) {
    return Response.json({ verticals: cache.verticals, cached: true });
  }

  const leafFiles = cache.files.filter((f) => !f.isIndex);
  if (leafFiles.length === 0) {
    return Response.json({ verticals: [], cached: false });
  }

  try {
    const settings = await Settings.findOne({ singleton: true }).lean();
    if (source === "sftp" && !settings?.sftpConfig?.host) {
      return Response.json({ error: "SFTP is not configured. Add it in Settings first." }, { status: 400 });
    }
    if (source === "s3" && !settings?.s3Config?.bucket) {
      return Response.json({ error: "S3 is not configured. Add it in Settings first." }, { status: 400 });
    }

    const samples = await sampleUrlsForFiles(
      source,
      leafFiles,
      source === "sftp" ? settings!.sftpConfig : null,
      source === "s3" ? settings!.s3Config : null
    );
    const verticals = extractVerticals(samples);

    cache.verticals = verticals;
    cache.verticalsComputedAt = new Date();
    await cache.save();

    return Response.json({ verticals, cached: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to detect verticals";
    return Response.json({ error: message }, { status: 502 });
  }
}
