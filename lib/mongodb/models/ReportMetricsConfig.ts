import mongoose, { Document, Model, Schema } from "mongoose";

// Part F addition — new, separate singleton collection (same singleton
// pattern as the existing, protected Settings model, but a new file) for the
// handful of Weekly Reports stat-card numbers with no real data source yet
// (weekly click target, SERP visibility index, verified-URL ratio, average
// value per RFQ). Auto-created with seed placeholder values on first read
// (see app/api/report-metrics-config/route.ts); a super-admin can PATCH real
// values in later without any schema change.
export interface IReportMetricsConfig extends Document {
  singleton: true;
  weeklyClickTarget: number;
  serpVisibilityIndex: number;
  verifiedUrlRatio: number;
  avgValuePerQuote: number;
  isPlaceholder: boolean;
  updatedAt: Date;
}

const ReportMetricsConfigSchema = new Schema<IReportMetricsConfig>({
  singleton:            { type: Boolean, default: true, immutable: true },
  weeklyClickTarget:    { type: Number, default: 3000 },
  serpVisibilityIndex:  { type: Number, default: 94.8 },
  verifiedUrlRatio:     { type: Number, default: 98.4 },
  avgValuePerQuote:     { type: Number, default: 14250 },
  isPlaceholder:        { type: Boolean, default: true },
  updatedAt:            { type: Date, default: () => new Date() },
});

ReportMetricsConfigSchema.index({ singleton: 1 }, { unique: true });

const ReportMetricsConfig: Model<IReportMetricsConfig> =
  mongoose.models.ReportMetricsConfig ??
  mongoose.model<IReportMetricsConfig>("ReportMetricsConfig", ReportMetricsConfigSchema);

export default ReportMetricsConfig;
