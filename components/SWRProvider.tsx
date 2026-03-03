'use client';

import { useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { SWRConfig, useSWRConfig } from 'swr';
import { ConnectionBanner } from '@/components/realtime/ConnectionBanner';
import { useRealtimeSocket } from '@/hooks/useRealtimeSocket';
import type { RealtimeEvent } from '@/lib/ws-events';

function RealtimeBridge() {
  const pathname = usePathname();
  const { mutate } = useSWRConfig();

  const handleEvent = useCallback((event: RealtimeEvent) => {
    if (pathname !== '/dashboard') {
      return;
    }

    if (event.type === 'projects_dirty') {
      mutate((key: unknown) => typeof key === 'string' && (
        key.startsWith('/api/projects') ||
        key.startsWith('/api/stats')
      ));
      return;
    }

    if (event.type === 'sessions_dirty') {
      mutate((key: unknown) => typeof key === 'string' && (
        key.startsWith('/api/sessions') ||
        key.startsWith('/api/stats')
      ));
      return;
    }

    if (event.type === 'session_dirty') {
      mutate(`/api/sessions/${event.sessionId}`);
      mutate(`/api/stats`);
      return;
    }
  }, [mutate, pathname]);

  const { connectionState, lastError, lastEvent } = useRealtimeSocket({
    onEvent: handleEvent,
  });

  const message = lastError ?? (
    lastEvent?.type === 'warning' || lastEvent?.type === 'error'
      ? lastEvent.message
      : null
  );

  return (
    <div className="pointer-events-none fixed inset-x-0 top-2 z-50 px-4">
      <div className="mx-auto max-w-3xl pointer-events-auto">
        <ConnectionBanner state={connectionState} message={message} />
      </div>
    </div>
  );
}

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={{ revalidateOnFocus: false }}>
      <RealtimeBridge />
      {children}
    </SWRConfig>
  );
}
