import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { ScreenerResultsTable } from "../ScreenerResultsTable.js";
import type { ScreenerResult, ScreenerRow } from "../../../types/screener.js";

vi.mock("../../../context/LangContext.js", () => ({
  useI18n: () => ({
    t: (key: string, opts?: any) => opts?.defaultValue ?? key,
    formatNumber: (n: unknown) => String(n),
  }),
}));

const mocks = vi.hoisted(() => ({
  getWatchlists: vi.fn(),
  addWatchlistItem: vi.fn(),
  createPriceAlert: vi.fn(),
}));

vi.mock("../../../adapters/coreApiAdapter.js", () => ({
  coreApiAdapter: {
    getWatchlists: (...args: any[]) => mocks.getWatchlistItems?.(...args) ?? mocks.getWatchlists(...args),
    addWatchlistItem: (...args: any[]) => mocks.addWatchlistItem(...args),
    createPriceAlert: (...args: any[]) => mocks.createPriceAlert(...args),
  },
}));

function row(symbol: string, close: number): ScreenerRow {
  return {
    symbol, close, rsi_14: 50, sma20: null, sma50: null,
    price_vs_sma20_pct: null, price_vs_sma50_pct: null, sma20_vs_sma50_pct: null,
    macd_hist: null, volume_rvol: null, momentum_20d_pct: null, range_position_pct: null,
    avg_volume_20: null, stochastic_k: null, stochastic_d: null, atr_14: null,
    adx_14: null, bollinger_width: null, vwap: null, mfi_14: null,
    pe_ratio: null, market_cap: null, dividend_yield: null, eps_growth_yoy: null,
    revenue_growth_yoy: null, debt_to_equity: null, ai_advisory: null, date: "2026-09-12",
  };
}

function renderTable() {
  const results: ScreenerResult = {
    matched: [row("AAA", 20)], matched_count: 1, total_scanned: 10,
    rule_name: "r", rule_id: 1,
  };
  render(createElement(ScreenerResultsTable, { results }));
}

describe("ScreenerResultsTable row actions + persist (P2.5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    try { window.localStorage.clear(); } catch { /* ignore */ }
  });

  it("+WL adds symbol to first watchlist", async () => {
    mocks.getWatchlists.mockResolvedValue([{ id: 7, name: "W1" }]);
    mocks.addWatchlistItem.mockResolvedValue({ id: 1 });
    renderTable();
    fireEvent.click(screen.getAllByText("+ WL")[0]);
    await waitFor(() => expect(mocks.addWatchlistItem).toHaveBeenCalledWith("7", "AAA"));
    expect(screen.getByText("screener.rowActions.addedToWatchlist", { exact: false })).toBeTruthy();
  });

  it("+WL with no watchlist shows notice", async () => {
    mocks.getWatchlists.mockResolvedValue([]);
    renderTable();
    fireEvent.click(screen.getAllByText("+ WL")[0]);
    await waitFor(() => expect(screen.getByText("screener.rowActions.noWatchlist", { exact: false })).toBeTruthy());
  });

  it("+Alert opens form and creates price alert", async () => {
    mocks.createPriceAlert.mockResolvedValue({ id: 3 });
    renderTable();
    fireEvent.click(screen.getAllByText("+ Alert")[0]);
    // form appears with price prefilled 20
    const priceInput = document.querySelector('input[type="number"]') as HTMLInputElement;
    expect(priceInput).toBeTruthy();
    expect(priceInput.value).toBe("20");
    fireEvent.click(screen.getByText("screener.rowActions.createAlertSubmit"));
    await waitFor(() => expect(mocks.createPriceAlert).toHaveBeenCalled());
    const payload = mocks.createPriceAlert.mock.calls[0][0];
    expect(payload.symbol).toBe("AAA");
    expect(payload.target_price).toBe(20);
  });

  it("column visibility persists to localStorage", async () => {
    renderTable();
    // open picker
    fireEvent.click(screen.getByText("screener.columnsBtn"));
    const rsiBox = screen.getByLabelText("screener.columns.rsi14") as HTMLInputElement;
    const before = rsiBox.checked;
    fireEvent.click(rsiBox);
    await waitFor(() => {
      const raw = window.localStorage.getItem("vninvest_screener_columns_v1");
      expect(raw).toBeTruthy();
      expect(JSON.parse(raw!).rsi_14).toBe(!before);
    });
  });

  it("sort header has aria-sort and keyboard support", async () => {
    renderTable();
    const headers = document.querySelectorAll('th[aria-sort]');
    expect(headers.length).toBeGreaterThan(0);
    // first header keyboard Enter triggers sort (no throw)
    const first = headers[0] as HTMLElement;
    first.focus();
    fireEvent.keyDown(first, { key: "Enter" });
  });
});
