import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, Settings } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

// GET /api/settings
export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "super-admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectDB();
  const settings = await Settings.findOne({ singleton: true }).lean();

  return Response.json({
    serviceAccounts: settings?.serviceAccounts.map((a) => ({ name: a.name })) ?? [],
    gscProperties: settings?.gscProperties ?? [],
    ga4Properties: settings?.ga4Properties ?? [],
    sessionTimeoutMinutes: settings?.sessionTimeoutMinutes ?? 60,
    logRetentionDays: settings?.logRetentionDays ?? 15,
  });
}

// PATCH /api/settings — update GSC / GA4 properties, session timeout, log retention
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "super-admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const update: Record<string, unknown> = {};

  if (Array.isArray(body.gscProperties)) update.gscProperties = body.gscProperties;
  if (Array.isArray(body.ga4Properties)) update.ga4Properties = body.ga4Properties;

  if (body.sessionTimeoutMinutes !== undefined) {
    const minutes = Number(body.sessionTimeoutMinutes);
    if (!Number.isFinite(minutes) || minutes < 1) {
      return Response.json({ error: "sessionTimeoutMinutes must be a positive number." }, { status: 400 });
    }
    update.sessionTimeoutMinutes = minutes;
  }

  if (body.logRetentionDays !== undefined) {
    const days = Number(body.logRetentionDays);
    if (!Number.isFinite(days) || days < 0) {
      return Response.json({ error: "logRetentionDays must be 0 (unlimited) or a positive number." }, { status: 400 });
    }
    update.logRetentionDays = days;
  }

  if (Object.keys(update).length === 0) {
    return Response.json({ error: "Nothing to update." }, { status: 400 });
  }

  await connectDB();

  const settings = await Settings.findOneAndUpdate(
    { singleton: true },
    { $set: update },
    { upsert: true, new: true }
  ).lean();

  return Response.json({
    serviceAccounts: settings?.serviceAccounts.map((a) => ({ name: a.name })) ?? [],
    gscProperties: settings?.gscProperties ?? [],
    ga4Properties: settings?.ga4Properties ?? [],
    sessionTimeoutMinutes: settings?.sessionTimeoutMinutes ?? 60,
    logRetentionDays: settings?.logRetentionDays ?? 15,
  });
}
