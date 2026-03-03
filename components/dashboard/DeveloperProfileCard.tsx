'use client';

import useSWR from 'swr';
import { Skeleton } from '@/components/ui/skeleton';
import type { AnalysisOverview, WorkflowStyle } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

const TOOL_LABELS: Record<string, string> = {
  'claude-code': 'Claude Code',
  codex: 'Codex',
  cursor: 'Cursor',
  aider: 'Aider',
  unknown: '暂无',
};

const WORKFLOW_LABELS: Record<WorkflowStyle, string> = {
  'debug-heavy': '调试驱动',
  builder: '实现驱动',
  exploratory: '探索驱动',
  'refactor-focused': '重构驱动',
  finisher: '收尾驱动',
};

interface StatsPayload {
  analysisOverview?: AnalysisOverview;
}

export function DeveloperProfileCard() {
  const { data, isLoading } = useSWR<StatsPayload>('/api/stats', fetcher, {
    revalidateOnFocus: false,
  });

  const overview = data?.analysisOverview;

  if (isLoading) {
    return <Skeleton className="h-44 w-full rounded-lg" />;
  }

  if (!overview || overview.totalAnalyzedSessions === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground mb-3">个人 AI 开发画像</p>
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium">{WORKFLOW_LABELS[overview.dominantWorkflowStyle]}</p>
          <p className="text-xs text-muted-foreground mt-1">
            最近 {overview.totalAnalyzedSessions} 个 session 里，你最常处在
            {' '}
            {WORKFLOW_LABELS[overview.dominantWorkflowStyle]}
            {' '}
            工作模式。
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-md bg-accent/40 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">最常用工具</p>
            <p className="font-medium mt-1">{TOOL_LABELS[overview.mostUsedTool] ?? overview.mostUsedTool}</p>
          </div>
          <div className="rounded-md bg-accent/40 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">平均时长</p>
            <p className="font-medium mt-1">{overview.averageDurationMinutes}m</p>
          </div>
          <div className="rounded-md bg-accent/40 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">平均消息数</p>
            <p className="font-medium mt-1">{overview.averageMessages}</p>
          </div>
          <div className="rounded-md bg-accent/40 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">平均文件触达</p>
            <p className="font-medium mt-1">{overview.averageTouchedFiles}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
