'use client';

import useSWR from 'swr';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { Session } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface Stats {
  totalSessions: number;
  totalProjects: number;
  perTool: { toolId: string; count: number }[];
  recentActivity: Session[];
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

export function StatsPanel() {
  const { data: stats, isLoading } = useSWR<Stats>('/api/stats', fetcher, {
    refreshInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 mb-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-lg border border-border bg-card p-4">
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-7 w-12" />
          </div>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Total Sessions" value={stats.totalSessions} />
        <StatCard label="Total Projects" value={stats.totalProjects} />
        {stats.perTool.map(({ toolId, count }) => (
          <StatCard
            key={toolId}
            label={toolId === 'claude-code' ? 'Claude Code Sessions' : 'Codex Sessions'}
            value={count}
          />
        ))}
      </div>
    </div>
  );
}
