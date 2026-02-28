import useSWR from 'swr';
import type { Session } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface UseSessionsParams {
  toolId?: string;
  projectPath?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export function useSessions(params?: UseSessionsParams) {
  const query = new URLSearchParams();
  if (params?.toolId) query.set('toolId', params.toolId);
  if (params?.projectPath) query.set('projectPath', params.projectPath);
  if (params?.search) query.set('search', params.search);
  if (params?.limit != null) query.set('limit', String(params.limit));
  if (params?.offset != null) query.set('offset', String(params.offset));

  const key = `/api/sessions?${query.toString()}`;

  const { data, error, isLoading, mutate } = useSWR<Session[]>(key, fetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: false,
  });

  return {
    sessions: data ?? [],
    isLoading,
    error,
    mutate,
  };
}
