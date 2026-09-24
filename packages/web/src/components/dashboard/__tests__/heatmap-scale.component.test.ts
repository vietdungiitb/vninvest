import { describe, it, expect } from "vitest";
import { heatColorContinuous, textOnHeat, getHeatColor, groupTinyTiles, heatLabelGating, formatHeatmapLabel } from "../PortfolioHeatmap.js";

describe("heatmap continuous scale (S3 — kẹp ±7%)", () => {
  it("-9.73 và -3.33 khác màu rõ (audit #25)", () => {
    expect(heatColorContinuous(-9.73)).not.toBe(heatColorContinuous(-3.33));
  });
  it("-3,33% và -9,73% khác màu (audit alias)", () => {
    expect(heatColorContinuous(-3.33)).not.toBe(heatColorContinuous(-9.73));
  });
  it("kẹp biên: ±20 cùng màu biên ±7", () => {
    expect(heatColorContinuous(-20)).toBe(heatColorContinuous(-7));
    expect(heatColorContinuous(20)).toBe(heatColorContinuous(7));
  });
  it("kẹp ±7 chính xác biên", () => {
    expect(heatColorContinuous(-7)).toBe("#7f1d1d");
    expect(heatColorContinuous(7)).toBe("#166534");
  });
  it("0% nền trầm #2f3747 (L6/S3.1 — vàng chỉ viền, không fill)", () => {
    expect(heatColorContinuous(0)).toBe("#2f3747");
  });
  it("đối xứng nội suy: ±3 khác nhau, cùng độ bão hòa họ", () => {
    expect(heatColorContinuous(3)).not.toBe(heatColorContinuous(-3));
    expect(heatColorContinuous(7)).not.toBe(heatColorContinuous(-7));
  });
  it("textOn: nền tối → chữ trắng, nền sáng → chữ đậm #0b0f17", () => {
    expect(textOnHeat("#7f1d1d")).toBe("#fff");
    expect(textOnHeat("#2f3747")).toBe("#fff");
    expect(textOnHeat("#991b1b")).toBe("#fff");
    expect(textOnHeat("#15803d")).toBe("#fff");
    expect(textOnHeat("#14532d")).toBe("#fff");
    // shallow/luminance high → dark text
    // #eab308 is border yellow, should be #0b0f17 if ever used as bg (though fill not used)
    expect(textOnHeat("#f59e0b")).toBe("#0b0f17");
    expect(textOnHeat("#4ade80")).toBe("#0b0f17");
    expect(textOnHeat("#ffffff")).toBe("#0b0f17");
  });
  it("getHeatColor tương thích thang liên tục", () => {
    expect(getHeatColor(4.38)).toBe(heatColorContinuous(4.38));
    expect(getHeatColor(-0.7)).toBe(heatColorContinuous(-0.7));
  });
});

describe("heatmap label-gating thresholds (S3.3 — 44x28 / 56x40)", () => {
  it("tile <44×28 không hiện chữ (empty)", () => {
    expect(heatLabelGating(43, 28).showText).toBe(false);
    expect(heatLabelGating(44, 27).showText).toBe(false);
    expect(heatLabelGating(30, 20).showText).toBe(false);
    expect(formatHeatmapLabel({ name: "VCI", data: { changePct: 1.2, showName: true, showPct: true }, rect: { width: 30, height: 20 } })).toBe("");
  });
  it("tile 44×28 hiện tên, chưa pct khi <56×40", () => {
    expect(heatLabelGating(44, 28).showText).toBe(true);
    expect(heatLabelGating(44, 28).showPct).toBe(false);
    expect(heatLabelGating(55, 39).showPct).toBe(false);
    expect(formatHeatmapLabel({ name: "HPG", data: { changePct: 2.5, showName: true, showPct: true }, rect: { width: 44, height: 28 } })).toBe("HPG");
    expect(formatHeatmapLabel({ name: "HPG", data: { changePct: 2.5, showName: true, showPct: true }, rect: { width: 50, height: 35 } })).toBe("HPG");
  });
  it("tile ≥56×40 hiện tên + pct", () => {
    expect(heatLabelGating(56, 40).showText).toBe(true);
    expect(heatLabelGating(56, 40).showPct).toBe(true);
    expect(heatLabelGating(100, 100).showPct).toBe(true);
    expect(formatHeatmapLabel({ name: "FPT", data: { changePct: 1.23, showName: true, showPct: true }, rect: { width: 56, height: 40 } })).toBe("FPT\n+1.23%");
    expect(formatHeatmapLabel({ name: "VIC", data: { changePct: -2.5, showName: true, showPct: true }, rect: { width: 80, height: 60 } })).toBe("VIC\n-2.50%");
  });
  it("fallback share proxy khi rect undefined — dùng showName/showPct", () => {
    expect(formatHeatmapLabel({ name: "VCI", data: { changePct: 1.2, showName: false, showPct: false } })).toBe("");
    expect(formatHeatmapLabel({ name: "VCI", data: { changePct: 1.2, showName: true, showPct: false } })).toBe("VCI");
    expect(formatHeatmapLabel({ name: "VCI", data: { changePct: 1.2, showName: true, showPct: true } })).toBe("VCI\n+1.20%");
  });
});

describe("groupTinyTiles (fix heatmap 50 mã chỉ hiện 12)", () => {
  const tile = (name: string, value: number) => ({ name, value, share: value / 100, changePct: 1 });
  it("gom tile <2% khi qua 8 mã, trả groupedCount", () => {
    const big = [tile("A", 30), tile("B", 30)];
    const small = Array.from({ length: 10 }, (_, i) => tile(`S${i}`, 1));
    const { tiles, groupedCount } = groupTinyTiles([...big, ...small], 100);
    expect(groupedCount).toBe(10);
    expect(tiles).toHaveLength(3);
    const other = tiles.find((d: any) => d.isOther);
    expect(other?.otherCount).toBe(10);
  });
  it("không gom khi <= 8 mã nhỏ", () => {
    const big = [tile("A", 92)];
    const small = Array.from({ length: 8 }, (_, i) => tile(`S${i}`, 1));
    const { tiles, groupedCount } = groupTinyTiles([...big, ...small], 100);
    expect(groupedCount).toBe(0);
    expect(tiles).toHaveLength(9);
  });
});
