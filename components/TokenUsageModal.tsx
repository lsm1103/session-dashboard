'use client';

import { useEffect, useRef } from 'react';
import useSWR from 'swr';
import { Skeleton } from '@/components/ui/skeleton';

interface SessionTokenData {
  id: string;
  title: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

interface TokenUsageResponse {
  scope: 'session' | 'project';
  label: string;
  sessions: SessionTokenData[];
  totals: { inputTokens: number; outputTokens: number; totalTokens: number };
}

interface Props {
  open: boolean;
  onClose: () => void;
  sessionId?: string;
  projectPath?: string;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function TokenUsageModal({ open, onClose, sessionId, projectPath }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const apiUrl = open
    ? sessionId
      ? `/api/token-usage?sessionId=${encodeURIComponent(sessionId)}`
      : projectPath
        ? `/api/token-usage?projectPath=${encodeURIComponent(projectPath)}`
        : null
    : null;

  const { data, isLoading } = useSWR<TokenUsageResponse>(apiUrl, fetcher, {
    revalidateOnFocus: false,
  });

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="bg-card border border-border rounded-xl shadow-2xl w-[500px] max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="shrink-0 px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Token Usage</h2>
            {data && <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[360px]">{data.label}</p>}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none px-1">&times;</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded" />)}
            </div>
          ) : !data ? (
            <p className="text-sm text-muted-foreground text-center py-8">Unable to load data</p>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { label: 'Input Tokens', value: data.totals.inputTokens, color: 'text-blue-400' },
                  { label: 'Output Tokens', value: data.totals.outputTokens, color: 'text-emerald-400' },
                  { label: 'Total Tokens', value: data.totals.totalTokens, color: 'text-foreground' },
                ].map(card => (
                  <div key={card.label} className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-center">
                    <p className={`text-lg font-bold font-mono ${card.color}`}>{fmt(card.value)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{card.label}</p>
                  </div>
                ))}
              </div>

              {/* Session breakdown (project view only) */}
              {data.scope === 'project' && data.sessions.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Session Breakdown</p>
                  <div className="space-y-1.5">
                    {data.sessions
                      .sort((a, b) => b.totalTokens - a.totalTokens)
                      .slice(0, 20)
                      .map((s, i) => (
                        <div key={`${s.id}-${i}`} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent/30">
                          <span className="truncate flex-1 text-xs text-foreground/80">{s.title}</span>
                          <span className="shrink-0 text-xs font-mono text-muted-foreground">{fmt(s.totalTokens)}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {data.totals.totalTokens === 0 && (
                <p className="text-xs text-muted-foreground text-center mt-4">
                  No token data found (possibly from older tool sessions)
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
