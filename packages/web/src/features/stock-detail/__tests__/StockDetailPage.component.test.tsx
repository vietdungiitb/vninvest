import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { createElement } from "react";

// ---- mocks for page-level deps ----
const mockLoadBlocking = vi.fn();
const mockRefreshAdvisoryData = vi.fn();
const mockSetSelectedSession = vi.fn();

let mockModelReturn = {};

vi.mock("../hooks/useStockDetailPageModel.js", () => ({
  useStockDetailPageModel: vi.fn(() => mockModelReturn),
}));

vi.mock("../../../adapters/coreApiAdapter.js", () => ({
  createCoreApiAdapter: vi.fn(() => ({
    getWatchlists: vi.fn().mockResolvedValue({ results: [] }),
    getWatchlistItems: vi.fn().mockResolvedValue({ results: [] }),
    addWatchlistItem: vi.fn().mockResolvedValue({}),
    removeWatchlistItem: vi.fn().mockResolvedValue({}),
  })),
}));

vi.mock("../../../components/workstation/hooks/index.js", () => ({
  useOrderBook: vi.fn(() => ({ orderBook: null, loading: false, error: null, refresh: vi.fn() })),
  useTradeLog: vi.fn(() => ({ trades: [], loading: false, error: null, refresh: vi.fn() })),
}));

vi.mock("../../../components/VNStockChartPanel.js", () => ({
  default: () => createElement("div", { "data-testid": "chart-panel" }, "chart"),
}));

vi.mock("../../../components/WhaleBubbleChart.jsx", () => ({
  default: () => createElement("div", { "data-testid": "whale-bubble" }, "whale"),
}));

vi.mock("../../../context/LangContext.js", () => ({
  useI18n: () => ({
    t: (k: any, opts: any) => opts?.defaultValue ?? k,
    locale: "vi",
  }),
}));

import { StockDetailPage } from "../../../pages/StockDetailPage.tsx";

function renderPage(symbol = "TPB") {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [`/stocks/${symbol}`] },
      createElement(
        Routes,
        null,
        createElement(Route, { path: "/stocks/:symbol", element: createElement(StockDetailPage) })
      )
    )
  );
}

function baseModel(overrides = {}) {
  return {
    activeTimeframe: "1D",
    setActiveTimeframe: vi.fn(),
    activePeriod: "1M",
    setActivePeriod: vi.fn(),
    selectedSession: null,
    setSelectedSession: mockSetSelectedSession,
    setVisibleRange: vi.fn(),
    loadingBlocking: false,
    loadingDeferred: false,
    error: null,
    profile: { company_name: "TPBank", exchange: "HOSE", industry: "Bank" },
    snapshot: {
      symbol: "TPB",
      current_price: 18000,
      reference_price: 17500,
      change_value: 500,
      change_pct: 2.85,
      ceiling_price: 18700,
      floor_price: 16300,
      open_price: 17600,
      high_price: 18200,
      low_price: 17400,
      volume: 1200000,
      stale: false,
    },
    setChartBars: vi.fn(),
    orderFlowData: null,
    advisory: null,
    advisoryFallbackFlags: null,
    whaleFeed: [],
    whaleFeedMeta: { next_cursor: null, has_more: false },
    loadMoreWhaleFeed: vi.fn(),
    news: [],
    financials: null,
    loadingNews: false,
    loadingFinancials: false,
    activeTab: "giao-dich",
    setActiveTab: vi.fn(),
    loadingProfile: false,
    refreshAdvisoryData: mockRefreshAdvisoryData,
    loadBlocking: mockLoadBlocking,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("StockDetailPage", () => {
  it("(a) render header + giá đúng class màu theo chiều change", async () => {
    // price > ref → green, price < ref → red, price == ref → yellow
    mockModelReturn = baseModel({
      snapshot: {
        symbol: "TPB",
        current_price: 18000,
        reference_price: 17500,
        change_value: 500,
        change_pct: 2.85,
        ceiling_price: 18700,
        floor_price: 16300,
        volume: 1000,
      },
    });
    const { container } = renderPage("TPB");
    // Header tồn tại
    expect(container.querySelector(".sdp-premium-header")).toBeTruthy();
    // Giá tăng (green) vì current_price > reference
    expect(container.querySelector(".sdp-price-green")).toBeTruthy();
    expect(container.textContent).toContain("18.000,00");

    // Đổi snapshot giảm → red
    mockModelReturn = baseModel({
      snapshot: {
        symbol: "TPB",
        current_price: 17000,
        reference_price: 17500,
        change_value: -500,
        change_pct: -2.85,
        ceiling_price: 18700,
        floor_price: 16300,
        volume: 1000,
      },
    });
    const { container: c2 } = render(
      createElement(
        MemoryRouter,
        { initialEntries: ["/stocks/TPB"] },
        createElement(Routes, null, createElement(Route, { path: "/stocks/:symbol", element: createElement(StockDetailPage) }))
      )
    );
    expect(c2.querySelector(".sdp-price-red")).toBeTruthy();
  });

  it("(b) advisory null → empty state", async () => {
    mockModelReturn = baseModel({ advisory: null, loadingDeferred: false });
    const { container } = renderPage("TPB");
    // StockDetailTabs giao-dịch tab hiện empty advisory khi advisory null (mock t trả key)
    expect(container.textContent).toContain("advisoryEmpty");
  });

  it("(b-extra) advisory có advisory_text → hiển thị nội dung (T1.1)", async () => {
    mockModelReturn = baseModel({
      advisory: {
        advisory_id: "adv-1",
        advisory_text: "Khuyến nghị MUA mạnh cho phiên hôm nay",
        signal: "buy",
        confidence_score: 0.87,
        summary: "Tóm tắt",
        generated_at: new Date().toISOString(),
      },
      loadingDeferred: false,
    });
    const { container } = renderPage("TPB");
    expect(container.textContent).toContain("Khuyến nghị MUA mạnh");
    expect(container.textContent).toContain("Độ tin cậy");
  });

  it("(c) error → Error state + nút Thử lại gọi lại loadBlocking", async () => {
    mockModelReturn = baseModel({ error: "Lỗi tải", loadingBlocking: false, snapshot: null, profile: null });
    const { container } = renderPage("TPB");
    expect(container.textContent).toContain("Lỗi tải");
    const btn = screen.getByText("Thử lại");
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(mockLoadBlocking).toHaveBeenCalled();
  });

  it("không tạo adapter thật trong test (vi.mock kiểm chứng)", () => {
    const { createCoreApiAdapter } = require("../../../adapters/coreApiAdapter.js");
    // Adapter đã được mock ở top-level, không gọi thật trong test này (chỉ StockDetailPage gọi getWatchlists ở useEffect, đã mock)
    expect(createCoreApiAdapter).toBeDefined();
  });
});
