import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import WebsiteProfile from "@/lib/mongodb/models/WebsiteProfile";

export const dynamic = "force-dynamic";

// PATCH /api/website-profiles/[websiteId] — { industry?, platform?, healthScore? }
// — sets whichever real values are provided, clearing that field's own
// isPlaceholder flag. Super-admin only.
export async function PATCH(req: Request, { params }: { params: { websiteId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "super-admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const set: Record<string, unknown> = {};

  if (body.industry !== undefined) {
    const industry = typeof body.industry === "string" ? body.industry.trim() : "";
    if (!industry) return Response.json({ error: "Industry cannot be empty." }, { status: 400 });
    set.industry = industry;
    set.isPlaceholder = false;
  }

  if (body.platform !== undefined) {
    const platform = typeof body.platform === "string" ? body.platform.trim() : "";
    if (!platform) return Response.json({ error: "Platform cannot be empty." }, { status: 400 });
    set.platform = platform;
    set.platformIsPlaceholder = false;
  }

  if (body.healthScore !== undefined) {
    const healthScore = Number(body.healthScore);
    if (!Number.isFinite(healthScore) || healthScore < 0 || healthScore > 100) {
      return Response.json({ error: "Health score must be a number between 0 and 100." }, { status: 400 });
    }
    set.healthScore = healthScore;
    set.healthIsPlaceholder = false;
  }

  if (Object.keys(set).length === 0) {
    return Response.json({ error: "Nothing to update." }, { status: 400 });
  }

  set.updatedAt = new Date();

  await connectDB();

  const updated = await WebsiteProfile.findOneAndUpdate(
    { websiteId: params.websiteId },
    { $set: set },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return Response.json({
    websiteId: updated.websiteId,
    industry: updated.industry,
    isPlaceholder: updated.isPlaceholder,
    platform: updated.platform,
    platformIsPlaceholder: updated.platformIsPlaceholder,
    healthScore: updated.healthScore,
    healthIsPlaceholder: updated.healthIsPlaceholder,
  });
}
