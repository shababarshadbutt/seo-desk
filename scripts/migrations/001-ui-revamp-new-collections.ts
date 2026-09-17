/**
 * One-time (but idempotent) migration to create the 6 collections added by
 * the UI revamp and their indexes. Safe to re-run — only ever creates, never
 * drops or modifies existing collections/indexes.
 *
 * Run with: npm run migrate
 * (or directly: npx tsx scripts/migrations/001-ui-revamp-new-collections.ts)
 *
 * Set MONGODB_URI in .env.local (or the environment) before running.
 */
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import mongoose, { Model } from "mongoose";
import { connectDB } from "../../lib/mongodb";
import AuditReview from "../../lib/mongodb/models/AuditReview";
import DailyTask from "../../lib/mongodb/models/DailyTask";
import ReportMetricsConfig from "../../lib/mongodb/models/ReportMetricsConfig";
import ScriptPreset from "../../lib/mongodb/models/ScriptPreset";
import UserProfile from "../../lib/mongodb/models/UserProfile";
import WebsiteProfile from "../../lib/mongodb/models/WebsiteProfile";

const MODELS: Model<any>[] = [
  AuditReview,
  DailyTask,
  ReportMetricsConfig,
  ScriptPreset,
  UserProfile,
  WebsiteProfile,
];

async function main() {
  await connectDB();
  const db = mongoose.connection.db!;

  for (const model of MODELS) {
    const name = model.collection.collectionName;
    const existingCollections = await db
      .listCollections({ name })
      .toArray();
    const alreadyExisted = existingCollections.length > 0;

    await model.createCollection();
    await model.createIndexes();

    console.log(
      `[${alreadyExisted ? "already existed" : "created"}] ${name} — indexes ensured`
    );
  }

  console.log("Migration complete. No existing collection was modified.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
