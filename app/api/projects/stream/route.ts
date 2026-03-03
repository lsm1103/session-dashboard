import { NextResponse } from 'next/server';
import { getAdapters } from '@/lib/registry';
import type { Project } from '@/lib/types';

type StreamMessage =
  | { type: 'start'; totalAdapters: number }
  | { type: 'project'; project: Project }
  | { type: 'progress'; completedAdapters: number; totalAdapters: number }
  | { type: 'done' };

function encodeMessage(message: StreamMessage): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(message)}\n\n`);
}

export async function GET() {
  const adapters = getAdapters();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const close = () => {
        if (!closed) {
          closed = true;
          controller.close();
        }
      };
      const send = (message: StreamMessage) => {
        if (!closed) {
          controller.enqueue(encodeMessage(message));
        }
      };

      send({ type: 'start', totalAdapters: adapters.length });

      void (async () => {
        let completedAdapters = 0;

        for (const adapter of adapters) {
          try {
            const projects = await adapter.getProjects();
            for (const project of projects) {
              send({ type: 'project', project });
            }
          } catch {
            // Skip failed adapters so one source does not block the whole stream.
          }

          completedAdapters += 1;
          send({
            type: 'progress',
            completedAdapters,
            totalAdapters: adapters.length,
          });
        }

        send({ type: 'done' });
        close();
      })().catch(() => {
        close();
      });
    },
    cancel() {
      // no-op
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
