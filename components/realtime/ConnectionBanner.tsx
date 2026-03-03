'use client';

import type { RealtimeConnectionState } from '@/hooks/useRealtimeSocket';

interface ConnectionBannerProps {
  state: RealtimeConnectionState;
  message?: string | null;
}

const STATE_LABELS: Record<RealtimeConnectionState, string> = {
  idle: '实时连接未启用',
  connecting: '正在建立实时连接…',
  connected: '实时连接已建立',
  reconnecting: '实时连接已断开，正在重连…',
  disconnected: '实时连接已断开',
};

export function ConnectionBanner({ state, message }: ConnectionBannerProps) {
  if (state === 'connected' || state === 'idle') {
    return null;
  }

  const tone = state === 'disconnected'
    ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
    : 'border-blue-500/30 bg-blue-500/10 text-blue-200';

  return (
    <div className={`rounded-md border px-3 py-2 text-xs ${tone}`}>
      <p className="font-medium">{STATE_LABELS[state]}</p>
      {message ? (
        <p className="mt-1 opacity-80">{message}</p>
      ) : null}
    </div>
  );
}
