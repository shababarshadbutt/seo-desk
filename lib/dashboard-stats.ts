import mongoose from "mongoose";
import { Backlink, DailyReport, ExecutionLog, Group, IndexingQueue, User, Website } from "@/lib/mongodb";

// ExecutionLog.userId is stored as ObjectId (unlike Backlink/DailyReport/ContentTask,
// which store it as a plain String) — page.tsx's userFilter carries string ids, and
// unlike .find()/.countDocuments(), .aggregate() does not auto-cast $match values
// against the schema. Any ExecutionLog aggregation must run its userFilter through
// this first or it will silently match zero documents for every non-super-admin role.
function toExecutionLogMatch(userFilter: Record<string, unknown>): Record<string, unknown> {
  if (!("userId" in userFilter)) return userFilter;
  const value = userFilter.userId;
  if (typeof value === "string") {
    return { ...userFilter, userId: new mongoose.Types.ObjectId(value) };
  }
  if (value && typeof value === "object" && "$in" in (value as Record<string, unknown>)) {
    const ids = (value as { $in: string[] }).$in;
    return { ...userFilter, userId: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) } };
  }
  return userFilter;
}

// Server-only aggregation helpers for the Dashboard screen (app/(dashboard)/page.tsx).
// Each function takes the role-scoped filters page.tsx already computes via its
// own getUserFilter — role scoping stays owned there, this module only adds the
// queries needed for the new widgets. All data returned here is real.

type ContentTaskType = "landing-request" | "blog-request" | "landing-update" | "blog-publish";

export interface ContentStat {
  type: ContentTaskType;
  label: string;
  pending: number;
  inProgress: number;
  done: number;
  total: number;
}

// ── Execution trend (KPI card delta) ───────────────────────────────────────────

export interface ExecutionTrend {
  changePct: number | null;
  prevTotal: number;
  /** Whether the comparison window is the user's own date filter, or a default trailing 30 days. */
  isCustomRange: boolean;
}

// Computes its own current-window count rather than reusing the page's
// (possibly all-time, when unfiltered) execTotal — comparing an all-time total
// against a 30-day prior window would produce a meaningless percentage.
export async function getExecutionTrend(
  userFilter: Record<string, unknown>,
  from?: string,
  to?: string
): Promise<ExecutionTrend> {
  const end = to ? new Date(to) : new Date();
  if (to) end.setHours(23, 59, 59, 999);
  const start = from ? new Date(from) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

  const windowMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime());
  const prevStart = new Date(start.getTime() - windowMs);

  const [currentTotal, prevTotal] = await Promise.all([
    ExecutionLog.countDocuments({ ...userFilter, startedAt: { $gte: start, $lte: end } }),
    ExecutionLog.countDocuments({ ...userFilter, startedAt: { $gte: prevStart, $lt: prevEnd } }),
  ]);

  const changePct = prevTotal === 0 ? null : Math.round(((currentTotal - prevTotal) / prevTotal) * 100);

  return { changePct, prevTotal, isCustomRange: !!(from || to) };
}

// ── Weekly execution velocity (7-day success/error bar chart) ─────────────────

export interface VelocityDay {
  date: string;
  label: string;
  success: number;
  error: number;
}

export async function getWeeklyVelocity(userFilter: Record<string, unknown>): Promise<VelocityDay[]> {
  const days: VelocityDay[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push({
      date: d.toLocaleDateString("en-CA"),
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
      success: 0,
      error: 0,
    });
  }

  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const rows = await ExecutionLog.aggregate([
    { $match: { ...toExecutionLogMatch(userFilter), startedAt: { $gte: sevenDaysAgo }, status: { $in: ["success", "error"] } } },
    {
      $group: {
        _id: { day: { $dateToString: { format: "%Y-%m-%d", date: "$startedAt" } }, status: "$status" },
        n: { $sum: 1 },
      },
    },
  ]);

  const byDay = new Map(days.map((d) => [d.date, d]));
  for (const row of rows) {
    const day = byDay.get(row._id.day);
    if (!day) continue;
    if (row._id.status === "success") day.success = row.n;
    else if (row._id.status === "error") day.error = row.n;
  }

  return days;
}

