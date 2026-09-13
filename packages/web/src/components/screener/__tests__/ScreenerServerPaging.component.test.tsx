import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createElement } from "react";
import { ScreenerResultsTable, toServerSortKey } from "../ScreenerResultsTable.js";
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

describe("toServerSortKey (P1.1)", () => {
  it("maps ai_advisory to ai_score, passes the rest through", () => {
    expect(toServerSortKey("ai_advisory")).toBe("ai_score");
    expect(toServerSortKey("rsi_14")).toBe("rsi_14");
    expect(toServerSortKey("symbol")).toBe("symbol");
  });
});

describe("ScreenerResultsTable server mode (P1.1)", () => {
  const onServerPage = vi.fn();
  const onServerSort = vi.fn();

  function renderServer() {
    const results: ScreenerResult = {
      matched: [row("AAA", 20), row("BBB", 10)],
      matched_count: 47,
      total_scanned: 100,
      rule_name: "r",
      rule_id: 1,
      page: 1,
      limit: 10,
      pages: 5,
      sort: "ai_score",
      order: "desc",
    };
    render(
      createElement(ScreenerResultsTable, {
        results,
        serverMeta: { page: 1, limit: 10, pages: 5, sort: "ai_score", order: "desc" },
        onServerPage,
        onServerSort,
      }),
    );
  }

  beforeEach(() => {
    onServerPage.mockClear();
    onServerSort.mockClear();
    renderServer();
  });

  it("renders server rows as-is with server pager", () => {
    expect(screen.getByRole("link", { name: "AAA" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "BBB" })).toBeTruthy();
    expect(screen.getByText("1 / 5")).toBeTruthy();
  });

  it("pager next calls onServerPage, header sort calls onServerSort", () => {
    fireEvent.click(screen.getByText("common.next"));
    expect(onServerPage).toHaveBeenCalledWith(2);
    fireEvent.click(screen.getByText("screener.columns.price", { exact: false }));
    expect(onServerSort).toHaveBeenCalledWith("close", "desc");
  });

  it("shows the server sort indicator on the active column", () => {
    expect(screen.getByText("screener.columns.aiScore", { exact: false }).textContent).toContain("▼");
  });
});
