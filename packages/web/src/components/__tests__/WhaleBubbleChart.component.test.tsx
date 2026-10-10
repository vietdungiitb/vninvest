/**
 * WAVE 10C / NAV-1 — `WhaleBubbleChart` tab state that is **only** proven
 * shareable by reading the URL, never by reading local component state.
 *
 * Source under test: `packages/web/src/components/WhaleBubbleChart.jsx:614`
 *   const [activeTab, setActiveTab] = useUrlValue(
 *     'wb_tab', boolCodec('overview', 'signals'), 'overview');
 *
 * Why this file existed at all: `WhaleBubbleChart` appeared in the test tree
 * ONLY as a *mock stub* in `StockDetailPage.component.test.tsx:35` and
 * `page-heading-ac3.component.test.tsx:132` — i.e. every existing test
 * **replaced** it, so the `wb_tab` sync had zero coverage. "Suite is green"
 * proved nothing about deep-linking.
 *
 * Reaching the tab bar is not free — the buttons live behind a 5-gate chain:
 *   enabled (const true) -> !loading -> !error -> symbol -> hasAnyChartData
 *   -> isInfoPanelVisible -> !hoveredPanel
 * (`WhaleBubbleChart.jsx:1461-1493`, `:1583`, `:1596`). `hasAnyChartData` is
 * driven by `summary.total_orders`, which the normaliser reads from
 * `summary.whale_order_count` (`whaleAnalyticsSnapshotAdapter.js:319`) — so a
 * snapshot with only `bubble_series` would silently keep the tabs unreachable.
 *
 * `t` returns the **key**, matching `soc-nav1-url-state.component.test.tsx:36`.
 * That keeps assertions stable and avoids depending on Vietnamese diacritics.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, useSearchParams } from "react-router-dom";

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

// echarts is a heavy real dependency that needs a canvas jsdom does not have.
// `echarts.use([...])` runs at module scope, so the submodules must resolve too.
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

import WhaleBubbleChart from "../WhaleBubbleChart.jsx";

/** Reads the live query string — the only observable that proves NAV-1. */
function SearchProbe() {
  const [params] = useSearchParams();
  return <div data-testid="search">{params.toString()}</div>;
}

function currentSearch(): string {
  return screen.getByTestId("search").textContent || "";
}

const OVERVIEW_TAB = "whaleAnalytics.infoPanelSnapshot";
const SIGNALS_TAB = "whaleChart.signalsTab";
// Body copy unique to each tab panel (WhaleBubbleChart.jsx:1696 vs :1735).
const OVERVIEW_BODY = "whaleAnalytics.totalLargeOrders";
const SIGNALS_BODY = "whaleChart.noSignals";

/** Only `summary.whale_order_count` opens the `hasAnyChartData` gate. */
function snapshot() {
  return {
    data: {
      symbol: "VCB",
      summary: { whale_order_count: 2, extreme_order_count: 1 },
      session_levels: { reference_price: 85000 },
      price_series: [{ bucket_ts: "2026-10-09T09:30:00Z", price: 85000, reference_price: 84500 }],
      bubble_series: [
        { ts: "2026-10-09T09:30:00Z", side: "buy", price: 85000, volume: 1000, matched_value: 85_000_000 },
        { ts: "2026-10-09T09:35:00Z", side: "sell", price: 84900, volume: 900, matched_value: 76_410_000 },
      ],
    },
  };
}

function renderChart(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/${search}`]}>
      <SearchProbe />
      <WhaleBubbleChart selectedSymbol="VCB" symbolOptions={["VCB"]} />
    </MemoryRouter>,
  );
}

/** Wait until the async snapshot resolved and the info panel mounted. */
async function waitForTabs() {
  await waitFor(() => expect(screen.getByText(OVERVIEW_TAB)).toBeTruthy());
}

describe("WAVE 10C / NAV-1 — WhaleBubbleChart wb_tab dong bo hai chieu voi URL", () => {
  beforeEach(() => {
    h.getWhaleAnalyticsSnapshot.mockReset();
    h.getStockOrderFlow.mockReset();
    h.getWhaleAnalyticsSnapshot.mockResolvedValue(snapshot());
    h.getStockOrderFlow.mockResolvedValue({ data: { signals: [] } });
  });

  afterEach(() => cleanup());

  // AC-A: default is `overview` AND the URL stays empty. `boolCodec` must DELETE
  // the key for the default rather than write `?wb_tab=overview`.
  it("AC-A — URL rong: hien tab mac dinh va KHONG ghi wb_tab", async () => {
    renderChart("");

    await waitForTabs();
    expect(screen.getByText(OVERVIEW_BODY)).toBeTruthy();
    expect(screen.queryByText(SIGNALS_BODY)).toBeNull();
    expect(currentSearch()).toBe("");
  });

  // AC-C: deep-link — the exact bug NAV-1 exists to stop ("F5 resets the tab").
  it("AC-C — deep-link ?wb_tab=signals: mount ra da o tab Tinh hieu", async () => {
    renderChart("?wb_tab=signals");

    await waitForTabs();
    expect(screen.getByText(SIGNALS_BODY)).toBeTruthy();
    expect(screen.queryByText(OVERVIEW_BODY)).toBeNull();
    expect(currentSearch()).toBe("wb_tab=signals");
  });

  // AC-B: the click must move the URL, read back through useSearchParams.
  it("AC-B — bam sang tab Tinh hieu: useSearchParams doi va hien dung panel", async () => {
    renderChart("");

    await waitForTabs();
    expect(currentSearch()).toBe("");

    fireEvent.click(screen.getByText(SIGNALS_TAB));

    await waitFor(() => expect(currentSearch()).toBe("wb_tab=signals"));
    await waitFor(() => expect(screen.getByText(SIGNALS_BODY)).toBeTruthy());
    expect(screen.queryByText(OVERVIEW_BODY)).toBeNull();
  });

  // The other half of boolCodec: going back to the default must DELETE the key,
  // so a shared link never carries a redundant `wb_tab=overview`.
  it("AC-B' — quay lai tab mac dinh: key bi XOA khoi URL", async () => {
    renderChart("?wb_tab=signals");

    await waitForTabs();
    expect(screen.getByText(SIGNALS_BODY)).toBeTruthy();

    fireEvent.click(screen.getByText(OVERVIEW_TAB));

    await waitFor(() => expect(screen.getByText(OVERVIEW_BODY)).toBeTruthy());
    expect(currentSearch()).toBe("");
  });

  // Guard against a regression where `wb_tab` stops being written but the panel
  // still swaps locally — i.e. the exact "proxy observable" failure mode.
  it("AC-B'' — doi tab khong duoc lam URL ve lai trang thai deep-link", async () => {
    renderChart("?wb_tab=signals");

    await waitForTabs();
    fireEvent.click(screen.getByText(OVERVIEW_TAB));
    await waitFor(() => expect(currentSearch()).toBe(""));

    // A fresh deep-link must still land on `signals` — URL is the source of truth.
    cleanup();
    renderChart("?wb_tab=signals");
    await waitForTabs();
    expect(screen.getByText(SIGNALS_BODY)).toBeTruthy();
  });
});