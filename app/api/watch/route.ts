import { NextResponse } from 'next/server';
import chokidar from 'chokidar';
import path from 'path';
import os from 'os';
import { clearIndexedSnapshotCache } from '@/lib/index-store';

const CLAUDE_BASE = path.join(os.homedir(), '.claude', 'projects');
const CODEX_BASE = path.join(os.homedir(), '.codex', 'sessions');
const WATCH_PATTERNS = [
  path.join(CLAUDE_BASE, '**/*.jsonl'),
  path.join(CODEX_BASE, '**/*.jsonl'),
];

// Module-level singleton watcher
let watcher: ReturnType<typeof chokidar.watch> | null = null;
const clients = new Set<ReadableStreamDefaultController>();

function getWatcher() {
  if (watcher) return watcher;

  watcher = chokidar.watch(WATCH_PATTERNS, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
  });

  const handleSessionFileEvent = (event: 'new-session' | 'updated', filePath: string) => {
    const toolId = filePath.startsWith(CLAUDE_BASE) ? 'claude-code' : 'codex';
    clearIndexedSnapshotCache();
    broadcast({ event, toolId, path: filePath });
  };

  watcher.on('add', (filePath: string) => handleSessionFileEvent('new-session', filePath));
  watcher.on('change', (filePath: string) => handleSessionFileEvent('updated', filePath));
  watcher.on('unlink', (filePath: string) => handleSessionFileEvent('updated', filePath));

  // Graceful cleanup on process exit
  const cleanup = () => { watcher?.close(); watcher = null; };
  process.once('SIGTERM', cleanup);
  process.once('SIGINT', cleanup);

  return watcher;
}

function broadcast(data: Record<string, string>) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  const encoded = new TextEncoder().encode(message);
  for (const controller of clients) {
    try {
      controller.enqueue(encoded);
    } catch {
      clients.delete(controller);
    }
  }
}

export async function GET() {
  getWatcher(); // ensure watcher is running

  const stream = new ReadableStream({
    start(controller) {
      clients.add(controller);
      // Send initial ping
      controller.enqueue(new TextEncoder().encode(': connected\n\n'));
    },
    cancel(controller) {
      clients.delete(controller);
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
