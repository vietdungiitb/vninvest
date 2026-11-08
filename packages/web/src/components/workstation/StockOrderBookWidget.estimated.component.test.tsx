// W0-2 (D6): order book is synthetic — badge must show estimated when is_mock.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { StockOrderBookWidget } from "./StockOrderBookWidget.jsx";
import * as LangContext from "../../context/LangContext.js";

const i18nValue = {
  locale: "vi",
  localeTag: "vi-VN",
  t: (key, opts) => opts?.defaultValue || key,
  formatNumber: (n) => n,
  formatCurrency: (n) => n,
  formatPriceVND: (n) => n,
  formatQuotePrice: (p) => p,
  formatQuoteVolume: (v) => v,
  formatQuoteInteger: (v) => v,
  formatDate: (d) => d,
  formatTime: (t) => t,
  formatDateTime: (dt) => dt,
};

const mockBook = {
  symbol: "FPT",
  bids: [{ price: 99999.95, volume: 6000 }],
  asks: [{ price: 100000.0, volume: 6000 }],
  spread: 0.05,
  timestamp: new Date().toISOString(),
};

beforeEach(() => {
  vi.spyOn(LangContext, "useI18n").mockReturnValue(i18nValue);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("StockOrderBookWidget estimated badge (D6)", () => {
  it("shows badge when is_mock:true", () => {
    render(
      <StockOrderBookWidget orderBook={{ ...mockBook, is_mock: true }} loading={false} error={null} onRefresh={() => {}} />
    );
    expect(screen.getByText(/Dữ liệu ước tính|workstation\.orderBook\.estimatedBadge/)).toBeTruthy();
  });

  it("hides badge when is_mock:false", () => {
    render(
      <StockOrderBookWidget orderBook={{ ...mockBook, is_mock: false }} loading={false} error={null} onRefresh={() => {}} />
    );
    expect(screen.queryByText(/Dữ liệu ước tính/)).toBeNull();
  });
});
