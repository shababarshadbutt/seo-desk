import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, ExecutionLog, Backlink, ContentTask, DailyReport, Group } from "@/lib/mongodb";
import {
  getExecutionTrend,
  getWeeklyVelocity,
  getDomainStats,
  getIndexingBacklog,
  getSpecialistVelocity,
  getQuotaUsage,
  getSpecialistLeaderboard,
  getGroupMemberIds,
  getUserScope,
  type ContentStat,
} from "@/lib/dashboard-stats";
import { DashboardHeader } from "./_dashboard/dashboard-header";
import { KpiRow } from "./_dashboard/kpi-row";
import { BacklinksDonut } from "./_dashboard/backlinks-donut";
import { WeeklyVelocityPanel } from "./_dashboard/weekly-velocity-panel";
import { AutomationDaemonsPanel } from "./_dashboard/automation-daemons-panel";
import { SpecialistLeaderboard } from "./_dashboard/specialist-leaderboard";
import { SpecialistSummaryCard } from "./_dashboard/specialist-summary-card";
import { ContentPipelinePanel } from "./_dashboard/content-pipeline-panel";
import { LiveStreamPanel } from "./_dashboard/live-stream-panel";

type ContentTaskType = "landing-request" | "blog-request" | "landing-update" | "blog-publish";

const CONTENT_LABELS: Record<ContentTaskType, string> = {
  "landing-request": "Landing Pages Request",
  "blog-request":    "Blogs Request",
  "landing-update":  "Landing Pages Update",
  "blog-publish":    "Blogs Publish",
};

function roleLabel(role: string): string {
  if (role === "super-admin") return "Super Admin";
  if (role === "sub-lead") return "Supervisor";
  return "User";
}

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

  const groupMemberIds = await getGroupMemberIds(role, myId);

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

  const canSeeLeaderboard = role === "super-admin" || role === "sub-lead";
  const userScope = getUserScope(role, myId, groupMemberIds);

  const [execTrend, weeklyVelocity, domainStats, indexingBacklog, specialistVelocity, quota, leaderboard, myDailyReports] =
    await Promise.all([
      getExecutionTrend(userFilter, from, to),
      getWeeklyVelocity(userFilter),
      getDomainStats(role, myId, groupMemberIds),
      getIndexingBacklog(role, myId, groupMemberIds),
      getSpecialistVelocity(userFilter, userScope, contentStats as ContentStat[]),
      getQuotaUsage(role, myId, groupMemberIds),
      canSeeLeaderboard ? getSpecialistLeaderboard(userFilter, userScope) : Promise.resolve(null),
      canSeeLeaderboard ? Promise.resolve(0) : DailyReport.countDocuments(userFilter),
    ]);

  return (
    <div className="space-y-6">
      <DashboardHeader
        firstName={session?.user?.name?.split(" ")[0] ?? ""}
        role={role}
        roleLabel={roleLabel(role)}
        totalSpecialists={specialistVelocity.totalSpecialists}
        websites={domainStats.websites}
        exportData={{
          generatedAt: new Date().toISOString(),
          exec: { total: execTotal, success: execSuccess, error: execError, running: execRunning },
          backlinks: { total: blTotal, live: blLive, pending: blPending, broken: blBroken },
          domains: domainStats,
          specialists: specialistVelocity,
          contentPipeline: contentStats as ContentStat[],
          leaderboard: (leaderboard?.rows ?? []).map((r) => ({
            name: r.name,
            role: r.role,
            backlinks: r.backlinks,
            dailyReports: r.dailyReports,
            executions: r.executions,
          })),
        }}
      />

      {isFiltered && (
        <p className="text-xs text-muted-foreground">
          Filtered{from ? ` from ${from}` : ""}{to ? ` to ${to}` : ""}
        </p>
      )}

      <KpiRow
        exec={{
          total: execTotal,
          success: execSuccess,
          error: execError,
          running: execRunning,
          changePct: execTrend.changePct,
          changeCaption: execTrend.isCustomRange ? "vs. prior period" : "vs. prior 30 days",
        }}
        backlinks={{ total: blTotal, live: blLive, pending: blPending, broken: blBroken }}
        domains={domainStats}
        specialists={specialistVelocity}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        <BacklinksDonut total={blTotal} live={blLive} pending={blPending} broken={blBroken} />
        <WeeklyVelocityPanel days={weeklyVelocity} quota={quota} />
        <div className="lg:col-span-2 xl:col-span-1">
          <AutomationDaemonsPanel indexingBacklog={indexingBacklog} />
        </div>
      </div>

      {canSeeLeaderboard && leaderboard ? (
        <SpecialistLeaderboard rows={leaderboard.rows} totalUsers={leaderboard.totalUsers} />
      ) : (
        <SpecialistSummaryCard
          backlinks={blTotal}
          dailyReports={myDailyReports}
          executions={execTotal}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ContentPipelinePanel stats={contentStats as ContentStat[]} />
        <LiveStreamPanel
          runs={recentRuns as { _id: { toString(): string }; scriptName: string; userName: string; websiteName?: string | null; startedAt: Date; status: string }[]}
          showUser={role !== "admin"}
        />
      </div>
    </div>
  );
}
