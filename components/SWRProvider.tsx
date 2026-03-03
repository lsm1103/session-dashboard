'use client';

import { SWRConfig } from 'swr';
import { usePathname } from 'next/navigation';
import { useRealtimeWatch } from '@/hooks/useRealtimeWatch';

function RealtimeWatcher() {
  useRealtimeWatch(undefined, undefined, { includeStats: true });
  return null;
}

export function SWRProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <SWRConfig value={{ revalidateOnFocus: false }}>
      {pathname === '/' ? <RealtimeWatcher /> : null}
      {children}
    </SWRConfig>
  );
}
