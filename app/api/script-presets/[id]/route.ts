import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import ScriptPreset from "@/lib/mongodb/models/ScriptPreset";

// DELETE /api/script-presets/[id] — owner only
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();

  const preset = await ScriptPreset.findById(params.id);
  if (!preset) return Response.json({ error: "Not found." }, { status: 404 });
  if (preset.userId !== session.user.id) return Response.json({ error: "Forbidden" }, { status: 403 });

  await ScriptPreset.findByIdAndDelete(params.id);
  return Response.json({ success: true });
}
