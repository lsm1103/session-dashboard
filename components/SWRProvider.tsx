'use client';

import { SWRConfig } from 'swr';
import { useRealtimeWatch } from '@/hooks/useRealtimeWatch';

function RealtimeWatcher() {
  useRealtimeWatch();
  return null;
}

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={{ revalidateOnFocus: false }}>
      <RealtimeWatcher />
      {children}
    </SWRConfig>
  );
}
