'use client';

import { useState, useEffect, useRef, Suspense, useCallback } from 'react';
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

// 取路径最后一段作为项目名
function lastName(p: string) {
  return p.split('/').filter(Boolean).pop() ?? p;
}

// 缩短路径用于副标题显示
function shortPath(p: string) {
  return p.replace(/^\/Users\/[^/]+\//, '~/');
}

// ── 工具配置 ──────────────────────────────────────────────────
const TOOL_CONFIG: Record<string, { label: string; short: string; dot: string; badge: string; filter: string }> = {
  'claude-code': {
    label: 'Claude Code',
    short: 'CC',
    dot: 'bg-orange-500',
    badge: 'bg-orange-500/10 text-orange-400 border-orange-500/25',
    filter: 'cc',
  },
  codex: {
    label: 'Codex CLI',
    short: 'CDX',
    dot: 'bg-blue-500',
    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/25',
    filter: 'codex',
  },
};

type ToolFilter = 'all' | 'cc' | 'codex';

// ── 复制按钮 ──────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <button
      onClick={handleCopy}
      title="复制完整路径"
      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground"
    >
      {copied ? (
        <svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );
}

// ── 项目卡片 ──────────────────────────────────────────────────
function ProjectCard({
  project,
  isActive,
  onClick,
  collapsed,
}: {
  project: Project;
  isActive: boolean;
  onClick: () => void;
  collapsed?: boolean;
}) {
  const cfg = TOOL_CONFIG[project.toolId];
  const [showTooltip, setShowTooltip] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});

  function handleMouseEnter() {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const spaceRight = window.innerWidth - rect.right;
      if (spaceRight > 220) {
        setTooltipStyle({ left: '100%', top: 0, marginLeft: 4 });
      } else {
        setTooltipStyle({ left: 0, top: '100%', marginTop: 4 });
      }
    }
    setShowTooltip(true);
  }

  // 折叠态：只显示工具色圆点
  if (collapsed) {
    return (
      <div
        ref={cardRef}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && onClick()}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShowTooltip(false)}
        className={`relative flex items-center justify-center py-2 border-b border-border/50 cursor-pointer transition-all duration-150
          ${isActive
            ? 'bg-gradient-to-r from-emerald-500/40 to-transparent'
            : 'hover:bg-accent/40'}`}
      >
        {cfg && <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />}
        {showTooltip && (
          <div
            style={tooltipStyle}
            className="absolute z-50 bg-popover border border-border rounded shadow-lg px-3 py-2 text-xs whitespace-nowrap pointer-events-none"
          >
            <div className="text-foreground font-medium">{lastName(project.path)}</div>
            <div className="text-muted-foreground mt-0.5">{shortPath(project.path)}</div>
            <div className="text-muted-foreground mt-0.5">项目: {project.sessionCount} sessions</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShowTooltip(false)}
      className={`relative group w-full text-left px-3 py-2.5 border-b border-border/50 transition-all duration-150 cursor-pointer
        ${isActive
          ? 'bg-gradient-to-r from-emerald-500/40 via-emerald-500/10 to-transparent border-l-[3px] border-l-emerald-300 [box-shadow:inset_3px_0_24px_rgba(110,231,183,0.28)]'
          : 'hover:bg-accent/40 border-l-[3px] border-l-transparent hover:border-l-emerald-600/40'}`}
    >
      {/* 第一行：项目名 + 复制按钮 */}
      <div className="flex items-center justify-between gap-1 mb-1.5">
        <span className={`text-sm font-medium truncate flex-1 ${isActive ? 'text-foreground' : 'text-foreground/90'}`}>
          {lastName(project.path)}
        </span>
        <CopyButton text={project.path} />
      </div>

      {/* 第二行：缩短的完整路径 */}
      <p className="text-xs text-muted-foreground truncate mb-2">
        {shortPath(project.path)}
      </p>

      {/* 第三行：工具 badge + session 数量 */}
      <div className="flex items-center gap-1.5">
        {cfg && (
          <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border ${cfg.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.short}
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border border-border/60 text-muted-foreground">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          {project.sessionCount}
        </span>
      </div>

      {/* Tooltip 浮层 */}
      {showTooltip && (
        <div
          style={tooltipStyle}
          className="absolute z-50 bg-popover border border-border rounded shadow-lg px-3 py-2 text-xs whitespace-nowrap pointer-events-none"
        >
          <div className="text-foreground font-medium">{lastName(project.path)}</div>
          <div className="text-muted-foreground mt-0.5">{shortPath(project.path)}</div>
          <div className="text-muted-foreground mt-0.5">项目: {project.sessionCount} sessions</div>
        </div>
      )}
    </div>
  );
}

// ── 筛选按钮组 ────────────────────────────────────────────────
const FILTERS: { key: ToolFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'cc', label: 'CC' },
  { key: 'codex', label: 'Codex' },
];

