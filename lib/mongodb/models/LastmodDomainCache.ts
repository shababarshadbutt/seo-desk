import mongoose, { Document, Model, Schema } from "mongoose";

export type LastmodSource = "sftp" | "s3" | "url";

export interface ILastmodFile {
  filename: string;
  loc: string;         // absolute location (remote path, S3 key, or URL) used to fetch/push this file
  isIndex: boolean;     // true if this file's root element is <sitemapindex>
  sizeBytes: number;
}

export interface ILastmodVertical {
  template: string;         // e.g. "/product/{param}/rfq"
  fileCount: number;
  totalSampledUrls: number;
  sampleUrls: string[];     // small bounded sample, never the full URL set
  filenames: string[];      // which files in `files` belong to this vertical
}

export interface ILastmodDomainCache extends Document {
  domain: string;
  source: LastmodSource;
  files: ILastmodFile[];
  indexFilename: string | null;  // filename of the sitemap-index.xml, if one exists (or was created)
  verticals: ILastmodVertical[];
  fetchedAt: Date;
  verticalsComputedAt: Date | null;
}

const LastmodFileSchema = new Schema<ILastmodFile>(
  {
    filename: { type: String, required: true },
    loc: { type: String, required: true },
    isIndex: { type: Boolean, default: false },
    sizeBytes: { type: Number, default: 0 },
  },
  { _id: false }
);

const LastmodVerticalSchema = new Schema<ILastmodVertical>(
  {
    template: { type: String, required: true },
    fileCount: { type: Number, default: 0 },
    totalSampledUrls: { type: Number, default: 0 },
    sampleUrls: { type: [String], default: [] },
    filenames: { type: [String], default: [] },
  },
  { _id: false }
);

const LastmodDomainCacheSchema = new Schema<ILastmodDomainCache>({
  domain: { type: String, required: true },
  source: { type: String, enum: ["sftp", "s3", "url"], required: true },
  files: { type: [LastmodFileSchema], default: [] },
  indexFilename: { type: String, default: null },
  verticals: { type: [LastmodVerticalSchema], default: [] },
  fetchedAt: { type: Date, default: Date.now },
  verticalsComputedAt: { type: Date, default: null },
});

LastmodDomainCacheSchema.index({ domain: 1, source: 1 }, { unique: true });

const LastmodDomainCache: Model<ILastmodDomainCache> =
  mongoose.models.LastmodDomainCache ??
  mongoose.model<ILastmodDomainCache>("LastmodDomainCache", LastmodDomainCacheSchema);

export default LastmodDomainCache;
