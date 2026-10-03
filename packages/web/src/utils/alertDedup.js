/**
 * alertDedup.js — dedup logic chuẩn cho UnifiedAlert
 * Ưu tiên alert_id (UUID REST) trước event_id (WS), rồi id, rồi symbol-ts fallback.
 * Dùng chung cho DashboardPage và test, tránh replicate sai lệch (audit #4).
 */
export function dedupAlerts(alerts) {
  const unique = [];
  const seen = new Set();
  (alerts || []).forEach((a) => {
    const key = a?.alert_id || a?.event_id || a?.id || `${a?.symbol}-${a?.ts || a?.triggered_at || a?.timestamp}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(a);
    }
  });
  return unique;
}

export function sortAlertsByRecency(alerts) {
  return [...(alerts || [])].sort((a, b) => {
    const ta = new Date(a?.triggered_at || a?.ts || a?.timestamp || a?.executed_at || 0).getTime();
    const tb = new Date(b?.triggered_at || b?.ts || b?.timestamp || b?.executed_at || 0).getTime();
    return tb - ta;
  });
}

export function dedupAndSortAlerts(alerts) {
  return sortAlertsByRecency(dedupAlerts(alerts));
}

/**
 * Ranks per signal_intelligence.models.SeverityChoices — `critical | high |
 * medium | low`. Anything unknown sorts last rather than first, so a new
 * severity value added on the backend cannot silently outrank a real one.
 */
const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };
const UNRANKED = 99;

function alertValue(alert) {
  const raw = alert?.value ?? alert?.matched_value;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

function alertTime(alert) {
  const t = new Date(
    alert?.triggered_at || alert?.ts || alert?.timestamp || alert?.executed_at || 0
  ).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * Curation order for a summary lane: severity first, then the largest money
 * value, then recency. `sortAlertsByRecency` alone put a 20-hour-old small
 * alert above a 1-minute-old critical one, which is the wrong story for a
 * widget that only has room for a handful of rows.
 *
 * The comparator for value was written twice (AlertCenterPage's
 * `largestValue` toggle); it is lifted here so both call sites agree.
 */
export function sortAlertsByPriority(alerts) {
  return [...(alerts || [])].sort((a, b) => {
    const sa = SEVERITY_RANK[a?.severity] ?? UNRANKED;
    const sb = SEVERITY_RANK[b?.severity] ?? UNRANKED;
    if (sa !== sb) return sa - sb;
    const va = alertValue(a);
    const vb = alertValue(b);
    if (va !== vb) return vb - va;
    return alertTime(b) - alertTime(a);
  });
}

export function topAlerts(alerts, n = 5) {
  return sortAlertsByPriority(alerts).slice(0, n);
}
