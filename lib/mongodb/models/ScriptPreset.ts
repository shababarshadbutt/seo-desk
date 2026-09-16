import mongoose, { Document, Model, Schema } from "mongoose";

// Part B addition (Scripts "Custom Script" → saved input presets). New file,
// does not modify any existing protected model or the lib/mongodb barrel export —
// consumed directly via '@/lib/mongodb/models/ScriptPreset' by the new preset API routes.
export interface IScriptPreset extends Document {
  userId: string;
  scriptSlug: string;
  name: string;
  inputs: Record<string, unknown>;
  createdAt: Date;
}

const ScriptPresetSchema = new Schema<IScriptPreset>(
  {
    userId:     { type: String, required: true },
    scriptSlug: { type: String, required: true },
    name:       { type: String, required: true, trim: true },
    inputs:     { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ScriptPresetSchema.index({ userId: 1, scriptSlug: 1 });
ScriptPresetSchema.index({ userId: 1, scriptSlug: 1, name: 1 }, { unique: true });

const ScriptPreset: Model<IScriptPreset> =
  mongoose.models.ScriptPreset ??
  mongoose.model<IScriptPreset>("ScriptPreset", ScriptPresetSchema);

export default ScriptPreset;
