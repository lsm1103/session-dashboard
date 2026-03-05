import useSWR from 'swr';
import type { SessionDetail } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useSession(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<SessionDetail>(
    id ? `/api/sessions/${id}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    session: data,
    isLoading,
    error,
    mutate,
  };
}
