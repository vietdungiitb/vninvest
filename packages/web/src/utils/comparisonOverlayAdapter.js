/**
 * W-K (Wave 1) — mapper thuần cho overlay so sánh của widget.
 *
 * Widget gửi `onComparisonChange(overlays)` (dts `VNInvestChartsProps.d.ts:291`;
 * bundle: `oe.current?.(fe.overlays)`) với mảng overlay dạng:
 * `[{ symbolId, normalizeToBaseline, visible, color, yAxis, lineWidth, lineStyle, fillArea }]`
 * (widget `tD()` → `overlays`).
 *
 * Host chỉ cần **danh sách mã** để hiện chip "đang so sánh" — không đụng dữ liệu
 * giá. Hàm thuần (không side effect) để unit test được.
 */

/**
 * Lấy danh sách mã từ mảng overlay của widget.
 * - Bỏ overlay không có `symbolId` hợp lệ.
 * - Chuẩn hoá uppercase + trim, bỏ trùng, giữ thứ tự gốc.
 *
 * @param {unknown} overlays
 * @returns {string[]}
 */
export function mapComparisonOverlaysToSymbols(overlays) {
  if (!Array.isArray(overlays)) return [];
  const symbols = [];
  const seen = new Set();
  for (const overlay of overlays) {
    const raw = typeof overlay === 'string' ? overlay : overlay?.symbolId;
    if (typeof raw !== 'string') continue;
    const symbol = raw.trim().toUpperCase();
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);
    symbols.push(symbol);
  }
  return symbols;
}

export default mapComparisonOverlaysToSymbols;
