"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Pencil, Trash2, Loader2, ExternalLink,
  ChevronUp, ChevronDown, ClipboardList, Globe,
  CheckCircle2, XCircle, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChecklistPoint {
  id: string;
  heading: string;
  description: string;
  order: number;
}

export interface AuditResult {
  pointId: string;
  heading: string;
  checked: boolean;
  details: string;
}

export interface AuditRecordRow {
  id: string;
  websiteName: string;
  websiteUrl: string;
  submittedBy: string;
  submittedByName: string;
  date: string;
  results: AuditResult[];
  createdAt: string;
}

export interface AuditReviewRow {
  id: string;
  auditRecordId: string;
  reviewerUserId: string;
  reviewerName: string;
  status: "approved" | "rejected";
  rejectionReason: string;
  reviewedAt: string;
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

export function AuditClient({
  records: initialRecords,
  checklistPoints: initialPoints,
  currentUserId,
  viewerRole,
  members,
}: {
  records: AuditRecordRow[];
  checklistPoints: ChecklistPoint[];
  currentUserId: string;
  viewerRole: string;
  members: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [records, setRecords] = useState(initialRecords);
  const [points, setPoints] = useState(initialPoints);
  useEffect(() => { setRecords(initialRecords); }, [initialRecords]);
  useEffect(() => { setPoints(initialPoints); }, [initialPoints]);

  const [newAuditOpen, setNewAuditOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);

  const [filterMember, setFilterMember] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const isSuperAdmin = viewerRole === "super-admin";
  const isSupervisor = viewerRole === "sub-lead";
  const canReviewRole = isSuperAdmin || isSupervisor;
  const canSeeMembers = viewerRole !== "admin";

  // QA review workflow (Part C addition) — fetched once, joined client-side
  // by auditRecordId. The existing AuditRecord model/routes are untouched.
  const [reviews, setReviews] = useState<AuditReviewRow[]>([]);
  useEffect(() => {
    fetch("/api/audit-reviews")
      .then((res) => (res.ok ? res.json() : []))
      .then(setReviews)
      .catch(() => setReviews([]));
  }, []);
  const reviewMap = new Map(reviews.map((r) => [r.auditRecordId, r]));

  async function reviewRecord(recordId: string, action: "approve" | "reject", rejectionReason?: string) {
    const res = await fetch("/api/audit-reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auditRecordId: recordId, action, rejectionReason }),
    });
    if (res.ok) {
      const review = await res.json();
      setReviews((prev) => [...prev.filter((r) => r.auditRecordId !== recordId), review]);
    } else {
      alert((await res.json()).error ?? "Failed to submit review.");
    }
  }

  const filtered = records.filter((r) => {
    if (filterMember && r.submittedBy !== filterMember) return false;
    if (filterFrom && r.date.slice(0, 10) < filterFrom) return false;
    if (filterTo && r.date.slice(0, 10) > filterTo) return false;
    return true;
  });

  const selectedRecord = filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null;

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const res = await fetch(`/api/audit-records/${deleteId}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      setRecords((prev) => prev.filter((r) => r.id !== deleteId));
      if (selectedId === deleteId) setSelectedId(null);
      setDeleteId(null);
      router.refresh();
    }
  }

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Website Audits</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {records.length} audit{records.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isSuperAdmin && (
            <Button variant="outline" onClick={() => setChecklistOpen(true)}>
              <ClipboardList className="h-4 w-4" />
              Manage Checklist
            </Button>
          )}
          <Button onClick={() => setNewAuditOpen(true)} disabled={points.length === 0}>
            <Plus className="h-4 w-4" />
            New Audit
          </Button>
        </div>
      </div>

      {/* ── No checklist warning ── */}
      {points.length === 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          {isSuperAdmin
            ? "No checklist points yet. Click \"Manage Checklist\" to add points before submitting audits."
            : "No checklist points have been configured yet. Contact your admin."}
        </div>
      )}

      {/* ── Filters ── */}
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
                {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
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

      {/* ── Master-detail: list on the left, scored detail panel on the right ── */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">
            {records.length === 0
              ? "No audits yet. Click \"New Audit\" to get started."
              : "No audits match the selected filters."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4 items-start">
          {/* List */}
          <div className="space-y-2">
            {filtered.map((r) => {
              const checkedCount = r.results.filter((res) => res.checked).length;
              const totalCount = r.results.length;
              const pct = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;
              const review = reviewMap.get(r.id);
              const isSelected = selectedRecord?.id === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className={cn(
                    "w-full text-left rounded-xl border p-3 transition-colors",
                    isSelected ? "border-primary bg-primary/5 shadow-sm" : "bg-card hover:bg-muted/30"
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    {canSeeMembers && (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold shrink-0 mt-0.5">
                        {initials(r.submittedByName)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-sm truncate">{r.websiteName}</p>
                        <a
                          href={r.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-primary/80 hover:text-primary shrink-0"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      {canSeeMembers && (
                        <p className="text-xs text-muted-foreground truncate">{r.submittedByName}</p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1">
                        <p className="text-xs text-muted-foreground">{formatDate(r.date)}</p>
                        <span className="text-xs font-medium text-muted-foreground">· {pct}%</span>
                        {review && <ReviewStatusPill status={review.status} compact />}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detail panel — shown first on mobile (order-first) so selecting/viewing
              an audit doesn't require scrolling past the whole list; desktop keeps
              its natural grid-column position via lg:order-none. */}
          <div className="order-first lg:order-none rounded-xl border bg-card shadow-sm p-5">
            {selectedRecord ? (
              <AuditDetailPanel
                record={selectedRecord}
                canDelete={isSuperAdmin || selectedRecord.submittedBy === currentUserId}
                onDelete={() => setDeleteId(selectedRecord.id)}
                review={reviewMap.get(selectedRecord.id) ?? null}
                canReviewRole={canReviewRole}
                onReview={(action, reason) => reviewRecord(selectedRecord.id, action, reason)}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Select an audit to view its details.</p>
            )}
          </div>
        </div>
      )}

      {/* ── New Audit Dialog ── */}
      <Dialog open={newAuditOpen} onOpenChange={setNewAuditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Website Audit</DialogTitle>
            <DialogDescription>Walk through the checklist and record your findings.</DialogDescription>
          </DialogHeader>
          <NewAuditForm
            key={newAuditOpen ? "open" : "closed"}
            points={points}
            onSaved={(record) => {
              setRecords((prev) => [record, ...prev]);
              setNewAuditOpen(false);
              router.refresh();
            }}
            onCancel={() => setNewAuditOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <Dialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this audit?</DialogTitle>
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

      {/* ── Checklist Manager (super-admin only) ── */}
      {isSuperAdmin && (
        <Dialog open={checklistOpen} onOpenChange={setChecklistOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Manage Checklist</DialogTitle>
              <DialogDescription>Add, edit, reorder, or remove audit checklist points.</DialogDescription>
            </DialogHeader>
            <ChecklistManager points={points} onPointsChange={setPoints} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─── New Audit Form ───────────────────────────────────────────────────────────

function NewAuditForm({
  points,
  onSaved,
  onCancel,
}: {
  points: ChecklistPoint[];
  onSaved: (record: AuditRecordRow) => void;
  onCancel: () => void;
}) {
  const [websiteName, setWebsiteName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [date, setDate] = useState(todayPKT());
  const [results, setResults] = useState<AuditResult[]>(
    points.map((p) => ({ pointId: p.id, heading: p.heading, checked: false, details: "" }))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function toggleCheck(idx: number) {
    setResults((prev) => prev.map((r, i) => i === idx ? { ...r, checked: !r.checked } : r));
  }

  function setDetails(idx: number, details: string) {
    setResults((prev) => prev.map((r, i) => i === idx ? { ...r, details } : r));
  }

  const canSave =
    websiteName.trim() !== "" &&
    websiteUrl.trim() !== "" &&
    results.every((r) => !r.checked || r.details.trim() !== "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setError("");
    setLoading(true);
    const res = await fetch("/api/audit-records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ websiteName, websiteUrl, date, results }),
    });
    setLoading(false);
    if (!res.ok) { setError((await res.json()).error ?? "Something went wrong."); return; }
    onSaved(await res.json());
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Website Name <span className="text-destructive">*</span></Label>
        <Input
          placeholder="e.g. Aviation Axis"
          value={websiteName}
          onChange={(e) => setWebsiteName(e.target.value)}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label>Website URL <span className="text-destructive">*</span></Label>
        <Input
          type="url"
          placeholder="https://example.com"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          required
        />
      </div>

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

      <div className="border-t pt-4 space-y-3">
        <p className="text-sm font-medium text-muted-foreground">
          Checklist — {results.filter((r) => r.checked).length}/{results.length} checked
        </p>
        {results.map((result, idx) => {
          const point = points[idx];
          return (
            <div
              key={result.pointId}
              className={cn(
                "rounded-xl border p-4 space-y-3 transition-colors",
                result.checked ? "border-primary/30 bg-primary/5" : "bg-card"
              )}
            >
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={result.checked}
                  onChange={() => toggleCheck(idx)}
                  className="mt-0.5 h-4 w-4 rounded border-input accent-primary cursor-pointer shrink-0"
                />
                <div>
                  <p className="text-sm font-semibold leading-tight">{point.heading}</p>
                  {point.description && (
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{point.description}</p>
                  )}
                </div>
              </label>
              {result.checked && (
                <div className="pl-7">
                  <Textarea
                    placeholder="Describe what you found / checked for this point..."
                    value={result.details}
                    onChange={(e) => setDetails(idx, e.target.value)}
                    className="text-sm min-h-[80px] w-full"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2 justify-end pt-1 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={loading || !canSave}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Audit
        </Button>
      </div>
    </form>
  );
}

// ─── Review status pill (Part C addition) ─────────────────────────────────────

function ReviewStatusPill({ status, compact }: { status: "approved" | "rejected"; compact?: boolean }) {
  const isApproved = status === "approved";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium",
        compact ? "text-[10px] px-1.5 py-0" : "text-xs px-2 py-0.5",
        isApproved
          ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "border-rose-400/30 bg-rose-500/10 text-rose-700 dark:text-rose-400"
      )}
    >
      {isApproved ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {isApproved ? "Approved" : "Rejected"}
    </span>
  );
}

// ─── Audit Detail Panel (Part C addition — master-detail + score + QA review) ──

function AuditDetailPanel({
  record, canDelete, onDelete, review, canReviewRole, onReview,
}: {
  record: AuditRecordRow;
  canDelete: boolean;
  onDelete: () => void;
  review: AuditReviewRow | null;
  canReviewRole: boolean;
  onReview: (action: "approve" | "reject", rejectionReason?: string) => void;
}) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const checkedResults = record.results.filter((r) => r.checked);
  const uncheckedResults = record.results.filter((r) => !r.checked);
  const total = record.results.length;
  const pct = total > 0 ? Math.round((checkedResults.length / total) * 100) : 0;

  function submitReject() {
    onReview("reject", rejectReason.trim());
    setRejectOpen(false);
    setRejectReason("");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="grid grid-cols-2 gap-3 text-sm flex-1">
          <div>
            <p className="text-xs text-muted-foreground">Website</p>
            <p className="font-medium">{record.websiteName}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">URL</p>
            <a href={record.websiteUrl} target="_blank" rel="noopener noreferrer"
              className="font-medium text-primary hover:underline flex items-center gap-1 break-all">
              <Globe className="h-3.5 w-3.5 shrink-0" />
              {record.websiteUrl}
            </a>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Date</p>
            <p className="font-medium">{formatDate(record.date)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Submitted By</p>
            <p className="font-medium">{record.submittedByName}</p>
          </div>
        </div>
        {canDelete && (
          <Button variant="ghost" size="sm" onClick={onDelete} className="shrink-0">
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        )}
      </div>

      {/* Compliance score + progress bar */}
      <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Compliance Score</p>
          <p className="text-2xl font-bold">{pct}%</p>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-rose-500")}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">{checkedResults.length}/{total} checklist points passed</p>
      </div>

      {/* QA review (Part C addition) */}
      {(review || canReviewRole) && (
        <div className="rounded-xl border p-4 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm font-medium">QA Review</p>
            {review ? (
              <div className="flex items-center gap-2">
                <ReviewStatusPill status={review.status} />
                <span className="text-xs text-muted-foreground">by {review.reviewerName}</span>
              </div>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" /> Pending review
              </span>
            )}
          </div>
          {review?.status === "rejected" && review.rejectionReason && (
            <p className="text-xs text-rose-600 dark:text-rose-400">Reason: {review.rejectionReason}</p>
          )}
          {canReviewRole && (
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
                onClick={() => onReview("approve")}>
                <CheckCircle2 className="h-3.5 w-3.5" /> Approve
              </Button>
              <Button size="sm" variant="outline" className="border-rose-500/40 text-rose-700 dark:text-rose-400 hover:bg-rose-500/10"
                onClick={() => setRejectOpen(true)}>
                <XCircle className="h-3.5 w-3.5" /> Reject
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="border-t pt-4 space-y-3">
        <p className="text-sm font-medium text-muted-foreground">
          {checkedResults.length}/{total} points checked
        </p>

        {checkedResults.map((r) => (
          <div key={r.pointId} className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-emerald-700 dark:text-emerald-400 font-bold text-sm">✓</span>
              <p className="text-sm font-medium">{r.heading}</p>
            </div>
            {r.details && (
              <p className="text-sm text-foreground/80 pl-5 whitespace-pre-wrap leading-relaxed">{r.details}</p>
            )}
          </div>
        ))}

        {uncheckedResults.map((r) => (
          <div key={r.pointId} className="rounded-xl border bg-muted/30 p-3">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">○</span>
              <p className="text-sm text-muted-foreground">{r.heading}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Reject reason dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reject this audit?</DialogTitle>
            <DialogDescription>Let the submitter know what needs fixing.</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="e.g. Missing details on 2 checklist points, please redo."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="min-h-[100px] text-sm"
          />
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={submitReject}>Reject</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Checklist Manager ────────────────────────────────────────────────────────

function ChecklistManager({
  points: initialPoints,
  onPointsChange,
}: {
  points: ChecklistPoint[];
  onPointsChange: (pts: ChecklistPoint[]) => void;
}) {
  const [points, setPoints] = useState(initialPoints);
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function sync(pts: ChecklistPoint[]) {
    setPoints(pts);
    onPointsChange(pts);
  }

  async function handleAdd(heading: string, description: string) {
    setSaving(true);
    const res = await fetch("/api/audit-checklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ heading, description }),
    });
    setSaving(false);
    if (!res.ok) return;
    sync([...points, await res.json()]);
    setAddOpen(false);
  }

  async function handleEdit(id: string, heading: string, description: string) {
    setSaving(true);
    const res = await fetch(`/api/audit-checklist/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ heading, description }),
    });
    setSaving(false);
    if (!res.ok) return;
    const updated = await res.json();
    sync(points.map((p) => (p.id === id ? updated : p)));
    setEditId(null);
  }

  async function handleDelete(id: string) {
    setSaving(true);
    await fetch(`/api/audit-checklist/${id}`, { method: "DELETE" });
    setSaving(false);
    sync(points.filter((p) => p.id !== id));
  }

  async function movePoint(idx: number, dir: -1 | 1) {
    const newPoints = [...points];
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= newPoints.length) return;
    [newPoints[idx], newPoints[targetIdx]] = [newPoints[targetIdx], newPoints[idx]];
    const reordered = newPoints.map((p, i) => ({ ...p, order: i }));
    sync(reordered);
    await fetch("/api/audit-checklist/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reordered.map((p) => ({ id: p.id, order: p.order }))),
    });
  }

  return (
    <div className="space-y-3">
      {points.length === 0 && !addOpen && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No checklist points yet. Add your first point below.
        </p>
      )}

      {points.map((point, idx) =>
        editId === point.id ? (
          <PointForm
            key={point.id}
            initial={point}
            onSave={(h, d) => handleEdit(point.id, h, d)}
            onCancel={() => setEditId(null)}
            saving={saving}
          />
        ) : (
          <div key={point.id} className="rounded-xl border bg-card p-4 flex items-start gap-3">
            <div className="flex flex-col gap-1 shrink-0 mt-0.5">
              <button
                onClick={() => movePoint(idx, -1)}
                disabled={idx === 0}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => movePoint(idx, 1)}
                disabled={idx === points.length - 1}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{point.heading}</p>
              {point.description && (
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{point.description}</p>
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              <Button variant="ghost" size="sm" onClick={() => setEditId(point.id)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(point.id)}>
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          </div>
        )
      )}

      {addOpen ? (
        <PointForm
          onSave={handleAdd}
          onCancel={() => setAddOpen(false)}
          saving={saving}
        />
      ) : (
        <Button variant="outline" className="w-full" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> Add Point
        </Button>
      )}
    </div>
  );
}

// ─── Point Form ───────────────────────────────────────────────────────────────

function PointForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: ChecklistPoint;
  onSave: (heading: string, description: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [heading, setHeading] = useState(initial?.heading ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");

  return (
    <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
      <div className="space-y-1.5">
        <Label>Heading <span className="text-destructive">*</span></Label>
        <Input
          placeholder="e.g. Meta Tags"
          value={heading}
          onChange={(e) => setHeading(e.target.value)}
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea
          placeholder="What to check for this point..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="text-sm min-h-[80px]"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button
          size="sm"
          disabled={!heading.trim() || saving}
          onClick={() => onSave(heading.trim(), description.trim())}
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {initial ? "Save Changes" : "Add Point"}
        </Button>
      </div>
    </div>
  );
}
