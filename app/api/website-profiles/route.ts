import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import WebsiteProfile from "@/lib/mongodb/models/WebsiteProfile";
import { fakeIndustryForWebsite } from "@/lib/fake-website-industries";

export const dynamic = "force-dynamic";

// GET /api/website-profiles?websiteIds=a,b,c — bulk read, auto-seeding any
// missing profile with a deterministic placeholder industry (persisted
// immediately, stable from then on).
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
      updatedAt: new Date(),
    }));
    try {
      seeded = (await WebsiteProfile.insertMany(docs, { ordered: false })) as unknown as typeof existing;
    } catch {
      seeded = await WebsiteProfile.find({ websiteId: { $in: missingIds } }).lean();
    }
  }

  const all = [...existing, ...seeded];

  return Response.json(
    Object.fromEntries(
      all.map((p) => [p.websiteId, { industry: p.industry, isPlaceholder: p.isPlaceholder }])
    )
  );
}
