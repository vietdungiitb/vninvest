import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

// ---- mocks ----
const mockGetStockOverview = vi.fn();
const mockGetStockOrderFlow = vi.fn();
const mockGetSessionFactsCvd = vi.fn();
const mockGetWhaleAnalyticsSnapshot = vi.fn();
const mockGetWhaleFeedAggregate = vi.fn();
const mockGetAdvisoryLatest = vi.fn();
const mockRefreshAdvisory = vi.fn();
const mockGetStockProfile = vi.fn();
const mockGetStockNews = vi.fn();
const mockGetStockFinancials = vi.fn();

vi.mock("../../../adapters/coreApiAdapter.js", () => ({
  createCoreApiAdapter: vi.fn(() => ({
    getStockOverview: (...args) => mockGetStockOverview(...args),
    getStockOrderFlow: (...args) => mockGetStockOrderFlow(...args),
    getSessionFactsCvd: (...args) => mockGetSessionFactsCvd(...args),
    getWhaleAnalyticsSnapshot: (...args) => mockGetWhaleAnalyticsSnapshot(...args),
    getWhaleFeedAggregate: (...args) => mockGetWhaleFeedAggregate(...args),
    getAdvisoryLatest: (...args) => mockGetAdvisoryLatest(...args),
    refreshAdvisory: (...args) => mockRefreshAdvisory(...args),
    getStockProfile: (...args) => mockGetStockProfile(...args),
    getStockNews: (...args) => mockGetStockNews(...args),
    getStockFinancials: (...args) => mockGetStockFinancials(...args),
  })),
}));

vi.mock("../../../context/RealtimeContext.js", () => ({
  useRealtimeFeedFromManager: vi.fn(() => ({ quotesBySymbol: {} })),
}));

import { useStockDetailPageModel } from "../hooks/useStockDetailPageModel.js";

function setupMocks() {
  mockGetStockOverview.mockResolvedValue({ symbol: "TPB", price: 18000 });
  mockGetStockOrderFlow.mockResolvedValue({ symbol: "TPB", window: "1h", cvd_series: [], dark_flow: { strength: 5 } });
  mockGetSessionFactsCvd.mockResolvedValue({ symbol: "TPB", window: "1h", cvd_series: [{ bucket_ts: "2026-05-27T09:00:00+07:00", cumulative_cvd: 400 }] });
  mockGetWhaleAnalyticsSnapshot.mockResolvedValue({ symbol: "TPB", flow_series: { cvd: [] } });
  mockGetWhaleFeedAggregate.mockResolvedValue({ results: [{ ts: "2026-08-06T09:00:00+07:00", matched_value: 1000000000, side: "buy", volume: 1000 }], next_cursor: null, has_more: false });
  mockGetAdvisoryLatest.mockResolvedValue(null);
  mockRefreshAdvisory.mockResolvedValue({ task_id: "task-1" });
  mockGetStockProfile.mockResolvedValue({ symbol: "TPB", overview: {} });
  mockGetStockNews.mockResolvedValue({ results: [] });
  mockGetStockFinancials.mockResolvedValue({ income_statement: [], balance_sheet: [] });
}

