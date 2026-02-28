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
  onClick?: () => void;
}

export function SessionCard({ session, isActive, onClick }: Props) {
  const badge = TOOL_BADGE[session.toolId] ?? { label: session.toolId, className: '' };

  return (
    <div
      onClick={onClick}
      className={`px-4 py-3 border-b border-border transition-colors cursor-pointer hover:bg-accent/50 ${
        isActive ? 'bg-accent' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-sm font-medium leading-snug line-clamp-2 flex-1">
          {session.title}
        </p>
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
