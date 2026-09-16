import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import WebsiteProfile from "@/lib/mongodb/models/WebsiteProfile";

export const dynamic = "force-dynamic";

// PATCH /api/website-profiles/[websiteId] — { industry } — sets a real value,
// clearing isPlaceholder. Super-admin only.
export async function PATCH(req: Request, { params }: { params: { websiteId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "super-admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const industry = typeof body.industry === "string" ? body.industry.trim() : "";
  if (!industry) return Response.json({ error: "Industry cannot be empty." }, { status: 400 });

  await connectDB();

  const updated = await WebsiteProfile.findOneAndUpdate(
    { websiteId: params.websiteId },
    { $set: { industry, isPlaceholder: false, updatedAt: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return Response.json({ websiteId: updated.websiteId, industry: updated.industry, isPlaceholder: updated.isPlaceholder });
}
