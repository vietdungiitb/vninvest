/**
 * W-K (Wave 1) — mapper thuần cho overlay so sánh của widget.
 *
 * Widget gửi `onComparisonChange(overlays)` (dts `VNInvestChartsProps.d.ts:291`;
 * bundle: `oe.current?.(fe.overlays)`) với mảng overlay dạng:
 * `[{ symbolId, normalizeToBaseline, visible, color, yAxis, lineWidth, lineStyle, fillArea }]`
 * (widget `tD()` → `overlays`).
 *
 * ⚠ **QUAN TRỌNG — identity phải giữ nguyên (B8 W-K, blocker):**
 * Widget so khớp overlay bằng **so sánh chính xác** `symbolId`
 * (`tD()` → `removeSymbol: d => u.filter(m => m.symbolId !== d)`).
 * ⇒ KHÔNG được chuẩn hoá `symbolId` (trim/uppercase) trước khi dùng để
 * gọi `removeCompareSymbol`, nếu không mã "vnm" ≠ "VNM" ⇒ xoá không được.
 * Vì vậy mapper trả **2 trường**:
 *   - `symbolId`: giữ **đúng nguyên bản** (dùng làm identity + để xoá),
 *   - `label`: bản hiển thị (trim + uppercase).
 *
 * `visible` được giữ lại: widget **không vẽ** series khi `visible === false`
 * ⇒ host chỉ hiện chip cho overlay đang thực sự được vẽ.
 *
 * Hàm thuần (không side effect) để unit test được.
 */

/**
 * Chuẩn hoá danh sách overlay của widget thành danh sách chip cho host.
 *
 * @param {unknown} overlays
 * @returns {{ symbolId: string, label: string, visible: boolean }[]}
 */
export function mapComparisonOverlaysToSymbols(overlays) {
  if (!Array.isArray(overlays)) return [];
  const result = [];
  const seen = new Set();
  for (const overlay of overlays) {
    if (!overlay || typeof overlay !== 'object') continue;
    const raw = overlay.symbolId;
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    // Identity = chuỗi GỐC (không chuẩn hoá) để removeCompareSymbol khớp.
    if (seen.has(raw)) continue;
    seen.add(raw);
    result.push({
      symbolId: raw,
      label: trimmed.toUpperCase(),
      visible: overlay.visible !== false,
    });
  }
  return result;
}

export default mapComparisonOverlaysToSymbols;
