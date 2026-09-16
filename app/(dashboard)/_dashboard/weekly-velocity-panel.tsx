"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { SegmentedBar } from "@/components/ui/segmented-bar";
import type { VelocityDay } from "@/lib/dashboard-stats";

export function WeeklyVelocityPanel({
  days,
  quota,
}: {
  days: VelocityDay[];
  quota: { gscUsed: number; gscLimit: number; bingUsed: number; bingLimit: number };
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly Execution Velocity</CardTitle>
        <p className="text-xs text-muted-foreground">Success vs. error over the preceding 7 days</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={days} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} wrapperClassName="!bg-popover" />
            <Bar dataKey="success" name="Success" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="error" name="Error" stackId="a" fill="#f43f5e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>

        <div className="space-y-3 pt-3 border-t border-border">
          <QuotaRow label="Google Search Console API Quota" used={quota.gscUsed} limit={quota.gscLimit} color="primary" />
          <QuotaRow label="Bing IndexNow Submissions" used={quota.bingUsed} limit={quota.bingLimit} color="emerald" />
        </div>
      </CardContent>
    </Card>
  );
}

function QuotaRow({
  label,
  used,
  limit,
  color,
}: {
  label: string;
  used: number;
  limit: number;
  color: "primary" | "emerald";
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground tabular-nums">
          {used.toLocaleString()} / {limit.toLocaleString()} ({Math.round((used / limit) * 100)}%)
        </span>
      </div>
      <SegmentedBar size="sm" segments={[{ value: used, color }, { value: Math.max(limit - used, 0), color: "muted" }]} />
    </div>
  );
}
