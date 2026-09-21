import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { AlertCenterPage } from "./AlertCenterPage.js";

const dataState = vi.hoisted(() => ({ current: null as any }));
const streamState = vi.hoisted(() => ({ items: [] as any[], status: "open", onItem: null as any }));
const adapterMocks = vi.hoisted(() => ({
  getAlertCenterEventDetail: vi.fn(),
  getAlertCenterSymbolContext: vi.fn(),
  acknowledgeAlertCenterEvent: vi.fn(),
  muteAlertCenterPreference: vi.fn().mockResolvedValue({}),
  getAlertCenterFeed: vi.fn(),
  getAIAlertsFeed: vi.fn(),
}));

vi.mock("../hooks/useAlertCenterData.js", () => ({
  useAlertCenterData: () => dataState.current(),
}));

vi.mock("../hooks/useAlertCenterStream.js", () => ({
  useAlertCenterStream: ({ onItem }: any) => {
    streamState.onItem = onItem;
    return { status: streamState.status, reconnectAttempt: 0 };
  },
}));

vi.mock("../adapters/coreApiAdapter.js", () => ({
  coreApiAdapter: {
    getAlertCenterEventDetail: adapterMocks.getAlertCenterEventDetail,
    getAlertCenterSymbolContext: adapterMocks.getAlertCenterSymbolContext,
    acknowledgeAlertCenterEvent: adapterMocks.acknowledgeAlertCenterEvent,
    muteAlertCenterPreference: adapterMocks.muteAlertCenterPreference,
    getAlertCenterFeed: adapterMocks.getAlertCenterFeed,
    getAIAlertsFeed: adapterMocks.getAIAlertsFeed,
  },
  defaultCoreApiAdapter: {
    getAlertCenterEventDetail: adapterMocks.getAlertCenterEventDetail,
    getAlertCenterSymbolContext: adapterMocks.getAlertCenterSymbolContext,
    acknowledgeAlertCenterEvent: adapterMocks.acknowledgeAlertCenterEvent,
    muteAlertCenterPreference: adapterMocks.muteAlertCenterPreference,
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
    streamState.items = [];
    streamState.status = "open";
    vi.clearAllMocks();
  });

  afterEach(() => cleanup());

  it("1. loading → skeleton, khong empty", () => {
    dataState.current = () => baseData({ isInitialLoading: true });
    const { container } = render(<AlertCenterPage />);
    expect(screen.queryByText("alertCenter.emptyNoScope")).toBeNull();
    expect(screen.queryByText("alertCenter.emptyNoMatch")).toBeNull();
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

  it("3. empty → text alertCenter.emptyNoScope (S2, khong loc)", () => {
    dataState.current = () => baseData({});
    render(<AlertCenterPage />);
    expect(screen.getByText("alertCenter.emptyNoScope")).toBeTruthy();
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

  it("5. pagination stats giu trang 2 (A2 regression, 20/trang)", async () => {
    const sym = (i: number) => `A${String(i).padStart(2, "0")}`;
    dataState.current = () =>
      baseData({
        symbolStats: {
          symbols: Array.from({ length: 24 }, (_, i) => statsRow(sym(i), i)),
          total_alerts_in_scope: 24,
          pagination: { page: 1, page_size: 200, total_pages: 1, total_symbols: 24 },
        },
      });
    render(<AlertCenterPage />);
    expect(screen.getByText("A00")).toBeTruthy();
    expect(screen.queryByText("A20")).toBeNull();
    // header hien tong scope, khong phai do dai trang
    expect(screen.getByText("alertCenter.statsTotal")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "›" }));
    await waitFor(() => expect(screen.getByText("A20")).toBeTruthy(), { timeout: 700 });
    expect(screen.queryByText("A00")).toBeNull();
    await new Promise((r) => setTimeout(r, 700));
    expect(screen.getByText("A20")).toBeTruthy();
    expect(screen.queryByText("A00")).toBeNull();
  });

  it("6. S7 SSE vao buffer + pill, bam moi merge (S3.4)", async () => {
    const { act } = await import("@testing-library/react");
    dataState.current = () =>
      baseData({
        payload: {
          results: [alertFixture("AAA", "2026-09-18T01:00:00Z"), alertFixture("BBB", "2026-09-18T02:00:00Z")],
          next: null,
          previous: null,
        },
      });
    render(<AlertCenterPage />);
    const future = new Date(Date.now() + 3600_000).toISOString();
    await act(async () => {
      streamState.onItem({
        alert_id: "sse-1", symbol: "SSE1", title: "Sse one", severity: "high",
        triggered_at: future, freshness_state: "fresh", alert_family: "whale",
        body: "Body", value: 5000, direction: "buy", confidence: 0.9, evidence: {},
      });
      // trùng alert_id REST → không duplicate (ngay cả trong buffer)
      streamState.onItem({
        alert_id: "id-AAA", symbol: "AAA", title: "Dup", severity: "high",
        triggered_at: future, freshness_state: "fresh", alert_family: "whale",
        body: "Body", value: 1, direction: "buy", confidence: 0.9, evidence: {},
      });
    });
    // chua merge: list giu nguyen, hien pill
    expect(screen.queryByText("Sse one")).toBeNull();
    expect(screen.getByRole("button", { name: "alertCenter.newAlerts" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "alertCenter.newAlerts" }));
    const html = document.body.innerHTML;
    expect(html.indexOf("Sse one")).toBeGreaterThan(-1);
    // SSE mới nhất (future) sort lên trước
    expect(html.indexOf("Sse one")).toBeLessThan(html.indexOf("Title BBB"));
    expect(screen.queryByText("Dup")).toBeNull();
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

  it("8. S1 poll nen khong unmount list (khong skeleton)", () => {
    dataState.current = () =>
      baseData({
        isInitialLoading: false,
        isBackgroundFetching: true,
        payload: {
          results: [alertFixture("AAA", "2026-09-18T01:00:00Z")],
          next: null,
          previous: null,
        },
      });
    const { container } = render(<AlertCenterPage />);
    expect(screen.getByText("Title AAA")).toBeTruthy();
    expect(container.querySelector('[style*="shellShimmer"]')).toBeNull();
  });

  it("9. S1 feedError + rong → hop loi + retry", async () => {
    const refetch = vi.fn().mockResolvedValue([]);
    dataState.current = () =>
      baseData({ isInitialLoading: false, feedError: "feed boom", refetch });
    render(<AlertCenterPage />);
    expect(screen.getByText("feed boom")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "alertCenter.retry" }));
    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
  });

  it("10. S1 feedError + co data → banner inline, list van hien", () => {
    dataState.current = () =>
      baseData({
        isInitialLoading: false,
        feedError: "feed boom",
        payload: {
          results: [alertFixture("AAA", "2026-09-18T01:00:00Z")],
          next: null,
          previous: null,
        },
      });
    render(<AlertCenterPage />);
    expect(screen.getByText("Title AAA")).toBeTruthy();
    expect(screen.getByText("feed boom")).toBeTruthy();
  });

  it("11. S2 NO_SCOPE khi tong 0 + khong loc", () => {
    dataState.current = () => baseData({});
    render(<AlertCenterPage />);
    expect(screen.getByText("alertCenter.emptyNoScope")).toBeTruthy();
  });

  it("12. S7 SSE badge live theo stream status", () => {
    streamState.status = "connecting";
    dataState.current = () => baseData({});
    render(<AlertCenterPage />);
    expect(screen.getByText("alertCenter.livePolling")).toBeTruthy();
  });

  it("13. S2 NO_MATCH khi co loc tren URL", () => {
    window.history.replaceState(null, "", "/?severity=high");
    dataState.current = () => baseData({});
    render(<AlertCenterPage />);
    expect(screen.getByText("alertCenter.emptyNoMatch")).toBeTruthy();
    window.history.replaceState(null, "", "/");
  });

  it("14. S3 ack hien ca lane ai", () => {
    window.history.replaceState(null, "", "/?lane=ai");
    dataState.current = () =>
      baseData({
        payload: {
          results: [alertFixture("AAA", "2026-09-18T01:00:00Z")],
          next: null,
          previous: null,
        },
      });
    render(<AlertCenterPage />);
    expect(screen.getByRole("button", { name: "alertCenter.btnAck" })).toBeTruthy();
    window.history.replaceState(null, "", "/");
  });

  it("15. S3 mute modal gui duration + reason", async () => {
    dataState.current = () =>
      baseData({
        payload: {
          results: [alertFixture("AAA", "2026-09-18T01:00:00Z")],
          next: null,
          previous: null,
        },
      });
    render(<AlertCenterPage />);
    fireEvent.click(screen.getByRole("button", { name: "alertCenter.btnMute" }));
    expect(screen.getByText(/alertCenter.muteTitle/)).toBeTruthy();
    const reason = document.querySelector('input[maxlength="200"]') as HTMLInputElement;
    fireEvent.change(reason, { target: { value: "on-nghe" } });
    fireEvent.click(screen.getByRole("button", { name: "alertCenter.muteConfirm" }));
    await waitFor(() =>
      expect(adapterMocks.muteAlertCenterPreference).toHaveBeenCalledWith(
        expect.objectContaining({ symbol: "AAA", mute_minutes: 30, metadata: { reason: "on-nghe" } })
      )
    );
  });

  it("16. mark-all-read batch ack + refetch", async () => {
    const refetch = vi.fn().mockResolvedValue([]);
    dataState.current = () =>
      baseData({
        refetch,
        payload: {
          results: [
            alertFixture("AAA", "2026-09-18T01:00:00Z"),
            alertFixture("BBB", "2026-09-18T02:00:00Z"),
          ],
          next: null,
          previous: null,
        },
      });
    render(<AlertCenterPage />);
    fireEvent.click(screen.getByRole("button", { name: "alertCenter.markAllRead" }));
    await waitFor(() => expect(adapterMocks.acknowledgeAlertCenterEvent).toHaveBeenCalledTimes(2));
    expect(adapterMocks.acknowledgeAlertCenterEvent).toHaveBeenCalledWith(
      "id-AAA", expect.objectContaining({ lane: "main" })
    );
    await waitFor(() => expect(refetch).toHaveBeenCalled());
  });

  it("17. stale banner khi alert moi nhat qua 60 phut", () => {
    const old = new Date(Date.now() - 2 * 3600_000).toISOString();
    dataState.current = () =>
      baseData({
        payload: { results: [alertFixture("AAA", old)], next: null, previous: null },
      });
    render(<AlertCenterPage />);
    expect(screen.getByText("alertCenter.staleBanner")).toBeTruthy();
  });

  it("15. S3 mute modal gui duration + reason", async () => {
    dataState.current = () =>
      baseData({
        payload: {
          results: [alertFixture("AAA", "2026-09-18T01:00:00Z")],
          next: null,
          previous: null,
        },
      });
    render(<AlertCenterPage />);
    fireEvent.click(screen.getByRole("button", { name: "alertCenter.btnMute" }));
    expect(screen.getByText(/alertCenter.muteTitle/)).toBeTruthy();
    const reason = document.querySelector('input[maxlength="200"]') as HTMLInputElement;
    fireEvent.change(reason, { target: { value: "on-nghe" } });
    fireEvent.click(screen.getByRole("button", { name: "alertCenter.muteConfirm" }));
    await waitFor(() =>
      expect(adapterMocks.muteAlertCenterPreference).toHaveBeenCalledWith(
        expect.objectContaining({ symbol: "AAA", mute_minutes: 30, metadata: { reason: "on-nghe" } })
      )
    );
  });
});
