import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, Website, IndexingQueue } from "@/lib/mongodb";
import { dispatchIndexingUrls, type IndexingEngine } from "@/lib/indexing-dispatch";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST /api/indexing-queue/[websiteId]/urls/[urlId]/resubmit — retry one URL on one
// engine. Reuses the same dispatch helper as the batch route, scoped to one URL.
export async function POST(
  req: Request,
  { params }: { params: { websiteId: string; urlId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "super-admin") return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { engine } = body as { engine?: IndexingEngine };
  if (engine !== "gsc" && engine !== "bing") {
    return Response.json({ error: "Invalid engine." }, { status: 400 });
  }

  await connectDB();

  const [website, doc] = await Promise.all([
    Website.findById(params.websiteId).lean(),
    IndexingQueue.findById(params.urlId).lean(),
  ]);
  if (!website) return Response.json({ error: "Website not found." }, { status: 404 });
  if (!doc || doc.websiteId !== params.websiteId) return Response.json({ error: "URL not found." }, { status: 404 });

  const raw = website as unknown as Record<string, unknown>;
  const serviceAccountName = (raw.gscServiceAccountName as string) ?? "";
  if (engine === "gsc" && !serviceAccountName) {
    return Response.json({ error: "No GSC service account configured for this website." }, { status: 400 });
  }

  return dispatchIndexingUrls({
    websiteId: params.websiteId,
    engine,
    urls: [doc.url],
    serviceAccountName,
    requestUrl: req.url,
    cookie: req.headers.get("cookie") ?? "",
  });
}
