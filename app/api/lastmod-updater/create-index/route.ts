import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, Settings, LastmodDomainCache } from "@/lib/mongodb";
import { buildSitemapIndexXml, GENERATED_INDEX_FILENAME } from "@/lib/lastmod/indexBuild";
import { uploadS3Buffer, s3KeyForDomainFile } from "@/lib/lastmod/s3Client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/lastmod-updater/create-index  { domain: string, source: "sftp"|"s3"|"url" }
// Only called after the user confirms the "no index found — create one?" prompt.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { domain, source } = body ?? {};
  if (!domain || (source !== "sftp" && source !== "s3" && source !== "url")) {
    return Response.json({ error: "domain and source ('sftp'|'s3'|'url') are required" }, { status: 400 });
  }

  await connectDB();
  const settings = await Settings.findOne({ singleton: true }).lean();
  if (!settings?.s3Config?.bucket) {
    return Response.json({ error: "S3 is not configured. Add it in Settings — generated indexes are always pushed to S3." }, { status: 400 });
  }

  const cache = await LastmodDomainCache.findOne({ domain, source });
  if (!cache || cache.files.length === 0) {
    return Response.json({ error: "No files cached for this domain yet — fetch files first." }, { status: 400 });
  }
  if (cache.indexFilename) {
    return Response.json({ error: `This domain already has an index file: ${cache.indexFilename}` }, { status: 400 });
  }

  try {
    const filenames = cache.files.map((f) => f.filename);
    const xml = buildSitemapIndexXml(domain, filenames, settings.s3Config);
    const key = s3KeyForDomainFile(settings.s3Config, domain, GENERATED_INDEX_FILENAME);
    await uploadS3Buffer(settings.s3Config, Buffer.from(xml, "utf-8"), key);

    cache.files.push({ filename: GENERATED_INDEX_FILENAME, loc: key, isIndex: true, sizeBytes: Buffer.byteLength(xml) });
    cache.indexFilename = GENERATED_INDEX_FILENAME;
    await cache.save();

    return Response.json({ indexFilename: GENERATED_INDEX_FILENAME, s3Key: key, fileCount: filenames.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create sitemap-index.xml";
    return Response.json({ error: message }, { status: 502 });
  }
}
