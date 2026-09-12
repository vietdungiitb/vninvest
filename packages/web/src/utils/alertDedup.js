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
