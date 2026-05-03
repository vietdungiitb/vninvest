import { useMemo } from 'react';
import { normalizeAlertSeverity, severityWeight } from '../utils/alertTaxonomy';

const RECENT_ALERT_WINDOW_MS = 5 * 60 * 1000;

function normalizeSymbol(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeAlertTimestamp(value) {
  const parsedTime = new Date(value || 0).getTime();
  return Number.isFinite(parsedTime) ? parsedTime : null;
}

export function buildRecentWhaleAlertMap(alertList = [], { now = Date.now(), recentWindowMs = RECENT_ALERT_WINDOW_MS } = {}) {
  return (alertList || []).reduce((accumulator, alert) => {
    const symbol = normalizeSymbol(alert?.symbol);
    if (!symbol) {
      return accumulator;
    }

    const timestamp = normalizeAlertTimestamp(alert?.ts || alert?.time || alert?.created_at || alert?.event_time);
    if (timestamp === null || now - timestamp > recentWindowMs) {
      return accumulator;
    }

    const severity = normalizeAlertSeverity(alert?.severity, 'medium');
    const sideSource = String(alert?.side || alert?.signal_type || alert?.type || '').toLowerCase();
    const side = sideSource.includes('sell') ? 'sell' : 'buy';
    const sizeClass = String(alert?.size_class || '').trim().toLowerCase();
    const matchedValue = Number(alert?.matched_value ?? alert?.matchedValue ?? alert?.value ?? 0);
    const current = accumulator[symbol];

    if (!current || timestamp > current.ts || (timestamp === current.ts && severityWeight(severity) > severityWeight(current.severity))) {
      accumulator[symbol] = {
        ts: timestamp,
        severity,
        side,
        sizeClass,
        matchedValue,
      };
    }

    return accumulator;
  }, {});
}

function buildPriorityAlerts(alertList = [], { now = Date.now(), recentWindowMs = RECENT_ALERT_WINDOW_MS } = {}) {
  const recentAlerts = (alertList || []).filter((alert) => {
    const timestamp = normalizeAlertTimestamp(alert?.ts || alert?.time || alert?.created_at || alert?.event_time);
    return timestamp !== null && now - timestamp <= recentWindowMs;
  });

  const deduped = [];
  const seen = new Set();

  recentAlerts.forEach((alert, index) => {
    const key = alert.event_id || `${normalizeSymbol(alert.symbol) || 'NA'}-${alert.ts || 'NA'}-${index}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    deduped.push(alert);
  });

  deduped.sort((left, right) => {
    const leftSeverity = severityWeight(normalizeAlertSeverity(left?.severity, 'medium'));
    const rightSeverity = severityWeight(normalizeAlertSeverity(right?.severity, 'medium'));
    if (leftSeverity !== rightSeverity) {
      return rightSeverity - leftSeverity;
    }

    const leftTs = normalizeAlertTimestamp(left?.ts || left?.time || left?.created_at || left?.event_time) || 0;
    const rightTs = normalizeAlertTimestamp(right?.ts || right?.time || right?.created_at || right?.event_time) || 0;
    if (leftTs !== rightTs) {
      return rightTs - leftTs;
    }

    return normalizeSymbol(left?.symbol).localeCompare(normalizeSymbol(right?.symbol));
  });

  return deduped.slice(0, 8);
}

export default function useDashboardAlerts({ alerts = [], now = null, recentWindowMs = RECENT_ALERT_WINDOW_MS } = {}) {
  const whaleAlertsBySymbol = useMemo(
    () => buildRecentWhaleAlertMap(alerts, { now: Number.isFinite(now) ? now : Date.now(), recentWindowMs }),
    [alerts, now, recentWindowMs],
  );

  const priorityAlerts = useMemo(
    () => buildPriorityAlerts(alerts, { now: Number.isFinite(now) ? now : Date.now(), recentWindowMs }),
    [alerts, now, recentWindowMs],
  );

  return {
    whaleAlertsBySymbol,
    priorityAlerts,
  };
}