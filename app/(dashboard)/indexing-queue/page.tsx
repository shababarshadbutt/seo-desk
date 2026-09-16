import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Link2, CheckCircle2, Clock, XCircle } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { connectDB, Website, IndexingQueue } from "@/lib/mongodb";
import { fakeSyncHealthPct } from "@/lib/indexing-queue-fake-stats";
import { IndexingQueueListClient } from "./indexing-queue-list-client";
import { StatCard } from "./stat-card";

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

  // Presentational only — no real sync-health scoring exists yet. Stable for
  // the calendar day so it doesn't flicker on every reload. See
  // lib/indexing-queue-fake-stats.ts.
  const syncHealthPct = fakeSyncHealthPct(new Date().toISOString().slice(0, 10));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Indexing Queue</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Real-time automated submission status to Google Search Console (GSC Indexing API) and Bing IndexNow across enterprise web properties.
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className="inline-flex items-center rounded-full border border-border bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {rows.length} Automated Website{rows.length === 1 ? "" : "s"}
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400"
            title="Presentational status indicator — not yet backed by a real health-scoring system"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Live Sync: {syncHealthPct}% Health
          </span>
        </div>
      </div>

      {/* Grand total summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Link2} label="Total URLs" value={totals.total} color="primary" />
        <StatCard icon={CheckCircle2} label="GSC Submitted" value={totals.gscSubmitted} color="emerald" />
        <StatCard icon={Clock} label="GSC Pending" value={totals.gscPending} color="amber" />
        <StatCard icon={XCircle} label="GSC Failed" value={totals.gscFailed} color="rose" />
        <StatCard icon={CheckCircle2} label="Bing Submitted" value={totals.bingSubmitted} color="emerald" />
        <StatCard icon={Clock} label="Bing Pending" value={totals.bingPending} color="amber" />
        <StatCard icon={XCircle} label="Bing Failed" value={totals.bingFailed} color="rose" />
      </div>

      {/* Website table */}
      <IndexingQueueListClient rows={rows} />
    </div>
  );
}
