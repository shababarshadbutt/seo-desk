import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, AuditRecord, Group } from "@/lib/mongodb";
import AuditReview from "@/lib/mongodb/models/AuditReview";

export const dynamic = "force-dynamic";

function toRow(r: { _id: { toString(): string }; auditRecordId: string; reviewerUserId: string; reviewerName: string; status: string; rejectionReason: string; reviewedAt: Date }) {
  return {
    id:              r._id.toString(),
    auditRecordId:   r.auditRecordId,
    reviewerUserId:  r.reviewerUserId,
    reviewerName:    r.reviewerName,
    status:          r.status,
    rejectionReason: r.rejectionReason ?? "",
    reviewedAt:      r.reviewedAt.toISOString(),
  };
}

// GET /api/audit-reviews — reviews visible under the same role-scoping as
// /api/audit-records (admin=own submissions' reviews, sub-lead=own+group,
// super-admin=all).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const myId = session.user.id;

  await connectDB();

  const recordFilter: Record<string, unknown> = {};
  if (role === "admin") {
    recordFilter.submittedBy = myId;
  } else if (role === "sub-lead") {
    const group = await Group.findOne({ leadUserId: myId }).lean();
    const memberIds = group ? group.memberUserIds.map((id) => id.toString()) : [];
    recordFilter.submittedBy = { $in: [myId, ...memberIds] };
  }
  // super-admin: no filter, sees all

  const visibleRecordIds = (
    await AuditRecord.find(recordFilter).select("_id").lean()
  ).map((r) => r._id.toString());

  const reviews = await AuditReview.find({ auditRecordId: { $in: visibleRecordIds } }).lean();

  return Response.json(reviews.map(toRow));
}

// POST /api/audit-reviews — { auditRecordId, action: "approve"|"reject", rejectionReason? }
// Gated exactly like Backlinks' approve/reject: super-admin or sub-lead
// (scoped to their own group's submissions) may review. Upserts one review
// per auditRecordId (latest decision wins).
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const myId = session.user.id;
  const isSuperAdmin = role === "super-admin";
  const isSupervisor = role === "sub-lead";

  if (!isSuperAdmin && !isSupervisor) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { auditRecordId, action, rejectionReason } = body;

  if (!auditRecordId || (action !== "approve" && action !== "reject")) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  await connectDB();

  const record = await AuditRecord.findById(auditRecordId).lean();
  if (!record) return Response.json({ error: "Audit record not found." }, { status: 404 });

  if (isSupervisor) {
    const group = await Group.findOne({ leadUserId: myId }).lean();
    const allowed = group
      ? [myId, ...group.memberUserIds.map((id) => id.toString())]
      : [myId];
    if (!allowed.includes(record.submittedBy)) {
      return Response.json({ error: "You can only review your own group's audits." }, { status: 403 });
    }
  }

  const update = {
    auditRecordId,
    reviewerUserId: myId,
    reviewerName: session.user.name ?? "",
    status: action === "approve" ? "approved" : "rejected",
    rejectionReason: action === "reject" ? (rejectionReason ?? "") : "",
    reviewedAt: new Date(),
  };

  const review = await AuditReview.findOneAndUpdate(
    { auditRecordId },
    { $set: update },
    { upsert: true, new: true }
  );

  return Response.json(toRow(review));
}

// DELETE /api/audit-reviews?auditRecordId= — clears a review decision,
// returning the record to "Pending review". Super-admin only (an undo path
// for an accidental approve/reject).
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "super-admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const auditRecordId = searchParams.get("auditRecordId");
  if (!auditRecordId) return Response.json({ error: "auditRecordId is required." }, { status: 400 });

  await connectDB();
  await AuditReview.deleteOne({ auditRecordId });

  return Response.json({ success: true });
}
