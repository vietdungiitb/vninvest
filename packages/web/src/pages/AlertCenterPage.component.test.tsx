import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { AlertCenterPage } from "./AlertCenterPage.js";

const dataState = vi.hoisted(() => ({ current: null as any }));
const realtimeState = vi.hoisted(() => ({ alerts: [] as any[], status: "live" }));
const adapterMocks = vi.hoisted(() => ({
  getAlertCenterEventDetail: vi.fn(),
  getAlertCenterSymbolContext: vi.fn(),
  acknowledgeAlertCenterEvent: vi.fn(),
  getAlertCenterFeed: vi.fn(),
  getAIAlertsFeed: vi.fn(),
}));

vi.mock("../hooks/useAlertCenterData.js", () => ({
  useAlertCenterData: () => dataState.current(),
}));

vi.mock("../hooks/useAlertCenterRealtime.js", () => ({
  useAlertCenterRealtime: () => ({
    realtimeAlerts: realtimeState.alerts,
    realtimeStatus: realtimeState.status,
  }),
}));

vi.mock("../adapters/coreApiAdapter.js", () => ({
  coreApiAdapter: {
    getAlertCenterEventDetail: adapterMocks.getAlertCenterEventDetail,
    getAlertCenterSymbolContext: adapterMocks.getAlertCenterSymbolContext,
    acknowledgeAlertCenterEvent: adapterMocks.acknowledgeAlertCenterEvent,
    getAlertCenterFeed: adapterMocks.getAlertCenterFeed,
    getAIAlertsFeed: adapterMocks.getAIAlertsFeed,
  },
  defaultCoreApiAdapter: {
    getAlertCenterEventDetail: adapterMocks.getAlertCenterEventDetail,
    getAlertCenterSymbolContext: adapterMocks.getAlertCenterSymbolContext,
    acknowledgeAlertCenterEvent: adapterMocks.acknowledgeAlertCenterEvent,
    getAlertCenterFeed: adapterMocks.getAlertCenterFeed,
    getAIAlertsFeed: adapterMocks.getAIAlertsFeed,
  },
}));

function baseData(over: any = {}) {
  return {
    loading: false,
    error: "",
    payload: { results: [], next: null, previous: null },
    summary: { total: 0, unseen: 0, by_severity: { critical: 0, high: 0, medium: 0, low: 0 } },
    symbolStats: { symbols: [], total_alerts_in_scope: 0, pagination: { page: 1, page_size: 200, total_pages: 1, total_symbols: 0 } },
    refetch: vi.fn(),
    ...over,
  };
}

function alertFixture(sym: string, iso: string, id?: string) {
  return {
    alert_id: id ?? `id-${sym}`,
    symbol: sym,
    severity: "high",
    title: `Title ${sym}`,
    body: `Body ${sym}`,
    triggered_at: iso,
    value: 1000,
    direction: "buy",
    freshness_state: "fresh",
    session_date: "2026-09-18",
    alert_type: "whale",
    confidence: 0.9,
    evidence: {},
  };
}

function statsRow(sym: string, i: number) {
  return {
    symbol: sym,
    count: 1,
    buy_count: 1,
    sell_count: 0,
    neutral_count: 0,
    total_value: 100,
    by_severity: { critical: 0, high: 1, medium: 0, low: 0 },
    latest_triggered_at: new Date(Date.now() - i * 1000).toISOString(),
  };
}

