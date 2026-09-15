import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, Settings } from "@/lib/mongodb";
import { listSftpDomains } from "@/lib/lastmod/sftpClient";
import { listS3Domains } from "@/lib/lastmod/s3Client";

export const dynamic = "force-dynamic";

// GET /api/sitemap-cleaner/domains?source=sftp|s3
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const source = new URL(req.url).searchParams.get("source");
  if (source !== "sftp" && source !== "s3") {
    return Response.json({ error: "source must be 'sftp' or 's3'" }, { status: 400 });
  }

  await connectDB();
  const settings = await Settings.findOne({ singleton: true }).lean();

  try {
    if (source === "sftp") {
      if (!settings?.sftpConfig?.host) {
        return Response.json({ error: "SFTP is not configured. Add it in Settings first." }, { status: 400 });
      }
      const domains = await listSftpDomains(settings.sftpConfig);
      return Response.json({ domains });
    }

    if (!settings?.s3Config?.bucket) {
      return Response.json({ error: "S3 is not configured. Add it in Settings first." }, { status: 400 });
    }
    const domains = await listS3Domains(settings.s3Config);
    return Response.json({ domains });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list domains";
    return Response.json({ error: message }, { status: 502 });
  }
}
