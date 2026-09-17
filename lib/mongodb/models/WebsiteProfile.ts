import mongoose, { Document, Model, Schema } from "mongoose";

// Part F addition — new, separate collection holding supplementary per-website
// display data (currently just an industry vertical) that has no home on the
// existing, protected Website model. Auto-seeded with a placeholder value on
// first read (see app/api/website-profiles/route.ts) — the structure exists
// from day one, so wiring a real classification later is a PATCH, not a
// schema change.
//
// Part G addition — `platform`/`healthScore` follow the exact same pattern as
// `industry` above (their own `isPlaceholder`-style flags, seeded + backfilled
// in the same route, PATCHable to a real value later). All four fields are
// optional/defaulted since documents created before Part G only have
// `industry`/`isPlaceholder`.
export interface IWebsiteProfile extends Document {
  websiteId: string;
  industry: string;
  isPlaceholder: boolean;
  platform: string;
  platformIsPlaceholder: boolean;
  healthScore: number | null;
  healthIsPlaceholder: boolean;
  updatedAt: Date;
}

const WebsiteProfileSchema = new Schema<IWebsiteProfile>({
  websiteId:             { type: String, required: true, unique: true, index: true },
  industry:              { type: String, required: true },
  isPlaceholder:         { type: Boolean, default: true },
  platform:              { type: String, default: "" },
  platformIsPlaceholder: { type: Boolean, default: true },
  healthScore:           { type: Number, default: null },
  healthIsPlaceholder:   { type: Boolean, default: true },
  updatedAt:             { type: Date, default: () => new Date() },
});

const WebsiteProfile: Model<IWebsiteProfile> =
  mongoose.models.WebsiteProfile ??
  mongoose.model<IWebsiteProfile>("WebsiteProfile", WebsiteProfileSchema);

export default WebsiteProfile;
