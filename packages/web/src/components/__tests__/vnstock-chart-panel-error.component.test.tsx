/**
 * S2 fail-before — panel không nuốt lỗi widget + sửa deadlock mount + phát hiện stall.
 *
 * Root cause kép (đã đo, không đoán):
 *  (1) chartBody cũ chỉ render widget khi internalBars đã có, mà bars chỉ đến từ
 *      onBarsChange của widget → widget không bao giờ mount → 0 HTTP/72h.
 *  (2) staging DB thiếu giá TPB (đã lấp ở S1).
 * Test ĐỎ trên code cũ (stash: widget không mount), XANH sau sửa.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { createElement, forwardRef } from "react";

const h = vi.hoisted(() => ({
  captured: null as any,
  fetchBarsBefore: vi.fn(),
}));

vi.mock("@vninvestcharts/widget", () => ({
  injectVNInvestChartsCSS: () => {},
  VNInvestCharts: forwardRef((props: any, _ref: any) => {
    h.captured = props;
    return createElement("div", { "data-testid": "mock-widget" });
  }),
  VNInvestMultiCharts: () => null,
  widgetMessagesVi: {},
  WidgetErrorBoundary: ({ children }: any) => children,
  WidgetI18nProvider: ({ children }: any) => children,
  WidgetEmptyState: ({ loading, error }: any) =>
    createElement(
      "div",
      { "data-testid": "mock-empty" },
      loading ? "loading" : error ? `error:${error.message}` : "empty",
    ),
  PaperTradePanel: () => null,
  SettingsModal: () => null,
}));

vi.mock("../../context/LangContext.js", () => ({
  useI18n: () => ({ t: (k: string, o: any) => o?.defaultValue ?? k, locale: "vi", localeTag: "vi-VN" }),
}));

vi.mock("../../context/RealtimeContext.js", () => ({
  useRealtimeFeedFromManager: () => ({ quotesBySymbol: {} }),
}));

vi.mock("../../adapters/useTenantTier.js", () => ({
  useTenantTier: () => ({ tier: "free" }),
}));

vi.mock("../../hooks/useTrustTelemetry.js", () => ({
  useTrustTelemetry: () => ({ trackWidgetEvent: vi.fn() }),
}));

vi.mock("../../lib/licenseTrustAnchor.js", () => ({
  ensureLicenseTrustAnchor: () => {},
}));

vi.mock("../../adapters/coreApiAdapter.js", () => ({
  coreApiAdapter: {
    getStockAIAdvisorySession: vi.fn(),
    getIntradayTape: vi.fn(),
  },
}));

vi.mock("../../utils/VNInvestSignalAdapter.js", () => ({
  mapToOHLCVBars: (bars: any) => bars,
  mapToWhaleOrders: () => [],
  mapToCvdSeries: () => [],
  mapTapeTradesToEntries: () => [],
  mapAdvisorySessionToResult: () => null,
}));

vi.mock("../../utils/comparisonOverlayAdapter.js", () => ({
  mapComparisonOverlaysToSymbols: () => [],
}));

vi.mock("../../adapters/chartAdapter.js", () => ({
  createChartStockDataAdapter: () => ({
    label: "mock-adapter",
    fetchBarsInRange: vi.fn(async () => []),
    fetchBarsBefore: (...args: any[]) => h.fetchBarsBefore(...args),
    subscribeToBar: vi.fn(() => () => {}),
    pushRealtimeBar: vi.fn(() => true),
    subscribeToTrades: vi.fn(() => () => {}),
    subscribeToOrderbook: vi.fn(() => () => {}),
    searchSymbols: vi.fn(async () => []),
    getSourceSemantics: () => ({ supportsBackwardAnchor: true }),
  }),
}));

// eslint-disable-next-line import/first
import VNStockChartPanel from "../VNStockChartPanel.js";

function renderPanel() {
  return render(
    createElement(
      MemoryRouter,
      null,
      createElement(VNStockChartPanel, {
        symbol: "TPB",
        env: {},
        activePeriod: "1M",
        activeTimeframe: "1D",
        loading: false,
      } as any),
    ),
  );
}

describe("S2 — panel mount widget + hiện lỗi thật + phát hiện stall", () => {
  beforeEach(() => {
    h.captured = null;
    h.fetchBarsBefore.mockReset();
    h.fetchBarsBefore.mockImplementation(async () => []);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("AC0 — widget mount ngay khi module load (không chờ bars)", async () => {
    renderPanel();
    // Deadlock cũ: mock-widget không bao giờ xuất hiện → đỏ trên code cũ.
    await waitFor(() => expect(screen.getByTestId("mock-widget")).toBeTruthy());
  });

  it("AC1 — zero-call sau grace → copy chẩn đoán riêng (vnsc-no-fetch)", async () => {
    vi.useFakeTimers();
    renderPanel();

    // Flush dynamic import + mount (thay cho waitFor — waitFor kẹt với fake timers).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(screen.getByTestId("mock-widget")).toBeTruthy();
    expect(screen.queryByTestId("vnsc-no-fetch")).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    const el = screen.getByTestId("vnsc-no-fetch");
    expect(el.textContent).toContain("chưa yêu cầu dữ liệu");
    // L-V04: assert adapter THẬT SỰ không bị gọi.
    expect(h.fetchBarsBefore).not.toHaveBeenCalled();
  });

  it("AC2 — widget báo onError → hiện đúng message lỗi (vnsc-widget-error)", async () => {
    renderPanel();

    await waitFor(() => expect(screen.getByTestId("mock-widget")).toBeTruthy());
    await act(async () => {
      h.captured.onError(new Error("boom-fetch"));
    });
    const el = await screen.findByTestId("vnsc-widget-error");
    expect(el.textContent).toContain("boom-fetch");
  });

  it("AC3 — có bars → chart render, không còn banner empty nào", async () => {
    renderPanel();

    await waitFor(() => expect(screen.getByTestId("mock-widget")).toBeTruthy());
    await act(async () => {
      h.captured.onBarsChange([
        { date: new Date("2026-11-20"), open: 1, high: 2, low: 0.5, close: 1.5, volume: 100 },
      ]);
    });
    expect(screen.getByTestId("mock-widget")).toBeTruthy();
    expect(screen.queryByTestId("vnsc-no-fetch")).toBeNull();
    expect(screen.queryByTestId("vnsc-widget-error")).toBeNull();
  });
});
