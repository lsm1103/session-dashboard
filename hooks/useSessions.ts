import { useState, useEffect } from 'react';
import useSWR from 'swr';
import type { Session } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface UseSessionsParams {
  toolId?: string;
  projectPath?: string;
  search?: string;
}

const PAGE_SIZE = 50;

export function useSessions(params?: UseSessionsParams) {
  const [pages, setPages] = useState<Session[][]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // When filter params change, reset pagination
  const paramsKey = JSON.stringify({ toolId: params?.toolId, projectPath: params?.projectPath, search: params?.search });

  useEffect(() => {
    setPages([]);
    setOffset(0);
    setHasMore(true);
  }, [paramsKey]);

  // Build URL
  const query = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
  if (params?.toolId) query.set('toolId', params.toolId);
  if (params?.projectPath) query.set('projectPath', params.projectPath);
  if (params?.search) query.set('search', params.search);

  const key = `/api/sessions?${query.toString()}`;

  const { data, error, isLoading, mutate } = useSWR<Session[]>(key, fetcher, {
    revalidateOnFocus: false,
    onSuccess(data) {
      if (data.length < PAGE_SIZE) setHasMore(false);
      setPages(prev => {
        // Prevent duplicate append
        const pageIndex = offset / PAGE_SIZE;
        const next = [...prev];
        next[pageIndex] = data;
        return next;
      });
    }
  });

  const sessions = pages.flat();

  function loadMore() {
    if (!isLoading && hasMore) {
      setOffset(prev => prev + PAGE_SIZE);
    }
  }

  function refresh() {
    setPages([]);
    setOffset(0);
    setHasMore(true);
    mutate();
  }

  return { sessions, isLoading, error, hasMore, loadMore, refresh, mutate };
}
