import { describe, it, expect, vi } from "vitest";

vi.mock("../../../context/RealtimeContext.js", () => ({
  useRealtimeFeedFromManager: vi.fn(() => ({ quotesBySymbol: {}, realtimeStatus: "idle" })),
}));

vi.mock("../../../context/LangContext.js", () => ({
  useI18n: () => ({ t: (k: string, opts: any) => opts?.defaultValue ?? k }),
}));

vi.mock("../../../adapters/coreApiAdapter.js", () => ({
  coreApiAdapter: {},
}));

import {
  mergeHoldingsBySymbol,
  fetchAllPortfoliosNav,
} from "./WatchlistContext";

describe("Watchlist multi-portfolio merge (W7 DoR-2)", () => {
  it("sums quantity/market_value/pnl for the same symbol across portfolios", () => {
    const merged = mergeHoldingsBySymbol([
      [{ symbol: "VCB", quantity: 100, avg_cost: 90, market_value: 10000, unrealized_pnl: 1000 }],
      [{ symbol: "VCB", quantity: 50, avg_cost: 80, market_value: 5000, unrealized_pnl: 1000 }],
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].quantity).toBe(150);
    expect(merged[0].market_value).toBe(15000);
    expect(merged[0].unrealized_pnl).toBe(2000);
    // quantity-weighted avg_cost = (100*90 + 50*80)/150
    expect(merged[0].avg_cost).toBeCloseTo(86.6667, 3);
  });

  it("dedupes symbols case-insensitively and keeps distinct symbols", () => {
    const merged = mergeHoldingsBySymbol([
      [{ symbol: "vnm", quantity: 10, avg_cost: 70, market_value: 800 }],
      [{ symbol: "VNM", quantity: 10, avg_cost: 70, market_value: 800 }],
      [{ symbol: "HPG", quantity: 5, avg_cost: 25, market_value: 150 }],
    ]);
    expect(merged.map((h) => h.symbol).sort()).toEqual(["HPG", "VNM"]);
    expect(merged.find((h) => h.symbol === "VNM")?.quantity).toBe(20);
  });

  it("recomputes unrealized_pnl_pct from merged totals", () => {
    const merged = mergeHoldingsBySymbol([
      [{ symbol: "SSI", quantity: 100, avg_cost: 30, market_value: 3600, unrealized_pnl_pct: 0 }],
    ]);
    // (3600-3000)/3000*100 = 20
    expect(merged[0].unrealized_pnl_pct).toBeCloseTo(20, 6);
  });

  it("fetchAllPortfoliosNav sums per-portfolio NAVs and skips failures", async () => {
    const api = {
      getPortfolioSummary: vi
        .fn()
        .mockResolvedValueOnce({ nav: 1000 })
        .mockRejectedValueOnce(new Error("boom"))
        .mockResolvedValueOnce({ total_value: 500 }),
    };
    const nav = await fetchAllPortfoliosNav(api, [{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(nav).toBe(1500);
    expect(api.getPortfolioSummary).toHaveBeenCalledTimes(3);
  });

  it("fetchAllPortfoliosNav returns null when no portfolio reports NAV", async () => {
    const api = { getPortfolioSummary: vi.fn(async () => ({})) };
    await expect(fetchAllPortfoliosNav(api, [{ id: 1 }])).resolves.toBeNull();
    await expect(fetchAllPortfoliosNav({}, [{ id: 1 }])).resolves.toBeNull();
  });
});
