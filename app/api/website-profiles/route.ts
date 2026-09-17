import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import WebsiteProfile from "@/lib/mongodb/models/WebsiteProfile";
import { fakeIndustryForWebsite } from "@/lib/fake-website-industries";
import { fakePlatformForWebsite } from "@/lib/fake-website-platforms";
import { fakeHealthScoreForWebsite } from "@/lib/fake-website-health";

export const dynamic = "force-dynamic";

// GET /api/website-profiles?websiteIds=a,b,c — bulk read, auto-seeding any
// missing profile with deterministic placeholder values (industry, platform,
// health score — persisted immediately, stable from then on).
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const websiteIds = (searchParams.get("websiteIds") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (websiteIds.length === 0) return Response.json({ error: "websiteIds is required." }, { status: 400 });

  await connectDB();

  const existing = await WebsiteProfile.find({ websiteId: { $in: websiteIds } }).lean();
  const existingIds = new Set(existing.map((p) => p.websiteId));
  const missingIds = websiteIds.filter((id) => !existingIds.has(id));

  let seeded: typeof existing = [];
  if (missingIds.length > 0) {
    const docs = missingIds.map((websiteId) => ({
      websiteId,
      industry: fakeIndustryForWebsite(websiteId),
      isPlaceholder: true,
      platform: fakePlatformForWebsite(websiteId),
      platformIsPlaceholder: true,
      healthScore: fakeHealthScoreForWebsite(websiteId),
      healthIsPlaceholder: true,
      updatedAt: new Date(),
    }));
    try {
      seeded = (await WebsiteProfile.insertMany(docs, { ordered: false })) as unknown as typeof existing;
    } catch {
      seeded = await WebsiteProfile.find({ websiteId: { $in: missingIds } }).lean();
    }
  }

  // Backfill docs created before Part G (industry/isPlaceholder only) so
  // platform/healthScore aren't blank for websites already seeded via
  // Weekly Reports. Patched in-memory too, so this same response is complete.
  const needsBackfill = existing.filter((p) => !p.platform || p.healthScore == null);
  if (needsBackfill.length > 0) {
    await WebsiteProfile.bulkWrite(
      needsBackfill.map((p) => ({
        updateOne: {
          filter: { _id: p._id },
          update: {
            $set: {
              platform: p.platform || fakePlatformForWebsite(p.websiteId),
              platformIsPlaceholder: p.platform ? p.platformIsPlaceholder : true,
              healthScore: p.healthScore ?? fakeHealthScoreForWebsite(p.websiteId),
              healthIsPlaceholder: p.healthScore != null ? p.healthIsPlaceholder : true,
            },
          },
        },
      }))
    );
    for (const p of needsBackfill) {
      if (!p.platform) {
        p.platform = fakePlatformForWebsite(p.websiteId);
        p.platformIsPlaceholder = true;
      }
      if (p.healthScore == null) {
        p.healthScore = fakeHealthScoreForWebsite(p.websiteId);
        p.healthIsPlaceholder = true;
      }
    }
  }

  const all = [...existing, ...seeded];

  return Response.json(
    Object.fromEntries(
      all.map((p) => [
        p.websiteId,
        {
          industry: p.industry,
          isPlaceholder: p.isPlaceholder,
          platform: p.platform,
          platformIsPlaceholder: p.platformIsPlaceholder,
          healthScore: p.healthScore,
          healthIsPlaceholder: p.healthIsPlaceholder,
        },
      ])
    )
  );
}
