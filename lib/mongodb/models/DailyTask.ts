import mongoose, { Document, Model, Schema } from "mongoose";

export type DailyTaskStatus = "pending" | "in-progress" | "done";

// Part C addition — new, separate collection for Daily Reports' structured/tagged
// "Today's Tasks" feature. Deliberately NOT a field added to the existing,
// protected DailyReport.ts — this is an additive, optional layer alongside the
// existing freeform report submission, joined client-side by userId+date.
export interface IDailyTask extends Document {
  userId: string;
  userName: string;
  date: Date;
  text: string;
  category: string;
  status: DailyTaskStatus;
  createdAt: Date;
  updatedAt: Date;
}

const DailyTaskSchema = new Schema<IDailyTask>(
  {
    userId:   { type: String, required: true, index: true },
    userName: { type: String, required: true },
    date:     { type: Date, required: true },
    text:     { type: String, required: true, trim: true },
    category: { type: String, required: true },
    status:   { type: String, enum: ["pending", "in-progress", "done"], default: "pending" },
  },
  { timestamps: true }
);

DailyTaskSchema.index({ userId: 1, date: -1 });
DailyTaskSchema.index({ date: -1 });

const DailyTask: Model<IDailyTask> =
  mongoose.models.DailyTask ??
  mongoose.model<IDailyTask>("DailyTask", DailyTaskSchema);

export default DailyTask;
