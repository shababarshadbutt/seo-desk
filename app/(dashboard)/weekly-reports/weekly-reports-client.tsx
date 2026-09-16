"use client";

import { Fragment, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Pencil, Trash2, Loader2, ChevronDown, ChevronRight, BarChart2, Download, Sparkles,
  TrendingUp, TrendingDown, Globe, Award, RotateCcw, LayoutGrid, Table2, Settings2, MousePointerClick, Eye, CheckCircle2, FileCheck2,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from "recharts";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useFunctionalityStub, FunctionalityStubToast } from "@/components/functionality-stub";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WeeklyReportRow {
  id: string;
  userId: string;
  userName: string;
  websiteId: string;
  websiteName: string;
  weekStart: string; // "YYYY-MM-DD"
  clicks: number;
  impressions: number;
  indexation: number;
  rfqs: number;
  createdAt: string;
  updatedAt: string;
}

interface ReportMetricsConfigRow {
  weeklyClickTarget: number;
  serpVisibilityIndex: number;
  verifiedUrlRatio: number;
  avgValuePerQuote: number;
  isPlaceholder: boolean;
}

const DONUT_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#64748b"];

export interface AssignedWebsite { id: string; name: string; }
export interface MemberOption    { id: string; name: string; }

interface Props {
  reports:          WeeklyReportRow[];
  assignedWebsites: AssignedWebsite[];
  members:          MemberOption[];
  viewerRole:       string;
  currentUserId:    string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PKT = "Asia/Karachi";

function currentWeekStart(): string {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  return monday.toLocaleDateString("en-CA", { timeZone: PKT });
}

function weekOptions(): { start: string; label: string }[] {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth  = new Date(year, month + 1, 0);

  // Monday of the week that contains the 1st of the month
  const firstDay = firstOfMonth.getDay();
  const diff = firstDay === 0 ? -6 : 1 - firstDay;
  const cursor = new Date(firstOfMonth);
  cursor.setDate(firstOfMonth.getDate() + diff);

  const opts: { start: string; label: string }[] = [];
  const fmt = (dt: Date) => dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  while (cursor <= lastOfMonth) {
    const sun = new Date(cursor);
    sun.setDate(cursor.getDate() + 6);
    opts.push({ start: cursor.toLocaleDateString("en-CA"), label: `${fmt(cursor)} – ${fmt(sun)}` });
    cursor.setDate(cursor.getDate() + 7);
  }

  return opts;
}

function formatWeekRange(weekStart: string): string {
  const [y, m, d] = weekStart.split("-").map(Number);
  const mon = new Date(y, m - 1, d);
  const sun = new Date(y, m - 1, d + 6);
  const fmt = (dt: Date) => dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${fmt(mon)} – ${fmt(sun)}`;
}

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

const COLS = ["Clicks", "Impressions", "Indexation", "RFQs"] as const;
type Col = typeof COLS[number];

function getVal(r: WeeklyReportRow, col: Col): number {
  if (col === "Clicks")      return r.clicks;
  if (col === "Impressions") return r.impressions;
  if (col === "Indexation")  return r.indexation;
  return r.rfqs;
}

function sumRows(rows: WeeklyReportRow[]) {
  return {
    clicks:      rows.reduce((s, r) => s + r.clicks, 0),
    impressions: rows.reduce((s, r) => s + r.impressions, 0),
    indexation:  rows.reduce((s, r) => s + r.indexation, 0),
    rfqs:        rows.reduce((s, r) => s + r.rfqs, 0),
  };
}

// Group: userId → monthKey → weekStart → rows
function groupReports(reports: WeeklyReportRow[]) {
  const byMember = new Map<string, { userName: string; byMonth: Map<string, Map<string, WeeklyReportRow[]>> }>();

  for (const r of reports) {
    if (!byMember.has(r.userId)) {
      byMember.set(r.userId, { userName: r.userName, byMonth: new Map() });
    }
    const member = byMember.get(r.userId)!;
    const monthKey = r.weekStart.slice(0, 7);
    if (!member.byMonth.has(monthKey)) member.byMonth.set(monthKey, new Map());
    const byWeek = member.byMonth.get(monthKey)!;
    if (!byWeek.has(r.weekStart)) byWeek.set(r.weekStart, []);
    byWeek.get(r.weekStart)!.push(r);
  }

  return byMember;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function WeeklyReportsClient({ reports: initial, assignedWebsites, members, viewerRole, currentUserId }: Props) {
  const router  = useRouter();
  const [reports, setReports] = useState(initial);
  const [addOpen,   setAddOpen]   = useState(false);
  const [editItem,  setEditItem]  = useState<WeeklyReportRow | null>(null);
  const [deleteId,  setDeleteId]  = useState<string | null>(null);
  const [deleting,  setDeleting]  = useState(false);

  // Filters for grouped view
  const [filterMember, setFilterMember] = useState("");
  const [filterMonth,  setFilterMonth]  = useState("");

  const isSuperAdmin = viewerRole === "super-admin";
  const canSubmit    = viewerRole !== "super-admin";
  const showGrouped  = viewerRole === "super-admin" || viewerRole === "sub-lead";
  const stub = useFunctionalityStub();

  // Part F — Executive Visuals / Detailed Breakdown tab (grouped roles only)
  const [activeTab, setActiveTab] = useState<"analytics" | "detailed">("analytics");

  // Part F — real, structured-but-seeded metrics config (weekly click target,
  // SERP visibility index, verified-URL ratio, avg value/quote). Auto-created
  // with placeholder values on first read; editable by super-admin below.
  const [metricsConfig, setMetricsConfig] = useState<ReportMetricsConfigRow | null>(null);
  useEffect(() => {
    fetch("/api/report-metrics-config")
      .then((res) => (res.ok ? res.json() : null))
      .then(setMetricsConfig)
      .catch(() => setMetricsConfig(null));
  }, []);
  const [configEditOpen, setConfigEditOpen] = useState(false);

  // Part F — per-member job titles, real (auto-seeded) UserProfile data.
  const [titleMap, setTitleMap] = useState<Record<string, { title: string; isPlaceholder: boolean }>>({});
  useEffect(() => {
    const ids = Array.from(new Set([...members.map((m) => m.id), currentUserId]));
    if (ids.length === 0) return;
    fetch(`/api/user-profiles?userIds=${ids.join(",")}`)
      .then((res) => (res.ok ? res.json() : {}))
      .then(setTitleMap)
      .catch(() => setTitleMap({}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members.length]);

  // Part F — per-website industry, real (auto-seeded) WebsiteProfile data,
  // powers the "RFQ Industry Breakdown" donut below.
  const [industryMap, setIndustryMap] = useState<Record<string, { industry: string; isPlaceholder: boolean }>>({});
  useEffect(() => {
    const ids = Array.from(new Set(reports.map((r) => r.websiteId)));
    if (ids.length === 0) return;
    fetch(`/api/website-profiles?websiteIds=${ids.join(",")}`)
      .then((res) => (res.ok ? res.json() : {}))
      .then(setIndustryMap)
      .catch(() => setIndustryMap({}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports.length]);

  function onSavedMany(rows: WeeklyReportRow[]) {
    setReports((prev) => {
      let next = [...prev];
      for (const r of rows) {
        const idx = next.findIndex((x) => x.id === r.id);
        if (idx >= 0) next[idx] = r; else next = [r, ...next];
      }
      return next;
    });
    setAddOpen(false);
    router.refresh();
  }

  function onSavedOne(r: WeeklyReportRow) {
    setReports((prev) => prev.map((x) => (x.id === r.id ? r : x)));
    setEditItem(null);
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const res = await fetch(`/api/weekly-reports/${deleteId}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      setReports((prev) => prev.filter((r) => r.id !== deleteId));
      setDeleteId(null);
      router.refresh();
    } else {
      alert((await res.json()).error);
    }
  }

  // Unique months across all reports (for filter)
  const allMonths = Array.from(new Set(reports.map((r) => r.weekStart.slice(0, 7)))).sort().reverse();

  // Filter reports for grouped view
  const filteredReports = reports.filter((r) => {
    if (filterMember && r.userId !== filterMember) return false;
    if (filterMonth  && r.weekStart.slice(0, 7) !== filterMonth)  return false;
    return true;
  });

  const grouped = groupReports(filteredReports);

  // Own reports for member view
  const ownReports = reports
    .filter((r) => r.userId === currentUserId)
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart));

  // Weekly trend chart data — real, computed from whatever this viewer can already
  // see (filteredReports for super-admin/sub-lead, ownReports for a regular member).
  // Last 12 weeks only, so the chart stays readable.
  const chartSourceRows = showGrouped ? filteredReports : ownReports;
  const chartData = Array.from(
    chartSourceRows.reduce((map, r) => {
      const cur = map.get(r.weekStart) ?? { weekStart: r.weekStart, clicks: 0, impressions: 0, indexation: 0, rfqs: 0 };
      cur.clicks += r.clicks;
      cur.impressions += r.impressions;
      cur.indexation += r.indexation;
      cur.rfqs += r.rfqs;
      map.set(r.weekStart, cur);
      return map;
    }, new Map<string, { weekStart: string; clicks: number; impressions: number; indexation: number; rfqs: number }>())
      .values()
  )
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
    .slice(-12)
    .map((d) => ({ ...d, label: formatWeekRange(d.weekStart) }));

  // Part F — real stat-card totals + trend deltas, computed from the exact
  // same rows already driving the chart above. No schema needed for these.
  const statTotals = sumRows(chartSourceRows);
  const managedDomains = new Set(chartSourceRows.map((r) => r.websiteId)).size;
  const trendDeltas = (() => {
    if (chartData.length < 2) return null;
    const mid = Math.ceil(chartData.length / 2);
    const firstHalf = chartData.slice(0, mid);
    const secondHalf = chartData.slice(mid);
    const sum = (rows: typeof chartData, key: "clicks" | "impressions" | "indexation" | "rfqs") =>
      rows.reduce((s, r) => s + r[key], 0);
    const pctChange = (key: "clicks" | "impressions" | "indexation" | "rfqs") => {
      const a = sum(firstHalf, key);
      const b = sum(secondHalf, key);
      if (a === 0) return b > 0 ? 100 : 0;
      return Math.round(((b - a) / a) * 1000) / 10;
    };
    return { clicks: pctChange("clicks"), impressions: pctChange("impressions"), indexation: pctChange("indexation"), rfqs: pctChange("rfqs") };
  })();

  // Part F — "RFQ Industry Breakdown" donut, real data grouped by each
  // website's (auto-seeded) WebsiteProfile.industry. Top 4 + "Other".
  const donutData = (() => {
    const byIndustry = new Map<string, number>();
    for (const r of chartSourceRows) {
      const industry = industryMap[r.websiteId]?.industry ?? "Uncategorized";
      byIndustry.set(industry, (byIndustry.get(industry) ?? 0) + r.rfqs);
    }
    const sorted = Array.from(byIndustry.entries())
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 4);
    const rest = sorted.slice(4).reduce((s, [, v]) => s + v, 0);
    const rows = top.map(([name, value]) => ({ name, value }));
    if (rest > 0) rows.push({ name: "Other", value: rest });
    return rows;
  })();
  const donutTotal = donutData.reduce((s, d) => s + d.value, 0);

  // Top-performing industry + its real conversion rate (rfqs/clicks), for the
  // "Top Performer" line under the donut.
  const topPerformer = (() => {
    if (donutData.length === 0) return null;
    const topIndustry = donutData[0].name;
    const rowsInIndustry = chartSourceRows.filter((r) => (industryMap[r.websiteId]?.industry ?? "Uncategorized") === topIndustry);
    const clicks = rowsInIndustry.reduce((s, r) => s + r.clicks, 0);
    const rfqs = rowsInIndustry.reduce((s, r) => s + r.rfqs, 0);
    const conversion = clicks > 0 ? Math.round((rfqs / clicks) * 1000) / 10 : 0;
    return { industry: topIndustry, conversion };
  })();

  // Top-contributing member by clicks (grouped view only) + real conversion
  // rate for the bar-chart summary line.
  const chartSummary = (() => {
    const totalClicks = chartSourceRows.reduce((s, r) => s + r.clicks, 0);
    const totalRfqs = chartSourceRows.reduce((s, r) => s + r.rfqs, 0);
    const conversionRate = totalClicks > 0 ? Math.round((totalRfqs / totalClicks) * 1000) / 10 : 0;
    if (!showGrouped) return { topContributor: null, conversionRate };
    const byMember = new Map<string, { name: string; clicks: number }>();
    for (const r of chartSourceRows) {
      const cur = byMember.get(r.userId) ?? { name: r.userName, clicks: 0 };
      cur.clicks += r.clicks;
      byMember.set(r.userId, cur);
    }
    const top = Array.from(byMember.values()).sort((a, b) => b.clicks - a.clicks)[0] ?? null;
    return { topContributor: top, conversionRate };
  })();

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Weekly Reports</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isSuperAdmin ? `${reports.length} entries across all members` : "Track weekly website performance"}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {showGrouped && (
            <Button
              variant="outline"
              onClick={() => stub.show("AI summaries are coming soon — this will need an LLM API key configured first.")}
            >
              <Sparkles className="h-4 w-4" />
              AI Executive Summary
            </Button>
          )}
          <Button variant="outline" asChild>
            <a href="/api/weekly-reports/export">
              <Download className="h-4 w-4" />
              Export CSV
            </a>
          </Button>
          {canSubmit && (
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Weekly Report
            </Button>
          )}
        </div>
      </div>

      {/* ── Stat cards — real totals/deltas, structured-but-seeded sub-metrics (Part F) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard
          label="Total Organic Clicks" icon={MousePointerClick} color="primary"
          value={statTotals.clicks} delta={trendDeltas?.clicks}
          subMetrics={metricsConfig ? [
            { label: "Weekly Target", value: metricsConfig.weeklyClickTarget.toLocaleString(), fake: metricsConfig.isPlaceholder },
            { label: "Achieved", value: `${metricsConfig.weeklyClickTarget > 0 ? Math.round((statTotals.clicks / metricsConfig.weeklyClickTarget) * 100) : 0}%`, fake: metricsConfig.isPlaceholder },
          ] : []}
        />
        <StatCard
          label="Total Impressions" icon={Eye} color="sky"
          value={statTotals.impressions} delta={trendDeltas?.impressions}
          subMetrics={[
            { label: "Managed Domains", value: managedDomains },
            { label: "Verified Ratio", value: metricsConfig ? `${metricsConfig.verifiedUrlRatio}%` : "—", fake: metricsConfig?.isPlaceholder },
          ]}
        />
        <StatCard
          label="Indexation Footprint" icon={CheckCircle2} color="emerald"
          value={statTotals.indexation} delta={trendDeltas?.indexation}
          subMetrics={[
            { label: "SERP Visibility", value: metricsConfig ? metricsConfig.serpVisibilityIndex : "—", fake: metricsConfig?.isPlaceholder },
          ]}
        />
        <StatCard
          label="High-Value RFQs" icon={FileCheck2} color="amber"
          value={statTotals.rfqs} delta={trendDeltas?.rfqs}
          subMetrics={[
            { label: "Avg Value/Quote", value: metricsConfig ? `$${metricsConfig.avgValuePerQuote.toLocaleString()}` : "—", fake: metricsConfig?.isPlaceholder },
          ]}
        />
      </div>

      {isSuperAdmin && (
        <div className="flex justify-end -mt-2">
          <button
            type="button"
            onClick={() => setConfigEditOpen(true)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Settings2 className="h-3 w-3" />
            Edit target/index values
          </button>
        </div>
      )}

      {/* ── Tab switcher (grouped roles only) ── */}
      {showGrouped && (
        <div className="flex gap-1.5 p-1 rounded-xl border bg-card w-fit">
          <button
            onClick={() => setActiveTab("analytics")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              activeTab === "analytics" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Executive Visuals
          </button>
          <button
            onClick={() => setActiveTab("detailed")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              activeTab === "detailed" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <Table2 className="h-3.5 w-3.5" />
            Detailed Breakdown
          </button>
        </div>
      )}

      {/* Filters for grouped view */}
      {showGrouped && (
        <div className="flex flex-wrap gap-3 items-end">
          {members.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Member</Label>
              <select
                value={filterMember}
                onChange={(e) => setFilterMember(e.target.value)}
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">All members</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Month</Label>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">All months</option>
              {allMonths.map((mk) => <option key={mk} value={mk}>{monthLabel(mk)}</option>)}
            </select>
          </div>
          {(filterMember || filterMonth) && (
            <Button size="sm" variant="outline" onClick={() => { setFilterMember(""); setFilterMonth(""); }}>
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Filters
            </Button>
          )}
        </div>
      )}

      {/* ── Executive Visuals: bar chart + donut (grouped/analytics tab, or always for a plain member) ── */}
      {(!showGrouped || activeTab === "analytics") && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {chartData.length > 0 && (
            <div className="rounded-xl border bg-card shadow-sm p-4">
              <p className="text-sm font-semibold mb-3">Weekly Output Velocity</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    wrapperClassName="!bg-popover"
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="clicks" name="Clicks" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="rfqs" name="RFQs" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
                {chartSummary.topContributor && (
                  <>Top Contributor: <span className="font-medium text-foreground">{chartSummary.topContributor.name}</span> ({chartSummary.topContributor.clicks.toLocaleString()} Clicks) · </>
                )}
                Conversion Rate: <span className="font-medium text-foreground">{chartSummary.conversionRate}%</span>
              </p>
            </div>
          )}

          {donutData.length > 0 && (
            <div className="rounded-xl border bg-card shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold">RFQ Industry Breakdown</p>
                <span
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                  title="Industry is a real, per-website field — but seeded with a placeholder value until a super-admin sets a real one"
                >
                  <Globe className="h-3 w-3" />
                  by industry
                </span>
              </div>
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={180}>
                  <PieChart>
                    <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2}>
                      {donutData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5 text-xs">
                  {donutData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                      <span className="flex-1 truncate">{d.name}</span>
                      <span className="font-medium">{d.value.toLocaleString()}</span>
                      <span className="text-muted-foreground">({donutTotal > 0 ? Math.round((d.value / donutTotal) * 100) : 0}%)</span>
                    </div>
                  ))}
                </div>
              </div>
              {topPerformer && (
                <p className="text-xs text-muted-foreground mt-3 pt-3 border-t flex items-center gap-1.5">
                  <Award className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  Top Performer: <span className="font-medium text-foreground">{topPerformer.industry}</span>
                  <span className="text-emerald-600 dark:text-emerald-400">+{topPerformer.conversion}% conversion</span>
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Grouped view (super-admin + sub-lead) ── */}
      {showGrouped && activeTab === "detailed" && (
        grouped.size === 0 ? (
          <div className="rounded-xl border bg-card p-12 text-center">
            <BarChart2 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No weekly reports found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Array.from(grouped.entries()).sort(([, a], [, b]) => a.userName.localeCompare(b.userName)).map(([userId, { userName, byMonth }]) => (
              <MemberSection
                key={userId}
                userId={userId}
                userName={userName}
                byMonth={byMonth}
                currentUserId={currentUserId}
                isSuperAdmin={isSuperAdmin}
                onEdit={setEditItem}
                onDelete={setDeleteId}
                title={titleMap[userId]?.title}
              />
            ))}
          </div>
        )
      )}

      {/* ── Own submissions list (member / sub-lead) ── */}
      {!isSuperAdmin && (
        <div className="space-y-3">
          {viewerRole === "sub-lead" && (
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Your Submissions</h3>
          )}
          {ownReports.length === 0 ? (
            !showGrouped && (
              <div className="rounded-xl border bg-card p-12 text-center">
                <BarChart2 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No weekly reports submitted yet.</p>
              </div>
            )
          ) : (
            <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Website</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Week</th>
                      {COLS.map((c) => (
                        <th key={c} className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{c}</th>
                      ))}
                      <th className="px-4 py-3 w-20" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {ownReports.map((r) => (
                      <tr key={r.id} className="hover:bg-muted/20 transition-colors group">
                        <td className="px-4 py-3 font-medium">{r.websiteName}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{formatWeekRange(r.weekStart)}</td>
                        {COLS.map((c) => (
                          <td key={c} className="px-4 py-3 text-right tabular-nums">{getVal(r, c).toLocaleString()}</td>
                        ))}
                        <td className="px-4 py-3">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditItem(r)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteId(r.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Add dialog (bulk: all websites at once) ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Weekly Report</DialogTitle>
            <DialogDescription>Submit this week&apos;s performance numbers for your assigned websites.</DialogDescription>
          </DialogHeader>
          <BulkReportForm
            assignedWebsites={assignedWebsites}
            onSaved={onSavedMany}
            onCancel={() => setAddOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* ── Edit dialog (single row) ── */}
      <Dialog open={!!editItem} onOpenChange={(o) => { if (!o) setEditItem(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Weekly Report</DialogTitle>
            <DialogDescription>Update this report&apos;s metrics.</DialogDescription>
          </DialogHeader>
          {editItem && (
            <EditForm
              key={editItem.id}
              existing={editItem}
              onSaved={onSavedOne}
              onCancel={() => setEditItem(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this report?</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end mt-2">
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />} Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit report-metrics config (super-admin only, Part F) ── */}
      <Dialog open={configEditOpen} onOpenChange={setConfigEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit target &amp; index values</DialogTitle>
            <DialogDescription>
              These power the stat-card sub-metrics above. They started as placeholders — once you save real values here, they stop being flagged as placeholders.
            </DialogDescription>
          </DialogHeader>
          {metricsConfig && (
            <MetricsConfigForm
              existing={metricsConfig}
              onSaved={(c) => { setMetricsConfig(c); setConfigEditOpen(false); }}
              onCancel={() => setConfigEditOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <FunctionalityStubToast message={stub.message} onDismiss={stub.dismiss} />
    </div>
  );
}

// ─── Stat card (Part F) ───────────────────────────────────────────────────────

function StatCard({
  label, icon: Icon, color, value, delta, subMetrics,
}: {
  label: string;
  icon: typeof MousePointerClick;
  color: "primary" | "sky" | "emerald" | "amber";
  value: number;
  delta?: number;
  subMetrics: { label: string; value: string | number; fake?: boolean }[];
}) {
  const colorClass = {
    primary: "bg-primary/10 text-primary",
    sky:     "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    amber:   "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  }[color];

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <div className={cn("rounded-lg p-2 shrink-0", colorClass)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <p className="text-3xl font-bold leading-none">{value.toLocaleString()}</p>
        {delta !== undefined && (
          <span className={cn(
            "inline-flex items-center gap-0.5 text-xs font-medium",
            delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
          )}>
            {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {delta >= 0 ? "+" : ""}{delta}%
          </span>
        )}
      </div>
      {subMetrics.length > 0 && (
        <div className="flex items-center justify-between border-t pt-2 text-xs">
          {subMetrics.map((m) => (
            <div key={m.label} title={m.fake ? "Placeholder — not backed by real data yet" : undefined}>
              <p className="text-muted-foreground">{m.label}</p>
              <p className="font-semibold flex items-center gap-1">
                {m.value}
                {m.fake && <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Metrics config form (Part F) ─────────────────────────────────────────────

function MetricsConfigForm({ existing, onSaved, onCancel }: {
  existing: ReportMetricsConfigRow;
  onSaved: (c: ReportMetricsConfigRow) => void;
  onCancel: () => void;
}) {
  const [weeklyClickTarget, setWeeklyClickTarget] = useState(String(existing.weeklyClickTarget));
  const [serpVisibilityIndex, setSerpVisibilityIndex] = useState(String(existing.serpVisibilityIndex));
  const [verifiedUrlRatio, setVerifiedUrlRatio] = useState(String(existing.verifiedUrlRatio));
  const [avgValuePerQuote, setAvgValuePerQuote] = useState(String(existing.avgValuePerQuote));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);

    const res = await fetch("/api/report-metrics-config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weeklyClickTarget: Number(weeklyClickTarget) || 0,
        serpVisibilityIndex: Number(serpVisibilityIndex) || 0,
        verifiedUrlRatio: Number(verifiedUrlRatio) || 0,
        avgValuePerQuote: Number(avgValuePerQuote) || 0,
      }),
    });

    setLoading(false);
    if (!res.ok) { setError((await res.json()).error ?? "Something went wrong."); return; }
    onSaved(await res.json());
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Weekly Click Target</Label>
          <Input type="number" min="0" value={weeklyClickTarget} onChange={(e) => setWeeklyClickTarget(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>SERP Visibility Index</Label>
          <Input type="number" min="0" max="100" step="0.1" value={serpVisibilityIndex} onChange={(e) => setSerpVisibilityIndex(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Verified URL Ratio (%)</Label>
          <Input type="number" min="0" max="100" step="0.1" value={verifiedUrlRatio} onChange={(e) => setVerifiedUrlRatio(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Avg Value / Quote ($)</Label>
          <Input type="number" min="0" value={avgValuePerQuote} onChange={(e) => setAvgValuePerQuote(e.target.value)} />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2 justify-end pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Values
        </Button>
      </div>
    </form>
  );
}

// ─── Member Section (grouped view) ───────────────────────────────────────────

function MemberSection({ userId, userName, byMonth, currentUserId, isSuperAdmin, onEdit, onDelete, title }: {
  userId: string;
  userName: string;
  byMonth: Map<string, Map<string, WeeklyReportRow[]>>;
  currentUserId: string;
  isSuperAdmin: boolean;
  onEdit: (r: WeeklyReportRow) => void;
  onDelete: (id: string) => void;
  title?: string;
}) {
  const [open, setOpen] = useState(true);

  const allRows = Array.from(byMonth.values()).flatMap((bw) => Array.from(bw.values()).flat());
  const grandTotal = sumRows(allRows);
  const websitesAssigned = new Set(allRows.map((r) => r.websiteId)).size;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Member header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors border-b"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold uppercase shrink-0">
          {userName[0]}
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{userName}</span>
            {title && <span className="text-xs text-primary/70">{title}</span>}
          </div>
          <p className="text-xs text-muted-foreground">{websitesAssigned} website{websitesAssigned !== 1 ? "s" : ""} assigned</p>
        </div>
        <div className="flex gap-6 text-xs text-muted-foreground mr-4">
          {COLS.map((c) => (
            <span key={c}><span className="font-medium text-foreground">{(grandTotal as Record<string, number>)[c.toLowerCase()].toLocaleString()}</span> {c}</span>
          ))}
        </div>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="divide-y">
          {Array.from(byMonth.entries()).sort(([a], [b]) => b.localeCompare(a)).map(([mk, byWeek]) => (
            <MonthSection
              key={mk}
              monthKey={mk}
              byWeek={byWeek}
              userId={userId}
              currentUserId={currentUserId}
              isSuperAdmin={isSuperAdmin}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Month Section ────────────────────────────────────────────────────────────

function MonthSection({ monthKey, byWeek, userId, currentUserId, isSuperAdmin, onEdit, onDelete }: {
  monthKey: string;
  byWeek: Map<string, WeeklyReportRow[]>;
  userId: string;
  currentUserId: string;
  isSuperAdmin: boolean;
  onEdit: (r: WeeklyReportRow) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const allRows = Array.from(byWeek.values()).flat();
  const monthTotal = sumRows(allRows);
  const canModify = isSuperAdmin || userId === currentUserId;

  return (
    <div>
      {/* Month header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-5 py-2.5 bg-muted/20 hover:bg-muted/30 transition-colors text-sm"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        <span className="font-medium flex-1 text-left">{monthLabel(monthKey)}</span>
        <span className="text-xs text-muted-foreground">
          {COLS.map((c) => `${(monthTotal as Record<string, number>)[c.toLowerCase()].toLocaleString()} ${c}`).join(" · ")}
        </span>
      </button>

      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/10">
                <th className="text-left px-5 py-2 font-medium text-muted-foreground text-xs">Week</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Website</th>
                {COLS.map((c) => (
                  <th key={c} className="text-right px-4 py-2 font-medium text-muted-foreground text-xs">{c}</th>
                ))}
                {canModify && <th className="px-4 py-2 w-16" />}
              </tr>
            </thead>
            <tbody className="divide-y">
              {Array.from(byWeek.entries()).sort(([a], [b]) => b.localeCompare(a)).map(([weekStart, rows]) => {
                const weekTotal = sumRows(rows);
                return (
                  <Fragment key={weekStart}>
                    {rows.map((r) => (
                      <tr key={r.id} className="hover:bg-muted/10 transition-colors group">
                        <td className="px-5 py-2 text-xs text-muted-foreground whitespace-nowrap">{formatWeekRange(weekStart)}</td>
                        <td className="px-4 py-2 font-medium text-xs">{r.websiteName}</td>
                        {COLS.map((c) => (
                          <td key={c} className="px-4 py-2 text-right tabular-nums text-xs">{getVal(r, c).toLocaleString()}</td>
                        ))}
                        {canModify && (
                          <td className="px-4 py-2">
                            <div className="flex gap-1 justify-end">
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onEdit(r)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => onDelete(r.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                    {/* Week total row */}
                    {rows.length > 1 && (
                      <tr className="bg-primary/5 border-t">
                        <td className="px-5 py-1.5 text-xs font-semibold text-primary">Week Total</td>
                        <td className="px-4 py-1.5" />
                        {COLS.map((c) => (
                          <td key={c} className="px-4 py-1.5 text-right tabular-nums text-xs font-semibold text-primary">
                            {(weekTotal as Record<string, number>)[c.toLowerCase()].toLocaleString()}
                          </td>
                        ))}
                        {canModify && <td />}
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {/* Month total row */}
              <tr className="bg-primary/5 border-t-2">
                <td className="px-5 py-2 text-xs font-bold">Month Total</td>
                <td className="px-4 py-2" />
                {COLS.map((c) => (
                  <td key={c} className="px-4 py-2 text-right tabular-nums text-xs font-bold">
                    {(monthTotal as Record<string, number>)[c.toLowerCase()].toLocaleString()}
                  </td>
                ))}
                {canModify && <td />}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Bulk Add Form (all websites, one week) ───────────────────────────────────

type WebsiteFields = { clicks: string; impressions: string; indexation: string; rfqs: string };

function BulkReportForm({ assignedWebsites, onSaved, onCancel }: {
  assignedWebsites: AssignedWebsite[];
  onSaved: (rows: WeeklyReportRow[]) => void;
  onCancel: () => void;
}) {
  const weeks = weekOptions();
  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const [data, setData] = useState<Record<string, WebsiteFields>>(() =>
    Object.fromEntries(assignedWebsites.map((w) => [w.id, { clicks: "", impressions: "", indexation: "", rfqs: "" }]))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const selectClass = "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  function setField(wId: string, field: keyof WebsiteFields, value: string) {
    setData((prev) => ({ ...prev, [wId]: { ...prev[wId], [field]: value } }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);

    const results: WeeklyReportRow[] = [];
    for (const w of assignedWebsites) {
      const d = data[w.id];
      const res = await fetch("/api/weekly-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteId:   w.id,
          websiteName: w.name,
          weekStart,
          clicks:      Number(d.clicks)      || 0,
          impressions: Number(d.impressions)  || 0,
          indexation:  Number(d.indexation)   || 0,
          rfqs:        Number(d.rfqs)         || 0,
        }),
      });
      if (!res.ok) {
        setError((await res.json()).error ?? "Something went wrong.");
        setLoading(false);
        return;
      }
      results.push(await res.json());
    }

    setLoading(false);
    onSaved(results);
  }

  if (assignedWebsites.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">No websites assigned to you. Ask your admin to assign websites first.</p>
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>Close</Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Week selector */}
      <div className="space-y-1.5">
        <Label>Week <span className="text-destructive">*</span></Label>
        <select className={selectClass} value={weekStart} onChange={(e) => setWeekStart(e.target.value)}>
          {weeks.map((w) => <option key={w.start} value={w.start}>{w.label}</option>)}
        </select>
      </div>

      {/* Per-website rows */}
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 border-b">
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Website</th>
              {COLS.map((c) => (
                <th key={c} className="text-center px-3 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {assignedWebsites.map((w) => {
              const d = data[w.id];
              return (
                <tr key={w.id} className={cn("transition-colors", "hover:bg-muted/10")}>
                  <td className="px-4 py-2.5 font-medium text-sm whitespace-nowrap">{w.name}</td>
                  {(["clicks", "impressions", "indexation", "rfqs"] as const).map((field) => (
                    <td key={field} className="px-3 py-2">
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={d[field]}
                        onChange={(e) => setField(w.id, field, e.target.value)}
                        className="h-8 w-24 text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2 justify-end pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Submit Reports
        </Button>
      </div>
    </form>
  );
}

// ─── Edit Form (single row) ───────────────────────────────────────────────────

function EditForm({ existing, onSaved, onCancel }: {
  existing: WeeklyReportRow;
  onSaved: (r: WeeklyReportRow) => void;
  onCancel: () => void;
}) {
  const [clicks,      setClicks]      = useState(String(existing.clicks));
  const [impressions, setImpressions] = useState(String(existing.impressions));
  const [indexation,  setIndexation]  = useState(String(existing.indexation));
  const [rfqs,        setRfqs]        = useState(String(existing.rfqs));
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);

    const res = await fetch(`/api/weekly-reports/${existing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clicks:      Number(clicks)      || 0,
        impressions: Number(impressions) || 0,
        indexation:  Number(indexation)  || 0,
        rfqs:        Number(rfqs)        || 0,
      }),
    });

    setLoading(false);
    if (!res.ok) { setError((await res.json()).error ?? "Something went wrong."); return; }
    onSaved(await res.json());
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
        <span className="text-muted-foreground">Website: </span>
        <span className="font-medium">{existing.websiteName}</span>
        <span className="text-muted-foreground ml-3">Week: </span>
        <span className="font-medium">{formatWeekRange(existing.weekStart)}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {([
          { label: "Clicks",      value: clicks,      set: setClicks },
          { label: "Impressions", value: impressions,  set: setImpressions },
          { label: "Indexation",  value: indexation,  set: setIndexation },
          { label: "RFQs",        value: rfqs,        set: setRfqs },
        ] as const).map(({ label, value, set }) => (
          <div key={label} className="space-y-1.5">
            <Label>{label}</Label>
            <Input
              type="number"
              min="0"
              placeholder="0"
              value={value}
              onChange={(e) => (set as (v: string) => void)(e.target.value)}
              className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2 justify-end pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </form>
  );
}
