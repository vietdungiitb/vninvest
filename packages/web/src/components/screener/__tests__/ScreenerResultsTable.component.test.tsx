import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createElement } from "react";
import { ScreenerResultsTable } from "../ScreenerResultsTable.js";
import type { ScreenerResult, ScreenerRow } from "../../../types/screener.js";

vi.mock("../../../context/LangContext.js", () => ({
  useI18n: () => ({
    t: (key: string) => key,
    formatNumber: (n: unknown) => String(n),
  }),
}));

function row(symbol: string, close: number): ScreenerRow {
  return {
    symbol,
    close,
    rsi_14: 50,
    sma20: null,
    sma50: null,
    price_vs_sma20_pct: null,
    price_vs_sma50_pct: null,
    sma20_vs_sma50_pct: null,
    macd_hist: null,
    volume_rvol: null,
    momentum_20d_pct: null,
    range_position_pct: null,
    avg_volume_20: null,
    stochastic_k: null,
    stochastic_d: null,
    atr_14: null,
    adx_14: null,
    bollinger_width: null,
    vwap: null,
    mfi_14: null,
    pe_ratio: null,
    market_cap: null,
    dividend_yield: null,
    eps_growth_yoy: null,
    revenue_growth_yoy: null,
    debt_to_equity: null,
    ai_advisory: null,
    date: "2026-09-12",
  };
}

// 26 rows, close deliberately unordered — Rossi-style check needs real sorting
const CLOSES = [15, 3, 22, 8, 30, 1, 19, 11, 26, 5, 17, 9, 28, 2, 24, 6, 20, 12, 29, 4, 16, 10, 27, 7, 23, 13];
const MATCHED: ScreenerRow[] = CLOSES.map((close, i) => row(`S${String(i + 1).padStart(2, "0")}`, close));

function makeResults(): ScreenerResult {
  return {
    matched: MATCHED,
    matched_count: MATCHED.length,
    total_scanned: 100,
    rule_name: "r",
    rule_id: 1,
  };
}

describe("ScreenerResultsTable (P0.7 T4)", () => {
  beforeEach(() => {
    render(createElement(ScreenerResultsTable, { results: makeResults() }));
  });

  it("paginates a fixed 25-row page with prev/next", () => {
    // page 1: first 25 symbols, S26 hidden
    expect(screen.getByRole("link", { name: "S01" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "S26" })).toBeNull();
    expect(screen.getByText("1 / 2")).toBeTruthy();
    fireEvent.click(screen.getByText("common.next"));
    expect(screen.getByRole("link", { name: "S26" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "S01" })).toBeNull();
    expect(screen.getByText("2 / 2")).toBeTruthy();
    fireEvent.click(screen.getByText("common.prev"));
    expect(screen.getByRole("link", { name: "S01" })).toBeTruthy();
  });

  it("sorts by column on header click (asc then desc)", () => {
    const header = screen.getByText("screener.columns.price", { exact: false });
    fireEvent.click(header); // asc
    const ascLinks = screen.getAllByRole("link");
    expect(ascLinks[0].textContent).toBe("S06"); // close=1 is smallest
    expect(screen.getByText("screener.columns.price", { exact: false }).textContent).toContain("▲");
    fireEvent.click(header); // desc
    const descLinks = screen.getAllByRole("link");
    expect(descLinks[0].textContent).toBe("S05"); // close=30 is largest
  });

  it("toggles columns via the column picker", () => {
    fireEvent.click(screen.getByText("screener.columnsBtn"));
    // header cell + picker label both render the key
    expect(screen.queryAllByText("screener.columns.rsi14")).toHaveLength(2);
    const rsiBox = screen.getByLabelText("screener.columns.rsi14") as HTMLInputElement;
    expect(rsiBox.checked).toBe(true);
    fireEvent.click(rsiBox);
    // header cell gone, picker label remains
    expect(screen.queryAllByText("screener.columns.rsi14")).toHaveLength(1);
    // symbol column still there
    expect(screen.getByRole("link", { name: "S01" })).toBeTruthy();
  });
});
