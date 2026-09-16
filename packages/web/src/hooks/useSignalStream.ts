import { useCallback, useEffect, useRef, useState } from "react";
import { getBrowserStorageToken, resolveCoreApiBase } from "../adapters/core/transport.js";

export type SignalStreamStatus = "idle" | "connecting" | "open" | "error" | "closed";

export interface SignalStreamSignal {
  id?: number;
  symbol: string;
  type: string;
  severity?: string;
  direction?: string;
  detected_at: string;
  title?: string;
  value?: number | string | null;
  metadata?: Record<string, unknown>;
  session_date?: string | null;
}

export interface UseSignalStreamOptions {
  enabled: boolean;
  query?: { type?: string; severity?: string; direction?: string; symbol?: string };
  onSignal: (sig: SignalStreamSignal) => void;
  onStatusChange?: (s: SignalStreamStatus) => void;
}

function buildStreamQuery(query: UseSignalStreamOptions["query"]): string {
  const qs = new URLSearchParams();
  if (query?.type) qs.set("type", query.type);
  if (query?.symbol) qs.set("symbol", query.symbol);
  if (query?.severity) qs.set("severity", query.severity);
  if (query?.direction) qs.set("direction", query.direction);
  // EventSource không gửi được Authorization header → fallback token qua query
  const token = typeof window !== "undefined" ? getBrowserStorageToken("access_token") : null;
  if (token) qs.set("token", token);
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export function getSignalStreamUrl(query: UseSignalStreamOptions["query"] = {}): string {
  const base = resolveCoreApiBase();
  return `${base}/operator/soc/signals/stream/${buildStreamQuery(query)}`;
}

export function useSignalStream(options: UseSignalStreamOptions): { status: SignalStreamStatus; reconnectAttempt: number } {
  const { enabled, query, onSignal, onStatusChange } = options;
  const [status, setStatus] = useState<SignalStreamStatus>("idle");
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  const esRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const heartbeatTimerRef = useRef<number | null>(null);
  const attemptRef = useRef(0);
  const onSignalRef = useRef(onSignal);
  const onStatusChangeRef = useRef(onStatusChange);

  useEffect(() => {
    onSignalRef.current = onSignal;
  }, [onSignal]);
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  const clearHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current !== null) {
      window.clearTimeout(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  const resetHeartbeat = useCallback(() => {
    clearHeartbeat();
    // 35s không có ping/event → coi như chết, đóng để trigger reconnect
    heartbeatTimerRef.current = window.setTimeout(() => {
      if (esRef.current) {
        try { esRef.current.close(); } catch {}
        // onerror sẽ handle reconnect
      }
    }, 35000);
  }, [clearHeartbeat]);

  const updateStatus = useCallback((s: SignalStreamStatus) => {
    setStatus(s);
    onStatusChangeRef.current?.(s);
  }, []);

  useEffect(() => {
    if (!enabled) {
      // Dừng mọi kết nối khi disabled
      if (esRef.current) {
        try { esRef.current.close(); } catch {}
        esRef.current = null;
      }
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      clearHeartbeat();
      attemptRef.current = 0;
      setReconnectAttempt(0);
      updateStatus("idle");
      return;
    }

    if (typeof window === "undefined" || typeof window.EventSource === "undefined") {
      updateStatus("error");
      return;
    }

    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      updateStatus("connecting");
      const url = getSignalStreamUrl(query);
      let es: EventSource;
      try {
        // withCredentials để gửi cookie session nếu có
        es = new window.EventSource(url, { withCredentials: true } as unknown as EventSourceInit);
      } catch {
        updateStatus("error");
        return;
      }
      esRef.current = es;

      es.onopen = () => {
        if (cancelled) return;
        attemptRef.current = 0;
        setReconnectAttempt(0);
        updateStatus("open");
        resetHeartbeat();
      };

      const handleSignal = (e: MessageEvent) => {
        if (cancelled) return;
        resetHeartbeat();
        const raw = (e as MessageEvent).data;
        if (!raw) return;
        try {
          const data = JSON.parse(raw) as Record<string, unknown>;
          const sig: SignalStreamSignal = {
            id: data.id != null ? Number(data.id) : undefined,
            symbol: String(data.symbol ?? ""),
            type: String(data.type ?? "whale"),
            severity: data.severity != null ? String(data.severity) : undefined,
            direction: data.direction != null ? String(data.direction) : undefined,
            detected_at: String(data.detected_at ?? data.timestamp ?? ""),
            title: data.title != null ? String(data.title) : undefined,
            value: (data.value as number | string | null) ?? null,
            metadata: (data.metadata as Record<string, unknown>) ?? {},
            session_date: (data.session_date as string | null) ?? null,
          };
          if (sig.symbol) onSignalRef.current(sig);
        } catch {
          // ignore parse error
        }
      };

      // Plan spec: event: signal
      es.addEventListener("signal", handleSignal as EventListener);

      // Fallback onmessage (nếu server gửi không có event name)
      es.onmessage = (e: MessageEvent) => {
        resetHeartbeat();
        handleSignal(e);
      };

      es.onerror = () => {
        clearHeartbeat();
        try { es.close(); } catch {}
        if (cancelled) return;
        esRef.current = null;
        updateStatus("error");
        const nextAttempt = attemptRef.current + 1;
        attemptRef.current = nextAttempt;
        setReconnectAttempt(nextAttempt);
        const delay = Math.min(1000 * Math.pow(2, nextAttempt - 1), 30000);
        if (reconnectTimerRef.current !== null) window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = window.setTimeout(() => {
          if (!cancelled) connect();
        }, delay);
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (esRef.current) {
        try { esRef.current.close(); } catch {}
        esRef.current = null;
      }
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      clearHeartbeat();
      updateStatus("closed");
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, query?.type, query?.severity, query?.direction, query?.symbol, resetHeartbeat, clearHeartbeat, updateStatus]);

  return { status, reconnectAttempt };
}
