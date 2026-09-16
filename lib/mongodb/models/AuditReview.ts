import mongoose, { Document, Model, Schema } from "mongoose";

export type AuditReviewStatus = "approved" | "rejected";

// Part C addition — new, separate collection for Website Audit's QA review
// workflow. Deliberately NOT a field added to the existing, protected
// AuditRecord.ts — this is an additive layer joined by auditRecordId, mirroring
// the already-proven Backlinks approve/reject pattern but reusing the existing
// sub-lead ("supervisor") / super-admin roles instead of a new "QA Lead" role.
export interface IAuditReview extends Document {
  auditRecordId: string;
  reviewerUserId: string;
  reviewerName: string;
  status: AuditReviewStatus;
  rejectionReason: string;
  reviewedAt: Date;
}

const AuditReviewSchema = new Schema<IAuditReview>({
  auditRecordId:   { type: String, required: true, unique: true, index: true },
  reviewerUserId:  { type: String, required: true },
  reviewerName:    { type: String, required: true },
  status:          { type: String, enum: ["approved", "rejected"], required: true },
  rejectionReason: { type: String, default: "" },
  reviewedAt:      { type: Date, default: () => new Date() },
});

const AuditReview: Model<IAuditReview> =
  mongoose.models.AuditReview ??
  mongoose.model<IAuditReview>("AuditReview", AuditReviewSchema);

export default AuditReview;
