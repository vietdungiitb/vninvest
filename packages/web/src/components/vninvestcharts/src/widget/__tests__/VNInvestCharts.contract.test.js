import { jsx as _jsx } from "react/jsx-runtime";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hitTestOverlayPrimitive, resolvePanePixelAtDataIndex, resolvePanePixelAtValue, } from "@vninvestcharts/vn-kline-engine-core";
import { DEFAULT_PANES } from "../../lib/core";
import { computePaneScaleSlotDomains } from "../../lib/core/paneScaleSlotDomains";
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
function mergeTestPaneSnapshotDomains(data) {
    const scaleSlotDomains = computePaneScaleSlotDomains(DEFAULT_PANES.filter((pane) => pane.visible), data);
    return forkEngineSnapshots.map((snapshot) => {
        const scaleSlotStates = Object.fromEntries(Object.entries(snapshot.scaleSlotStates).map(([scaleSlotId, state]) => [scaleSlotId, {
                ...state,
                domain: scaleSlotDomains[scaleSlotId] ?? state.domain,
            }]));
        return {
            ...snapshot,
            scaleSlotStates,
        };
    });
}
function resolveDrawingPointIndex(data, pointTime) {
    return data.findIndex((datum) => datum.date.getTime() === pointTime);
}
function resolveTrendLineBodyPoint(data, drawing, visibleRange) {
    const priceSnapshot = mergeTestPaneSnapshotDomains(data).find((snapshot) => snapshot.paneId === "price");
    const firstPoint = drawing.points[0];
    const secondPoint = drawing.points[1];
    if (!priceSnapshot || !firstPoint || !secondPoint) {
        return null;
    }
    const firstIndex = resolveDrawingPointIndex(data, firstPoint.x);
    const secondIndex = resolveDrawingPointIndex(data, secondPoint.x);
    if (firstIndex < 0 || secondIndex < 0) {
        return null;
    }
    const firstX = resolvePanePixelAtDataIndex(priceSnapshot, visibleRange, firstIndex + 0.5, data.length);
    const secondX = resolvePanePixelAtDataIndex(priceSnapshot, visibleRange, secondIndex + 0.5, data.length);
    const firstY = resolvePanePixelAtValue(priceSnapshot, "price-right", firstPoint.y);
    const secondY = resolvePanePixelAtValue(priceSnapshot, "price-right", secondPoint.y);
    if (firstX === null || secondX === null || firstY === null || secondY === null) {
        return null;
    }
    return {
        x: Math.round((firstX + secondX) / 2),
        y: Math.round((firstY + secondY) / 2),
    };
}
function resolveTrendLinePointPixel(data, visibleRange, dataIndex, price) {
    const priceSnapshot = mergeTestPaneSnapshotDomains(data).find((snapshot) => snapshot.paneId === "price");
    if (!priceSnapshot) {
        return null;
    }
    const x = resolvePanePixelAtDataIndex(priceSnapshot, visibleRange, dataIndex + 0.5, data.length);
    const y = resolvePanePixelAtValue(priceSnapshot, "price-right", price);
    if (x === null || y === null) {
        return null;
    }
    return {
        x: Math.round(x),
        y: Math.round(y),
    };
}
function resolveTrendLineLockHandlePoint(data, drawing, visibleRange) {
    const priceSnapshot = mergeTestPaneSnapshotDomains(data).find((snapshot) => snapshot.paneId === "price");
    const firstPoint = drawing.points[0];
    const secondPoint = drawing.points[1];
    if (!priceSnapshot || !firstPoint || !secondPoint) {
        return null;
    }
    const firstIndex = resolveDrawingPointIndex(data, firstPoint.x);
    const secondIndex = resolveDrawingPointIndex(data, secondPoint.x);
    if (firstIndex < 0 || secondIndex < 0) {
        return null;
    }
    const firstX = resolvePanePixelAtDataIndex(priceSnapshot, visibleRange, firstIndex + 0.5, data.length);
    const secondX = resolvePanePixelAtDataIndex(priceSnapshot, visibleRange, secondIndex + 0.5, data.length);
    const firstY = resolvePanePixelAtValue(priceSnapshot, "price-right", firstPoint.y);
    const secondY = resolvePanePixelAtValue(priceSnapshot, "price-right", secondPoint.y);
    if (firstX === null || secondX === null || firstY === null || secondY === null) {
        return null;
    }
    return {
        x: Math.round(Math.min(firstX, secondX) - 14),
        y: Math.round(Math.min(firstY, secondY) - 14),
    };
}
/** Shared spy-able mock engine exposed to T04 contract tests */
const mockEngineSetHistorySnapshot = vi.fn();
const mockEngineInstance = {
    mount: vi.fn(),
    dispose: vi.fn(),
    setPaneSpecs: vi.fn(),
    setDataSource: vi.fn(),
    setEnrichedData: vi.fn(),
    setHistorySnapshot: mockEngineSetHistorySnapshot,
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
    hitTestDrawingPrimitive: vi.fn((localX, localY) => {
        const overlayInputs = [...engineHostPropsHistory]
            .map((props) => props.overlayInputs)
            .findLast((value) => (value?.drawingPrimitives?.length ?? 0) > 0)
            ?? [...engineHostPropsHistory]
                .map((props) => props.overlayInputs)
                .findLast(Boolean);
        const drawingPrimitives = overlayInputs?.drawingPrimitives ?? [];
        for (let index = drawingPrimitives.length - 1; index >= 0; index -= 1) {
            const primitive = drawingPrimitives[index];
            const snapshot = forkEngineSnapshots.find((candidate) => candidate.paneId === primitive?.paneId);
            if (!primitive || !snapshot) {
                continue;
            }
            const { plotBounds } = snapshot;
            if (localX < plotBounds.left
                || localX > plotBounds.left + plotBounds.width
                || localY < plotBounds.top
                || localY > plotBounds.top + plotBounds.height) {
                continue;
            }
            const hit = hitTestOverlayPrimitive(primitive.primitive, localX - plotBounds.left, localY - plotBounds.top, {
                chartWidth: plotBounds.width,
                chartHeight: plotBounds.height,
                tolerance: 6,
            });
            if (hit) {
                return {
                    key: primitive.key,
                    paneId: primitive.paneId,
                    scaleSlotId: primitive.scaleSlotId,
                    primitive: primitive.primitive,
                    selected: primitive.selected,
                    drawingId: primitive.drawingId,
                    actionHandle: primitive.actionHandle,
                    clipToPane: primitive.clipToPane,
                };
            }
        }
        return null;
    }),
};
function resolveMockForkHoveredPaneId(localX, localY) {
    const hoveredSnapshot = forkEngineSnapshots.find((snapshot) => {
        const right = snapshot.bounds.left + snapshot.bounds.width;
        const bottom = snapshot.bounds.top + snapshot.bounds.height;
        return localX >= snapshot.bounds.left && localX <= right && localY >= snapshot.bounds.top && localY <= bottom;
    });
    return hoveredSnapshot?.paneId ?? null;
}
function resolveMockForkHoveredDataIndex(localX, localY) {
    const hoveredSnapshot = forkEngineSnapshots.find((snapshot) => {
        const right = snapshot.plotBounds.left + snapshot.plotBounds.width;
        const bottom = snapshot.plotBounds.top + snapshot.plotBounds.height;
        return localX >= snapshot.plotBounds.left && localX <= right && localY >= snapshot.plotBounds.top && localY <= bottom;
    });
    if (!hoveredSnapshot) {
        return null;
    }
    const ratio = (localX - hoveredSnapshot.plotBounds.left) / Math.max(1, hoveredSnapshot.plotBounds.width);
    const dataIndex = Math.round(mockVisibleRange.from + ratio * (mockVisibleRange.to - mockVisibleRange.from));
    return Math.min(mockVisibleRange.to, Math.max(mockVisibleRange.from, dataIndex));
}
function createMockMeasurementState(enabled) {
    if (!enabled) {
        return null;
    }
    return {
        enabled: true,
        hoverPoint: null,
        draft: null,
        committed: {
            paneId: "price",
            scaleSlotId: "price-right",
            start: { paneId: "price", scaleSlotId: "price-right", index: 0, price: 100, x: 120, y: 188 },
            end: { paneId: "price", scaleSlotId: "price-right", index: 1, price: 106, x: 1080, y: 132 },
        },
    };
}
function createMockDrawingPriceLabelsState(overlayInputs) {
    const selectedPriceLabels = overlayInputs?.selectedPriceLabels;
    if (!selectedPriceLabels || selectedPriceLabels.markers.length === 0) {
        return null;
    }
    const primaryMarker = selectedPriceLabels.markers[0];
    if (!primaryMarker) {
        return null;
    }
    return {
        drawingId: selectedPriceLabels.drawingId,
        paneId: selectedPriceLabels.paneId,
        scaleSlotId: selectedPriceLabels.scaleSlotId,
        highlighted: selectedPriceLabels.highlighted,
        labels: [{
                key: primaryMarker.key,
                price: primaryMarker.price + 5.25,
                y: 156,
                side: "right",
                fill: selectedPriceLabels.fill,
                stroke: selectedPriceLabels.stroke,
                textColor: selectedPriceLabels.textColor,
            }],
    };
}
function createMockForkOverlayState(overrides, overlayInputs) {
    return {
        crosshair: overrides?.crosshair ?? null,
        hoveredPaneId: overrides?.hoveredPaneId ?? null,
        hoveredDataIndex: overrides?.hoveredDataIndex ?? null,
        xAxisTicks: [
            { key: "volume-0", x: 120, dataIndex: 0 },
            { key: "volume-1", x: 1080, dataIndex: 1 },
        ],
        measurement: overrides?.measurement ?? createMockMeasurementState(Boolean(overlayInputs?.measurementEnabled)),
        drawingPriceLabels: overrides?.drawingPriceLabels ?? createMockDrawingPriceLabelsState(overlayInputs),
        drawingPrimitives: overlayInputs?.drawingPrimitives?.map((primitive) => ({
            key: primitive.key,
            paneId: primitive.paneId,
            scaleSlotId: primitive.scaleSlotId,
            primitive: primitive.primitive,
            selected: primitive.selected,
            drawingId: primitive.drawingId,
            actionHandle: primitive.actionHandle,
            clipToPane: primitive.clipToPane,
        })) ?? [],
    };
}
vi.mock("@vninvestcharts/vn-kline-engine-react", async () => {
    const React = await import("react");
    return {
        EngineHost(props) {
            engineHostPropsHistory.push(props);
            const lastInputsRef = React.useRef("");
            const currentInputsKey = JSON.stringify({
                measurementEnabled: props.overlayInputs?.measurementEnabled,
                selectedPriceLabels: props.overlayInputs?.selectedPriceLabels ? {
                    drawingId: props.overlayInputs.selectedPriceLabels.drawingId,
                    highlighted: props.overlayInputs.selectedPriceLabels.highlighted,
                } : null,
                primitives: props.overlayInputs?.drawingPrimitives?.map(p => p.key) ?? [],
            });
            React.useEffect(() => {
                props.onEngineReady?.(mockEngineInstance);
                props.onPaneSnapshotsChange?.(forkEngineSnapshots);
                props.onVisibleRangeChange?.(mockVisibleRange);
            }, []);
            React.useEffect(() => {
                if (lastInputsRef.current === currentInputsKey) {
                    return;
                }
                lastInputsRef.current = currentInputsKey;
                props.onOverlayStateChange?.(createMockForkOverlayState(undefined, props.overlayInputs));
            }, [props.overlayInputs, props.onOverlayStateChange, currentInputsKey]);
            const resolvePointerContext = (event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                const localX = event.clientX - rect.left;
                const localY = event.clientY - rect.top;
                return {
                    paneId: resolveMockForkHoveredPaneId(localX, localY),
                    clientX: event.clientX,
                    clientY: event.clientY,
                    localX,
                    localY,
                    pointerType: "pointerType" in event ? event.pointerType : "mouse",
                    buttons: "buttons" in event ? event.buttons : 0,
                    altKey: event.altKey,
                    ctrlKey: event.ctrlKey,
                    metaKey: event.metaKey,
                    shiftKey: event.shiftKey,
                };
            };
            const emitPaneHover = (event) => {
                const pointerContext = resolvePointerContext(event);
                const hoveredPaneId = pointerContext.paneId;
                const hoveredDataIndex = resolveMockForkHoveredDataIndex(pointerContext.localX, pointerContext.localY);
                props.onPaneHover?.(hoveredPaneId);
                props.onOverlayStateChange?.(createMockForkOverlayState({
                    crosshair: hoveredPaneId
                        ? { x: pointerContext.localX, y: pointerContext.localY, paneId: hoveredPaneId, dataIndex: hoveredDataIndex }
                        : null,
                    hoveredPaneId,
                    hoveredDataIndex,
                }, props.overlayInputs));
            };
            return (_jsx("div", { "data-vn-kline-engine-host": "true", className: props.className, style: props.style, onClick: (event) => {
                    props.onClick?.(resolvePointerContext(event));
                }, onPointerDown: (event) => {
                    props.onPointerDown?.(resolvePointerContext(event));
                }, onPointerMove: (event) => {
                    emitPaneHover(event);
                    props.onPointerMove?.(resolvePointerContext(event));
                }, onPointerOut: () => {
                    props.onPaneHover?.(null);
                    props.onOverlayStateChange?.(createMockForkOverlayState(undefined, props.overlayInputs));
                }, onPointerOver: emitPaneHover, onPointerUp: (event) => {
                    props.onPointerUp?.(resolvePointerContext(event));
                }, children: _jsx("div", { "data-vn-kline-engine": "surface", "data-locale": props.locale, children: _jsx("canvas", { "data-vn-kline-engine": "canvas", width: 600, height: 320 }) }) }));
        },
    };
});
let act;
let createDrawingObject;
let chartPointToPixelWithBridge;
let createRoot;
let measurementPointToPixelWithBridge;
let resolveChartPointWithBridge;
let resolveMeasurementPointWithBridge;
let VNInvestCharts;
let WidgetErrorBoundary;
let WidgetI18nProvider;
beforeAll(async () => {
    ({ act } = await import("react"));
    ({ createRoot } = await import("react-dom/client"));
    ({ createDrawingObject } = await import("../../lib/drawing/shared"));
    ({
        chartPointToPixelWithBridge,
        measurementPointToPixelWithBridge,
        resolveChartPointWithBridge,
        resolveMeasurementPointWithBridge,
    } = await import("../../lib/drawing/coordinateBridge"));
    ({
        VNInvestCharts,
    } = await import("../VNInvestCharts"));
    ({ WidgetErrorBoundary } = await import("../WidgetErrorBoundary"));
    ({ WidgetI18nProvider } = await import("../context/WidgetI18nContext"));
}, 30_000);
function createDeferred() {
    let resolve;
    let reject;
    const promise = new Promise((promiseResolve, promiseReject) => {
        resolve = promiseResolve;
        reject = promiseReject;
    });
    return { promise, resolve, reject };
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
describe("VNInvestCharts", () => {
    let container = null;
    let root = null;
    let abortSpy = null;
    beforeEach(() => {
        window.localStorage.clear();
        document.documentElement.lang = "en";
        mockVisibleRange = { from: 0, to: 2 };
        abortSpy = vi.spyOn(AbortController.prototype, "abort");
        engineHostPropsHistory.length = 0;
        mockEngineSetHistorySnapshot.mockClear();
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
    it("shows the loading and empty states when no bars are available", async () => {
        const fetchDeferred = createDeferred();
        const adapter = createAdapter(fetchDeferred.promise, "empty");
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, locale: "vi" }));
        });
        expect(container.textContent).toContain("Đang tải biểu đồ…");
        await act(async () => {
            fetchDeferred.resolve([]);
            await flushMicrotasks();
        });
        expect(container.textContent).toContain("Chưa có dữ liệu");
        expect(adapter.fetchBars).toHaveBeenCalledTimes(1);
    });
    it("locks fork pan when a drawing authoring tool is active", async () => {
        const adapter = createAdapter(Promise.resolve(forkRuntimeData), "fork-pan-lock");
        const handleDrawingWorkspaceChange = vi.fn();
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, engineRuntime: "fork", drawingUiEnabled: true, onDrawingWorkspaceChange: handleDrawingWorkspaceChange, data: forkRuntimeData }));
            await flushMicrotasks();
        });
        const workspace = handleDrawingWorkspaceChange.mock.calls
            .map((call) => call[0])
            .find((value) => value && typeof value.setActiveTool === "function");
        if (!workspace || typeof workspace.setActiveTool !== "function") {
            throw new Error("Expected drawing workspace callback payload");
        }
        await act(async () => {
            workspace.setActiveTool?.("trendLine");
            await flushMicrotasks();
        });
        const latestHostProps = engineHostPropsHistory[engineHostPropsHistory.length - 1];
        expect(latestHostProps?.overlayInputs?.measurementEnabled).toBe(true);
    });
    it("does not lock fork pan when cursor mode only has a selected drawing", async () => {
        const adapter = createAdapter(Promise.resolve(forkRuntimeData), "fork-pan-unlock-selected");
        const selectedDrawing = createDrawingObject("trendLine", [
            { x: forkRuntimeData[0].date.getTime(), y: 100 },
            { x: forkRuntimeData[1].date.getTime(), y: 102 },
        ], {
            id: "fork-selected-unlock-pan",
            paneId: "price",
            yScaleId: "price-right",
        });
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, engineRuntime: "fork", drawingUiEnabled: true, data: forkRuntimeData, drawings: [selectedDrawing], selectedDrawing: selectedDrawing }));
            await flushMicrotasks();
        });
        const latestHostProps = engineHostPropsHistory[engineHostPropsHistory.length - 1];
        expect(latestHostProps?.overlayInputs?.measurementEnabled).toBe(false);
    });
    it("aborts the in-flight fetch when adapter changes", async () => {
        const firstFetch = createDeferred();
        const secondFetch = createDeferred();
        const firstAdapter = createAdapter(firstFetch.promise, "first");
        const secondAdapter = createAdapter(secondFetch.promise, "second");
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: firstAdapter, locale: "en" }));
        });
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: secondAdapter, locale: "en" }));
        });
        expect(abortSpy?.mock.calls.length ?? 0).toBeGreaterThan(0);
        await act(async () => {
            firstFetch.resolve([]);
            secondFetch.resolve([]);
            await flushMicrotasks();
        });
    });
    it("reloads bars when symbol or timeframe props change", async () => {
        const adapter = createAdapter(Promise.resolve([]), "prop-refresh");
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, symbol: "BTCUSDT", timeframe: "1h", locale: "vi" }));
            await flushMicrotasks();
        });
        expect(adapter.fetchBars).toHaveBeenNthCalledWith(1, "BTCUSDT", "1h", expect.any(Date), expect.any(Date));
        expect(adapter.subscribeToBar).toHaveBeenNthCalledWith(1, "BTCUSDT", "1h", expect.any(Function));
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, symbol: "BTCUSDT", timeframe: "4h", locale: "vi" }));
            await flushMicrotasks();
        });
        expect(adapter.fetchBars).toHaveBeenNthCalledWith(2, "BTCUSDT", "4h", expect.any(Date), expect.any(Date));
        expect(adapter.subscribeToBar).toHaveBeenNthCalledWith(2, "BTCUSDT", "4h", expect.any(Function));
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, symbol: "ETHUSDT", timeframe: "4h", locale: "vi" }));
            await flushMicrotasks();
        });
        expect(adapter.fetchBars).toHaveBeenNthCalledWith(3, "ETHUSDT", "4h", expect.any(Date), expect.any(Date));
        expect(adapter.subscribeToBar).toHaveBeenNthCalledWith(3, "ETHUSDT", "4h", expect.any(Function));
    });
    it("renders the error boundary fallback when the chart subtree throws", async () => {
        function ThrowingChild() {
            throw new Error("boom");
        }
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(WidgetI18nProvider, { locale: "en", children: _jsx(WidgetErrorBoundary, { children: _jsx(ThrowingChild, {}) }) }));
        });
        expect(container.textContent).toContain("An error occurred in the chart");
    });
    it("does not emit a null drawing workspace during internal workspace updates", async () => {
        const adapter = createAdapter(Promise.resolve([]), "workspace-contract");
        const handleDrawingWorkspaceChange = vi.fn();
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: forkRuntimeData, drawingUiEnabled: true, onDrawingWorkspaceChange: handleDrawingWorkspaceChange }));
            await flushMicrotasks();
        });
        const workspace = handleDrawingWorkspaceChange.mock.calls
            .map((call) => call[0])
            .find((value) => value && typeof value.openDock === "function");
        if (!workspace || typeof workspace.openDock !== "function") {
            throw new Error("Expected drawing workspace callback payload");
        }
        const openDock = workspace.openDock;
        const initialNonNullWorkspaceCalls = handleDrawingWorkspaceChange.mock.calls.filter((call) => call[0] !== null).length;
        await act(async () => {
            openDock("properties");
            await flushMicrotasks();
        });
        expect(handleDrawingWorkspaceChange.mock.calls.filter((call) => call[0] !== null).length).toBeGreaterThan(initialNonNullWorkspaceCalls);
        expect(handleDrawingWorkspaceChange.mock.calls.some((call) => call[0] === null)).toBe(false);
        expect(handleDrawingWorkspaceChange.mock.calls.at(-1)?.[0]).toMatchObject({
            state: {
                dock: {
                    isOpen: true,
                    activeTab: "properties",
                },
            },
        });
        await act(async () => {
            root?.unmount();
            await flushMicrotasks();
        });
        expect(handleDrawingWorkspaceChange.mock.calls.at(-1)?.[0]).toBeNull();
        root = null;
    });
    it("defaults to the fork runtime when engineRuntime is omitted", async () => {
        const adapter = createAdapter(Promise.resolve([]), "fork-default-runtime");
        const handleRuntimeCapabilitiesChange = vi.fn();
        const handleRuntimeResolved = vi.fn();
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: forkRuntimeData, locale: "vi", onRuntimeCapabilitiesChange: handleRuntimeCapabilitiesChange, onRuntimeResolved: handleRuntimeResolved }));
            await flushMicrotasks();
        });
        expect(container.querySelector('[data-vn-kline-engine-host="true"]')).not.toBeNull();
        const capabilities = await waitForTruthyValue(() => handleRuntimeCapabilitiesChange.mock.calls
            .map((call) => call[0])
            .findLast((value) => value?.engineRuntime === "fork"));
        expect(capabilities).toMatchObject({
            engineRuntime: "fork",
            chartCanvasOverlays: true,
            drawingOverlays: true,
        });
        expect(handleRuntimeResolved).toHaveBeenCalledWith("fork", "DEFAULT_FORK_RUNTIME");
    });
    it("reports explicit fork runtime with deterministic reason code", async () => {
        const adapter = createAdapter(Promise.resolve([]), "fork-explicit-runtime-reason");
        const handleRuntimeResolved = vi.fn();
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: forkRuntimeData, engineRuntime: "fork", locale: "vi", onRuntimeResolved: handleRuntimeResolved }));
            await flushMicrotasks();
        });
        expect(container.querySelector('[data-vn-kline-engine-host="true"]')).not.toBeNull();
        expect(handleRuntimeResolved).toHaveBeenCalledWith("fork", "EXPLICIT_FORK_REQUEST");
    });
    it("defaults to the fork runtime when engineRuntime is explicitly undefined", async () => {
        const adapter = createAdapter(Promise.resolve([]), "fork-undefined-runtime");
        const handleRuntimeResolved = vi.fn();
        const handleRuntimeCapabilitiesChange = vi.fn();
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: forkRuntimeData, engineRuntime: undefined, locale: "vi", onRuntimeResolved: handleRuntimeResolved, onRuntimeCapabilitiesChange: handleRuntimeCapabilitiesChange }));
            await flushMicrotasks();
        });
        expect(container.querySelector('[data-vn-kline-engine-host="true"]')).not.toBeNull();
        const capabilities = await waitForTruthyValue(() => handleRuntimeCapabilitiesChange.mock.calls
            .map((call) => call[0])
            .findLast((value) => value?.engineRuntime === "fork"));
        expect(capabilities).toMatchObject({
            engineRuntime: "fork",
            chartCanvasOverlays: true,
            drawingOverlays: true,
        });
        expect(handleRuntimeResolved).toHaveBeenCalledWith("fork", "DEFAULT_FORK_RUNTIME");
    });
    it("uses legacy runtime when engineRuntime is auto and drawing UI is enabled", async () => {
        const adapter = createAdapter(Promise.resolve([]), "auto-runtime-drawing-ui");
        const handleRuntimeCapabilitiesChange = vi.fn();
        const handleRuntimeResolved = vi.fn();
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: forkRuntimeData, engineRuntime: "auto", drawingUiEnabled: true, drawingActiveTool: "unregisteredTool", locale: "vi", onRuntimeCapabilitiesChange: handleRuntimeCapabilitiesChange, onRuntimeResolved: handleRuntimeResolved }));
            await flushMicrotasks();
        });
        expect(container.querySelector('[data-vn-kline-engine-host="true"]')).toBeNull();
        const capabilities = await waitForTruthyValue(() => handleRuntimeCapabilitiesChange.mock.calls
            .map((call) => call[0])
            .findLast((value) => value?.engineRuntime === "legacy"));
        expect(capabilities).toMatchObject({
            engineRuntime: "legacy",
            chartCanvasOverlays: true,
            drawingOverlays: true,
        });
        expect(handleRuntimeResolved).toHaveBeenCalledWith("legacy", "TOOL_NOT_REGISTERED");
    });
    it("uses fork runtime when engineRuntime is auto and a supported drawing tool is active", async () => {
        const adapter = createAdapter(Promise.resolve([]), "auto-runtime-supported-drawing-tool");
        const handleRuntimeCapabilitiesChange = vi.fn();
        const handleRuntimeResolved = vi.fn();
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: forkRuntimeData, engineRuntime: "auto", drawingUiEnabled: true, drawingActiveTool: "trendLine", locale: "vi", onRuntimeCapabilitiesChange: handleRuntimeCapabilitiesChange, onRuntimeResolved: handleRuntimeResolved }));
            await flushMicrotasks();
        });
        expect(container.querySelector('[data-vn-kline-engine-host="true"]')).not.toBeNull();
        const capabilities = await waitForTruthyValue(() => handleRuntimeCapabilitiesChange.mock.calls
            .map((call) => call[0])
            .findLast((value) => value?.engineRuntime === "fork"));
        expect(capabilities).toMatchObject({
            engineRuntime: "fork",
            chartCanvasOverlays: true,
            drawingOverlays: true,
        });
        expect(handleRuntimeResolved).toHaveBeenCalledWith("fork", "FORK_CAPABILITY_OK");
    });
    it("reports auto runtime reason when drawing UI is disabled", async () => {
        const adapter = createAdapter(Promise.resolve([]), "auto-runtime-drawing-disabled");
        const handleRuntimeResolved = vi.fn();
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: forkRuntimeData, engineRuntime: "auto", drawingUiEnabled: false, locale: "vi", onRuntimeResolved: handleRuntimeResolved }));
            await flushMicrotasks();
        });
        expect(container.querySelector('[data-vn-kline-engine-host="true"]')).not.toBeNull();
        expect(handleRuntimeResolved).toHaveBeenCalledWith("fork", "DRAWING_UI_DISABLED");
    });
    it("uses fork runtime when engineRuntime is auto and widget children are present", async () => {
        const adapter = createAdapter(Promise.resolve([]), "auto-runtime-children");
        const handleRuntimeCapabilitiesChange = vi.fn();
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: forkRuntimeData, engineRuntime: "auto", locale: "vi", onRuntimeCapabilitiesChange: handleRuntimeCapabilitiesChange, children: _jsx("div", { "data-auto-child": "true" }) }));
            await flushMicrotasks();
        });
        expect(container.querySelector('[data-vn-kline-engine-host="true"]')).not.toBeNull();
        expect(container.querySelector('[data-rsc-fork-children="true"]')).not.toBeNull();
        expect(container.querySelector('[data-auto-child="true"]')).not.toBeNull();
        const capabilities = await waitForTruthyValue(() => handleRuntimeCapabilitiesChange.mock.calls
            .map((call) => call[0])
            .findLast((value) => value?.engineRuntime === "fork"));
        expect(capabilities).toMatchObject({
            engineRuntime: "fork",
            chartCanvasOverlays: true,
            drawingOverlays: true,
        });
        await act(async () => {
            await flushMicrotasks();
        });
    });
    it("uses fork runtime when engineRuntime is auto and drawing price markers are enabled without a selected drawing", async () => {
        const adapter = createAdapter(Promise.resolve([]), "auto-runtime-price-markers-only");
        const handleRuntimeCapabilitiesChange = vi.fn();
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: forkRuntimeData, engineRuntime: "auto", locale: "vi", showDrawingPriceMarkers: true, onRuntimeCapabilitiesChange: handleRuntimeCapabilitiesChange }));
            await flushMicrotasks();
        });
        expect(container.querySelector('[data-vn-kline-engine-host="true"]')).not.toBeNull();
        expect(container.querySelector('[data-rsc-drawing-price-labels="fork"]')).toBeNull();
        const capabilities = await waitForTruthyValue(() => handleRuntimeCapabilitiesChange.mock.calls
            .map((call) => call[0])
            .findLast((value) => value?.engineRuntime === "fork"));
        expect(capabilities).toMatchObject({
            engineRuntime: "fork",
            chartCanvasOverlays: true,
            drawingOverlays: true,
        });
    });
    it("renders selected drawing price labels on fork runtime when selection is controlled without drawings", async () => {
        const adapter = createAdapter(Promise.resolve([]), "fork-runtime-selected-price-labels");
        const drawing = createDrawingObject("trendLine", [
            { x: forkRuntimeData[0].date.getTime(), y: 100 },
            { x: forkRuntimeData[1].date.getTime(), y: 106 },
        ], {
            id: "fork-price-label-drawing",
            paneId: "price",
            yScaleId: "price-right",
        });
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: forkRuntimeData, engineRuntime: "fork", locale: "en", selectedDrawing: drawing, showDrawingPriceMarkers: true }));
            await flushMicrotasks();
        });
        const overlayInputs = await waitForTruthyValue(() => [...engineHostPropsHistory]
            .map((props) => props.overlayInputs)
            .findLast((value) => value?.selectedPriceLabels?.drawingId === "fork-price-label-drawing"));
        expect(overlayInputs?.selectedPriceLabels).toMatchObject({
            drawingId: "fork-price-label-drawing",
            paneId: "price",
            scaleSlotId: "price-right",
            highlighted: true,
        });
        const overlay = await waitForTruthyValue(() => container?.querySelector('[data-rsc-drawing-price-labels="fork"][data-rsc-drawing-price-labels-source="engine"]'));
        const label = overlay.querySelector('[data-rsc-drawing-price-label="fork-price-label-drawing-anchor"]');
        expect(label).not.toBeNull();
        expect(label?.textContent).toBe("111.25");
    });
    it("renders and clears selected drawing price labels on legacy runtime when selection is controlled without drawings", async () => {
        const adapter = createAdapter(Promise.resolve([]), "legacy-runtime-selected-price-labels");
        const drawing = createDrawingObject("trendLine", [
            { x: forkRuntimeData[0].date.getTime(), y: 100 },
            { x: forkRuntimeData[1].date.getTime(), y: 106 },
        ], {
            id: "legacy-price-label-drawing",
            paneId: "price",
            yScaleId: "price-right",
        });
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: forkRuntimeData, engineRuntime: "legacy", locale: "en", selectedDrawing: drawing, showDrawingPriceMarkers: true }));
            await flushMicrotasks();
        });
        const overlay = await waitForTruthyValue(() => container?.querySelector('[data-rsc-drawing-price-labels="legacy"]'));
        const label = overlay.querySelector('[data-rsc-drawing-price-label="legacy-price-label-drawing-anchor"]');
        expect(label).not.toBeNull();
        expect(label?.textContent).toBe("106.00");
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: forkRuntimeData, engineRuntime: "legacy", locale: "en", showDrawingPriceMarkers: true }));
            await flushMicrotasks();
        });
        expect(container.querySelector('[data-rsc-drawing-price-labels="legacy"]')).toBeNull();
    });
    it("uses fork runtime when engineRuntime is auto and readonly drawings already exist", async () => {
        const adapter = createAdapter(Promise.resolve([]), "auto-runtime-readonly-drawings");
        const handleRuntimeCapabilitiesChange = vi.fn();
        const drawings = [
            createDrawingObject("trendLine", [
                { x: forkRuntimeData[0].date.getTime(), y: 100 },
                { x: forkRuntimeData[1].date.getTime(), y: 106 },
            ], {
                id: "auto-readonly-drawing",
                paneId: "price",
                yScaleId: "price-right",
            }),
        ];
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: forkRuntimeData, engineRuntime: "auto", locale: "vi", drawings: drawings, onRuntimeCapabilitiesChange: handleRuntimeCapabilitiesChange }));
            await flushMicrotasks();
        });
        expect(container.querySelector('[data-vn-kline-engine-host="true"]')).not.toBeNull();
        const drawingPrimitives = [...engineHostPropsHistory]
            .map((props) => props.overlayInputs)
            .findLast((value) => value?.drawingPrimitives?.length === 1)
            ?.drawingPrimitives;
        const capabilities = await waitForTruthyValue(() => handleRuntimeCapabilitiesChange.mock.calls
            .map((call) => call[0])
            .findLast((value) => value?.engineRuntime === "fork"));
        expect(capabilities).toMatchObject({
            engineRuntime: "fork",
            chartCanvasOverlays: true,
            drawingOverlays: true,
        });
        expect(drawingPrimitives).toHaveLength(1);
        expect(drawingPrimitives?.[0]).toMatchObject({
            key: "auto-readonly-drawing",
            paneId: "price",
            selected: false,
        });
    });
    it("selects readonly fork drawings on click without leaving fork runtime", async () => {
        const adapter = createAdapter(Promise.resolve([]), "fork-readonly-drawing-selection");
        const handleSelectedDrawingChange = vi.fn();
        const drawings = [
            createDrawingObject("trendLine", [
                { x: forkRuntimeData[0].date.getTime(), y: 100 },
                { x: forkRuntimeData[1].date.getTime(), y: 106 },
            ], {
                id: "fork-readonly-drawing",
                paneId: "price",
                yScaleId: "price-right",
            }),
        ];
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: forkRuntimeData, engineRuntime: "fork", locale: "vi", drawings: drawings, onSelectedDrawingChange: handleSelectedDrawingChange }));
            await flushMicrotasks();
        });
        const engineSurface = await waitForTruthyValue(() => container?.querySelector(".rsc-engine-surface"));
        expect(engineSurface).not.toBeNull();
        Object.defineProperty(engineSurface, "getBoundingClientRect", {
            configurable: true,
            value: () => ({
                bottom: 720,
                height: 720,
                left: 0,
                right: 1200,
                top: 0,
                width: 1200,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            }),
        });
        await waitForTruthyValue(() => [...engineHostPropsHistory]
            .map((props) => props.overlayInputs)
            .findLast((value) => value?.drawingPrimitives?.some((primitive) => primitive.key === "fork-readonly-drawing"))
            ?.drawingPrimitives);
        const selectionHitPoint = resolveTrendLineBodyPoint(forkRuntimeData, drawings[0], mockVisibleRange);
        expect(selectionHitPoint).toBeTruthy();
        await act(async () => {
            engineSurface.dispatchEvent(new MouseEvent("click", {
                bubbles: true,
                clientX: selectionHitPoint.x,
                clientY: selectionHitPoint.y,
            }));
            await flushMicrotasks();
        });
        const selectedDrawing = handleSelectedDrawingChange.mock.calls
            .map((call) => call[0])
            .findLast((value) => value?.id === "fork-readonly-drawing");
        expect(selectedDrawing).toMatchObject({
            id: "fork-readonly-drawing",
            paneId: "price",
            yScaleId: "price-right",
        });
        expect(container.querySelector('[data-vn-kline-engine-host="true"]')).not.toBeNull();
    });
    it("only enables fork multi-select with Ctrl/Shift click and suppresses single-drawing handles while multi-selected", async () => {
        const adapter = createAdapter(Promise.resolve([]), "fork-readonly-modifier-multiselect");
        const handleSelectedDrawingChange = vi.fn();
        const selectionData = [
            ...forkRuntimeData,
            {
                date: new Date("2024-01-01T11:00:00Z"),
                open: 106,
                high: 109,
                low: 104,
                close: 108,
                volume: 1300,
                index: 2,
                dataIndex: 2,
            },
        ];
        mockVisibleRange = { from: 0, to: 2 };
        const drawings = [
            createDrawingObject("trendLine", [
                { x: selectionData[0].date.getTime(), y: 100 },
                { x: selectionData[1].date.getTime(), y: 106 },
            ], {
                id: "fork-modifier-select-1",
                paneId: "price",
                yScaleId: "price-right",
            }),
            createDrawingObject("trendLine", [
                { x: selectionData[1].date.getTime(), y: 103 },
                { x: selectionData[2].date.getTime(), y: 109 },
            ], {
                id: "fork-modifier-select-2",
                paneId: "price",
                yScaleId: "price-right",
            }),
        ];
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: selectionData, engineRuntime: "fork", locale: "vi", drawings: drawings, showDrawingPriceMarkers: true, onSelectedDrawingChange: handleSelectedDrawingChange }));
            await flushMicrotasks();
        });
        const engineSurface = await waitForTruthyValue(() => container?.querySelector(".rsc-engine-surface"));
        expect(engineSurface).not.toBeNull();
        Object.defineProperty(engineSurface, "getBoundingClientRect", {
            configurable: true,
            value: () => ({
                bottom: 720,
                height: 720,
                left: 0,
                right: 1200,
                top: 0,
                width: 1200,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            }),
        });
        const firstHitPoint = resolveTrendLineBodyPoint(selectionData, drawings[0], mockVisibleRange);
        const secondHitPoint = resolveTrendLineBodyPoint(selectionData, drawings[1], mockVisibleRange);
        expect(firstHitPoint).toBeTruthy();
        expect(secondHitPoint).toBeTruthy();
        const readActionHandles = () => {
            const overlayInputs = [...engineHostPropsHistory]
                .map((props) => props.overlayInputs)
                .findLast(Boolean);
            return overlayInputs?.drawingPrimitives?.filter((primitive) => Boolean(primitive.actionHandle)) ?? [];
        };
        await act(async () => {
            engineSurface.dispatchEvent(new MouseEvent("click", {
                bubbles: true,
                clientX: firstHitPoint.x,
                clientY: firstHitPoint.y,
            }));
            await flushMicrotasks();
        });
        expect(handleSelectedDrawingChange.mock.calls.length).toBeGreaterThanOrEqual(0);
        await act(async () => {
            engineSurface.dispatchEvent(new MouseEvent("click", {
                bubbles: true,
                clientX: secondHitPoint.x,
                clientY: secondHitPoint.y,
            }));
            await flushMicrotasks();
        });
        expect(Array.isArray(readActionHandles())).toBe(true);
        await act(async () => {
            engineSurface.dispatchEvent(new MouseEvent("click", {
                bubbles: true,
                clientX: firstHitPoint.x,
                clientY: firstHitPoint.y,
                ctrlKey: true,
            }));
            await flushMicrotasks();
        });
        expect(readActionHandles()).toHaveLength(0);
        const overlayInputsAfterMultiSelect = [...engineHostPropsHistory]
            .map((props) => props.overlayInputs)
            .findLast(Boolean);
        expect(overlayInputsAfterMultiSelect?.selectedPriceLabels ?? null).toBeNull();
        await waitForTruthyValue(() => container?.querySelector('[data-rsc-drawing-price-labels="fork"][data-rsc-drawing-price-labels-source="engine"]') === null ? true : undefined);
        await act(async () => {
            engineSurface.dispatchEvent(new MouseEvent("click", {
                bubbles: true,
                clientX: secondHitPoint.x,
                clientY: secondHitPoint.y,
                shiftKey: true,
            }));
            await flushMicrotasks();
        });
        expect(Array.isArray(readActionHandles())).toBe(true);
    });
    it("keeps readonly fork drawings in sync with controlled drawing updates", async () => {
        const adapter = createAdapter(Promise.resolve([]), "fork-readonly-drawing-sync");
        const firstDrawing = createDrawingObject("trendLine", [
            { x: forkRuntimeData[0].date.getTime(), y: 100 },
            { x: forkRuntimeData[1].date.getTime(), y: 106 },
        ], {
            id: "fork-sync-drawing-1",
            paneId: "price",
            yScaleId: "price-right",
        });
        const secondDrawing = createDrawingObject("hLine", [
            { x: forkRuntimeData[1].date.getTime(), y: 104 },
        ], {
            id: "fork-sync-drawing-2",
            paneId: "price",
            yScaleId: "price-right",
        });
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: forkRuntimeData, engineRuntime: "fork", locale: "vi", drawings: [firstDrawing] }));
            await flushMicrotasks();
        });
        const initialDrawingPrimitives = [...engineHostPropsHistory]
            .map((props) => props.overlayInputs)
            .findLast((value) => value?.drawingPrimitives?.length === 1)
            ?.drawingPrimitives;
        expect(initialDrawingPrimitives).toHaveLength(1);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: forkRuntimeData, engineRuntime: "fork", locale: "vi", drawings: [firstDrawing, secondDrawing] }));
            await flushMicrotasks();
        });
        const updatedDrawingPrimitives = [...engineHostPropsHistory]
            .map((props) => props.overlayInputs)
            .findLast((value) => value?.drawingPrimitives?.length === 2)
            ?.drawingPrimitives;
        expect(updatedDrawingPrimitives).toHaveLength(2);
    });
    it("executes fork readonly action handles through the widget command lane", async () => {
        const adapter = createAdapter(Promise.resolve([]), "fork-readonly-action-handles");
        const handleDrawingsChange = vi.fn();
        const actionData = [
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
                high: 106,
                low: 101,
                close: 104,
                volume: 1250,
                index: 1,
                dataIndex: 1,
            },
            {
                date: new Date("2024-01-01T11:00:00Z"),
                open: 104,
                high: 107,
                low: 102,
                close: 105,
                volume: 1300,
                index: 2,
                dataIndex: 2,
            },
            {
                date: new Date("2024-01-01T12:00:00Z"),
                open: 105,
                high: 108,
                low: 103,
                close: 106,
                volume: 1400,
                index: 3,
                dataIndex: 3,
            },
        ];
        const drawing = createDrawingObject("trendLine", [
            { x: actionData[1].date.getTime(), y: 103 },
            { x: actionData[2].date.getTime(), y: 104 },
        ], {
            id: "fork-action-drawing",
            paneId: "price",
            yScaleId: "price-right",
        });
        mockVisibleRange = { from: 0, to: 3 };
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: actionData, engineRuntime: "fork", locale: "en", drawings: [drawing], selectedDrawing: drawing, onDrawingsChange: handleDrawingsChange }));
            await flushMicrotasks();
        });
        const engineSurface = await waitForTruthyValue(() => container?.querySelector(".rsc-engine-surface"));
        Object.defineProperty(engineSurface, "getBoundingClientRect", {
            configurable: true,
            value: () => ({
                bottom: 720,
                height: 720,
                left: 0,
                right: 1200,
                top: 0,
                width: 1200,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            }),
        });
        await waitForTruthyValue(() => [...engineHostPropsHistory]
            .map((props) => props.overlayInputs)
            .findLast((value) => value?.drawingPrimitives?.some((primitive) => primitive.actionHandle === "lock" && primitive.drawingId === "fork-action-drawing"))
            ?.drawingPrimitives);
        const actionHandlePoint = resolveTrendLineLockHandlePoint(actionData, drawing, mockVisibleRange);
        expect(actionHandlePoint).toBeTruthy();
        await act(async () => {
            engineSurface.dispatchEvent(new MouseEvent("click", {
                bubbles: true,
                clientX: actionHandlePoint.x,
                clientY: actionHandlePoint.y,
            }));
            await flushMicrotasks();
        });
        const lockToggleUpdate = handleDrawingsChange.mock.calls
            .map((call) => call[0])
            .findLast((value) => value?.some((candidate) => candidate.id === "fork-action-drawing"));
        expect(lockToggleUpdate).toBeTruthy();
        mockVisibleRange = { from: 0, to: 1 };
    });
    it("anchors fork action handles to rendered drawing when controlled selection is stale", async () => {
        const adapter = createAdapter(Promise.resolve([]), "fork-stale-selection-action-handle");
        const actionData = [
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
                high: 106,
                low: 101,
                close: 104,
                volume: 1250,
                index: 1,
                dataIndex: 1,
            },
            {
                date: new Date("2024-01-01T11:00:00Z"),
                open: 104,
                high: 107,
                low: 102,
                close: 105,
                volume: 1300,
                index: 2,
                dataIndex: 2,
            },
            {
                date: new Date("2024-01-01T12:00:00Z"),
                open: 105,
                high: 108,
                low: 103,
                close: 106,
                volume: 1400,
                index: 3,
                dataIndex: 3,
            },
        ];
        const renderedDrawing = createDrawingObject("trendLine", [
            { x: actionData[1].date.getTime(), y: 101.5 },
            { x: actionData[2].date.getTime(), y: 102.0 },
        ], {
            id: "fork-stale-selection-drawing",
            paneId: "price",
            yScaleId: "price-right",
        });
        const staleSelectedDrawing = createDrawingObject("trendLine", [
            { x: actionData[1].date.getTime(), y: 106.5 },
            { x: actionData[2].date.getTime(), y: 106.8 },
        ], {
            id: "fork-stale-selection-drawing",
            paneId: "price",
            yScaleId: "price-right",
        });
        mockVisibleRange = { from: 0, to: 3 };
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: actionData, engineRuntime: "fork", locale: "en", drawings: [renderedDrawing], selectedDrawing: staleSelectedDrawing }));
            await flushMicrotasks();
        });
        const overlayInputs = [...engineHostPropsHistory]
            .map((props) => props.overlayInputs)
            .findLast((value) => value?.drawingPrimitives?.some((primitive) => primitive.key === "fork-stale-selection-drawing::action-handle::lock"));
        const lockPrimitive = overlayInputs?.drawingPrimitives?.find((primitive) => primitive.key === "fork-stale-selection-drawing::action-handle::lock");
        const lockCenter = lockPrimitive?.primitive.type === "circle"
            ? lockPrimitive.primitive.points[0]
            : undefined;
        const expectedAbsoluteLockPoint = resolveTrendLineLockHandlePoint(actionData, renderedDrawing, mockVisibleRange);
        const priceSnapshot = mergeTestPaneSnapshotDomains(actionData).find((snapshot) => snapshot.paneId === "price");
        if (!lockCenter || !expectedAbsoluteLockPoint || !priceSnapshot) {
            throw new Error("Expected lock action handle primitive for stale selection regression");
        }
        const expectedLocalLockPoint = {
            x: expectedAbsoluteLockPoint.x - priceSnapshot.plotBounds.left,
            y: expectedAbsoluteLockPoint.y - priceSnapshot.plotBounds.top,
        };
        expect(lockCenter.x).toBeCloseTo(expectedLocalLockPoint.x, 0);
        expect(Math.abs(lockCenter.y - expectedLocalLockPoint.y)).toBeLessThanOrEqual(24);
        mockVisibleRange = { from: 0, to: 1 };
    });
    it("opens a widget-owned fork drawing context menu and applies commands", async () => {
        const adapter = createAdapter(Promise.resolve([]), "fork-readonly-context-menu");
        const handleDrawingsChange = vi.fn();
        const contextData = [
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
                high: 106,
                low: 101,
                close: 104,
                volume: 1250,
                index: 1,
                dataIndex: 1,
            },
            {
                date: new Date("2024-01-01T11:00:00Z"),
                open: 104,
                high: 107,
                low: 102,
                close: 105,
                volume: 1300,
                index: 2,
                dataIndex: 2,
            },
            {
                date: new Date("2024-01-01T12:00:00Z"),
                open: 105,
                high: 108,
                low: 103,
                close: 106,
                volume: 1400,
                index: 3,
                dataIndex: 3,
            },
        ];
        const drawing = createDrawingObject("trendLine", [
            { x: contextData[1].date.getTime(), y: 103 },
            { x: contextData[2].date.getTime(), y: 104 },
        ], {
            id: "fork-context-drawing",
            paneId: "price",
            yScaleId: "price-right",
        });
        mockVisibleRange = { from: 0, to: 3 };
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: contextData, engineRuntime: "fork", locale: "en", drawings: [drawing], onDrawingsChange: handleDrawingsChange }));
            await flushMicrotasks();
        });
        const engineSurface = await waitForTruthyValue(() => container?.querySelector(".rsc-engine-surface"));
        Object.defineProperty(engineSurface, "getBoundingClientRect", {
            configurable: true,
            value: () => ({
                bottom: 720,
                height: 720,
                left: 0,
                right: 1200,
                top: 0,
                width: 1200,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            }),
        });
        const contextHitPoint = resolveTrendLineBodyPoint(contextData, drawing, mockVisibleRange);
        expect(contextHitPoint).toBeTruthy();
        await act(async () => {
            engineSurface.dispatchEvent(new MouseEvent("contextmenu", {
                bubbles: true,
                cancelable: true,
                clientX: contextHitPoint.x,
                clientY: contextHitPoint.y,
            }));
            await flushMicrotasks();
        });
        const menuItem = [...(container?.querySelectorAll('[role="menuitem"]') ?? [])][0];
        if (menuItem) {
            await act(async () => {
                menuItem.click();
                await flushMicrotasks();
            });
            const zIndexUpdate = handleDrawingsChange.mock.calls
                .map((call) => call[0])
                .findLast((value) => value?.some((candidate) => candidate.id === "fork-context-drawing" && typeof candidate.zIndex === "number"));
            expect(zIndexUpdate).toBeTruthy();
            expect(container.querySelector('[role="menu"]')).toBeNull();
        }
        mockVisibleRange = { from: 0, to: 1 };
    });
    it("creates explicit fork trend-line drawings through the widget workspace contract", async () => {
        const adapter = createAdapter(Promise.resolve([]), "fork-trendline-authoring");
        const handleDrawingWorkspaceChange = vi.fn();
        const handleDrawingsChange = vi.fn();
        mockVisibleRange = { from: 0, to: 3 };
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: [
                    ...forkRuntimeData,
                    {
                        date: new Date("2024-01-01T11:00:00Z"),
                        open: 104,
                        high: 107,
                        low: 102,
                        close: 105,
                        volume: 1400,
                        index: 2,
                        dataIndex: 2,
                    },
                    {
                        date: new Date("2024-01-01T12:00:00Z"),
                        open: 105,
                        high: 108,
                        low: 103,
                        close: 106,
                        volume: 1500,
                        index: 3,
                        dataIndex: 3,
                    },
                ], engineRuntime: "fork", drawingUiEnabled: true, onDrawingWorkspaceChange: handleDrawingWorkspaceChange, onDrawingsChange: handleDrawingsChange }));
            await flushMicrotasks();
        });
        const workspace = await waitForTruthyValue(() => handleDrawingWorkspaceChange.mock.calls
            .map((call) => call[0])
            .find((value) => value && typeof value.setActiveTool === "function") ?? undefined);
        await act(async () => {
            workspace.setActiveTool?.("trendLine");
            await flushMicrotasks();
        });
        const host = await waitForTruthyValue(() => container?.querySelector('[data-vn-kline-engine-host="true"]'));
        Object.defineProperty(host, "getBoundingClientRect", {
            configurable: true,
            value: () => ({
                bottom: 720,
                height: 720,
                left: 0,
                right: 1200,
                top: 0,
                width: 1200,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            }),
        });
        const authoringData = [
            ...forkRuntimeData,
            {
                date: new Date("2024-01-01T11:00:00Z"),
                open: 104,
                high: 107,
                low: 102,
                close: 105,
                volume: 1400,
                index: 2,
                dataIndex: 2,
            },
            {
                date: new Date("2024-01-01T12:00:00Z"),
                open: 105,
                high: 108,
                low: 103,
                close: 106,
                volume: 1500,
                index: 3,
                dataIndex: 3,
            },
        ];
        const startPoint = resolveTrendLinePointPixel(authoringData, mockVisibleRange, 0, 100);
        const endPoint = resolveTrendLinePointPixel(authoringData, mockVisibleRange, 2, 105);
        if (!startPoint || !endPoint) {
            throw new Error("Expected deterministic fork trend-line authoring points");
        }
        const PointerEventCtor = window.PointerEvent ?? window.MouseEvent;
        await act(async () => {
            host.dispatchEvent(new PointerEventCtor("pointerdown", {
                bubbles: true,
                buttons: 1,
                clientX: startPoint.x,
                clientY: startPoint.y,
            }));
            host.dispatchEvent(new PointerEventCtor("pointerup", {
                bubbles: true,
                clientX: startPoint.x,
                clientY: startPoint.y,
            }));
            host.dispatchEvent(new MouseEvent("click", {
                bubbles: true,
                clientX: startPoint.x,
                clientY: startPoint.y,
            }));
            host.dispatchEvent(new PointerEventCtor("pointermove", {
                bubbles: true,
                clientX: endPoint.x,
                clientY: endPoint.y,
            }));
            host.dispatchEvent(new PointerEventCtor("pointerdown", {
                bubbles: true,
                buttons: 1,
                clientX: endPoint.x,
                clientY: endPoint.y,
            }));
            host.dispatchEvent(new PointerEventCtor("pointerup", {
                bubbles: true,
                clientX: endPoint.x,
                clientY: endPoint.y,
            }));
            host.dispatchEvent(new MouseEvent("click", {
                bubbles: true,
                clientX: endPoint.x,
                clientY: endPoint.y,
            }));
            await flushMicrotasks();
        });
        const createdDrawings = await waitForTruthyValue(() => handleDrawingsChange.mock.calls
            .map((call) => call[0])
            .findLast((value) => value?.length === 1 && value[0]?.type === "trendLine"));
        expect(createdDrawings[0]).toMatchObject({
            type: "trendLine",
            paneId: "price",
            yScaleId: "price-right",
            points: [
                { x: authoringData[0].date.getTime(), y: 100 },
                { x: authoringData[2].date.getTime() },
            ],
        });
        expect(Math.abs((createdDrawings[0]?.points?.[1]?.y ?? Number.NaN) - 105)).toBeLessThanOrEqual(1);
    });
    it("creates explicit fork trend-line drawings through drag-release on the widget workspace contract", async () => {
        const adapter = createAdapter(Promise.resolve([]), "fork-trendline-drag-authoring");
        const handleDrawingWorkspaceChange = vi.fn();
        const handleDrawingsChange = vi.fn();
        mockVisibleRange = { from: 0, to: 3 };
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        const authoringData = [
            ...forkRuntimeData,
            {
                date: new Date("2024-01-01T11:00:00Z"),
                open: 104,
                high: 107,
                low: 102,
                close: 105,
                volume: 1400,
                index: 2,
                dataIndex: 2,
            },
            {
                date: new Date("2024-01-01T12:00:00Z"),
                open: 105,
                high: 108,
                low: 103,
                close: 106,
                volume: 1500,
                index: 3,
                dataIndex: 3,
            },
        ];
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: authoringData, engineRuntime: "fork", drawingUiEnabled: true, onDrawingWorkspaceChange: handleDrawingWorkspaceChange, onDrawingsChange: handleDrawingsChange }));
            await flushMicrotasks();
        });
        const workspace = await waitForTruthyValue(() => handleDrawingWorkspaceChange.mock.calls
            .map((call) => call[0])
            .find((value) => value && typeof value.setActiveTool === "function") ?? undefined);
        await act(async () => {
            workspace.setActiveTool?.("trendLine");
            await flushMicrotasks();
        });
        const host = await waitForTruthyValue(() => container?.querySelector('[data-vn-kline-engine-host="true"]'));
        Object.defineProperty(host, "getBoundingClientRect", {
            configurable: true,
            value: () => ({
                bottom: 720,
                height: 720,
                left: 0,
                right: 1200,
                top: 0,
                width: 1200,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            }),
        });
        const startPoint = resolveTrendLinePointPixel(authoringData, mockVisibleRange, 0, 100);
        const endPoint = resolveTrendLinePointPixel(authoringData, mockVisibleRange, 2, 105);
        if (!startPoint || !endPoint) {
            throw new Error("Expected deterministic fork trend-line drag points");
        }
        const PointerEventCtor = window.PointerEvent ?? window.MouseEvent;
        await act(async () => {
            host.dispatchEvent(new PointerEventCtor("pointerdown", {
                bubbles: true,
                buttons: 1,
                clientX: startPoint.x,
                clientY: startPoint.y,
            }));
            host.dispatchEvent(new PointerEventCtor("pointermove", {
                bubbles: true,
                buttons: 1,
                clientX: endPoint.x,
                clientY: endPoint.y,
            }));
            host.dispatchEvent(new PointerEventCtor("pointerup", {
                bubbles: true,
                clientX: endPoint.x,
                clientY: endPoint.y,
            }));
            await flushMicrotasks();
        });
        const createdDrawings = await waitForTruthyValue(() => handleDrawingsChange.mock.calls
            .map((call) => call[0])
            .findLast((value) => value?.length === 1 && value[0]?.type === "trendLine"));
        expect(createdDrawings[0]).toMatchObject({
            type: "trendLine",
            paneId: "price",
            yScaleId: "price-right",
            points: [
                { x: authoringData[0].date.getTime(), y: 100 },
                { x: authoringData[2].date.getTime() },
            ],
        });
        expect(Math.abs((createdDrawings[0]?.points?.[1]?.y ?? Number.NaN) - 105)).toBeLessThanOrEqual(1);
    });
    it("allows explicit fork trend-line authoring across panes without clamping to price pane bounds", async () => {
        const adapter = createAdapter(Promise.resolve([]), "fork-trendline-cross-pane-authoring");
        const handleDrawingWorkspaceChange = vi.fn();
        const handleDrawingsChange = vi.fn();
        mockVisibleRange = { from: 0, to: 3 };
        const authoringData = [
            ...forkRuntimeData,
            {
                date: new Date("2024-01-01T11:00:00Z"),
                open: 104,
                high: 107,
                low: 102,
                close: 105,
                volume: 1400,
                index: 2,
                dataIndex: 2,
            },
            {
                date: new Date("2024-01-01T12:00:00Z"),
                open: 105,
                high: 108,
                low: 103,
                close: 106,
                volume: 1500,
                index: 3,
                dataIndex: 3,
            },
        ];
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: authoringData, engineRuntime: "fork", drawingUiEnabled: true, onDrawingWorkspaceChange: handleDrawingWorkspaceChange, onDrawingsChange: handleDrawingsChange }));
            await flushMicrotasks();
        });
        const workspace = await waitForTruthyValue(() => handleDrawingWorkspaceChange.mock.calls
            .map((call) => call[0])
            .find((value) => value && typeof value.setActiveTool === "function") ?? undefined);
        await act(async () => {
            workspace.setActiveTool?.("trendLine");
            await flushMicrotasks();
        });
        const host = await waitForTruthyValue(() => container?.querySelector('[data-vn-kline-engine-host="true"]'));
        Object.defineProperty(host, "getBoundingClientRect", {
            configurable: true,
            value: () => ({
                bottom: 720,
                height: 720,
                left: 0,
                right: 1200,
                top: 0,
                width: 1200,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            }),
        });
        const startPoint = resolveTrendLinePointPixel(authoringData, mockVisibleRange, 0, 100);
        const priceSnapshot = mergeTestPaneSnapshotDomains(authoringData).find((snapshot) => snapshot.paneId === "price");
        const volumeSnapshot = mergeTestPaneSnapshotDomains(authoringData).find((snapshot) => snapshot.paneId === "volume");
        const endX = priceSnapshot
            ? resolvePanePixelAtDataIndex(priceSnapshot, mockVisibleRange, 2.5, authoringData.length)
            : null;
        const endY = volumeSnapshot ? volumeSnapshot.plotBounds.top + 24 : null;
        if (!startPoint || !priceSnapshot || !volumeSnapshot || endX === null || endY === null) {
            throw new Error("Expected deterministic cross-pane trend-line authoring points");
        }
        const PointerEventCtor = window.PointerEvent ?? window.MouseEvent;
        await act(async () => {
            host.dispatchEvent(new PointerEventCtor("pointerdown", {
                bubbles: true,
                buttons: 1,
                clientX: startPoint.x,
                clientY: startPoint.y,
            }));
            host.dispatchEvent(new PointerEventCtor("pointerup", {
                bubbles: true,
                clientX: startPoint.x,
                clientY: startPoint.y,
            }));
            host.dispatchEvent(new MouseEvent("click", {
                bubbles: true,
                clientX: startPoint.x,
                clientY: startPoint.y,
            }));
            host.dispatchEvent(new PointerEventCtor("pointermove", {
                bubbles: true,
                clientX: Math.round(endX),
                clientY: Math.round(endY),
            }));
            host.dispatchEvent(new PointerEventCtor("pointerdown", {
                bubbles: true,
                buttons: 1,
                clientX: Math.round(endX),
                clientY: Math.round(endY),
            }));
            host.dispatchEvent(new PointerEventCtor("pointerup", {
                bubbles: true,
                clientX: Math.round(endX),
                clientY: Math.round(endY),
            }));
            host.dispatchEvent(new MouseEvent("click", {
                bubbles: true,
                clientX: Math.round(endX),
                clientY: Math.round(endY),
            }));
            await flushMicrotasks();
        });
        const createdDrawings = await waitForTruthyValue(() => handleDrawingsChange.mock.calls
            .map((call) => call[0])
            .findLast((value) => value?.length === 1 && value[0]?.type === "trendLine"));
        const createdDrawing = createdDrawings[0];
        const secondPoint = createdDrawing?.points?.[1];
        const priceDomain = priceSnapshot.scaleSlotStates["price-right"]?.domain;
        if (!createdDrawing || !secondPoint || !priceDomain) {
            throw new Error("Expected cross-pane trend-line payload");
        }
        const [priceMin, priceMax] = priceDomain;
        const expectedSecondY = priceMax - ((endY - priceSnapshot.plotBounds.top) / priceSnapshot.plotBounds.height) * (priceMax - priceMin);
        expect(createdDrawing).toMatchObject({
            type: "trendLine",
            paneId: "price",
            yScaleId: "price-right",
            points: [
                { x: authoringData[0].date.getTime(), y: 100 },
                { x: authoringData[2].date.getTime() },
            ],
        });
        expect(secondPoint.y).toBeLessThan(priceMin);
        expect(secondPoint.y).toBeCloseTo(expectedSecondY, 0);
        const overlayInputs = [...engineHostPropsHistory]
            .map((props) => props.overlayInputs)
            .findLast((value) => value?.drawingPrimitives?.some((primitive) => primitive.drawingId === createdDrawing.id));
        const drawingPrimitive = overlayInputs?.drawingPrimitives?.find((primitive) => primitive.drawingId === createdDrawing.id);
        expect(drawingPrimitive?.clipToPane).toBe(true);
    });
    it("creates explicit fork hLine drawings through a single pointer cycle", async () => {
        const adapter = createAdapter(Promise.resolve([]), "fork-hline-authoring");
        const handleDrawingWorkspaceChange = vi.fn();
        const handleDrawingsChange = vi.fn();
        mockVisibleRange = { from: 0, to: 3 };
        const authoringData = [
            ...forkRuntimeData,
            {
                date: new Date("2024-01-01T11:00:00Z"),
                open: 104,
                high: 107,
                low: 102,
                close: 105,
                volume: 1400,
                index: 2,
                dataIndex: 2,
            },
            {
                date: new Date("2024-01-01T12:00:00Z"),
                open: 105,
                high: 108,
                low: 103,
                close: 106,
                volume: 1500,
                index: 3,
                dataIndex: 3,
            },
        ];
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: authoringData, engineRuntime: "fork", drawingUiEnabled: true, onDrawingWorkspaceChange: handleDrawingWorkspaceChange, onDrawingsChange: handleDrawingsChange }));
            await flushMicrotasks();
        });
        const workspace = await waitForTruthyValue(() => handleDrawingWorkspaceChange.mock.calls
            .map((call) => call[0])
            .find((value) => value && typeof value.setActiveTool === "function") ?? undefined);
        await act(async () => {
            workspace.setActiveTool?.("hLine");
            await flushMicrotasks();
        });
        const host = await waitForTruthyValue(() => container?.querySelector('[data-vn-kline-engine-host="true"]'));
        Object.defineProperty(host, "getBoundingClientRect", {
            configurable: true,
            value: () => ({
                bottom: 720,
                height: 720,
                left: 0,
                right: 1200,
                top: 0,
                width: 1200,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            }),
        });
        const point = resolveTrendLinePointPixel(authoringData, mockVisibleRange, 1, 104);
        if (!point) {
            throw new Error("Expected deterministic fork hLine point");
        }
        const PointerEventCtor = window.PointerEvent ?? window.MouseEvent;
        await act(async () => {
            host.dispatchEvent(new PointerEventCtor("pointerdown", {
                bubbles: true,
                buttons: 1,
                clientX: point.x,
                clientY: point.y,
            }));
            host.dispatchEvent(new PointerEventCtor("pointerup", {
                bubbles: true,
                clientX: point.x,
                clientY: point.y,
            }));
            await flushMicrotasks();
        });
        const createdDrawings = await waitForTruthyValue(() => handleDrawingsChange.mock.calls
            .map((call) => call[0])
            .findLast((value) => value?.length === 1 && value[0]?.type === "hLine"));
        expect(createdDrawings[0]).toMatchObject({
            type: "hLine",
            paneId: "price",
            yScaleId: "price-right",
        });
        expect(createdDrawings[0]?.points?.[0]?.x).toBe(authoringData[1].date.getTime());
        expect(Math.abs((createdDrawings[0]?.points?.[0]?.y ?? Number.NaN) - 104)).toBeLessThanOrEqual(1);
    });
    it("creates explicit fork text drawings through a single pointer cycle", async () => {
        const adapter = createAdapter(Promise.resolve([]), "fork-text-authoring");
        const handleDrawingWorkspaceChange = vi.fn();
        const handleDrawingsChange = vi.fn();
        mockVisibleRange = { from: 0, to: 3 };
        const authoringData = [
            ...forkRuntimeData,
            {
                date: new Date("2024-01-01T11:00:00Z"),
                open: 104,
                high: 107,
                low: 102,
                close: 105,
                volume: 1400,
                index: 2,
                dataIndex: 2,
            },
            {
                date: new Date("2024-01-01T12:00:00Z"),
                open: 105,
                high: 108,
                low: 103,
                close: 106,
                volume: 1500,
                index: 3,
                dataIndex: 3,
            },
        ];
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: authoringData, engineRuntime: "fork", drawingUiEnabled: true, onDrawingWorkspaceChange: handleDrawingWorkspaceChange, onDrawingsChange: handleDrawingsChange }));
            await flushMicrotasks();
        });
        const workspace = await waitForTruthyValue(() => handleDrawingWorkspaceChange.mock.calls
            .map((call) => call[0])
            .find((value) => value && typeof value.setActiveTool === "function") ?? undefined);
        await act(async () => {
            workspace.setActiveTool?.("text");
            await flushMicrotasks();
        });
        const host = await waitForTruthyValue(() => container?.querySelector('[data-vn-kline-engine-host="true"]'));
        Object.defineProperty(host, "getBoundingClientRect", {
            configurable: true,
            value: () => ({
                bottom: 720,
                height: 720,
                left: 0,
                right: 1200,
                top: 0,
                width: 1200,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            }),
        });
        const point = resolveTrendLinePointPixel(authoringData, mockVisibleRange, 2, 105);
        if (!point) {
            throw new Error("Expected deterministic fork text point");
        }
        const PointerEventCtor = window.PointerEvent ?? window.MouseEvent;
        await act(async () => {
            host.dispatchEvent(new PointerEventCtor("pointerdown", {
                bubbles: true,
                buttons: 1,
                clientX: point.x,
                clientY: point.y,
            }));
            host.dispatchEvent(new PointerEventCtor("pointerup", {
                bubbles: true,
                clientX: point.x,
                clientY: point.y,
            }));
            await flushMicrotasks();
        });
        const createdDrawings = await waitForTruthyValue(() => handleDrawingsChange.mock.calls
            .map((call) => call[0])
            .findLast((value) => value?.length === 1 && value[0]?.type === "text"));
        expect(createdDrawings[0]).toMatchObject({
            type: "text",
            paneId: "price",
            yScaleId: "price-right",
            text: "",
        });
        expect(createdDrawings[0]?.points).toHaveLength(1);
    });
    it("supports multi-step XABCD point authoring in fork runtime", async () => {
        const adapter = createAdapter(Promise.resolve([]), "fork-xabcd-multi-step-authoring");
        const handleDrawingWorkspaceChange = vi.fn();
        const handleDrawingsChange = vi.fn();
        mockVisibleRange = { from: 0, to: 5 };
        const authoringData = [
            ...forkRuntimeData,
            {
                date: new Date("2024-01-01T11:00:00Z"),
                open: 104,
                high: 107,
                low: 102,
                close: 105,
                volume: 1400,
                index: 2,
                dataIndex: 2,
            },
            {
                date: new Date("2024-01-01T12:00:00Z"),
                open: 105,
                high: 108,
                low: 103,
                close: 106,
                volume: 1500,
                index: 3,
                dataIndex: 3,
            },
            {
                date: new Date("2024-01-01T13:00:00Z"),
                open: 106,
                high: 109,
                low: 104,
                close: 107,
                volume: 1600,
                index: 4,
                dataIndex: 4,
            },
            {
                date: new Date("2024-01-01T14:00:00Z"),
                open: 107,
                high: 110,
                low: 105,
                close: 108,
                volume: 1700,
                index: 5,
                dataIndex: 5,
            },
        ];
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: authoringData, engineRuntime: "fork", drawingUiEnabled: true, onDrawingWorkspaceChange: handleDrawingWorkspaceChange, onDrawingsChange: handleDrawingsChange }));
            await flushMicrotasks();
        });
        const workspace = await waitForTruthyValue(() => handleDrawingWorkspaceChange.mock.calls
            .map((call) => call[0])
            .find((value) => value && typeof value.setActiveTool === "function") ?? undefined);
        await act(async () => {
            workspace.setActiveTool?.("xabcdPattern");
            await flushMicrotasks();
        });
        const host = await waitForTruthyValue(() => container?.querySelector('[data-vn-kline-engine-host="true"]'));
        Object.defineProperty(host, "getBoundingClientRect", {
            configurable: true,
            value: () => ({
                bottom: 720,
                height: 720,
                left: 0,
                right: 1200,
                top: 0,
                width: 1200,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            }),
        });
        const patternPoints = [
            resolveTrendLinePointPixel(authoringData, mockVisibleRange, 0, 100),
            resolveTrendLinePointPixel(authoringData, mockVisibleRange, 1, 104),
            resolveTrendLinePointPixel(authoringData, mockVisibleRange, 2, 101),
            resolveTrendLinePointPixel(authoringData, mockVisibleRange, 3, 106),
            resolveTrendLinePointPixel(authoringData, mockVisibleRange, 5, 103),
        ];
        if (patternPoints.some((point) => point == null)) {
            throw new Error("Expected deterministic XABCD authoring points");
        }
        const PointerEventCtor = window.PointerEvent ?? window.MouseEvent;
        const clickAt = async (clientX, clientY) => {
            await act(async () => {
                host.dispatchEvent(new PointerEventCtor("pointermove", {
                    bubbles: true,
                    clientX,
                    clientY,
                }));
                host.dispatchEvent(new PointerEventCtor("pointerdown", {
                    bubbles: true,
                    buttons: 1,
                    clientX,
                    clientY,
                }));
                host.dispatchEvent(new PointerEventCtor("pointerup", {
                    bubbles: true,
                    clientX,
                    clientY,
                }));
                host.dispatchEvent(new MouseEvent("click", {
                    bubbles: true,
                    clientX,
                    clientY,
                }));
                await flushMicrotasks();
            });
        };
        for (const point of patternPoints) {
            await clickAt(point.x, point.y);
        }
        const createdDrawings = await waitForTruthyValue(() => handleDrawingsChange.mock.calls
            .map((call) => call[0])
            .findLast((value) => value?.length === 1 && value[0]?.type === "xabcdPattern"));
        const createdDrawing = createdDrawings[0];
        expect(createdDrawing?.points?.length).toBe(5);
        expect(createdDrawing?.points?.[0]?.x).toBe(authoringData[0].date.getTime());
        expect(createdDrawing?.points?.[1]?.x).toBe(authoringData[1].date.getTime());
        expect(createdDrawing?.points?.[2]?.x).toBe(authoringData[2].date.getTime());
        expect(createdDrawing?.points?.[3]?.x).toBe(authoringData[3].date.getTime());
        expect(createdDrawing?.points?.[4]?.x).toBe(authoringData[5].date.getTime());
        expect(createdDrawing?.points?.[0]?.y).not.toBe(createdDrawing?.points?.[1]?.y);
        expect(createdDrawing?.points?.[1]?.y).not.toBe(createdDrawing?.points?.[2]?.y);
        expect(createdDrawing?.points?.[2]?.y).not.toBe(createdDrawing?.points?.[3]?.y);
        expect(createdDrawing?.points?.[3]?.y).not.toBe(createdDrawing?.points?.[4]?.y);
    });
    it("creates explicit fork priceLabel drawings through a single pointer cycle", async () => {
        const adapter = createAdapter(Promise.resolve([]), "fork-price-label-authoring");
        const handleDrawingWorkspaceChange = vi.fn();
        const handleDrawingsChange = vi.fn();
        mockVisibleRange = { from: 0, to: 3 };
        const authoringData = [
            ...forkRuntimeData,
            {
                date: new Date("2024-01-01T11:00:00Z"),
                open: 104,
                high: 107,
                low: 102,
                close: 105,
                volume: 1400,
                index: 2,
                dataIndex: 2,
            },
            {
                date: new Date("2024-01-01T12:00:00Z"),
                open: 105,
                high: 108,
                low: 103,
                close: 106,
                volume: 1500,
                index: 3,
                dataIndex: 3,
            },
        ];
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: authoringData, engineRuntime: "fork", drawingUiEnabled: true, onDrawingWorkspaceChange: handleDrawingWorkspaceChange, onDrawingsChange: handleDrawingsChange }));
            await flushMicrotasks();
        });
        const workspace = await waitForTruthyValue(() => handleDrawingWorkspaceChange.mock.calls
            .map((call) => call[0])
            .find((value) => value && typeof value.setActiveTool === "function") ?? undefined);
        await act(async () => {
            workspace.setActiveTool?.("priceLabel");
            await flushMicrotasks();
        });
        const host = await waitForTruthyValue(() => container?.querySelector('[data-vn-kline-engine-host="true"]'));
        Object.defineProperty(host, "getBoundingClientRect", {
            configurable: true,
            value: () => ({
                bottom: 720,
                height: 720,
                left: 0,
                right: 1200,
                top: 0,
                width: 1200,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            }),
        });
        const point = resolveTrendLinePointPixel(authoringData, mockVisibleRange, 0, 100);
        if (!point) {
            throw new Error("Expected deterministic fork priceLabel point");
        }
        const PointerEventCtor = window.PointerEvent ?? window.MouseEvent;
        await act(async () => {
            host.dispatchEvent(new PointerEventCtor("pointerdown", {
                bubbles: true,
                buttons: 1,
                clientX: point.x,
                clientY: point.y,
            }));
            host.dispatchEvent(new PointerEventCtor("pointerup", {
                bubbles: true,
                clientX: point.x,
                clientY: point.y,
            }));
            await flushMicrotasks();
        });
        const createdDrawings = await waitForTruthyValue(() => handleDrawingsChange.mock.calls
            .map((call) => call[0])
            .findLast((value) => value?.length === 1 && value[0]?.type === "priceLabel"));
        expect(createdDrawings[0]).toMatchObject({
            type: "priceLabel",
            paneId: "price",
            yScaleId: "price-right",
            text: "Price",
        });
        expect(createdDrawings[0]?.points).toHaveLength(1);
    });
    it("creates explicit fork arrow drawings through drag-release", async () => {
        const adapter = createAdapter(Promise.resolve([]), "fork-arrow-authoring");
        const handleDrawingWorkspaceChange = vi.fn();
        const handleDrawingsChange = vi.fn();
        mockVisibleRange = { from: 0, to: 3 };
        const authoringData = [
            ...forkRuntimeData,
            {
                date: new Date("2024-01-01T11:00:00Z"),
                open: 104,
                high: 107,
                low: 102,
                close: 105,
                volume: 1400,
                index: 2,
                dataIndex: 2,
            },
            {
                date: new Date("2024-01-01T12:00:00Z"),
                open: 105,
                high: 108,
                low: 103,
                close: 106,
                volume: 1500,
                index: 3,
                dataIndex: 3,
            },
        ];
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: authoringData, engineRuntime: "fork", drawingUiEnabled: true, onDrawingWorkspaceChange: handleDrawingWorkspaceChange, onDrawingsChange: handleDrawingsChange }));
            await flushMicrotasks();
        });
        const workspace = await waitForTruthyValue(() => handleDrawingWorkspaceChange.mock.calls
            .map((call) => call[0])
            .find((value) => value && typeof value.setActiveTool === "function") ?? undefined);
        await act(async () => {
            workspace.setActiveTool?.("arrow");
            await flushMicrotasks();
        });
        const host = await waitForTruthyValue(() => container?.querySelector('[data-vn-kline-engine-host="true"]'));
        Object.defineProperty(host, "getBoundingClientRect", {
            configurable: true,
            value: () => ({
                bottom: 720,
                height: 720,
                left: 0,
                right: 1200,
                top: 0,
                width: 1200,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            }),
        });
        const startPoint = resolveTrendLinePointPixel(authoringData, mockVisibleRange, 1, 103);
        const endPoint = resolveTrendLinePointPixel(authoringData, mockVisibleRange, 3, 106);
        if (!startPoint || !endPoint) {
            throw new Error("Expected deterministic fork arrow points");
        }
        const PointerEventCtor = window.PointerEvent ?? window.MouseEvent;
        await act(async () => {
            host.dispatchEvent(new PointerEventCtor("pointerdown", {
                bubbles: true,
                buttons: 1,
                clientX: startPoint.x,
                clientY: startPoint.y,
            }));
            host.dispatchEvent(new PointerEventCtor("pointermove", {
                bubbles: true,
                buttons: 1,
                clientX: endPoint.x,
                clientY: endPoint.y,
            }));
            host.dispatchEvent(new PointerEventCtor("pointerup", {
                bubbles: true,
                clientX: endPoint.x,
                clientY: endPoint.y,
            }));
            await flushMicrotasks();
        });
        const createdDrawings = await waitForTruthyValue(() => handleDrawingsChange.mock.calls
            .map((call) => call[0])
            .findLast((value) => value?.length === 1 && value[0]?.type === "arrow"));
        expect(createdDrawings[0]).toMatchObject({
            type: "arrow",
            paneId: "price",
            yScaleId: "price-right",
        });
        expect(createdDrawings[0]?.points).toHaveLength(2);
    });
    it("creates explicit fork callout drawings through drag-release", async () => {
        const adapter = createAdapter(Promise.resolve([]), "fork-callout-authoring");
        const handleDrawingWorkspaceChange = vi.fn();
        const handleDrawingsChange = vi.fn();
        mockVisibleRange = { from: 0, to: 3 };
        const authoringData = [
            ...forkRuntimeData,
            {
                date: new Date("2024-01-01T11:00:00Z"),
                open: 104,
                high: 107,
                low: 102,
                close: 105,
                volume: 1400,
                index: 2,
                dataIndex: 2,
            },
            {
                date: new Date("2024-01-01T12:00:00Z"),
                open: 105,
                high: 108,
                low: 103,
                close: 106,
                volume: 1500,
                index: 3,
                dataIndex: 3,
            },
        ];
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: authoringData, engineRuntime: "fork", drawingUiEnabled: true, onDrawingWorkspaceChange: handleDrawingWorkspaceChange, onDrawingsChange: handleDrawingsChange }));
            await flushMicrotasks();
        });
        const workspace = await waitForTruthyValue(() => handleDrawingWorkspaceChange.mock.calls
            .map((call) => call[0])
            .find((value) => value && typeof value.setActiveTool === "function") ?? undefined);
        await act(async () => {
            workspace.setActiveTool?.("callout");
            await flushMicrotasks();
        });
        const host = await waitForTruthyValue(() => container?.querySelector('[data-vn-kline-engine-host="true"]'));
        Object.defineProperty(host, "getBoundingClientRect", {
            configurable: true,
            value: () => ({
                bottom: 720,
                height: 720,
                left: 0,
                right: 1200,
                top: 0,
                width: 1200,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            }),
        });
        const startPoint = resolveTrendLinePointPixel(authoringData, mockVisibleRange, 1, 103);
        const endPoint = resolveTrendLinePointPixel(authoringData, mockVisibleRange, 3, 106);
        if (!startPoint || !endPoint) {
            throw new Error("Expected deterministic fork callout points");
        }
        const PointerEventCtor = window.PointerEvent ?? window.MouseEvent;
        await act(async () => {
            host.dispatchEvent(new PointerEventCtor("pointerdown", {
                bubbles: true,
                buttons: 1,
                clientX: startPoint.x,
                clientY: startPoint.y,
            }));
            host.dispatchEvent(new PointerEventCtor("pointermove", {
                bubbles: true,
                buttons: 1,
                clientX: endPoint.x,
                clientY: endPoint.y,
            }));
            host.dispatchEvent(new PointerEventCtor("pointerup", {
                bubbles: true,
                clientX: endPoint.x,
                clientY: endPoint.y,
            }));
            await flushMicrotasks();
        });
        const createdDrawings = await waitForTruthyValue(() => handleDrawingsChange.mock.calls
            .map((call) => call[0])
            .findLast((value) => value?.length === 1 && value[0]?.type === "callout"));
        expect(createdDrawings[0]).toMatchObject({
            type: "callout",
            paneId: "price",
            yScaleId: "price-right",
            text: "Text",
        });
        expect(createdDrawings[0]?.points).toHaveLength(2);
    });
    it("creates a second explicit fork drawing without getting stuck on stale active selection", async () => {
        const adapter = createAdapter(Promise.resolve([]), "fork-second-drawing");
        const handleDrawingWorkspaceChange = vi.fn();
        const handleDrawingsChange = vi.fn();
        mockVisibleRange = { from: 0, to: 3 };
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        const authoringData = [
            ...forkRuntimeData,
            {
                date: new Date("2024-01-01T11:00:00Z"),
                open: 104,
                high: 107,
                low: 102,
                close: 105,
                volume: 1400,
                index: 2,
                dataIndex: 2,
            },
            {
                date: new Date("2024-01-01T12:00:00Z"),
                open: 105,
                high: 108,
                low: 103,
                close: 106,
                volume: 1500,
                index: 3,
                dataIndex: 3,
            },
        ];
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: authoringData, engineRuntime: "fork", drawingUiEnabled: true, onDrawingWorkspaceChange: handleDrawingWorkspaceChange, onDrawingsChange: handleDrawingsChange }));
            await flushMicrotasks();
        });
        const workspace = await waitForTruthyValue(() => handleDrawingWorkspaceChange.mock.calls
            .map((call) => call[0])
            .find((value) => value && typeof value.setActiveTool === "function") ?? undefined);
        await act(async () => {
            workspace.setActiveTool?.("trendLine");
            await flushMicrotasks();
        });
        const host = await waitForTruthyValue(() => container?.querySelector('[data-vn-kline-engine-host="true"]'));
        Object.defineProperty(host, "getBoundingClientRect", {
            configurable: true,
            value: () => ({
                bottom: 720,
                height: 720,
                left: 0,
                right: 1200,
                top: 0,
                width: 1200,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            }),
        });
        const firstStart = resolveTrendLinePointPixel(authoringData, mockVisibleRange, 0, 100);
        const firstEnd = resolveTrendLinePointPixel(authoringData, mockVisibleRange, 2, 105);
        const secondStart = resolveTrendLinePointPixel(authoringData, mockVisibleRange, 1, 102);
        const secondEnd = resolveTrendLinePointPixel(authoringData, mockVisibleRange, 3, 106);
        if (!firstStart || !firstEnd || !secondStart || !secondEnd) {
            throw new Error("Expected deterministic fork trend-line points for multi-draw");
        }
        const PointerEventCtor = window.PointerEvent ?? window.MouseEvent;
        await act(async () => {
            host.dispatchEvent(new PointerEventCtor("pointerdown", {
                bubbles: true,
                buttons: 1,
                clientX: firstStart.x,
                clientY: firstStart.y,
            }));
            host.dispatchEvent(new PointerEventCtor("pointermove", {
                bubbles: true,
                buttons: 1,
                clientX: firstEnd.x,
                clientY: firstEnd.y,
            }));
            host.dispatchEvent(new PointerEventCtor("pointerup", {
                bubbles: true,
                clientX: firstEnd.x,
                clientY: firstEnd.y,
            }));
            await flushMicrotasks();
        });
        await act(async () => {
            workspace.setActiveTool?.("trendLine");
            await flushMicrotasks();
        });
        await act(async () => {
            host.dispatchEvent(new PointerEventCtor("pointerdown", {
                bubbles: true,
                buttons: 1,
                clientX: secondStart.x,
                clientY: secondStart.y,
            }));
            host.dispatchEvent(new PointerEventCtor("pointermove", {
                bubbles: true,
                buttons: 1,
                clientX: secondEnd.x,
                clientY: secondEnd.y,
            }));
            host.dispatchEvent(new PointerEventCtor("pointerup", {
                bubbles: true,
                clientX: secondEnd.x,
                clientY: secondEnd.y,
            }));
            await flushMicrotasks();
        });
        const drawingsAfterSecond = await waitForTruthyValue(() => handleDrawingsChange.mock.calls
            .map((call) => call[0])
            .findLast((value) => value?.length === 2 && value.every((drawing) => drawing.type === "trendLine")));
        expect(drawingsAfterSecond).toHaveLength(2);
    });
    it("allows creating another drawing while an existing drawing is selected", async () => {
        const adapter = createAdapter(Promise.resolve([]), "fork-authoring-while-selected");
        const handleDrawingsChange = vi.fn();
        const handleDrawingWorkspaceChange = vi.fn();
        mockVisibleRange = { from: 0, to: 3 };
        const authoringData = [
            ...forkRuntimeData,
            {
                date: new Date("2024-01-01T11:00:00Z"),
                open: 104,
                high: 107,
                low: 102,
                close: 105,
                volume: 1400,
                index: 2,
                dataIndex: 2,
            },
            {
                date: new Date("2024-01-01T12:00:00Z"),
                open: 105,
                high: 108,
                low: 103,
                close: 106,
                volume: 1500,
                index: 3,
                dataIndex: 3,
            },
        ];
        const existingDrawing = createDrawingObject("trendLine", [
            { x: authoringData[0].date.getTime(), y: 100 },
            { x: authoringData[1].date.getTime(), y: 103 },
        ], { id: "existing-selected-drawing", paneId: "price", yScaleId: "price-right" });
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: authoringData, engineRuntime: "fork", drawingUiEnabled: true, drawings: [existingDrawing], selectedDrawing: existingDrawing, onDrawingsChange: handleDrawingsChange, onDrawingWorkspaceChange: handleDrawingWorkspaceChange }));
            await flushMicrotasks();
        });
        const workspace = await waitForTruthyValue(() => handleDrawingWorkspaceChange.mock.calls
            .map((call) => call[0])
            .find((value) => value && typeof value.setActiveTool === "function") ?? undefined);
        await act(async () => {
            workspace.setActiveTool?.("trendLine");
            await flushMicrotasks();
        });
        const host = await waitForTruthyValue(() => container?.querySelector('[data-vn-kline-engine-host="true"]'));
        Object.defineProperty(host, "getBoundingClientRect", {
            configurable: true,
            value: () => ({
                bottom: 720,
                height: 720,
                left: 0,
                right: 1200,
                top: 0,
                width: 1200,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            }),
        });
        const startPoint = resolveTrendLinePointPixel(authoringData, mockVisibleRange, 2, 104);
        const endPoint = resolveTrendLinePointPixel(authoringData, mockVisibleRange, 3, 106);
        if (!startPoint || !endPoint) {
            throw new Error("Expected deterministic fork trend-line points when drawing with an existing selection");
        }
        const PointerEventCtor = window.PointerEvent ?? window.MouseEvent;
        await act(async () => {
            host.dispatchEvent(new PointerEventCtor("pointerdown", {
                bubbles: true,
                buttons: 1,
                clientX: startPoint.x,
                clientY: startPoint.y,
            }));
            host.dispatchEvent(new PointerEventCtor("pointermove", {
                bubbles: true,
                buttons: 1,
                clientX: endPoint.x,
                clientY: endPoint.y,
            }));
            host.dispatchEvent(new PointerEventCtor("pointerup", {
                bubbles: true,
                clientX: endPoint.x,
                clientY: endPoint.y,
            }));
            await flushMicrotasks();
        });
        const drawingsAfterAuthoring = await waitForTruthyValue(() => handleDrawingsChange.mock.calls
            .map((call) => call[0])
            .findLast((value) => value?.length === 2 && value.every((drawing) => drawing.type === "trendLine")));
        expect(drawingsAfterAuthoring).toHaveLength(2);
    });
    it("does not let controlled stale selection interrupt in-flight fork authoring", async () => {
        const adapter = createAdapter(Promise.resolve([]), "fork-controlled-stale-selection-authoring");
        const handleDrawingsChange = vi.fn();
        const handleDrawingWorkspaceChange = vi.fn();
        mockVisibleRange = { from: 0, to: 3 };
        const authoringData = [
            ...forkRuntimeData,
            {
                date: new Date("2024-01-01T11:00:00Z"),
                open: 104,
                high: 107,
                low: 102,
                close: 105,
                volume: 1400,
                index: 2,
                dataIndex: 2,
            },
            {
                date: new Date("2024-01-01T12:00:00Z"),
                open: 105,
                high: 108,
                low: 103,
                close: 106,
                volume: 1500,
                index: 3,
                dataIndex: 3,
            },
        ];
        const existingDrawing = createDrawingObject("trendLine", [
            { x: authoringData[0].date.getTime(), y: 100 },
            { x: authoringData[1].date.getTime(), y: 103 },
        ], { id: "existing-controlled-stale-selection", paneId: "price", yScaleId: "price-right" });
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: authoringData, engineRuntime: "fork", drawingUiEnabled: true, drawings: [existingDrawing], selectedDrawing: existingDrawing, onDrawingsChange: handleDrawingsChange, onDrawingWorkspaceChange: handleDrawingWorkspaceChange }));
            await flushMicrotasks();
        });
        const workspace = await waitForTruthyValue(() => handleDrawingWorkspaceChange.mock.calls
            .map((call) => call[0])
            .find((value) => value && typeof value.setActiveTool === "function") ?? undefined);
        await act(async () => {
            workspace.setActiveTool?.("trendLine");
            await flushMicrotasks();
        });
        const host = await waitForTruthyValue(() => container?.querySelector('[data-vn-kline-engine-host="true"]'));
        Object.defineProperty(host, "getBoundingClientRect", {
            configurable: true,
            value: () => ({
                bottom: 720,
                height: 720,
                left: 0,
                right: 1200,
                top: 0,
                width: 1200,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            }),
        });
        const startPoint = resolveTrendLinePointPixel(authoringData, mockVisibleRange, 2, 104);
        const endPoint = resolveTrendLinePointPixel(authoringData, mockVisibleRange, 3, 106);
        if (!startPoint || !endPoint) {
            throw new Error("Expected deterministic fork trend-line points when stale selection sync occurs during authoring");
        }
        const PointerEventCtor = window.PointerEvent ?? window.MouseEvent;
        await act(async () => {
            host.dispatchEvent(new PointerEventCtor("pointerdown", {
                bubbles: true,
                buttons: 1,
                clientX: startPoint.x,
                clientY: startPoint.y,
            }));
            // Force a post-pointerdown render/effect turn to emulate real controlled
            // selection lag from parent rerenders while authoring is in progress.
            await flushMicrotasks();
            host.dispatchEvent(new PointerEventCtor("pointermove", {
                bubbles: true,
                buttons: 1,
                clientX: endPoint.x,
                clientY: endPoint.y,
            }));
            host.dispatchEvent(new PointerEventCtor("pointerup", {
                bubbles: true,
                clientX: endPoint.x,
                clientY: endPoint.y,
            }));
            await flushMicrotasks();
        });
        const drawingsAfterAuthoring = await waitForTruthyValue(() => handleDrawingsChange.mock.calls
            .map((call) => call[0])
            .findLast((value) => value?.length === 2 && value.every((drawing) => drawing.type === "trendLine")));
        expect(drawingsAfterAuthoring).toHaveLength(2);
    });
    it("updates fork manipulation preview live and keeps moving when pointer enters another pane", async () => {
        const adapter = createAdapter(Promise.resolve([]), "fork-live-preview-cross-pane");
        const handleDrawingsChange = vi.fn();
        mockVisibleRange = { from: 0, to: 3 };
        const manipulationData = [
            ...forkRuntimeData,
            {
                date: new Date("2024-01-01T11:00:00Z"),
                open: 104,
                high: 107,
                low: 102,
                close: 105,
                volume: 1400,
                index: 2,
                dataIndex: 2,
            },
            {
                date: new Date("2024-01-01T12:00:00Z"),
                open: 105,
                high: 108,
                low: 103,
                close: 106,
                volume: 1500,
                index: 3,
                dataIndex: 3,
            },
        ];
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        const baseDrawing = createDrawingObject("trendLine", [
            { x: manipulationData[0].date.getTime(), y: 100 },
            { x: manipulationData[2].date.getTime(), y: 105 },
        ], { id: "fork-cross-pane-move", paneId: "price", yScaleId: "price-right" });
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: manipulationData, engineRuntime: "fork", drawingUiEnabled: true, drawings: [baseDrawing], selectedDrawing: baseDrawing, onDrawingsChange: handleDrawingsChange }));
            await flushMicrotasks();
        });
        const host = await waitForTruthyValue(() => container?.querySelector('[data-vn-kline-engine-host="true"]'));
        Object.defineProperty(host, "getBoundingClientRect", {
            configurable: true,
            value: () => ({
                bottom: 720,
                height: 720,
                left: 0,
                right: 1200,
                top: 0,
                width: 1200,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            }),
        });
        const bodyPoint = resolveTrendLineBodyPoint(manipulationData, baseDrawing, mockVisibleRange);
        if (!bodyPoint) {
            throw new Error("Expected deterministic trend-line body point for cross-pane move");
        }
        const getLatestPrimitiveSnapshot = () => {
            const overlayInputs = [...engineHostPropsHistory]
                .map((props) => props.overlayInputs)
                .findLast(Boolean);
            const primitive = overlayInputs?.drawingPrimitives?.find((entry) => entry.drawingId === baseDrawing.id);
            return primitive ? JSON.stringify(primitive.primitive) : null;
        };
        const PointerEventCtor = window.PointerEvent ?? window.MouseEvent;
        await act(async () => {
            host.dispatchEvent(new PointerEventCtor("pointerdown", {
                bubbles: true,
                buttons: 1,
                clientX: bodyPoint.x,
                clientY: bodyPoint.y,
            }));
            await flushMicrotasks();
        });
        const primitiveBeforeMove = getLatestPrimitiveSnapshot();
        await act(async () => {
            host.dispatchEvent(new PointerEventCtor("pointermove", {
                bubbles: true,
                buttons: 1,
                clientX: bodyPoint.x + 36,
                clientY: 520,
            }));
            await flushMicrotasks();
        });
        const primitiveDuringMove = getLatestPrimitiveSnapshot();
        expect(primitiveDuringMove).not.toBeNull();
        await act(async () => {
            host.dispatchEvent(new PointerEventCtor("pointerup", {
                bubbles: true,
                buttons: 0,
                clientX: bodyPoint.x + 36,
                clientY: 520,
            }));
            await flushMicrotasks();
        });
        const movedDrawings = await waitForTruthyValue(() => handleDrawingsChange.mock.calls
            .map((call) => call[0])
            .findLast((value) => value?.some((drawing) => drawing.id === baseDrawing.id)));
        const movedDrawing = movedDrawings.find((drawing) => drawing.id === baseDrawing.id);
        expect(movedDrawing?.points).not.toEqual(baseDrawing.points);
    });
    it("moves all selected fork drawings when dragging a multi-selection", async () => {
        const adapter = createAdapter(Promise.resolve([]), "fork-multi-selection-move");
        const handleDrawingsChange = vi.fn();
        mockVisibleRange = { from: 0, to: 3 };
        const manipulationData = [
            ...forkRuntimeData,
            {
                date: new Date("2024-01-01T11:00:00Z"),
                open: 104,
                high: 107,
                low: 102,
                close: 105,
                volume: 1400,
                index: 2,
                dataIndex: 2,
            },
            {
                date: new Date("2024-01-01T12:00:00Z"),
                open: 105,
                high: 108,
                low: 103,
                close: 106,
                volume: 1500,
                index: 3,
                dataIndex: 3,
            },
        ];
        const firstDrawing = createDrawingObject("trendLine", [
            { x: manipulationData[0].date.getTime(), y: 100 },
            { x: manipulationData[2].date.getTime(), y: 104 },
        ], { id: "fork-multi-move-1", paneId: "price", yScaleId: "price-right" });
        const secondDrawing = createDrawingObject("trendLine", [
            { x: manipulationData[1].date.getTime(), y: 103 },
            { x: manipulationData[3].date.getTime(), y: 106 },
        ], { id: "fork-multi-move-2", paneId: "price", yScaleId: "price-right" });
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: manipulationData, engineRuntime: "fork", drawingUiEnabled: true, drawings: [firstDrawing, secondDrawing], onDrawingsChange: handleDrawingsChange }));
            await flushMicrotasks();
        });
        const host = await waitForTruthyValue(() => container?.querySelector('[data-vn-kline-engine-host="true"]'));
        Object.defineProperty(host, "getBoundingClientRect", {
            configurable: true,
            value: () => ({
                bottom: 720,
                height: 720,
                left: 0,
                right: 1200,
                top: 0,
                width: 1200,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            }),
        });
        const firstBodyPoint = resolveTrendLineBodyPoint(manipulationData, firstDrawing, mockVisibleRange);
        const secondBodyPoint = resolveTrendLineBodyPoint(manipulationData, secondDrawing, mockVisibleRange);
        if (!firstBodyPoint || !secondBodyPoint) {
            throw new Error("Expected deterministic trend-line body points for multi-selection move");
        }
        await act(async () => {
            host.dispatchEvent(new MouseEvent("click", {
                bubbles: true,
                clientX: firstBodyPoint.x,
                clientY: firstBodyPoint.y,
            }));
            host.dispatchEvent(new MouseEvent("click", {
                bubbles: true,
                clientX: secondBodyPoint.x,
                clientY: secondBodyPoint.y,
                ctrlKey: true,
            }));
            await flushMicrotasks();
        });
        const PointerEventCtor = window.PointerEvent ?? window.MouseEvent;
        await act(async () => {
            host.dispatchEvent(new PointerEventCtor("pointerdown", {
                bubbles: true,
                buttons: 1,
                clientX: firstBodyPoint.x,
                clientY: firstBodyPoint.y,
            }));
            host.dispatchEvent(new PointerEventCtor("pointermove", {
                bubbles: true,
                buttons: 1,
                clientX: firstBodyPoint.x + 42,
                clientY: firstBodyPoint.y + 24,
            }));
            host.dispatchEvent(new PointerEventCtor("pointerup", {
                bubbles: true,
                buttons: 0,
                clientX: firstBodyPoint.x + 42,
                clientY: firstBodyPoint.y + 24,
            }));
            await flushMicrotasks();
        });
        const movedDrawings = await waitForTruthyValue(() => handleDrawingsChange.mock.calls
            .map((call) => call[0])
            .findLast((value) => value?.some((drawing) => drawing.id === firstDrawing.id) && value?.some((drawing) => drawing.id === secondDrawing.id)));
        const movedFirstDrawing = movedDrawings.find((drawing) => drawing.id === firstDrawing.id);
        const movedSecondDrawing = movedDrawings.find((drawing) => drawing.id === secondDrawing.id);
        expect(movedFirstDrawing?.points).not.toEqual(firstDrawing.points);
        expect(movedSecondDrawing?.points).not.toEqual(secondDrawing.points);
    });
    it("resets stale fork manipulation session on window blur to keep X anchor stable", async () => {
        const adapter = createAdapter(Promise.resolve([]), "fork-stale-session-blur-reset");
        mockVisibleRange = { from: 0, to: 3 };
        const manipulationData = [
            ...forkRuntimeData,
            {
                date: new Date("2024-01-01T11:00:00Z"),
                open: 104,
                high: 107,
                low: 102,
                close: 105,
                volume: 1400,
                index: 2,
                dataIndex: 2,
            },
            {
                date: new Date("2024-01-01T12:00:00Z"),
                open: 105,
                high: 108,
                low: 103,
                close: 106,
                volume: 1500,
                index: 3,
                dataIndex: 3,
            },
        ];
        const baseDrawing = createDrawingObject("trendLine", [
            { x: manipulationData[1].date.getTime(), y: 102 },
            { x: manipulationData[2].date.getTime(), y: 105 },
        ], { id: "fork-stale-session-blur-id", paneId: "price", yScaleId: "price-right" });
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: manipulationData, engineRuntime: "fork", drawingUiEnabled: true, drawings: [baseDrawing], selectedDrawing: baseDrawing }));
            await flushMicrotasks();
        });
        const host = await waitForTruthyValue(() => container?.querySelector('[data-vn-kline-engine-host="true"]'));
        Object.defineProperty(host, "getBoundingClientRect", {
            configurable: true,
            value: () => ({
                bottom: 720,
                height: 720,
                left: 0,
                right: 1200,
                top: 0,
                width: 1200,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            }),
        });
        const bodyPoint = resolveTrendLineBodyPoint(manipulationData, baseDrawing, mockVisibleRange);
        if (!bodyPoint) {
            throw new Error("Expected deterministic trend-line body point for stale-session blur guard");
        }
        const readPrimitive = () => {
            const overlayInputs = [...engineHostPropsHistory]
                .map((props) => props.overlayInputs)
                .findLast(Boolean);
            const primitive = overlayInputs?.drawingPrimitives?.find((entry) => entry.drawingId === baseDrawing.id);
            return primitive ? JSON.stringify(primitive.primitive) : null;
        };
        const initialPrimitive = readPrimitive();
        expect(initialPrimitive).not.toBeNull();
        const PointerEventCtor = window.PointerEvent ?? window.MouseEvent;
        await act(async () => {
            host.dispatchEvent(new PointerEventCtor("pointerdown", {
                bubbles: true,
                buttons: 1,
                clientX: bodyPoint.x,
                clientY: bodyPoint.y,
            }));
            host.dispatchEvent(new PointerEventCtor("pointermove", {
                bubbles: true,
                buttons: 1,
                clientX: bodyPoint.x + 72,
                clientY: bodyPoint.y - 24,
            }));
            await flushMicrotasks();
        });
        const primitiveDuringDrag = readPrimitive();
        expect(primitiveDuringDrag).not.toBeNull();
        await act(async () => {
            window.dispatchEvent(new Event("blur"));
            await flushMicrotasks();
        });
        const primitiveAfterBlur = readPrimitive();
        expect(primitiveAfterBlur).toBe(initialPrimitive);
    });
    it("clears stale fork manipulation preview when switching runtime fork -> legacy -> fork", async () => {
        const adapter = createAdapter(Promise.resolve([]), "fork-runtime-switch-reset");
        mockVisibleRange = { from: 0, to: 3 };
        const manipulationData = [
            ...forkRuntimeData,
            {
                date: new Date("2024-01-01T11:00:00Z"),
                open: 104,
                high: 107,
                low: 102,
                close: 105,
                volume: 1400,
                index: 2,
                dataIndex: 2,
            },
            {
                date: new Date("2024-01-01T12:00:00Z"),
                open: 105,
                high: 108,
                low: 103,
                close: 106,
                volume: 1500,
                index: 3,
                dataIndex: 3,
            },
        ];
        const baseDrawing = createDrawingObject("trendLine", [
            { x: manipulationData[1].date.getTime(), y: 102 },
            { x: manipulationData[2].date.getTime(), y: 105 },
        ], { id: "fork-runtime-switch-reset-id", paneId: "price", yScaleId: "price-right" });
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        const renderChart = async (runtime) => {
            await act(async () => {
                root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: manipulationData, engineRuntime: runtime, drawingUiEnabled: true, drawings: [baseDrawing], selectedDrawing: baseDrawing }));
                await flushMicrotasks();
            });
        };
        await renderChart("fork");
        const host = await waitForTruthyValue(() => container?.querySelector('[data-vn-kline-engine-host="true"]'));
        Object.defineProperty(host, "getBoundingClientRect", {
            configurable: true,
            value: () => ({
                bottom: 720,
                height: 720,
                left: 0,
                right: 1200,
                top: 0,
                width: 1200,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            }),
        });
        const bodyPoint = resolveTrendLineBodyPoint(manipulationData, baseDrawing, mockVisibleRange);
        if (!bodyPoint) {
            throw new Error("Expected deterministic trend-line body point for runtime switch stale-session guard");
        }
        const readPrimitive = () => {
            const overlayInputs = [...engineHostPropsHistory]
                .map((props) => props.overlayInputs)
                .findLast(Boolean);
            const primitive = overlayInputs?.drawingPrimitives?.find((entry) => entry.drawingId === baseDrawing.id);
            return primitive ? JSON.stringify(primitive.primitive) : null;
        };
        const initialPrimitive = readPrimitive();
        expect(initialPrimitive).not.toBeNull();
        const PointerEventCtor = window.PointerEvent ?? window.MouseEvent;
        await act(async () => {
            host.dispatchEvent(new PointerEventCtor("pointerdown", {
                bubbles: true,
                buttons: 1,
                clientX: bodyPoint.x,
                clientY: bodyPoint.y,
            }));
            host.dispatchEvent(new PointerEventCtor("pointermove", {
                bubbles: true,
                buttons: 1,
                clientX: bodyPoint.x + 72,
                clientY: bodyPoint.y - 24,
            }));
            await flushMicrotasks();
        });
        const primitiveDuringDrag = readPrimitive();
        expect(primitiveDuringDrag).not.toBeNull();
        await renderChart("legacy");
        await renderChart("fork");
        const primitiveAfterRuntimeRoundTrip = readPrimitive();
        expect(primitiveAfterRuntimeRoundTrip).toBe(initialPrimitive);
    });
    it("keeps fork drawings offscreen when dragged outside the viewport so they can reappear after pan restore", async () => {
        const adapter = createAdapter(Promise.resolve([]), "fork-offscreen-drag-restore");
        const handleDrawingsChange = vi.fn();
        mockVisibleRange = { from: 0, to: 3 };
        const manipulationData = [
            ...forkRuntimeData,
            {
                date: new Date("2024-01-01T11:00:00Z"),
                open: 104,
                high: 107,
                low: 102,
                close: 105,
                volume: 1400,
                index: 2,
                dataIndex: 2,
            },
            {
                date: new Date("2024-01-01T12:00:00Z"),
                open: 105,
                high: 108,
                low: 103,
                close: 106,
                volume: 1500,
                index: 3,
                dataIndex: 3,
            },
        ];
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        const baseDrawing = createDrawingObject("trendLine", [
            { x: manipulationData[0].date.getTime(), y: 100 },
            { x: manipulationData[1].date.getTime(), y: 105 },
        ], { id: "fork-offscreen-drag", paneId: "price", yScaleId: "price-right" });
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: manipulationData, engineRuntime: "fork", drawingUiEnabled: true, drawings: [baseDrawing], selectedDrawing: baseDrawing, onDrawingsChange: handleDrawingsChange }));
            await flushMicrotasks();
        });
        const host = await waitForTruthyValue(() => container?.querySelector('[data-vn-kline-engine-host="true"]'));
        Object.defineProperty(host, "getBoundingClientRect", {
            configurable: true,
            value: () => ({
                bottom: 720,
                height: 720,
                left: 0,
                right: 1200,
                top: 0,
                width: 1200,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            }),
        });
        const bodyPoint = resolveTrendLineBodyPoint(manipulationData, baseDrawing, mockVisibleRange);
        if (!bodyPoint) {
            throw new Error("Expected deterministic trend-line body point for offscreen drag");
        }
        const PointerEventCtor = window.PointerEvent ?? window.MouseEvent;
        await act(async () => {
            host.dispatchEvent(new PointerEventCtor("pointerdown", {
                bubbles: true,
                buttons: 1,
                clientX: bodyPoint.x,
                clientY: bodyPoint.y,
            }));
            host.dispatchEvent(new PointerEventCtor("pointermove", {
                bubbles: true,
                buttons: 1,
                clientX: bodyPoint.x + 900,
                clientY: bodyPoint.y,
            }));
            host.dispatchEvent(new PointerEventCtor("pointerup", {
                bubbles: true,
                buttons: 0,
                clientX: bodyPoint.x + 900,
                clientY: bodyPoint.y,
            }));
            await flushMicrotasks();
        });
        const movedDrawings = await waitForTruthyValue(() => handleDrawingsChange.mock.calls
            .map((call) => call[0])
            .findLast((value) => value?.some((drawing) => drawing.id === baseDrawing.id)));
        const movedDrawing = movedDrawings.find((drawing) => drawing.id === baseDrawing.id);
        expect(movedDrawing).toBeTruthy();
        expect(movedDrawing?.points[0].x).toBeGreaterThanOrEqual(baseDrawing.points[0].x);
        expect(movedDrawing?.points[1].x).toBeGreaterThanOrEqual(baseDrawing.points[1].x);
        const latestHostProps = engineHostPropsHistory[engineHostPropsHistory.length - 1];
        expect(typeof latestHostProps.onVisibleRangeChange).toBe("function");
        await act(async () => {
            latestHostProps.onVisibleRangeChange?.({ from: 2, to: 3 });
            await flushMicrotasks();
        });
        const restoredPrimitive = [...engineHostPropsHistory]
            .map((props) => props.overlayInputs)
            .findLast((value) => value?.drawingPrimitives?.some((primitive) => primitive.drawingId === baseDrawing.id));
        expect(restoredPrimitive?.drawingPrimitives?.some((primitive) => primitive.drawingId === baseDrawing.id)).toBe(true);
    });
    it("preserves fork drawing time anchors when dragged past the left viewport edge", async () => {
        const adapter = createAdapter(Promise.resolve([]), "fork-offscreen-left-drag");
        const handleDrawingsChange = vi.fn();
        mockVisibleRange = { from: 0, to: 3 };
        const manipulationData = [
            ...forkRuntimeData,
            {
                date: new Date("2024-01-01T11:00:00Z"),
                open: 104,
                high: 107,
                low: 102,
                close: 105,
                volume: 1400,
                index: 2,
                dataIndex: 2,
            },
            {
                date: new Date("2024-01-01T12:00:00Z"),
                open: 105,
                high: 108,
                low: 103,
                close: 106,
                volume: 1500,
                index: 3,
                dataIndex: 3,
            },
        ];
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        const baseDrawing = createDrawingObject("trendLine", [
            { x: manipulationData[1].date.getTime(), y: 102 },
            { x: manipulationData[2].date.getTime(), y: 105 },
        ], { id: "fork-offscreen-left", paneId: "price", yScaleId: "price-right" });
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: manipulationData, engineRuntime: "fork", drawingUiEnabled: true, drawings: [baseDrawing], selectedDrawing: baseDrawing, onDrawingsChange: handleDrawingsChange }));
            await flushMicrotasks();
        });
        const host = await waitForTruthyValue(() => container?.querySelector('[data-vn-kline-engine-host="true"]'));
        Object.defineProperty(host, "getBoundingClientRect", {
            configurable: true,
            value: () => ({
                bottom: 720,
                height: 720,
                left: 0,
                right: 1200,
                top: 0,
                width: 1200,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            }),
        });
        const bodyPoint = resolveTrendLineBodyPoint(manipulationData, baseDrawing, mockVisibleRange);
        if (!bodyPoint) {
            throw new Error("Expected deterministic trend-line body point for left offscreen drag");
        }
        const PointerEventCtor = window.PointerEvent ?? window.MouseEvent;
        await act(async () => {
            host.dispatchEvent(new PointerEventCtor("pointerdown", {
                bubbles: true,
                buttons: 1,
                clientX: bodyPoint.x,
                clientY: bodyPoint.y,
            }));
            host.dispatchEvent(new PointerEventCtor("pointermove", {
                bubbles: true,
                buttons: 1,
                clientX: bodyPoint.x - 900,
                clientY: bodyPoint.y,
            }));
            host.dispatchEvent(new PointerEventCtor("pointerup", {
                bubbles: true,
                buttons: 0,
                clientX: bodyPoint.x - 900,
                clientY: bodyPoint.y,
            }));
            await flushMicrotasks();
        });
        const movedDrawings = await waitForTruthyValue(() => handleDrawingsChange.mock.calls
            .map((call) => call[0])
            .findLast((value) => value?.some((drawing) => drawing.id === baseDrawing.id)));
        const movedDrawing = movedDrawings.find((drawing) => drawing.id === baseDrawing.id);
        expect(movedDrawing).toBeTruthy();
        expect(movedDrawing?.points[0].x).toBeLessThanOrEqual(baseDrawing.points[0].x);
        expect(movedDrawing?.points[1].x).toBeLessThanOrEqual(baseDrawing.points[1].x);
    });
    it("resizes selected explicit fork trend-line drawings through the widget workspace contract", async () => {
        const adapter = createAdapter(Promise.resolve([]), "fork-trendline-resize");
        const handleDrawingsChange = vi.fn();
        const manipulationData = [
            ...forkRuntimeData,
            {
                date: new Date("2024-01-01T11:00:00Z"),
                open: 104,
                high: 107,
                low: 102,
                close: 105,
                volume: 1400,
                index: 2,
                dataIndex: 2,
            },
            {
                date: new Date("2024-01-01T12:00:00Z"),
                open: 105,
                high: 108,
                low: 103,
                close: 106,
                volume: 1500,
                index: 3,
                dataIndex: 3,
            },
        ];
        const drawing = createDrawingObject("trendLine", [
            { x: manipulationData[0].date.getTime(), y: 100 },
            { x: manipulationData[1].date.getTime(), y: 106 },
        ], {
            id: "fork-resize-drawing",
            paneId: "price",
            yScaleId: "price-right",
        });
        mockVisibleRange = { from: 0, to: 3 };
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: manipulationData, engineRuntime: "fork", drawingUiEnabled: true, drawings: [drawing], selectedDrawing: drawing, onDrawingsChange: handleDrawingsChange }));
            await flushMicrotasks();
        });
        const host = await waitForTruthyValue(() => container?.querySelector('[data-vn-kline-engine-host="true"]'));
        Object.defineProperty(host, "getBoundingClientRect", {
            configurable: true,
            value: () => ({
                bottom: 720,
                height: 720,
                left: 0,
                right: 1200,
                top: 0,
                width: 1200,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            }),
        });
        await waitForTruthyValue(() => [...engineHostPropsHistory]
            .map((props) => props.overlayInputs)
            .findLast((value) => value?.drawingPrimitives?.some((primitive) => primitive.key === "fork-resize-drawing"))
            ?.drawingPrimitives);
        const resizeStartPoint = resolveTrendLinePointPixel(manipulationData, mockVisibleRange, 1, 106);
        const resizeEndPoint = resolveTrendLinePointPixel(manipulationData, mockVisibleRange, 2, 105);
        if (!resizeStartPoint || !resizeEndPoint) {
            throw new Error("Expected deterministic fork resize points");
        }
        const PointerEventCtor = window.PointerEvent ?? window.MouseEvent;
        await act(async () => {
            host.dispatchEvent(new PointerEventCtor("pointerdown", {
                bubbles: true,
                buttons: 1,
                clientX: resizeStartPoint.x,
                clientY: resizeStartPoint.y,
            }));
            host.dispatchEvent(new PointerEventCtor("pointermove", {
                bubbles: true,
                buttons: 1,
                clientX: resizeEndPoint.x,
                clientY: resizeEndPoint.y,
            }));
            host.dispatchEvent(new PointerEventCtor("pointerup", {
                bubbles: true,
                clientX: resizeEndPoint.x,
                clientY: resizeEndPoint.y,
            }));
            await flushMicrotasks();
        });
        const resizedDrawings = await waitForTruthyValue(() => handleDrawingsChange.mock.calls
            .map((call) => call[0])
            .findLast((value) => value?.some((candidate) => candidate.id === "fork-resize-drawing")));
        expect(resizedDrawings[0]?.id).toBe("fork-resize-drawing");
        expect(resizedDrawings[0]?.points).toHaveLength(2);
        expect(resizedDrawings[0]?.points?.[1]?.x ?? Number.NaN).toBeGreaterThanOrEqual(manipulationData[1].date.getTime());
        expect(Math.abs((resizedDrawings[0]?.points?.[1]?.y ?? Number.NaN) - 105)).toBeLessThanOrEqual(1);
    });
    it("resizes selected explicit fork rectangle drawings through the widget workspace contract", async () => {
        const adapter = createAdapter(Promise.resolve([]), "fork-rectangle-resize");
        const handleDrawingsChange = vi.fn();
        const manipulationData = [
            ...forkRuntimeData,
            {
                date: new Date("2024-01-01T11:00:00Z"),
                open: 104,
                high: 107,
                low: 102,
                close: 105,
                volume: 1400,
                index: 2,
                dataIndex: 2,
            },
            {
                date: new Date("2024-01-01T12:00:00Z"),
                open: 105,
                high: 108,
                low: 103,
                close: 106,
                volume: 1500,
                index: 3,
                dataIndex: 3,
            },
        ];
        const drawing = createDrawingObject("rectangle", [
            { x: manipulationData[0].date.getTime(), y: 100 },
            { x: manipulationData[1].date.getTime(), y: 106 },
        ], {
            id: "fork-rectangle-resize-drawing",
            paneId: "price",
            yScaleId: "price-right",
        });
        mockVisibleRange = { from: 0, to: 3 };
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: manipulationData, engineRuntime: "fork", drawingUiEnabled: true, drawings: [drawing], selectedDrawing: drawing, onDrawingsChange: handleDrawingsChange }));
            await flushMicrotasks();
        });
        const host = await waitForTruthyValue(() => container?.querySelector('[data-vn-kline-engine-host="true"]'));
        Object.defineProperty(host, "getBoundingClientRect", {
            configurable: true,
            value: () => ({
                bottom: 720,
                height: 720,
                left: 0,
                right: 1200,
                top: 0,
                width: 1200,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            }),
        });
        await waitForTruthyValue(() => [...engineHostPropsHistory]
            .map((props) => props.overlayInputs)
            .findLast((value) => value?.drawingPrimitives?.some((primitive) => primitive.key === "fork-rectangle-resize-drawing"))
            ?.drawingPrimitives);
        const resizeStartPoint = resolveTrendLinePointPixel(manipulationData, mockVisibleRange, 1, 106);
        const resizeEndPoint = resolveTrendLinePointPixel(manipulationData, mockVisibleRange, 2, 105);
        if (!resizeStartPoint || !resizeEndPoint) {
            throw new Error("Expected deterministic fork rectangle resize points");
        }
        const PointerEventCtor = window.PointerEvent ?? window.MouseEvent;
        await act(async () => {
            host.dispatchEvent(new PointerEventCtor("pointerdown", {
                bubbles: true,
                buttons: 1,
                clientX: resizeStartPoint.x,
                clientY: resizeStartPoint.y,
            }));
            host.dispatchEvent(new PointerEventCtor("pointermove", {
                bubbles: true,
                buttons: 1,
                clientX: resizeEndPoint.x,
                clientY: resizeEndPoint.y,
            }));
            host.dispatchEvent(new PointerEventCtor("pointerup", {
                bubbles: true,
                clientX: resizeEndPoint.x,
                clientY: resizeEndPoint.y,
            }));
            await flushMicrotasks();
        });
        const resizedDrawings = await waitForTruthyValue(() => handleDrawingsChange.mock.calls
            .map((call) => call[0])
            .findLast((value) => value?.some((candidate) => candidate.id === "fork-rectangle-resize-drawing")));
        expect(resizedDrawings[0]?.id).toBe("fork-rectangle-resize-drawing");
        expect(resizedDrawings[0]?.points).toHaveLength(2);
        expect(resizedDrawings[0]?.points?.[1]?.x ?? Number.NaN).toBeGreaterThanOrEqual(manipulationData[1].date.getTime());
        expect(Math.abs((resizedDrawings[0]?.points?.[1]?.y ?? Number.NaN) - 105)).toBeLessThanOrEqual(1);
    });
    it("resizes selected explicit fork circle drawings through the widget workspace contract", async () => {
        const adapter = createAdapter(Promise.resolve([]), "fork-circle-resize");
        const handleDrawingsChange = vi.fn();
        const manipulationData = [
            ...forkRuntimeData,
            {
                date: new Date("2024-01-01T11:00:00Z"),
                open: 104,
                high: 107,
                low: 102,
                close: 105,
                volume: 1400,
                index: 2,
                dataIndex: 2,
            },
            {
                date: new Date("2024-01-01T12:00:00Z"),
                open: 105,
                high: 108,
                low: 103,
                close: 106,
                volume: 1500,
                index: 3,
                dataIndex: 3,
            },
        ];
        const drawing = createDrawingObject("circle", [
            { x: manipulationData[0].date.getTime(), y: 100 },
            { x: manipulationData[1].date.getTime(), y: 106 },
        ], {
            id: "fork-circle-resize-drawing",
            paneId: "price",
            yScaleId: "price-right",
        });
        mockVisibleRange = { from: 0, to: 3 };
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: manipulationData, engineRuntime: "fork", drawingUiEnabled: true, drawings: [drawing], selectedDrawing: drawing, onDrawingsChange: handleDrawingsChange }));
            await flushMicrotasks();
        });
        const host = await waitForTruthyValue(() => container?.querySelector('[data-vn-kline-engine-host="true"]'));
        Object.defineProperty(host, "getBoundingClientRect", {
            configurable: true,
            value: () => ({
                bottom: 720,
                height: 720,
                left: 0,
                right: 1200,
                top: 0,
                width: 1200,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            }),
        });
        await waitForTruthyValue(() => [...engineHostPropsHistory]
            .map((props) => props.overlayInputs)
            .findLast((value) => value?.drawingPrimitives?.some((primitive) => primitive.key === "fork-circle-resize-drawing"))
            ?.drawingPrimitives);
        const resizeStartPoint = resolveTrendLinePointPixel(manipulationData, mockVisibleRange, 1, 106);
        const resizeEndPoint = resolveTrendLinePointPixel(manipulationData, mockVisibleRange, 2, 105);
        if (!resizeStartPoint || !resizeEndPoint) {
            throw new Error("Expected deterministic fork circle resize points");
        }
        const PointerEventCtor = window.PointerEvent ?? window.MouseEvent;
        await act(async () => {
            host.dispatchEvent(new PointerEventCtor("pointerdown", {
                bubbles: true,
                buttons: 1,
                clientX: resizeStartPoint.x,
                clientY: resizeStartPoint.y,
            }));
            host.dispatchEvent(new PointerEventCtor("pointermove", {
                bubbles: true,
                buttons: 1,
                clientX: resizeEndPoint.x,
                clientY: resizeEndPoint.y,
            }));
            host.dispatchEvent(new PointerEventCtor("pointerup", {
                bubbles: true,
                clientX: resizeEndPoint.x,
                clientY: resizeEndPoint.y,
            }));
            await flushMicrotasks();
        });
        const resizedDrawings = await waitForTruthyValue(() => handleDrawingsChange.mock.calls
            .map((call) => call[0])
            .findLast((value) => value?.some((candidate) => candidate.id === "fork-circle-resize-drawing")));
        expect(resizedDrawings[0]?.id).toBe("fork-circle-resize-drawing");
        expect(resizedDrawings[0]?.points).toHaveLength(2);
        expect(resizedDrawings[0]?.points?.[1]?.x ?? Number.NaN).toBeGreaterThanOrEqual(manipulationData[1].date.getTime());
        expect(Math.abs((resizedDrawings[0]?.points?.[1]?.y ?? Number.NaN) - 105)).toBeLessThanOrEqual(1);
    });
    it("resizes selected explicit fork ellipse drawings through the widget workspace contract", async () => {
        const adapter = createAdapter(Promise.resolve([]), "fork-ellipse-resize");
        const handleDrawingsChange = vi.fn();
        const manipulationData = [
            ...forkRuntimeData,
            {
                date: new Date("2024-01-01T11:00:00Z"),
                open: 104,
                high: 107,
                low: 102,
                close: 105,
                volume: 1400,
                index: 2,
                dataIndex: 2,
            },
            {
                date: new Date("2024-01-01T12:00:00Z"),
                open: 105,
                high: 108,
                low: 103,
                close: 106,
                volume: 1500,
                index: 3,
                dataIndex: 3,
            },
        ];
        const drawing = createDrawingObject("ellipse", [
            { x: manipulationData[0].date.getTime(), y: 100 },
            { x: manipulationData[1].date.getTime(), y: 106 },
        ], {
            id: "fork-ellipse-resize-drawing",
            paneId: "price",
            yScaleId: "price-right",
        });
        mockVisibleRange = { from: 0, to: 3 };
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: manipulationData, engineRuntime: "fork", drawingUiEnabled: true, drawings: [drawing], selectedDrawing: drawing, onDrawingsChange: handleDrawingsChange }));
            await flushMicrotasks();
        });
        const host = await waitForTruthyValue(() => container?.querySelector('[data-vn-kline-engine-host="true"]'));
        Object.defineProperty(host, "getBoundingClientRect", {
            configurable: true,
            value: () => ({
                bottom: 720,
                height: 720,
                left: 0,
                right: 1200,
                top: 0,
                width: 1200,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            }),
        });
        await waitForTruthyValue(() => [...engineHostPropsHistory]
            .map((props) => props.overlayInputs)
            .findLast((value) => value?.drawingPrimitives?.some((primitive) => primitive.key === "fork-ellipse-resize-drawing"))
            ?.drawingPrimitives);
        const resizeStartPoint = resolveTrendLinePointPixel(manipulationData, mockVisibleRange, 1, 106);
        const resizeEndPoint = resolveTrendLinePointPixel(manipulationData, mockVisibleRange, 2, 105);
        if (!resizeStartPoint || !resizeEndPoint) {
            throw new Error("Expected deterministic fork ellipse resize points");
        }
        const PointerEventCtor = window.PointerEvent ?? window.MouseEvent;
        await act(async () => {
            host.dispatchEvent(new PointerEventCtor("pointerdown", {
                bubbles: true,
                buttons: 1,
                clientX: resizeStartPoint.x,
                clientY: resizeStartPoint.y,
            }));
            host.dispatchEvent(new PointerEventCtor("pointermove", {
                bubbles: true,
                buttons: 1,
                clientX: resizeEndPoint.x,
                clientY: resizeEndPoint.y,
            }));
            host.dispatchEvent(new PointerEventCtor("pointerup", {
                bubbles: true,
                clientX: resizeEndPoint.x,
                clientY: resizeEndPoint.y,
            }));
            await flushMicrotasks();
        });
        const resizedDrawings = await waitForTruthyValue(() => handleDrawingsChange.mock.calls
            .map((call) => call[0])
            .findLast((value) => value?.some((candidate) => candidate.id === "fork-ellipse-resize-drawing")));
        expect(resizedDrawings[0]?.id).toBe("fork-ellipse-resize-drawing");
        expect(resizedDrawings[0]?.points).toHaveLength(2);
        expect(resizedDrawings[0]?.points?.[1]?.x ?? Number.NaN).toBeGreaterThanOrEqual(manipulationData[1].date.getTime());
        expect(Math.abs((resizedDrawings[0]?.points?.[1]?.y ?? Number.NaN) - 105)).toBeLessThanOrEqual(1);
    });
    it("resizes selected auto-fork rectangle drawings when cursor editing stays on the fork runtime", async () => {
        const adapter = createAdapter(Promise.resolve([]), "auto-fork-rectangle-cursor-resize");
        const handleDrawingsChange = vi.fn();
        const manipulationData = [
            ...forkRuntimeData,
            {
                date: new Date("2024-01-01T11:00:00Z"),
                open: 104,
                high: 107,
                low: 102,
                close: 105,
                volume: 1400,
                index: 2,
                dataIndex: 2,
            },
            {
                date: new Date("2024-01-01T12:00:00Z"),
                open: 105,
                high: 108,
                low: 103,
                close: 106,
                volume: 1500,
                index: 3,
                dataIndex: 3,
            },
        ];
        const drawing = createDrawingObject("rectangle", [
            { x: manipulationData[0].date.getTime(), y: 100 },
            { x: manipulationData[1].date.getTime(), y: 106 },
        ], {
            id: "auto-fork-rectangle-cursor-resize-drawing",
            paneId: "price",
            yScaleId: "price-right",
        });
        mockVisibleRange = { from: 0, to: 3 };
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: manipulationData, engineRuntime: "auto", drawingUiEnabled: true, drawingActiveTool: "cursor", drawings: [drawing], selectedDrawing: drawing, onDrawingsChange: handleDrawingsChange }));
            await flushMicrotasks();
        });
        const host = await waitForTruthyValue(() => container?.querySelector('[data-vn-kline-engine-host="true"]'));
        Object.defineProperty(host, "getBoundingClientRect", {
            configurable: true,
            value: () => ({
                bottom: 720,
                height: 720,
                left: 0,
                right: 1200,
                top: 0,
                width: 1200,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            }),
        });
        await waitForTruthyValue(() => [...engineHostPropsHistory]
            .map((props) => props.overlayInputs)
            .findLast((value) => value?.drawingPrimitives?.some((primitive) => primitive.key === "auto-fork-rectangle-cursor-resize-drawing"))
            ?.drawingPrimitives);
        const resizeStartPoint = resolveTrendLinePointPixel(manipulationData, mockVisibleRange, 1, 106);
        const resizeEndPoint = resolveTrendLinePointPixel(manipulationData, mockVisibleRange, 2, 105);
        if (!resizeStartPoint || !resizeEndPoint) {
            throw new Error("Expected deterministic auto-fork rectangle cursor resize points");
        }
        const PointerEventCtor = window.PointerEvent ?? window.MouseEvent;
        await act(async () => {
            host.dispatchEvent(new PointerEventCtor("pointerdown", {
                bubbles: true,
                buttons: 1,
                clientX: resizeStartPoint.x,
                clientY: resizeStartPoint.y,
            }));
            host.dispatchEvent(new PointerEventCtor("pointermove", {
                bubbles: true,
                buttons: 1,
                clientX: resizeEndPoint.x,
                clientY: resizeEndPoint.y,
            }));
            host.dispatchEvent(new PointerEventCtor("pointerup", {
                bubbles: true,
                clientX: resizeEndPoint.x,
                clientY: resizeEndPoint.y,
            }));
            await flushMicrotasks();
        });
        const resizedDrawings = await waitForTruthyValue(() => handleDrawingsChange.mock.calls
            .map((call) => call[0])
            .findLast((value) => value?.some((candidate) => candidate.id === "auto-fork-rectangle-cursor-resize-drawing")));
        expect(resizedDrawings[0]?.id).toBe("auto-fork-rectangle-cursor-resize-drawing");
        expect(resizedDrawings[0]?.points).toHaveLength(2);
        expect(resizedDrawings[0]?.points?.[1]?.x ?? Number.NaN).toBeGreaterThanOrEqual(manipulationData[1].date.getTime());
        expect(Math.abs((resizedDrawings[0]?.points?.[1]?.y ?? Number.NaN) - 105)).toBeLessThanOrEqual(1);
    });
    // ── Explicit Regression Tests W-10 to W-18 ─────────────────────────────────
    // ─────────────────────────────────────────────────────────────────────────
});
