import { describe, it, expect } from "vitest";
import { heatColorContinuous, textOnHeat, getHeatColor, groupTinyTiles } from "../PortfolioHeatmap.js";

describe("heatmap continuous scale (S3 — kẹp ±7%)", () => {
  it("-3,33% và -9,73% khác màu (audit #25)", () => {
    expect(heatColorContinuous(-3.33)).not.toBe(heatColorContinuous(-9.73));
  });
  it("kẹp biên: ±20 cùng màu biên ±7", () => {
    expect(heatColorContinuous(-20)).toBe(heatColorContinuous(-7));
    expect(heatColorContinuous(20)).toBe(heatColorContinuous(7));
  });
  it("0% vàng amber vivid #f59e0b", () => {
    expect(heatColorContinuous(0)).toBe("#f59e0b");
  });
  it("đối xứng nội suy: ±3 khác nhau, cùng độ bão hòa họ", () => {
    expect(heatColorContinuous(3)).not.toBe(heatColorContinuous(-3));
    expect(heatColorContinuous(7)).not.toBe(heatColorContinuous(-7));
  });
  it("textOn: nền tối → chữ trắng, nền sáng → chữ đậm", () => {
    expect(textOnHeat("#991b1b")).toBe("#fff");
    expect(textOnHeat("#15803d")).toBe("#fff");
    expect(textOnHeat("#f59e0b")).toBe("#0b0f17");
    expect(textOnHeat("#4ade80")).toBe("#0b0f17");
  });
  it("getHeatColor tương thích thang liên tục", () => {
    expect(getHeatColor(4.38)).toBe(heatColorContinuous(4.38));
    expect(getHeatColor(-0.7)).toBe(heatColorContinuous(-0.7));
  });
});

describe("groupTinyTiles (fix heatmap 50 ma chi hien 12)", () => {
  const tile = (name: string, value: number) => ({ name, value, share: value / 100, changePct: 1 });
  it("gom tile <2% khi qua 8 ma, tra groupedCount", () => {
    const big = [tile("A", 30), tile("B", 30)];
    const small = Array.from({ length: 10 }, (_, i) => tile(`S${i}`, 1));
    const { tiles, groupedCount } = groupTinyTiles([...big, ...small], 100);
    expect(groupedCount).toBe(10);
    expect(tiles).toHaveLength(3);
    const other = tiles.find((d: any) => d.isOther);
    expect(other?.otherCount).toBe(10);
  });
  it("khong gom khi <= 8 ma nho", () => {
    const big = [tile("A", 92)];
    const small = Array.from({ length: 8 }, (_, i) => tile(`S${i}`, 1));
    const { tiles, groupedCount } = groupTinyTiles([...big, ...small], 100);
    expect(groupedCount).toBe(0);
    expect(tiles).toHaveLength(9);
  });
});
