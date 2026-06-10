import { jsx as _jsx } from "react/jsx-runtime";
// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Chart from "../../lib/Chart";
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
async function waitForTruthyValue(resolveValue, attempts = 6) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        const value = resolveValue();
        if (value) {
            return value;
        }
        await act(async () => {
            await flushMicrotasks();
        });
    }
    throw new Error("Expected truthy value before timeout");
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
describe("VNInvestCharts explicit fork runtime mounts", () => {
    let container = null;
    let root = null;
    beforeEach(() => {
        window.localStorage.clear();
        document.documentElement.lang = "en";
        mockVisibleRange = { from: 0, to: 2 };
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
    it("keeps widget children mounted on explicit fork runtime", async () => {
        const adapter = createAdapter(Promise.resolve([]), "fork-child-contract");
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: forkRuntimeData, engineRuntime: "fork", locale: "vi", children: _jsx("div", { "data-fork-child": "true", children: "Fork child" }) }));
            await flushMicrotasks();
        });
        const host = await waitForTruthyValue(() => container?.querySelector('[data-vn-kline-engine-host="true"]'));
        const childSurface = await waitForTruthyValue(() => container?.querySelector('[data-rsc-fork-children="true"]'));
        const child = await waitForTruthyValue(() => container?.querySelector('[data-fork-child="true"]'));
        expect(host).not.toBeNull();
        expect(childSurface).not.toBeNull();
        expect(child).not.toBeNull();
        expect(child?.textContent).toContain("Fork child");
    });
    it("keeps legacy chart children mounted on explicit fork runtime", async () => {
        const adapter = createAdapter(Promise.resolve([]), "fork-legacy-chart-child-contract");
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: forkRuntimeData, engineRuntime: "fork", locale: "vi", children: _jsx(Chart, { id: 0, children: _jsx("g", { "data-fork-legacy-chart-child": "true", children: _jsx("text", { children: "Legacy chart child" }) }) }) }));
            await flushMicrotasks();
        });
        const child = await waitForTruthyValue(() => container?.querySelector('[data-fork-legacy-chart-child="true"]'));
        expect(child).not.toBeNull();
        expect(child?.textContent).toContain("Legacy chart child");
    });
    it("keeps whale and cvd overlay surfaces mounted on explicit fork runtime when enabled", async () => {
        const adapter = createAdapter(Promise.resolve([]), "fork-overlay-contract");
        const handleRuntimeCapabilitiesChange = vi.fn();
        const whaleOrders = [{
                ts: forkRuntimeData[0].date.toISOString(),
                price: 103,
                volume: 50_000,
                matched_value: 5_500_000,
                side: "buy",
                size_class: "whale",
            }];
        const externalCvdSeries = [
            {
                bucket_ts: forkRuntimeData[0].date.toISOString(),
                buy_value: 6_000_000,
                sell_value: 2_000_000,
                cvd: 4_000_000,
                cumulative_cvd: 4_000_000,
            },
            {
                bucket_ts: forkRuntimeData[1].date.toISOString(),
                buy_value: 9_000_000,
                sell_value: 3_000_000,
                cvd: 6_000_000,
                cumulative_cvd: 10_000_000,
            },
        ];
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: forkRuntimeData, engineRuntime: "fork", locale: "vi", enableWhale: true, whaleOrders: whaleOrders, enableCVD: true, externalCvdSeries: externalCvdSeries, onRuntimeCapabilitiesChange: handleRuntimeCapabilitiesChange }));
            await flushMicrotasks();
        });
        const whaleOverlay = await waitForTruthyValue(() => container?.querySelector('[data-rsc-fork-overlay="whale"] canvas'));
        const cvdOverlay = await waitForTruthyValue(() => container?.querySelector('[data-rsc-fork-overlay="cvd"] canvas'));
        const externalCvdOverlay = await waitForTruthyValue(() => container?.querySelector('[data-rsc-fork-overlay="external-cvd"] canvas'));
        expect(whaleOverlay).not.toBeNull();
        expect(cvdOverlay).not.toBeNull();
        expect(externalCvdOverlay).not.toBeNull();
        const capabilities = await waitForTruthyValue(() => handleRuntimeCapabilitiesChange.mock.calls
            .map((call) => call[0])
            .findLast((value) => value?.engineRuntime === "fork"));
        expect(capabilities).toMatchObject({
            engineRuntime: "fork",
            chartCanvasOverlays: true,
            drawingOverlays: true,
        });
    });
    it("keeps dark-flow badge and drawing chrome mounted on fork runtime", async () => {
        const adapter = createAdapter(Promise.resolve([]), "drawing-chrome");
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: forkRuntimeData, engineRuntime: "fork", darkFlowStrength: 64, darkFlowSignalType: "iceberg", renderDrawingChrome: () => _jsx("div", { "data-testid": "drawing-chrome", children: "Chrome" }) }));
        });
        expect(container.querySelector('[data-testid="drawing-chrome"]')).not.toBeNull();
        expect(container.querySelector('.gc-darkflow-badge')?.textContent).toContain("64");
    });
});
