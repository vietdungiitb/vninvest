import { jsx as _jsx } from "react/jsx-runtime";
// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hitTestOverlayPrimitive, } from "@vninvestcharts/vn-kline-engine-core";
import { VNInvestCharts } from "../VNInvestCharts";
import { chartPointToPixelWithBridge, measurementPointToPixelWithBridge, resolveChartPointWithBridge, resolveMeasurementPointWithBridge, } from "../../lib/drawing/coordinateBridge";
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
            return (_jsx("div", { "data-vn-kline-engine-host": "true", className: props.className, style: props.style, onPointerMove: (event) => {
                    emitPaneHover(event);
                    props.onPointerMove?.(resolvePointerContext(event));
                }, children: _jsx("div", { "data-vn-kline-engine": "surface", "data-locale": props.locale, children: _jsx("canvas", { "data-vn-kline-engine": "canvas", width: 600, height: 320 }) }) }));
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
describe("VNInvestCharts measurement contracts", () => {
    let container = null;
    let root = null;
    beforeEach(() => {
        window.localStorage.clear();
        document.documentElement.lang = "en";
        mockVisibleRange = { from: 0, to: 2 };
        engineHostPropsHistory.length = 0;
        mockEngineInstance.zoomToRange.mockClear();
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
    it("renders an engine-backed measurement overlay on the fork runtime", async () => {
        const adapter = createAdapter(Promise.resolve([]), "fork-measurement-overlay");
        const handlePaneHover = vi.fn();
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: forkRuntimeData, engineRuntime: "fork", locale: "vi", measurementEnabled: true, onPaneHover: handlePaneHover }));
            await flushMicrotasks();
        });
        const overlay = await waitForTruthyValue(() => container?.querySelector('[data-rsc-measurement-mode="engine"]'));
        expect(overlay).not.toBeNull();
        expect(overlay?.getAttribute("data-rsc-measurement-source")).toBe("engine");
        const overlayInputs = [...engineHostPropsHistory]
            .map((props) => props.overlayInputs)
            .findLast((value) => value?.measurementEnabled === true);
        expect(overlayInputs?.measurementEnabled).toBe(true);
        const host = container?.querySelector('[data-vn-kline-engine-host="true"]');
        expect(host).not.toBeNull();
        const rect = {
            bottom: 720,
            height: 720,
            left: 0,
            right: 1200,
            top: 0,
            width: 1200,
            x: 0,
            y: 0,
            toJSON: () => ({}),
        };
        Object.defineProperty(host, "getBoundingClientRect", {
            configurable: true,
            value: () => rect,
        });
        const PointerEventCtor = window.PointerEvent ?? window.MouseEvent;
        await act(async () => {
            host?.dispatchEvent(new PointerEventCtor("pointermove", {
                bubbles: true,
                clientX: 120,
                clientY: 12,
            }));
        });
        expect(handlePaneHover).toHaveBeenCalledWith("price");
    });
    it("exposes a fork coordinate bridge for measurement and chart point conversion", async () => {
        const adapter = createAdapter(Promise.resolve([]), "fork-coordinate-bridge");
        const handleCoordinateBridgeChange = vi.fn();
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: forkRuntimeData, engineRuntime: "fork", locale: "vi", onCoordinateBridgeChange: handleCoordinateBridgeChange }));
            await flushMicrotasks();
        });
        const bridge = await waitForTruthyValue(() => [...handleCoordinateBridgeChange.mock.calls].map((call) => call[0]).findLast(Boolean));
        expect(bridge).not.toBeNull();
        const point = resolveMeasurementPointWithBridge(bridge, {
            paneId: "price",
            x: 1200,
            y: 224,
            scaleSlotId: "price-right",
        });
        expect(point).toMatchObject({
            index: 1,
            date: forkRuntimeData[1].date,
        });
        expect(point?.price).toBeCloseTo(102.5, 6);
        const pixel = measurementPointToPixelWithBridge(bridge, {
            paneId: "price",
            point: point,
            scaleSlotId: "price-right",
        });
        expect(pixel?.x).toBe(900);
        expect(pixel?.y).toBeCloseTo(224, 6);
        const chartPoint = resolveChartPointWithBridge(bridge, {
            paneId: "price",
            x: 1200,
            y: 224,
            scaleSlotId: "price-right",
        });
        expect(chartPoint).toMatchObject({
            y: point?.price,
            xIndexFloat: 1.5,
            yPrice: point?.price,
        });
        expect(chartPoint?.x).toBe(chartPoint?.timeMsHint);
        const chartPixel = chartPointToPixelWithBridge(bridge, {
            paneId: "price",
            point: chartPoint,
            scaleSlotId: "price-right",
        });
        expect(chartPixel).toEqual({
            x: 1200,
            y: expect.closeTo(224, 6),
        });
        const latestHostProps = engineHostPropsHistory[engineHostPropsHistory.length - 1];
        expect(typeof latestHostProps.onVisibleRangeChange).toBe("function");
        await act(async () => {
            latestHostProps.onVisibleRangeChange?.({ from: -2.5, to: 1.5 });
            await flushMicrotasks();
        });
        expect(mockEngineInstance.zoomToRange).not.toHaveBeenCalled();
        const fractionalBridge = await waitForTruthyValue(() => [...handleCoordinateBridgeChange.mock.calls]
            .map((call) => call[0])
            .findLast((value) => value?.visibleRange?.from === 0 && value?.visibleRange?.to === 2));
        expect(fractionalBridge.visibleRange).toEqual({ from: 0, to: 2 });
        const firstBarPixel = chartPointToPixelWithBridge(fractionalBridge, {
            paneId: "price",
            point: { x: forkRuntimeData[0].date.getTime(), y: point.price },
            scaleSlotId: "price-right",
        });
        expect(firstBarPixel?.x).toBeCloseTo(300, 6);
        const firstBarPixelFromIndexAnchor = chartPointToPixelWithBridge(fractionalBridge, {
            paneId: "price",
            point: {
                x: forkRuntimeData[1].date.getTime(),
                y: point.price,
                xIndexFloat: 0,
                timeMsHint: forkRuntimeData[1].date.getTime(),
                yPrice: point.price,
            },
            scaleSlotId: "price-right",
        });
        expect(firstBarPixelFromIndexAnchor?.x).toBeCloseTo(300, 6);
    });
    it("exposes a legacy coordinate bridge for measurement and chart point conversion", async () => {
        const adapter = createAdapter(Promise.resolve([]), "legacy-coordinate-bridge");
        const handleCoordinateBridgeChange = vi.fn();
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: forkRuntimeData, engineRuntime: "legacy", locale: "vi", onCoordinateBridgeChange: handleCoordinateBridgeChange }));
            await flushMicrotasks();
        });
        const bridge = await waitForTruthyValue(() => [...handleCoordinateBridgeChange.mock.calls].map((call) => call[0]).findLast(Boolean));
        expect(bridge).not.toBeNull();
        expect(bridge.engineRuntime).toBe("legacy");
        expect(bridge.visibleRange).toEqual({ from: 0, to: forkRuntimeData.length });
        const point = resolveMeasurementPointWithBridge(bridge, {
            paneId: "price",
            x: 1200,
            y: 224,
            scaleSlotId: "price-right",
        });
        expect(point).toMatchObject({
            index: 1,
            date: forkRuntimeData[1].date,
        });
        const pixel = measurementPointToPixelWithBridge(bridge, {
            paneId: "price",
            point: point,
            scaleSlotId: "price-right",
        });
        const lastBarPixel = chartPointToPixelWithBridge(bridge, {
            paneId: "price",
            point: { x: forkRuntimeData[forkRuntimeData.length - 1].date.getTime(), y: point.price },
            scaleSlotId: "price-right",
        });
        expect(pixel?.x ?? 0).toBeGreaterThan(0);
        expect(pixel?.x ?? 0).toBeLessThanOrEqual(1200);
        expect(pixel?.x).toBeCloseTo(lastBarPixel?.x ?? Number.NaN, 6);
        expect(pixel?.y).toBeCloseTo(224, 6);
        expect(lastBarPixel?.x ?? 0).toBeGreaterThan(0);
        expect(lastBarPixel?.x ?? 0).toBeLessThanOrEqual(1200);
    });
});
