import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, Website, IndexingQueue } from "@/lib/mongodb";

type BulkAction = "delete" | "enableAutomation" | "disableAutomation";

// POST /api/websites/bulk — super-admin only, same rule as the single-row
// DELETE/PATCH-automation routes this reuses. Re-validates each target
// individually rather than trusting the batch as a whole.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "super-admin") return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { ids, action } = body as { ids?: string[]; action?: BulkAction };

  if (!Array.isArray(ids) || ids.length === 0) {
    return Response.json({ error: "No websites selected." }, { status: 400 });
  }
  if (action !== "delete" && action !== "enableAutomation" && action !== "disableAutomation") {
    return Response.json({ error: "Invalid action." }, { status: 400 });
  }

  await connectDB();

  const succeeded: string[] = [];
  const skipped: { id: string; name: string; reason: string }[] = [];

  for (const id of ids) {
    const website = await Website.findById(id).lean();
    if (!website) {
      skipped.push({ id, name: "(unknown)", reason: "Website not found." });
      continue;
    }

    const raw = website as unknown as Record<string, unknown>;

    if (action === "delete") {
      await Website.findByIdAndDelete(id);
      // Bulk-only cleanup: the existing single-row DELETE doesn't cascade,
      // but a bulk delete is a stronger signal of real removal intent.
      await IndexingQueue.deleteMany({ websiteId: id });
      succeeded.push(id);
    } else if (action === "disableAutomation") {
      await Website.collection.updateOne({ _id: website._id }, { $set: { automationEnabled: false } });
      succeeded.push(id);
    } else {
      // enableAutomation — only if this site already has a service account configured;
      // there's no per-site config UI in a bulk flow, so we never invent one.
      if (!raw.gscServiceAccountName) {
        skipped.push({ id, name: website.name, reason: "No GSC service account configured for this site." });
        continue;
      }
      await Website.collection.updateOne({ _id: website._id }, { $set: { automationEnabled: true } });
      succeeded.push(id);
    }
  }

  return Response.json({ succeeded, skipped });
}
