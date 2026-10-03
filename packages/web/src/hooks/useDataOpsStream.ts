import { useCallback, useEffect, useRef, useState } from "react";
import { getBrowserStorageToken, resolveCoreApiBase } from "../adapters/core/transport.js";

export type DataOpsStreamStatus = "idle" | "connecting" | "open" | "error" | "closed";

export interface DataOpsStreamSnapshot {
  generated_at: string;
  observability: {
    backlog?: { by_dataset?: Array<{ dataset: string; backlog_count: number }>; by_tier?: Array<unknown> };
    fail_rates?: { window_1h?: { fail_rate_pct: number }; window_24h?: { fail_rate_pct: number } };
    starvation?: Array<{ tier: string; is_starved: boolean }>;
    parity_gates?: unknown;
    parity_history?: unknown;
    retention_health?: unknown;
    anomaly_guard?: unknown;
    updated_at?: string;
  };
  coverage: {
    datasets: Array<{ dataset: string; fresh: number; warm: number; stale: number; missing: number; error: number; unknown: number }>;
    top_gaps: Array<{ symbol: string; dataset: string; freshness_state: string; next_recommended_action: string | null }>;
    updated_at: string;
  };
  queue_tiers: { tiers: Array<{ tier: string; symbol_count: number; poll_interval_seconds: number; examples: string[] }>; updated_at: string };
}

export interface UseDataOpsStreamOptions {
  enabled: boolean;
  onSnapshot: (snap: DataOpsStreamSnapshot) => void;
  onStatusChange?: (s: DataOpsStreamStatus) => void;
}

function buildDataOpsStreamUrl(): string {
  const base = resolveCoreApiBase();
  const qs = new URLSearchParams();
  const token = typeof window !== "undefined" ? getBrowserStorageToken("access_token") : null;
  if (token) qs.set("token", token);
  const s = qs.toString();
  return `${base}/operator/soc/dataops/stream/${s ? `?${s}` : ""}`;
}

export function getDataOpsStreamUrl(): string {
  return buildDataOpsStreamUrl();
}

export function useDataOpsStream(options: UseDataOpsStreamOptions): { status: DataOpsStreamStatus; reconnectAttempt: number } {
  const { enabled, onSnapshot, onStatusChange } = options;
  const [status, setStatus] = useState<DataOpsStreamStatus>("idle");
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  const esRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const heartbeatTimerRef = useRef<number | null>(null);
  const attemptRef = useRef(0);
  const onSnapshotRef = useRef(onSnapshot);
  const onStatusChangeRef = useRef(onStatusChange);

  useEffect(() => { onSnapshotRef.current = onSnapshot; }, [onSnapshot]);
  useEffect(() => { onStatusChangeRef.current = onStatusChange; }, [onStatusChange]);

  const clearHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current !== null) {
      window.clearTimeout(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  const updateStatus = useCallback((s: DataOpsStreamStatus) => {
    setStatus(s);
    onStatusChangeRef.current?.(s);
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (esRef.current) { try { esRef.current.close(); } catch {} esRef.current = null; }
      if (reconnectTimerRef.current !== null) { window.clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
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
      if (esRef.current) { try { esRef.current.close(); } catch {} esRef.current = null; }
      updateStatus("error");
      const nextAttempt = attemptRef.current + 1;
      attemptRef.current = nextAttempt;
      setReconnectAttempt(nextAttempt);
      const delay = Math.min(1000 * Math.pow(2, nextAttempt - 1), 30000);
      if (reconnectTimerRef.current !== null) window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = window.setTimeout(() => { if (!cancelled) connect(); }, delay);
    };
    const resetHeartbeat = () => {
      clearHeartbeat();
      heartbeatTimerRef.current = window.setTimeout(() => scheduleReconnect(), 35000);
    };
    const connect = () => {
      if (cancelled) return;
      updateStatus("connecting");
      const url = getDataOpsStreamUrl();
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
        resetHeartbeat();
      };
      const handleSnap = (e: MessageEvent) => {
        if (cancelled) return;
        resetHeartbeat();
        const raw = (e as MessageEvent).data;
        if (!raw) return;
        try {
          const data = JSON.parse(raw) as DataOpsStreamSnapshot;
          if (data.observability && data.coverage) onSnapshotRef.current(data);
        } catch {}
      };
      es.addEventListener("dataops", handleSnap as EventListener);
      es.onmessage = (e: MessageEvent) => { resetHeartbeat(); handleSnap(e); };
      es.onerror = () => scheduleReconnect();
    };
    connect();
    return () => {
      cancelled = true;
      if (esRef.current) { try { esRef.current.close(); } catch {} esRef.current = null; }
      if (reconnectTimerRef.current !== null) { window.clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
      clearHeartbeat();
      updateStatus("closed");
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { status, reconnectAttempt };
}
