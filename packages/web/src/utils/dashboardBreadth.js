/**
 * P2-4 — helper thuần cho Dashboard: tính breadth & dịch trạng thái realtime.
 * Tách khỏi DashboardPage để test được mà không mount trang.
 */

export function calculateBreadth(quotes = {}) {
  let up = 0;
  let down = 0;
  let flat = 0;
  Object.values(quotes || {}).forEach((q) => {
    const hasData =
      q?.current_price != null || q?.change_pct != null ||
      q?.change_value != null || q?.change != null;
    if (!hasData) return;
    // `change_value` có thể bị làm tròn về 0 trong khi `change_pct` vẫn khác 0
    // ⇒ ưu tiên change_pct. Fallback change_value chỉ khi không có pct.
    let change = Number(q?.change_pct ?? q?.change ?? q?.change_value ?? 0);
    if (!Number.isFinite(change)) change = 0;
    if (change > 0) up += 1;
    else if (change < 0) down += 1;
    else flat += 1;
  });
  return { up, down, flat };
}

const STATUS_LABELS = {
  connecting: "đang kết nối",
  idle: "đang chờ",
  live: "đồng bộ",
  connected: "đã kết nối",
  disconnected: "mất kết nối",
};

export function formatRealtimeStatus(status) {
  return STATUS_LABELS[String(status || "").trim().toLowerCase()] || "đang đồng bộ";
}
