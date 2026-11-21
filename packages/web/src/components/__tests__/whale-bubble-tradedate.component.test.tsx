/**
 * S1 fail-before — click nến phải đổi bubble chart của phiên đó.
 *
 * Root cause (audit Entry 598): `StockDetailPage` không forward `selectedSession`
 * cho `WhaleBubbleChart`, và `fetchOrders` không gửi `trade_date` dù adapter/BE
 * đã hỗ trợ. Test này ĐỎ trên code chưa sửa, XANH sau khi sửa.
 *
 * Pattern mock sao chép từ `WhaleBubbleChart.component.test.tsx` (echarts stub +
 * adapter mock), để không phụ thuộc canvas của jsdom.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const h = vi.hoisted(() => ({
  getWhaleAnalyticsSnapshot: vi.fn(),
  getStockOrderFlow: vi.fn(),
}));

vi.mock("../../context/LangContext", () => ({
  useI18n: () => ({ t: (key: string) => key, localeTag: "vi-VN" }),
}));

vi.mock("../../adapters/coreApiAdapter.js", () => ({
  createCoreApiAdapter: () => ({
    getWhaleAnalyticsSnapshot: h.getWhaleAnalyticsSnapshot,
    getStockOrderFlow: h.getStockOrderFlow,
  }),
}));

vi.mock("echarts/core", () => ({ use: () => {} }));
vi.mock("echarts/charts", () => ({ LineChart: {}, ScatterChart: {} }));
vi.mock("echarts/components", () => ({
  AxisPointerComponent: {},
  DataZoomComponent: {},
  GraphicComponent: {},
  GridComponent: {},
  MarkLineComponent: {},
  TooltipComponent: {},
}));
vi.mock("echarts/renderers", () => ({ CanvasRenderer: {} }));
vi.mock("echarts-for-react/lib/core", () => ({
  default: () => <div data-testid="echarts-stub" />,
}));

// eslint-disable-next-line import/first
import WhaleBubbleChart from "../WhaleBubbleChart.jsx";

/** Chỉ `summary.whale_order_count` mới mở cổng `hasAnyChartData`. */
function snapshot() {
  return {
    data: {
      symbol: "TPB",
      summary: { whale_order_count: 2, extreme_order_count: 1 },
      session_levels: { reference_price: 18000 },
      price_series: [{ bucket_ts: "2026-11-20T09:30:00+07:00", price: 18000 }],
      bubble_series: [
        { ts: "2026-11-20T09:31:00+07:00", side: "buy", price: 18000, volume: 1000, matched_value: 18_000_000 },
      ],
    },
  };
}

function renderChart(extraProps = {}) {
  return render(
    <MemoryRouter initialEntries={["/stocks/TPB"]}>
      <WhaleBubbleChart selectedSymbol="TPB" symbolOptions={["TPB"]} {...extraProps} />
    </MemoryRouter>,
  );
}

describe("S1 — WhaleBubbleChart theo phiên được chọn (tradeDate)", () => {
  beforeEach(() => {
    h.getWhaleAnalyticsSnapshot.mockReset();
    h.getStockOrderFlow.mockReset();
    h.getWhaleAnalyticsSnapshot.mockResolvedValue(snapshot());
    h.getStockOrderFlow.mockResolvedValue({ data: { signals: [] } });
  });

  afterEach(() => cleanup());

  it("AC1 — không có tradeDate: fetch KHÔNG gửi tradeDate (giữ hành vi hôm nay)", async () => {
    renderChart();

    await waitFor(() => expect(h.getWhaleAnalyticsSnapshot).toHaveBeenCalled());
    const args = h.getWhaleAnalyticsSnapshot.mock.calls[0];
    expect(args[0]).toBe("TPB");
    // L-V04: assert key thật sự vắng mặt, không chỉ "falsy".
    expect(args[1]).not.toHaveProperty("tradeDate");
  });

  it("AC2 — có tradeDate: fetch gửi đúng trade_date của phiên được click", async () => {
    const { rerender } = renderChart({ tradeDate: "2026-11-20" });

    await waitFor(() =>
      expect(h.getWhaleAnalyticsSnapshot).toHaveBeenCalledWith(
        "TPB",
        expect.objectContaining({ tradeDate: "2026-11-20" }),
      ),
    );

    // Đổi ngày → refetch với ngày mới (không kẹt ở ngày cũ).
    h.getWhaleAnalyticsSnapshot.mockClear();
    rerender(
      <MemoryRouter initialEntries={["/stocks/TPB"]}>
        <WhaleBubbleChart selectedSymbol="TPB" symbolOptions={["TPB"]} tradeDate="2026-11-19" />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(h.getWhaleAnalyticsSnapshot).toHaveBeenCalledWith(
        "TPB",
        expect.objectContaining({ tradeDate: "2026-11-19" }),
      ),
    );
  });

  it("AC2b — header nêu đúng phiên đang xem (20/11/2026)", async () => {
    renderChart({ tradeDate: "2026-11-20" });

    await waitFor(() => expect(h.getWhaleAnalyticsSnapshot).toHaveBeenCalled());
    expect(screen.getByTestId("whale-bubble-session").textContent).toContain("20/11/2026");
  });

  it("AC3 — tradeDate của phiên rỗng: empty-state nêu ngày, không phải copy chung chung", async () => {
    h.getWhaleAnalyticsSnapshot.mockResolvedValue({
      data: { symbol: "TPB", summary: { whale_order_count: 0 }, price_series: [], bubble_series: [] },
    });
    renderChart({ tradeDate: "2026-11-19" });

    await waitFor(() => expect(h.getWhaleAnalyticsSnapshot).toHaveBeenCalled());
    expect(screen.getByTestId("whale-bubble-empty").textContent).toContain("19/11/2026");
  });
});
