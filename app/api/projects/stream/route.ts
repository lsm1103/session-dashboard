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
  let closed = false;
  let cancelled = false;
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;

  const isInvalidStateError = (error: unknown) =>
    (error instanceof TypeError &&
      'code' in error &&
      error.code === 'ERR_INVALID_STATE') ||
    (error instanceof DOMException && error.name === 'InvalidStateError');

  const close = () => {
    if (closed) {
      return;
    }
    closed = true;
    const controller = controllerRef;
    controllerRef = null;
    if (!controller) {
      return;
    }
    try {
      controller.close();
    } catch (error) {
      if (!isInvalidStateError(error)) {
        console.error('Failed to close projects stream controller', error);
      }
    }
  };

  const send = (message: StreamMessage) => {
    if (closed || cancelled || !controllerRef) {
      return;
    }
    try {
      controllerRef.enqueue(encodeMessage(message));
    } catch (error) {
      if (!isInvalidStateError(error)) {
        console.error('Failed to enqueue projects stream message', error);
      }
      close();
    }
  };

  const stream = new ReadableStream({
    start(controller) {
      controllerRef = controller;

      send({ type: 'start', totalAdapters: adapters.length });

      void (async () => {
        let completedAdapters = 0;

        for (const adapter of adapters) {
          if (cancelled) {
            break;
          }

          try {
            const projects = await adapter.getProjects();
            for (const project of projects) {
              if (cancelled) {
                break;
              }
              send({ type: 'project', project });
            }
          } catch {
            // Skip failed adapters so one source does not block the whole stream.
          }

          if (cancelled) {
            break;
          }

          completedAdapters += 1;
          send({
            type: 'progress',
            completedAdapters,
            totalAdapters: adapters.length,
          });
        }

        if (!cancelled) {
          send({ type: 'done' });
        }
        close();
      })().catch(() => {
        close();
      });
    },
    cancel() {
      cancelled = true;
      close();
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
