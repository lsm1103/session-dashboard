'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import type { Project, Session } from '@/lib/types';
import { SessionCard } from '@/components/session-list/SessionCard';
import { SessionDetail } from '@/components/session-detail/SessionDetail';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then(r => r.json());

function shortPath(p: string) {
  return p.replace(/^\/Users\/[^/]+\//, '~/');
}

const TOOL_COLOR: Record<string, string> = {
  'claude-code': 'text-orange-400',
  codex: 'text-blue-400',
};

function SessionsBrowser() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const selectedProject = searchParams.get('p') ?? '';
  const selectedSession = searchParams.get('s') ?? '';

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  // 获取项目列表
  const { data: projects, isLoading: projectsLoading } = useSWR<Project[]>('/api/projects', fetcher);

  // 获取 session 列表（选中项目时过滤）
  const sessionsUrl = (() => {
    const q = new URLSearchParams({ limit: '200' });
    if (selectedProject) q.set('projectPath', selectedProject);
    if (debouncedSearch) q.set('search', debouncedSearch);
    return `/api/sessions?${q}`;
  })();
  const { data: sessions, isLoading: sessionsLoading } = useSWR<Session[]>(sessionsUrl, fetcher);

  function selectProject(path: string) {
    const p = new URLSearchParams();
    if (path !== selectedProject) p.set('p', path);
    router.push(`/sessions${p.toString() ? `?${p}` : ''}`);
  }

  function selectSession(id: string) {
    const p = new URLSearchParams(searchParams.toString());
    p.set('s', id);
    router.push(`/sessions?${p}`);
  }

  function closeSession() {
    const p = new URLSearchParams(searchParams.toString());
    p.delete('s');
    router.push(`/sessions?${p}`);
  }

  return (
    <div className="flex h-screen overflow-hidden">

      {/* ── 左栏：项目列表 ── */}
      <div className="w-[220px] shrink-0 border-r border-border flex flex-col overflow-hidden">
        <div className="shrink-0 px-3 py-2.5 border-b border-border flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">项目</span>
          <Link href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            仪表板
          </Link>
        </div>

        {/* 全部 sessions 入口 */}
        <button
          onClick={() => selectProject('')}
          className={`shrink-0 text-left px-3 py-2 text-xs border-b border-border transition-colors flex items-center justify-between gap-1
            ${!selectedProject ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'}`}
        >
          <span>所有 Sessions</span>
          {projects && (
            <Badge variant="secondary" className="text-xs h-4 px-1 shrink-0">
              {projects.reduce((s, p) => s + p.sessionCount, 0)}
            </Badge>
          )}
        </button>

        {/* 项目列表 */}
        <div className="flex-1 overflow-y-auto py-1">
          {projectsLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-3 py-1.5">
                  <Skeleton className="h-5 w-full rounded" />
                </div>
              ))
            : projects?.map(project => (
                <button
                  key={project.id}
                  onClick={() => selectProject(project.path)}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-1 group
                    ${selectedProject === project.path
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'}`}
                >
                  <span className={`mr-1 ${TOOL_COLOR[project.toolId] ?? ''}`}>●</span>
                  <span className="truncate flex-1" title={project.path}>{shortPath(project.path)}</span>
                  <Badge variant="outline" className="text-xs h-4 px-1 shrink-0 opacity-60 group-hover:opacity-100">
                    {project.sessionCount}
                  </Badge>
                </button>
              ))}
        </div>
      </div>

      {/* ── 中栏：Session 列表 ── */}
      <div className="w-[300px] shrink-0 border-r border-border flex flex-col overflow-hidden">
        <div className="shrink-0 px-3 py-2 border-b border-border">
          <Input
            placeholder="搜索 sessions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-7 text-xs"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {sessionsLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="px-4 py-3 border-b border-border">
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))
            : !sessions?.length
              ? (
                <div className="px-4 py-8 text-xs text-muted-foreground text-center">
                  {debouncedSearch ? '没有匹配的 session' : '暂无 session'}
                </div>
              )
              : sessions.map(s => (
                  <SessionCard
                    key={s.id}
                    session={s}
                    isActive={s.id === selectedSession}
                    onClick={() => selectSession(s.id)}
                  />
                ))}
        </div>
      </div>

      {/* ── 右栏：聊天记录 ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedSession
          ? <SessionDetail sessionId={selectedSession} onClose={closeSession} />
          : (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              ← 选择一个 session 查看聊天记录
            </div>
          )}
      </div>

    </div>
  );
}

export default function SessionsPage() {
  return (
    <Suspense>
      <SessionsBrowser />
    </Suspense>
  );
}
