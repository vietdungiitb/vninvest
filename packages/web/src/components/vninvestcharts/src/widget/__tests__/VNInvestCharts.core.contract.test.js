import { jsx as _jsx } from "react/jsx-runtime";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hitTestOverlayPrimitive } from "@vninvestcharts/vn-kline-engine-core";
import {
    createAdapter,
    createDeferred,
    flushMicrotasks,
    forkEngineSnapshots,
    forkRuntimeData,
    mergeTestPaneSnapshotDomains,
    resolveTrendLineBodyPoint,
    resolveTrendLinePointPixel,
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
let createRoot;
let VNInvestCharts;
let WidgetErrorBoundary;
let WidgetI18nProvider;

beforeAll(async () => {
    ({ act } = await import("react"));
    ({ createRoot } = await import("react-dom/client"));
    ({ createDrawingObject } = await import("../../lib/drawing/shared"));
    ({ VNInvestCharts } = await import("../VNInvestCharts"));
    ({ WidgetErrorBoundary } = await import("../WidgetErrorBoundary"));
    ({ WidgetI18nProvider } = await import("../context/WidgetI18nContext"));
}, 30_000);

describe("VNInvestCharts core", () => {
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
});
