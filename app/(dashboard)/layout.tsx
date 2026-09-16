import { Suspense } from "react";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { MissedReportGuard } from "@/components/missed-report-guard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Suspense>
        <Sidebar />
      </Suspense>
      <div className="flex flex-1 flex-col overflow-hidden">
        <Suspense>
          <Topbar />
        </Suspense>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      <MissedReportGuard />
    </div>
  );
}
