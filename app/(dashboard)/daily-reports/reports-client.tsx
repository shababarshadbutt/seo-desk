"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Loader2, ChevronDown, ChevronUp, CalendarDays, ChevronLeft, ChevronRight, Sheet, ClipboardList, Link2, Send, FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { DAILY_TASK_CATEGORIES } from "@/lib/daily-task-categories";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DailyReportRow {
  id: string;
  userId: string;
  userName: string;
  date: string;
  report: string;
  type: "report" | "leave" | "public-holiday";
  createdAt: string;
}

interface Props {
  reports: DailyReportRow[];
  currentUserId: string;
  viewerRole: string;
  members: { id: string; name: string }[];
}

interface DailyReportStats {
  submittedToday: number;
  liveBacklinksPlaced: number;
  gscBingDispatched: number | null;
  rfqsGenerated: number;
}

export interface DailyTaskRow {
  id: string;
  userId: string;
  userName: string;
  date: string;
  text: string;
  category: string;
  status: "pending" | "in-progress" | "done";
  createdAt: string;
}

const PKT = "Asia/Karachi";

function todayPKT() {
  return new Date().toLocaleDateString("en-CA", { timeZone: PKT });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    timeZone: PKT, day: "numeric", month: "short", year: "numeric",
  });
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function ReportsClient({ reports: initial, currentUserId, viewerRole, members }: Props) {
  const router = useRouter();
  const [reports, setReports] = useState(initial);
  useEffect(() => { setReports(initial); }, [initial]);

  const [addOpen, setAddOpen]   = useState(false);
  const [editItem, setEditItem] = useState<DailyReportRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reportSheetOpen, setReportSheetOpen] = useState(false);

  // Filters
  const [filterMember, setFilterMember] = useState("");
  const [filterFrom,   setFilterFrom]   = useState("");
  const [filterTo,     setFilterTo]     = useState("");

  // Stat cards (Part C addition)
  const [stats, setStats] = useState<DailyReportStats | null>(null);
  useEffect(() => {
    fetch(`/api/daily-reports/stats?date=${todayPKT()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  const canManage = (r: DailyReportRow) =>
    viewerRole === "super-admin" || r.userId === currentUserId;

  const canSeeMembers = viewerRole !== "admin";

  // Today's report for current user (to show Edit instead of Add)
  const todayStr = todayPKT();
  const todayReport = reports.find(
    (r) => r.userId === currentUserId && r.date.slice(0, 10) === todayStr
  ) ?? null;

  // Apply filters
  const filtered = reports.filter((r) => {
    if (filterMember && r.userId !== filterMember) return false;
    if (filterFrom && r.date.slice(0, 10) < filterFrom) return false;
    if (filterTo   && r.date.slice(0, 10) > filterTo)   return false;
    return true;
  });

  function onSaved(report: DailyReportRow, isNew: boolean) {
    if (isNew) {
      setReports((prev) => [report, ...prev]);
    } else {
      setReports((prev) => prev.map((r) => (r.id === report.id ? report : r)));
    }
    setAddOpen(false);
    setEditItem(null);
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const res = await fetch(`/api/daily-reports/${deleteId}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      setReports((prev) => prev.filter((r) => r.id !== deleteId));
      setDeleteId(null);
      router.refresh();
    }
  }

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Daily Reports</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {reports.length} report{reports.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canSeeMembers && (
            <Button variant="outline" onClick={() => setReportSheetOpen(true)}>
              <Sheet className="h-4 w-4" />
              Report Sheet
            </Button>
          )}
          {viewerRole !== "super-admin" && (
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              {todayReport ? "Add Another Report" : "Submit Today's Report"}
            </Button>
          )}
        </div>
      </div>

      {/* ── Stat cards ── */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={ClipboardList} color="primary" value={stats.submittedToday} label="Submitted Today" />
          <StatCard icon={Link2} color="emerald" value={stats.liveBacklinksPlaced} label="Live Backlinks Placed" />
          {stats.gscBingDispatched !== null && (
            <StatCard icon={Send} color="sky" value={stats.gscBingDispatched} label="GSC/Bing Dispatched" />
          )}
          <StatCard icon={FileCheck2} color="amber" value={stats.rfqsGenerated} label="RFQs Generated" />
        </div>
      )}

      {/* ── Today's Tasks (Part C addition — additive, alongside the freeform report below) ── */}
      {viewerRole !== "super-admin" && (
        <TodaysTasksCard currentUserId={currentUserId} />
      )}

      {/* ── Today's report banner ── */}
      {todayReport && viewerRole !== "super-admin" && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
            <CalendarDays className="h-4 w-4 shrink-0" />
            <span>You have already submitted a report for today.</span>
          </div>
          <Button size="sm" variant="outline" className="shrink-0 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
            onClick={() => setEditItem(todayReport)}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
        </div>
      )}

      {/* ── Filters (supervisor / super-admin) ── */}
      {canSeeMembers && (
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
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">From</Label>
            <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">To</Label>
            <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
          {(filterMember || filterFrom || filterTo) && (
            <Button size="sm" variant="outline"
              onClick={() => { setFilterMember(""); setFilterFrom(""); setFilterTo(""); }}>
              Clear
            </Button>
          )}
        </div>
      )}

      {/* ── Reports list ── */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">
            {reports.length === 0
              ? "No reports yet. Submit your first daily report."
              : "No reports match the selected filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <ReportCard
              key={r.id}
              report={r}
              showMember={canSeeMembers}
              canManage={canManage(r)}
              onEdit={() => setEditItem(r)}
              onDelete={() => setDeleteId(r.id)}
            />
          ))}
        </div>
      )}

      {/* ── Add dialog ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Submit Daily Report</DialogTitle>
            <DialogDescription>Share what you worked on today.</DialogDescription>
          </DialogHeader>
          <ReportForm
            onSaved={(r) => onSaved(r, true)}
            onCancel={() => setAddOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* ── Edit dialog ── */}
      <Dialog open={!!editItem} onOpenChange={(o) => { if (!o) setEditItem(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Report</DialogTitle>
            <DialogDescription>Update this daily report.</DialogDescription>
          </DialogHeader>
          {editItem && (
            <ReportForm
              key={editItem.id}
              existing={editItem}
              onSaved={(r) => onSaved(r, false)}
              onCancel={() => setEditItem(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ── Report Sheet ── */}
      {canSeeMembers && (
        <ReportSheetDialog
          open={reportSheetOpen}
          onClose={() => setReportSheetOpen(false)}
          reports={reports}
          members={members}
        />
      )}

      {/* ── Delete confirm ── */}
      <Dialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this report?</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end mt-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />} Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, color, value, label,
}: {
  icon: typeof ClipboardList;
  color: "primary" | "emerald" | "sky" | "amber";
  value: number;
  label: string;
}) {
  const colorClass = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    sky:     "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    amber:   "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  }[color];

  return (
    <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
      <div className={cn("rounded-lg p-2.5 shrink-0", colorClass)}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-2xl font-bold leading-none">{value.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </div>
    </div>
  );
}

// ─── Today's Tasks ────────────────────────────────────────────────────────────

function TodaysTasksCard({ currentUserId }: { currentUserId: string }) {
  const [tasks, setTasks] = useState<DailyTaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [category, setCategory] = useState<string>(DAILY_TASK_CATEGORIES[0]);
  const [adding, setAdding] = useState(false);
  const todayStr = todayPKT();

  useEffect(() => {
    fetch(`/api/daily-tasks?date=${todayStr}&userId=${currentUserId}`)
      .then((res) => (res.ok ? res.json() : []))
      .then(setTasks)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setAdding(true);
    const res = await fetch("/api/daily-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: todayStr, text, category }),
    });
    setAdding(false);
    if (res.ok) {
      const created = await res.json();
      setTasks((prev) => [created, ...prev]);
      setText("");
    }
  }

  async function cycleStatus(task: DailyTaskRow) {
    const next = task.status === "pending" ? "in-progress" : task.status === "in-progress" ? "done" : "pending";
    const res = await fetch(`/api/daily-tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: next } : t)));
  }

  async function removeTask(id: string) {
    const res = await fetch(`/api/daily-tasks/${id}`, { method: "DELETE" });
    if (res.ok) setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  const statusStyles: Record<DailyTaskRow["status"], string> = {
    pending:      "bg-muted text-muted-foreground border-border",
    "in-progress": "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-400/30",
    done:         "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-400/30",
  };
  const statusLabel: Record<DailyTaskRow["status"], string> = {
    pending: "Pending", "in-progress": "In Progress", done: "Done",
  };

  return (
    <div className="rounded-xl border bg-card shadow-sm p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Today&apos;s Tasks</h3>
        <span className="text-xs text-muted-foreground">— tagged work items for today, separate from your report below</span>
      </div>

      <form onSubmit={addTask} className="flex flex-wrap gap-2 items-center">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-9 rounded-lg border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {DAILY_TASK_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What did you do? e.g. Reached out to 5 guest post sites"
          className="h-9 flex-1 min-w-[180px] rounded-lg border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit" size="sm" className="h-9" disabled={adding || !text.trim()}>
          {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Add
        </Button>
      </form>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : tasks.length === 0 ? (
        <p className="text-xs text-muted-foreground">No tagged tasks logged for today yet.</p>
      ) : (
        <div className="space-y-1.5">
          {tasks.map((t) => (
            <div key={t.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
              <span className="text-xs rounded-full border px-2 py-0.5 bg-muted/50 text-muted-foreground shrink-0">{t.category}</span>
              <span className="flex-1 truncate">{t.text}</span>
              <button
                onClick={() => cycleStatus(t)}
                className={cn("text-[11px] rounded-full border px-2 py-0.5 shrink-0 font-medium", statusStyles[t.status])}
                title="Click to cycle status"
              >
                {statusLabel[t.status]}
              </button>
              <button onClick={() => removeTask(t.id)} className="shrink-0 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Report Card ──────────────────────────────────────────────────────────────

function ReportCard({
  report, showMember, canManage, onEdit, onDelete,
}: {
  report: DailyReportRow;
  showMember: boolean;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = report.report.length > 200;
  const preview = isLong && !expanded ? report.report.slice(0, 200) + "…" : report.report;

  return (
    <div className="rounded-xl border bg-card shadow-sm p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {showMember && (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold shrink-0">
              {initials(report.userName)}
            </div>
          )}
          <div>
            {showMember && (
              <p className="text-sm font-semibold leading-none">{report.userName}</p>
            )}
            <p className={cn("text-xs text-muted-foreground", showMember && "mt-0.5")}>
              {formatDate(report.date)}
            </p>
          </div>
        </div>
        {canManage && (
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </div>
        )}
      </div>

      <div className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90">
        {preview}
      </div>

      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          {expanded ? <><ChevronUp className="h-3 w-3" /> Show less</> : <><ChevronDown className="h-3 w-3" /> Read more</>}
        </button>
      )}
    </div>
  );
}

// ─── Report Form ──────────────────────────────────────────────────────────────

function ReportForm({
  existing, onSaved, onCancel,
}: {
  existing?: DailyReportRow;
  onSaved: (r: DailyReportRow) => void;
  onCancel: () => void;
}) {
  const [date,   setDate]   = useState(existing ? existing.date.slice(0, 10) : todayPKT());
  const [report, setReport] = useState(existing?.report ?? "");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!report.trim()) { setError("Report cannot be empty."); return; }
    setError(""); setLoading(true);

    const url    = existing ? `/api/daily-reports/${existing.id}` : "/api/daily-reports";
    const method = existing ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, report }),
    });

    setLoading(false);
    if (!res.ok) { setError((await res.json()).error ?? "Something went wrong."); return; }

    const data = await res.json();
    onSaved(data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Date</Label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="space-y-1.5">
        <Label>What did you work on today?</Label>
        <Textarea
          placeholder={"- Added 3 backlinks for client A\n- Completed landing page request for XYZ\n- Reviewed blog topics for ABC website"}
          className="min-h-[160px] text-sm leading-relaxed"
          value={report}
          onChange={(e) => setReport(e.target.value)}
          required
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2 justify-end pt-1">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {existing ? "Save Changes" : "Submit Report"}
        </Button>
      </div>
    </form>
  );
}

// ─── Report Sheet Dialog ──────────────────────────────────────────────────────

function ReportSheetDialog({
  open, onClose, reports, members,
}: {
  open: boolean;
  onClose: () => void;
  reports: DailyReportRow[];
  members: { id: string; name: string }[];
}) {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed

  const todayStr    = todayPKT();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthStr    = String(month + 1).padStart(2, "0");
  const yearStr     = String(year);
  const monthLabel  = new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }

  function nextMonth() {
    if (isCurrentMonth) return;
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  // Build lookup: "userId-YYYY-MM-DD" -> type
  const reportMap = new Map(reports.map((r) => [`${r.userId}-${r.date.slice(0, 10)}`, r.type ?? "report"]));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[95vw] w-full max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Report Sheet</DialogTitle>
          <DialogDescription>Monthly submission status per member.</DialogDescription>
        </DialogHeader>

        {/* Month navigation */}
        <div className="flex items-center justify-center gap-3 py-1">
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold w-44 text-center">{monthLabel}</span>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={nextMonth} disabled={isCurrentMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Grid */}
        <div className="overflow-auto flex-1 rounded-xl border">
          <table className="text-xs border-collapse min-w-full">
            <thead>
              <tr className="bg-muted/50">
                <th className="sticky left-0 z-10 bg-muted/80 border-b border-r px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap min-w-[160px]">
                  Member
                </th>
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                  const dow = new Date(year, month, day).getDay();
                  const isWeekend = dow === 0 || dow === 6;
                  const dayLabel = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dow];
                  return (
                    <th key={day} className={cn("border-b border-r px-2 py-2.5 font-medium text-center min-w-[36px]", isWeekend ? "bg-muted/60 text-muted-foreground/50" : "text-muted-foreground")}>
                      <div>{day}</div>
                      <div className="text-[9px] leading-none mt-0.5">{dayLabel}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-muted/20 transition-colors">
                  <td className="sticky left-0 z-10 bg-card border-r px-4 py-2.5 font-medium whitespace-nowrap">
                    {member.name}
                  </td>
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                    const dateStr = `${yearStr}-${monthStr}-${String(day).padStart(2, "0")}`;
                    const isFuture = dateStr > todayStr;
                    const isWeekend = [0, 6].includes(new Date(year, month, day).getDay());
                    const reportType = reportMap.get(`${member.id}-${dateStr}`);
                    const hasReport  = reportType !== undefined;
                    const isLeave    = reportType === "leave";
                    const isHoliday  = reportType === "public-holiday";
                    return (
                      <td key={day} className={cn("border-r px-1 py-2.5 text-center", isWeekend && "bg-muted/40")}>
                        {isWeekend ? null : isFuture ? (
                          <span className="text-muted-foreground/40 text-xs">—</span>
                        ) : isHoliday ? (
                          <span className="text-purple-600 dark:text-purple-400 font-bold text-xs">PH</span>
                        ) : isLeave ? (
                          <span className="text-amber-600 dark:text-amber-400 font-bold text-xs">L</span>
                        ) : hasReport ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
                        ) : (
                          <span className="text-rose-600 dark:text-rose-400 font-bold">✗</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 pt-1 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1"><span className="text-emerald-600 dark:text-emerald-400 font-bold">✓</span> Submitted</span>
          <span className="flex items-center gap-1"><span className="text-amber-600 dark:text-amber-400 font-bold">L</span> Leave</span>
          <span className="flex items-center gap-1"><span className="text-purple-600 dark:text-purple-400 font-bold">PH</span> Public Holiday</span>
          <span className="flex items-center gap-1"><span className="text-rose-600 dark:text-rose-400 font-bold">✗</span> Missing</span>
          <span className="flex items-center gap-1"><span className="text-muted-foreground/40">—</span> Future</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-muted/60 border" /> Weekend (off)</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
