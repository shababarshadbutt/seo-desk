import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, Settings, LastmodDomainCache } from "@/lib/mongodb";
import { listSftpSitemapFiles } from "@/lib/lastmod/sftpClient";
import { listS3SitemapObjects } from "@/lib/lastmod/s3Client";
import { detectIndexFile } from "@/lib/lastmod/indexDetect";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST /api/lastmod-updater/fetch-files  { source: "sftp"|"s3", domain: string }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const source = body?.source;
  const domain = (body?.domain as string | undefined)?.trim();

  if ((source !== "sftp" && source !== "s3") || !domain) {
    return Response.json({ error: "source ('sftp'|'s3') and domain are required" }, { status: 400 });
  }

  await connectDB();
  const settings = await Settings.findOne({ singleton: true }).lean();

  if (source === "sftp" && !settings?.sftpConfig?.host) {
    return Response.json({ error: "SFTP is not configured. Add it in Settings first." }, { status: 400 });
  }
  if (source === "s3" && !settings?.s3Config?.bucket) {
    return Response.json({ error: "S3 is not configured. Add it in Settings first." }, { status: 400 });
  }

  try {
    const rawFiles =
      source === "sftp"
        ? await listSftpSitemapFiles(settings!.sftpConfig, domain)
        : await listS3SitemapObjects(settings!.s3Config, domain);

    if (rawFiles.length === 0) {
      return Response.json({ error: `No .xml sitemap files found for domain "${domain}".` }, { status: 404 });
    }

    const files = rawFiles.map((f) => ({ ...f, isIndex: false }));
    const { indexFilename, files: annotatedFiles } = await detectIndexFile(
      source,
      files,
      source === "sftp" ? settings!.sftpConfig : null,
      source === "s3" ? settings!.s3Config : null
    );

    await LastmodDomainCache.findOneAndUpdate(
      { domain, source },
      {
        $set: {
          files: annotatedFiles,
          indexFilename,
          fetchedAt: new Date(),
          verticals: [],
          verticalsComputedAt: null,
        },
      },
      { upsert: true }
    );

    return Response.json({
      domain,
      source,
      files: annotatedFiles,
      indexFilename,
      indexMissing: indexFilename === null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch files";
    return Response.json({ error: message }, { status: 502 });
  }
}
