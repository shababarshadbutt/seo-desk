import { ScrollText, Link2, Globe, Users } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import type { DomainStats, SpecialistVelocity } from "@/lib/dashboard-stats";

export function KpiRow({
  exec,
  backlinks,
  domains,
  specialists,
}: {
  exec: { total: number; success: number; error: number; running: number; changePct: number | null; changeCaption: string };
  backlinks: { total: number; live: number; pending: number; broken: number };
  domains: DomainStats;
  specialists: SpecialistVelocity;
}) {
  const backlinkHealthPct = backlinks.total > 0 ? Math.round((backlinks.live / backlinks.total) * 100) : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      <StatCard
        icon={ScrollText}
        label="Script Executions"
        value={exec.total}
        color="primary"
        delta={{ pct: exec.changePct, caption: exec.changeCaption }}
        breakdown={[
          { label: "Succeeded", value: exec.success, tone: "emerald" },
          { label: "Failed", value: exec.error, tone: "rose" },
          { label: "Running", value: exec.running, tone: "amber" },
        ]}
      />
      <StatCard
        icon={Link2}
        label="Backlinks Verified"
        value={backlinks.total}
        color="emerald"
        caption={`${backlinkHealthPct}% Live`}
        breakdown={[
          { label: "Live", value: backlinks.live, tone: "emerald" },
          { label: "Pending", value: backlinks.pending, tone: "amber" },
          { label: "Broken", value: backlinks.broken, tone: "rose" },
        ]}
      />
      <StatCard
        icon={Globe}
        label="Managed Domains"
        value={domains.websites}
        color="amber"
        caption={`${domains.indexedUrls.toLocaleString()} Indexed URLs`}
        breakdown={[{ label: "Sitemaps Synced", value: domains.sitemapsSynced, tone: "muted" }]}
      />
      <StatCard
        icon={Users}
        label="Specialists Velocity"
        value={specialists.activeSpecialists}
        color="rose"
        caption={`${specialists.totalSpecialists} Total Specialists`}
        breakdown={[{ label: "Tasks Queued", value: specialists.tasksQueued, tone: "muted" }]}
      />
    </div>
  );
}
