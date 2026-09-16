import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, Website, IndexingQueue } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

function csvCell(value: string | number): string {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

// GET /api/indexing-queue/export — CSV of the same per-website summary shown on
// the list screen. Super-admin only, matching that screen's access rule.
// Follows the existing hand-rolled CSV convention (see app/api/backlinks/export,
// app/api/logs/export) rather than adding a CSV library dependency.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "super-admin") return Response.json({ error: "Forbidden" }, { status: 403 });

  await connectDB();

  const allWebsites = await Website.find({}).lean();
  const websites = allWebsites.filter((w) => !!(w as unknown as Record<string, unknown>).automationEnabled);

  const stats = await IndexingQueue.aggregate([
    {
      $group: {
        _id: "$websiteId",
        total: { $sum: 1 },
        gscPending: { $sum: { $cond: [{ $eq: ["$gscStatus", "pending"] }, 1, 0] } },
        gscSubmitted: { $sum: { $cond: [{ $eq: ["$gscStatus", "submitted"] }, 1, 0] } },
        gscFailed: { $sum: { $cond: [{ $eq: ["$gscStatus", "failed"] }, 1, 0] } },
        bingPending: { $sum: { $cond: [{ $eq: ["$bingStatus", "pending"] }, 1, 0] } },
        bingSubmitted: { $sum: { $cond: [{ $eq: ["$bingStatus", "submitted"] }, 1, 0] } },
        bingFailed: { $sum: { $cond: [{ $eq: ["$bingStatus", "failed"] }, 1, 0] } },
      },
    },
  ]);
  const statsMap = new Map(stats.map((s) => [s._id as string, s]));

  const header = ["Website", "URL", "Sitemaps", "Total URLs", "GSC Submitted", "GSC Pending", "GSC Failed", "Bing Submitted", "Bing Pending", "Bing Failed"];
  const rows = websites.map((w) => {
    const raw = w as unknown as Record<string, unknown>;
    const s = statsMap.get(w._id.toString()) ?? {
      total: 0, gscPending: 0, gscSubmitted: 0, gscFailed: 0, bingPending: 0, bingSubmitted: 0, bingFailed: 0,
    };
    return [
      w.name,
      w.url ?? "",
      ((raw.sitemaps as unknown[]) ?? []).length,
      s.total, s.gscSubmitted, s.gscPending, s.gscFailed, s.bingSubmitted, s.bingPending, s.bingFailed,
    ];
  });

  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="indexing-queue-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
