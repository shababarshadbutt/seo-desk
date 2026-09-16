import Link from "next/link";
import { CheckCircle2, XCircle, Loader2, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface RecentRun {
  _id: { toString(): string };
  scriptName: string;
  userName: string;
  websiteName?: string | null;
  startedAt: Date;
  status: string;
}

function formatRelative(date: Date): string {
  const diffMs = Date.now() - new Date(date).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function LiveStreamPanel({ runs, showUser }: { runs: RecentRun[]; showUser: boolean }) {
  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            Live Operational Stream
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </CardTitle>
        </div>
        <Link href="/logs" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline shrink-0">
          Open Live Terminal
          <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        {runs.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">No executions yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {runs.map((log) => {
              const Icon = log.status === "success" ? CheckCircle2 : log.status === "error" ? XCircle : Loader2;
              const iconClass =
                log.status === "success"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : log.status === "error"
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-amber-600 dark:text-amber-400";
              return (
                <div key={log._id.toString()} className="flex items-start gap-3 px-4 py-3">
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconClass}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground leading-snug">
                      {log.scriptName}
                      {log.websiteName && <span className="text-muted-foreground"> on {log.websiteName}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {showUser && `By: ${log.userName} · `}
                      {formatRelative(log.startedAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          Showing {runs.length} recent {runs.length === 1 ? "event" : "events"}
        </div>
      </CardContent>
    </Card>
  );
}