// ── Domains & sitemaps ──────────────────────────────────────────────────────────

export interface DomainStats {
  websites: number;
  sitemapsSynced: number;
  indexedUrls: number;
}

async function resolveWebsiteScope(role: string, myId: string, groupMemberIds: string[]): Promise<Record<string, unknown>> {
  if (role === "super-admin") return {};
  const ids = role === "sub-lead" ? [myId, ...groupMemberIds] : [myId];
  return { "assignedTo.userId": { $in: ids } };
}

export async function getDomainStats(role: string, myId: string, groupMemberIds: string[]): Promise<DomainStats> {
  const websiteScope = await resolveWebsiteScope(role, myId, groupMemberIds);

  const [websites, sitemapAgg, websiteIds] = await Promise.all([
    Website.countDocuments(websiteScope),
    Website.aggregate([
      { $match: websiteScope },
      { $group: { _id: null, n: { $sum: { $size: { $ifNull: ["$sitemaps", []] } } } } },
    ]),
    role === "super-admin" ? null : Website.find(websiteScope).distinct("_id"),
  ]);

  const indexedFilter =
    role === "super-admin" ? { gscStatus: "submitted" } : { gscStatus: "submitted", websiteId: { $in: (websiteIds ?? []).map(String) } };
  const indexedUrls = await IndexingQueue.countDocuments(indexedFilter);

  return { websites, sitemapsSynced: sitemapAgg[0]?.n ?? 0, indexedUrls };
}

// ── Indexing backlog (real number used inside the otherwise-fake daemons panel) ─

export async function getIndexingBacklog(role: string, myId: string, groupMemberIds: string[]): Promise<number> {
  const websiteScope = await resolveWebsiteScope(role, myId, groupMemberIds);
  if (role === "super-admin") {
    return IndexingQueue.countDocuments({ gscStatus: "pending" });
  }
  const websiteIds = await Website.find(websiteScope).distinct("_id");
  return IndexingQueue.countDocuments({ gscStatus: "pending", websiteId: { $in: websiteIds.map(String) } });
}

// ── Specialist velocity (KPI card) ─────────────────────────────────────────────

export interface SpecialistVelocity {
  activeSpecialists: number;
  totalSpecialists: number;
  tasksQueued: number;
}

export async function getSpecialistVelocity(
  userFilter: Record<string, unknown>,
  userScope: Record<string, unknown>,
  contentStats: ContentStat[]
): Promise<SpecialistVelocity> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [totalSpecialists, distinctSubmitters] = await Promise.all([
    User.countDocuments({ ...userScope, isActive: true }),
    DailyReport.distinct("userId", { ...userFilter, date: { $gte: sevenDaysAgo } }),
  ]);

  const tasksQueued = contentStats.reduce((sum, s) => sum + s.pending + s.inProgress, 0);

  return { activeSpecialists: distinctSubmitters.length, totalSpecialists, tasksQueued };
}

// ── API quota usage (real "used", documented static limits) ───────────────────

export const GSC_DAILY_QUOTA = 2000;
export const BING_INDEXNOW_DAILY = 10000;

export interface QuotaUsage {
  gscUsed: number;
  gscLimit: number;
  bingUsed: number;
  bingLimit: number;
}

export async function getQuotaUsage(role: string, myId: string, groupMemberIds: string[]): Promise<QuotaUsage> {
  const websiteScope = await resolveWebsiteScope(role, myId, groupMemberIds);
  const websiteIds = role === "super-admin" ? null : await Website.find(websiteScope).distinct("_id");
  const scopeFilter = websiteIds ? { websiteId: { $in: websiteIds.map(String) } } : {};

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [gscUsed, bingUsed] = await Promise.all([
    IndexingQueue.countDocuments({ ...scopeFilter, gscStatus: "submitted", gscSubmittedAt: { $gte: todayStart } }),
    IndexingQueue.countDocuments({ ...scopeFilter, bingStatus: "submitted", bingSubmittedAt: { $gte: todayStart } }),
  ]);

  return { gscUsed, gscLimit: GSC_DAILY_QUOTA, bingUsed, bingLimit: BING_INDEXNOW_DAILY };
}

