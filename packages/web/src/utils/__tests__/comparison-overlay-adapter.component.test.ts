/**
 * W-K (Wave 1) — unit test cho mapper thuần của overlay so sánh (widget).
 *
 * Widget gửi `onComparisonChange(overlays)` với mảng overlay:
 * `[{ symbolId, normalizeToBaseline, visible, color, yAxis, lineWidth, ... }]`
 * (widget `tD()` → `overlays`).
 *
 * ⚠ Test quan trọng nhất: **identity phải giữ nguyên** — widget so khớp
 * overlay bằng so sánh chính xác `symbolId`, nên mapper KHÔNG được chuẩn hoá
 * (`trim`/`uppercase`) giá trị dùng để gọi `removeCompareSymbol` (B8 W-K).
 *
 * Test assert **giá trị thật** (không assert "không rỗng" — L-V04).
 */
import { describe, it, expect } from "vitest";
import { mapComparisonOverlaysToSymbols } from "../comparisonOverlayAdapter.js";

describe("W-K — comparisonOverlayAdapter", () => {
  it("T1 — lấy symbolId + label từ overlays thật (giữ thứ tự)", () => {
    const overlays = [
      { symbolId: "VNM", normalizeToBaseline: false, visible: true, color: "#f00", yAxis: "left" },
      { symbolId: "PDR", normalizeToBaseline: true, visible: true, color: "#0f0", yAxis: "right" },
    ];
    expect(mapComparisonOverlaysToSymbols(overlays)).toEqual([
      { symbolId: "VNM", label: "VNM", visible: true },
      { symbolId: "PDR", label: "PDR", visible: true },
    ]);
  });

  it("T2 — identity GIỮ NGUYÊN (lowercase/space), label mới uppercase/trim", () => {
    // Widget so khớp chính xác => `symbolId` phải y hệt để removeCompareSymbol trúng.
    const overlays = [{ symbolId: " vnm " }, { symbolId: "vnm" }];
    expect(mapComparisonOverlaysToSymbols(overlays)).toEqual([
      { symbolId: " vnm ", label: "VNM", visible: true },
      { symbolId: "vnm", label: "VNM", visible: true },
    ]);
  });

  it("T3 — bỏ overlay không có symbolId hợp lệ, dedupe theo giá trị GỐC", () => {
    const overlays = [
      { symbolId: null },
      { symbolId: 123 },
      {},
      { symbolId: "" },
      { symbolId: "   " },
      { symbolId: "VIC" },
      { symbolId: "VIC" },
    ];
    expect(mapComparisonOverlaysToSymbols(overlays)).toEqual([
      { symbolId: "VIC", label: "VIC", visible: true },
    ]);
  });

  it("T4 — giữ cả overlay đang ẩn (visible=false) để host tự lọc", () => {
    const overlays = [
      { symbolId: "VNM", visible: false },
      { symbolId: "PDR", visible: true },
    ];
    expect(mapComparisonOverlaysToSymbols(overlays)).toEqual([
      { symbolId: "VNM", label: "VNM", visible: false },
      { symbolId: "PDR", label: "PDR", visible: true },
    ]);
  });

  it("T5 — input không phải mảng trả mảng rỗng (không throw)", () => {
    expect(mapComparisonOverlaysToSymbols(null)).toEqual([]);
    expect(mapComparisonOverlaysToSymbols(undefined)).toEqual([]);
    expect(mapComparisonOverlaysToSymbols("VNM")).toEqual([]);
    expect(mapComparisonOverlaysToSymbols({})).toEqual([]);
  });
});
