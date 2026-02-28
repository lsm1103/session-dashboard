import { NextResponse } from 'next/server';
import chokidar from 'chokidar';
import path from 'path';
import os from 'os';

const CLAUDE_BASE = path.join(os.homedir(), '.claude', 'projects');
const CODEX_BASE = path.join(os.homedir(), '.codex', 'sessions');

// Module-level singleton watcher
let watcher: ReturnType<typeof chokidar.watch> | null = null;
const clients = new Set<ReadableStreamDefaultController>();

function getWatcher() {
  if (watcher) return watcher;

  watcher = chokidar.watch([CLAUDE_BASE, CODEX_BASE], {
    persistent: true,
    ignoreInitial: true,
    depth: 5,
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
  });

  watcher.on('add', (filePath: string) => {
    if (!filePath.endsWith('.jsonl')) return;
    const toolId = filePath.startsWith(CLAUDE_BASE) ? 'claude-code' : 'codex';
    broadcast({ event: 'new-session', toolId, path: filePath });
  });

  watcher.on('change', (filePath: string) => {
    if (!filePath.endsWith('.jsonl')) return;
    const toolId = filePath.startsWith(CLAUDE_BASE) ? 'claude-code' : 'codex';
    broadcast({ event: 'updated', toolId, path: filePath });
  });

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
