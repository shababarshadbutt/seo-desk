import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import UserProfile from "@/lib/mongodb/models/UserProfile";

export const dynamic = "force-dynamic";

// PATCH /api/user-profiles/[userId] — { title } — sets a real value, clearing
// isPlaceholder. Super-admin can edit anyone's; a user can edit their own.
export async function PATCH(req: Request, { params }: { params: { userId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const isSuperAdmin = session.user.role === "super-admin";
  const isSelf = session.user.id === params.userId;
  if (!isSuperAdmin && !isSelf) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return Response.json({ error: "Title cannot be empty." }, { status: 400 });

  await connectDB();

  const updated = await UserProfile.findOneAndUpdate(
    { userId: params.userId },
    { $set: { title, isPlaceholder: false, updatedAt: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return Response.json({ userId: updated.userId, title: updated.title, isPlaceholder: updated.isPlaceholder });
}
