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
  // S7 passthrough (alert-center payload đầy đủ; signals stream không có → undefined)
  alert_id?: string;
  lane?: string;
  body?: string;
  summary?: string;
  confidence?: number | null;
  freshness_state?: string;
  source_ref?: string;
  evidence?: Record<string, unknown>;
  executed_at?: string | null;
}

export interface UseSignalStreamOptions {
  enabled: boolean;
  query?: { type?: string; severity?: string; direction?: string; symbol?: string; alert_family?: string; lane?: string };
  onSignal: (sig: SignalStreamSignal) => void;
  onStatusChange?: (s: SignalStreamStatus) => void;
  // S7: cho phép stream endpoint khác (mặc định giữ Signals để không vỡ caller cũ)
  basePath?: string;
  // S7: tên event SSE (mặc định "signal"; alert-center dùng "alert-center")
  eventName?: string;
}

function buildStreamQuery(query: UseSignalStreamOptions["query"], lastId?: number | null): string {
  const qs = new URLSearchParams();
  if (query?.type) qs.set("type", query.type);
  if (query?.symbol) qs.set("symbol", query.symbol);
  if (query?.severity) qs.set("severity", query.severity);
  if (query?.direction) qs.set("direction", query.direction);
  // S7: alert-center dùng alert_family + lane thay cho direction/type
  if (query?.alert_family) qs.set("alert_family", query.alert_family);
  if (query?.lane) qs.set("lane", query.lane);
  if (lastId != null) qs.set("since", String(lastId));
  // EventSource không gửi được Authorization header → fallback token qua query
  // Lưu ý F2: token trong URL có thể lộ qua log/history — đã có withCredentials + khuyến nghị HTTPS + redact log
  const token = typeof window !== "undefined" ? getBrowserStorageToken("access_token") : null;
  if (token) qs.set("token", token);
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export function getSignalStreamUrl(query: UseSignalStreamOptions["query"] = {}, lastId?: number | null, basePath?: string): string {
  const base = resolveCoreApiBase();
  return `${base}${basePath ?? "/operator/soc/signals/stream/"}${buildStreamQuery(query, lastId)}`;
}

export function useSignalStream(options: UseSignalStreamOptions): { status: SignalStreamStatus; reconnectAttempt: number } {
  const { enabled, query, onSignal, onStatusChange, basePath, eventName } = options;
  const eventNameRef = useRef(eventName ?? "signal");
  useEffect(() => {
    eventNameRef.current = eventName ?? "signal";
  }, [eventName]);
  const [status, setStatus] = useState<SignalStreamStatus>("idle");
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  const esRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const heartbeatTimerRef = useRef<number | null>(null);
  const attemptRef = useRef(0);
  const lastIdRef = useRef<number | null>(null);
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

  const updateStatus = useCallback((s: SignalStreamStatus) => {
    setStatus(s);
    onStatusChangeRef.current?.(s);
  }, []);

  // F3: khi filter đổi, reset since để không bỏ lỡ với lastId cũ
  useEffect(() => {
    lastIdRef.current = null;
  }, [query?.type, query?.symbol, query?.severity, query?.direction, query?.alert_family, query?.lane]);

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

    const scheduleReconnect = () => {
      if (cancelled) return;
      clearHeartbeat();
      if (esRef.current) {
        try { esRef.current.close(); } catch {}
        esRef.current = null;
      }
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

    const resetHeartbeatWithReconnect = () => {
      clearHeartbeat();
      heartbeatTimerRef.current = window.setTimeout(() => {
        // F1 fix: close() không fire onerror → phải tự schedule reconnect
        scheduleReconnect();
      }, 35000);
    };

    const connect = () => {
      if (cancelled) return;
      updateStatus("connecting");
      const url = getSignalStreamUrl(query, lastIdRef.current, basePath);
      let es: EventSource;
      try {
        // withCredentials để gửi cookie session nếu có
        es = new window.EventSource(url, { withCredentials: true } as unknown as EventSourceInit);
      } catch {
        updateStatus("error");
        scheduleReconnect();
        return;
      }
      esRef.current = es;

      es.onopen = () => {
        if (cancelled) return;
        attemptRef.current = 0;
        setReconnectAttempt(0);
        updateStatus("open");
        resetHeartbeatWithReconnect();
      };

      const handleSignal = (e: MessageEvent) => {
        if (cancelled) return;
        resetHeartbeatWithReconnect();
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
            // S7: alert-center gửi detected_at (=triggered_at); chấp nhận cả triggered_at/timestamp
            detected_at: String(data.detected_at ?? data.triggered_at ?? data.timestamp ?? ""),
            title: data.title != null ? String(data.title) : undefined,
            value: (data.value as number | string | null) ?? null,
            metadata: (data.metadata as Record<string, unknown>) ?? {},
            session_date: (data.session_date as string | null) ?? null,
            // S7 passthrough cho alert-center (giữ undefined khi stream không có)
            alert_id: data.alert_id != null ? String(data.alert_id) : undefined,
            lane: data.lane != null ? String(data.lane) : undefined,
            body: data.body != null ? String(data.body) : undefined,
            summary: data.summary != null ? String(data.summary) : undefined,
            confidence: data.confidence != null ? Number(data.confidence) : undefined,
            freshness_state: data.freshness_state != null ? String(data.freshness_state) : undefined,
            source_ref: data.source_ref != null ? String(data.source_ref) : undefined,
            evidence: (data.evidence as Record<string, unknown>) ?? undefined,
            executed_at: (data.executed_at as string | null) ?? undefined,
          };
          if (sig.id != null) lastIdRef.current = sig.id;
          if (sig.symbol) onSignalRef.current(sig);
        } catch {
          // ignore parse error
        }
      };

      // Plan spec: event: signal (hoặc eventName tùy stream)
      es.addEventListener(eventNameRef.current, handleSignal as EventListener);

      // Fallback onmessage (nếu server gửi không có event name)
      es.onmessage = (e: MessageEvent) => {
        resetHeartbeatWithReconnect();
        handleSignal(e);
      };

      es.onerror = () => {
        scheduleReconnect();
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
  }, [enabled, query?.type, query?.severity, query?.direction, query?.symbol, query?.alert_family, query?.lane, basePath]);

  return { status, reconnectAttempt };
}
