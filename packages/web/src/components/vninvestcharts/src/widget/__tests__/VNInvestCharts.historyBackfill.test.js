import { jsx as _jsx } from "react/jsx-runtime";
// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const reactActEnvironment = globalThis;
reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
let visibleDomainEmitted = false;
let latestVisibleDomainHandler;
let latestRenderedBars = [];
let trimToWindowCalls = [];
const engineHostPropsHistory = [];
let mockVisibleRange = { from: 1, to: 2 };
let autoEmitForkVisibleRange = true;
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
];
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
                if (autoEmitForkVisibleRange) {
                    props.onVisibleRangeChange?.(mockVisibleRange);
                }
            }, []);
            return _jsx("div", { "data-testid": "engine-host", className: props.className, style: props.style });
        },
    };
});
vi.mock("../history/chunkStore", async () => {
    const actual = await vi.importActual("../history/chunkStore");
    return {
        ...actual,
        createHistoryChunkStore: () => {
            const store = actual.createHistoryChunkStore();
            const originalTrimToWindow = store.trimToWindow.bind(store);
            return {
                ...store,
                trimToWindow: (...args) => {
                    trimToWindowCalls.push(args);
                    return originalTrimToWindow(...args);
                },
            };
        },
    };
});
vi.mock("../../lib/core/hooks/useCanvasResize", () => {
    const ref = { current: null };
    return {
        useCanvasResize: () => ({
            ref,
            size: { width: 1200, height: 720 },
        }),
    };
});
vi.mock("../../lib/core", async () => {
    const React = await import("react");
    const actual = await vi.importActual("../../lib/core");
    return {
        ...actual,
        useChartTheme: () => ({
            theme: "light",
            toggleTheme: () => undefined,
            isDark: false,
        }),
        DynamicChart: (props) => {
            latestVisibleDomainHandler = props.onVisibleDomainChange;
            latestRenderedBars = props.data;
            React.useEffect(() => {
                if (visibleDomainEmitted || props.data.length === 0) {
                    return;
                }
                visibleDomainEmitted = true;
                const firstBar = props.data[0];
                const secondBar = props.data[Math.min(props.data.length - 1, 1)] ?? firstBar;
                props.onVisibleDomainChange?.([firstBar.date, secondBar.date]);
            }, [props.data, props.onVisibleDomainChange]);
            return _jsx("div", { "data-testid": "dynamic-chart", children: props.children });
        },
    };
});
function createBar(timestamp, close, index) {
    return {
        date: new Date(timestamp),
        open: close - 1,
        high: close + 1,
        low: close - 2,
        close,
        volume: 1000 + index,
        index,
        dataIndex: index,
    };
}
async function flushMicrotasks() {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
}
async function waitForVisibleDomainHandler(attempts = 30) {
    for (let iteration = 0; iteration < attempts; iteration += 1) {
        if (latestVisibleDomainHandler) {
            return latestVisibleDomainHandler;
        }
        await act(async () => {
            await flushMicrotasks();
        });
    }
    throw new Error(`Timed out waiting for visible-domain handler`);
}
async function waitForForkVisibleRangeHandler(attempts = 30) {
    for (let iteration = 0; iteration < attempts; iteration += 1) {
        const latestHostProps = engineHostPropsHistory[engineHostPropsHistory.length - 1];
        if (latestHostProps?.onVisibleRangeChange) {
            return latestHostProps.onVisibleRangeChange;
        }
        await act(async () => {
            await flushMicrotasks();
        });
    }
    throw new Error("Timed out waiting for fork visible-range handler");
}
async function emitVisibleDomain(domain) {
    const visibleDomainHandler = await waitForVisibleDomainHandler();
    await act(async () => {
        visibleDomainHandler(domain);
        for (let iteration = 0; iteration < 6; iteration += 1) {
            await flushMicrotasks();
        }
    });
}
async function waitForBarsEmission(predicate, attempts = 12) {
    for (let iteration = 0; iteration < attempts; iteration += 1) {
        if (predicate()) {
            return;
        }
        await act(async () => {
            await flushMicrotasks();
        });
    }
    throw new Error("Timed out waiting for bars emission");
}
async function waitForPredicate(predicate, attempts = 30) {
    for (let iteration = 0; iteration < attempts; iteration += 1) {
        if (predicate()) {
            return;
        }
        await act(async () => {
            await flushMicrotasks();
        });
    }
    throw new Error("Timed out waiting for predicate");
}
describe("VNInvestCharts history backfill", () => {
    let VNInvestCharts;
    let container = null;
    let root = null;
    let restoreGetContext = null;
    beforeEach(async () => {
        visibleDomainEmitted = false;
        latestVisibleDomainHandler = undefined;
        latestRenderedBars = [];
        trimToWindowCalls = [];
        engineHostPropsHistory.length = 0;
        mockVisibleRange = { from: 1, to: 2 };
        autoEmitForkVisibleRange = true;
        mockEngineInstance.zoomToRange.mockClear();
        mockEngineInstance.getVisibleRange.mockReturnValue({ from: 0, to: 1 });
        const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => null);
        restoreGetContext = () => getContextSpy.mockRestore();
        ({ VNInvestCharts } = await import("../VNInvestCharts"));
    });
    afterEach(async () => {
        visibleDomainEmitted = false;
        latestVisibleDomainHandler = undefined;
        latestRenderedBars = [];
        trimToWindowCalls = [];
        engineHostPropsHistory.length = 0;
        if (root) {
            await act(async () => {
                root?.unmount();
                await flushMicrotasks();
            });
        }
        root = null;
        container?.remove();
        container = null;
        restoreGetContext?.();
        restoreGetContext = null;
    });
    it("calls fetchBarsBefore when the visible domain reaches the oldest loaded bar", async () => {
        const initialBars = [
            createBar("2026-05-20T00:00:00Z", 100, 0),
            createBar("2026-05-20T01:00:00Z", 101, 1),
            createBar("2026-05-20T02:00:00Z", 102, 2),
        ];
        const firstOlderBars = [
            createBar("2026-05-19T22:00:00Z", 98, 0),
            createBar("2026-05-19T23:00:00Z", 99, 1),
        ];
        const secondOlderBars = [
            createBar("2026-05-19T20:00:00Z", 96, 0),
            createBar("2026-05-19T21:00:00Z", 97, 1),
        ];
        const thirdOlderBars = [
            createBar("2026-05-19T18:00:00Z", 94, 0),
            createBar("2026-05-19T19:00:00Z", 95, 1),
        ];
        const handleVisibleDomainChange = vi.fn();
        const adapter = {
            fetchBarsInRange: vi.fn().mockResolvedValue(initialBars),
            fetchBarsBefore: vi.fn()
                .mockResolvedValueOnce(firstOlderBars)
                .mockResolvedValueOnce(secondOlderBars)
                .mockResolvedValueOnce(thirdOlderBars)
                .mockResolvedValue([]),
            subscribeToBar: vi.fn().mockReturnValue(() => undefined),
            subscribeToTrades: vi.fn().mockReturnValue(() => undefined),
            subscribeToOrderbook: vi.fn().mockReturnValue(() => undefined),
            searchSymbols: vi.fn().mockResolvedValue([]),
        };
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, symbol: "BTCUSDT", timeframe: "1h", showNonTradingDays: true }));
            for (let iteration = 0; iteration < 6; iteration += 1) {
                await flushMicrotasks();
            }
        });
        expect(adapter.fetchBarsInRange).toHaveBeenCalled();
        expect(adapter.fetchBarsBefore).toHaveBeenCalled();
        expect(adapter.fetchBarsBefore).toHaveBeenNthCalledWith(1, "BTCUSDT", "1h", expect.any(Date), 1000);
        const requestedBefore = adapter.fetchBarsBefore.mock.calls[0]?.[2];
        expect(requestedBefore.getTime()).toBe(initialBars[0].date.getTime());
    });
    it("fetches older bars after a fork visible-range pan reaches the oldest loaded bar", async () => {
        const initialBars = [
            createBar("2026-05-20T00:00:00Z", 100, 0),
            createBar("2026-05-20T01:00:00Z", 101, 1),
            createBar("2026-05-20T02:00:00Z", 102, 2),
            createBar("2026-05-20T03:00:00Z", 103, 3),
            createBar("2026-05-20T04:00:00Z", 104, 4),
            createBar("2026-05-20T05:00:00Z", 105, 5),
            createBar("2026-05-20T06:00:00Z", 106, 6),
        ];
        const firstOlderBars = [
            createBar("2026-05-19T22:00:00Z", 98, 0),
            createBar("2026-05-19T23:00:00Z", 99, 1),
        ];
        const secondOlderBars = [
            createBar("2026-05-19T20:00:00Z", 96, 0),
            createBar("2026-05-19T21:00:00Z", 97, 1),
        ];
        let resolveFirstOlderBars;
        const firstOlderBarsPromise = new Promise((resolve) => {
            resolveFirstOlderBars = resolve;
        });
        const adapter = {
            fetchBarsInRange: vi.fn().mockResolvedValue(initialBars),
            fetchBarsBefore: vi.fn()
                .mockImplementationOnce(() => firstOlderBarsPromise)
                .mockResolvedValueOnce(secondOlderBars)
                .mockResolvedValue([]),
            subscribeToBar: vi.fn().mockReturnValue(() => undefined),
            subscribeToTrades: vi.fn().mockReturnValue(() => undefined),
            subscribeToOrderbook: vi.fn().mockReturnValue(() => undefined),
            searchSymbols: vi.fn().mockResolvedValue([]),
        };
        mockVisibleRange = { from: 3, to: 5 };
        autoEmitForkVisibleRange = false;
        mockEngineInstance.getVisibleRange.mockReturnValue({ from: 3, to: 5 });
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, symbol: "BTCUSDT", timeframe: "1h", engineRuntime: "fork", showNonTradingDays: true }));
            for (let iteration = 0; iteration < 8; iteration += 1) {
                await flushMicrotasks();
            }
        });
        expect(adapter.fetchBarsInRange).toHaveBeenCalled();
        await waitForPredicate(() => adapter.fetchBarsBefore.mock.calls.length === 1);
        const fetchBarsBeforeCallCountBeforePan = adapter.fetchBarsBefore.mock.calls.length;
        const visibleRangeHandler = await waitForForkVisibleRangeHandler();
        await act(async () => {
            visibleRangeHandler({ from: 0, to: 2 });
            for (let iteration = 0; iteration < 8; iteration += 1) {
                await flushMicrotasks();
            }
        });
        await act(async () => {
            resolveFirstOlderBars?.(firstOlderBars);
            for (let iteration = 0; iteration < 8; iteration += 1) {
                await flushMicrotasks();
            }
        });
        await waitForPredicate(() => adapter.fetchBarsBefore.mock.calls.length > fetchBarsBeforeCallCountBeforePan);
        expect(adapter.fetchBarsBefore.mock.calls.length).toBeGreaterThan(fetchBarsBeforeCallCountBeforePan);
        expect(adapter.fetchBarsBefore).toHaveBeenLastCalledWith("BTCUSDT", "1h", expect.any(Date), 1000);
    });
    it("passes the resident hard cap into live-tick trimming after deep zoom-out", async () => {
        const initialBars = [
            createBar("2026-05-20T00:00:00Z", 100, 0),
            createBar("2026-05-20T01:00:00Z", 101, 1),
            createBar("2026-05-20T02:00:00Z", 102, 2),
            createBar("2026-05-20T03:00:00Z", 103, 3),
            createBar("2026-05-20T04:00:00Z", 104, 4),
        ];
        const handleBarsChange = vi.fn();
        const adapter = {
            fetchBarsInRange: vi.fn().mockResolvedValue(initialBars),
            fetchBarsBefore: vi.fn().mockResolvedValue([]),
            subscribeToBar: vi.fn().mockReturnValue(() => undefined),
            subscribeToTrades: vi.fn().mockReturnValue(() => undefined),
            subscribeToOrderbook: vi.fn().mockReturnValue(() => undefined),
            searchSymbols: vi.fn().mockResolvedValue([]),
        };
        visibleDomainEmitted = true;
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, symbol: "BTCUSDT", timeframe: "1m", engineRuntime: "legacy", onBarsChange: handleBarsChange, showNonTradingDays: true }));
            for (let iteration = 0; iteration < 8; iteration += 1) {
                await flushMicrotasks();
            }
        });
        await waitForBarsEmission(() => adapter.subscribeToBar.mock.calls.length > 0, 30);
        await waitForBarsEmission(() => handleBarsChange.mock.calls.some((call) => {
            const bars = call[0];
            return Array.isArray(bars) && bars.length === initialBars.length;
        }), 30);
        await emitVisibleDomain([initialBars[0].date, initialBars[initialBars.length - 1].date]);
        trimToWindowCalls = [];
        const liveCallback = adapter.subscribeToBar.mock.calls[0]?.[2];
        if (!liveCallback) {
            throw new Error("Expected subscribeToBar callback");
        }
        const liveBar = createBar("2026-05-20T05:00:00Z", 105, 5);
        await act(async () => {
            liveCallback(liveBar);
            for (let iteration = 0; iteration < 8; iteration += 1) {
                await flushMicrotasks();
            }
        });
        expect(trimToWindowCalls.at(-1)?.[1]).toBe(120000);
    });
    it("keeps the visible span centered inside a three-window retention range", async () => {
        const initialBars = [
            createBar("2026-05-19T22:00:00Z", 98, 0),
            createBar("2026-05-19T23:00:00Z", 99, 1),
            createBar("2026-05-20T00:00:00Z", 100, 2),
            createBar("2026-05-20T01:00:00Z", 101, 3),
            createBar("2026-05-20T02:00:00Z", 102, 4),
            createBar("2026-05-20T03:00:00Z", 103, 5),
            createBar("2026-05-20T04:00:00Z", 104, 6),
        ];
        const handleBarsChange = vi.fn();
        const adapter = {
            fetchBarsInRange: vi.fn().mockResolvedValue(initialBars),
            fetchBarsBefore: vi.fn().mockResolvedValue([]),
            subscribeToBar: vi.fn().mockReturnValue(() => undefined),
            subscribeToTrades: vi.fn().mockReturnValue(() => undefined),
            subscribeToOrderbook: vi.fn().mockReturnValue(() => undefined),
            searchSymbols: vi.fn().mockResolvedValue([]),
        };
        visibleDomainEmitted = true;
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, symbol: "BTCUSDT", timeframe: "1h", engineRuntime: "legacy", onBarsChange: handleBarsChange, showNonTradingDays: true, historyMinResidentBars: 0 }));
            await flushMicrotasks();
        });
        await waitForBarsEmission(() => handleBarsChange.mock.calls.some((call) => {
            const bars = call[0];
            return Array.isArray(bars) && bars.length === initialBars.length;
        }));
        await emitVisibleDomain([
            new Date("2026-05-20T00:00:00Z"),
            new Date("2026-05-20T01:00:00Z"),
        ]);
        const lastBars = handleBarsChange.mock.calls.at(-1)?.[0];
        // With hysteresis (50% padding on each side of the 3x resident target),
        // the trim window is ~4.5x the visible span. Given visible=[00:00,01:00] (1h),
        // resident target = [23:00, 02:00] (3h), hysteresis pad = 1.5h →
        // trim window = [21:30, 03:30]. However, the live-edge protection anchors
        // the trim right boundary to the latest known bar (04:00), so ALL loaded
        // bars survive: [22:00, 23:00, 00:00, 01:00, 02:00, 03:00, 04:00].
        expect(lastBars.map((bar) => bar.date.toISOString())).toEqual([
            "2026-05-19T22:00:00.000Z",
            "2026-05-19T23:00:00.000Z",
            "2026-05-20T00:00:00.000Z",
            "2026-05-20T01:00:00.000Z",
            "2026-05-20T02:00:00.000Z",
            "2026-05-20T03:00:00.000Z",
            "2026-05-20T04:00:00.000Z",
        ]);
        expect(adapter.fetchBarsBefore).not.toHaveBeenCalled();
        expect(adapter.fetchBarsInRange).toHaveBeenCalled();
    });
    it("fetches older bars until the three-window retention range is covered", async () => {
        const initialBars = [
            createBar("2026-05-20T00:00:00Z", 100, 0),
            createBar("2026-05-20T01:00:00Z", 101, 1),
            createBar("2026-05-20T02:00:00Z", 102, 2),
        ];
        const olderBars = [
            createBar("2026-05-19T22:00:00Z", 98, 0),
            createBar("2026-05-19T23:00:00Z", 99, 1),
        ];
        const handleBarsChange = vi.fn();
        const adapter = {
            fetchBarsInRange: vi.fn().mockResolvedValue(initialBars),
            fetchBarsBefore: vi.fn()
                .mockResolvedValueOnce(olderBars)
                .mockResolvedValueOnce([]),
            subscribeToBar: vi.fn().mockReturnValue(() => undefined),
            subscribeToTrades: vi.fn().mockReturnValue(() => undefined),
            subscribeToOrderbook: vi.fn().mockReturnValue(() => undefined),
            searchSymbols: vi.fn().mockResolvedValue([]),
        };
        visibleDomainEmitted = true;
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, symbol: "BTCUSDT", timeframe: "1h", engineRuntime: "legacy", onBarsChange: handleBarsChange, showNonTradingDays: true }));
            await flushMicrotasks();
        });
        await waitForBarsEmission(() => handleBarsChange.mock.calls.some((call) => {
            const bars = call[0];
            return Array.isArray(bars) && bars.length === initialBars.length;
        }));
        await emitVisibleDomain([
            new Date("2026-05-20T00:00:00Z"),
            new Date("2026-05-20T01:00:00Z"),
        ]);
        await waitForBarsEmission(() => handleBarsChange.mock.calls.some((call) => {
            const bars = call[0];
            // With hysteresis, after loading olderBars [22:00, 23:00] the store keeps
            // both since the trim window (~4.5x visible) includes them.
            // Wait for 5 bars: [22:00, 23:00, 00:00, 01:00, 02:00]
            return Array.isArray(bars)
                && bars.length === 5
                && bars[0]?.date.toISOString() === "2026-05-19T22:00:00.000Z";
        }));
        const emittedBars = handleBarsChange.mock.calls
            .map((call) => call[0])
            .filter((bars) => Array.isArray(bars));
        const warmedBars = emittedBars.find((bars) => bars.length === 5);
        expect(adapter.fetchBarsBefore).toHaveBeenCalled();
        expect(adapter.fetchBarsBefore).toHaveBeenNthCalledWith(1, "BTCUSDT", "1h", expect.any(Date), 1000);
        expect(warmedBars).toBeDefined();
        expect(warmedBars?.[0]?.date.toISOString()).toBe("2026-05-19T22:00:00.000Z");
    });
    it("fetches newer bars when the visible window moves toward newer data", async () => {
        const initialBars = [
            createBar("2026-05-19T23:00:00Z", 99, 0),
            createBar("2026-05-20T00:00:00Z", 100, 1),
            createBar("2026-05-20T01:00:00Z", 101, 2),
        ];
        const newerBars = [
            createBar("2026-05-20T01:00:00Z", 101, 0),
            createBar("2026-05-20T02:00:00Z", 102, 1),
        ];
        const handleBarsChange = vi.fn();
        const adapter = {
            fetchBarsInRange: vi.fn()
                .mockResolvedValueOnce(initialBars)
                .mockResolvedValueOnce(newerBars)
                .mockResolvedValue([]),
            fetchBarsBefore: vi.fn().mockResolvedValue([]),
            subscribeToBar: vi.fn().mockReturnValue(() => undefined),
            subscribeToTrades: vi.fn().mockReturnValue(() => undefined),
            subscribeToOrderbook: vi.fn().mockReturnValue(() => undefined),
            searchSymbols: vi.fn().mockResolvedValue([]),
        };
        visibleDomainEmitted = true;
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, symbol: "BTCUSDT", timeframe: "1h", engineRuntime: "legacy", onBarsChange: handleBarsChange, showNonTradingDays: true, historyMinResidentBars: 0 }));
            await flushMicrotasks();
        });
        await waitForBarsEmission(() => handleBarsChange.mock.calls.some((call) => {
            const bars = call[0];
            return Array.isArray(bars) && bars.length === initialBars.length;
        }));
        await emitVisibleDomain([
            new Date("2026-05-20T00:00:00Z"),
            new Date("2026-05-20T01:00:00Z"),
        ]);
        await waitForBarsEmission(() => {
            const bars = handleBarsChange.mock.calls.at(-1)?.[0];
            return Array.isArray(bars)
                && bars.length === 4
                && bars[3]?.date.toISOString() === "2026-05-20T02:00:00.000Z";
        });
        const lastBars = handleBarsChange.mock.calls.at(-1)?.[0];
        expect(adapter.fetchBarsInRange.mock.calls.some((call) => (call[0] === "BTCUSDT"
            && call[1] === "1h"
            && call[3] instanceof Date
            && call[3].getTime() === new Date("2026-05-20T02:00:00.000Z").getTime()))).toBe(true);
        expect(lastBars.map((bar) => bar.date.toISOString())).toEqual([
            "2026-05-19T23:00:00.000Z",
            "2026-05-20T00:00:00.000Z",
            "2026-05-20T01:00:00.000Z",
            "2026-05-20T02:00:00.000Z",
        ]);
    });
    it("ignores a stale left refill response after timeframe changes", async () => {
        const initialBars1h = [
            createBar("2026-05-20T00:00:00Z", 100, 0),
            createBar("2026-05-20T01:00:00Z", 101, 1),
            createBar("2026-05-20T02:00:00Z", 102, 2),
        ];
        const initialBars4h = [
            createBar("2026-05-21T00:00:00Z", 200, 0),
            createBar("2026-05-21T04:00:00Z", 204, 1),
            createBar("2026-05-21T08:00:00Z", 208, 2),
        ];
        const staleOlderBars = [
            createBar("2026-05-19T22:00:00Z", 98, 0),
            createBar("2026-05-19T23:00:00Z", 99, 1),
        ];
        const handleBarsChange = vi.fn();
        let resolveStaleBackfill;
        const staleBackfillPromise = new Promise((resolve) => {
            resolveStaleBackfill = resolve;
        });
        const adapter = {
            fetchBarsInRange: vi.fn().mockImplementation((_symbol, timeframe) => {
                return Promise.resolve(timeframe === "4h" ? initialBars4h : initialBars1h);
            }),
            fetchBarsBefore: vi.fn()
                .mockImplementationOnce(() => staleBackfillPromise)
                .mockResolvedValue([]),
            subscribeToBar: vi.fn().mockReturnValue(() => undefined),
            subscribeToTrades: vi.fn().mockReturnValue(() => undefined),
            subscribeToOrderbook: vi.fn().mockReturnValue(() => undefined),
            searchSymbols: vi.fn().mockResolvedValue([]),
        };
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, symbol: "BTCUSDT", timeframe: "1h", onBarsChange: handleBarsChange, showNonTradingDays: true }));
            await flushMicrotasks();
        });
        await waitForBarsEmission(() => handleBarsChange.mock.calls.some((call) => {
            const bars = call[0];
            return Array.isArray(bars) && bars.length === initialBars1h.length;
        }));
        visibleDomainEmitted = false;
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, symbol: "BTCUSDT", timeframe: "4h", onBarsChange: handleBarsChange, showNonTradingDays: true }));
            await flushMicrotasks();
        });
        const barsBeforeStaleResolve = handleBarsChange.mock.calls.at(-1)?.[0];
        expect(barsBeforeStaleResolve).toHaveLength(initialBars4h.length);
        expect(barsBeforeStaleResolve[0]?.date.getTime()).toBe(initialBars4h[0].date.getTime());
        expect(adapter.fetchBarsBefore.mock.calls.some((call) => call[1] === "4h")).toBe(true);
        await act(async () => {
            resolveStaleBackfill(staleOlderBars);
            await flushMicrotasks();
        });
        const barsAfterStaleResolve = handleBarsChange.mock.calls.at(-1)?.[0];
        expect(barsAfterStaleResolve).toHaveLength(initialBars4h.length);
        expect(barsAfterStaleResolve[0]?.date.getTime()).toBe(initialBars4h[0].date.getTime());
    });
    it("ignores a stale left refill response after switching to controlled mode with the same dataset key", async () => {
        const initialBars = [
            createBar("2026-05-20T00:00:00Z", 100, 0),
            createBar("2026-05-20T01:00:00Z", 101, 1),
            createBar("2026-05-20T02:00:00Z", 102, 2),
        ];
        const controlledBars = [
            createBar("2026-05-21T00:00:00Z", 200, 0),
            createBar("2026-05-21T01:00:00Z", 201, 1),
            createBar("2026-05-21T02:00:00Z", 202, 2),
        ];
        const staleOlderBars = [
            createBar("2026-05-19T22:00:00Z", 98, 0),
            createBar("2026-05-19T23:00:00Z", 99, 1),
        ];
        const handleBarsChange = vi.fn();
        let resolveStaleBackfill;
        const staleBackfillPromise = new Promise((resolve) => {
            resolveStaleBackfill = resolve;
        });
        const adapter = {
            fetchBarsInRange: vi.fn().mockResolvedValue(initialBars),
            fetchBarsBefore: vi.fn()
                .mockImplementationOnce(() => staleBackfillPromise)
                .mockResolvedValue([]),
            subscribeToBar: vi.fn().mockReturnValue(() => undefined),
            subscribeToTrades: vi.fn().mockReturnValue(() => undefined),
            subscribeToOrderbook: vi.fn().mockReturnValue(() => undefined),
            searchSymbols: vi.fn().mockResolvedValue([]),
        };
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, symbol: "BTCUSDT", timeframe: "1h", onBarsChange: handleBarsChange, showNonTradingDays: true }));
            await flushMicrotasks();
        });
        await waitForBarsEmission(() => {
            const calls = handleBarsChange.mock.calls;
            return calls.some((call) => {
                const bars = call[0];
                return Array.isArray(bars) && bars.length === initialBars.length;
            });
        });
        expect(adapter.fetchBarsBefore).toHaveBeenCalledTimes(1);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: controlledBars, symbol: "BTCUSDT", timeframe: "1h", onBarsChange: handleBarsChange, showNonTradingDays: true }));
            await flushMicrotasks();
        });
        const barsBeforeStaleResolve = handleBarsChange.mock.calls.at(-1)?.[0];
        expect(barsBeforeStaleResolve.map((bar) => bar.date.toISOString())).toEqual(controlledBars.map((bar) => bar.date.toISOString()));
        await act(async () => {
            resolveStaleBackfill(staleOlderBars);
            await flushMicrotasks();
        });
        const barsAfterStaleResolve = handleBarsChange.mock.calls.at(-1)?.[0];
        expect(barsAfterStaleResolve.map((bar) => bar.date.toISOString())).toEqual(controlledBars.map((bar) => bar.date.toISOString()));
        expect(adapter.fetchBarsBefore).toHaveBeenCalledTimes(1);
    });
    it("stops left-side fetching once the retention window is covered", async () => {
        const initialBars = [
            createBar("2026-05-20T00:00:00Z", 100, 0),
            createBar("2026-05-20T01:00:00Z", 101, 1),
            createBar("2026-05-20T02:00:00Z", 102, 2),
        ];
        const olderBars = [
            createBar("2026-05-19T22:00:00Z", 98, 0),
            createBar("2026-05-19T23:00:00Z", 99, 1),
        ];
        const adapter = {
            fetchBarsInRange: vi.fn().mockResolvedValue(initialBars),
            fetchBarsBefore: vi.fn()
                .mockResolvedValueOnce(olderBars)
                .mockResolvedValueOnce([]),
            subscribeToBar: vi.fn().mockReturnValue(() => undefined),
            subscribeToTrades: vi.fn().mockReturnValue(() => undefined),
            subscribeToOrderbook: vi.fn().mockReturnValue(() => undefined),
            searchSymbols: vi.fn().mockResolvedValue([]),
        };
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, symbol: "BTCUSDT", timeframe: "1h", showNonTradingDays: true, historyMinResidentBars: 0 }));
            for (let iteration = 0; iteration < 8; iteration += 1) {
                await flushMicrotasks();
            }
        });
        expect(adapter.fetchBarsBefore).toHaveBeenCalledTimes(1);
        expect(adapter.fetchBarsBefore).toHaveBeenNthCalledWith(1, "BTCUSDT", "1h", expect.any(Date), 1000);
        const firstBefore = adapter.fetchBarsBefore.mock.calls[0]?.[2];
        expect(firstBefore.getTime()).toBe(initialBars[0].date.getTime());
    });
    it("uses adapter backward coverage to stop redundant left refills at the true boundary", async () => {
        const initialBars = [
            createBar("2026-05-20T00:00:00Z", 100, 0),
            createBar("2026-05-20T01:00:00Z", 101, 1),
            createBar("2026-05-20T02:00:00Z", 102, 2),
        ];
        const boundaryBar = createBar("2026-05-19T23:00:00Z", 99, 0);
        const backwardCoverage = [
            { fromTs: 0, toTs: boundaryBar.date.getTime(), status: "unresolved", reason: "boundary-exhausted" },
            { fromTs: boundaryBar.date.getTime(), toTs: boundaryBar.date.getTime(), status: "covered" },
        ];
        const adapter = {
            fetchBarsInRange: vi.fn().mockResolvedValue(initialBars),
            fetchBarsBefore: vi.fn().mockResolvedValue([boundaryBar]),
            getLastBackfillCoverage: vi.fn(() => backwardCoverage),
            subscribeToBar: vi.fn().mockReturnValue(() => undefined),
            subscribeToTrades: vi.fn().mockReturnValue(() => undefined),
            subscribeToOrderbook: vi.fn().mockReturnValue(() => undefined),
            searchSymbols: vi.fn().mockResolvedValue([]),
        };
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, symbol: "BTCUSDT", timeframe: "1h", showNonTradingDays: true, historyMinResidentBars: 0 }));
            for (let iteration = 0; iteration < 12; iteration += 1) {
                await flushMicrotasks();
            }
        });
        expect(adapter.fetchBarsBefore).toHaveBeenCalledTimes(1);
        expect(adapter.getLastBackfillCoverage).toHaveBeenCalled();
    });
    it("uses adapter range coverage to stop redundant right refills at the live edge", async () => {
        const initialBars = [
            createBar("2026-05-19T23:00:00Z", 99, 0),
            createBar("2026-05-20T00:00:00Z", 100, 1),
            createBar("2026-05-20T01:00:00Z", 101, 2),
        ];
        const newerBars = [
            createBar("2026-05-20T01:00:00Z", 101, 0),
            createBar("2026-05-20T02:00:00Z", 102, 1),
        ];
        const rangeCoverage = [
            { fromTs: newerBars[0].date.getTime(), toTs: newerBars[1].date.getTime(), status: "covered" },
            { fromTs: newerBars[1].date.getTime(), toTs: new Date("2026-05-20T03:00:00Z").getTime(), status: "unresolved", reason: "boundary-exhausted" },
        ];
        const handleBarsChange = vi.fn();
        const adapter = {
            fetchBarsInRange: vi.fn()
                .mockResolvedValueOnce(initialBars)
                .mockResolvedValue(newerBars),
            getLastRangeCoverage: vi.fn(() => rangeCoverage),
            fetchBarsBefore: vi.fn().mockResolvedValue([]),
            subscribeToBar: vi.fn().mockReturnValue(() => undefined),
            subscribeToTrades: vi.fn().mockReturnValue(() => undefined),
            subscribeToOrderbook: vi.fn().mockReturnValue(() => undefined),
            searchSymbols: vi.fn().mockResolvedValue([]),
        };
        visibleDomainEmitted = true;
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, symbol: "BTCUSDT", timeframe: "1h", engineRuntime: "legacy", onBarsChange: handleBarsChange, showNonTradingDays: true, historyMinResidentBars: 0 }));
            await flushMicrotasks();
        });
        await waitForBarsEmission(() => handleBarsChange.mock.calls.some((call) => {
            const bars = call[0];
            return Array.isArray(bars) && bars.length === initialBars.length;
        }));
        await emitVisibleDomain([
            new Date("2026-05-20T00:00:00Z"),
            new Date("2026-05-20T01:00:00Z"),
        ]);
        await waitForBarsEmission(() => {
            const bars = handleBarsChange.mock.calls.at(-1)?.[0];
            return Array.isArray(bars)
                && bars.length === 4
                && bars[3]?.date.toISOString() === "2026-05-20T02:00:00.000Z";
        });
        expect(adapter.fetchBarsInRange).toHaveBeenCalledTimes(2);
        expect(adapter.getLastRangeCoverage).toHaveBeenCalled();
    });
    it("resets the no-more-history stop condition when the dataset changes", async () => {
        const initialBars1h = [
            createBar("2026-05-20T00:00:00Z", 100, 0),
            createBar("2026-05-20T01:00:00Z", 101, 1),
            createBar("2026-05-20T02:00:00Z", 102, 2),
        ];
        const initialBars4h = [
            createBar("2026-05-21T00:00:00Z", 200, 0),
            createBar("2026-05-21T04:00:00Z", 204, 1),
            createBar("2026-05-21T08:00:00Z", 208, 2),
        ];
        const adapter = {
            fetchBarsInRange: vi.fn().mockImplementation((_symbol, timeframe) => {
                return Promise.resolve(timeframe === "4h" ? initialBars4h : initialBars1h);
            }),
            fetchBarsBefore: vi.fn().mockResolvedValue([]),
            subscribeToBar: vi.fn().mockReturnValue(() => undefined),
            subscribeToTrades: vi.fn().mockReturnValue(() => undefined),
            subscribeToOrderbook: vi.fn().mockReturnValue(() => undefined),
            searchSymbols: vi.fn().mockResolvedValue([]),
        };
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, symbol: "BTCUSDT", timeframe: "1h", showNonTradingDays: true }));
            await flushMicrotasks();
        });
        expect(adapter.fetchBarsBefore).toHaveBeenNthCalledWith(1, "BTCUSDT", "1h", expect.any(Date), 1000);
        visibleDomainEmitted = false;
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, symbol: "BTCUSDT", timeframe: "4h", showNonTradingDays: true }));
            await flushMicrotasks();
        });
        // With EMPTY_BACKFILL_LOCK_THRESHOLD=3, the adapter may be called multiple times
        // for the 1h timeframe before switching to 4h. We verify that at least one 4h call happened.
        expect(adapter.fetchBarsBefore.mock.calls.some((call) => call[1] === "4h" && call[0] === "BTCUSDT")).toBe(true);
    });
    it("creates a new uncontrolled session after leaving controlled mode with the same symbol and timeframe", async () => {
        const initialBars = [
            createBar("2026-05-20T00:00:00Z", 100, 0),
            createBar("2026-05-20T01:00:00Z", 101, 1),
            createBar("2026-05-20T02:00:00Z", 102, 2),
        ];
        const controlledBars = [
            createBar("2026-05-21T00:00:00Z", 200, 0),
            createBar("2026-05-21T01:00:00Z", 201, 1),
        ];
        const adapter = {
            fetchBarsInRange: vi.fn().mockResolvedValue(initialBars),
            fetchBarsBefore: vi.fn().mockResolvedValue([]),
            subscribeToBar: vi.fn().mockReturnValue(() => undefined),
            subscribeToTrades: vi.fn().mockReturnValue(() => undefined),
            subscribeToOrderbook: vi.fn().mockReturnValue(() => undefined),
            searchSymbols: vi.fn().mockResolvedValue([]),
        };
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, symbol: "BTCUSDT", timeframe: "1h", showNonTradingDays: true }));
            for (let iteration = 0; iteration < 6; iteration += 1) {
                await flushMicrotasks();
            }
        });
        // With EMPTY_BACKFILL_LOCK_THRESHOLD=3, the system retries up to 3 times
        // before locking on empty backfill. Verify at least 1 call was made.
        expect(adapter.fetchBarsBefore.mock.calls.length).toBeGreaterThanOrEqual(1);
        const callCountAfterFirstSession = adapter.fetchBarsBefore.mock.calls.length;
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: controlledBars, symbol: "BTCUSDT", timeframe: "1h", showNonTradingDays: true }));
            await flushMicrotasks();
        });
        visibleDomainEmitted = false;
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, symbol: "BTCUSDT", timeframe: "1h", showNonTradingDays: true }));
            for (let iteration = 0; iteration < 6; iteration += 1) {
                await flushMicrotasks();
            }
        });
        await act(async () => {
            latestVisibleDomainHandler?.([initialBars[0].date, initialBars[1].date]);
            await flushMicrotasks();
        });
        // Verify that the second uncontrolled session triggered NEW backfill calls
        // (count increased from the first session). With threshold=3, total may be > 2.
        expect(adapter.fetchBarsBefore.mock.calls.length).toBeGreaterThan(callCountAfterFirstSession);
        // The calls from the second session should target the correct symbol+timeframe.
        expect(adapter.fetchBarsBefore).toHaveBeenLastCalledWith("BTCUSDT", "1h", expect.any(Date), 1000);
    });
    it("automatically triggers continuous backfill when a gap on the left persists in Fork Mode", async () => {
        const initialBars = [
            createBar("2026-05-20T03:00:00Z", 103, 3),
            createBar("2026-05-20T04:00:00Z", 104, 4),
            createBar("2026-05-20T05:00:00Z", 105, 5),
        ];
        const firstOlderBars = [
            createBar("2026-05-20T01:00:00Z", 101, 1),
            createBar("2026-05-20T02:00:00Z", 102, 2),
        ];
        const secondOlderBars = [
            createBar("2026-05-19T23:00:00Z", 99, -1),
            createBar("2026-05-20T00:00:00Z", 100, 0),
        ];
        let resolveFirstOlderBars;
        const firstOlderBarsPromise = new Promise((resolve) => {
            resolveFirstOlderBars = resolve;
        });
        const adapter = {
            fetchBarsInRange: vi.fn().mockResolvedValue(initialBars),
            fetchBarsBefore: vi.fn()
                .mockImplementationOnce(() => firstOlderBarsPromise)
                .mockResolvedValueOnce(secondOlderBars)
                .mockResolvedValue([]),
            subscribeToBar: vi.fn().mockReturnValue(() => undefined),
            subscribeToTrades: vi.fn().mockReturnValue(() => undefined),
            subscribeToOrderbook: vi.fn().mockReturnValue(() => undefined),
            searchSymbols: vi.fn().mockResolvedValue([]),
        };
        mockVisibleRange = { from: 1, to: 2 };
        autoEmitForkVisibleRange = false;
        mockEngineInstance.getVisibleRange.mockReturnValue({ from: 1, to: 2 });
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, symbol: "BTCUSDT", timeframe: "1h", engineRuntime: "fork", showNonTradingDays: true }));
            for (let iteration = 0; iteration < 8; iteration += 1) {
                await flushMicrotasks();
            }
        });
        expect(adapter.fetchBarsInRange).toHaveBeenCalled();
        await waitForPredicate(() => adapter.fetchBarsBefore.mock.calls.length === 1);
        const initialFetchCount = adapter.fetchBarsBefore.mock.calls.length;
        // Move camera to have a large gap on the left: from -5 to 2
        const visibleRangeHandler = await waitForForkVisibleRangeHandler();
        await act(async () => {
            mockEngineInstance.getVisibleRange.mockReturnValue({ from: -5, to: 2 });
            visibleRangeHandler({ from: -5, to: 2 });
            for (let iteration = 0; iteration < 8; iteration += 1) {
                await flushMicrotasks();
            }
        });
        // Resolve first backfill, which prepends 2 bars.
        // Camera should automatically shift by +2 bars to keep visual date stable (from -5 to -3).
        // Since from is -3 (still negative), it should automatically trigger the next backfill sync!
        await act(async () => {
            resolveFirstOlderBars?.(firstOlderBars);
            for (let iteration = 0; iteration < 8; iteration += 1) {
                await flushMicrotasks();
            }
        });
        // The zoomToRange shift from useEffect will execute zoomToRange({ from: -3, to: 4 }).
        // In our test, we simulate the engine emitting this shifted range.
        await act(async () => {
            mockEngineInstance.getVisibleRange.mockReturnValue({ from: -3, to: 4 });
            visibleRangeHandler({ from: -3, to: 4 });
            for (let iteration = 0; iteration < 8; iteration += 1) {
                await flushMicrotasks();
            }
        });
        // Verify that it automatically triggered the next backfill sync (fetchBarsBefore call count increases).
        await waitForPredicate(() => adapter.fetchBarsBefore.mock.calls.length > initialFetchCount);
        expect(adapter.fetchBarsBefore.mock.calls.length).toBeGreaterThan(initialFetchCount);
    });
});
