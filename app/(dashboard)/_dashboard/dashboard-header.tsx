import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { OverviewFilters } from "@/app/(dashboard)/overview-filters";
import { ExportCsvButton } from "./export-csv-button";
import type { DashboardExportData } from "./export-csv-button";

export function DashboardHeader({
  firstName,
  role,
  roleLabel,
  totalSpecialists,
  websites,
  exportData,
}: {
  firstName: string;
  role: string;
  roleLabel: string;
  totalSpecialists: number;
  websites: number;
  exportData: DashboardExportData;
}) {
  const subtitle =
    role === "super-admin"
      ? `Full super-admin access — real-time workspace health, specialist velocity, and multi-tenant search operations across ${totalSpecialists} team members & ${websites} domains.`
      : role === "sub-lead"
      ? `Supervisor view — real-time health and velocity across your team's ${websites} domains.`
      : "Your personal activity summary.";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-foreground">
              Welcome back, {firstName} ({roleLabel})
            </h2>
            {role === "super-admin" && <Badge variant="outline">Executive View</Badge>}
          </div>
          <p className="text-muted-foreground text-sm mt-1 max-w-2xl">{subtitle}</p>
        </div>
        <ExportCsvButton data={exportData} />
      </div>
      <Suspense>
        <OverviewFilters />
      </Suspense>
    </div>
  );
}
