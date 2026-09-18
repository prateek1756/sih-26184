/**
 * PravahDridh — WebSocket Hook for Real-Time Forecast Stream
 * Connects to /api/v1/risk/ws and handles reconnection, heartbeats, and typed payload dispatch.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { ForecastUpdatePayload } from '../types/risk';

export type WebSocketStatus = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR';

interface UseRiskWebSocketOptions {
  enabled?: boolean;
  onForecastUpdate?: (payload: ForecastUpdatePayload) => void;
  maxReconnectAttempts?: number;
  heartbeatIntervalMs?: number;
}

export function useRiskWebSocket(options: UseRiskWebSocketOptions = {}) {
  const {
    enabled = true,
    onForecastUpdate,
    maxReconnectAttempts = 5,
    heartbeatIntervalMs = 25000,
  } = options;

  const [status, setStatus] = useState<WebSocketStatus>('DISCONNECTED');
  const [latestPayload, setLatestPayload] = useState<ForecastUpdatePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const WS_URL =
    import.meta.env.VITE_WS_BASE_URL ||
    (window.location.protocol === 'https:'
      ? `wss://${window.location.host}/api/v1/risk/ws`
      : `ws://${window.location.host}/api/v1/risk/ws`);

  const connect = useCallback(() => {
    if (!enabled) return;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      setStatus('CONNECTING');
      setError(null);
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('CONNECTED');
        reconnectAttemptsRef.current = 0;

        // Start ping/pong keepalive loop
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('ping');
          }
        }, heartbeatIntervalMs);
      };

      ws.onmessage = (event: MessageEvent) => {
        if (event.data === 'pong') {
          return;
        }

        try {
          const payload: ForecastUpdatePayload = JSON.parse(event.data);
          setLatestPayload(payload);
          if (onForecastUpdate) {
            onForecastUpdate(payload);
          }
        } catch {
          // Non-JSON message, ignore
        }
      };

      ws.onerror = () => {
        setStatus('ERROR');
        setError('WebSocket connection error occurred.');
      };

      ws.onclose = (event) => {
        setStatus('DISCONNECTED');
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);

        // Don't reconnect if intentionally closed or disabled
        if (!event.wasClean && enabled) {
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 15000);
            reconnectAttemptsRef.current += 1;
            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, delay);
          } else {
            setError(`Failed to reconnect after ${maxReconnectAttempts} attempts.`);
          }
        }
      };
    } catch (err) {
      setStatus('ERROR');
      setError(err instanceof Error ? err.message : 'Failed to create WebSocket');
    }
  }, [WS_URL, enabled, heartbeatIntervalMs, maxReconnectAttempts, onForecastUpdate]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    if (wsRef.current) {
      wsRef.current.close(1000, 'Component unmounted');
      wsRef.current = null;
    }
    setStatus('DISCONNECTED');
  }, []);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    status,
    latestPayload,
    error,
    reconnect: connect,
    disconnect,
  };
}
