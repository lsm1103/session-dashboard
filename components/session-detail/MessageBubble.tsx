'use client';

import ReactMarkdown from 'react-markdown';
import type { Message } from '@/lib/types';

interface Props {
  message: Message;
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[85%] rounded-lg px-4 py-2.5 text-sm ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-muted text-foreground'
        }`}
      >
        <ReactMarkdown
          components={{
            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
            pre: ({ children }) => (
              <pre className={`rounded p-3 my-2 text-xs overflow-x-auto font-mono ${
                isUser ? 'bg-blue-700/50' : 'bg-background'
              }`}>
                {children}
              </pre>
            ),
            code: ({ className, children, ...props }) => {
              const isBlock = className?.startsWith('language-');
              return isBlock ? (
                <code className={`${className} font-mono`} {...props}>
                  {children}
                </code>
              ) : (
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
}
