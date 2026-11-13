// S2.1 (D1b): order book that khong co nguon that — badge hien khi
// data_quality === 'unavailable' (uu tien), giu is_mock lam fallback.
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
  it("shows unavailable badge and no spread for empty honest book", () => {
    const { container } = render(
      <StockOrderBookWidget orderBook={{ ...mockBook, bids: [], asks: [], spread: null, data_quality: "unavailable" }} loading={false} error={null} onRefresh={() => {}} />
    );
    // Badge hien (khong assert chuoi VI cung de khoi tang baseline i18n).
    expect(container.querySelector(".ob-estimated-badge")).toBeTruthy();
    // Spread null => khong render dong spread (khong bia "0.00").
    expect(container.querySelector(".ob-spread")).toBeNull();
    // Khong con nhan hieu mock cu.
    expect(container.textContent).not.toMatch(/is_mock|synthetic/);
  });

  it("shows badge when is_mock:true (fallback)", () => {
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
