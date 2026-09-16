import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, Website, Group } from "@/lib/mongodb";
import { scripts } from "@/lib/scripts-config";

export const dynamic = "force-dynamic";

// GET /api/search?q=... — global search over Websites (role-scoped, same rule as /api/websites)
// and Scripts (static list, same for everyone). Part B addition — read-only, no new collections.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    return Response.json({ websites: [], scripts: [] });
  }

  const role = session.user.role;
  const myId = session.user.id;

  await connectDB();

  const nameFilter = { $or: [{ name: { $regex: q, $options: "i" } }, { url: { $regex: q, $options: "i" } }] };
  let websiteFilter: Record<string, unknown> = nameFilter;

  if (role === "sub-lead") {
    const group = await Group.findOne({ leadUserId: myId }).lean();
    const memberIds = group ? group.memberUserIds.map((id) => id.toString()) : [];
    websiteFilter = { ...nameFilter, "assignedTo.userId": { $in: [myId, ...memberIds] } };
  } else if (role !== "super-admin") {
    websiteFilter = { ...nameFilter, "assignedTo.userId": myId };
  }

  const websiteDocs = await Website.find(websiteFilter).select("name url").sort({ name: 1 }).limit(6).lean();

  const scriptMatches = scripts
    .filter((s) => s.name.toLowerCase().includes(q.toLowerCase()) || s.description.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 6)
    .map((s) => ({ slug: s.slug, name: s.name, description: s.description }));

  return Response.json({
    websites: websiteDocs.map((w) => ({ id: w._id.toString(), name: w.name, url: w.url ?? "" })),
    scripts: scriptMatches,
  });
}
