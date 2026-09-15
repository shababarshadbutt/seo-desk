import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cleanupTrackedPaths, discardTracking, totalTrackedBytes } from "@/lib/lastmod/localCleanup";

export const dynamic = "force-dynamic";

// POST /api/lastmod-updater/cleanup  { runId: string, confirm: boolean }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const runId = body?.runId as string | undefined;
  const confirm = body?.confirm !== false;
  if (!runId) return Response.json({ error: "runId is required" }, { status: 400 });

  if (!confirm) {
    discardTracking(runId);
    return Response.json({ deleted: false });
  }

  const bytesBefore = await totalTrackedBytes(runId);
  const deletedCount = await cleanupTrackedPaths(runId);
  return Response.json({ deleted: true, deletedCount, bytesFreed: bytesBefore });
}
