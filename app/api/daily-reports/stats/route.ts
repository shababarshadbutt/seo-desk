import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, DailyReport, Backlink, IndexingQueue, WeeklyReport, Group } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

const PKT = "Asia/Karachi";

function dayRange(dateStr: string): { start: Date; end: Date } {
  const start = new Date(dateStr);
  start.setHours(0, 0, 0, 0);
  const end = new Date(dateStr);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

// Monday of the week containing dateStr, "YYYY-MM-DD" — same algorithm as
// weekly-reports-client.tsx's currentWeekStart(), generalized to any date.
function weekStartFor(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday.toLocaleDateString("en-CA", { timeZone: PKT });
}

// GET /api/daily-reports/stats?date=YYYY-MM-DD — 4 real, read-only stat-card
// numbers for the Daily Reports screen, each scoped by the same role-visibility
// rule as /api/daily-reports itself (admin=own, sub-lead=own+group, super-admin=all).
// gscBingDispatched is the one exception: IndexingQueue has no per-user
// attribution at all (it's tied to websiteId, and the whole feature is
// super-admin-only elsewhere in the app), so it is only meaningful — and only
// returned — for a super-admin viewer; other roles get `null` and the client
// omits that card rather than showing a misleading org-wide number next to
// otherwise personal/team stats.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const myId = session.user.id;
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? new Date().toLocaleDateString("en-CA", { timeZone: PKT });

  await connectDB();

  let scopedUserIds: string[] | null = null; // null = all (super-admin)
  if (role === "sub-lead") {
    const group = await Group.findOne({ leadUserId: myId }).lean();
    const memberIds = group ? group.memberUserIds.map((id) => id.toString()) : [];
    scopedUserIds = [myId, ...memberIds];
  } else if (role === "admin") {
    scopedUserIds = [myId];
  }

  const { start, end } = dayRange(date);
  const userScope = scopedUserIds !== null ? { userId: { $in: scopedUserIds } } : {};

  const [submittedToday, liveBacklinksPlaced, rfqAgg] = await Promise.all([
    DailyReport.countDocuments({ ...userScope, date: { $gte: start, $lte: end } }),
    Backlink.countDocuments({ ...userScope, status: "live", createdAt: { $gte: start, $lte: end } }),
    WeeklyReport.aggregate([
      { $match: { ...userScope, weekStart: weekStartFor(date) } },
      { $group: { _id: null, total: { $sum: "$rfqs" } } },
    ]),
  ]);

  let gscBingDispatched: number | null = null;
  if (role === "super-admin") {
    gscBingDispatched = await IndexingQueue.countDocuments({
      $or: [
        { gscStatus: "submitted", gscSubmittedAt: { $gte: start, $lte: end } },
        { bingStatus: "submitted", bingSubmittedAt: { $gte: start, $lte: end } },
      ],
    });
  }

  return Response.json({
    submittedToday,
    liveBacklinksPlaced,
    gscBingDispatched,
    rfqsGenerated: rfqAgg[0]?.total ?? 0,
  });
}
