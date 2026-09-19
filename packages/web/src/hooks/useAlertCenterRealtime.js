import { useMemo, useEffect, useRef } from "react";
import useRealtimeFeedCore from "./useRealtimeFeedCore.js";

/**
 * AlertCenter realtime feed wrapper.
 *
 * Bypass `useRealtimeFeedFromManager` intentionally: the manager filters
 * alerts by `normalizedSymbols`, but the Alert Center is a GLOBAL feed
 * (market_discovery group) — not scoped to a fixed symbol list. Subscribing
 * with `['market_discovery']` keeps every alert flowing through regardless
 * of symbol, exactly like DashboardPage's discovery channel.
 *
 * See IMPLEMENTATION_PLAN_ALERT_CENTER_P0_20260718.md — Nuance F1.
 */
export function useAlertCenterRealtime({ enabled = true, maxAlerts = 50 } = {}) {
  const feed = useRealtimeFeedCore({
    symbols: ["market_discovery"],
    pollInterval: 30000,
    maxAlerts,
    enabled,
  });

  const knownIdsRef = useRef(null);
  useEffect(() => {
    const ids = new Set();
    for (const item of [...(feed.alerts || []), ...(feed.darkFlowAlerts || [])]) {
      const key = item?.event_id || `${item?.symbol || "NA"}-${item?.ts || "NA"}`;
      ids.add(String(key));
    }
    if (knownIdsRef.current === null) {
      knownIdsRef.current = ids;
      return;
    }
    const prev = knownIdsRef.current;
    for (const item of [...(feed.alerts || []), ...(feed.darkFlowAlerts || [])]) {
      const key = String(item?.event_id || `${item?.symbol || "NA"}-${item?.ts || "NA"}`);
      if (!prev.has(key)) {
        prev.add(key);
        try {
          window.dispatchEvent(new CustomEvent("alert-center-new", { detail: item }));
        } catch (_) {
          // ignore dispatch errors (non-browser env)
        }
      }
    }
  }, [feed.alerts, feed.darkFlowAlerts]);

  const realtimeAlerts = useMemo(() => {
    const merged = [...(feed.alerts || []), ...(feed.darkFlowAlerts || [])];
    const byId = new Map();
    for (const item of merged) {
      const key = item?.event_id || `${item?.symbol || "NA"}-${item?.ts || "NA"}`;
      if (!byId.has(key)) {
        byId.set(key, { ...item, event_id: item.event_id || key });
      }
    }
    return Array.from(byId.values()).sort((a, b) => {
      const ta = a?.ts ? new Date(a.ts).getTime() : 0;
      const tb = b?.ts ? new Date(b.ts).getTime() : 0;
      return tb - ta;
    });
  }, [feed.alerts, feed.darkFlowAlerts]);

  return {
    realtimeAlerts,
    rawWhaleAlerts: feed.alerts || [],
    rawDarkFlowAlerts: feed.darkFlowAlerts || [],
    realtimeStatus: feed.realtimeStatus,
    lastEventAt: feed.lastEventAt,
    connectionState: feed.metrics?.connectionState,
    eventCounts: feed.metrics?.eventCounts,
  };
}

export default useAlertCenterRealtime;
