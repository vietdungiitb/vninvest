import { describe, it, expect } from "vitest";
import { buildTrades, type ScreenerRunEntry } from "../screenerHistoryStore.js";

function entry(id: string, ts: number, rows: ScreenerRunEntry["rows"]): ScreenerRunEntry {
  return { id, ruleId: 1, ruleName: "r", timestamp: ts, rows };
}

describe("buildTrades (P0.7 T1)", () => {
  it("scores BUY wins/losses against the next available price", () => {
    const runs = [
      entry("a", 1000, [{ symbol: "HPG", close: 10, action: "BUY", score: 80 }]),
      entry("b", 2000, [{ symbol: "HPG", close: 12, action: "HOLD", score: 50 }]),
      entry("c", 3000, [{ symbol: "HPG", close: 9, action: "HOLD", score: 40 }]),
    ];
    const trades = buildTrades(runs, null);
    // first later close (12) is used as exit -> BUY 10 -> 12 wins
    expect(trades).toHaveLength(1);
    expect(trades[0]).toMatchObject({ symbol: "HPG", action: "BUY", entry: 10, exit: 12, win: true });
  });

  it("inverts the win condition for SELL", () => {
    const runs = [
      entry("a", 1000, [{ symbol: "VIC", close: 50, action: "SELL", score: 20 }]),
      entry("b", 2000, [{ symbol: "VIC", close: 45, action: "HOLD", score: 30 }]),
    ];
    const down = buildTrades(runs, null);
    expect(down).toHaveLength(1);
    expect(down[0].win).toBe(true); // SELL 50 -> 45 wins
    const up = buildTrades(
      [entry("a", 1000, [{ symbol: "VIC", close: 50, action: "SELL", score: 20 }]),
       entry("b", 2000, [{ symbol: "VIC", close: 55, action: "HOLD", score: 30 }])],
      null,
    );
    expect(up[0].win).toBe(false);
  });

  it("prefers currentPrices over later runs and skips rows without exit", () => {
    const runs = [
      entry("a", 1000, [
        { symbol: "HPG", close: 10, action: "BUY", score: 80 },
        { symbol: "NExit", close: 5, action: "BUY", score: 70 },
        { symbol: "NoClose", close: null, action: "BUY", score: 70 },
        { symbol: "Hold", close: 7, action: "HOLD", score: 50 },
      ]),
      entry("b", 2000, [{ symbol: "HPG", close: 12, action: "HOLD", score: 50 }]),
    ];
    const trades = buildTrades(runs, { HPG: 11 });
    expect(trades).toHaveLength(1);
    expect(trades[0]).toMatchObject({ symbol: "HPG", entry: 10, exit: 11, win: true });
  });

  it("handles empty histories", () => {
    expect(buildTrades([], null)).toEqual([]);
    expect(buildTrades([entry("a", 1, [])], {})).toEqual([]);
  });
});
