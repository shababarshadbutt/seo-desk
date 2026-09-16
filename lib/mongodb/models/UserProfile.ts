import mongoose, { Document, Model, Schema } from "mongoose";

// Part F addition — new, separate collection holding supplementary per-user
// display data (currently just a job title) that has no home on the existing,
// protected User model. Auto-seeded with a placeholder value on first read
// (see app/api/user-profiles/route.ts) so the *structure* exists from day
// one — turning a placeholder into a real value later is a PATCH, not a
// schema change or migration.
export interface IUserProfile extends Document {
  userId: string;
  title: string;
  isPlaceholder: boolean;
  updatedAt: Date;
}

const UserProfileSchema = new Schema<IUserProfile>({
  userId:        { type: String, required: true, unique: true, index: true },
  title:         { type: String, required: true },
  isPlaceholder: { type: Boolean, default: true },
  updatedAt:     { type: Date, default: () => new Date() },
});

const UserProfile: Model<IUserProfile> =
  mongoose.models.UserProfile ??
  mongoose.model<IUserProfile>("UserProfile", UserProfileSchema);

export default UserProfile;
