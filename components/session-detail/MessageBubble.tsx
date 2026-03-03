'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Copy, Check } from 'lucide-react';
import type { Message } from '@/lib/types';
import { ToolUseBlock, ToolResultBlock } from './ToolCallBlock';

type ShikiHighlighter = Awaited<ReturnType<typeof import('shiki')['createHighlighter']>>;
type IdleCancel = () => void;

let sharedHighlighterPromise: Promise<ShikiHighlighter> | null = null;
const loadedLangs = new Set<string>();
const highlightedCodeCache = new Map<string, string>();

function scheduleIdle(callback: () => void): IdleCancel {
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(callback);
    return () => window.cancelIdleCallback(id);
  }

  const id = globalThis.setTimeout(callback, 0);
  return () => globalThis.clearTimeout(id);
}

async function getSharedHighlighter(initialLangs: string[]): Promise<ShikiHighlighter> {
  if (!sharedHighlighterPromise) {
    sharedHighlighterPromise = (async () => {
      const { createHighlighter } = await import('shiki');
      const uniqueLangs = [...new Set(initialLangs)];
      uniqueLangs.forEach(lang => loadedLangs.add(lang));
      return createHighlighter({
        themes: ['github-dark'],
        langs: uniqueLangs,
      });
    })();
  }

  return sharedHighlighterPromise;
}

interface Props {
  message: Message;
  toolId?: string;
}

