import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, ExecutionLog, Group } from "@/lib/mongodb";
import { getScriptBySlug } from "@/lib/scripts-config";

export const dynamic = "force-dynamic";

// Part B addition — replays a past ExecutionLog's stored `inputs` back through
// the existing, protected `/api/scripts/run` SSE pipeline (same pattern as
// lib/indexing-dispatch.ts). Never modifies that route. Rejects scripts whose
// original inputs included an uploaded file/folder/service account/multi-site
// payload, since those values are never persisted in `inputs` (files are
// deleted after the run; the service-account NAME is filtered out, only its
// temp file path was, which is excluded from what gets saved) — round-tripping
// those isn't possible, so we say so instead of silently failing or guessing.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();

  const log = await ExecutionLog.findById(params.id).lean();
  if (!log) return Response.json({ error: "Log not found" }, { status: 404 });

  // Same visibility rule as the Logs list: admin sees only their own, sub-lead
  // sees their own + group, super-admin sees everyone.
  const role = session.user.role;
  const myId = session.user.id;
  const logUserId = log.userId ? log.userId.toString() : null;

  if (role === "admin") {
    if (logUserId !== myId) {
      return Response.json({ error: "You can only re-run your own runs." }, { status: 403 });
    }
  } else if (role === "sub-lead") {
    const group = await Group.findOne({ leadUserId: myId }).lean();
    const memberIds = group ? group.memberUserIds.map((id) => id.toString()) : [];
    if (!logUserId || (logUserId !== myId && !memberIds.includes(logUserId))) {
      return Response.json({ error: "You can only re-run runs in your group." }, { status: 403 });
    }
  }
  // super-admin: no restriction

  const script = getScriptBySlug(log.scriptSlug);
  if (!script) {
    return Response.json({ error: "This script no longer exists in the current configuration." }, { status: 400 });
  }
  if (script.requiresServiceAccount) {
    return Response.json(
      { error: "This script requires a service account selection, which isn't stored with past runs. Please re-run it from the Scripts page instead." },
      { status: 400 }
    );
  }
  const hasUnreplayableInput = script.inputs.some(
    (i) => i.type === "file" || i.type === "multi-site-urls" || i.folder
  );
  if (hasUnreplayableInput) {
    return Response.json(
      { error: "This script's original inputs included an upload or multi-site list, which isn't stored with past runs. Please re-run it from the Scripts page instead." },
      { status: 400 }
    );
  }

  const formData = new FormData();
  formData.set("slug", log.scriptSlug);
  for (const inputDef of script.inputs) {
    const value = (log.inputs as Record<string, unknown>)[inputDef.name];
    if (typeof value === "string" && value) {
      formData.set(inputDef.name, value);
    }
  }

  const runUrl = new URL("/api/scripts/run", req.url);
  const upstream = await fetch(runUrl, {
    method: "POST",
    body: formData,
    headers: { cookie: req.headers.get("cookie") ?? "" },
  });

  if (!upstream.body) {
    return Response.json({ error: "Failed to start the re-run." }, { status: 502 });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
