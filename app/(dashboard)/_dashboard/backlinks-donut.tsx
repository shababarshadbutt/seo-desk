"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const SEGMENTS = [
  { key: "live", label: "Live & Verified", color: "#10b981" },
  { key: "pending", label: "Pending Crawler", color: "#f59e0b" },
  { key: "broken", label: "Broken / 404", color: "#f43f5e" },
] as const;

export function BacklinksDonut({ live, pending, broken }: { live: number; pending: number; broken: number }) {
  const total = live + pending + broken;
  const data = SEGMENTS.map((s) => ({
    ...s,
    value: s.key === "live" ? live : s.key === "pending" ? pending : broken,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Backlinks Status Breakdown</CardTitle>
        <p className="text-xs text-muted-foreground">Portfolio verification &amp; indexing status</p>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No backlinks yet.</p>
        ) : (
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={data} dataKey="value" nameKey="label" innerRadius={50} outerRadius={72} paddingAngle={2}>
                    {data.map((d) => (
                      <Cell key={d.key} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-bold text-foreground">{total.toLocaleString()}</span>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Links</span>
              </div>
            </div>
            <div className="flex-1 space-y-2 text-xs">
              {data.map((d) => (
                <div key={d.key} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    {d.label}
                  </span>
                  <span className="font-medium text-foreground shrink-0">
                    {d.value.toLocaleString()} ({total > 0 ? Math.round((d.value / total) * 100) : 0}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
