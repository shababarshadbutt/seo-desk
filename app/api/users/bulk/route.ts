import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, User } from "@/lib/mongodb";

function roleRank(role?: string): number {
  if (role === "super-admin") return 3;
  if (role === "sub-lead") return 2;
  if (role === "admin") return 1;
  return 0;
}

type BulkAction = "deactivate" | "reactivate";

// POST /api/users/bulk — { ids: string[], action: "deactivate" | "reactivate" }
// Super-admin only. Mirrors the single-user PATCH route's rules exactly, but
// re-checks every rule per target INSIDE the loop (Hard Gate 9) rather than
// once for the whole batch — in particular the super-admin floor count is
// re-read after each deactivation, since deactivating several super-admins
// in the same request could otherwise drop the count to zero mid-batch even
// though each one looked safe when the request started.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const myRole = session?.user.role;
  const myId = session?.user.id;

  if (roleRank(myRole) < 3) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const ids: unknown = body?.ids;
  const action: BulkAction = body?.action;

  if (!Array.isArray(ids) || ids.length === 0 || !["deactivate", "reactivate"].includes(action)) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  await connectDB();

  const succeeded: string[] = [];
  const skipped: { id: string; name: string; reason: string }[] = [];

  for (const id of ids as string[]) {
    if (id === myId) {
      skipped.push({ id, name: id, reason: "You cannot modify your own account here." });
      continue;
    }

    const target = await User.findById(id);
    if (!target) {
      skipped.push({ id, name: id, reason: "User not found." });
      continue;
    }

    if (roleRank(target.role) >= roleRank(myRole)) {
      skipped.push({ id, name: target.name, reason: "You do not have permission to modify this account." });
      continue;
    }

    const wantsActive = action === "reactivate";

    if (!wantsActive && target.role === "super-admin") {
      // Re-read the live count on every iteration — a prior deactivation in
      // this same batch may have already lowered it.
      const superAdminCount = await User.countDocuments({ role: "super-admin", isActive: true });
      if (superAdminCount <= 1) {
        skipped.push({ id, name: target.name, reason: "Cannot deactivate the last super-admin." });
        continue;
      }
    }

    if (target.isActive === wantsActive) {
      skipped.push({ id, name: target.name, reason: wantsActive ? "Already active." : "Already inactive." });
      continue;
    }

    await User.findByIdAndUpdate(id, { isActive: wantsActive });
    succeeded.push(id);
  }

  return Response.json({ succeeded, skipped });
}
