import { useCallback, useEffect, useRef, useState } from "react";
import { getBrowserStorageToken, resolveCoreApiBase } from "../adapters/core/transport.js";

export type OverviewStreamStatus = "idle" | "connecting" | "open" | "error" | "closed";

export interface OverviewStreamSnapshot {
  generated_at: string;
  summary: Record<string, number>;
  by_domain?: Record<string, {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    unknown: number;
    maintenance: number;
  }>;
  services: Array<{
    service_key: string;
    name: string;
    domain: string;
    status: string;
    is_active: boolean;
    last_check_at: string | null;
    avg_response_ms: number | null;
  }>;
}

export interface UseOverviewStreamOptions {
  enabled: boolean;
  onSnapshot: (snap: OverviewStreamSnapshot) => void;
  onStatusChange?: (s: OverviewStreamStatus) => void;
}

function buildOverviewStreamUrl(): string {
  const base = resolveCoreApiBase();
  const qs = new URLSearchParams();
  // F2 pattern: token fallback cho EventSource (không gửi Authorization header)
  const token = typeof window !== "undefined" ? getBrowserStorageToken("access_token") : null;
  if (token) qs.set("token", token);
  const s = qs.toString();
  return `${base}/operator/soc/overview/stream/${s ? `?${s}` : ""}`;
}

export function getOverviewStreamUrl(): string {
  return buildOverviewStreamUrl();
}

export function useOverviewStream(options: UseOverviewStreamOptions): {
  status: OverviewStreamStatus;
  reconnectAttempt: number;
} {
  const { enabled, onSnapshot, onStatusChange } = options;
  const [status, setStatus] = useState<OverviewStreamStatus>("idle");
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  const esRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const heartbeatTimerRef = useRef<number | null>(null);
  const attemptRef = useRef(0);
  const onSnapshotRef = useRef(onSnapshot);
  const onStatusChangeRef = useRef(onStatusChange);

  useEffect(() => {
    onSnapshotRef.current = onSnapshot;
  }, [onSnapshot]);
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  const clearHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current !== null) {
      window.clearTimeout(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  const updateStatus = useCallback((s: OverviewStreamStatus) => {
    setStatus(s);
    onStatusChangeRef.current?.(s);
  }, []);

  useEffect(() => {
    if (!enabled) {
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
        scheduleReconnect();
      }, 35000);
    };

    const connect = () => {
      if (cancelled) return;
      updateStatus("connecting");
      const url = getOverviewStreamUrl();
      let es: EventSource;
      try {
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

      const handleSnapshot = (e: MessageEvent) => {
        if (cancelled) return;
        resetHeartbeatWithReconnect();
        const raw = (e as MessageEvent).data;
        if (!raw) return;
        try {
          const data = JSON.parse(raw) as OverviewStreamSnapshot;
          if (Array.isArray(data.services)) onSnapshotRef.current(data);
        } catch {
          // ignore parse error
        }
      };

      // event: overview — BE emit toàn bộ snapshot khi health thay đổi
      es.addEventListener("overview", handleSnapshot as EventListener);

      // Fallback onmessage nếu server gửi không có event name
      es.onmessage = (e: MessageEvent) => {
        resetHeartbeatWithReconnect();
        handleSnapshot(e);
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
  }, [enabled]);

  return { status, reconnectAttempt };
}