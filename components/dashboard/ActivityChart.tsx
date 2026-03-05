'use client';
import useSWR from 'swr';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import type { Session } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function ActivityChart() {
  const { data: sessions, isLoading } = useSWR<Session[]>(
    '/api/sessions?limit=500',
    fetcher,
    { revalidateOnFocus: false }
  );

  if (isLoading) return <Skeleton className="h-40 w-full rounded-lg" />;
  if (!sessions?.length) return null;

  // 生成最近 30 天的日期桶
  const today = new Date();
  const days: { date: string; label: string; cc: number; codex: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({
      date: key,
      label: i === 0 ? '今天' : i === 1 ? '昨天' : `${d.getMonth() + 1}/${d.getDate()}`,
      cc: 0,
      codex: 0,
    });
  }

  // 统计每天的 session 数
  for (const s of sessions) {
    const key = new Date(s.startTime).toISOString().slice(0, 10);
    const bucket = days.find(d => d.date === key);
    if (!bucket) continue;
    if (s.toolId === 'claude-code') bucket.cc++;
    else bucket.codex++;
  }

  // 只显示有数据的区间（去掉前面全是 0 的天）
  const firstNonZero = days.findIndex(d => d.cc + d.codex > 0);
  const chartData = firstNonZero >= 0 ? days.slice(firstNonZero) : days.slice(-14);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground mb-3">最近 {chartData.length} 天活跃度</p>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 6,
              fontSize: 12,
            }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
          />
          <Line
            type="monotone"
            dataKey="cc"
            name="Claude Code"
            stroke="#f97316"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="codex"
            name="Codex"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
