import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import ScriptPreset from "@/lib/mongodb/models/ScriptPreset";

export const dynamic = "force-dynamic";

// GET /api/script-presets?scriptSlug=... — own presets for a given script
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const scriptSlug = searchParams.get("scriptSlug");
  if (!scriptSlug) return Response.json({ error: "scriptSlug is required." }, { status: 400 });

  await connectDB();

  const presets = await ScriptPreset.find({ userId: session.user.id, scriptSlug })
    .sort({ createdAt: -1 })
    .lean();

  return Response.json(
    presets.map((p) => ({
      id: p._id.toString(),
      name: p.name,
      inputs: p.inputs,
      createdAt: p.createdAt.toISOString(),
    }))
  );
}

// POST /api/script-presets — save the current form inputs as a named preset
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { scriptSlug, name, inputs } = body as { scriptSlug?: string; name?: string; inputs?: Record<string, unknown> };

  if (!scriptSlug) return Response.json({ error: "scriptSlug is required." }, { status: 400 });
  if (!name?.trim()) return Response.json({ error: "Preset name is required." }, { status: 400 });

  // Only plain string/number/boolean values may be persisted — file inputs can't
  // be saved (their contents aren't available server-side as JSON), so any such
  // value reaching here is dropped rather than silently corrupting the preset.
  const safeInputs: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(inputs ?? {})) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      safeInputs[key] = value;
    }
  }

  await connectDB();

  try {
    const created = await ScriptPreset.create({
      userId: session.user.id,
      scriptSlug,
      name: name.trim(),
      inputs: safeInputs,
    });
    return Response.json(
      { id: created._id.toString(), name: created.name, inputs: created.inputs, createdAt: created.createdAt.toISOString() },
      { status: 201 }
    );
  } catch (err) {
    const isDuplicate = err instanceof Error && "code" in err && (err as { code?: number }).code === 11000;
    return Response.json(
      { error: isDuplicate ? "You already have a preset with this name for this script." : "Failed to save preset." },
      { status: isDuplicate ? 409 : 500 }
    );
  }
}
