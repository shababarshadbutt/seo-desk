import mongoose, { Document, Model, Schema } from "mongoose";

export interface IGscProperty {
  url: string;
  displayName: string;
}

export interface IGa4Property {
  propertyId: string;
  displayName: string;
}

export interface IServiceAccount {
  name: string;       // User-given label e.g. "ASAP Main Account"
  json: string;       // Raw service account JSON string
}

export interface ISftpConfig {
  host: string;
  port: number;
  username: string;
  password: string;       // used only if privateKey is empty
  privateKey: string;     // PEM contents; preferred over password when set
  basePath: string;       // remote root — one subfolder per domain
  maxConcurrentConnections: number;
}

export interface IS3Config {
  bucket: string;
  region: string;
  // Key layout template — exactly one {domain} placeholder, must end with "/".
  // e.g. "sites/{domain}/sitemaps/" (matches the Sitemap_Migration reference
  // tool's S3_SITEMAPS_PREFIX_TEMPLATE — the domain folder is NOT necessarily
  // the top-level segment).
  prefixTemplate: string;
  // <loc> template for generated indexes — {domain} and {file} placeholders.
  // e.g. "https://{domain}/sitemaps/{file}" (matches PUBLIC_SITEMAP_URL_TEMPLATE).
  publicUrlTemplate: string;
}

export interface ISettings extends Document {
  singleton: true;
  serviceAccounts: IServiceAccount[];
  gscProperties: IGscProperty[];
  ga4Properties: IGa4Property[];
  sessionTimeoutMinutes: number;
  logRetentionDays: number; // 0 = unlimited (never prune)
  sftpConfig: ISftpConfig;
  s3Config: IS3Config;
  updatedAt: Date;
}

const ServiceAccountSchema = new Schema<IServiceAccount>(
  {
    name: { type: String, required: true },
    json: { type: String, required: true },
  },
  { _id: false }
);

const GscPropertySchema = new Schema<IGscProperty>(
  {
    url: { type: String, required: true },
    displayName: { type: String, required: true },
  },
  { _id: false }
);

const Ga4PropertySchema = new Schema<IGa4Property>(
  {
    propertyId: { type: String, required: true },
    displayName: { type: String, required: true },
  },
  { _id: false }
);

const SftpConfigSchema = new Schema<ISftpConfig>(
  {
    host: { type: String, default: "" },
    port: { type: Number, default: 22 },
    username: { type: String, default: "" },
    password: { type: String, default: "" },
    privateKey: { type: String, default: "" },
    basePath: { type: String, default: "/" },
    maxConcurrentConnections: { type: Number, default: 4, min: 1 },
  },
  { _id: false }
);

const S3ConfigSchema = new Schema<IS3Config>(
  {
    bucket: { type: String, default: "" },
    region: { type: String, default: "us-east-1" },
    prefixTemplate: { type: String, default: "{domain}/" },
    publicUrlTemplate: { type: String, default: "" },
  },
  { _id: false }
);

const SettingsSchema = new Schema<ISettings>(
  {
    singleton: { type: Boolean, default: true, immutable: true },
    serviceAccounts: { type: [ServiceAccountSchema], default: [] },
    gscProperties: { type: [GscPropertySchema], default: [] },
    ga4Properties: { type: [Ga4PropertySchema], default: [] },
    sessionTimeoutMinutes: { type: Number, default: 60, min: 1 },
    logRetentionDays: { type: Number, default: 15, min: 0 },
    sftpConfig: { type: SftpConfigSchema, default: () => ({}) },
    s3Config: { type: S3ConfigSchema, default: () => ({}) },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

SettingsSchema.index({ singleton: 1 }, { unique: true });

const Settings: Model<ISettings> =
  mongoose.models.Settings ??
  mongoose.model<ISettings>("Settings", SettingsSchema);

export default Settings;