describe("AlertCenterPage (C5 + A2 pagination)", () => {
  beforeEach(() => {
    realtimeState.alerts = [];
    realtimeState.status = "live";
    vi.clearAllMocks();
  });

  afterEach(() => cleanup());

  it("1. loading → skeleton, khong empty", () => {
    dataState.current = () => baseData({ loading: true });
    const { container } = render(<AlertCenterPage />);
    expect(screen.queryByText("alertCenter.empty")).toBeNull();
    expect(container.querySelector('[style*="shellShimmer"]')).toBeTruthy();
  });

  it("2. error → banner + nut refresh goi refetch", async () => {
    const refetch = vi.fn();
    dataState.current = () => baseData({ error: "boom", refetch });
    render(<AlertCenterPage />);
    expect(screen.getByRole("alert").textContent).toContain("boom");
    fireEvent.click(screen.getByRole("button", { name: "alertCenter.refresh" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("3. empty → text alertCenter.empty", () => {
    dataState.current = () => baseData({});
    render(<AlertCenterPage />);
    expect(screen.getByText("alertCenter.empty")).toBeTruthy();
  });

  it("4. feed 3 items → 3 cards, newest-first", () => {
    dataState.current = () =>
      baseData({
        payload: {
          results: [
            alertFixture("AAA", "2026-09-18T01:00:00Z"),
            alertFixture("CCC", "2026-09-18T03:00:00Z"),
            alertFixture("BBB", "2026-09-18T02:00:00Z"),
          ],
          next: null,
          previous: null,
        },
      });
    render(<AlertCenterPage />);
    const html = document.body.innerHTML;
    expect(html.indexOf("CCC")).toBeGreaterThan(-1);
    expect(html.indexOf("CCC")).toBeLessThan(html.indexOf("BBB"));
    expect(html.indexOf("BBB")).toBeLessThan(html.indexOf("AAA"));
  });

  it("5. pagination stats giu trang 2 (A2 regression)", async () => {
    dataState.current = () =>
      baseData({
        symbolStats: {
          symbols: Array.from({ length: 16 }, (_, i) => statsRow(`S${i}`, i)),
          total_alerts_in_scope: 16,
          pagination: { page: 1, page_size: 200, total_pages: 1, total_symbols: 16 },
        },
      });
    render(<AlertCenterPage />);
    expect(screen.getByText("S0")).toBeTruthy();
    expect(screen.queryByText("S8")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "›" }));
    await waitFor(() => expect(screen.getByText("S8")).toBeTruthy(), { timeout: 700 });
    expect(screen.queryByText("S0")).toBeNull();
    await new Promise((r) => setTimeout(r, 700));
    expect(screen.getByText("S8")).toBeTruthy();
    expect(screen.queryByText("S0")).toBeNull();
  });

  it("6. WS realtime merge len TOP feed", () => {
    const future = new Date(Date.now() + 3600_000).toISOString();
    realtimeState.alerts = [{ alert_id: "live-1", symbol: "LIVE1", title: "Live", severity: "high", triggered_at: future, freshness_state: "fresh", alert_type: "whale", evidence: {} }];
    dataState.current = () =>
      baseData({
        payload: {
          results: [alertFixture("AAA", "2026-09-18T01:00:00Z"), alertFixture("BBB", "2026-09-18T02:00:00Z")],
          next: null,
          previous: null,
        },
      });
    render(<AlertCenterPage />);
    const html = document.body.innerHTML;
    expect(html.indexOf("LIVE1")).toBeGreaterThan(-1);
    expect(html.indexOf("LIVE1")).toBeLessThan(html.indexOf("AAA"));
  });

  it("7. load-more append extra + cursor (C3)", async () => {
    adapterMocks.getAlertCenterFeed.mockResolvedValue({
      results: [alertFixture("EXTRA", "2026-09-18T04:00:00Z")],
      next: null,
      previous: null,
    });
    dataState.current = () =>
      baseData({
        payload: {
          results: [alertFixture("AAA", "2026-09-18T01:00:00Z")],
          next: "http://testserver/core/v1/signals/alert-center/feed?cursor=abc",
          previous: null,
        },
      });
    render(<AlertCenterPage />);
    expect(screen.queryByText("EXTRA")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "alertCenter.loadMore" }));
    await waitFor(() => expect(adapterMocks.getAlertCenterFeed).toHaveBeenCalled());
    expect(adapterMocks.getAlertCenterFeed).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: "abc" })
    );
    await waitFor(() => expect(screen.getByText("EXTRA")).toBeTruthy());
  });
});
