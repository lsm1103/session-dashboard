'use client';

import { Badge } from '@/components/ui/badge';
import type { Session } from '@/lib/types';

function timeAgo(date: Date): string {
  const d = date instanceof Date ? date : new Date(date);
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function shortPath(fullPath: string): string {
  return fullPath.replace(/^\/Users\/[^/]+\//, '~/');
}

const TOOL_BADGE: Record<string, { label: string; className: string }> = {
  'claude-code': { label: 'CC', className: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
  codex: { label: 'CDX', className: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
};

interface Props {
  session: Session;
  isActive?: boolean;
  isLive?: boolean;
  isStarred?: boolean;
  isInCompare?: boolean;
  onClick?: () => void;
  onToggleStar?: () => void;
  onToggleCompare?: () => void;
  onShowTokens?: () => void;
}

export function SessionCard({ session, isActive, isLive, isStarred, isInCompare, onClick, onToggleStar, onToggleCompare, onShowTokens }: Props) {
  const badge = TOOL_BADGE[session.toolId] ?? { label: session.toolId, className: '' };

  return (
    <div
      onClick={onClick}
      className={`relative group px-4 py-3 border-b border-border transition-all duration-150 cursor-pointer border-l-[3px] ${
        isActive
          ? 'bg-gradient-to-r from-emerald-500/40 via-emerald-500/10 to-transparent border-l-emerald-300 [box-shadow:inset_3px_0_24px_rgba(110,231,183,0.28)]'
          : isInCompare
          ? 'bg-blue-500/5 border-l-blue-400'
          : 'border-l-transparent hover:bg-accent/50 hover:border-l-emerald-600/40'
      }`}
    >
      {/* Token button */}
      {onShowTokens && (
        <button
          onClick={e => { e.stopPropagation(); onShowTokens(); }}
          className="absolute top-2 right-14 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
          title="Token 用量"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
        </button>
      )}

      {/* Compare button */}
      {onToggleCompare && (
        <button
          onClick={e => { e.stopPropagation(); onToggleCompare(); }}
          className={`absolute top-2 right-8 transition-opacity ${
            isInCompare ? 'opacity-100 text-amber-400' : 'opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-blue-400'
          }`}
          title={isInCompare ? '从对比中移除' : '添加到对比'}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
        </button>
      )}

      {/* Star button */}
      <button
        onClick={e => { e.stopPropagation(); onToggleStar?.(); }}
        className={`absolute top-2 right-2 transition-opacity ${
          isStarred ? 'opacity-100 text-amber-400' : 'opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-amber-400'
        }`}
      >
        <svg className="w-3.5 h-3.5" fill={isStarred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
      </button>

      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <p className="text-sm font-medium leading-snug line-clamp-2 flex-1">
            {session.title}
          </p>
          {isLive && (
            <span className="shrink-0 flex items-center gap-1 text-[10px] text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </span>
          )}
        </div>
        <Badge variant="outline" className={`text-xs shrink-0 ${badge.className}`}>
          {badge.label}
        </Badge>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="truncate flex-1 mr-2" title={session.projectPath}>
          {shortPath(session.projectPath)}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="secondary" className="text-xs h-4 px-1">
            {session.messageCount}
          </Badge>
          <span>{timeAgo(session.lastActivity)}</span>
        </div>
      </div>
    </div>
  );
}
