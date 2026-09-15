import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, LastmodDomainCache } from "@/lib/mongodb";
import { discoverSitemapFiles } from "@/lib/lastmod/liveUrlDiscovery";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

function normalizeDomain(siteUrl: string): string {
  const withScheme = /^https?:\/\//i.test(siteUrl) ? siteUrl : `https://${siteUrl}`;
  return new URL(withScheme).hostname;
}

// POST /api/sitemap-cleaner/from-url  { siteUrl: string }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const siteUrl = (body?.siteUrl as string | undefined)?.trim();
  if (!siteUrl) return Response.json({ error: "siteUrl is required" }, { status: 400 });

  let domain: string;
  try {
    domain = normalizeDomain(siteUrl);
  } catch {
    return Response.json({ error: `"${siteUrl}" is not a valid URL or domain.` }, { status: 400 });
  }

  try {
    const { files, indexFilename } = await discoverSitemapFiles(siteUrl);

    await connectDB();
    await LastmodDomainCache.findOneAndUpdate(
      { domain, source: "url" },
      {
        $set: {
          files,
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
      source: "url",
      files,
      indexFilename,
      indexMissing: indexFilename === null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to discover sitemaps for this site";
    return Response.json({ error: message }, { status: 502 });
  }
}
