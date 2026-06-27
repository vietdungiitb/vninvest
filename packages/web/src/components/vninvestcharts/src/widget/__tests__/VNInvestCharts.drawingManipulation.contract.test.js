import { jsx as _jsx } from "react/jsx-runtime";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hitTestOverlayPrimitive, resolvePanePixelAtDataIndex, resolvePanePixelAtValue, } from "@vninvestcharts/vn-kline-engine-core";
import { DEFAULT_PANES } from "../../lib/core";
import { computePaneScaleSlotDomains } from "../../lib/core/paneScaleSlotDomains";
import { forkEngineSnapshots, forkRuntimeData, mergeTestPaneSnapshotDomains, resolveTrendLineBodyPoint, resolveTrendLinePointPixel, resolveTrendLineLockHandlePoint, createAdapter, createDeferred, flushMicrotasks, waitForTruthyValue, } from "./shared/contractTestHelpers.js";
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
describe("VNInvestCharts drawing manipulation", () => {
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
});
