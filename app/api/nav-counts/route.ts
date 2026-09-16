import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, Website, User, Backlink, IndexingQueue, Group } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

// GET /api/nav-counts — real sidebar badge counts (Websites/Users/Backlinks/
// Indexing Queue backlog), role-scoped the same way app/(dashboard)/page.tsx
// scopes its own stats. Read-only, no new collections.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const myId = session.user.id;

  await connectDB();

  let userFilter: Record<string, unknown> = {};
  let websiteFilter: Record<string, unknown> = {};
  if (role === "sub-lead") {
    const group = await Group.findOne({ leadUserId: myId }).lean();
    const memberIds = group ? group.memberUserIds.map((id) => id.toString()) : [];
    const ids = [myId, ...memberIds];
    userFilter = { userId: { $in: ids } };
    websiteFilter = { "assignedTo.userId": { $in: ids } };
  } else if (role !== "super-admin") {
    userFilter = { userId: myId };
    websiteFilter = { "assignedTo.userId": myId };
  }

  const [websites, users, backlinks, websiteIds] = await Promise.all([
    Website.countDocuments(websiteFilter),
    User.countDocuments({ isActive: true }),
    Backlink.countDocuments(userFilter),
    role === "super-admin" ? null : Website.find(websiteFilter).distinct("_id"),
  ]);

  const indexingQueueFilter =
    role === "super-admin" ? {} : { websiteId: { $in: (websiteIds ?? []).map(String) } };
  const indexingQueue = await IndexingQueue.countDocuments({ ...indexingQueueFilter, gscStatus: "pending" });

  return Response.json({ websites, users, backlinks, indexingQueue });
}
