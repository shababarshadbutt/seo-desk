import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, ExecutionLog, IndexingQueue, Group, Website } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

// GET /api/notifications — recent real failure events (script errors + indexing failures).
// Part B addition. Read-only, computed on demand from existing collections — no new schema,
// no persisted "notification" documents, no hooks added to any protected route. Read/unread
// state is tracked client-side (localStorage "last seen" timestamp), not server-side.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const myId = session.user.id;

  await connectDB();

  // Same visibility scope as the Execution Logs page.
  let visibleUserIds: string[] | null = null;
  if (role === "sub-lead") {
    const group = await Group.findOne({ leadUserId: myId }).lean();
    const memberIds = group ? group.memberUserIds.map((id) => id.toString()) : [];
    visibleUserIds = [myId, ...memberIds];
  } else if (role === "admin") {
    visibleUserIds = [myId];
  }

  const logFilter: Record<string, unknown> = { status: "error" };
  if (visibleUserIds !== null) logFilter.userId = { $in: visibleUserIds };

  const errorLogs = await ExecutionLog.find(logFilter)
    .sort({ startedAt: -1 })
    .limit(8)
    .select("scriptName websiteName startedAt")
    .lean();

  type Notification = { id: string; kind: "script-error" | "indexing-error"; message: string; at: string };

  const notifications: Notification[] = errorLogs.map((l) => ({
    id: l._id.toString(),
    kind: "script-error",
    message: l.websiteName ? `${l.scriptName} failed for ${l.websiteName}` : `${l.scriptName} failed`,
    at: l.startedAt.toISOString(),
  }));

  // Indexing failures — same super-admin-only scope as the Indexing Queue screen.
  if (role === "super-admin") {
    const failedQueue = await IndexingQueue.find({ $or: [{ gscStatus: "failed" }, { bingStatus: "failed" }] })
      .sort({ gscSubmittedAt: -1, bingSubmittedAt: -1 })
      .limit(8)
      .select("websiteId url gscStatus bingStatus gscSubmittedAt bingSubmittedAt")
      .lean();

    const siteIds = Array.from(new Set(failedQueue.map((q) => q.websiteId)));
    const sites = await Website.find({ _id: { $in: siteIds } }).select("name").lean();
    const siteNameById = new Map(sites.map((s) => [s._id.toString(), s.name]));

    for (const q of failedQueue) {
      const engine = q.gscStatus === "failed" ? "GSC" : "Bing";
      const at = q.gscStatus === "failed" ? q.gscSubmittedAt : q.bingSubmittedAt;
      notifications.push({
        id: `${q._id.toString()}-${engine}`,
        kind: "indexing-error",
        message: `${engine} indexing failed for ${siteNameById.get(q.websiteId) ?? "a website"}`,
        at: (at ?? new Date(0)).toISOString(),
      });
    }
  }

  notifications.sort((a, b) => b.at.localeCompare(a.at));

  return Response.json({ notifications: notifications.slice(0, 10) });
}