describe("useStockDetailPageModel", () => {
  const stableEnv = {};
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it("(a) mount → blocking lane gọi đủ 4 endpoint, loadingBlocking=false", async () => {
    const { result } = renderHook(() => useStockDetailPageModel({ env: stableEnv, initialSymbol: "TPB" }));
    await waitFor(() => expect(result.current.loadingBlocking).toBe(false));
    expect(mockGetStockOverview).toHaveBeenCalledWith("TPB");
    expect(mockGetStockOrderFlow).toHaveBeenCalledWith("TPB", { window: "1h" });
    expect(mockGetSessionFactsCvd).toHaveBeenCalled();
    expect(mockGetWhaleAnalyticsSnapshot).toHaveBeenCalled();
    expect(result.current.snapshot).toBeTruthy();
    expect(result.current.orderFlowData).toBeTruthy();
  });

  it("(b) getSessionFactsCvd 404 → orderFlowData vẫn build từ fallback, không throw", async () => {
    // Gây 404 bằng cách mock reject, nhưng Promise.allSettled trong hook sẽ catch
    // Adapter thực tế catch 404→null, nhưng vẫn test hook không throw khi sessionFacts fail
    mockGetSessionFactsCvd.mockRejectedValue({ status: 404, message: "Not found" });
    mockGetWhaleAnalyticsSnapshot.mockResolvedValue({
      symbol: "TPB",
      flow_series: { cvd: [{ bucket_ts: "2026-05-27T09:00:00+07:00", value: 1200 }] },
      materialization: { read_path: "canonical_fallback" },
    });
    const { result } = renderHook(() => useStockDetailPageModel({ env: stableEnv, initialSymbol: "TPB" }));
    await waitFor(() => expect(result.current.loadingBlocking).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.orderFlowData).toBeTruthy();
    // _cvd_source phải là fallback khi sessionFacts empty
    expect(result.current.orderFlowData._cvd_source).toBe("whale-analytics-fallback");
  });

  it("(c) deferred lane mount → getAdvisoryLatest được gọi + advisory set", async () => {
    const advisoryPayload = {
      advisory_id: "adv-1",
      symbol: "TPB",
      advisory_text: "Khuyến nghị mua",
      structured_output: { signal: "buy", confidence_score: 0.87 },
      generated_at: new Date().toISOString(),
    };
    mockGetAdvisoryLatest.mockResolvedValue(advisoryPayload);
    const { result } = renderHook(() => useStockDetailPageModel({ env: stableEnv, initialSymbol: "TPB" }));
    await waitFor(() => expect(result.current.loadingDeferred).toBe(false));
    expect(mockGetAdvisoryLatest).toHaveBeenCalledWith("TPB");
    expect(result.current.advisory).toEqual(advisoryPayload);
    expect(result.current.whaleFeed.length).toBeGreaterThan(0);
    // time/price đã chuẩn hoá (normalizeWhaleFeedItem)
    expect(result.current.whaleFeed[0].time).toBeTruthy();
    expect(result.current.whaleFeed[0].price).toBeTruthy();
  });

  it("(d) refreshAdvisory timeout → advisory = record mới nhất (poll success khi generated_at mới)", async () => {
    const futureTime = new Date(Date.now() + 60000).toISOString();
    const newPayload = {
      advisory_id: "adv-new",
      symbol: "TPB",
      advisory_text: "Latest after refresh",
      generated_at: futureTime,
    };
    mockGetAdvisoryLatest.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useStockDetailPageModel({ env: stableEnv, initialSymbol: "TPB" }));
    await waitFor(() => expect(result.current.loadingDeferred).toBe(false));
    expect(result.current.advisory).toBeNull();

    mockRefreshAdvisory.mockResolvedValue({ task_id: "task-123" });
    mockGetAdvisoryLatest.mockReset();
    // genTime > startTime → polling thành công ngay lần đầu, không cần chờ timeout 30s
    mockGetAdvisoryLatest.mockResolvedValue(newPayload);

    const originalSetTimeout = global.setTimeout;
    global.setTimeout = (cb, ms, ...args) => {
      if (Number(ms) === 2000) {
        Promise.resolve().then(() => cb(...args));
        return 1;
      }
      return originalSetTimeout(cb, ms, ...args);
    };

    await act(async () => {
      result.current.refreshAdvisoryData({});
      for (let i = 0; i < 5; i++) {
        await Promise.resolve();
        await new Promise((r) => originalSetTimeout(r, 0));
      }
    });
    await waitFor(() => expect(result.current.loadingDeferred).toBe(false), { timeout: 3000 });
    expect(result.current.advisory).toEqual(newPayload);
    global.setTimeout = originalSetTimeout;
  });

  it("(d-timeout) refreshAdvisory hết maxAttempts vẫn set advisory mới nhất (bất kể generated_at)", async () => {
    // Giai đoạn timeout: genTime cũ hơn startTime → polling không success, sau 15 lần sẽ vào nhánh timeout fetch latest
    const oldTime = new Date(Date.now() - 60000).toISOString();
    const timeoutPayload = {
      advisory_id: "adv-timeout",
      symbol: "TPB",
      advisory_text: "Timeout fallback advisory",
      generated_at: oldTime,
    };
    mockGetAdvisoryLatest.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useStockDetailPageModel({ env: stableEnv, initialSymbol: "TPB" }));
    await waitFor(() => expect(result.current.loadingDeferred).toBe(false));

    mockRefreshAdvisory.mockResolvedValue({ task_id: "task-123" });
    mockGetAdvisoryLatest.mockReset();
    // Mọi lần polling đều trả oldTime (genTime < startTime) → không success
    mockGetAdvisoryLatest.mockResolvedValue(timeoutPayload);

    const originalSetTimeout = global.setTimeout;
    global.setTimeout = (cb, ms, ...args) => {
      if (Number(ms) === 2000) {
        Promise.resolve().then(() => cb(...args));
        return 1;
      }
      return originalSetTimeout(cb, ms, ...args);
    };

    await act(async () => {
      result.current.refreshAdvisoryData({});
      // 15 poll + 1 timeout fetch
      for (let i = 0; i < 30; i++) {
        await Promise.resolve();
        await new Promise((r) => originalSetTimeout(r, 0));
      }
    });
    await waitFor(() => expect(result.current.loadingDeferred).toBe(false), { timeout: 3000 });
    // Timeout branch fetch latest bất kể genTime → advisory vẫn được set
    expect(result.current.advisory).toEqual(timeoutPayload);
    global.setTimeout = originalSetTimeout;
  });

  it("(e) selectedSession thay đổi → session_date trong payload getWhaleFeedAggregate", async () => {
    const { result } = renderHook(() => useStockDetailPageModel({ env: stableEnv, initialSymbol: "TPB" }));
    await waitFor(() => expect(result.current.loadingDeferred).toBe(false));
    expect(mockGetWhaleFeedAggregate).toHaveBeenCalled();
    // Lần đầu không có session_date
    expect(mockGetWhaleFeedAggregate.mock.calls[0][1]).not.toHaveProperty("session_date");

    mockGetWhaleFeedAggregate.mockClear();
    mockGetAdvisoryLatest.mockClear();

    const session = { tradeDate: "2026-08-01" };
    await act(async () => {
      result.current.setSelectedSession(session);
    });
    await waitFor(() => expect(mockGetWhaleFeedAggregate).toHaveBeenCalled());
    const lastCall = mockGetWhaleFeedAggregate.mock.calls[mockGetWhaleFeedAggregate.mock.calls.length - 1];
    expect(lastCall[0]).toBe("TPB");
    expect(lastCall[1]).toMatchObject({ session_date: "2026-08-01", limit: 50 });
    // advisory cũng được refetch khi đổi session (Promise.all trong deferred lane)
    expect(mockGetAdvisoryLatest).toHaveBeenCalledWith("TPB");
  });

  it("pagination: loadMoreWhaleFeed với cursor → append và update meta", async () => {
    mockGetWhaleFeedAggregate.mockResolvedValueOnce({
      results: [{ ts: "2026-08-06T09:00:00+07:00", matched_value: 1000000000, side: "buy", volume: 500 }],
      next_cursor: "cursor-1",
      has_more: true,
    });
    const { result } = renderHook(() => useStockDetailPageModel({ env: stableEnv, initialSymbol: "TPB" }));
    await waitFor(() => expect(result.current.whaleFeedMeta.has_more).toBe(true));
    expect(result.current.whaleFeed).toHaveLength(1);

    mockGetWhaleFeedAggregate.mockResolvedValueOnce({
      results: [{ ts: "2026-08-06T10:00:00+07:00", matched_value: 2000000000, side: "sell", volume: 800 }],
      next_cursor: null,
      has_more: false,
    });
    await act(async () => {
      await result.current.loadMoreWhaleFeed();
    });
    expect(result.current.whaleFeed).toHaveLength(2);
    expect(result.current.whaleFeed[1].price).toBe(2000000000);
    expect(result.current.whaleFeedMeta.has_more).toBe(false);
  });
});