// ── Specialist leaderboard ──────────────────────────────────────────────────────

export const RECENTLY_ACTIVE_WINDOW_MS = 15 * 60 * 1000;

export interface LeaderboardRow {
  userId: string;
  name: string;
  email: string;
  role: string;
  backlinks: number;
  dailyReports: number;
  executions: number;
  lastActiveAt: string | null;
  isRecentlyActive: boolean;
}

export interface LeaderboardResult {
  rows: LeaderboardRow[];
  totalUsers: number;
}

export async function getSpecialistLeaderboard(
  userFilter: Record<string, unknown>,
  userScope: Record<string, unknown>,
  limit = 8
): Promise<LeaderboardResult> {
  const [users, backlinkAgg, reportAgg, execAgg] = await Promise.all([
    User.find(userScope).select("_id name email role").lean(),
    Backlink.aggregate([{ $match: userFilter }, { $group: { _id: "$userId", n: { $sum: 1 } } }]),
    DailyReport.aggregate([{ $match: userFilter }, { $group: { _id: "$userId", n: { $sum: 1 }, last: { $max: "$date" } } }]),
    ExecutionLog.aggregate([{ $match: toExecutionLogMatch(userFilter) }, { $group: { _id: "$userId", n: { $sum: 1 }, last: { $max: "$startedAt" } } }]),
  ]);

  const backlinkMap = new Map(backlinkAgg.map((r) => [r._id, r.n as number]));
  const reportMap = new Map(reportAgg.map((r) => [r._id, { n: r.n as number, last: r.last as Date | null }]));
  // execAgg's _id is an ObjectId (see toExecutionLogMatch) — normalize to string to match u._id.toString() below.
  const execMap = new Map(execAgg.map((r) => [String(r._id), { n: r.n as number, last: r.last as Date | null }]));

  const rows: LeaderboardRow[] = users.map((u) => {
    const id = u._id.toString();
    const backlinks = backlinkMap.get(id) ?? 0;
    const reportInfo = reportMap.get(id);
    const execInfo = execMap.get(id);
    const dailyReports = reportInfo?.n ?? 0;
    const executions = execInfo?.n ?? 0;

    const timestamps = [reportInfo?.last, execInfo?.last].filter((t): t is Date => !!t);
    const lastActiveAt = timestamps.length > 0 ? new Date(Math.max(...timestamps.map((t) => t.getTime()))) : null;
    const isRecentlyActive = lastActiveAt != null && Date.now() - lastActiveAt.getTime() < RECENTLY_ACTIVE_WINDOW_MS;

    return {
      userId: id,
      name: u.name,
      email: u.email,
      role: u.role,
      backlinks,
      dailyReports,
      executions,
      lastActiveAt: lastActiveAt ? lastActiveAt.toISOString() : null,
      isRecentlyActive,
    };
  });

  rows.sort((a, b) => (b.backlinks + b.dailyReports + b.executions) - (a.backlinks + a.dailyReports + a.executions));

  return { rows: rows.slice(0, limit), totalUsers: users.length };
}

// ── Shared scope resolution (userId-based, mirrors page.tsx's getUserFilter) ──

export async function getGroupMemberIds(role: string, myId: string): Promise<string[]> {
  if (role !== "sub-lead") return [];
  const group = await Group.findOne({ leadUserId: myId }).lean();
  return group ? group.memberUserIds.map((id) => id.toString()) : [];
}

export function getUserScope(role: string, myId: string, groupMemberIds: string[]): Record<string, unknown> {
  if (role === "super-admin") return {};
  if (role === "sub-lead") return { _id: { $in: [myId, ...groupMemberIds] } };
  return { _id: myId };
}
