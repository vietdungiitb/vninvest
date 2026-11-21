/**
 * Resolve phiên giao dịch (YYYY-MM-DD) từ item chart được click.
 *
 * Widget `@vninvestcharts/widget` bắn `onClick({ currentItem })` với
 * `currentItem: EnrichedDatum` (`date: Date`). Hàm này pure (không phụ thuộc
 * widget) để test biên timezone được mà không cần mount chart.
 *
 * Ngày resolve theo múi `Asia/Ho_Chi_Minh` (phiên VN) — KHÔNG dùng local
 * getFullYear/getMonth vì item.date có thể là UTC midnight, lệch ±1 ngày
 * (F-05). Date invalid/thiếu → null để caller bỏ qua (không set session rác
 * khi click vùng trống).
 */
const VN_DAY_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function resolveSessionFromChartItem(item) {
  const raw = item?.date ?? null;
  const parsed = raw instanceof Date ? raw : raw != null ? new Date(raw) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return null;
  return {
    tradeDate: VN_DAY_FORMAT.format(parsed),
    timestamp: parsed.getTime(),
  };
}
