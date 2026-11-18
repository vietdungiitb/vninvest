import { describe, it, expect } from "vitest";
import { resolveTileSize } from "../PortfolioHeatmap.js";

describe("P0-5 / Q2 — chế độ Tỷ trọng khi chưa có danh mục fallback vốn hóa", () => {
  it("không dùng currentPrice * 100; dùng marketCap khi có", () => {
    const r = resolveTileSize({
      sizeMode: "weight",
      quantity: 0,
      marketValue: 0,
      marketCap: 500,
      currentPrice: 100_000,
      actualHoldingCount: 0,
      totalHoldingValue: 0,
    });
    expect(r.sizeValue).toBe(500);
    expect(r.capFallback).toBe(true);
    expect(r.sizeValue).not.toBe(100_000 * 100);
  });

  it("marketCap = 0 → fallback an toàn 1 (không NaN/0)", () => {
    const r = resolveTileSize({
      sizeMode: "weight",
      quantity: 0,
      marketValue: 0,
      marketCap: 0,
      currentPrice: 12_000,
      actualHoldingCount: 0,
      totalHoldingValue: 0,
    });
    expect(r.sizeValue).toBe(1);
    expect(r.capFallback).toBe(true);
  });

  it("có vị thế thật → vẫn dùng marketValue, không fallback", () => {
    const r = resolveTileSize({
      sizeMode: "weight",
      quantity: 100,
      marketValue: 7_500_000,
      marketCap: 500,
      currentPrice: 75_000,
      actualHoldingCount: 1,
      totalHoldingValue: 7_500_000,
    });
    expect(r.sizeValue).toBe(7_500_000);
    expect(r.capFallback).toBe(false);
  });
});
