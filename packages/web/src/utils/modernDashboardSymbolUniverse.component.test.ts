import { describe, it, expect } from "vitest";
import { buildModernDashboardSymbolUniverse, filterUniverseByScope } from "./modernDashboardSymbolUniverse.js";

describe("modernDashboardSymbolUniverse", () => {
  it("gộp holdings + tracked + watchlist + quotes overlay", () => {
    const universe = buildModernDashboardSymbolUniverse({
      holdings: [{ symbol: "VCI", quantity: 100, market_value: 1000, current_price: 10 }],
      trackedSymbols: [{ symbol: "HPG", current_price: 20 }],
      watchlistGroups: [{ id: 1, name: "VN30", items: [{ symbol: "FPT" }] }],
      quotesBySymbol: { VCI: { current_price: 12, change_pct: 1.5 }, HPG: { current_price: 21 }, FPT: { current_price: 30 } },
    } as any);
    expect(universe.find((u) => u.symbol === "VCI")?.current_price).toBe(12); // quote overlay
    expect(universe.find((u) => u.symbol === "VCI")?.in_holdings).toBe(true);
    expect(universe.find((u) => u.symbol === "HPG")?.in_tracked).toBe(true);
    expect(universe.find((u) => u.symbol === "FPT")?.in_watchlist).toBe(true);
  });

  it("filterUniverseByScope đúng", () => {
    const universe = [
      { symbol: "VCI", in_holdings: true, in_tracked: false, in_watchlist: false },
      { symbol: "HPG", in_holdings: false, in_tracked: true, in_watchlist: false },
      { symbol: "FPT", in_holdings: false, in_tracked: false, in_watchlist: true },
    ] as any;
    expect(filterUniverseByScope(universe, "holdings")).toHaveLength(1);
    expect(filterUniverseByScope(universe, "tracked")).toHaveLength(1);
    expect(filterUniverseByScope(universe, "watchlist")).toHaveLength(1);
    expect(filterUniverseByScope(universe, "all")).toHaveLength(3);
  });
});
