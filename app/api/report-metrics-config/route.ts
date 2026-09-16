import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import ReportMetricsConfig from "@/lib/mongodb/models/ReportMetricsConfig";

export const dynamic = "force-dynamic";

function toRow(c: { weeklyClickTarget: number; serpVisibilityIndex: number; verifiedUrlRatio: number; avgValuePerQuote: number; isPlaceholder: boolean }) {
  return {
    weeklyClickTarget: c.weeklyClickTarget,
    serpVisibilityIndex: c.serpVisibilityIndex,
    verifiedUrlRatio: c.verifiedUrlRatio,
    avgValuePerQuote: c.avgValuePerQuote,
    isPlaceholder: c.isPlaceholder,
  };
}

// GET /api/report-metrics-config — auto-creates the singleton with seed
// placeholder values on first call.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();

  let config = await ReportMetricsConfig.findOne({ singleton: true }).lean();
  if (!config) {
    config = (await ReportMetricsConfig.create({ singleton: true })).toObject();
  }

  return Response.json(toRow(config));
}

// PATCH /api/report-metrics-config — super-admin only, partial update of any
// of the 4 fields. Sets isPlaceholder to false once real values are entered.
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "super-admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const update: Record<string, number> = {};
  for (const key of ["weeklyClickTarget", "serpVisibilityIndex", "verifiedUrlRatio", "avgValuePerQuote"] as const) {
    if (typeof body[key] === "number" && Number.isFinite(body[key])) {
      update[key] = body[key];
    }
  }
  if (Object.keys(update).length === 0) {
    return Response.json({ error: "No valid fields to update." }, { status: 400 });
  }

  await connectDB();

  const updated = await ReportMetricsConfig.findOneAndUpdate(
    { singleton: true },
    { $set: { ...update, isPlaceholder: false, updatedAt: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return Response.json(toRow(updated));
}
