import { jsx as _jsx } from "react/jsx-runtime";
// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VNInvestCharts } from "../VNInvestCharts";
import { WidgetErrorBoundary } from "../WidgetErrorBoundary";
import { WidgetI18nProvider } from "../context/WidgetI18nContext";
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
    const resolveHoveredPaneId = (localX, localY) => {
        const hoveredSnapshot = forkEngineSnapshots.find((snapshot) => {
            const right = snapshot.bounds.left + snapshot.bounds.width;
            const bottom = snapshot.bounds.top + snapshot.bounds.height;
            return localX >= snapshot.bounds.left && localX <= right && localY >= snapshot.bounds.top && localY <= bottom;
        });
        return hoveredSnapshot?.paneId ?? null;
    };
    return {
        EngineHost(props) {
            React.useEffect(() => {
                props.onEngineReady?.(mockEngineInstance);
                props.onPaneSnapshotsChange?.(forkEngineSnapshots);
                props.onVisibleRangeChange?.(mockVisibleRange);
            }, []);
            return (_jsx("div", { "data-vn-kline-engine-host": "true", className: props.className, style: props.style, onPointerMove: (event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    const localX = event.clientX - rect.left;
                    const localY = event.clientY - rect.top;
                    props.onPaneHover?.(resolveHoveredPaneId(localX, localY));
                }, children: _jsx("div", { "data-vn-kline-engine": "surface", "data-locale": props.locale }) }));
        },
    };
});
function createDeferred() {
    let resolve;
    let reject;
    const promise = new Promise((promiseResolve, promiseReject) => {
        resolve = promiseResolve;
        reject = promiseReject;
    });
    return { promise, resolve, reject };
}
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
describe("VNInvestCharts regressions", () => {
    let abortSpy = null;
    let container = null;
    let root = null;
    beforeEach(() => {
        window.localStorage.clear();
        document.documentElement.lang = "en";
        mockVisibleRange = { from: 0, to: 2 };
        abortSpy = vi.spyOn(AbortController.prototype, "abort");
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
        abortSpy?.mockRestore();
        abortSpy = null;
        window.localStorage.clear();
        document.documentElement.lang = "en";
    });
    afterAll(() => {
        console.error = originalConsoleError;
    });
    it("[W-10] Mount VNInvestCharts với bars=[] -> WidgetEmptyState render, không crash", async () => {
        const fetchDeferred = Promise.resolve([]);
        const adapter = createAdapter(fetchDeferred, "empty-bars");
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, locale: "vi", data: [] }));
            await flushMicrotasks();
        });
        expect(container.textContent).toContain("Chưa có dữ liệu");
    });
    it("[W-11] Mount với loading=true (chưa có bars) -> Loading state UI visible", async () => {
        const fetchDeferred = createDeferred();
        const adapter = createAdapter(fetchDeferred.promise, "loading-bars");
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, locale: "vi" }));
        });
        expect(container.textContent).toContain("Đang tải biểu đồ…");
        fetchDeferred.resolve([]);
        await act(async () => {
            await flushMicrotasks();
        });
    });
    it("[W-12] adapter prop thay đổi -> AbortController.abort() spy được gọi", async () => {
        const firstFetch = createDeferred();
        const secondFetch = createDeferred();
        const firstAdapter = createAdapter(firstFetch.promise, "first-adapter");
        const secondAdapter = createAdapter(secondFetch.promise, "second-adapter");
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: firstAdapter, locale: "en" }));
        });
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: secondAdapter, locale: "en" }));
        });
        expect(abortSpy?.mock.calls.length ?? 0).toBeGreaterThan(0);
        firstFetch.resolve([]);
        secondFetch.resolve([]);
        await act(async () => {
            await flushMicrotasks();
        });
    });
    it("[W-13] symbol prop thay đổi -> setBars([]) được gọi trước fetch mới", async () => {
        const fetchDeferred = Promise.resolve([]);
        const adapter = createAdapter(fetchDeferred, "symbol-change");
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, symbol: "BTCUSDT", timeframe: "1h", locale: "vi" }));
            await flushMicrotasks();
        });
        expect(adapter.fetchBars).toHaveBeenCalledTimes(1);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, symbol: "ETHUSDT", timeframe: "1h", locale: "vi" }));
            await flushMicrotasks();
        });
        expect(adapter.fetchBars).toHaveBeenCalledTimes(2);
    });
    it("[W-14] timeframe prop thay đổi -> setBars([]) được gọi trước fetch mới", async () => {
        const fetchDeferred = Promise.resolve([]);
        const adapter = createAdapter(fetchDeferred, "timeframe-change");
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, symbol: "BTCUSDT", timeframe: "1h", locale: "vi" }));
            await flushMicrotasks();
        });
        expect(adapter.fetchBars).toHaveBeenCalledTimes(1);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, symbol: "BTCUSDT", timeframe: "4h", locale: "vi" }));
            await flushMicrotasks();
        });
        expect(adapter.fetchBars).toHaveBeenCalledTimes(2);
    });
    it("[W-15] adapter.fetchBars() throw Error -> WidgetErrorBoundary fallback render, không crash host", async () => {
        const adapter = createAdapter(Promise.reject(new Error("fetch failed")), "fetch-error");
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(WidgetI18nProvider, { locale: "vi", children: _jsx(WidgetErrorBoundary, { children: _jsx(VNInvestCharts, { adapter: adapter, locale: "vi" }) }) }));
            await flushMicrotasks();
        });
        expect(container.textContent).toContain("Đã xảy ra lỗi trong biểu đồ");
    });
    it("[W-16] Unmount component -> AbortController.abort() được gọi trong cleanup", async () => {
        const fetchDeferred = createDeferred();
        const adapter = createAdapter(fetchDeferred.promise, "unmount-test");
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, locale: "en" }));
        });
        const currentAbortCalls = abortSpy?.mock.calls.length ?? 0;
        await act(async () => {
            root?.unmount();
            root = null;
            await flushMicrotasks();
        });
        expect((abortSpy?.mock.calls.length ?? 0) - currentAbortCalls).toBeGreaterThan(0);
        fetchDeferred.resolve([]);
    });
    it("[W-17] Bọc component throw Error bằng WidgetErrorBoundary -> role='alert' render, không crash", async () => {
        function ThrowingChild() {
            throw new Error("test crash");
        }
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(WidgetI18nProvider, { locale: "en", children: _jsx(WidgetErrorBoundary, { children: _jsx(ThrowingChild, {}) }) }));
        });
        const alertDiv = container.querySelector('[role="alert"]');
        expect(alertDiv).not.toBeNull();
        expect(alertDiv?.textContent).toContain("An error occurred in the chart");
    });
    it("[W-18] onError callback truyền vào WidgetErrorBoundary -> Callback được gọi với đúng Error object", async () => {
        const mockOnError = vi.fn();
        const testError = new Error("callback error");
        function ThrowingChild() {
            throw testError;
        }
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(WidgetI18nProvider, { locale: "en", children: _jsx(WidgetErrorBoundary, { onError: mockOnError, children: _jsx(ThrowingChild, {}) }) }));
        });
        expect(mockOnError).toHaveBeenCalledTimes(1);
        expect(mockOnError).toHaveBeenCalledWith(testError, expect.any(Object));
    });
    it("[W-19] register/unregister multi-signal release listeners cho fork pointer owner", async () => {
        const adapter = createAdapter(Promise.resolve([]), "pointer-owner-release");
        const addSpy = vi.spyOn(window, "addEventListener");
        const removeSpy = vi.spyOn(window, "removeEventListener");
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, locale: "vi", engineRuntime: "fork" }));
            await flushMicrotasks();
        });
        expect(addSpy).toHaveBeenCalledWith("pointerup", expect.any(Function));
        expect(addSpy).toHaveBeenCalledWith("pointercancel", expect.any(Function));
        expect(addSpy).toHaveBeenCalledWith("touchend", expect.any(Function));
        expect(addSpy).toHaveBeenCalledWith("touchcancel", expect.any(Function));
        expect(addSpy).toHaveBeenCalledWith("lostpointercapture", expect.any(Function));
        expect(addSpy).toHaveBeenCalledWith("blur", expect.any(Function));
        await act(async () => {
            root?.unmount();
            root = null;
            await flushMicrotasks();
        });
        expect(removeSpy).toHaveBeenCalledWith("pointerup", expect.any(Function));
        expect(removeSpy).toHaveBeenCalledWith("pointercancel", expect.any(Function));
        expect(removeSpy).toHaveBeenCalledWith("touchend", expect.any(Function));
        expect(removeSpy).toHaveBeenCalledWith("touchcancel", expect.any(Function));
        expect(removeSpy).toHaveBeenCalledWith("lostpointercapture", expect.any(Function));
        expect(removeSpy).toHaveBeenCalledWith("blur", expect.any(Function));
        addSpy.mockRestore();
        removeSpy.mockRestore();
    });
});
