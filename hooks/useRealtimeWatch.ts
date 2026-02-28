import { useEffect } from 'react';
import { useSWRConfig } from 'swr';

export function useRealtimeWatch() {
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
        }
      } catch {
        // ignore parse errors
      }
    });

    es.onerror = () => {
      // SSE will auto-reconnect on error
    };

    return () => es.close();
  }, [mutate]);
}
