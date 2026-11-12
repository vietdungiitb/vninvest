/**
 * W-K (Wave 1) — unit test cho mapper thuần của overlay so sánh (widget).
 *
 * Widget gửi `onComparisonChange(overlays)` với mảng overlay:
 * `[{ symbolId, normalizeToBaseline, visible, color, yAxis, lineWidth, ... }]`
 * (widget `tD()` → `overlays`). Host chỉ cần danh sách mã để hiện chip.
 *
 * Test assert **giá trị thật** (không assert "không rỗng" — L-V04).
 */
import { describe, it, expect } from "vitest";
import { mapComparisonOverlaysToSymbols } from "../comparisonOverlayAdapter.js";

describe("W-K — comparisonOverlayAdapter", () => {
  it("T1 — lấy symbolId từ overlays thật (giữ thứ tự)", () => {
    const overlays = [
      { symbolId: "VNM", normalizeToBaseline: false, visible: true, color: "#f00", yAxis: "left" },
      { symbolId: "PDR", normalizeToBaseline: true, visible: true, color: "#0f0", yAxis: "right" },
    ];
    expect(mapComparisonOverlaysToSymbols(overlays)).toEqual(["VNM", "PDR"]);
  });

  it("T2 — chuẩn hoá uppercase + trim và bỏ trùng", () => {
    const overlays = [
      { symbolId: " vnm " },
      { symbolId: "VNM" },
      { symbolId: "pdr" },
    ];
    expect(mapComparisonOverlaysToSymbols(overlays)).toEqual(["VNM", "PDR"]);
  });

  it("T3 — bỏ overlay không có symbolId hợp lệ", () => {
    const overlays = [
      { symbolId: null },
      { symbolId: 123 },
      {},
      { symbolId: "" },
      { symbolId: "VIC" },
    ];
    expect(mapComparisonOverlaysToSymbols(overlays)).toEqual(["VIC"]);
  });

  it("T4 — input không phải mảng trả mảng rỗng (không throw)", () => {
    expect(mapComparisonOverlaysToSymbols(null)).toEqual([]);
    expect(mapComparisonOverlaysToSymbols(undefined)).toEqual([]);
    expect(mapComparisonOverlaysToSymbols("VNM")).toEqual([]);
    expect(mapComparisonOverlaysToSymbols({})).toEqual([]);
  });
});