export const MessageBubble = React.memo(function MessageBubble({ message, toolId }: Props) {
  const isUser = message.role === 'user';
  const isToolUse = message.content.startsWith('\x00TOOL_USE\x00');
  const isToolResult = message.content.startsWith('\x00TOOL_RESULT\x00');

  const [copied, setCopied] = useState(false);

  // Bookmark state
  const [isBookmarked, setIsBookmarked] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const all = JSON.parse(localStorage.getItem('sd-msg-bookmarks') || '{}');
      const sessionId = message.id.replace(/-[ua]-\d+$/, '');
      return (all[sessionId] || []).includes(message.id);
    } catch { return false; }
  });

  const toggleBookmark = useCallback(() => {
    try {
      const all = JSON.parse(localStorage.getItem('sd-msg-bookmarks') || '{}');
      const sessionId = message.id.replace(/-[ua]-\d+$/, '');
      const current: string[] = all[sessionId] || [];
      const next = isBookmarked
        ? current.filter((id: string) => id !== message.id)
        : [...current, message.id];
      all[sessionId] = next;
      localStorage.setItem('sd-msg-bookmarks', JSON.stringify(all));
      setIsBookmarked(!isBookmarked);
      // Notify same-tab listeners
      window.dispatchEvent(new Event('sd-bookmark-change'));
    } catch { /* ignore */ }
  }, [message.id, isBookmarked]);
  const [highlightedBlocks, setHighlightedBlocks] = useState<Record<string, string>>({});
  const idleCancelRef = useRef<IdleCancel | null>(null);

  // Initialize shiki highlighter and process code blocks
  useEffect(() => {
    let cancelled = false;
    idleCancelRef.current?.();

    // Extract languages from markdown content
    const langMatches = message.content.matchAll(/```(\w+)\n([\s\S]*?)```/g);
    const blocks: { lang: string; code: string; key: string }[] = [];
    for (const match of langMatches) {
      const lang = match[1];
      const code = match[2].trimEnd();
      const key = `${lang}:${code}`;
      blocks.push({ lang, code, key });
    }

    if (blocks.length === 0) return;

    const cachedResults: Record<string, string> = {};
    const pendingBlocks = blocks.filter(block => {
      const html = highlightedCodeCache.get(block.key);
      if (html) {
        cachedResults[block.key] = html;
        return false;
      }
      return true;
    });

    if (Object.keys(cachedResults).length > 0) {
      setHighlightedBlocks(prev => ({ ...prev, ...cachedResults }));
    }

    if (pendingBlocks.length === 0) return;

    idleCancelRef.current = scheduleIdle(() => {
      (async () => {
        try {
          const highlighter = await getSharedHighlighter(pendingBlocks.map(block => block.lang));
          const results: Record<string, string> = {};

          for (const block of pendingBlocks) {
            if (cancelled) return;
            try {
              if (!loadedLangs.has(block.lang)) {
                await highlighter.loadLanguage(block.lang as never);
                loadedLangs.add(block.lang);
              }

              const html = highlighter.codeToHtml(block.code, {
                lang: block.lang,
                theme: 'github-dark',
              });
              highlightedCodeCache.set(block.key, html);
              results[block.key] = html;
            } catch {
              // unsupported language, keep plain rendering
            }
          }

          if (!cancelled && Object.keys(results).length > 0) {
            setHighlightedBlocks(prev => ({ ...prev, ...results }));
          }
        } catch {
          // shiki failed to load, keep fallback
        }
      })();
    });

    return () => {
      cancelled = true;
      idleCancelRef.current?.();
      idleCancelRef.current = null;
    };
  }, [message.content]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard write failed silently
    }
  }, [message.content]);

  // Tool use / tool result special rendering
  if (isToolUse) {
    const parts = message.content.split('\x00');
    // parts: ['', 'TOOL_USE', name, input]
    return (
      <div className="mb-2">
        <ToolUseBlock name={parts[2]} input={parts[3] ?? ''} />
      </div>
    );
  }

  if (isToolResult) {
    const parts = message.content.split('\x00');
    return (
      <div className="mb-1">
        <ToolResultBlock output={parts[2] ?? ''} />
      </div>
    );
  }

  // Tool indicator dot (assistant messages only)
  const toolDot = !isUser && toolId ? (
    <span
      className={`absolute -top-1 -left-1 w-2.5 h-2.5 rounded-full ${
        toolId === 'claude-code' ? 'bg-orange-400' : 'bg-blue-400'
      }`}
      title={toolId}
    />
  ) : null;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`relative group max-w-[85%] min-w-0 rounded-lg px-4 py-2.5 text-sm break-words overflow-wrap-anywhere ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-muted text-foreground'
        }`}
      >
        {toolDot}

        {/* Bookmark button */}
        <button
          onClick={toggleBookmark}
          className={`absolute top-1 right-7 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded ${
            isBookmarked ? 'opacity-100 text-amber-400' : isUser ? 'hover:bg-blue-700/50 text-white/50' : 'hover:bg-white/10 text-muted-foreground'
          }`}
          aria-label={isBookmarked ? '取消书签' : '添加书签'}
        >
          <svg className="w-3.5 h-3.5" fill={isBookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
          </svg>
        </button>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          className={`absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded ${
            isUser ? 'hover:bg-blue-700/50' : 'hover:bg-white/10'
          }`}
          aria-label="Copy message"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-green-400" />
          ) : (
            <Copy className={`w-3.5 h-3.5 ${isUser ? 'text-white/70' : 'text-muted-foreground'}`} />
          )}
        </button>

        <ReactMarkdown
          components={{
            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
            pre: ({ children }) => (
              <pre className="rounded p-3 my-2 text-xs overflow-x-auto font-mono max-w-full">
                {children}
              </pre>
            ),
            code: ({ className, children, ...props }) => {
              const isBlock = className?.startsWith('language-');
              if (isBlock) {
                const lang = className!.replace('language-', '');
                const codeText = String(children).replace(/\n$/, '');
                const key = `${lang}:${codeText}`;
                const html = highlightedBlocks[key];

                if (html) {
                  return (
                    <code
                      className="font-mono [&>pre]:!p-0 [&>pre]:!m-0 [&>pre]:!bg-transparent"
                      dangerouslySetInnerHTML={{ __html: html }}
                    />
                  );
                }

                return (
                  <code className={`${className} font-mono`} {...props}>
                    {children}
                  </code>
                );
              }
              return (
                <code
                  className={`rounded px-1 py-0.5 text-xs font-mono ${
                    isUser ? 'bg-blue-700/50' : 'bg-background'
                  }`}
                  {...props}
                >
                  {children}
                </code>
              );
            },
            ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
            h1: ({ children }) => <h1 className="text-base font-bold mb-1">{children}</h1>,
            h2: ({ children }) => <h2 className="text-sm font-bold mb-1">{children}</h2>,
            h3: ({ children }) => <h3 className="text-sm font-semibold mb-1">{children}</h3>,
          }}
        >
          {message.content}
        </ReactMarkdown>
        <div className={`text-xs mt-1 ${isUser ? 'text-blue-200' : 'text-muted-foreground'}`}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
});
