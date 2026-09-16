import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, Website, IndexingQueue } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

// POST /api/indexing-queue/[websiteId]/urls — add one URL to the queue (super-admin only).
// Only queues it (status: pending both engines) — actual submission happens via
// dispatch/resubmit, same as any other pending URL.
export async function POST(req: Request, { params }: { params: { websiteId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "super-admin") return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const url = (body.url as string)?.trim();
  if (!url) return Response.json({ error: "URL is required." }, { status: 400 });
  try {
    new URL(url);
  } catch {
    return Response.json({ error: "Enter a valid, fully-qualified URL." }, { status: 400 });
  }

  await connectDB();

  const website = await Website.findById(params.websiteId).lean();
  if (!website) return Response.json({ error: "Website not found." }, { status: 404 });

  const existing = await IndexingQueue.findOne({ websiteId: params.websiteId, url }).lean();
  if (existing) {
    return Response.json({ error: "This URL is already in the queue for this website." }, { status: 409 });
  }

  const created = await IndexingQueue.create({
    websiteId: params.websiteId,
    url,
    discoveredAt: new Date(),
    gscStatus: "pending",
    bingStatus: "pending",
  });

  return Response.json(
    {
      id: created._id.toString(),
      url: created.url,
      discoveredAt: created.discoveredAt.toISOString(),
      gscStatus: created.gscStatus,
      gscSubmittedAt: null,
      gscError: null,
      bingStatus: created.bingStatus,
      bingSubmittedAt: null,
      bingError: null,
    },
    { status: 201 }
  );
}
