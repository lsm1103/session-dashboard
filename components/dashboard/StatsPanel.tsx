'use client';

import useSWR from 'swr';
import { Skeleton } from '@/components/ui/skeleton';
import type { AnalysisOverview, Session } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface Stats {
  totalSessions: number;
  totalProjects: number;
  perTool: { toolId: string; count: number }[];
  recentActivity: Session[];
  analysisOverview?: AnalysisOverview;
}

const TOOL_LABELS: Record<string, string> = {
  'claude-code': 'Claude Code Sessions',
  codex: 'Codex Sessions',
  cursor: 'Cursor Sessions',
  aider: 'Aider Sessions',
};

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

export function StatsPanel() {
  const { data: stats, isLoading, mutate } = useSWR<Stats>('/api/stats', fetcher, {
    refreshInterval: 60000,
  });

  async function rebuildIndex() {
    await fetch('/api/index/rebuild', { method: 'POST' });
    mutate();
  }

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
      <div className="flex justify-end">
        <button
          onClick={rebuildIndex}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-accent/50"
          title="重建本地索引（修复 session 缺失问题）"
        >
          ↺ 重建索引
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Total Sessions" value={stats.totalSessions} />
        <StatCard label="Total Projects" value={stats.totalProjects} />
        {stats.perTool.map(({ toolId, count }) => (
          <StatCard
            key={toolId}
            label={TOOL_LABELS[toolId] ?? `${toolId} Sessions`}
            value={count}
          />
        ))}
      </div>
    </div>
  );
}
