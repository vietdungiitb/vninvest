import { jsx as _jsx } from "react/jsx-runtime";
// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VNInvestCharts } from "../VNInvestCharts";
const reactActEnvironment = globalThis;
reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
const originalConsoleError = console.error;
console.error = (..._args) => { };
vi.mock("../../lib/core/hooks/useCanvasResize", () => {
    const ref = { current: null };
    return {
        useCanvasResize: () => ({
            ref,
            size: { width: 1200, height: 720 },
        }),
    };
});
const forkEngineSnapshots = [
    {
        paneId: "price",
        bounds: { left: 0, top: 0, width: 1200, height: 420 },
        plotBounds: { left: 0, top: 28, width: 1200, height: 392 },
        axisBounds: {
            right: { left: 1152, top: 0, width: 48, height: 420 },
        },
        headerAnchor: { left: 0, top: 0, width: 1200 },
        labelAnchor: { left: 0, top: 0, height: 420 },
        scaleSlotBounds: { "price-right": { left: 1152, top: 0, width: 48, height: 420 } },
        scaleSlotStates: { "price-right": { side: "right", mode: "auto", visible: true, domain: [98, 107] } },
    },
    {
        paneId: "volume",
        bounds: { left: 0, top: 420, width: 1200, height: 180 },
        plotBounds: { left: 0, top: 448, width: 1200, height: 152 },
        axisBounds: {
            right: { left: 1152, top: 420, width: 48, height: 180 },
        },
        headerAnchor: { left: 0, top: 420, width: 1200 },
        labelAnchor: { left: 0, top: 420, height: 180 },
        scaleSlotBounds: { "volume-right": { left: 1152, top: 420, width: 48, height: 180 } },
        scaleSlotStates: { "volume-right": { side: "right", mode: "auto", visible: true, domain: [1200, 1500] } },
    },
];
const engineHostPropsHistory = [];
let mockVisibleRange = { from: 0, to: 2 };
const mockEngineInstance = {
    mount: vi.fn(),
    dispose: vi.fn(),
    setPaneSpecs: vi.fn(),
    setDataSource: vi.fn(),
    setEnrichedData: vi.fn(),
    setHistorySnapshot: vi.fn(),
    setCameraState: vi.fn(),
    setOverlayInputs: vi.fn(),
    getCameraState: vi.fn(() => ({ barSpacePx: 8, rightOffsetBars: 0, followLatest: true })),
    getDirtyMask: vi.fn(() => 0),
    getLastFlushedMask: vi.fn(() => 0),
    getAxisGridRendererCalls: vi.fn(() => 0),
    resetAxisGridRendererCalls: vi.fn(),
    isMounted: vi.fn(() => true),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    setTheme: vi.fn(),
    setLocale: vi.fn(),
    setVisibleRange: vi.fn(),
    zoomToRange: vi.fn(),
    getVisibleRange: vi.fn(() => mockVisibleRange),
    getPaneSnapshots: vi.fn(() => forkEngineSnapshots),
    hitTestDrawingPrimitive: vi.fn(() => null),
};
vi.mock("@vninvestcharts/vn-kline-engine-react", async () => {
    const React = await import("react");
    return {
        EngineHost(props) {
            engineHostPropsHistory.push(props);
            React.useEffect(() => {
                props.onEngineReady?.(mockEngineInstance);
                props.onPaneSnapshotsChange?.(forkEngineSnapshots);
                props.onVisibleRangeChange?.(mockVisibleRange);
            }, []);
            return (_jsx("div", { "data-vn-kline-engine-host": "true", className: props.className, style: props.style, children: _jsx("div", { "data-vn-kline-engine": "surface", "data-locale": props.locale }) }));
        },
    };
});
function createAdapter(fetchBarsPromise, label) {
    const fetchBarsInRange = vi.fn().mockReturnValue(fetchBarsPromise);
    const fetchBarsBefore = vi.fn().mockResolvedValue([]);
    return {
        fetchBarsInRange,
        fetchBarsBefore,
        fetchBars: fetchBarsInRange,
        fetchMoreBars: fetchBarsBefore,
        subscribeToBar: vi.fn().mockReturnValue(() => { }),
        subscribeToTrades: vi.fn().mockReturnValue(() => { }),
        subscribeToOrderbook: vi.fn().mockReturnValue(() => { }),
        searchSymbols: vi.fn().mockResolvedValue([]),
        label,
    };
}
async function flushMicrotasks() {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
}
const forkRuntimeData = [
    {
        date: new Date("2024-01-01T09:00:00Z"),
        open: 100,
        high: 105,
        low: 98,
        close: 103,
        volume: 1200,
        index: 0,
        dataIndex: 0,
    },
    {
        date: new Date("2024-01-01T10:00:00Z"),
        open: 103,
        high: 107,
        low: 101,
        close: 106,
        volume: 1500,
        index: 1,
        dataIndex: 1,
    },
];
describe("VNInvestCharts engine host forwarding", () => {
    let container = null;
    let root = null;
    beforeEach(() => {
        window.localStorage.clear();
        document.documentElement.lang = "en";
        mockVisibleRange = { from: 0, to: 2 };
        engineHostPropsHistory.length = 0;
    });
    afterEach(async () => {
        await act(async () => {
            await flushMicrotasks();
            root?.unmount();
            await flushMicrotasks();
        });
        root = null;
        container?.remove();
        container = null;
        window.localStorage.clear();
        document.documentElement.lang = "en";
    });
    afterAll(() => {
        console.error = originalConsoleError;
    });
    it("KF10-T04-01: forwards per-series params into EngineHost pane specs", async () => {
        const adapter = createAdapter(Promise.resolve([]), "fork-params-forward");
        const panes = [
            {
                id: "price",
                label: "Price",
                pinned: false,
                visible: true,
                heightRatio: 1,
                splitScale: false,
                tooltip: "value",
                series: [
                    { id: "ema-13", type: "EMA", yAxis: "right", params: { period: 13 } },
                    { id: "ema-20", type: "EMA", yAxis: "right", params: { period: 20 } },
                ],
            },
        ];
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: forkRuntimeData, panes: panes, engineRuntime: "fork" }));
            await flushMicrotasks();
        });
        const latestHostProps = engineHostPropsHistory.at(-1);
        const enginePanes = (latestHostProps?.panes ?? []);
        const pricePane = enginePanes[0];
        const ema13 = pricePane?.series?.find((series) => series.id === "ema-13");
        const ema20 = pricePane?.series?.find((series) => series.id === "ema-20");
        expect(ema13?.params).toEqual({ period: 13 });
        expect(ema20?.params).toEqual({ period: 20 });
    });
    it("KF10-T04-02: keeps params undefined for series without params", async () => {
        const adapter = createAdapter(Promise.resolve([]), "fork-params-undefined");
        const panes = [
            {
                id: "price",
                label: "Price",
                pinned: false,
                visible: true,
                heightRatio: 1,
                splitScale: false,
                tooltip: "value",
                series: [
                    { id: "ema-default", type: "EMA", yAxis: "right" },
                ],
            },
        ];
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: forkRuntimeData, panes: panes, engineRuntime: "fork" }));
            await flushMicrotasks();
        });
        const latestHostProps = engineHostPropsHistory.at(-1);
        const enginePanes = (latestHostProps?.panes ?? []);
        const pricePane = enginePanes[0];
        const emaDefault = pricePane?.series?.find((series) => series.id === "ema-default");
        expect(emaDefault?.params).toBeUndefined();
    });
    it("KF11-T04-01: forwards default useWebGL=false to EngineHost", async () => {
        const adapter = createAdapter(Promise.resolve([]), "fork-webgl-default");
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: forkRuntimeData, engineRuntime: "fork" }));
            await flushMicrotasks();
        });
        const latestHostProps = engineHostPropsHistory.at(-1);
        expect(latestHostProps?.engineOptions?.useWebGL).toBe(false);
    });
});
