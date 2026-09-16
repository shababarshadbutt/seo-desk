import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import UserProfile from "@/lib/mongodb/models/UserProfile";
import { fakeTitleForUser } from "@/lib/fake-user-titles";

export const dynamic = "force-dynamic";

// GET /api/user-profiles?userIds=a,b,c — bulk read, auto-seeding any missing
// profile with a deterministic placeholder title (persisted immediately, so
// the seed is stable from then on rather than recomputed per request).
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const userIds = (searchParams.get("userIds") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (userIds.length === 0) return Response.json({ error: "userIds is required." }, { status: 400 });

  await connectDB();

  const existing = await UserProfile.find({ userId: { $in: userIds } }).lean();
  const existingIds = new Set(existing.map((p) => p.userId));
  const missingIds = userIds.filter((id) => !existingIds.has(id));

  let seeded: typeof existing = [];
  if (missingIds.length > 0) {
    const docs = missingIds.map((userId) => ({
      userId,
      title: fakeTitleForUser(userId),
      isPlaceholder: true,
      updatedAt: new Date(),
    }));
    // insertMany with ordered:false so a rare race (two requests seeding the
    // same missing userId at once) doesn't fail the whole batch — the unique
    // index on userId makes the loser's insert a harmless duplicate-key skip.
    try {
      seeded = (await UserProfile.insertMany(docs, { ordered: false })) as unknown as typeof existing;
    } catch {
      seeded = await UserProfile.find({ userId: { $in: missingIds } }).lean();
    }
  }

  const all = [...existing, ...seeded];

  return Response.json(
    Object.fromEntries(
      all.map((p) => [p.userId, { title: p.title, isPlaceholder: p.isPlaceholder }])
    )
  );
}
