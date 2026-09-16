import mongoose, { Document, Model, Schema } from "mongoose";

// Part F addition — new, separate collection holding supplementary per-website
// display data (currently just an industry vertical) that has no home on the
// existing, protected Website model. Auto-seeded with a placeholder value on
// first read (see app/api/website-profiles/route.ts) — the structure exists
// from day one, so wiring a real classification later is a PATCH, not a
// schema change.
export interface IWebsiteProfile extends Document {
  websiteId: string;
  industry: string;
  isPlaceholder: boolean;
  updatedAt: Date;
}

const WebsiteProfileSchema = new Schema<IWebsiteProfile>({
  websiteId:     { type: String, required: true, unique: true, index: true },
  industry:      { type: String, required: true },
  isPlaceholder: { type: Boolean, default: true },
  updatedAt:     { type: Date, default: () => new Date() },
});

const WebsiteProfile: Model<IWebsiteProfile> =
  mongoose.models.WebsiteProfile ??
  mongoose.model<IWebsiteProfile>("WebsiteProfile", WebsiteProfileSchema);

export default WebsiteProfile;
