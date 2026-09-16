import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, WeeklyReport, Group } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

function csvCell(value: string | number): string {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

// GET /api/weekly-reports/export — CSV of the same rows the screen shows,
// scoped by the same role rule as the page (super-admin: all, sub-lead: group,
// admin: own). Follows the existing hand-rolled CSV convention.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const myId = session.user.id;

  await connectDB();

  const filter: Record<string, unknown> = {};
  if (role === "admin") {
    filter.userId = myId;
  } else if (role === "sub-lead") {
    const group = await Group.findOne({ leadUserId: myId }).lean();
    const memberIds = group ? group.memberUserIds.map((id) => id.toString()) : [];
    filter.userId = { $in: [myId, ...memberIds] };
  }

  const reports = await WeeklyReport.find(filter).sort({ weekStart: -1 }).lean();

  const header = ["Member", "Website", "Week Start", "Clicks", "Impressions", "Indexation", "RFQs"];
  const rows = reports.map((r) => [
    r.userName,
    r.websiteName,
    r.weekStart,
    r.clicks ?? 0,
    r.impressions ?? 0,
    r.indexation ?? 0,
    r.rfqs ?? 0,
  ]);

  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="weekly-reports-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
