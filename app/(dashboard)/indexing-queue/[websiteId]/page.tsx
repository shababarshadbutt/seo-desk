import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { Link2, CheckCircle2, Clock, XCircle, FileStack } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { connectDB, Website, IndexingQueue } from "@/lib/mongodb";
import { fakeSiteId } from "@/lib/indexing-queue-fake-stats";
import { QueueClient } from "./queue-client";
import { StatCard } from "../stat-card";

const PAGE_SIZE = 50;

export default async function WebsiteQueuePage({ params }: { params: { websiteId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "super-admin") redirect("/");

  const { websiteId } = params;

  await connectDB();

  const website = await Website.findById(websiteId).lean();
  if (!website) notFound();

  const raw = website as unknown as Record<string, unknown>;

  // Aggregate stats for this website
  const [stats] = await IndexingQueue.aggregate([
    { $match: { websiteId } },
    {
      $group: {
        _id: null,
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

  const s = stats ?? {
    total: 0, gscPending: 0, gscSubmitted: 0, gscFailed: 0,
    bingPending: 0, bingSubmitted: 0, bingFailed: 0,
  };

  // Initial URL page
  const total = await IndexingQueue.countDocuments({ websiteId });
  const initialUrls = await IndexingQueue.find({ websiteId })
    .sort({ discoveredAt: -1 })
    .limit(PAGE_SIZE)
    .lean();

  const sitemapRaw = (raw.sitemaps as { url: string; discoveredAt?: Date }[]) ?? [];

  const websiteInfo = {
    id:           website._id.toString(),
    name:         website.name,
    url:          website.url ?? "",
    sitemapCount: sitemapRaw.length,
    sitemaps:     sitemapRaw.map((s) => ({
      url: s.url,
      discoveredAt: s.discoveredAt ? new Date(s.discoveredAt).toISOString() : null,
    })),
  };

  // Presentational only — no real site-ID system exists (websites are
  // identified by their Mongo ObjectId). Deterministic per website. See
  // lib/indexing-queue-fake-stats.ts.
  const siteId = fakeSiteId(websiteId);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-1.5 mb-1 text-sm text-muted-foreground">
            <Link href="/indexing-queue" className="hover:text-foreground transition-colors">
              ← Indexing Queue
            </Link>
            <span>/</span>
            <span className="text-foreground/80">{website.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">{website.name}</h1>
          <a
            href={website.url}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-primary hover:underline"
          >
            {website.url}
          </a>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400"
              title="Presentational status indicator — not yet backed by real per-site monitoring"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Active Monitoring
            </span>
            <span className="text-xs text-muted-foreground">
              {websiteInfo.sitemapCount} Sitemap{websiteInfo.sitemapCount === 1 ? "" : "s"} Synced
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Primary Engine: Google Indexing API · Secondary Engine: Bing IndexNow · Frequency: Continuous Poll
          </p>
        </div>
        <span
          className="inline-flex items-center rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-xs font-mono text-muted-foreground"
          title="Presentational identifier — not a real site-ID system"
        >
          Site ID: {siteId}
        </span>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Link2}       label="Total URLs"     value={s.total}         color="primary" />
        <StatCard icon={FileStack}   label="Sitemaps"       value={websiteInfo.sitemapCount} color="primary" />
        <StatCard icon={CheckCircle2} label="GSC Submitted"  value={s.gscSubmitted}  color="emerald" />
        <StatCard icon={Clock}       label="GSC Pending"    value={s.gscPending}    color="amber" />
        <StatCard icon={XCircle}     label="GSC Failed"     value={s.gscFailed}     color="rose" />
        <StatCard icon={CheckCircle2} label="Bing Submitted" value={s.bingSubmitted} color="emerald" />
        <StatCard icon={Clock}       label="Bing Pending"   value={s.bingPending}   color="amber" />
        <StatCard icon={XCircle}     label="Bing Failed"    value={s.bingFailed}    color="rose" />
      </div>

      {/* Client component: sitemaps, filters, URL table, pagination */}
      <QueueClient
        websiteId={websiteId}
        initialWebsite={websiteInfo}
        initialUrls={initialUrls.map((u) => ({
          id:              u._id.toString(),
          url:             u.url,
          discoveredAt:    u.discoveredAt?.toISOString() ?? null,
          gscStatus:       u.gscStatus,
          gscSubmittedAt:  u.gscSubmittedAt?.toISOString() ?? null,
          gscError:        u.gscError ?? null,
          bingStatus:      u.bingStatus,
          bingSubmittedAt: u.bingSubmittedAt?.toISOString() ?? null,
          bingError:       u.bingError ?? null,
        }))}
        initialPagination={{
          page:       1,
          pageSize:   PAGE_SIZE,
          total,
          totalPages: Math.ceil(total / PAGE_SIZE),
        }}
        statusCounts={{
          gscSubmitted: s.gscSubmitted, gscPending: s.gscPending, gscFailed: s.gscFailed,
          bingSubmitted: s.bingSubmitted, bingPending: s.bingPending, bingFailed: s.bingFailed,
        }}
      />
    </div>
  );
}
