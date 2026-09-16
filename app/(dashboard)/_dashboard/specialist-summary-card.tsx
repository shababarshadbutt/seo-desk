import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export function SpecialistSummaryCard({
  backlinks,
  dailyReports,
  executions,
}: {
  backlinks: number;
  dailyReports: number;
  executions: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Workload</CardTitle>
        <p className="text-xs text-muted-foreground">Personal contribution summary</p>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-2xl font-bold text-foreground">{backlinks.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">Backlinks Logged</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{dailyReports.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">Daily Reports</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{executions.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">Executions</p>
        </div>
      </CardContent>
    </Card>
  );
}
