import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, ExecutionLog, Backlink, ContentTask, Group } from "@/lib/mongodb";
import { Badge } from "@/components/ui/badge";
import { Play, ScrollText, CheckCircle, XCircle } from "lucide-react";
import { OverviewFilters } from "./overview-filters";
import { cn } from "@/lib/utils";

type ContentTaskType = "landing-request" | "blog-request" | "landing-update" | "blog-publish";

const CONTENT_LABELS: Record<ContentTaskType, string> = {
  "landing-request": "Landing Pages Request",
  "blog-request":    "Blogs Request",
  "landing-update":  "Landing Pages Update",
  "blog-publish":    "Blogs Publish",
};

async function getUserFilter(role: string, myId: string): Promise<Record<string, unknown>> {
  if (role === "super-admin") return {};
  if (role === "sub-lead") {
    const group = await Group.findOne({ leadUserId: myId }).lean();
    const memberIds = group ? group.memberUserIds.map((id) => id.toString()) : [];
    return { userId: { $in: [myId, ...memberIds] } };
  }
  return { userId: myId };
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const role = session.user.role;
  const myId = session.user.id;
  const { from, to } = searchParams;

  await connectDB();

  // Auto-fix stale "running" logs from server restarts / redeployments
  const staleThreshold = new Date(Date.now() - 10 * 60 * 1000);
  await ExecutionLog.updateMany(
    { status: "running", startedAt: { $lt: staleThreshold } },
    { $set: { status: "error", completedAt: new Date(), output: "Interrupted — server was restarted during execution." } }
  ).catch(() => { /* ignore write errors (e.g. storage limit exceeded) */ });

  const userFilter = await getUserFilter(role, myId);

  // Script filter includes optional date range
  const execFilter: Record<string, unknown> = { ...userFilter };
  if (from || to) {
    const df: Record<string, Date> = {};
    if (from) df.$gte = new Date(from);
    if (to) { const d = new Date(to); d.setHours(23, 59, 59, 999); df.$lte = d; }
    execFilter.startedAt = df;
  }

  // Fetch all stats in parallel
  const [execStats, blStats, contentStats] = await Promise.all([
    // ── Script executions ──
    Promise.all([
      ExecutionLog.countDocuments(execFilter),
      ExecutionLog.countDocuments({ ...execFilter, status: "success" }),
      ExecutionLog.countDocuments({ ...execFilter, status: "error" }),
      ExecutionLog.countDocuments({ ...execFilter, status: "running" }),
      ExecutionLog.find(execFilter).sort({ startedAt: -1 }).limit(10).lean(),
    ]),
    // ── Backlinks ──
    Promise.all([
      Backlink.countDocuments(userFilter),
      Backlink.countDocuments({ ...userFilter, status: "live" }),
      Backlink.countDocuments({ ...userFilter, status: "pending" }),
      Backlink.countDocuments({ ...userFilter, status: "broken" }),
    ]),
    // ── Content tasks (4 types × 3 statuses) ──
    Promise.all(
      (["landing-request", "blog-request", "landing-update", "blog-publish"] as ContentTaskType[]).map(
        async (type) => {
          const [pending, inProgress, done] = await Promise.all([
            ContentTask.countDocuments({ ...userFilter, taskType: type, status: "pending" }),
            ContentTask.countDocuments({ ...userFilter, taskType: type, status: "in-progress" }),
            ContentTask.countDocuments({ ...userFilter, taskType: type, status: "done" }),
          ]);
          return {
            type,
            label: CONTENT_LABELS[type],
            pending,
            inProgress,
            done,
            total: pending + inProgress + done,
          };
        }
      )
    ),
  ]);

  const [execTotal, execSuccess, execError, execRunning, recentRuns] = execStats;
  const [blTotal, blLive, blPending, blBroken] = blStats;
  const isFiltered = !!(from || to);

  const roleSubtitle =
    role === "super-admin" ? "Full admin access — viewing all team data." :
    role === "sub-lead"    ? "Supervisor view — viewing your team's data." :
                             "Your personal activity summary.";

  return (
    <div className="space-y-8">

      {/* ── Header ── */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          Welcome back, {session?.user?.name?.split(" ")[0]}
        </h2>
        <p className="text-muted-foreground text-sm mt-1">{roleSubtitle}</p>
      </div>

      {/* ── Script Executions ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Script Executions
          </h3>
          <Suspense>
            <OverviewFilters />
          </Suspense>
        </div>
        {isFiltered && (
          <p className="text-xs text-muted-foreground">
            Filtered{from ? ` from ${from}` : ""}{to ? ` to ${to}` : ""}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {([
            { label: "Total Runs", value: execTotal,   icon: ScrollText,  accent: "text-primary bg-primary/10" },
            { label: "Successful", value: execSuccess,  icon: CheckCircle, accent: "text-emerald-600 bg-emerald-500/10" },
            { label: "Failed",     value: execError,    icon: XCircle,     accent: "text-rose-600 bg-rose-500/10" },
            { label: "Running",    value: execRunning,  icon: Play,        accent: "text-amber-600 bg-amber-500/10" },
          ] as const).map(({ label, value, icon: Icon, accent }) => (
            <div key={label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", accent)}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2 text-3xl font-bold text-foreground">{value as number}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Backlinks ── */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Backlinks
        </h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {([
            { label: "Total",   value: blTotal,   accent: "text-primary" },
            { label: "Live",    value: blLive,    accent: "text-emerald-600" },
            { label: "Pending", value: blPending, accent: "text-amber-600" },
            { label: "Broken",  value: blBroken,  accent: "text-rose-600" },
          ] as const).map(({ label, value, accent }) => (
            <div key={label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className={cn("text-xs font-medium", accent)}>{label}</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{value as number}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Content Tasks ── */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Content Tasks
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {contentStats.map((s) => (
            <div key={s.type} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2 mb-3">
                <p className="font-medium text-sm leading-snug text-foreground">{s.label}</p>
                <span className="text-2xl font-bold shrink-0 text-foreground">{s.total}</span>
              </div>
              <div className="flex gap-4 text-xs">
                <span className="text-amber-600 font-medium">{s.pending} Pending</span>
                <span className="text-primary font-medium">{s.inProgress} In Progress</span>
                <span className="text-emerald-600 font-medium">{s.done} Done</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Recent Script Runs ── */}
      <section>
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <h3 className="font-semibold text-sm text-foreground">
              {isFiltered ? "Filtered Script Runs" : "Recent Script Runs"}
            </h3>
          </div>
          {(recentRuns as { _id: { toString(): string }; scriptName: string; userName: string; startedAt: Date; status: string; durationMs?: number | null }[]).length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              {isFiltered ? "No runs in this date range." : "No executions yet."}
            </p>
          ) : (
            <div className="divide-y divide-border">
              {(recentRuns as { _id: { toString(): string }; scriptName: string; userName: string; startedAt: Date; status: string; durationMs?: number | null }[]).map((log) => (
                <div key={log._id.toString()} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium text-foreground">{log.scriptName}</p>
                    <p className="text-xs text-muted-foreground">
                      {role !== "admin" && `${log.userName} · `}
                      {new Date(log.startedAt).toLocaleString()}
                      {log.durationMs != null && (
                        <span className="ml-2 text-muted-foreground/60">
                          ({(log.durationMs / 1000).toFixed(1)}s)
                        </span>
                      )}
                    </p>
                  </div>
                  <Badge
                    variant={
                      log.status === "success"   ? "success" :
                      log.status === "error"     ? "destructive" : "warning"
                    }
                  >
                    {log.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

    </div>
  );
}
