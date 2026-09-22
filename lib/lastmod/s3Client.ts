import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  type _Object,
} from "@aws-sdk/client-s3";
import { createWriteStream, createReadStream } from "fs";
import { pipeline } from "stream/promises";
import type { Readable } from "stream";
import type { IS3Config } from "@/lib/mongodb";
import { assertSafeDomain } from "./sftpClient";

// Reused across calls (keyed by region) so the AWS SDK's own memoized
// credential-provider-chain resolution actually gets to do its job — a fresh
// S3Client per call re-resolves credentials from scratch every time, which
// under load (hundreds of files) can throttle/fail against IMDS or other
// rate-limited credential sources ("Could not load credentials from any
// providers") even though the same credentials would resolve fine once.
const clientCache = new Map<string, S3Client>();

function client(cfg: IS3Config): S3Client {
  const region = cfg.region || "us-east-1";
  let s3 = clientCache.get(region);
  if (!s3) {
    s3 = new S3Client({ region });
    clientCache.set(region, s3);
  }
  return s3;
}

function prefixTemplate(cfg: IS3Config): string {
  return cfg.prefixTemplate || "{domain}/";
}

// {domain} may sit anywhere in the template (e.g. "sites/{domain}/sitemaps/"),
// not just at the start — matches the reference tool's S3_SITEMAPS_PREFIX_TEMPLATE.
function s3PrefixForDomain(cfg: IS3Config, domain: string): string {
  const prefix = prefixTemplate(cfg).replace("{domain}", domain);
  return prefix.endsWith("/") ? prefix : `${prefix}/`;
}

// The literal portion of the template before {domain} — used to list the
// domain-folder segment itself via a delimited ListObjectsV2 call.
function staticPrefixBeforeDomain(cfg: IS3Config): string {
  const template = prefixTemplate(cfg);
  const idx = template.indexOf("{domain}");
  return idx === -1 ? template : template.slice(0, idx);
}

// S3 caps ListObjectsV2 at 1000 keys per page — a domain with more sitemap
// files than that would silently truncate without following ContinuationToken.
async function listAllPages(cfg: IS3Config, prefix: string, delimiter?: string) {
  const s3 = client(cfg);
  const objects: _Object[] = [];
  const commonPrefixes: string[] = [];
  let continuationToken: string | undefined;

  do {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: cfg.bucket,
        Prefix: prefix,
        Delimiter: delimiter,
        ContinuationToken: continuationToken,
      })
    );
    objects.push(...(res.Contents ?? []));
    commonPrefixes.push(...(res.CommonPrefixes ?? []).map((p) => p.Prefix ?? "").filter(Boolean));
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);

  return { objects, commonPrefixes };
}

export async function listS3Domains(cfg: IS3Config): Promise<string[]> {
  const prefix = staticPrefixBeforeDomain(cfg);
  const { commonPrefixes } = await listAllPages(cfg, prefix, "/");
  return commonPrefixes
    .map((p) => p.slice(prefix.length).replace(/\/$/, ""))
    .filter(Boolean)
    .sort();
}

export interface S3SitemapObject {
  filename: string;
  loc: string; // the S3 key
  sizeBytes: number;
}

export async function listS3SitemapObjects(cfg: IS3Config, domain: string): Promise<S3SitemapObject[]> {
  assertSafeDomain(domain);
  const prefix = s3PrefixForDomain(cfg, domain);
  const { objects } = await listAllPages(cfg, prefix, "/");
  return objects
    .filter((o) => !!o.Key && o.Size && o.Size > 0 && /\.xml(\.gz)?$/i.test(o.Key))
    .filter((o) => !o.Key!.slice(prefix.length).includes("/"))
    .map((o) => ({
      filename: o.Key!.slice(prefix.length),
      loc: o.Key!,
      sizeBytes: o.Size ?? 0,
    }));
}

export async function openS3ReadStream(cfg: IS3Config, key: string): Promise<Readable> {
  const s3 = client(cfg);
  const res = await s3.send(new GetObjectCommand({ Bucket: cfg.bucket, Key: key }));
  return res.Body as Readable;
}

// Streams straight to local disk — mirrors the reference tool's discipline of
// never buffering a whole sitemap file in memory (a prior OOM there was traced
// to buffering a ~2GB object).
export async function downloadS3Object(cfg: IS3Config, key: string, localPath: string): Promise<void> {
  const body = await openS3ReadStream(cfg, key);
  await pipeline(body, createWriteStream(localPath));
}

export async function uploadS3File(cfg: IS3Config, localPath: string, key: string, contentType = "application/xml"): Promise<void> {
  const s3 = client(cfg);
  await s3.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: createReadStream(localPath),
      ContentType: contentType,
    })
  );
}

export async function uploadS3Buffer(cfg: IS3Config, buffer: Buffer, key: string, contentType = "application/xml"): Promise<void> {
  const s3 = client(cfg);
  await s3.send(
    new PutObjectCommand({ Bucket: cfg.bucket, Key: key, Body: buffer, ContentType: contentType })
  );
}

export function s3KeyForDomainFile(cfg: IS3Config, domain: string, filename: string): string {
  return `${s3PrefixForDomain(cfg, domain)}${filename}`;
}

export function s3PublicUrlForFile(cfg: IS3Config, domain: string, filename: string): string {
  const template = cfg.publicUrlTemplate || "https://{domain}/{file}";
  const withDomain = template.replace("{domain}", domain);
  return withDomain.includes("{file}")
    ? withDomain.replace("{file}", filename)
    : `${withDomain.replace(/\/+$/, "")}/${filename}`;
}
