import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, Website, IndexingQueue } from "@/lib/mongodb";
import { dispatchIndexingUrls, type IndexingEngine } from "@/lib/indexing-dispatch";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST /api/indexing-queue/[websiteId]/dispatch — super-admin only, same gate as
// the rest of the Indexing Queue screens. Reuses the existing script pipeline —
// see lib/indexing-dispatch.ts.
export async function POST(req: Request, { params }: { params: { websiteId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "super-admin") return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { engine, forceAll } = body as { engine?: IndexingEngine; forceAll?: boolean };
  if (engine !== "gsc" && engine !== "bing") {
    return Response.json({ error: "Invalid engine." }, { status: 400 });
  }

  await connectDB();

  const website = await Website.findById(params.websiteId).lean();
  if (!website) return Response.json({ error: "Website not found." }, { status: 404 });

  const statusField = engine === "gsc" ? "gscStatus" : "bingStatus";
  // "Dispatch Pending Batch" only touches pending URLs; "Force Re-index" (forceAll)
  // re-submits everything for this engine, including already-submitted/failed URLs.
  const filter = forceAll
    ? { websiteId: params.websiteId }
    : { websiteId: params.websiteId, [statusField]: "pending" };

  const docs = await IndexingQueue.find(filter).select("url").lean();
  if (docs.length === 0) {
    return Response.json({ error: forceAll ? "No URLs in the queue for this website." : "No pending URLs for this engine." }, { status: 400 });
  }

  const raw = website as unknown as Record<string, unknown>;
  const serviceAccountName = (raw.gscServiceAccountName as string) ?? "";
  if (engine === "gsc" && !serviceAccountName) {
    return Response.json({ error: "No GSC service account configured for this website." }, { status: 400 });
  }

  return dispatchIndexingUrls({
    websiteId: params.websiteId,
    engine,
    urls: docs.map((d) => d.url),
    serviceAccountName,
    requestUrl: req.url,
    cookie: req.headers.get("cookie") ?? "",
  });
}
