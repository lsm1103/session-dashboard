'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageBubble } from './MessageBubble';
import { DebugPathReplay } from './DebugPathReplay';
import { NarrativeTimeline } from './NarrativeTimeline';
import { SessionEfficiencyPanel } from './SessionEfficiencyPanel';
import {
  DEFAULT_MESSAGE_CHUNK_SIZE,
  getInitialVisibleMessageCount,
  getNextVisibleMessageCount,
  getVisibleMessages,
} from '@/lib/session-view';
import { useSession } from '@/hooks/useSession';
import type { SessionDetail as SessionDetailType, Message } from '@/lib/types';

function shortPath(fullPath: string): string {
  return fullPath.replace(/^\/Users\/[^/]+\//, '~/');
}

const TOOL_BADGE: Record<string, string> = {
  'claude-code': 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  codex: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
};

/** 格式化时长 */
function formatDuration(startTime: Date, endTime: Date): string {
  const ms = new Date(endTime).getTime() - new Date(startTime).getTime();
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 1) return '< 1m';
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

/** 把 messages 按日期分组，返回 { dateStr, messages }[] */
function groupMessagesByDate(messages: Message[]): { dateStr: string; messages: Message[] }[] {
  if (messages.length === 0) return [];
  const groups: { dateStr: string; messages: Message[] }[] = [];
  let currentDate = '';
  for (const msg of messages) {
    const d = new Date(msg.timestamp).toLocaleDateString('zh-CN');
    if (d !== currentDate) {
      currentDate = d;
      groups.push({ dateStr: d, messages: [] });
    }
    groups[groups.length - 1].messages.push(msg);
  }
  return groups;
}

/** 导出 session 为 Markdown 并触发下载 */
function exportSessionAsMarkdown(session: SessionDetailType): void {
  const toolName = session.toolId === 'claude-code' ? 'Claude Code' : 'Codex CLI';
  const startTimeStr = new Date(session.startTime).toLocaleString();

  let md = `# ${session.title}\n\n`;
  md += `**项目**: ${session.projectPath}  \n`;
  md += `**工具**: ${toolName}  \n`;
  md += `**开始时间**: ${startTimeStr}  \n`;
  md += `**消息数**: ${session.messageCount}\n\n---\n`;

  for (const msg of session.messages) {
    const roleLabel = msg.role === 'user' ? '用户' : '助手';
    md += `\n## ${roleLabel}\n\n${msg.content}\n\n---\n`;
  }

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `session-${session.id.slice(0, 8)}-${dateStr}.md`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface Props {
  sessionId: string;
  onClose?: () => void;
}

export function SessionDetail({ sessionId, onClose }: Props) {
  const { session, isLoading, error } = useSession(sessionId);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 切换 session 时滚动到底部
  useEffect(() => {
    if (session && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [session?.id]);

  const handleExport = useCallback(() => {
    if (session) exportSessionAsMarkdown(session);
  }, [session]);

  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);
  const [showAnalysis, setShowAnalysis] = useState(true);
  const [visibleMessageCount, setVisibleMessageCount] = useState(DEFAULT_MESSAGE_CHUNK_SIZE);

  useEffect(() => {
    if (!session) return;
    setVisibleMessageCount(getInitialVisibleMessageCount(session.messages.length));
  }, [session?.id, session?.messages.length, session]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const all = JSON.parse(localStorage.getItem('sd-msg-bookmarks') || '{}');
      setBookmarkedIds(all[sessionId] || []);
    } catch { /* ignore */ }
  }, [sessionId]);

  // Listen for bookmark changes from MessageBubble
  useEffect(() => {
    function handleStorage() {
      try {
        const all = JSON.parse(localStorage.getItem('sd-msg-bookmarks') || '{}');
        setBookmarkedIds(all[sessionId] || []);
      } catch { /* ignore */ }
    }
    window.addEventListener('storage', handleStorage);
    // Also listen for custom event for same-tab updates
    window.addEventListener('sd-bookmark-change', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('sd-bookmark-change', handleStorage);
    };
  }, [sessionId]);

  function jumpToNextBookmark() {
    if (!bookmarkedIds.length) return;
    const targetId = bookmarkedIds[0];
    const visibleIds = new Set(visibleMessages.map(message => message.id));

    if (!visibleIds.has(targetId) && session) {
      setVisibleMessageCount(session.messages.length);
      requestAnimationFrame(() => {
        const el = scrollRef.current?.querySelector(`[data-msg-id="${targetId}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      return;
    }

    const el = scrollRef.current?.querySelector(`[data-msg-id="${targetId}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="shrink-0 px-4 py-3 border-b border-border">
          <Skeleton className="h-4 w-2/3 mb-2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
              <Skeleton className="h-16 w-2/3 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Session 未找到
      </div>
    );
  }

  const toolClass = TOOL_BADGE[session.toolId] ?? '';
  const userCount = session.messages.filter(m => m.role === 'user').length;
  const assistantCount = session.messages.filter(m => m.role === 'assistant').length;
  const duration = formatDuration(session.startTime, session.lastActivity);
  const visibleMessages = getVisibleMessages(session.messages, visibleMessageCount);
  const dateGroups = groupMessagesByDate(visibleMessages);
  const hiddenMessageCount = Math.max(0, session.messages.length - visibleMessageCount);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 顶部信息栏 */}
      <div className="shrink-0 px-4 py-3 border-b border-border flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <Badge variant="outline" className={`text-xs ${toolClass}`}>
              {session.toolId === 'claude-code' ? 'Claude Code' : 'Codex'}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(session.startTime).toLocaleString()}
            </span>
          </div>
          <p className="text-sm font-medium leading-snug line-clamp-1">{session.title}</p>
          <p className="text-xs text-muted-foreground truncate mt-0.5" title={session.projectPath}>
            {shortPath(session.projectPath)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {duration} &middot; {userCount}&uarr; {assistantCount}&darr;
          </p>
          {/* 文件变更摘要 */}
          {(() => {
            const touchedFiles = session.touchedFiles;
            if (!touchedFiles || touchedFiles.length === 0) return null;
            return (
              <div className="flex items-start gap-1 mt-1 flex-wrap">
                <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">涉及文件</span>
                {touchedFiles.slice(0, 5).map((f, i) => (
                  <span key={i} className="text-[10px] bg-accent/60 text-muted-foreground rounded px-1 font-mono truncate max-w-[120px]" title={f}>
                    {f.split('/').pop()}
                  </span>
                ))}
                {touchedFiles.length > 5 && (
                  <span className="text-[10px] text-muted-foreground">+{touchedFiles.length - 5} 个</span>
                )}
              </div>
            );
          })()}
        </div>
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          <button
            onClick={jumpToNextBookmark}
            disabled={bookmarkedIds.length === 0}
            className={`p-1 rounded transition-colors ${
              bookmarkedIds.length > 0
                ? 'text-amber-400 hover:bg-accent/50'
                : 'text-muted-foreground/30 cursor-not-allowed'
            }`}
            title={bookmarkedIds.length > 0 ? `跳转到书签 (${bookmarkedIds.length})` : '无书签'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
            </svg>
          </button>
          <button
            onClick={handleExport}
            className="text-muted-foreground hover:text-foreground p-1"
            aria-label="导出 Markdown"
            title="导出 Markdown"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
            </svg>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground text-xl leading-none px-1"
              aria-label="关闭"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      {session.analysis && (
        <div className="shrink-0 border-b border-border px-4 py-3 bg-background/40">
          <button
            onClick={() => setShowAnalysis(value => !value)}
            className="w-full flex items-center justify-between text-left"
          >
            <div>
              <p className="text-sm font-medium">分析增强</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                叙事时间线、效率信号与调试路径回放
              </p>
            </div>
            <span className="text-xs text-muted-foreground">
              {showAnalysis ? '收起' : '展开'}
            </span>
          </button>
          {showAnalysis && (
            <div className="grid gap-3 mt-3 max-h-[60vh] overflow-y-auto pr-1">
              <NarrativeTimeline timeline={session.analysis.timeline} />
              <SessionEfficiencyPanel
                efficiency={session.analysis.efficiency}
                workflowStyle={session.analysis.workflowStyle}
              />
              <DebugPathReplay debugPath={session.analysis.debugPath} />
            </div>
          )}
        </div>
      )}

      {/* 消息区域 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {hiddenMessageCount > 0 && (
          <div className="mb-4">
            <button
              onClick={() => setVisibleMessageCount(current => getNextVisibleMessageCount(current, session.messages.length))}
              className="w-full rounded-lg border border-border bg-card/70 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
            >
              加载更早消息（还有 {hiddenMessageCount} 条）
            </button>
          </div>
        )}
        {session.messages.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <svg className="w-10 h-10 opacity-20" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
            </svg>
            <p className="text-sm">这个 session 没有消息记录</p>
          </div>
        ) : (
          dateGroups.map(group => (
            <div key={group.dateStr}>
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-border/50" />
                <span className="text-xs text-muted-foreground px-2">{group.dateStr}</span>
                <div className="flex-1 h-px bg-border/50" />
              </div>
              {group.messages.map(msg => (
                <div key={msg.id} data-msg-id={msg.id}>
                  <MessageBubble message={msg} toolId={session.toolId} />
                </div>
              ))}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
