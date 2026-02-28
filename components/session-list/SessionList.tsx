'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SessionCard } from './SessionCard';
import { useSessions } from '@/hooks/useSessions';

interface Props {
  toolId?: string;
  projectPath?: string;
}

export function SessionList({ toolId, projectPath }: Props) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const params = useParams<{ id?: string }>();
  const activeId = params?.id;

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(value), 300);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const { sessions, isLoading, error } = useSessions({
    toolId,
    projectPath,
    search: debouncedSearch || undefined,
  });

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-3 py-3 border-b border-border">
        <Input
          placeholder="Search sessions..."
          value={search}
          onChange={e => handleSearchChange(e.target.value)}
          className="h-8 text-sm"
        />
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        {isLoading && (
          <div className="space-y-0">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="px-4 py-3 border-b border-border">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="px-4 py-6 text-sm text-destructive text-center">
            Failed to load sessions
          </div>
        )}

        {!isLoading && !error && sessions.length === 0 && (
          <div className="px-4 py-6 text-sm text-muted-foreground text-center">
            {debouncedSearch ? 'No sessions match your search.' : 'No sessions found.'}
          </div>
        )}

        {!isLoading &&
          sessions.map(session => (
            <SessionCard
              key={session.id}
              session={session}
              isActive={session.id === activeId}
            />
          ))}
      </ScrollArea>
    </div>
  );
}
