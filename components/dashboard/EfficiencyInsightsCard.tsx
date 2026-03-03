'use client';

import useSWR from 'swr';
import { Skeleton } from '@/components/ui/skeleton';
import type { AnalysisOverview } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

const STAGE_LABELS = {
  discovery: '需求澄清',
  implementation: '实现',
  debugging: '调试',
  refactor: '重构',
  wrap_up: '收尾',
};

interface StatsPayload {
  analysisOverview?: AnalysisOverview;
}

export function EfficiencyInsightsCard() {
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
      <p className="text-xs text-muted-foreground mb-3">效率信号面板</p>
      <div className="space-y-3">
        <div className="rounded-md border border-border/60 bg-background/40 px-3 py-2">
          <p className="text-[11px] text-muted-foreground">高强度调试占比</p>
          <p className="text-lg font-semibold mt-1">{Math.round(overview.debugHeavyShare * 100)}%</p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-md bg-accent/40 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">主导阶段</p>
            <p className="font-medium mt-1">
              {STAGE_LABELS[overview.mostCommonStage] ?? overview.mostCommonStage}
            </p>
          </div>
          <div className="rounded-md bg-accent/40 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">分析样本</p>
            <p className="font-medium mt-1">{overview.totalAnalyzedSessions}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          最近的会话里，
          {' '}
          {Math.round(overview.debugHeavyShare * 100)}%
          {' '}
          更偏向高摩擦调试；当前最常见的阶段是
          {' '}
          {STAGE_LABELS[overview.mostCommonStage] ?? overview.mostCommonStage}
          。
        </p>
      </div>
    </div>
  );
}
