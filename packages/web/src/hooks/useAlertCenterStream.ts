import { useMemo } from "react";
import { getBrowserStorageToken, resolveCoreApiBase } from "../adapters/core/transport.js";
import { useSignalStream, type SignalStreamSignal } from "./useSignalStream.js";

export const ALERT_CENTER_STREAM_PATH = "/signals/alert-center/stream/";

export interface AlertCenterStreamQuery {
  lane?: string;
  symbol?: string;
  severity?: string;
  alert_family?: string;
}

export interface AlertCenterStreamItem {
  alert_id: string;
  alert_type?: string;
  alert_family?: string;
  lane?: string;
  symbol?: string;
  severity?: string;
  confidence?: number;
  freshness_state?: string;
  title?: string;
  body?: string;
  summary?: string;
  value?: number | string | null;
  direction?: string;
  session_date?: string | null;
  triggered_at?: string;
  source_ref?: string;
  metadata?: Record<string, unknown>;
  evidence?: Record<string, unknown>;
  executed_at?: string | null;
}

function buildAlertCenterQuery(query: AlertCenterStreamQuery = {}, lastId?: number | null): string {
  const qs = new URLSearchParams();
  if (query.lane) qs.set("lane", query.lane);
  if (query.symbol) qs.set("symbol", query.symbol);
  if (query.severity) qs.set("severity", query.severity);
  if (query.alert_family) qs.set("alert_family", query.alert_family);
  if (lastId != null) qs.set("since", String(lastId));
  const token = typeof window !== "undefined" ? getBrowserStorageToken("access_token") : null;
  if (token) qs.set("token", token);
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export function getAlertCenterStreamUrl(query: AlertCenterStreamQuery = {}, lastId?: number | null): string {
  const base = resolveCoreApiBase();
  return `${base}${ALERT_CENTER_STREAM_PATH}${buildAlertCenterQuery(query, lastId)}`;
}

/** Map payload BE (full serializer shape) → AlertItem của AlertCenterPage (cùng key alert_id). */
export function mapAlertCenterStreamItem(data: Record<string, unknown>): AlertCenterStreamItem | null {
  const symbol = String(data.symbol ?? "");
  const triggered = String(data.detected_at ?? data.triggered_at ?? "");
  if (!symbol || !triggered) return null;
  const num = (v: unknown): number | null => {
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    alert_id: String(data.alert_id ?? data.id ?? `${symbol}-${triggered}`),
    alert_family: data.type != null ? String(data.type) : undefined,
    lane: data.lane != null ? String(data.lane) : undefined,
    symbol,
    severity: data.severity != null ? String(data.severity) : undefined,
    confidence: num(data.confidence) ?? undefined,
    freshness_state: data.freshness_state != null ? String(data.freshness_state) : undefined,
    title: data.title != null ? String(data.title) : undefined,
    body: data.body != null ? String(data.body) : undefined,
    summary: data.summary != null ? String(data.summary) : undefined,
    value: (data.value as number | string | null) ?? null,
    direction: data.direction != null ? String(data.direction) : undefined,
    session_date: (data.session_date as string | null) ?? null,
    triggered_at: triggered,
    source_ref: data.source_ref != null ? String(data.source_ref) : undefined,
    metadata: (data.metadata as Record<string, unknown>) ?? {},
    evidence: (data.evidence as Record<string, unknown>) ?? {},
    executed_at: (data.executed_at as string | null) ?? null,
  };
}

export function useAlertCenterStream(options: {
  enabled: boolean;
  query?: AlertCenterStreamQuery;
  onItem: (item: AlertCenterStreamItem) => void;
}): { status: string; reconnectAttempt: number } {
  const { enabled, query, onItem } = options;
  const streamQuery = useMemo(() => ({
    lane: query?.lane,
    symbol: query?.symbol,
    severity: query?.severity,
    alert_family: query?.alert_family,
  }), [query?.lane, query?.symbol, query?.severity, query?.alert_family]);

  return useSignalStream({
    enabled,
    basePath: ALERT_CENTER_STREAM_PATH,
    eventName: "alert-center",
    query: streamQuery,
    onSignal: (sig: SignalStreamSignal) => {
      const mapped = mapAlertCenterStreamItem(sig as unknown as Record<string, unknown>);
      if (mapped) onItem(mapped);
    },
  });
}
