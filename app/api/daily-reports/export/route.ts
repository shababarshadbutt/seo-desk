import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, DailyReport, Group } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

function csvCell(value: string | number): string {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

// GET /api/daily-reports/export — CSV of the same rows the screen shows,
// same role-scoped filter as /api/daily-reports (admin=own, sub-lead=group,
// super-admin=all), with optional from/to/userId query params matching the
// page's filters.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const myId = session.user.id;
  const { searchParams } = new URL(req.url);

  await connectDB();

  const filter: Record<string, unknown> = {};

  if (role === "super-admin") {
    const userId = searchParams.get("userId");
    if (userId) filter.userId = userId;
  } else if (role === "sub-lead") {
    const group = await Group.findOne({ leadUserId: myId }).lean();
    const memberIds = group ? group.memberUserIds.map((id) => id.toString()) : [];
    const allowedIds = [myId, ...memberIds];
    const userId = searchParams.get("userId");
    filter.userId = userId && allowedIds.includes(userId) ? userId : { $in: allowedIds };
  } else {
    filter.userId = myId;
  }

  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (from || to) {
    const df: Record<string, Date> = {};
    if (from) df.$gte = new Date(from);
    if (to) { const d = new Date(to); d.setHours(23, 59, 59, 999); df.$lte = d; }
    filter.date = df;
  }

  const reports = await DailyReport.find(filter).sort({ date: -1, createdAt: -1 }).limit(10_000).lean();

  const header = ["Member", "Date", "Submitted At", "Type", "Report"];
  const rows = reports.map((r) => [
    r.userName,
    r.date.toISOString().slice(0, 10),
    r.createdAt.toISOString(),
    r.type ?? "report",
    r.report,
  ]);

  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="daily-reports-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
