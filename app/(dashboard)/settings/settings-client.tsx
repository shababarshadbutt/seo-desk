"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus, Loader2, ShieldAlert, KeyRound, Users, ChevronDown, ChevronUp, ShieldCheck, HardDrive, CheckCircle2, Globe, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ServiceAccount { name: string }
interface GscProperty { url: string; displayName: string }
interface Ga4Property { propertyId: string; displayName: string }

export interface UserOption { id: string; name: string; email: string; role: string }
export interface GroupData {
  id: string;
  name: string;
  leadUserId: string;
  memberUserIds: string[];
}

interface SettingsClientProps {
  serviceAccounts: ServiceAccount[];
  gscProperties: GscProperty[];
  ga4Properties: Ga4Property[];
  sessionTimeoutMinutes: number;
  logRetentionDays: number;
  dailyReportPopupEnabled: boolean;
  users: UserOption[];
  groups: GroupData[];
  userMap: Record<string, UserOption>;
}

const TABS = [
  { key: "general", label: "General & Security" },
  { key: "credentials", label: "Credentials & Properties" },
  { key: "storage", label: "Storage" },
  { key: "teams", label: "Teams" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function SettingsClient(props: SettingsClientProps) {
  const [tab, setTab] = useState<TabKey>("general");

  return (
    <div className="space-y-6">
      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
            <KeyRound className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold leading-none">{props.serviceAccounts.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Service Accounts</p>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
          <div className="rounded-lg bg-sky-500/10 p-2.5 shrink-0">
            <Globe className="h-4 w-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div>
            <p className="text-2xl font-bold leading-none">{props.gscProperties.length}</p>
            <p className="text-xs text-muted-foreground mt-1">GSC Properties</p>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
          <div className="rounded-lg bg-amber-500/10 p-2.5 shrink-0">
            <BarChart3 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-2xl font-bold leading-none">{props.ga4Properties.length}</p>
            <p className="text-xs text-muted-foreground mt-1">GA4 Properties</p>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
          <div className="rounded-lg bg-emerald-500/10 p-2.5 shrink-0">
            <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-2xl font-bold leading-none">{props.groups.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Team Groups</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex flex-wrap gap-1.5 p-1 rounded-xl border bg-card w-fit">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                tab === t.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          Each section saves independently — changes apply as soon as you save them.
        </p>
      </div>

      {tab === "general" && (
        <SecurityRetentionCard
          initialSessionTimeoutMinutes={props.sessionTimeoutMinutes}
          initialLogRetentionDays={props.logRetentionDays}
          initialDailyReportPopupEnabled={props.dailyReportPopupEnabled}
        />
      )}

      {tab === "credentials" && (
        <div className="space-y-6">
          <ServiceAccountsCard initial={props.serviceAccounts} />
          <GscPropertiesCard initial={props.gscProperties} />
          <Ga4PropertiesCard initial={props.ga4Properties} />
        </div>
      )}

      {tab === "storage" && <StorageSettingsCard />}

      {tab === "teams" && (
        <GroupsCard initialGroups={props.groups} users={props.users} userMap={props.userMap} />
      )}
    </div>
  );
}

// ─── SFTP / S3 Storage (Lastmod Updater) ─────────────────────────────────────

interface StorageConfig {
  sftp: {
    host: string;
    port: number;
    username: string;
    basePath: string;
    maxConcurrentConnections: number;
    hasPassword: boolean;
    hasPrivateKey: boolean;
  };
  s3: {
    bucket: string;
    region: string;
    prefixTemplate: string;
    publicUrlTemplate: string;
  };
}

function StorageSettingsCard() {
  const [config, setConfig] = useState<StorageConfig | null>(null);
  const [sftpPassword, setSftpPassword] = useState("");
  const [sftpPrivateKey, setSftpPrivateKey] = useState("");
  const [saving, setSaving] = useState<"sftp" | "s3" | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetch("/api/settings/storage")
      .then((res) => res.json())
      .then((data) => setConfig(data))
      .catch(() => setError("Failed to load storage settings."));
  }, []);

  if (!config) {
    return (
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <p className="text-sm text-muted-foreground">Loading storage settings…</p>
      </div>
    );
  }

  function updateSftpField<K extends keyof StorageConfig["sftp"]>(key: K, value: StorageConfig["sftp"][K]) {
    setConfig((prev) => (prev ? { ...prev, sftp: { ...prev.sftp, [key]: value } } : prev));
  }

  function updateS3Field<K extends keyof StorageConfig["s3"]>(key: K, value: StorageConfig["s3"][K]) {
    setConfig((prev) => (prev ? { ...prev, s3: { ...prev.s3, [key]: value } } : prev));
  }

  async function saveSftp() {
    if (!config) return;
    setError(""); setSuccess(""); setSaving("sftp");
    const res = await fetch("/api/settings/storage", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sftp: {
          host: config.sftp.host,
          port: config.sftp.port,
          username: config.sftp.username,
          basePath: config.sftp.basePath,
          maxConcurrentConnections: config.sftp.maxConcurrentConnections,
          password: sftpPassword,
          privateKey: sftpPrivateKey,
        },
      }),
    });
    setSaving(null);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to save SFTP settings.");
      return;
    }
    setSftpPassword(""); setSftpPrivateKey("");
    setConfig((prev) =>
      prev
        ? {
            ...prev,
            sftp: {
              ...prev.sftp,
              hasPassword: prev.sftp.hasPassword || sftpPassword.length > 0,
              hasPrivateKey: prev.sftp.hasPrivateKey || sftpPrivateKey.length > 0,
            },
          }
        : prev
    );
    setSuccess("SFTP settings saved.");
  }

  async function saveS3() {
    if (!config) return;
    setError(""); setSuccess(""); setSaving("s3");
    const res = await fetch("/api/settings/storage", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ s3: config.s3 }),
    });
    setSaving(null);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to save S3 settings.");
      return;
    }
    setSuccess("S3 settings saved.");
  }

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm space-y-5">
      <div className="flex items-center gap-2">
        <HardDrive className="h-4 w-4 text-muted-foreground" />
        <div>
          <h3 className="font-semibold">Storage (Lastmod Updater)</h3>
          <p className="text-sm text-muted-foreground">
            SFTP and S3 access used by the Lastmod Updater. Updates always push to S3, regardless of source.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t">
        <div className="space-y-3 pt-3">
          <p className="text-sm font-medium">SFTP</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="sftp-host">Host</Label>
              <Input id="sftp-host" value={config.sftp.host} onChange={(e) => updateSftpField("host", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sftp-port">Port</Label>
              <Input id="sftp-port" type="number" value={config.sftp.port} onChange={(e) => updateSftpField("port", Number(e.target.value))} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="sftp-username">Username</Label>
            <Input id="sftp-username" value={config.sftp.username} onChange={(e) => updateSftpField("username", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sftp-basepath">Base path (one folder per domain)</Label>
            <Input id="sftp-basepath" value={config.sftp.basePath} onChange={(e) => updateSftpField("basePath", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sftp-password">Password {config.sftp.hasPassword && <span className="text-xs text-muted-foreground">(set — leave blank to keep)</span>}</Label>
            <Input id="sftp-password" type="password" value={sftpPassword} onChange={(e) => setSftpPassword(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sftp-privatekey">Private key {config.sftp.hasPrivateKey && <span className="text-xs text-muted-foreground">(set — leave blank to keep)</span>}</Label>
            <Textarea id="sftp-privatekey" rows={3} placeholder="-----BEGIN OPENSSH PRIVATE KEY-----" value={sftpPrivateKey} onChange={(e) => setSftpPrivateKey(e.target.value)} />
          </div>
          <Button size="sm" onClick={saveSftp} disabled={saving === "sftp"}>
            {saving === "sftp" && <Loader2 className="h-4 w-4 animate-spin" />}
            Save SFTP
          </Button>
        </div>

        <div className="space-y-3 pt-3">
          <p className="text-sm font-medium">S3</p>
          <div className="space-y-1">
            <Label htmlFor="s3-bucket">Bucket</Label>
            <Input id="s3-bucket" value={config.s3.bucket} onChange={(e) => updateS3Field("bucket", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="s3-region">Region</Label>
            <Input id="s3-region" value={config.s3.region} onChange={(e) => updateS3Field("region", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="s3-prefix">Key prefix template</Label>
            <Input
              id="s3-prefix"
              placeholder="sites/{domain}/sitemaps/"
              value={config.s3.prefixTemplate}
              onChange={(e) => updateS3Field("prefixTemplate", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Where objects live in the bucket. Must contain exactly one {"{domain}"} placeholder.</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="s3-public-url">Public URL template</Label>
            <Input
              id="s3-public-url"
              placeholder="https://{domain}/sitemaps/{file}"
              value={config.s3.publicUrlTemplate}
              onChange={(e) => updateS3Field("publicUrlTemplate", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Where it&apos;s served — used for &lt;loc&gt; when generating a new sitemap-index.xml. {"{domain}"} and {"{file}"} placeholders.</p>
          </div>
          <Button size="sm" onClick={saveS3} disabled={saving === "s3"}>
            {saving === "s3" && <Loader2 className="h-4 w-4 animate-spin" />}
            Save S3
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground border-t pt-3">
        S3 uses the server&apos;s AWS credentials (instance role / environment) — only the bucket, region, and prefix are configured here.
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p>}
    </div>
  );
}

// ─── Security & Retention ────────────────────────────────────────────────────

const LOG_RETENTION_PRESETS = [
  { label: "15 days", value: 15 },
  { label: "1 month", value: 30 },
  { label: "3 months", value: 90 },
  { label: "6 months", value: 180 },
  { label: "Unlimited", value: 0 },
];

function SecurityRetentionCard({
  initialSessionTimeoutMinutes,
  initialLogRetentionDays,
  initialDailyReportPopupEnabled,
}: {
  initialSessionTimeoutMinutes: number;
  initialLogRetentionDays: number;
  initialDailyReportPopupEnabled: boolean;
}) {
  const router = useRouter();
  const [hours, setHours] = useState(String(initialSessionTimeoutMinutes / 60));
  const [retentionDays, setRetentionDays] = useState(initialLogRetentionDays);
  const [popupEnabled, setPopupEnabled] = useState(initialDailyReportPopupEnabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function save(update: Record<string, number | boolean>) {
    setError(""); setSuccess(""); setSaving(true);

    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to save.");
      return;
    }

    setSuccess("Saved.");
    router.refresh();
  }

  function handleSaveTimeout() {
    const parsedHours = Number(hours);
    if (!Number.isFinite(parsedHours) || parsedHours < 0.25) {
      setError("Enter at least 0.25 hours (15 minutes).");
      return;
    }
    save({ sessionTimeoutMinutes: Math.round(parsedHours * 60) });
  }

  function handleRetentionChange(value: number) {
    setRetentionDays(value);
    save({ logRetentionDays: value });
  }

  function handlePopupToggle(value: boolean) {
    setPopupEnabled(value);
    save({ dailyReportPopupEnabled: value });
  }

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
        <div>
          <h3 className="font-semibold">Security &amp; Log Retention</h3>
          <p className="text-sm text-muted-foreground">
            Controls how long users stay logged in, and how long execution logs are kept. Super-admin only.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t">
        <div className="space-y-1.5 pt-3">
          <Label htmlFor="session-timeout">Auto-logout after (hours)</Label>
          <div className="flex gap-2">
            <Input
              id="session-timeout"
              type="number"
              min="0.25"
              step="0.25"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
            <Button size="sm" onClick={handleSaveTimeout} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </div>
        </div>

        <div className="space-y-1.5 pt-3">
          <Label htmlFor="log-retention">Keep execution logs for</Label>
          <select
            id="log-retention"
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={retentionDays}
            onChange={(e) => handleRetentionChange(Number(e.target.value))}
            disabled={saving}
          >
            {LOG_RETENTION_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between gap-4 pt-3 border-t sm:col-span-2">
          <div>
            <Label htmlFor="daily-report-popup">Missing Daily Report popup</Label>
            <p className="text-xs text-muted-foreground">
              When enabled, users who haven&apos;t submitted a daily report are blocked with a mandatory popup until they do (or mark leave/holiday). Super-admins are always exempt.
            </p>
          </div>
          <input
            id="daily-report-popup"
            type="checkbox"
            checked={popupEnabled}
            onChange={(e) => handlePopupToggle(e.target.checked)}
            disabled={saving}
            className="h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-muted transition-colors checked:bg-primary relative before:absolute before:left-0.5 before:top-0.5 before:h-4 before:w-4 before:rounded-full before:bg-background before:shadow before:transition-transform checked:before:translate-x-4"
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p>}
    </div>
  );
}

// ─── Service Accounts ────────────────────────────────────────────────────────

function ServiceAccountsCard({ initial }: { initial: ServiceAccount[] }) {
  const router = useRouter();
  const [accounts, setAccounts] = useState(initial);
  const [name, setName] = useState("");
  const [json, setJson] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);

    const res = await fetch("/api/settings/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, credentialsJson: json }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error);
      return;
    }

    const data = await res.json();
    setAccounts(data.serviceAccounts);
    setName(""); setJson("");
    setSuccess(`"${name}" added successfully.`);
    router.refresh();
  }

  async function handleRemove(accountName: string) {
    if (!confirm(`Remove service account "${accountName}"? Scripts using it will stop working.`)) return;
    setLoading(true);

    const res = await fetch("/api/settings/credentials", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: accountName }),
    });

    setLoading(false);

    if (res.ok) {
      const data = await res.json();
      setAccounts(data.serviceAccounts);
      router.refresh();
    }
  }

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Google Service Accounts</h3>
          <p className="text-sm text-muted-foreground">
            Add one per Google Cloud project. Scripts will let you pick which one to use.
          </p>
        </div>
        <Badge variant={accounts.length > 0 ? "success" : "outline"}
          className={accounts.length === 0 ? "text-amber-700 dark:text-amber-400 border-amber-400/30 bg-amber-500/10" : ""}>
          {accounts.length > 0
            ? `${accounts.length} configured`
            : <><ShieldAlert className="h-3 w-3 inline mr-1" />None</>}
        </Badge>
      </div>

      {/* Existing accounts list */}
      {accounts.length > 0 && (
        <div className="space-y-2">
          {accounts.map((account) => (
            <div key={account.name}
              className="flex items-center justify-between rounded-lg border px-3 py-2">
              <div className="flex items-center gap-2 text-sm">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{account.name}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => handleRemove(account.name)}
                disabled={loading}>
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add new account form */}
      <form onSubmit={handleAdd} className="space-y-3 pt-2 border-t">
        <p className="text-sm font-medium pt-1">Add a service account</p>
        <div className="space-y-1.5">
          <Label htmlFor="sa-name">Account name / label</Label>
          <Input
            id="sa-name"
            placeholder="e.g. ASAP Main Account"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sa-json">Service account JSON</Label>
          <Textarea
            id="sa-json"
            className="font-mono text-xs min-h-[140px]"
            placeholder={'{\n  "type": "service_account",\n  "project_id": "...",\n  ...\n}'}
            value={json}
            onChange={(e) => setJson(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p>}
        <Button type="submit" size="sm" disabled={loading || !name.trim() || !json.trim()}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          <Plus className="h-4 w-4" />
          Add account
        </Button>
      </form>
    </div>
  );
}

// ─── GSC Properties ──────────────────────────────────────────────────────────

function GscPropertiesCard({ initial }: { initial: GscProperty[] }) {
  const router = useRouter();
  const [properties, setProperties] = useState(initial);
  const [newUrl, setNewUrl] = useState("");
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(updated: GscProperty[]) {
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gscProperties: updated }),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      setProperties(data.gscProperties);
      router.refresh();
    }
  }

  function add() {
    if (!newUrl.trim() || !newName.trim()) return;
    save([...properties, { url: newUrl.trim(), displayName: newName.trim() }]);
    setNewUrl(""); setNewName("");
  }

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
      <div>
        <h3 className="font-semibold">Google Search Console Properties</h3>
        <p className="text-sm text-muted-foreground">Properties available for use in GSC scripts.</p>
      </div>

      {properties.length > 0 && (
        <div className="space-y-2">
          {properties.map((p, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              <div>
                <span className="font-medium">{p.displayName}</span>
                <span className="text-muted-foreground ml-2 text-xs">{p.url}</span>
              </div>
              <Button variant="ghost" size="sm"
                onClick={() => save(properties.filter((_, j) => j !== i))} disabled={saving}>
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 items-end">
        <div className="space-y-1 flex-1">
          <Label className="text-xs">Property URL</Label>
          <Input placeholder="https://example.com/" value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} />
        </div>
        <div className="space-y-1 flex-1">
          <Label className="text-xs">Display name</Label>
          <Input placeholder="Example.com" value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} />
        </div>
        <Button size="sm" onClick={add} disabled={saving || !newUrl.trim() || !newName.trim()}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

// ─── Groups ───────────────────────────────────────────────────────────────────

function GroupsCard({
  initialGroups,
  users,
  userMap,
}: {
  initialGroups: GroupData[];
  users: UserOption[];
  userMap: Record<string, UserOption>;
}) {
  const router = useRouter();
  const [groups, setGroups] = useState(initialGroups);
  const [newName, setNewName] = useState("");
  const [newLeadId, setNewLeadId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [localUserMap] = useState(userMap);

  const subLeads = users.filter((u) => u.role === "sub-lead"); // "sub-lead" is stored as-is in DB, shown as "Supervisor"
  const regularUsers = users.filter((u) => u.role === "admin");

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSaving(true);
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, leadUserId: newLeadId }),
    });
    setSaving(false);
    if (!res.ok) { setError((await res.json()).error); return; }
    setNewName(""); setNewLeadId("");
    router.refresh();
    // Refetch groups
    const gr = await fetch("/api/groups");
    if (gr.ok) setGroups(await gr.json().then(mapGroups));
  }

  function mapGroups(data: { id: string; name: string; lead: { id: string } | null; members: { id: string }[] }[]): GroupData[] {
    return data.map((g) => ({
      id: g.id,
      name: g.name,
      leadUserId: g.lead?.id ?? "",
      memberUserIds: g.members.map((m) => m.id),
    }));
  }

  async function deleteGroup(id: string, name: string) {
    if (!confirm(`Delete group "${name}"?`)) return;
    const res = await fetch(`/api/groups/${id}`, { method: "DELETE" });
    if (res.ok) {
      setGroups((prev) => prev.filter((g) => g.id !== id));
      router.refresh();
    }
  }

  async function toggleMember(group: GroupData, userId: string) {
    const currentIds = group.memberUserIds;
    const updated = currentIds.includes(userId)
      ? currentIds.filter((id) => id !== userId)
      : [...currentIds, userId];

    const res = await fetch(`/api/groups/${group.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberUserIds: updated }),
    });
    if (res.ok) {
      setGroups((prev) =>
        prev.map((g) => g.id === group.id ? { ...g, memberUserIds: updated } : g)
      );
    }
  }

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Team Groups</h3>
          <p className="text-sm text-muted-foreground">
            Assign supervisors to groups. Each supervisor can view their group members&apos; activity.
          </p>
        </div>
        <Badge variant={groups.length > 0 ? "success" : "outline"}>
          {groups.length} {groups.length === 1 ? "group" : "groups"}
        </Badge>
      </div>

      {/* Existing groups */}
      {groups.length > 0 && (
        <div className="space-y-2">
          {groups.map((group) => {
            const lead = localUserMap[group.leadUserId];
            const isExpanded = expandedId === group.id;
            return (
              <div key={group.id} className="rounded-xl border overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{group.name}</span>
                    <span className="text-muted-foreground text-xs">
                      Supervisor: {lead?.name ?? "Unknown"}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {group.memberUserIds.length} member{group.memberUserIds.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => setExpandedId(isExpanded ? null : group.id)}
                    >
                      {isExpanded
                        ? <ChevronUp className="h-3.5 w-3.5" />
                        : <ChevronDown className="h-3.5 w-3.5" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteGroup(group.id, group.name)}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-3 py-3 border-t space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Assign / remove members
                    </p>
                    {regularUsers.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No regular users found.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-1.5">
                        {regularUsers.map((u) => {
                          const isMember = group.memberUserIds.includes(u.id);
                          return (
                            <button
                              key={u.id}
                              onClick={() => toggleMember(group, u.id)}
                              className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs text-left transition-colors ${
                                isMember
                                  ? "border-primary/50 bg-primary/5 text-primary"
                                  : "hover:bg-muted/50"
                              }`}
                            >
                              <div className={`h-2 w-2 rounded-full flex-shrink-0 ${isMember ? "bg-primary" : "bg-muted-foreground/30"}`} />
                              {u.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create group form */}
      <form onSubmit={createGroup} className="space-y-3 pt-2 border-t">
        <p className="text-sm font-medium pt-1">Create a new group</p>
        <div className="flex gap-2">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Group name</Label>
            <Input
              placeholder="e.g. SEO Team A"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
            />
          </div>
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Supervisor</Label>
            <select
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={newLeadId}
              onChange={(e) => setNewLeadId(e.target.value)}
              required
            >
              <option value="">Select supervisor…</option>
              {subLeads.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>
        {subLeads.length === 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            No supervisors found. Go to Users to assign the Supervisor role first.
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" size="sm" disabled={saving || !newName.trim() || !newLeadId}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          <Plus className="h-4 w-4" />
          Create group
        </Button>
      </form>
    </div>
  );
}

// ─── GA4 Properties ───────────────────────────────────────────────────────────

function Ga4PropertiesCard({ initial }: { initial: Ga4Property[] }) {
  const router = useRouter();
  const [properties, setProperties] = useState(initial);
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(updated: Ga4Property[]) {
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ga4Properties: updated }),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      setProperties(data.ga4Properties);
      router.refresh();
    }
  }

  function add() {
    if (!newId.trim() || !newName.trim()) return;
    save([...properties, { propertyId: newId.trim(), displayName: newName.trim() }]);
    setNewId(""); setNewName("");
  }

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
      <div>
        <h3 className="font-semibold">GA4 Properties</h3>
        <p className="text-sm text-muted-foreground">Properties available for the GA4 Reporter script.</p>
      </div>

      {properties.length > 0 && (
        <div className="space-y-2">
          {properties.map((p, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              <div>
                <span className="font-medium">{p.displayName}</span>
                <span className="text-muted-foreground ml-2 text-xs font-mono">{p.propertyId}</span>
              </div>
              <Button variant="ghost" size="sm"
                onClick={() => save(properties.filter((_, j) => j !== i))} disabled={saving}>
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 items-end">
        <div className="space-y-1 flex-1">
          <Label className="text-xs">Property ID</Label>
          <Input placeholder="properties/123456789" value={newId}
            onChange={(e) => setNewId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} />
        </div>
        <div className="space-y-1 flex-1">
          <Label className="text-xs">Display name</Label>
          <Input placeholder="Example.com (GA4)" value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} />
        </div>
        <Button size="sm" onClick={add} disabled={saving || !newId.trim() || !newName.trim()}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
