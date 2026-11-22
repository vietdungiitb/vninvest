/**
 * S1 fail-before — drawer AI config phải portal ra document.body.
 *
 * Root cause: drawer là con trực tiếp của `.sdp-page`, rule
 * `.sdp-page > :not(.sdp-bg-glow)` (0,2,0) đè `position: fixed` (0,1,0) của
 * `.drawerOverlay` → thành relative in-flow, rớt xuống cuối trang.
 * Test ĐỎ trên code cũ (overlay nằm trong .sdp-page), XANH sau portal.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { createElement } from "react";

const mockLoadBlocking = vi.fn();
const mockSetSelectedSession = vi.fn();

let mockModelReturn: any = {};

vi.mock("../../features/stock-detail/hooks/useStockDetailPageModel.js", () => ({
  useStockDetailPageModel: vi.fn(() => mockModelReturn),
}));

vi.mock("../../adapters/coreApiAdapter.js", () => ({
  createCoreApiAdapter: vi.fn(() => ({
    getWatchlists: vi.fn().mockResolvedValue({ results: [] }),
    getWatchlistItems: vi.fn().mockResolvedValue({ results: [] }),
    addWatchlistItem: vi.fn().mockResolvedValue({}),
    removeWatchlistItem: vi.fn().mockResolvedValue({}),
  })),
}));

vi.mock("../../components/workstation/hooks/index.js", () => ({
  useOrderBook: vi.fn(() => ({ orderBook: null, loading: false, error: null, refresh: vi.fn() })),
  useTradeLog: vi.fn(() => ({ trades: [], loading: false, error: null, refresh: vi.fn() })),
}));

vi.mock("../../components/VNStockChartPanel.js", () => ({
  default: () => createElement("div", { "data-testid": "chart-panel" }, "chart"),
}));

vi.mock("../../components/WhaleBubbleChart.jsx", () => ({
  default: () => createElement("div", { "data-testid": "whale-bubble" }, "whale"),
}));

vi.mock("../../context/LangContext.js", () => ({
  useI18n: () => ({
    t: (k: any, opts: any) => opts?.defaultValue ?? k,
    locale: "vi",
  }),
}));

// eslint-disable-next-line import/first
import { StockDetailPage } from "../StockDetailPage.tsx";

function findConfigButton(container: Element): HTMLElement {
  // t() mock trả defaultValue cho title, key cho label → tìm theo label key.
  const btn = Array.from(container.querySelectorAll("button")).find((b) =>
    (b.textContent || "").includes("stockDetail.page.advisoryConfig"),
  );
  if (!btn) throw new Error("config button not found");
  return btn as unknown as HTMLElement;
}

function renderPage() {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: ["/stocks/TPB"] },
      createElement(Routes, null, createElement(Route, { path: "/stocks/:symbol", element: createElement(StockDetailPage) })),
    ),
  );
}

function baseModel(overrides = {}) {
  return {
    activeTimeframe: "1D",
    setActiveTimeframe: vi.fn(),
    setActivePeriod: vi.fn(),
    selectedSession: null,
    setSelectedSession: mockSetSelectedSession,
    setVisibleRange: vi.fn(),
    loadingBlocking: false,
    loadingDeferred: false,
    error: null,
    profile: { company_name: "TPBank" },
    snapshot: { symbol: "TPB", current_price: 18000, reference_price: 17500 },
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
    refreshAdvisoryData: vi.fn(),
    loadBlocking: mockLoadBlocking,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("S1 — drawer AI config portal ra document.body", () => {
  it("mở drawer → overlay là con trực tiếp của body, không nằm trong .sdp-page", async () => {
    mockModelReturn = baseModel({});
    const { container } = renderPage();

    const configBtn = findConfigButton(container);
    expect(configBtn).toBeTruthy();
    fireEvent.click(configBtn!);

    const title = await screen.findByText("promptConfig.title");
    // L-V04: assert parent THẬT, không suy diễn — đi bộ từ title lên body,
    // không được đi qua .sdp-page (đó chính là bug: fixed bị đè thành relative).
    let el: HTMLElement | null = title as unknown as HTMLElement;
    let insidePage = false;
    while (el && el !== document.body) {
      if (el.classList && el.classList.contains("sdp-page")) {
        insidePage = true;
        break;
      }
      el = el.parentElement;
    }
    expect(el).toBe(document.body);
    expect(insidePage).toBe(false);
  });

  it("đóng drawer → overlay biến mất khỏi body", async () => {
    mockModelReturn = baseModel({});
    const { container } = renderPage();

    const configBtn = findConfigButton(container);
    fireEvent.click(configBtn!);
    const title = await screen.findByText("promptConfig.title");
    expect(document.body.contains(title)).toBe(true);

    fireEvent.click(screen.getByText("✕"));
    await waitFor(() => expect(screen.queryByText("promptConfig.title")).toBeNull());
    expect(document.body.textContent).not.toContain("promptConfig.title");
  });
});
