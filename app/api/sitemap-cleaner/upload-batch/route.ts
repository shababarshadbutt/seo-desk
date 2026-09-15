import { writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { gunzip } from "zlib";
import { promisify } from "util";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const gunzipAsync = promisify(gunzip);

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/sitemap-cleaner/upload-batch
// Receives one gzip-compressed batch of client-parsed sitemap files and
// stashes it to disk under a session id. The "run" endpoint merges every
// batch for a session once all of them have been uploaded.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return new Response("Unauthorized", { status: 401 });

  let body: {
    sessionId?: string;
    batchNum?: number;
    sitemaps?: { name: string; urls: string[]; isIndex?: boolean }[];
  };

  try {
    const fd = await req.formData();
    const blob = fd.get("data") as Blob | null;
    if (!blob) return new Response("Missing data field", { status: 400 });
    const compressed = Buffer.from(await blob.arrayBuffer());
    const decompressed = await gunzipAsync(compressed);
    body = JSON.parse(decompressed.toString("utf-8"));
  } catch {
    return new Response("Invalid request body", { status: 400 });
  }

  const sessionId = body.sessionId || randomUUID();
  const batchNum = body.batchNum ?? Date.now();
  const batchPath = join(tmpdir(), `asap_cleaner_${sessionId}_${batchNum}.json`);
  await writeFile(batchPath, JSON.stringify(body.sitemaps ?? []));
  return Response.json({ sessionId, ok: true });
}
