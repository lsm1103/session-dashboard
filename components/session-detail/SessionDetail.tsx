'use client';

import { useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageBubble } from './MessageBubble';
import { useSession } from '@/hooks/useSession';

function shortPath(fullPath: string): string {
  return fullPath.replace(/^\/Users\/[^/]+\//, '~/');
}

const TOOL_BADGE: Record<string, string> = {
  'claude-code': 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  codex: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
};

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
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xl leading-none shrink-0 mt-0.5 px-1"
            aria-label="关闭"
          >
            ×
          </button>
        )}
      </div>

      {/* 消息区域 — 原生 overflow-y-auto 确保滚动 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {session.messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">暂无消息</p>
        ) : (
          session.messages.map(msg => (
            <MessageBubble key={msg.id} message={msg} />
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
