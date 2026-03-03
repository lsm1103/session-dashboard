'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import useSWR from 'swr';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getProjectListKey } from '@/lib/utils';
import type { Project } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

const TOOL_LABELS: Record<string, string> = {
  'claude-code': 'CC',
  codex: 'CDX',
};

function shortPath(fullPath: string): string {
  return fullPath.replace(/^\/Users\/[^/]+\//, '~/');
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: projects } = useSWR<Project[]>('/api/projects', fetcher, {
    refreshInterval: 30000,
  });

  const totalSessions = projects?.reduce((s, p) => s + p.sessionCount, 0) ?? 0;

  // Group by toolId
  const grouped = (projects ?? []).reduce<Record<string, Project[]>>((acc, p) => {
    (acc[p.toolId] ??= []).push(p);
    return acc;
  }, {});

  return (
    <aside className="w-[250px] border-r border-border bg-card flex flex-col h-screen">
      {/* Logo */}
      <div className="px-4 py-4 flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
          S
        </div>
        <span className="font-semibold text-sm">Session Dashboard</span>
      </div>

      <Separator />

      {/* Nav */}
      <nav className="px-2 py-2 space-y-1">
        <Link
          href="/"
          className={`flex items-center px-2 py-1.5 rounded text-sm gap-2 transition-colors ${
            pathname === '/'
              ? 'bg-accent text-accent-foreground font-medium'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
          }`}
        >
          Dashboard
        </Link>
        <Link
          href="/sessions"
          className={`flex items-center justify-between px-2 py-1.5 rounded text-sm transition-colors ${
            pathname === '/sessions'
              ? 'bg-accent text-accent-foreground font-medium'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
          }`}
        >
          <span>All Sessions</span>
          {totalSessions > 0 && (
            <Badge variant="secondary" className="text-xs h-4 px-1">
              {totalSessions}
            </Badge>
          )}
        </Link>
      </nav>

      <Separator />

      {/* Project tree */}
      <ScrollArea className="flex-1 px-2 py-2">
        {Object.entries(grouped).map(([toolId, toolProjects]) => (
          <div key={toolId} className="mb-3">
            <div className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {toolId === 'claude-code' ? 'Claude Code' : 'Codex CLI'}
            </div>
            {toolProjects.map(project => (
              <Link
                key={getProjectListKey(project)}
                href={`/sessions?projectPath=${encodeURIComponent(project.path)}&toolId=${project.toolId}`}
                className="flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors text-muted-foreground hover:text-foreground hover:bg-accent/50 group"
              >
                <span className="truncate flex-1 mr-1" title={project.path}>
                  {shortPath(project.path)}
                </span>
                <Badge variant="outline" className="text-xs h-4 px-1 shrink-0">
                  {project.sessionCount}
                </Badge>
              </Link>
            ))}
          </div>
        ))}

        {!projects && (
          <div className="space-y-1 px-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-6 bg-muted rounded animate-pulse" />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border">
        <div className="flex gap-1">
          {Object.entries(TOOL_LABELS).map(([id, label]) => (
            <Badge key={id} variant="outline" className="text-xs">
              {label}
            </Badge>
          ))}
        </div>
      </div>
    </aside>
  );
}
