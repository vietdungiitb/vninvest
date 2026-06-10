import { jsx as _jsx } from "react/jsx-runtime";
// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolvePanePixelAtDataIndex, resolvePanePixelAtValue, } from "@vninvestcharts/vn-kline-engine-core";
import { VNInvestCharts } from "../VNInvestCharts";
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
describe("VNInvestCharts auto-fork authoring contracts", () => {
    let container = null;
    let root = null;
    beforeEach(() => {
        window.localStorage.clear();
        document.documentElement.lang = "en";
        engineHostPropsHistory.length = 0;
        mockVisibleRange = { from: 0, to: 3 };
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
    it("creates auto-fork rectangle drawings through the widget workspace contract", async () => {
        const adapter = createAdapter(Promise.resolve([]), "auto-fork-rectangle-authoring");
        const handleDrawingWorkspaceChange = vi.fn();
        const handleDrawingsChange = vi.fn();
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
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: authoringData, engineRuntime: "auto", drawingUiEnabled: true, drawingActiveTool: "rectangle", onDrawingWorkspaceChange: handleDrawingWorkspaceChange, onDrawingsChange: handleDrawingsChange }));
            await flushMicrotasks();
        });
        expect(container.querySelector('[data-vn-kline-engine-host="true"]')).not.toBeNull();
        const workspace = await waitForTruthyValue(() => handleDrawingWorkspaceChange.mock.calls
            .map((call) => call[0])
            .find((value) => value && typeof value.setActiveTool === "function") ?? undefined);
        await act(async () => {
            workspace.setActiveTool?.("rectangle");
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
            throw new Error("Expected deterministic auto-fork rectangle authoring points");
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
            .findLast((value) => value?.length === 1 && value[0]?.type === "rectangle"));
        expect(createdDrawings[0]).toMatchObject({
            type: "rectangle",
            paneId: "price",
            yScaleId: "price-right",
            points: [
                { x: authoringData[0].date.getTime(), y: 100 },
                { x: authoringData[2].date.getTime() },
            ],
        });
        expect(createdDrawings[0]?.points?.[1]?.y ?? Number.NaN).toBeGreaterThan(104);
        expect(createdDrawings[0]?.points?.[1]?.y ?? Number.NaN).toBeLessThan(105.5);
    });
    it("creates auto-fork circle drawings through the widget workspace contract", async () => {
        const adapter = createAdapter(Promise.resolve([]), "auto-fork-circle-authoring");
        const handleDrawingWorkspaceChange = vi.fn();
        const handleDrawingsChange = vi.fn();
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
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: authoringData, engineRuntime: "auto", drawingUiEnabled: true, drawingActiveTool: "circle", onDrawingWorkspaceChange: handleDrawingWorkspaceChange, onDrawingsChange: handleDrawingsChange }));
            await flushMicrotasks();
        });
        expect(container.querySelector('[data-vn-kline-engine-host="true"]')).not.toBeNull();
        const workspace = await waitForTruthyValue(() => handleDrawingWorkspaceChange.mock.calls
            .map((call) => call[0])
            .find((value) => value && typeof value.setActiveTool === "function") ?? undefined);
        await act(async () => {
            workspace.setActiveTool?.("circle");
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
            throw new Error("Expected deterministic auto-fork circle authoring points");
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
            .findLast((value) => value?.length === 1 && value[0]?.type === "circle"));
        expect(createdDrawings[0]).toMatchObject({
            type: "circle",
            paneId: "price",
            yScaleId: "price-right",
            points: [
                { x: authoringData[0].date.getTime(), y: 100 },
                { x: authoringData[2].date.getTime() },
            ],
        });
        expect(createdDrawings[0]?.points?.[1]?.y ?? Number.NaN).toBeGreaterThan(104);
        expect(createdDrawings[0]?.points?.[1]?.y ?? Number.NaN).toBeLessThan(105.5);
    });
    it("creates auto-fork ellipse drawings through the widget workspace contract", async () => {
        const adapter = createAdapter(Promise.resolve([]), "auto-fork-ellipse-authoring");
        const handleDrawingWorkspaceChange = vi.fn();
        const handleDrawingsChange = vi.fn();
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
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: authoringData, engineRuntime: "auto", drawingUiEnabled: true, drawingActiveTool: "ellipse", onDrawingWorkspaceChange: handleDrawingWorkspaceChange, onDrawingsChange: handleDrawingsChange }));
            await flushMicrotasks();
        });
        expect(container.querySelector('[data-vn-kline-engine-host="true"]')).not.toBeNull();
        const workspace = await waitForTruthyValue(() => handleDrawingWorkspaceChange.mock.calls
            .map((call) => call[0])
            .find((value) => value && typeof value.setActiveTool === "function") ?? undefined);
        await act(async () => {
            workspace.setActiveTool?.("ellipse");
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
            throw new Error("Expected deterministic auto-fork ellipse authoring points");
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
            .findLast((value) => value?.length === 1 && value[0]?.type === "ellipse"));
        expect(createdDrawings[0]).toMatchObject({
            type: "ellipse",
            paneId: "price",
            yScaleId: "price-right",
            points: [
                { x: authoringData[0].date.getTime(), y: 100 },
                { x: authoringData[2].date.getTime() },
            ],
        });
        expect(createdDrawings[0]?.points?.[1]?.y ?? Number.NaN).toBeGreaterThan(104);
        expect(createdDrawings[0]?.points?.[1]?.y ?? Number.NaN).toBeLessThan(105.5);
    });
});