function FilterTabs({
  value,
  onChange,
  counts,
}: {
  value: ToolFilter;
  onChange: (v: ToolFilter) => void;
  counts: Record<ToolFilter, number>;
}) {
  return (
    <div className="flex gap-1 px-2 py-2 shrink-0 border-b border-border">
      {FILTERS.map(f => (
        <button
          key={f.key}
          onClick={() => onChange(f.key)}
          className={`flex-1 text-xs py-1 px-1.5 rounded transition-all duration-150
            ${value === f.key
              ? 'bg-accent text-accent-foreground font-medium shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'}`}
        >
          {f.label}
          {counts[f.key] > 0 && (
            <span className={`ml-1 text-[10px] ${value === f.key ? 'opacity-70' : 'opacity-50'}`}>
              {counts[f.key]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── 主组件 ────────────────────────────────────────────────────
function SessionsBrowser() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const selectedProject = searchParams.get('p') ?? '';
  const selectedSession = searchParams.get('s') ?? '';

  const [toolFilter, setToolFilter] = useState<ToolFilter>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // 左栏折叠 + 拖拽宽度
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [leftWidth, setLeftWidth] = useState(280);
  const [middleWidth, setMiddleWidth] = useState(340);

  // 键盘导航
  const [keyboardIndex, setKeyboardIndex] = useState<number>(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const { data: projects, isLoading: projectsLoading } = useSWR<Project[]>('/api/projects', fetcher);

  // 按工具筛选项目
  const filteredProjects = (projects ?? []).filter(p => {
    if (toolFilter === 'cc') return p.toolId === 'claude-code';
    if (toolFilter === 'codex') return p.toolId === 'codex';
    return true;
  });

  // 筛选按钮上的数量
  const filterCounts: Record<ToolFilter, number> = {
    all: projects?.length ?? 0,
    cc: projects?.filter(p => p.toolId === 'claude-code').length ?? 0,
    codex: projects?.filter(p => p.toolId === 'codex').length ?? 0,
  };

  // Sessions API
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

  const selectSession = useCallback((id: string) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set('s', id);
    router.push(`/sessions?${p}`);
  }, [searchParams, router]);

  const closeSession = useCallback(() => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete('s');
    router.push(`/sessions?${p}`);
  }, [searchParams, router]);

  const totalSessions = projects?.reduce((s, p) => s + p.sessionCount, 0) ?? 0;

  // 左栏折叠/展开
  function toggleSidebar() {
    setSidebarCollapsed(v => !v);
  }

  // 拖拽 resize
  function startLeftResize(e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = leftWidth;
    const onMove = (ev: MouseEvent) => setLeftWidth(Math.max(160, Math.min(480, startW + ev.clientX - startX)));
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function startMiddleResize(e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = middleWidth;
    const onMove = (ev: MouseEvent) => setMiddleWidth(Math.max(200, Math.min(520, startW + ev.clientX - startX)));
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // 键盘导航：sessions 变化时重置 index
  useEffect(() => {
    setKeyboardIndex(-1);
  }, [sessions]);

  // 键盘事件监听
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const active = document.activeElement;
      const isInputFocused = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;

      // '/' 聚焦搜索框
      if (e.key === '/' && !isInputFocused) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // Escape
      if (e.key === 'Escape') {
        if (isInputFocused && search) {
          setSearch('');
          (active as HTMLInputElement).blur();
          return;
        }
        if (selectedSession) {
          closeSession();
          return;
        }
      }

      // 不在输入框中时才处理方向键
      if (isInputFocused) return;
      if (!sessions?.length) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setKeyboardIndex(prev => Math.min(prev + 1, sessions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setKeyboardIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        if (keyboardIndex >= 0 && keyboardIndex < sessions.length) {
          selectSession(sessions[keyboardIndex].id);
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sessions, keyboardIndex, search, selectedSession, closeSession, selectSession]);

  // 计算当前选中项目的 session 数量
  const currentSessionCount = sessions?.length ?? 0;

  const sidebarW = sidebarCollapsed ? 48 : leftWidth;

  return (
    <div className="flex w-screen h-screen overflow-hidden bg-background">

      {/* ══ 左栏：项目列表 ══ */}
      <div
        className="shrink-0 flex flex-col overflow-hidden border-r border-border bg-card/30 transition-[width] duration-150"
        style={{ width: sidebarW }}
      >
        <div className="flex flex-col h-full overflow-hidden">

          {/* 顶栏 */}
          <div className="shrink-0 px-3 py-3 border-b border-border flex items-center justify-between">
            {sidebarCollapsed ? (
              <button
                onClick={toggleSidebar}
                className="w-full flex items-center justify-center text-xs text-muted-foreground hover:text-foreground transition-colors"
                title="展开侧栏"
              >
                &raquo;
              </button>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-primary/90 flex items-center justify-center text-primary-foreground text-[10px] font-bold shrink-0">
                    SD
                  </div>
                  <span className="text-sm font-semibold">Session</span>
                </div>
                <div className="flex items-center gap-2">
                  <Link href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                    仪表板
                  </Link>
                  <button
                    onClick={toggleSidebar}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1"
                    title="折叠侧栏"
                  >
                    &laquo;
                  </button>
                </div>
              </>
            )}
          </div>

          {/* 折叠态下只显示工具色圆点列表 */}
          {sidebarCollapsed ? (
            <div className="flex-1 overflow-y-auto">
              {/* 全部入口（折叠态） */}
              <div
                onClick={() => selectProject('')}
                role="button"
                tabIndex={0}
                className={`flex items-center justify-center py-2 border-b border-border/50 cursor-pointer transition-all duration-150
                  ${!selectedProject ? 'bg-emerald-500/20' : 'hover:bg-accent/40'}`}
              >
                <span className="text-[10px] text-muted-foreground font-mono">{totalSessions}</span>
              </div>
              {filteredProjects.map(project => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  isActive={selectedProject === project.path}
                  onClick={() => selectProject(project.path)}
                  collapsed
                />
              ))}
            </div>
          ) : (
            <>
              {/* 全部入口 */}
              <button
                onClick={() => selectProject('')}
                className={`shrink-0 text-left px-3 py-2.5 border-b border-border transition-all duration-150 flex items-center justify-between gap-2
                  ${!selectedProject
                    ? 'bg-gradient-to-r from-emerald-500/20 via-emerald-500/5 to-transparent text-foreground font-medium border-l-[3px] border-l-emerald-300 [box-shadow:inset_3px_0_20px_rgba(110,231,183,0.15)]'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/40 border-l-[3px] border-l-transparent hover:border-l-emerald-600/40'}`}
              >
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <span className="text-sm">所有项目</span>
                </div>
                <Badge variant="secondary" className="text-xs h-5 px-1.5 shrink-0 font-mono">
                  {totalSessions}
                </Badge>
              </button>

              {/* 工具筛选 */}
              <FilterTabs value={toolFilter} onChange={setToolFilter} counts={filterCounts} />

              {/* 项目卡片列表 */}
              <div className="flex-1 overflow-y-auto">
                {projectsLoading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="px-3 py-3 border-b border-border/50 space-y-1.5">
                        <Skeleton className="h-4 w-3/5 rounded" />
                        <Skeleton className="h-3 w-4/5 rounded" />
                        <Skeleton className="h-5 w-2/5 rounded" />
                      </div>
                    ))
                  : filteredProjects.length === 0
                    ? (
                      <div className="px-3 py-6 text-xs text-muted-foreground text-center">
                        无项目
                      </div>
                    )
                    : filteredProjects.map(project => (
                        <ProjectCard
                          key={project.id}
                          project={project}
                          isActive={selectedProject === project.path}
                          onClick={() => selectProject(project.path)}
                        />
                      ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 拖拽分隔线 1 */}
      <div
        onMouseDown={startLeftResize}
        className="w-1 shrink-0 bg-border/50 hover:bg-emerald-500/50 active:bg-emerald-400 transition-colors cursor-col-resize"
      />

      {/* ══ 中栏：Session 列表 ══ */}
      <div
        className="shrink-0 flex flex-col overflow-hidden border-r border-border"
        style={{ width: middleWidth }}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* 项目信息条 */}
          <div className="shrink-0 px-3 py-2 border-b border-border text-xs flex items-center justify-between">
            {selectedProject ? (
              <>
                <span className="font-medium text-foreground truncate">{lastName(selectedProject)}</span>
                <span className="text-muted-foreground ml-2 shrink-0">{currentSessionCount} sessions</span>
              </>
            ) : (
              <span className="font-medium text-foreground">所有 Sessions</span>
            )}
          </div>

          {/* 搜索框 */}
          <div className="shrink-0 px-3 py-2.5 border-b border-border">
            <Input
              ref={searchInputRef}
              placeholder="搜索 sessions...  ( / )"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 text-sm"
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
                  <div className="px-4 py-10 text-sm text-muted-foreground text-center">
                    {debouncedSearch ? '没有匹配的 session' : '暂无 session'}
                  </div>
                )
                : sessions.map((s, i) => (
                    <div
                      key={s.id}
                      className={keyboardIndex === i ? 'ring-1 ring-emerald-400/50 rounded-sm' : ''}
                    >
                      <SessionCard
                        session={s}
                        isActive={s.id === selectedSession}
                        onClick={() => selectSession(s.id)}
                      />
                    </div>
                  ))}
          </div>
        </div>
      </div>

      {/* 拖拽分隔线 2 */}
      <div
        onMouseDown={startMiddleResize}
        className="w-1 shrink-0 bg-border/50 hover:bg-emerald-500/50 active:bg-emerald-400 transition-colors cursor-col-resize"
      />

      {/* ══ 右栏：聊天记录 ══ */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="flex flex-col h-full overflow-hidden">
          {selectedSession
            ? <SessionDetail sessionId={selectedSession} onClose={closeSession} />
            : (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <svg className="w-8 h-8 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <span className="text-sm">选择一个 session 查看聊天记录</span>
              </div>
            )}
        </div>
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
