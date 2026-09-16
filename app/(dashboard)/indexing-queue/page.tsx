import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, Website, IndexingQueue } from "@/lib/mongodb";
import { IndexingQueueListClient } from "./indexing-queue-list-client";

export default async function IndexingQueuePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "super-admin") redirect("/");

  await connectDB();

  const allWebsites = await Website.find({}).lean();
  const websites = allWebsites.filter(
    (w) => !!(w as unknown as Record<string, unknown>).automationEnabled
  );

  const stats = await IndexingQueue.aggregate([
    {
      $group: {
        _id: "$websiteId",
        total:         { $sum: 1 },
        gscPending:    { $sum: { $cond: [{ $eq: ["$gscStatus",  "pending"]   }, 1, 0] } },
        gscSubmitted:  { $sum: { $cond: [{ $eq: ["$gscStatus",  "submitted"] }, 1, 0] } },
        gscFailed:     { $sum: { $cond: [{ $eq: ["$gscStatus",  "failed"]    }, 1, 0] } },
        bingPending:   { $sum: { $cond: [{ $eq: ["$bingStatus", "pending"]   }, 1, 0] } },
        bingSubmitted: { $sum: { $cond: [{ $eq: ["$bingStatus", "submitted"] }, 1, 0] } },
        bingFailed:    { $sum: { $cond: [{ $eq: ["$bingStatus", "failed"]    }, 1, 0] } },
      },
    },
  ]);

  const statsMap = new Map(stats.map((s) => [s._id as string, s]));

  const rows = websites.map((w) => {
    const raw = w as unknown as Record<string, unknown>;
    const s = statsMap.get(w._id.toString()) ?? {
      total: 0, gscPending: 0, gscSubmitted: 0, gscFailed: 0,
      bingPending: 0, bingSubmitted: 0, bingFailed: 0,
    };
    return {
      id:           w._id.toString(),
      name:         w.name,
      url:          w.url ?? "",
      sitemapCount: ((raw.sitemaps as unknown[]) ?? []).length,
      ...s,
    };
  });

  // Grand totals
  const totals = rows.reduce(
    (acc, r) => ({
      total:         acc.total         + r.total,
      gscPending:    acc.gscPending    + r.gscPending,
      gscSubmitted:  acc.gscSubmitted  + r.gscSubmitted,
      gscFailed:     acc.gscFailed     + r.gscFailed,
      bingPending:   acc.bingPending   + r.bingPending,
      bingSubmitted: acc.bingSubmitted + r.bingSubmitted,
      bingFailed:    acc.bingFailed    + r.bingFailed,
    }),
    { total: 0, gscPending: 0, gscSubmitted: 0, gscFailed: 0, bingPending: 0, bingSubmitted: 0, bingFailed: 0 }
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Indexing Queue</h1>
        <p className="text-sm text-muted-foreground mt-1">{rows.length} automated website(s)</p>
      </div>

      {/* Grand total summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Total URLs" value={totals.total} color="primary" />
        <SummaryCard label="GSC Submitted" value={totals.gscSubmitted} color="emerald" />
        <SummaryCard label="GSC Pending" value={totals.gscPending} color="amber" />
        <SummaryCard label="GSC Failed" value={totals.gscFailed} color="rose" />
        <SummaryCard label="Bing Submitted" value={totals.bingSubmitted} color="emerald" />
        <SummaryCard label="Bing Pending" value={totals.bingPending} color="amber" />
        <SummaryCard label="Bing Failed" value={totals.bingFailed} color="rose" />
      </div>

      {/* Website table */}
      <IndexingQueueListClient rows={rows} />
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: "primary" | "emerald" | "amber" | "rose" }) {
  const colorClass = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    amber:   "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    rose:    "bg-rose-500/10 text-rose-700 dark:text-rose-400",
  }[color];

  return (
    <div className={`rounded-xl border border-border px-4 py-3 ${colorClass}`}>
      <div className="text-xl font-bold">{value.toLocaleString()}</div>
      <div className="text-xs mt-0.5 opacity-70">{label}</div>
    </div>
  );
}
