import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, Settings } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

// GET /api/settings/storage — SFTP/S3 config for the Lastmod Updater. Secrets
// (password, private key) are never echoed back, only whether they're set.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "super-admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectDB();
  const settings = await Settings.findOne({ singleton: true }).lean();
  const sftp = settings?.sftpConfig;
  const s3 = settings?.s3Config;

  return Response.json({
    sftp: {
      host: sftp?.host ?? "",
      port: sftp?.port ?? 22,
      username: sftp?.username ?? "",
      basePath: sftp?.basePath ?? "/",
      maxConcurrentConnections: sftp?.maxConcurrentConnections ?? 4,
      hasPassword: !!sftp?.password,
      hasPrivateKey: !!sftp?.privateKey,
    },
    s3: {
      bucket: s3?.bucket ?? "",
      region: s3?.region ?? "us-east-1",
      prefixTemplate: s3?.prefixTemplate ?? "{domain}/",
      publicUrlTemplate: s3?.publicUrlTemplate ?? "",
    },
  });
}

// PATCH /api/settings/storage — { sftp?: {...}, s3?: {...} }
// Only fields present in the body are updated; sending an empty string for
// password/privateKey leaves the stored secret untouched (so re-saving other
// fields doesn't require re-entering credentials every time).
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "super-admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  await connectDB();
  const update: Record<string, unknown> = {};

  if (body.sftp && typeof body.sftp === "object") {
    for (const key of ["host", "username", "basePath"] as const) {
      if (typeof body.sftp[key] === "string") update[`sftpConfig.${key}`] = body.sftp[key];
    }
    if (typeof body.sftp.password === "string" && body.sftp.password.length > 0) {
      update["sftpConfig.password"] = body.sftp.password;
    }
    if (typeof body.sftp.privateKey === "string" && body.sftp.privateKey.length > 0) {
      update["sftpConfig.privateKey"] = body.sftp.privateKey;
    }
    if (body.sftp.port !== undefined) {
      const port = Number(body.sftp.port);
      if (Number.isFinite(port) && port > 0) update["sftpConfig.port"] = port;
    }
    if (body.sftp.maxConcurrentConnections !== undefined) {
      const n = Number(body.sftp.maxConcurrentConnections);
      if (Number.isFinite(n) && n >= 1) update["sftpConfig.maxConcurrentConnections"] = n;
    }
  }

  if (body.s3 && typeof body.s3 === "object") {
    for (const key of ["bucket", "region", "prefixTemplate", "publicUrlTemplate"] as const) {
      if (typeof body.s3[key] === "string") update[`s3Config.${key}`] = body.s3[key];
    }
  }

  if (Object.keys(update).length === 0) {
    return Response.json({ error: "Nothing to update." }, { status: 400 });
  }

  await Settings.findOneAndUpdate({ singleton: true }, { $set: update }, { upsert: true });
  return Response.json({ ok: true });
}
