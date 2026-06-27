import { jsx as _jsx } from "react/jsx-runtime";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hitTestOverlayPrimitive, resolvePanePixelAtDataIndex, } from "@vninvestcharts/vn-kline-engine-core";
import {
    forkEngineSnapshots,
    forkRuntimeData,
    mergeTestPaneSnapshotDomains,
    resolveTrendLineBodyPoint,
    resolveTrendLinePointPixel,
    resolveTrendLineLockHandlePoint,
    createAdapter,
    createDeferred,
    flushMicrotasks,
    waitForTruthyValue,
} from "./shared/contractTestHelpers.js";
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
const engineHostPropsHistory = [];
let mockVisibleRange = { from: 0, to: 2 };
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

describe("VNInvestCharts drawing creation", () => {
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
});
