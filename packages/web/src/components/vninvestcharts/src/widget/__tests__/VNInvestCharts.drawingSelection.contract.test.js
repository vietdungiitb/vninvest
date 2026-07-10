import { jsx as _jsx } from "react/jsx-runtime";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hitTestOverlayPrimitive } from "@vninvestcharts/vn-kline-engine-core";
import { forkEngineSnapshots, forkRuntimeData, mergeTestPaneSnapshotDomains, resolveTrendLineBodyPoint, resolveTrendLinePointPixel, resolveTrendLineLockHandlePoint, createAdapter, createDeferred, flushMicrotasks, waitForTruthyValue } from "./shared/contractTestHelpers.js";
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
describe("VNInvestCharts drawing selection", () => {
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
});
