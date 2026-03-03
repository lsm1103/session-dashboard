'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { parseRealtimeEvent, type RealtimeEvent } from '@/lib/ws-events';

export type RealtimeConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected';

interface UseRealtimeSocketOptions {
  enabled?: boolean;
  url?: string;
  maxReconnectDelayMs?: number;
  initialReconnectDelayMs?: number;
  onEvent?: (event: RealtimeEvent) => void;
}

function buildDefaultSocketUrl() {
  if (typeof window === 'undefined') {
    return '';
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/realtime`;
}

export function useRealtimeSocket(options: UseRealtimeSocketOptions = {}) {
  const {
    enabled = true,
    url,
    maxReconnectDelayMs = 10_000,
    initialReconnectDelayMs = 1_000,
    onEvent,
  } = options;

  const socketUrl = useMemo(() => url ?? buildDefaultSocketUrl(), [url]);
  const [connectionState, setConnectionState] = useState<RealtimeConnectionState>(enabled ? 'connecting' : 'idle');
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const reconnectDelayRef = useRef(initialReconnectDelayMs);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const manuallyClosedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !socketUrl) {
      setConnectionState('idle');
      return;
    }

    manuallyClosedRef.current = false;

    const cleanupReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const scheduleReconnect = () => {
      if (manuallyClosedRef.current) {
        return;
      }

      cleanupReconnectTimer();
      setConnectionState('reconnecting');

      reconnectTimerRef.current = setTimeout(() => {
        connect();
      }, reconnectDelayRef.current);

      reconnectDelayRef.current = Math.min(
        maxReconnectDelayMs,
        Math.max(initialReconnectDelayMs, reconnectDelayRef.current * 2)
      );
    };

    const connect = () => {
      cleanupReconnectTimer();

      try {
        setConnectionState(current => current === 'connected' ? current : 'connecting');
        const socket = new WebSocket(socketUrl);
        socketRef.current = socket;

        socket.onopen = () => {
          reconnectDelayRef.current = initialReconnectDelayMs;
          setLastError(null);
          setConnectionState('connected');
        };

        socket.onmessage = event => {
          const parsed = parseRealtimeEvent(String(event.data));
          if (!parsed) {
            return;
          }

          setLastEvent(parsed);
          onEvent?.(parsed);
        };

        socket.onerror = () => {
          setLastError('实时连接出现异常');
        };

        socket.onclose = () => {
          socketRef.current = null;
          if (manuallyClosedRef.current) {
            setConnectionState('disconnected');
            return;
          }

          scheduleReconnect();
        };
      } catch {
        setLastError('无法建立实时连接');
        scheduleReconnect();
      }
    };

    connect();

    return () => {
      manuallyClosedRef.current = true;
      cleanupReconnectTimer();
      const socket = socketRef.current;
      socketRef.current = null;
      socket?.close();
      setConnectionState('disconnected');
    };
  }, [enabled, initialReconnectDelayMs, maxReconnectDelayMs, onEvent, socketUrl]);

  return {
    connectionState,
    isConnected: connectionState === 'connected',
    lastEvent,
    lastError,
  };
}
