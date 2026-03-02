import { useEffect } from 'react';
import { useSWRConfig } from 'swr';

export function useRealtimeWatch(
  currentSessionId?: string,
  onActiveSession?: (sessionId: string) => void
) {
  const { mutate } = useSWRConfig();

  useEffect(() => {
    const es = new EventSource('/api/watch');

    es.addEventListener('message', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'new-session' || data.event === 'updated') {
          // Invalidate all sessions and projects caches
          mutate((key: unknown) => typeof key === 'string' && (
            key.startsWith('/api/sessions') ||
            key.startsWith('/api/projects') ||
            key.startsWith('/api/stats')
          ));

          // If the current open session's file changed, refresh it precisely
          if (currentSessionId && data.event === 'updated') {
            const sessionUuid = currentSessionId.replace(/^(cc-|cdx-)/, '');
            if (data.path && String(data.path).includes(sessionUuid)) {
              mutate(`/api/sessions/${currentSessionId}`);
            }
          }

          // Notify caller about active session
          if (data.event === 'updated' && onActiveSession) {
            const pathStr = String(data.path || '');
            const match = pathStr.match(/([a-f0-9-]{36})\.jsonl$/i);
            if (match) {
              const prefix = data.toolId === 'claude-code' ? 'cc' : 'cdx';
              onActiveSession(`${prefix}-${match[1]}`);
            }
          }
        }
      } catch {
        // ignore parse errors
      }
    });

    es.onerror = () => {
      // SSE will auto-reconnect on error
    };

    return () => es.close();
  }, [mutate, currentSessionId, onActiveSession]);
}
