'use client';
import useSWR from 'swr';
import { Skeleton } from '@/components/ui/skeleton';
import type { Project } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

function shortPath(p: string) {
  return p.replace(/^\/Users\/[^/]+\//, '~/');
}

export function TopProjects() {
  const { data: projects, isLoading } = useSWR<Project[]>('/api/projects', fetcher, {
    revalidateOnFocus: false,
  });

  if (isLoading) return (
    <div className="space-y-2">
      {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-8 w-full rounded" />)}
    </div>
  );

  const top5 = [...(projects ?? [])].sort((a, b) => b.sessionCount - a.sessionCount).slice(0, 5);
  const max = top5[0]?.sessionCount || 1;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground mb-3">最活跃项目 Top 5</p>
      <div className="space-y-2.5">
        {top5.map(p => (
          <div key={p.id}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="truncate text-foreground/80 max-w-[80%]" title={p.path}>
                {shortPath(p.path).split('/').pop()}
              </span>
              <span className="text-muted-foreground shrink-0 ml-2">{p.sessionCount}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${p.toolId === 'claude-code' ? 'bg-orange-500' : 'bg-blue-500'}`}
                style={{ width: `${(p.sessionCount / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
