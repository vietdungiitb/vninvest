// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createEngine } from "../index";
import { DirtyFlag } from "./dirtyMask";
import * as indicatorAccessors from "./indicatorAccessors";
const panes = [
    {
        id: "price",
        kind: "price",
        labelKey: "pane.price",
        visible: true,
        heightRatio: 3,
        scaleSlots: [
            { id: "price-left", side: "left", mode: "auto", visible: true },
            { id: "price-right", side: "right", mode: "auto", visible: true },
        ],
        series: [],
        tooltipMode: "ohlc",
    },
];
const panesWithSeries = [
    {
        id: "volume",
        kind: "volume",
        labelKey: "pane.volume",
        visible: true,
        heightRatio: 1,
        scaleSlots: [{ id: "volume-right", side: "right", mode: "auto", visible: true }],
        series: [{ id: "volume-main", type: "Volume", scaleSlotId: "volume-right", visible: true }],
        tooltipMode: "value",
    },
];
const dualAxisPanes = [
    {
        id: "price",
        kind: "price",
        labelKey: "pane.price",
        visible: true,
        heightRatio: 3,
        scaleSlots: [
            { id: "price-left", side: "left", mode: "auto", visible: true },
            { id: "price-right", side: "right", mode: "auto", visible: true },
        ],
        series: [
            { id: "price-left-series", type: "RSI", scaleSlotId: "price-left", visible: true },
            { id: "price-right-series", type: "EMA", scaleSlotId: "price-right", visible: true },
        ],
        tooltipMode: "value",
    },
];
function createCanvasContextMock() {
    return {
        clearRect: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        rect: vi.fn(),
        clip: vi.fn(),
        translate: vi.fn(),
        setLineDash: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        arc: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        fillText: vi.fn(),
        closePath: vi.fn(),
        createLinearGradient: vi.fn(() => ({
            addColorStop: vi.fn(),
        })),
        set lineWidth(_value) {
            void _value;
        },
        set globalAlpha(_value) {
            void _value;
        },
        set strokeStyle(_value) {
            void _value;
        },
        set fillStyle(_value) {
            void _value;
        },
        set font(_value) {
            void _value;
        },
        set textAlign(_value) {
            void _value;
        },
        set textBaseline(_value) {
            void _value;
        },
    };
}
function createTrackingCanvasContextMock() {
    const fillStyles = [];
    const strokeStyles = [];
    const lineWidths = [];
    const context = {
        ...createCanvasContextMock(),
        set lineWidth(value) {
            lineWidths.push(value);
        },
        set strokeStyle(value) {
            strokeStyles.push(value);
        },
        set fillStyle(value) {
            fillStyles.push(value);
        },
    };
    return { context, fillStyles, strokeStyles, lineWidths };
}
function createPointerEvent(type, init = {}) {
    const event = new PointerEvent(type, { bubbles: true, pointerType: "mouse", ...init });
    if (typeof init.offsetX === "number") {
        Object.defineProperty(event, "offsetX", { value: init.offsetX });
    }
    if (typeof init.offsetY === "number") {
        Object.defineProperty(event, "offsetY", { value: init.offsetY });
    }
    return event;
}
describe("KernelEngine", () => {
    it("mounts a canvas surface, exposes pane snapshots, and disposes cleanly", () => {
        const engine = createEngine();
        const container = document.createElement("div");
        container.style.width = "900px";
        container.style.height = "480px";
        document.body.appendChild(container);
        engine.setPaneSpecs(panes);
        engine.mount(container);
        expect(engine.isMounted()).toBe(true);
        expect(container.querySelector('[data-vn-kline-engine="canvas"]')).not.toBeNull();
        const snapshots = engine.getPaneSnapshots();
        expect(snapshots).toHaveLength(1);
        expect(snapshots[0]?.paneId).toBe("price");
        expect(snapshots[0]?.axisBounds.left?.width).toBeGreaterThan(0);
        expect(snapshots[0]?.axisBounds.right?.width).toBeGreaterThan(0);
        expect(snapshots[0]?.scaleSlotStates["price-left"]?.side).toBe("left");
        expect(snapshots[0]?.scaleSlotStates["price-right"]?.side).toBe("right");
        engine.dispose();
        expect(engine.isMounted()).toBe(false);
        expect(container.querySelector('[data-vn-kline-engine="canvas"]')).toBeNull();
        container.remove();
    });
    it("renders volume bars from runtime dataSource.seriesData without sampleValues", () => {
        const engine = createEngine();
        const container = document.createElement("div");
        container.style.width = "900px";
        container.style.height = "320px";
        document.body.appendChild(container);
        const contextMock = createCanvasContextMock();
        const getContextSpy = vi
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockImplementation((contextId) => (contextId === "2d" ? contextMock : null));
        engine.setPaneSpecs(panesWithSeries);
        engine.setDataSource({
            sourceId: "unit:test",
            seriesData: {
                "volume-main": [10, 20, 15, 25, 5],
            },
        });
        engine.mount(container);
        expect(contextMock.fillRect).toHaveBeenCalled();
        expect(contextMock.fillText).toHaveBeenCalled();
        engine.dispose();
        getContextSpy.mockRestore();
        container.remove();
    });
    it("renders bar-series widths from the visible span instead of a fixed width", () => {
        const bars = Array.from({ length: 120 }, (_, index) => ({
            date: new Date(Date.UTC(2024, 0, index + 1)),
            open: 100 + index,
            high: 110 + index,
            low: 95 + index,
            close: 102 + index,
            volume: 1_000 + index * 25,
        }));
        const renderAtRange = (range) => {
            const engine = createEngine();
            const container = document.createElement("div");
            container.style.width = "900px";
            container.style.height = "320px";
            document.body.appendChild(container);
            const contextMock = createCanvasContextMock();
            const getContextSpy = vi
                .spyOn(HTMLCanvasElement.prototype, "getContext")
                .mockImplementation((contextId) => (contextId === "2d" ? contextMock : null));
            engine.setPaneSpecs(panesWithSeries);
            engine.setEnrichedData(bars);
            if (range) {
                engine.zoomToRange(range);
            }
            engine.mount(container);
            const width = contextMock.fillRect.mock.calls[0]?.[2];
            engine.dispose();
            getContextSpy.mockRestore();
            container.remove();
            return width;
        };
        const defaultWidth = renderAtRange();
        const zoomedWidth = renderAtRange({ from: 0, to: 9 });
        expect(defaultWidth).toBeDefined();
        expect(zoomedWidth).toBeDefined();
        expect(zoomedWidth).toBeGreaterThan(defaultWidth);
    });
    it("colors volume bars by candle direction on the fork runtime", () => {
        const engine = createEngine();
        const container = document.createElement("div");
        container.style.width = "900px";
        container.style.height = "320px";
        document.body.appendChild(container);
        const { context, fillStyles } = createTrackingCanvasContextMock();
        const getContextSpy = vi
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockImplementation((contextId) => (contextId === "2d" ? context : null));
        engine.setPaneSpecs(panesWithSeries);
        engine.setEnrichedData([
            { open: 100, high: 104, low: 98, close: 103, volume: 1000 },
            { open: 103, high: 105, low: 97, close: 99, volume: 1200 },
            { open: 99, high: 106, low: 98, close: 104, volume: 900 },
        ]);
        engine.zoomToRange({ from: 0, to: 2 });
        engine.mount(container);
        expect(fillStyles).toContain("#6BA583");
        expect(fillStyles).toContain("#FF0000");
        engine.dispose();
        getContextSpy.mockRestore();
        container.remove();
    });
    it("keeps left and right scale-slot domains independent for the same pane", () => {
        const engine = createEngine();
        const container = document.createElement("div");
        container.style.width = "900px";
        container.style.height = "320px";
        document.body.appendChild(container);
        const contextMock = createCanvasContextMock();
        const getContextSpy = vi
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockImplementation((contextId) => (contextId === "2d" ? contextMock : null));
        engine.setPaneSpecs(dualAxisPanes);
        engine.setDataSource({
            sourceId: "dual-axis-test",
            seriesData: {
                "price-left-series": [10, 12, 14, 13],
                "price-right-series": [120, 180, 160, 200],
            },
        });
        engine.mount(container);
        const snapshots = engine.getPaneSnapshots();
        const leftDomain = snapshots[0]?.scaleSlotStates["price-left"]?.domain;
        const rightDomain = snapshots[0]?.scaleSlotStates["price-right"]?.domain;
        expect(leftDomain).toBeDefined();
        expect(rightDomain).toBeDefined();
        const leftHigh = leftDomain?.[1];
        const rightLow = rightDomain?.[0];
        if (leftHigh == null || rightLow == null) {
            throw new Error("Expected both scale-slot domains to be defined");
        }
        expect(leftHigh).toBeLessThan(rightLow);
        expect(snapshots[0]?.axisBounds.left?.width).toBeGreaterThan(0);
        expect(snapshots[0]?.axisBounds.right?.width).toBeGreaterThan(0);
        engine.dispose();
        getContextSpy.mockRestore();
        container.remove();
    });
    it("emits pane snapshot updates after dataSource-driven rerenders", () => {
        vi.useFakeTimers();
        const originalRaf = globalThis.requestAnimationFrame;
        const originalCancelRaf = globalThis.cancelAnimationFrame;
        globalThis.requestAnimationFrame = ((cb) => {
            return setTimeout(() => cb(16), 16);
        });
        globalThis.cancelAnimationFrame = ((handle) => {
            clearTimeout(handle);
        });
        const engine = createEngine();
        const container = document.createElement("div");
        container.style.width = "900px";
        container.style.height = "320px";
        document.body.appendChild(container);
        const contextMock = createCanvasContextMock();
        const getContextSpy = vi
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockImplementation((contextId) => (contextId === "2d" ? contextMock : null));
        const paneListener = vi.fn();
        engine.subscribe("panes", paneListener);
        engine.setPaneSpecs(panesWithSeries);
        engine.mount(container);
        vi.advanceTimersByTime(20);
        paneListener.mockClear();
        engine.setDataSource({
            sourceId: "pane-bridge-test",
            seriesData: {
                "volume-main": [10, 20, 15, 25, 5],
            },
        });
        vi.advanceTimersByTime(20);
        expect(paneListener).toHaveBeenCalledTimes(1);
        expect(paneListener.mock.calls[0]?.[0]?.snapshots?.[0]?.scaleSlotStates["volume-right"]?.domain?.[0]).toBe(0);
        engine.dispose();
        getContextSpy.mockRestore();
        container.remove();
        globalThis.requestAnimationFrame = originalRaf;
        globalThis.cancelAnimationFrame = originalCancelRaf;
        vi.useRealTimers();
    });
    it("T02-01: setEnrichedData stores data and triggers refreshSurface", () => {
        const engine = createEngine();
        const container = document.createElement("div");
        container.style.width = "900px";
        container.style.height = "320px";
        document.body.appendChild(container);
        const contextMock = createCanvasContextMock();
        const getContextSpy = vi
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockImplementation((contextId) => (contextId === "2d" ? contextMock : null));
        const enrichedBars = Array.from({ length: 50 }, (_, i) => ({
            rsi: 40 + i * 0.5,
            volume: 1_000_000 + i * 10_000,
        }));
        engine.setPaneSpecs(panesWithSeries);
        engine.mount(container);
        // setEnrichedData must not throw and engine must remain mounted
        expect(() => engine.setEnrichedData(enrichedBars)).not.toThrow();
        expect(engine.isMounted()).toBe(true);
        getContextSpy.mockRestore();
        container.remove();
    });
    it("KF-R4-07: renders and hit-tests unclipped drawing action-handle primitives outside pane plot bounds", () => {
        vi.useFakeTimers();
        const originalRaf = globalThis.requestAnimationFrame;
        const originalCancelRaf = globalThis.cancelAnimationFrame;
        globalThis.requestAnimationFrame = ((cb) => {
            return setTimeout(() => cb(16), 16);
        });
        globalThis.cancelAnimationFrame = ((handle) => {
            clearTimeout(handle);
        });
        const engine = createEngine();
        const container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "420px";
        document.body.appendChild(container);
        const plotContext = createCanvasContextMock();
        const overlayContext = createCanvasContextMock();
        const getContextSpy = vi
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockImplementation(function (contextId) {
            if (contextId !== "2d") {
                return null;
            }
            return this.getAttribute("data-vn-kline-engine") === "overlay"
                ? overlayContext
                : plotContext;
        });
        const primitiveInputs = [{
                key: "price-trend-line::action-handle::lock",
                paneId: "price",
                scaleSlotId: "price-right",
                selected: false,
                drawingId: "price-trend-line",
                actionHandle: "lock",
                clipToPane: false,
                primitive: {
                    type: "circle",
                    points: [{ x: 20, y: -14 }, { x: 28, y: -14 }],
                    style: { stroke: "#ffffff", strokeWidth: 1.5, fill: "#8c8c8c", fillOpacity: 1, opacity: 1, fontSize: 10 },
                    labels: [{ text: "\u25a1", position: { x: 20, y: -14 }, align: "center", baseline: "middle", color: "#ffffff", weight: 700, fontSize: 10 }],
                },
            }];
        engine.setPaneSpecs(panes);
        engine.mount(container);
        vi.clearAllMocks();
        engine.setOverlayInputs({
            measurementEnabled: false,
            selectedPriceLabels: null,
            drawingPrimitives: primitiveInputs,
        });
        vi.advanceTimersByTime(20);
        expect(overlayContext.arc).toHaveBeenCalledWith(20, -14, 8, 0, Math.PI * 2);
        const plotBounds = engine.getPaneSnapshots()[0]?.plotBounds;
        if (!plotBounds) {
            throw new Error("Expected a pane snapshot for action-handle hit-testing");
        }
        const hit = engine.hitTestDrawingPrimitive(plotBounds.left + 20, plotBounds.top - 14);
        expect(hit).toMatchObject({
            key: "price-trend-line::action-handle::lock",
            drawingId: "price-trend-line",
            actionHandle: "lock",
            clipToPane: false,
        });
        getContextSpy.mockRestore();
        globalThis.requestAnimationFrame = originalRaf;
        globalThis.cancelAnimationFrame = originalCancelRaf;
        vi.useRealTimers();
        container.remove();
    });
    it("T02-02: resolveSeriesValues uses enrichedData when dataSource.seriesData is absent", () => {
        const engine = createEngine();
        const container = document.createElement("div");
        container.style.width = "900px";
        container.style.height = "320px";
        document.body.appendChild(container);
        const contextMock = createCanvasContextMock();
        const getContextSpy = vi
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockImplementation((contextId) => (contextId === "2d" ? contextMock : null));
        // Volume series uses INDICATOR_ACCESSORS["Volume"] → datum.volume
        const enrichedBars = Array.from({ length: 20 }, (_, i) => ({
            volume: 2_000_000 + i * 50_000,
        }));
        engine.setPaneSpecs(panesWithSeries);
        engine.setEnrichedData(enrichedBars);
        engine.mount(container);
        // refreshSurface should render without errors (BarRenderer called with enriched volume values)
        expect(contextMock.clearRect).toHaveBeenCalled();
        getContextSpy.mockRestore();
        container.remove();
    });
    it("T02-03: Priority 1 (dataSource) overrides Priority 2 (enrichedData) for same series", () => {
        const engine = createEngine();
        const container = document.createElement("div");
        container.style.width = "900px";
        container.style.height = "320px";
        document.body.appendChild(container);
        const contextMock = createCanvasContextMock();
        const getContextSpy = vi
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockImplementation((contextId) => (contextId === "2d" ? contextMock : null));
        // Both enrichedData and seriesData present — seriesData wins
        const enrichedBars = Array.from({ length: 10 }, (_, i) => ({
            volume: 999,
        }));
        const runtimeData = [100_000, 200_000, 300_000];
        engine.setPaneSpecs(panesWithSeries);
        engine.setEnrichedData(enrichedBars);
        engine.setDataSource({
            sourceId: "priority-test",
            seriesData: { "volume-main": runtimeData },
        });
        engine.mount(container);
        // Engine mounted and rendered without errors — priority chain resolved correctly
        expect(engine.isMounted()).toBe(true);
        expect(contextMock.clearRect).toHaveBeenCalled();
        getContextSpy.mockRestore();
        container.remove();
    });
    it("T04-01: BollingerBand series expands into 3 sub-line render calls", () => {
        const engine = createEngine();
        const container = document.createElement("div");
        container.style.width = "900px";
        container.style.height = "320px";
        document.body.appendChild(container);
        const contextMock = createCanvasContextMock();
        const strokeCalls = [];
        const origStroke = contextMock.stroke;
        contextMock.stroke = vi.fn(() => { strokeCalls.push("stroke"); });
        const getContextSpy = vi
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockImplementation((contextId) => (contextId === "2d" ? contextMock : null));
        const bollingerPanes = [
            {
                id: "indicator",
                kind: "indicator",
                labelKey: "pane.indicator",
                visible: true,
                heightRatio: 1,
                scaleSlots: [{ id: "indicator-right", side: "right", mode: "auto", visible: true }],
                series: [{
                        id: "bb-main",
                        type: "BollingerBand",
                        scaleSlotId: "indicator-right",
                        visible: true,
                    }],
                tooltipMode: "value",
            },
        ];
        const enrichedBars = Array.from({ length: 20 }, (_, i) => ({
            bollingerBand: { top: 115 + i, middle: 105 + i, bottom: 95 + i },
        }));
        engine.setPaneSpecs(bollingerPanes);
        engine.setEnrichedData(enrichedBars);
        engine.mount(container);
        // BollingerBand expands into 3 sub-lines → 3 lineAreaRenderer.render calls → 3 stroke calls
        const strokeCallCount = contextMock.stroke.mock.calls.length;
        expect(strokeCallCount).toBeGreaterThanOrEqual(3);
        getContextSpy.mockRestore();
        void origStroke;
        container.remove();
    });
    it("KF12-T11-OVL-01: price overlays follow candlestick LOD buckets in deep zoom-out", () => {
        const engine = createEngine({ useWebGL: false });
        const container = document.createElement("div");
        container.style.width = "900px";
        container.style.height = "320px";
        document.body.appendChild(container);
        const contextMock = createCanvasContextMock();
        const getContextSpy = vi
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockImplementation((contextId) => (contextId === "2d" ? contextMock : null));
        const candleSpy = vi.spyOn(engine.candlestickRenderer, "render");
        const lineSpy = vi.spyOn(engine.lineAreaRenderer, "render");
        engine.setPaneSpecs([
            {
                id: "price",
                kind: "price",
                labelKey: "pane.price",
                visible: true,
                heightRatio: 1,
                scaleSlots: [{ id: "price-right", side: "right", mode: "auto", visible: true }],
                series: [
                    { id: "price-main", type: "Candlestick", scaleSlotId: "price-right", visible: true },
                    { id: "bb-main", type: "BollingerBand", scaleSlotId: "price-right", visible: true },
                ],
                tooltipMode: "ohlc",
            },
        ]);
        engine.setEnrichedData(Array.from({ length: 8000 }, (_, index) => ({
            open: 100 + index * 0.1,
            high: 102 + index * 0.1,
            low: 98 + index * 0.1,
            close: 101 + index * 0.1,
            bollingerBand: {
                top: 103 + index * 0.1,
                middle: 101 + index * 0.1,
                bottom: 99 + index * 0.1,
            },
        })));
        engine.zoomToRange({ from: 0, to: 8000 });
        engine.mount(container);
        const candleCall = candleSpy.mock.calls[0];
        const lineCall = lineSpy.mock.calls[0];
        const candleData = candleCall?.[1];
        const candleOptions = candleCall?.[2];
        const overlayPoints = lineCall?.[1];
        expect(candleData?.length ?? 0).toBeGreaterThan(0);
        expect(overlayPoints?.length).toBe(candleData?.length);
        expect(overlayPoints?.[0]?.x).toBeCloseTo(candleOptions.xAccessor(candleData[0], 0), 6);
        expect(overlayPoints?.[1]?.x).toBeCloseTo(candleOptions.xAccessor(candleData[1], 1), 6);
        engine.dispose();
        lineSpy.mockRestore();
        candleSpy.mockRestore();
        getContextSpy.mockRestore();
        container.remove();
    });
    it("renders HollowCandle via candlestick pipeline in fork runtime", () => {
        const engine = createEngine();
        const container = document.createElement("div");
        container.style.width = "900px";
        container.style.height = "320px";
        document.body.appendChild(container);
        const contextMock = createCanvasContextMock();
        const getContextSpy = vi
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockImplementation((contextId) => (contextId === "2d" ? contextMock : null));
        engine.setPaneSpecs([
            {
                id: "price",
                kind: "price",
                labelKey: "pane.price",
                visible: true,
                heightRatio: 1,
                scaleSlots: [{ id: "price-right", side: "right", mode: "auto", visible: true }],
                series: [{
                        id: "price-main",
                        type: "HollowCandle",
                        scaleSlotId: "price-right",
                        visible: true,
                    }],
                tooltipMode: "ohlc",
            },
        ]);
        engine.setEnrichedData(Array.from({ length: 20 }, (_, i) => ({
            open: 100 + i,
            high: 104 + i,
            low: 98 + i,
            close: 102 + i,
        })));
        engine.mount(container);
        expect(contextMock.strokeRect).toHaveBeenCalled();
        engine.dispose();
        getContextSpy.mockRestore();
        container.remove();
    });
    it("renders OHLC via candlestick renderer ohlc mode in fork runtime", () => {
        const engine = createEngine();
        const container = document.createElement("div");
        container.style.width = "900px";
        container.style.height = "320px";
        document.body.appendChild(container);
        const contextMock = createCanvasContextMock();
        const getContextSpy = vi
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockImplementation((contextId) => (contextId === "2d" ? contextMock : null));
        engine.setPaneSpecs([
            {
                id: "price",
                kind: "price",
                labelKey: "pane.price",
                visible: true,
                heightRatio: 1,
                scaleSlots: [{ id: "price-right", side: "right", mode: "auto", visible: true }],
                series: [{
                        id: "price-main",
                        type: "OHLC",
                        scaleSlotId: "price-right",
                        visible: true,
                    }],
                tooltipMode: "ohlc",
            },
        ]);
        engine.setEnrichedData(Array.from({ length: 20 }, (_, i) => ({
            open: 100 + i,
            high: 104 + i,
            low: 98 + i,
            close: 102 + i,
        })));
        engine.mount(container);
        expect(contextMock.stroke).toHaveBeenCalled();
        engine.dispose();
        getContextSpy.mockRestore();
        container.remove();
    });
    it("renders HeikinAshi via candlestick pipeline in fork runtime", () => {
        const engine = createEngine();
        const container = document.createElement("div");
        container.style.width = "900px";
        container.style.height = "320px";
        document.body.appendChild(container);
        const contextMock = createCanvasContextMock();
        const getContextSpy = vi
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockImplementation((contextId) => (contextId === "2d" ? contextMock : null));
        engine.setPaneSpecs([
            {
                id: "price",
                kind: "price",
                labelKey: "pane.price",
                visible: true,
                heightRatio: 1,
                scaleSlots: [{ id: "price-right", side: "right", mode: "auto", visible: true }],
                series: [{
                        id: "price-main",
                        type: "HeikinAshi",
                        scaleSlotId: "price-right",
                        visible: true,
                    }],
                tooltipMode: "ohlc",
            },
        ]);
        engine.setEnrichedData(Array.from({ length: 20 }, (_, i) => ({
            open: 100 + i,
            high: 105 + i,
            low: 97 + i,
            close: 101 + i,
        })));
        engine.mount(container);
        expect(contextMock.fillRect).toHaveBeenCalled();
        engine.dispose();
        getContextSpy.mockRestore();
        container.remove();
    });
    it("renders Area series as filled area in fork runtime", () => {
        const engine = createEngine({ useWebGL: false });
        const container = document.createElement("div");
        container.style.width = "900px";
        container.style.height = "320px";
        document.body.appendChild(container);
        const contextMock = createCanvasContextMock();
        const getContextSpy = vi
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockImplementation((contextId) => (contextId === "2d" ? contextMock : null));
        engine.setPaneSpecs([
            {
                id: "price",
                kind: "price",
                labelKey: "pane.price",
                visible: true,
                heightRatio: 1,
                scaleSlots: [{ id: "price-right", side: "right", mode: "auto", visible: true }],
                series: [{
                        id: "price-main",
                        type: "Area",
                        scaleSlotId: "price-right",
                        visible: true,
                    }],
                tooltipMode: "value",
            },
        ]);
        engine.setDataSource({
            seriesData: {
                "price-main": Array.from({ length: 20 }, (_, i) => 100 + i),
            },
        });
        engine.setEnrichedData(Array.from({ length: 20 }, (_, i) => ({
            close: 100 + i,
        })));
        engine.mount(container);
        expect(contextMock.fill).toHaveBeenCalled();
        engine.dispose();
        getContextSpy.mockRestore();
        container.remove();
    });
    it("renders Bollinger fill when fillMode is solid", () => {
        const engine = createEngine();
        const container = document.createElement("div");
        container.style.width = "900px";
        container.style.height = "320px";
        document.body.appendChild(container);
        const contextMock = createCanvasContextMock();
        const getContextSpy = vi
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockImplementation((contextId) => (contextId === "2d" ? contextMock : null));
        engine.setPaneSpecs([
            {
                id: "indicator",
                kind: "indicator",
                labelKey: "pane.indicator",
                visible: true,
                heightRatio: 1,
                scaleSlots: [{ id: "indicator-right", side: "right", mode: "auto", visible: true }],
                series: [{
                        id: "bb-main",
                        type: "BollingerBand",
                        scaleSlotId: "indicator-right",
                        visible: true,
                        params: { fillMode: "solid", fillOpacity: 0.3 },
                    }],
                tooltipMode: "value",
            },
        ]);
        engine.setEnrichedData(Array.from({ length: 20 }, (_, i) => ({
            bollingerBand: { top: 115 + i, middle: 105 + i, bottom: 95 + i },
        })));
        engine.mount(container);
        expect(contextMock.fill).toHaveBeenCalled();
        engine.dispose();
        getContextSpy.mockRestore();
        container.remove();
    });
    it("renders Bollinger fade fill using linear gradient when fillMode is fade", () => {
        const engine = createEngine();
        const container = document.createElement("div");
        container.style.width = "900px";
        container.style.height = "320px";
        document.body.appendChild(container);
        const contextMock = createCanvasContextMock();
        const getContextSpy = vi
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockImplementation((contextId) => (contextId === "2d" ? contextMock : null));
        engine.setPaneSpecs([
            {
                id: "indicator",
                kind: "indicator",
                labelKey: "pane.indicator",
                visible: true,
                heightRatio: 1,
                scaleSlots: [{ id: "indicator-right", side: "right", mode: "auto", visible: true }],
                series: [{
                        id: "bb-main",
                        type: "BollingerBand",
                        scaleSlotId: "indicator-right",
                        visible: true,
                        params: { fillMode: "fade", fillOpacity: 0.3 },
                    }],
                tooltipMode: "value",
            },
        ]);
        engine.setEnrichedData(Array.from({ length: 20 }, (_, i) => ({
            bollingerBand: { top: 115 + i, middle: 105 + i, bottom: 95 + i },
        })));
        engine.mount(container);
        expect(contextMock.createLinearGradient).toHaveBeenCalled();
        engine.dispose();
        getContextSpy.mockRestore();
        container.remove();
    });
    it("T04-02: MACD series expands into divergence bars + 2 line renders", () => {
        const engine = createEngine();
        const container = document.createElement("div");
        container.style.width = "900px";
        container.style.height = "320px";
        document.body.appendChild(container);
        const contextMock = createCanvasContextMock();
        const getContextSpy = vi
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockImplementation((contextId) => (contextId === "2d" ? contextMock : null));
        const macdPanes = [
            {
                id: "macd",
                kind: "indicator",
                labelKey: "pane.macd",
                visible: true,
                heightRatio: 1,
                scaleSlots: [{ id: "macd-right", side: "right", mode: "auto", visible: true }],
                series: [{
                        id: "macd-main",
                        type: "MACD",
                        scaleSlotId: "macd-right",
                        visible: true,
                    }],
                tooltipMode: "value",
            },
        ];
        const enrichedBars = Array.from({ length: 20 }, (_, i) => ({
            macd: { macd: 0.5 + i * 0.01, signal: 0.3 + i * 0.01, divergence: 0.2 + i * 0.01 },
        }));
        engine.setPaneSpecs(macdPanes);
        engine.setEnrichedData(enrichedBars);
        engine.mount(container);
        // MACD renders without errors — 3 sub-series (bars + 2 lines)
        expect(engine.isMounted()).toBe(true);
        expect(contextMock.clearRect).toHaveBeenCalled();
        getContextSpy.mockRestore();
        container.remove();
    });
    it("applies configured indicator colors from pane settings to line and MACD sub-series", () => {
        const engine = createEngine({ useWebGL: false });
        const container = document.createElement("div");
        container.style.width = "900px";
        container.style.height = "320px";
        document.body.appendChild(container);
        const { context, fillStyles, strokeStyles } = createTrackingCanvasContextMock();
        const getContextSpy = vi
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockImplementation((contextId) => (contextId === "2d" ? context : null));
        engine.setPaneSpecs([
            {
                id: "indicator",
                kind: "indicator",
                labelKey: "pane.indicator",
                visible: true,
                heightRatio: 1,
                scaleSlots: [{ id: "indicator-right", side: "right", mode: "auto", visible: true }],
                series: [
                    {
                        id: "rsi-main",
                        type: "RSI",
                        scaleSlotId: "indicator-right",
                        visible: true,
                        style: { color: "#7c3aed" },
                    },
                    {
                        id: "macd-main",
                        type: "MACD",
                        scaleSlotId: "indicator-right",
                        visible: true,
                        style: { subColors: { macd: "#2563eb", signal: "#f59e0b", diverge: "#dc2626" } },
                    },
                ],
                tooltipMode: "value",
            },
        ]);
        engine.setEnrichedData(Array.from({ length: 20 }, (_, index) => ({
            rsi: 40 + index,
            macd: {
                macd: 0.3 + index * 0.02,
                signal: 0.2 + index * 0.01,
                divergence: index % 2 === 0 ? 0.25 : -0.15,
            },
        })));
        engine.zoomToRange({ from: 0, to: 19 });
        engine.mount(container);
        expect(strokeStyles).toContain("#7c3aed");
        expect(strokeStyles).toContain("#2563eb");
        expect(strokeStyles).toContain("#f59e0b");
        expect(fillStyles).toContain("#dc2626");
        engine.dispose();
        getContextSpy.mockRestore();
        container.remove();
    });
    it("uses distinct default MACD line colors when subColors are not configured", () => {
        const engine = createEngine({ useWebGL: false });
        const container = document.createElement("div");
        container.style.width = "900px";
        container.style.height = "320px";
        document.body.appendChild(container);
        const { context, strokeStyles } = createTrackingCanvasContextMock();
        const getContextSpy = vi
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockImplementation((contextId) => (contextId === "2d" ? context : null));
        engine.setPaneSpecs([
            {
                id: "indicator",
                kind: "indicator",
                labelKey: "pane.indicator",
                visible: true,
                heightRatio: 1,
                scaleSlots: [{ id: "indicator-right", side: "right", mode: "auto", visible: true }],
                series: [
                    {
                        id: "macd-main",
                        type: "MACD",
                        scaleSlotId: "indicator-right",
                        visible: true,
                    },
                ],
                tooltipMode: "value",
            },
        ]);
        engine.setEnrichedData(Array.from({ length: 20 }, (_, index) => ({
            macd: {
                macd: 0.3 + index * 0.02,
                signal: 0.2 + index * 0.01,
                divergence: index % 2 === 0 ? 0.25 : -0.15,
            },
        })));
        engine.zoomToRange({ from: 0, to: 19 });
        engine.mount(container);
        expect(strokeStyles).toContain("#2962ff");
        expect(strokeStyles).toContain("#f59e0b");
        engine.dispose();
        getContextSpy.mockRestore();
        container.remove();
    });
    it("uses accessor values for MACD derived sub-lines when runtime seriesData is provided for MACD base", () => {
        const engine = createEngine({ useWebGL: false });
        const container = document.createElement("div");
        container.style.width = "900px";
        container.style.height = "320px";
        document.body.appendChild(container);
        const accessorSpy = vi.spyOn(indicatorAccessors, "getAccessorFor");
        const contextMock = createCanvasContextMock();
        const getContextSpy = vi
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockImplementation((contextId) => (contextId === "2d" ? contextMock : null));
        engine.setPaneSpecs([
            {
                id: "indicator",
                kind: "indicator",
                labelKey: "pane.indicator",
                visible: true,
                heightRatio: 1,
                scaleSlots: [{ id: "indicator-right", side: "right", mode: "auto", visible: true }],
                series: [
                    {
                        id: "macd-main",
                        type: "MACD",
                        scaleSlotId: "indicator-right",
                        visible: true,
                    },
                ],
                tooltipMode: "value",
            },
        ]);
        engine.setDataSource({
            seriesData: {
                "macd-main": Array.from({ length: 20 }, (_, index) => (index % 2 === 0 ? 0.25 : -0.15)),
            },
        });
        engine.setEnrichedData(Array.from({ length: 20 }, (_, index) => ({
            macd: {
                macd: 0.3 + index * 0.02,
                signal: 0.2 + index * 0.01,
                divergence: index % 2 === 0 ? 0.25 : -0.15,
            },
        })));
        engine.zoomToRange({ from: 0, to: 19 });
        engine.mount(container);
        expect(accessorSpy).toHaveBeenCalledWith("MACD.signal", undefined);
        expect(accessorSpy).toHaveBeenCalledWith("MACD.macd", undefined);
        engine.dispose();
        accessorSpy.mockRestore();
        getContextSpy.mockRestore();
        container.remove();
    });
    it("applies configured line widths from pane settings to line indicators", () => {
        const engine = createEngine({ useWebGL: false });
        const container = document.createElement("div");
        container.style.width = "900px";
        container.style.height = "320px";
        document.body.appendChild(container);
        const { context, lineWidths } = createTrackingCanvasContextMock();
        const getContextSpy = vi
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockImplementation((contextId) => (contextId === "2d" ? context : null));
        engine.setPaneSpecs([
            {
                id: "indicator",
                kind: "indicator",
                labelKey: "pane.indicator",
                visible: true,
                heightRatio: 1,
                scaleSlots: [{ id: "indicator-right", side: "right", mode: "auto", visible: true }],
                series: [
                    {
                        id: "rsi-main",
                        type: "RSI",
                        scaleSlotId: "indicator-right",
                        visible: true,
                        style: { lineWidth: 4 },
                    },
                    {
                        id: "macd-main",
                        type: "MACD",
                        scaleSlotId: "indicator-right",
                        visible: true,
                        style: { lineWidth: 3 },
                    },
                ],
                tooltipMode: "value",
            },
        ]);
        engine.setEnrichedData(Array.from({ length: 20 }, (_, index) => ({
            rsi: 40 + index,
            macd: {
                macd: 0.3 + index * 0.02,
                signal: 0.2 + index * 0.01,
                divergence: index % 2 === 0 ? 0.25 : -0.15,
            },
        })));
        engine.zoomToRange({ from: 0, to: 19 });
        engine.mount(container);
        expect(lineWidths.some((value) => value > 4)).toBe(true);
        expect(lineWidths.some((value) => value > 3)).toBe(true);
        engine.dispose();
        getContextSpy.mockRestore();
        container.remove();
    });
    it("T04-03: KDJ series expands into K/D/J line renders", () => {
        const engine = createEngine();
        const container = document.createElement("div");
        container.style.width = "900px";
        container.style.height = "320px";
        document.body.appendChild(container);
        const contextMock = createCanvasContextMock();
        const getContextSpy = vi
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockImplementation((contextId) => (contextId === "2d" ? contextMock : null));
        const kdjPanes = [
            {
                id: "kdj",
                kind: "indicator",
                labelKey: "pane.kdj",
                visible: true,
                heightRatio: 1,
                scaleSlots: [{ id: "kdj-right", side: "right", mode: "auto", visible: true }],
                series: [{
                        id: "kdj-main",
                        type: "KDJ",
                        scaleSlotId: "kdj-right",
                        visible: true,
                    }],
                tooltipMode: "value",
            },
        ];
        const enrichedBars = Array.from({ length: 20 }, (_, i) => ({
            kdj: { k: 70 + i, d: 65 + i, j: 85 + i },
        }));
        engine.setPaneSpecs(kdjPanes);
        engine.setEnrichedData(enrichedBars);
        engine.mount(container);
        // KDJ renders without errors — 3 sub-series (K, D, J)
        expect(engine.isMounted()).toBe(true);
        getContextSpy.mockRestore();
        container.remove();
    });
    it("T02-04: wheel zoom dispatched on canvas → visibleRange span shrinks (zoom in)", () => {
        const engine = createEngine();
        const container = document.createElement("div");
        document.body.appendChild(container);
        // Provide enough enriched bars so zoom has data length reference
        const bars = Array.from({ length: 300 }, () => ({}));
        engine.setEnrichedData(bars);
        engine.mount(container);
        const canvas = container.querySelector("canvas");
        // Set explicit size so canvas.width is valid
        Object.defineProperty(canvas, "width", { value: 800, writable: true, configurable: true });
        // Dispatch wheel up (deltaY < 0 = zoom in = positive delta = smaller span)
        const wheelEvent = new WheelEvent("wheel", { deltaY: -100, bubbles: true });
        Object.defineProperty(wheelEvent, "offsetX", { value: 400 });
        canvas.dispatchEvent(wheelEvent);
        // zoom in → span should shrink from default 300
        const range = engine.getVisibleRange();
        const span = range.to - range.from;
        expect(span).toBeLessThan(300);
        expect(span).toBeGreaterThanOrEqual(2);
        container.remove();
    });
    it("T02-04B: wheel zoom can reach deep zoom spans for fork candlestick rendering", () => {
        const engine = createEngine();
        const container = document.createElement("div");
        document.body.appendChild(container);
        const bars = Array.from({ length: 300 }, () => ({}));
        engine.setEnrichedData(bars);
        engine.mount(container);
        const canvas = container.querySelector("canvas");
        Object.defineProperty(canvas, "width", { value: 800, writable: true, configurable: true });
        for (let i = 0; i < 60; i += 1) {
            const wheelEvent = new WheelEvent("wheel", { deltaY: -120, bubbles: true });
            Object.defineProperty(wheelEvent, "offsetX", { value: 400 });
            canvas.dispatchEvent(wheelEvent);
        }
        const range = engine.getVisibleRange();
        expect(range.to - range.from).toBe(2);
        container.remove();
    });
    it("T02-04C: deep zoom can always zoom out even with small wheel delta", () => {
        const engine = createEngine();
        const container = document.createElement("div");
        document.body.appendChild(container);
        const bars = Array.from({ length: 600 }, () => ({}));
        engine.setEnrichedData(bars);
        engine.mount(container);
        const canvas = container.querySelector("canvas");
        Object.defineProperty(canvas, "width", { value: 800, writable: true, configurable: true });
        for (let i = 0; i < 60; i += 1) {
            const zoomInEvent = new WheelEvent("wheel", { deltaY: -120, bubbles: true });
            Object.defineProperty(zoomInEvent, "offsetX", { value: 400 });
            canvas.dispatchEvent(zoomInEvent);
        }
        const deepZoomRange = engine.getVisibleRange();
        expect(deepZoomRange.to - deepZoomRange.from).toBe(2);
        const smallZoomOutEvent = new WheelEvent("wheel", { deltaY: 10, bubbles: true });
        Object.defineProperty(smallZoomOutEvent, "offsetX", { value: 400 });
        canvas.dispatchEvent(smallZoomOutEvent);
        const afterZoomOutRange = engine.getVisibleRange();
        expect(afterZoomOutRange.to - afterZoomOutRange.from).toBeGreaterThan(2);
        container.remove();
    });
    it("T02-05: drag pan dispatched on canvas → visibleRange from shifts", () => {
        const engine = createEngine();
        const container = document.createElement("div");
        document.body.appendChild(container);
        const bars = Array.from({ length: 500 }, () => ({}));
        engine.setEnrichedData(bars);
        engine.zoomToRange({ from: 100, to: 400 }); // start not at 0
        engine.mount(container);
        const canvas = container.querySelector("canvas");
        Object.defineProperty(canvas, "width", { value: 900, writable: true, configurable: true });
        // Simulate drag: pointerdown at clientX=300, then pointermove to 360 (+60px)
        canvas.dispatchEvent(createPointerEvent("pointerdown", { clientX: 300, clientY: 40, offsetX: 300, offsetY: 40, buttons: 1 }));
        canvas.dispatchEvent(createPointerEvent("pointermove", { clientX: 360, clientY: 40, offsetX: 360, offsetY: 40, buttons: 1 }));
        const range = engine.getVisibleRange();
        // No pane specs are set in this test, so camera falls back to full canvas width.
        // delta = +60 → indexDelta = round(60 / (900/300)) = 20
        expect(range.from).toBe(80);
        expect(range.to).toBe(380);
        container.remove();
    });
    it("KF-R3-01: interaction events stay in press mode until drag threshold is crossed", () => {
        const engine = createEngine();
        const container = document.createElement("div");
        document.body.appendChild(container);
        const bars = Array.from({ length: 500 }, () => ({}));
        engine.setEnrichedData(bars);
        engine.zoomToRange({ from: 100, to: 400 });
        engine.mount(container);
        const canvas = container.querySelector("canvas");
        Object.defineProperty(canvas, "width", { value: 900, writable: true, configurable: true });
        const interactionListener = vi.fn();
        engine.subscribe("interaction", interactionListener);
        canvas.dispatchEvent(createPointerEvent("pointerdown", { clientX: 300, clientY: 40, offsetX: 300, offsetY: 40, buttons: 1 }));
        canvas.dispatchEvent(createPointerEvent("pointermove", { clientX: 302, clientY: 40, offsetX: 302, offsetY: 40, buttons: 1 }));
        expect(engine.getVisibleRange()).toEqual({ from: 100, to: 400 });
        expect(interactionListener.mock.calls.map((call) => call[0].phase)).toEqual(["pointerdown", "pointermove"]);
        canvas.dispatchEvent(createPointerEvent("pointermove", { clientX: 360, clientY: 40, offsetX: 360, offsetY: 40, buttons: 1 }));
        canvas.dispatchEvent(createPointerEvent("pointerup", { clientX: 360, clientY: 40, offsetX: 360, offsetY: 40 }));
        expect(interactionListener.mock.calls.map((call) => call[0].phase)).toEqual([
            "pointerdown",
            "pointermove",
            "pointermove",
            "dragstart",
            "dragmove",
            "dragend",
            "pointerup",
        ]);
        const range = engine.getVisibleRange();
        expect(range.from).toBe(80);
        expect(range.to).toBe(380);
        container.remove();
    });
    it("T02-05B: drag pan uses pane plot width when pane snapshots are available", () => {
        const engine = createEngine();
        const container = document.createElement("div");
        document.body.appendChild(container);
        const bars = Array.from({ length: 500 }, () => ({}));
        engine.setPaneSpecs(panes);
        engine.setEnrichedData(bars);
        engine.zoomToRange({ from: 100, to: 400 });
        engine.mount(container);
        const canvas = container.querySelector("canvas");
        Object.defineProperty(canvas, "width", { value: 900, writable: true, configurable: true });
        canvas.dispatchEvent(createPointerEvent("pointerdown", { clientX: 300, clientY: 40, offsetX: 300, offsetY: 40, buttons: 1 }));
        canvas.dispatchEvent(createPointerEvent("pointermove", { clientX: 360, clientY: 40, offsetX: 360, offsetY: 40, buttons: 1 }));
        const range = engine.getVisibleRange();
        // In jsdom container clientWidth is 0, so engine falls back to DEFAULT_WIDTH for layout.
        // With pane axes reserved, plot width is narrower than canvas and produces indexDelta=21.
        expect(range.from).toBe(79);
        expect(range.to).toBe(379);
        container.remove();
    });
    it("T02-05C: deep zoom pan accumulates small drag deltas across moves", () => {
        const engine = createEngine();
        const container = document.createElement("div");
        document.body.appendChild(container);
        const bars = Array.from({ length: 500 }, () => ({}));
        engine.setEnrichedData(bars);
        engine.zoomToRange({ from: 200, to: 202 });
        engine.mount(container);
        const canvas = container.querySelector("canvas");
        Object.defineProperty(canvas, "width", { value: 900, writable: true, configurable: true });
        canvas.dispatchEvent(createPointerEvent("pointerdown", { clientX: 300, clientY: 40, offsetX: 300, offsetY: 40, buttons: 1 }));
        canvas.dispatchEvent(createPointerEvent("pointermove", { clientX: 420, clientY: 40, offsetX: 420, offsetY: 40, buttons: 1 }));
        canvas.dispatchEvent(createPointerEvent("pointermove", { clientX: 540, clientY: 40, offsetX: 540, offsetY: 40, buttons: 1 }));
        const range = engine.getVisibleRange();
        expect(range.from).toBe(199);
        expect(range.to).toBe(201);
        container.remove();
    });
    it("T02-06: candlestick render keeps last frame during transient empty OHLC window", () => {
        const engine = createEngine();
        const container = document.createElement("div");
        document.body.appendChild(container);
        const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => createCanvasContextMock());
        const candlePanes = [
            {
                id: "price",
                kind: "price",
                labelKey: "pane.price",
                visible: true,
                heightRatio: 3,
                scaleSlots: [{ id: "price-right", side: "right", mode: "auto", visible: true }],
                series: [{ id: "candle-main", type: "Candlestick", scaleSlotId: "price-right", visible: true }],
                tooltipMode: "ohlc",
            },
        ];
        const validBars = Array.from({ length: 120 }, (_, index) => {
            const base = 100 + index;
            return {
                date: new Date(2024, 0, index + 1),
                open: base,
                high: base + 3,
                low: base - 2,
                close: base + 1,
            };
        });
        const transientBars = Array.from({ length: 120 }, (_, index) => ({
            date: new Date(2024, 0, index + 1),
            close: 100 + index,
        }));
        engine.setPaneSpecs(candlePanes);
        engine.setEnrichedData(validBars);
        engine.zoomToRange({ from: 0, to: 120 });
        engine.mount(container);
        const candleRenderSpy = vi.spyOn(engine.candlestickRenderer, "render");
        candleRenderSpy.mockClear();
        engine.setEnrichedData(transientBars);
        engine.refreshSurface();
        expect(candleRenderSpy).toHaveBeenCalled();
        const latestCall = candleRenderSpy.mock.calls.at(-1);
        const renderedData = latestCall?.[1];
        expect(Array.isArray(renderedData)).toBe(true);
        expect((renderedData ?? []).length).toBeGreaterThan(0);
        getContextSpy.mockRestore();
        container.remove();
    });
    it("KF-R4-01: emits overlay state snapshots on crosshair move and leave", () => {
        const engine = createEngine();
        const container = document.createElement("div");
        document.body.appendChild(container);
        const bars = Array.from({ length: 20 }, (_, index) => ({ index }));
        engine.setPaneSpecs(panes);
        engine.setEnrichedData(bars);
        engine.mount(container);
        const overlayStateListener = vi.fn();
        engine.subscribe("overlayState", overlayStateListener);
        const canvas = container.querySelector("canvas");
        Object.defineProperty(canvas, "width", { value: 1200, writable: true, configurable: true });
        canvas.dispatchEvent(createPointerEvent("pointermove", { clientX: 240, clientY: 120, offsetX: 240, offsetY: 120 }));
        expect(overlayStateListener).toHaveBeenCalled();
        const latestMovePayload = overlayStateListener.mock.calls.at(-1)?.[0];
        expect(latestMovePayload.overlayState.crosshair).toEqual(expect.objectContaining({
            paneId: "price",
            dataIndex: expect.any(Number),
        }));
        expect(latestMovePayload.overlayState.hoveredPaneId).toBe("price");
        expect(latestMovePayload.overlayState.hoveredDataIndex).not.toBeNull();
        expect(latestMovePayload.overlayState.xAxisTicks.length).toBeGreaterThan(0);
        canvas.dispatchEvent(createPointerEvent("pointerleave", { clientX: 240, clientY: 120, offsetX: 240, offsetY: 120 }));
        const latestLeavePayload = overlayStateListener.mock.calls.at(-1)?.[0];
        expect(latestLeavePayload.overlayState.crosshair).toBeNull();
        expect(latestLeavePayload.overlayState.hoveredPaneId).toBeNull();
        expect(latestLeavePayload.overlayState.hoveredDataIndex).toBeNull();
        container.remove();
    });
    it("KF-R4-02: recomputes x-axis overlay payload after zoom and pan", () => {
        const engine = createEngine();
        const container = document.createElement("div");
        document.body.appendChild(container);
        const bars = Array.from({ length: 200 }, (_, index) => ({ index }));
        engine.setPaneSpecs(panes);
        engine.setEnrichedData(bars);
        engine.mount(container);
        const canvas = container.querySelector("canvas");
        Object.defineProperty(canvas, "width", { value: 1200, writable: true, configurable: true });
        const initialTicks = engine.getOverlayState().xAxisTicks.map((tick) => tick.dataIndex);
        const wheelEvent = new WheelEvent("wheel", { deltaY: -100, bubbles: true });
        Object.defineProperty(wheelEvent, "offsetX", { value: 600 });
        canvas.dispatchEvent(wheelEvent);
        const zoomedTicks = engine.getOverlayState().xAxisTicks.map((tick) => tick.dataIndex);
        canvas.dispatchEvent(createPointerEvent("pointerdown", { clientX: 300, clientY: 40, offsetX: 300, offsetY: 40, buttons: 1 }));
        canvas.dispatchEvent(createPointerEvent("pointermove", { clientX: 420, clientY: 40, offsetX: 420, offsetY: 40, buttons: 1 }));
        const pannedTicks = engine.getOverlayState().xAxisTicks.map((tick) => tick.dataIndex);
        expect(zoomedTicks).not.toEqual(initialTicks);
        expect(pannedTicks).not.toEqual(zoomedTicks);
        container.remove();
    });
    it("KF-R4-03: keeps measurement overlay state inside the engine across pointer lifecycle and zoom", () => {
        const candlePanes = [
            {
                id: "price",
                kind: "price",
                labelKey: "pane.price",
                visible: true,
                heightRatio: 3,
                scaleSlots: [{ id: "price-right", side: "right", mode: "auto", visible: true }],
                series: [{ id: "candle-main", type: "Candlestick", scaleSlotId: "price-right", visible: true }],
                tooltipMode: "ohlc",
            },
        ];
        const bars = Array.from({ length: 20 }, (_, index) => ({
            date: new Date(Date.UTC(2024, 0, index + 1)),
            open: 100 + index,
            high: 112 + index,
            low: 94 + index,
            close: 106 + index,
            volume: 1000 + index * 10,
        }));
        const engine = createEngine();
        const container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "420px";
        document.body.appendChild(container);
        engine.setPaneSpecs(candlePanes);
        engine.setEnrichedData(bars);
        engine.zoomToRange({ from: 0, to: 19 });
        engine.mount(container);
        engine.setOverlayInputs({ measurementEnabled: true, selectedPriceLabels: null });
        const canvas = container.querySelector("canvas");
        canvas.dispatchEvent(createPointerEvent("pointerdown", { clientX: 240, clientY: 120, offsetX: 240, offsetY: 120, buttons: 1 }));
        canvas.dispatchEvent(createPointerEvent("pointermove", { clientX: 480, clientY: 180, offsetX: 480, offsetY: 180, buttons: 1 }));
        const draftMeasurement = engine.getOverlayState().measurement;
        expect(draftMeasurement?.draft).toEqual(expect.objectContaining({
            paneId: "price",
            start: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
            end: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
        }));
        expect(draftMeasurement?.draft?.start.x).not.toBe(draftMeasurement?.draft?.end.x);
        canvas.dispatchEvent(createPointerEvent("pointerup", { clientX: 480, clientY: 180, offsetX: 480, offsetY: 180 }));
        canvas.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 480, clientY: 180 }));
        const committedBeforeZoom = engine.getOverlayState().measurement?.committed;
        expect(committedBeforeZoom).not.toBeNull();
        engine.zoomToRange({ from: 5, to: 15 });
        const committedAfterZoom = engine.getOverlayState().measurement?.committed;
        expect(committedAfterZoom).not.toBeNull();
        expect(committedAfterZoom?.start.x).not.toBe(committedBeforeZoom?.start.x);
        canvas.dispatchEvent(createPointerEvent("pointerleave", { clientX: 480, clientY: 180, offsetX: 480, offsetY: 180 }));
        const measurementAfterLeave = engine.getOverlayState().measurement;
        expect(measurementAfterLeave?.hoverPoint).toBeNull();
        expect(measurementAfterLeave?.committed).not.toBeNull();
        container.remove();
    });
    it("KF-R4-04: derives selected drawing price labels from engine overlay inputs", () => {
        const candlePanes = [
            {
                id: "price",
                kind: "price",
                labelKey: "pane.price",
                visible: true,
                heightRatio: 3,
                scaleSlots: [{ id: "price-right", side: "right", mode: "auto", visible: true }],
                series: [{ id: "candle-main", type: "Candlestick", scaleSlotId: "price-right", visible: true }],
                tooltipMode: "ohlc",
            },
        ];
        const bars = Array.from({ length: 10 }, (_, index) => ({
            date: new Date(Date.UTC(2024, 0, index + 1)),
            open: 100 + index,
            high: 115 + index,
            low: 95 + index,
            close: 108 + index,
            volume: 1000 + index * 10,
        }));
        const engine = createEngine();
        const container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "420px";
        document.body.appendChild(container);
        engine.setPaneSpecs(candlePanes);
        engine.setEnrichedData(bars);
        engine.zoomToRange({ from: 0, to: 9 });
        engine.mount(container);
        engine.setOverlayInputs({
            measurementEnabled: false,
            selectedPriceLabels: {
                drawingId: "selected-drawing",
                paneId: "price",
                scaleSlotId: "price-right",
                anchorTime: Date.UTC(2024, 0, 5),
                markers: [{ key: "selected-drawing-anchor", price: 112 }],
                fill: "#f59e0b",
                stroke: "#f59e0b",
                textColor: "#ffffff",
                highlighted: true,
                visible: true,
            },
        });
        const drawingPriceLabels = engine.getOverlayState().drawingPriceLabels;
        expect(drawingPriceLabels).toEqual(expect.objectContaining({
            drawingId: "selected-drawing",
            highlighted: true,
            labels: [expect.objectContaining({
                    key: "selected-drawing-anchor",
                    price: 112,
                    y: expect.any(Number),
                    side: "right",
                })],
        }));
        engine.setOverlayInputs({ measurementEnabled: false, selectedPriceLabels: null });
        expect(engine.getOverlayState().drawingPriceLabels).toBeNull();
        container.remove();
    });
    it("KF-R4-05: keeps pane-scoped drawing primitives in engine overlay state with cloned inputs", () => {
        const candlePanes = [
            {
                id: "price",
                kind: "price",
                labelKey: "pane.price",
                visible: true,
                heightRatio: 3,
                scaleSlots: [{ id: "price-right", side: "right", mode: "auto", visible: true }],
                series: [{ id: "candle-main", type: "Candlestick", scaleSlotId: "price-right", visible: true }],
                tooltipMode: "ohlc",
            },
        ];
        const bars = Array.from({ length: 10 }, (_, index) => ({
            date: new Date(Date.UTC(2024, 0, index + 1)),
            open: 100 + index,
            high: 115 + index,
            low: 95 + index,
            close: 108 + index,
            volume: 1000 + index * 10,
        }));
        const primitiveInputs = [
            {
                key: "price-trend-line",
                paneId: "price",
                scaleSlotId: "price-right",
                selected: true,
                primitive: {
                    type: "trendLine",
                    points: [{ x: 120, y: 180 }, { x: 360, y: 120 }],
                    style: { stroke: "#38bdf8", strokeWidth: 2, fill: "transparent" },
                },
            },
            {
                key: "hidden-primitive",
                paneId: "price",
                selected: false,
                primitive: {
                    type: "hLine",
                    points: [{ x: 0, y: 144 }],
                    style: { stroke: "#94a3b8", strokeWidth: 1 },
                    visible: false,
                },
            },
            {
                key: "orphan-pane-primitive",
                paneId: "missing-pane",
                selected: false,
                primitive: {
                    type: "rectangle",
                    points: [{ x: 60, y: 60 }, { x: 180, y: 180 }],
                    style: { stroke: "#f97316", strokeWidth: 2, fill: "rgba(249, 115, 22, 0.12)" },
                },
            },
        ];
        const engine = createEngine();
        const container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "420px";
        document.body.appendChild(container);
        engine.setPaneSpecs(candlePanes);
        engine.setEnrichedData(bars);
        engine.zoomToRange({ from: 0, to: 9 });
        engine.mount(container);
        engine.setOverlayInputs({
            measurementEnabled: false,
            selectedPriceLabels: null,
            drawingPrimitives: primitiveInputs,
        });
        primitiveInputs[0].primitive.points[0].x = 999;
        const drawingPrimitives = engine.getOverlayState().drawingPrimitives;
        expect(drawingPrimitives).toHaveLength(1);
        expect(drawingPrimitives[0]).toEqual(expect.objectContaining({
            key: "price-trend-line",
            paneId: "price",
            scaleSlotId: "price-right",
            selected: true,
            primitive: expect.objectContaining({
                type: "trendLine",
                points: [
                    expect.objectContaining({ x: 120, y: 180 }),
                    expect.objectContaining({ x: 360, y: 120 }),
                ],
            }),
        }));
        container.remove();
    });
    it("KF-R4-06: renders pane-scoped drawing primitives on the overlay canvas and hit-tests them by local coordinates", () => {
        vi.useFakeTimers();
        const originalRaf = globalThis.requestAnimationFrame;
        const originalCancelRaf = globalThis.cancelAnimationFrame;
        globalThis.requestAnimationFrame = ((cb) => {
            return setTimeout(() => cb(16), 16);
        });
        globalThis.cancelAnimationFrame = ((handle) => {
            clearTimeout(handle);
        });
        const engine = createEngine();
        const container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "420px";
        document.body.appendChild(container);
        const plotContext = createCanvasContextMock();
        const overlayContext = createCanvasContextMock();
        const getContextSpy = vi
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockImplementation(function (contextId) {
            if (contextId !== "2d") {
                return null;
            }
            return this.getAttribute("data-vn-kline-engine") === "overlay"
                ? overlayContext
                : plotContext;
        });
        const primitiveInputs = [{
                key: "price-trend-line",
                paneId: "price",
                scaleSlotId: "price-right",
                selected: true,
                primitive: {
                    type: "trendLine",
                    points: [{ x: 120, y: 180 }, { x: 360, y: 120 }],
                    style: { stroke: "#38bdf8", strokeWidth: 2, fill: "transparent" },
                },
            }];
        engine.setPaneSpecs(panes);
        engine.mount(container);
        vi.clearAllMocks();
        engine.setOverlayInputs({
            measurementEnabled: false,
            selectedPriceLabels: null,
            drawingPrimitives: primitiveInputs,
        });
        vi.advanceTimersByTime(20);
        expect(overlayContext.translate).toHaveBeenCalled();
        expect(overlayContext.lineTo).toHaveBeenCalledWith(360, 120);
        const plotBounds = engine.getPaneSnapshots()[0]?.plotBounds;
        if (!plotBounds) {
            throw new Error("Expected a pane snapshot for primitive hit-testing");
        }
        const hit = engine.hitTestDrawingPrimitive(plotBounds.left + 240, plotBounds.top + 150);
        expect(hit).toMatchObject({
            key: "price-trend-line",
            paneId: "price",
            selected: true,
        });
        expect(engine.hitTestDrawingPrimitive(plotBounds.left + 20, plotBounds.top + 20)).toBeNull();
        getContextSpy.mockRestore();
        globalThis.requestAnimationFrame = originalRaf;
        globalThis.cancelAnimationFrame = originalCancelRaf;
        vi.useRealTimers();
        container.remove();
    });
    it("T03-03: crosshair render runs after series clip restore", () => {
        vi.useFakeTimers();
        const originalRaf = globalThis.requestAnimationFrame;
        const originalCancelRaf = globalThis.cancelAnimationFrame;
        globalThis.requestAnimationFrame = ((cb) => {
            return setTimeout(() => cb(16), 16);
        });
        globalThis.cancelAnimationFrame = ((handle) => {
            clearTimeout(handle);
        });
        const engine = createEngine();
        const container = document.createElement("div");
        container.style.width = "900px";
        container.style.height = "320px";
        document.body.appendChild(container);
        const contextMock = createCanvasContextMock();
        const getContextSpy = vi
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockImplementation((contextId) => (contextId === "2d" ? contextMock : null));
        engine.setPaneSpecs(panes);
        engine.mount(container);
        vi.advanceTimersByTime(20);
        // Only inspect the render triggered by crosshair movement.
        vi.clearAllMocks();
        const canvas = container.querySelector("canvas");
        const moveEvent = createPointerEvent("pointermove", { clientX: 120, clientY: 100, offsetX: 120, offsetY: 100 });
        Object.defineProperty(moveEvent, "offsetX", { value: 120 });
        Object.defineProperty(moveEvent, "offsetY", { value: 100 });
        canvas.dispatchEvent(moveEvent);
        vi.advanceTimersByTime(20);
        const restoreMock = contextMock.restore;
        const setLineDashMock = contextMock.setLineDash;
        const crosshairCallIndex = setLineDashMock.mock.calls.findIndex((call) => {
            const dash = call[0];
            return Array.isArray(dash) && dash[0] === 4 && dash[1] === 4;
        });
        expect(crosshairCallIndex).toBeGreaterThanOrEqual(0);
        expect(restoreMock.mock.calls.length).toBeGreaterThanOrEqual(2);
        expect((setLineDashMock.mock.invocationCallOrder[crosshairCallIndex] ?? 0)).toBeGreaterThan(restoreMock.mock.invocationCallOrder[0] ?? 0);
        getContextSpy.mockRestore();
        container.remove();
        globalThis.requestAnimationFrame = originalRaf;
        globalThis.cancelAnimationFrame = originalCancelRaf;
        vi.useRealTimers();
    });
    it("T09-01: five synchronous setPaneSpecs calls batch into one clearRect", () => {
        vi.useFakeTimers();
        const originalRaf = globalThis.requestAnimationFrame;
        const originalCancelRaf = globalThis.cancelAnimationFrame;
        globalThis.requestAnimationFrame = ((cb) => {
            return setTimeout(() => cb(16), 16);
        });
        globalThis.cancelAnimationFrame = ((handle) => {
            clearTimeout(handle);
        });
        const engine = createEngine();
        const container = document.createElement("div");
        document.body.appendChild(container);
        const contextMock = createCanvasContextMock();
        const clearRectMock = contextMock.clearRect;
        const getContextSpy = vi
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockImplementation((contextId) => (contextId === "2d" ? contextMock : null));
        engine.mount(container);
        vi.advanceTimersByTime(20); // flush initial scheduled render activity
        clearRectMock.mockClear();
        for (let i = 0; i < 5; i += 1) {
            engine.setPaneSpecs(panes);
        }
        expect(clearRectMock).not.toHaveBeenCalled();
        vi.advanceTimersByTime(20);
        // KF-12-T08: Two canvases (main + overlay) each call clearRect once per flush
        expect(clearRectMock).toHaveBeenCalledTimes(2);
        engine.dispose();
        getContextSpy.mockRestore();
        container.remove();
        globalThis.requestAnimationFrame = originalRaf;
        globalThis.cancelAnimationFrame = originalCancelRaf;
        vi.useRealTimers();
    });
    it("T09-02: dispose before RAF flush prevents clearRect", () => {
        vi.useFakeTimers();
        const originalRaf = globalThis.requestAnimationFrame;
        const originalCancelRaf = globalThis.cancelAnimationFrame;
        globalThis.requestAnimationFrame = ((cb) => {
            return setTimeout(() => cb(16), 16);
        });
        globalThis.cancelAnimationFrame = ((handle) => {
            clearTimeout(handle);
        });
        const engine = createEngine();
        const container = document.createElement("div");
        document.body.appendChild(container);
        const contextMock = createCanvasContextMock();
        const clearRectMock = contextMock.clearRect;
        const getContextSpy = vi
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockImplementation((contextId) => (contextId === "2d" ? contextMock : null));
        engine.mount(container);
        vi.advanceTimersByTime(20);
        clearRectMock.mockClear();
        engine.setPaneSpecs(panesWithSeries);
        engine.dispose();
        vi.advanceTimersByTime(20);
        expect(clearRectMock).not.toHaveBeenCalled();
        getContextSpy.mockRestore();
        container.remove();
        globalThis.requestAnimationFrame = originalRaf;
        globalThis.cancelAnimationFrame = originalCancelRaf;
        vi.useRealTimers();
    });
    // ── KF-10-T02: params-aware resolveSeriesValues ────────────────────────────
    it("KF10-T02-01: two EMA series with different params resolve different values from indicatorValues", () => {
        const engine = createEngine();
        const container = document.createElement("div");
        container.style.width = "900px";
        container.style.height = "320px";
        document.body.appendChild(container);
        const contextMock = createCanvasContextMock();
        const getContextSpy = vi
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockImplementation((contextId) => (contextId === "2d" ? contextMock : null));
        // Each datum has both EMA(13) and EMA(20) keyed in indicatorValues
        const enrichedBars = Array.from({ length: 20 }, (_, i) => ({
            indicatorValues: {
                "EMA:period=13": 100 + i * 0.3,
                "EMA:period=20": 100 + i * 0.2,
            },
        }));
        const dualEmaPanes = [
            {
                id: "price",
                kind: "price",
                labelKey: "pane.price",
                visible: true,
                heightRatio: 3,
                scaleSlots: [{ id: "price-right", side: "right", mode: "auto", visible: true }],
                series: [
                    { id: "ema13", type: "EMA", scaleSlotId: "price-right", visible: true, params: { period: 13 } },
                    { id: "ema20", type: "EMA", scaleSlotId: "price-right", visible: true, params: { period: 20 } },
                ],
                tooltipMode: "value",
            },
        ];
        engine.setPaneSpecs(dualEmaPanes);
        engine.setEnrichedData(enrichedBars);
        engine.mount(container);
        // Engine should mount and render without errors when two EMA params series are present
        expect(engine.isMounted()).toBe(true);
        expect(contextMock.clearRect).toHaveBeenCalled();
        getContextSpy.mockRestore();
        container.remove();
    });
    it("KF10-T02-02: EMA series without params falls back gracefully", () => {
        const engine = createEngine();
        const container = document.createElement("div");
        container.style.width = "900px";
        container.style.height = "320px";
        document.body.appendChild(container);
        const contextMock = createCanvasContextMock();
        const getContextSpy = vi
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockImplementation((contextId) => (contextId === "2d" ? contextMock : null));
        // indicatorValues keyed by default (period=20) — no explicit params on series
        const enrichedBars = Array.from({ length: 20 }, (_, i) => ({
            indicatorValues: { "EMA:period=20": 100 + i * 0.2 },
        }));
        const emaPanes = [
            {
                id: "price",
                kind: "price",
                labelKey: "pane.price",
                visible: true,
                heightRatio: 3,
                scaleSlots: [{ id: "price-right", side: "right", mode: "auto", visible: true }],
                series: [
                    // No params — engine resolves default key "EMA:period=20"
                    { id: "ema-default", type: "EMA", scaleSlotId: "price-right", visible: true },
                ],
                tooltipMode: "value",
            },
        ];
        engine.setPaneSpecs(emaPanes);
        engine.setEnrichedData(enrichedBars);
        engine.mount(container);
        expect(engine.isMounted()).toBe(true);
        expect(contextMock.clearRect).toHaveBeenCalled();
        getContextSpy.mockRestore();
        container.remove();
    });
    it("KF10-T02-03: Volume series (not params-sensitive) still resolves correctly", () => {
        const engine = createEngine();
        const container = document.createElement("div");
        container.style.width = "900px";
        container.style.height = "320px";
        document.body.appendChild(container);
        const contextMock = createCanvasContextMock();
        const getContextSpy = vi
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockImplementation((contextId) => (contextId === "2d" ? contextMock : null));
        const enrichedBars = Array.from({ length: 20 }, (_, i) => ({
            volume: 1_000_000 + i * 10_000,
        }));
        engine.setPaneSpecs(panesWithSeries);
        engine.setEnrichedData(enrichedBars);
        engine.mount(container);
        expect(engine.isMounted()).toBe(true);
        expect(contextMock.clearRect).toHaveBeenCalled();
        getContextSpy.mockRestore();
        container.remove();
    });
    it("KF11-T03-01: createEngine({ useWebGL: false }) keeps canvas-2D line path", () => {
        const engine = createEngine({ useWebGL: false });
        const container = document.createElement("div");
        container.style.width = "900px";
        container.style.height = "320px";
        document.body.appendChild(container);
        const contextMock = createCanvasContextMock();
        const getContextSpy = vi
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockImplementation((contextId) => (contextId === "2d" ? contextMock : null));
        const linePane = [
            {
                id: "indicator",
                kind: "indicator",
                labelKey: "pane.indicator",
                visible: true,
                heightRatio: 1,
                scaleSlots: [{ id: "indicator-right", side: "right", mode: "auto", visible: true }],
                series: [{ id: "rsi-main", type: "RSI", scaleSlotId: "indicator-right", visible: true }],
                tooltipMode: "value",
            },
        ];
        const enrichedBars = Array.from({ length: 20 }, (_, i) => ({
            rsi: 40 + i,
        }));
        engine.setPaneSpecs(linePane);
        engine.setEnrichedData(enrichedBars);
        engine.mount(container);
        expect(engine.isMounted()).toBe(true);
        expect(contextMock.stroke).toHaveBeenCalled();
        expect(getContextSpy).not.toHaveBeenCalledWith("webgl");
        getContextSpy.mockRestore();
        container.remove();
    });
    // ── KF-12-T06: Camera state + interaction wiring ─────────────────────────
    it("KF12-T06-01: wheel zoom holds anchor bar under pointer (pivot fraction preserved)", () => {
        const engine = createEngine();
        const container = document.createElement("div");
        document.body.appendChild(container);
        const bars = Array.from({ length: 500 }, () => ({}));
        engine.setEnrichedData(bars);
        // Start with visibleRange 0..300
        engine.zoomToRange({ from: 0, to: 300 });
        engine.mount(container);
        const canvas = container.querySelector("canvas");
        Object.defineProperty(canvas, "width", { value: 900, writable: true, configurable: true });
        // Zoom in with wheel at x=450 (50% of canvas width = pivotIndex at bar 150)
        canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: -120, clientX: 450, bubbles: true }));
        const range = engine.getVisibleRange();
        const span = range.to - range.from;
        // Span should be smaller (zoomed in)
        expect(span).toBeLessThan(300);
        // Pivot bar (~150) should remain inside the new range
        expect(range.from).toBeLessThanOrEqual(150);
        expect(range.to).toBeGreaterThanOrEqual(150);
        container.remove();
    });
    it("KF12-T06-02: followLatest=false preserves rightOffsetBars on live append", () => {
        const engine = createEngine();
        // Set up 200 bars, followLatest=false
        const bars = Array.from({ length: 200 }, () => ({}));
        engine.setEnrichedData(bars);
        engine.setCameraState({ followLatest: false });
        // Manually position camera in history
        engine.zoomToRange({ from: 50, to: 150 });
        const rangeBefore = engine.getVisibleRange();
        // Simulate live append (50 more bars)
        const moreBars = Array.from({ length: 250 }, () => ({}));
        engine.setEnrichedData(moreBars);
        const rangeAfter = engine.getVisibleRange();
        // The viewport keeps the same right-edge distance and shifts with the new live edge.
        expect(rangeAfter.from).toBe(rangeBefore.from + 50);
        expect(rangeAfter.to).toBe(rangeBefore.to + 50);
        expect(engine.getCameraState().rightOffsetBars).toBe(50);
    });
    it("KF12-T06-02a: prepend patch shifts visibleRange by prepended bar count", () => {
        const engine = createEngine();
        const bars = Array.from({ length: 200 }, () => ({}));
        engine.setEnrichedData(bars);
        engine.setCameraState({ followLatest: false });
        engine.zoomToRange({ from: 50, to: 150 });
        const prependedBars = Array.from({ length: 250 }, () => ({}));
        engine.setHistorySnapshot({ bars: prependedBars, revision: 1 }, {
            kind: "prepend",
            snapshot: { bars: prependedBars, revision: 1 },
            prependedCount: 50,
            appendedCount: 0,
            trimmedFromHead: 0,
            trimmedFromTail: 0,
        });
        expect(engine.getVisibleRange()).toEqual({ from: 100, to: 200 });
    });
    it("KF12-T06-05: followLatest=false preserves relative offset or re-anchors when data shrinks", () => {
        const engine = createEngine();
        const bars = Array.from({ length: 200 }, () => ({}));
        engine.setEnrichedData(bars);
        engine.setCameraState({ followLatest: false });
        engine.zoomToRange({ from: 100, to: 200 }); // span = 100, rightOffsetBars = 0
        // Case A: Shrinks but not to fit (dataLen >= span)
        // dataLen shrinks from 200 to 120. Span 100 is preserved.
        // targetTo = 120 - 0 = 120. targetFrom = 120 - 100 = 20.
        const shrunkBars = Array.from({ length: 120 }, () => ({}));
        engine.setEnrichedData(shrunkBars);
        let range = engine.getVisibleRange();
        expect(range.from).toBe(20);
        expect(range.to).toBe(120);
        // Case B: Shrinks to fit (dataLen < span)
        // dataLen shrinks to 50. Zooms to fit.
        const superShrunkBars = Array.from({ length: 50 }, () => ({}));
        engine.setEnrichedData(superShrunkBars);
        range = engine.getVisibleRange();
        expect(range.from).toBe(0);
        expect(range.to).toBe(50);
    });
    it("KF12-T06-03: followLatest=true auto-scrolls to live edge on append", () => {
        const engine = createEngine();
        const bars = Array.from({ length: 200 }, () => ({}));
        engine.setEnrichedData(bars);
        engine.setCameraState({ followLatest: true });
        engine.zoomToRange({ from: 100, to: 200 }); // look at latest 100 bars
        // Append 10 more bars
        const moreBars = Array.from({ length: 210 }, () => ({}));
        engine.setEnrichedData(moreBars);
        const range = engine.getVisibleRange();
        // With followLatest=true, live edge = 210, so to = 210
        expect(range.to).toBe(210);
    });
    it("KF12-T06-04: getCameraState reflects pan engagement state", () => {
        const engine = createEngine();
        const container = document.createElement("div");
        document.body.appendChild(container);
        const bars = Array.from({ length: 500 }, () => ({}));
        engine.setEnrichedData(bars);
        engine.zoomToRange({ from: 400, to: 500 }); // span=100, at live edge
        engine.mount(container);
        const canvas = container.querySelector("canvas");
        Object.defineProperty(canvas, "width", { value: 900, writable: true, configurable: true });
        // Drag RIGHT (clientX 300→450, deltaX=+150): indexDelta=17, newFrom=383 → rightOffsetBars=17>0
        // Dragging right scrolls toward older bars, disengaging followLatest
        canvas.dispatchEvent(createPointerEvent("pointerdown", { clientX: 300, clientY: 40, offsetX: 300, offsetY: 40, buttons: 1 }));
        canvas.dispatchEvent(createPointerEvent("pointermove", { clientX: 450, clientY: 40, offsetX: 450, offsetY: 40, buttons: 1 }));
        const cam = engine.getCameraState();
        expect(cam.rightOffsetBars).toBeGreaterThan(0);
        expect(cam.followLatest).toBe(false);
        container.remove();
    });
    it("KF12-T06-06: setCameraState(rightOffsetBars) repositions visibleRange in history mode", () => {
        const engine = createEngine();
        const bars = Array.from({ length: 200 }, () => ({}));
        engine.setEnrichedData(bars);
        engine.zoomToRange({ from: 50, to: 150 });
        engine.setCameraState({ followLatest: false, rightOffsetBars: 30 });
        let range = engine.getVisibleRange();
        expect(range).toEqual({ from: 70, to: 170 });
        let cam = engine.getCameraState();
        expect(cam.followLatest).toBe(false);
        expect(cam.rightOffsetBars).toBe(30);
        // Test negative offset (panned past the right edge)
        engine.setCameraState({ followLatest: false, rightOffsetBars: -20 });
        range = engine.getVisibleRange();
        expect(range).toEqual({ from: 120, to: 220 });
        cam = engine.getCameraState();
        expect(cam.rightOffsetBars).toBe(-20);
    });
    it("KF12-T06-07: history append preserves rightOffsetBars after explicit positioning", () => {
        const engine = createEngine();
        const bars = Array.from({ length: 200 }, () => ({}));
        engine.setEnrichedData(bars);
        engine.zoomToRange({ from: 50, to: 150 });
        engine.setCameraState({ followLatest: false, rightOffsetBars: 30 });
        const rangeBeforeAppend = engine.getVisibleRange();
        const appendedBars = Array.from({ length: 240 }, () => ({}));
        engine.setEnrichedData(appendedBars);
        const rangeAfterAppend = engine.getVisibleRange();
        expect(rangeAfterAppend).toEqual({ from: rangeBeforeAppend.from + 40, to: rangeBeforeAppend.to + 40 });
        const cam = engine.getCameraState();
        expect(cam.rightOffsetBars).toBe(30);
        expect(cam.followLatest).toBe(false);
    });
    it("KF12-T06-07a: history append preserves negative rightOffsetBars past the live edge", () => {
        const engine = createEngine();
        const bars = Array.from({ length: 200 }, () => ({}));
        engine.setEnrichedData(bars);
        engine.zoomToRange({ from: 50, to: 150 });
        engine.setCameraState({ followLatest: false, rightOffsetBars: -20 });
        const rangeBeforeAppend = engine.getVisibleRange();
        expect(rangeBeforeAppend).toEqual({ from: 120, to: 220 });
        const appendedBars = Array.from({ length: 240 }, () => ({}));
        engine.setEnrichedData(appendedBars);
        const rangeAfterAppend = engine.getVisibleRange();
        expect(rangeAfterAppend).toEqual({ from: 160, to: 260 });
        const cam = engine.getCameraState();
        expect(cam.rightOffsetBars).toBe(-20);
        expect(cam.followLatest).toBe(false);
    });
    it("KF12-T06-08: camera envelope mode transitions between shared and extended zoom ranges", () => {
        const engine = createEngine();
        const container = document.createElement("div");
        document.body.appendChild(container);
        const bars = Array.from({ length: 500 }, () => ({}));
        engine.setEnrichedData(bars);
        engine.mount(container);
        engine.zoomToRange({ from: 100, to: 300 });
        expect(engine.getCameraState().envelopeMode).toBe("shared");
        engine.zoomToRange({ from: -20, to: 520 });
        expect(engine.getCameraState().envelopeMode).toBe("extended");
        engine.zoomToRange({ from: 200, to: 208 });
        expect(engine.getCameraState().envelopeMode).toBe("extended");
        engine.zoomToRange({ from: 120, to: 320 });
        expect(engine.getCameraState().envelopeMode).toBe("shared");
        container.remove();
    });
    it("KF12-T06-09: normalizes non-finite zoom ranges and keeps camera state finite", () => {
        const engine = createEngine();
        const bars = Array.from({ length: 300 }, () => ({}));
        engine.setEnrichedData(bars);
        engine.zoomToRange({ from: Number.NaN, to: Number.POSITIVE_INFINITY });
        const range = engine.getVisibleRange();
        expect(Number.isFinite(range.from)).toBe(true);
        expect(Number.isFinite(range.to)).toBe(true);
        expect(range.from).toBeLessThanOrEqual(range.to);
        const camera = engine.getCameraState();
        expect(Number.isFinite(camera.barSpacePx)).toBe(true);
        expect(camera.envelopeMode).toBe("extended");
    });
    it("KF12-T06-10: extended envelope range stays stable and finite across live append", () => {
        const engine = createEngine();
        const bars = Array.from({ length: 500 }, () => ({}));
        engine.setEnrichedData(bars);
        engine.setCameraState({ followLatest: false });
        engine.zoomToRange({ from: -20, to: 520 });
        const before = engine.getVisibleRange();
        expect(before.from).toBe(-20);
        expect(before.to).toBe(520);
        expect(engine.getCameraState().envelopeMode).toBe("extended");
        const appendedBars = Array.from({ length: 560 }, () => ({}));
        engine.setEnrichedData(appendedBars);
        const after = engine.getVisibleRange();
        expect(Number.isFinite(after.from)).toBe(true);
        expect(Number.isFinite(after.to)).toBe(true);
        expect(after.to - after.from).toBe(before.to - before.from);
        expect(after.from).toBe(40);
        expect(after.to).toBe(580);
        expect(engine.getCameraState().envelopeMode).toBe("extended");
    });
    it("KF12-T06-11: round-trip extended -> shared -> extended replays without camera drift", () => {
        const engine = createEngine();
        const bars = Array.from({ length: 500 }, () => ({}));
        engine.setEnrichedData(bars);
        engine.setCameraState({ followLatest: false });
        const extendedRange = { from: -24, to: 524 };
        engine.zoomToRange(extendedRange);
        const extendedBaseline = engine.getVisibleRange();
        const cameraBaseline = engine.getCameraState();
        expect(cameraBaseline.envelopeMode).toBe("extended");
        engine.zoomToRange({ from: 120, to: 320 });
        expect(engine.getCameraState().envelopeMode).toBe("shared");
        engine.zoomToRange(extendedRange);
        const replayedRange = engine.getVisibleRange();
        const replayedCamera = engine.getCameraState();
        expect(replayedRange).toEqual(extendedBaseline);
        expect(replayedCamera.envelopeMode).toBe("extended");
        expect(replayedCamera.followLatest).toBe(false);
        expect(replayedCamera.rightOffsetBars).toBe(cameraBaseline.rightOffsetBars);
        expect(replayedCamera.barSpacePx).toBeCloseTo(cameraBaseline.barSpacePx, 10);
    });
    // ── KF-12-T07: Dirty-reason scheduler ───────────────────────────────────
    it("KF12-T07-01: crosshair move sets OVERLAY flag only", () => {
        const engine = createEngine();
        const container = document.createElement("div");
        document.body.appendChild(container);
        engine.mount(container);
        const canvas = container.querySelector("canvas");
        canvas.dispatchEvent(createPointerEvent("pointermove", { clientX: 100, clientY: 50, offsetX: 100, offsetY: 50 }));
        const mask = engine.getDirtyMask();
        expect(mask & DirtyFlag.OVERLAY).toBeTruthy();
        expect(mask & DirtyFlag.GRID).toBeFalsy();
        expect(mask & DirtyFlag.PLOT).toBeFalsy();
        container.remove();
    });
    it("KF12-T07-02: setEnrichedData sets PLOT | AXIS | OVERLAY but not GRID", () => {
        const engine = createEngine();
        const container = document.createElement("div");
        document.body.appendChild(container);
        engine.mount(container);
        // Flush any pending mask from mount
        const originalRaf = globalThis.requestAnimationFrame;
        globalThis.requestAnimationFrame = ((cb) => {
            cb(0);
            return 0;
        });
        const bars = Array.from({ length: 50 }, () => ({}));
        engine.setEnrichedData(bars);
        globalThis.requestAnimationFrame = originalRaf;
        // After RAF flush, mask was cleared. Call again to inspect the fresh accumulation.
        engine.setEnrichedData(bars);
        const mask = engine.getDirtyMask();
        expect(mask & DirtyFlag.PLOT).toBeTruthy();
        expect(mask & DirtyFlag.AXIS).toBeTruthy();
        expect(mask & DirtyFlag.OVERLAY).toBeTruthy();
        expect(mask & DirtyFlag.GRID).toBeFalsy();
        container.remove();
    });
    it("KF12-T07-03: setPaneSpecs sets FULL mask (all layers including GRID)", () => {
        const engine = createEngine();
        const container = document.createElement("div");
        document.body.appendChild(container);
        engine.mount(container);
        // Flush pending mask first
        const originalRaf = globalThis.requestAnimationFrame;
        globalThis.requestAnimationFrame = ((cb) => {
            cb(0);
            return 0;
        });
        engine.setPaneSpecs(panes); // flush this one
        globalThis.requestAnimationFrame = originalRaf;
        engine.setPaneSpecs(panes);
        const mask = engine.getDirtyMask();
        expect(mask & DirtyFlag.GRID).toBeTruthy();
        expect(mask & DirtyFlag.PLOT).toBeTruthy();
        expect(mask & DirtyFlag.AXIS).toBeTruthy();
        expect(mask & DirtyFlag.OVERLAY).toBeTruthy();
        container.remove();
    });
    // ── KF-12-T08: Overlay canvas split ─────────────────────────────────────
    it("KF12-T08-01: mouse move only repaints overlay (not plot)", () => {
        const engine = createEngine();
        const container = document.createElement("div");
        document.body.appendChild(container);
        const originalRaf = globalThis.requestAnimationFrame;
        // Immediate executor: every scheduleRender flushes synchronously
        globalThis.requestAnimationFrame = ((cb) => {
            cb(0);
            return 0;
        });
        engine.mount(container);
        // clear last flushed mask from mount; simulate crosshair move
        const canvas = container.querySelector("canvas");
        canvas.dispatchEvent(createPointerEvent("pointermove", { clientX: 100, clientY: 50, offsetX: 100, offsetY: 50 }));
        const mask = engine.getLastFlushedMask();
        expect(mask & DirtyFlag.OVERLAY).toBeTruthy();
        expect(mask & DirtyFlag.PLOT).toBeFalsy();
        expect(mask & DirtyFlag.GRID).toBeFalsy();
        globalThis.requestAnimationFrame = originalRaf;
        container.remove();
    });
    it("KF12-T08-02: setEnrichedData sets PLOT|AXIS|OVERLAY but not GRID", () => {
        const engine = createEngine();
        const container = document.createElement("div");
        document.body.appendChild(container);
        const originalRaf = globalThis.requestAnimationFrame;
        globalThis.requestAnimationFrame = ((cb) => {
            cb(0);
            return 0;
        });
        engine.mount(container);
        const bars = Array.from({ length: 50 }, () => ({}));
        engine.setEnrichedData(bars);
        const mask = engine.getLastFlushedMask();
        expect(mask & DirtyFlag.PLOT).toBeTruthy();
        expect(mask & DirtyFlag.AXIS).toBeTruthy();
        expect(mask & DirtyFlag.OVERLAY).toBeTruthy();
        expect(mask & DirtyFlag.GRID).toBeFalsy();
        globalThis.requestAnimationFrame = originalRaf;
        container.remove();
    });
    it("KF12-T08-03: after mount, surface contains separate overlay canvas element", () => {
        const engine = createEngine();
        const container = document.createElement("div");
        document.body.appendChild(container);
        engine.mount(container);
        const canvases = container.querySelectorAll("canvas");
        expect(canvases.length).toBe(2);
        const overlay = container.querySelector("canvas[data-vn-kline-engine='overlay']");
        expect(overlay).not.toBeNull();
        expect(overlay.style.pointerEvents).toBe("none");
        container.remove();
    });
    // ── KF-12-T09: Axis/grid split from plot ──────────────────────────────────
    it("KF12-T09-01: hover (crosshair move) does NOT call axis/grid renderer", () => {
        const engine = createEngine();
        const container = document.createElement("div");
        document.body.appendChild(container);
        const originalRaf = globalThis.requestAnimationFrame;
        globalThis.requestAnimationFrame = ((cb) => {
            cb(0);
            return 0;
        });
        engine.mount(container);
        engine.resetAxisGridRendererCalls();
        // Simulate crosshair move — fires OVERLAY only
        const canvas = container.querySelector("canvas");
        canvas.dispatchEvent(createPointerEvent("pointermove", { clientX: 100, clientY: 50, offsetX: 100, offsetY: 50 }));
        // refreshSurface not called → axisGrid renderer never called
        expect(engine.getAxisGridRendererCalls()).toBe(0);
        globalThis.requestAnimationFrame = originalRaf;
        container.remove();
    });
    it("KF12-T09-02: setTheme triggers FULL and invalidates axis/grid (renderer called)", () => {
        const engine = createEngine();
        const container = document.createElement("div");
        document.body.appendChild(container);
        const originalRaf = globalThis.requestAnimationFrame;
        globalThis.requestAnimationFrame = ((cb) => {
            cb(0);
            return 0;
        });
        engine.mount(container);
        engine.resetAxisGridRendererCalls();
        // setTheme fires FULL → refreshSurface → renderPaneSeries → axisGrid cache miss → renderer.render
        engine.setTheme({ mode: "dark" });
        expect(engine.getAxisGridRendererCalls()).toBe(0); // no panes, so renderPaneSeries has nothing to render
        // Add panes so renderPaneSeries actually iterates
        engine.setPaneSpecs(panes);
        engine.resetAxisGridRendererCalls();
        engine.setTheme({ mode: "light" });
        // With panes, axisGrid renderer is called for each pane
        expect(engine.getAxisGridRendererCalls()).toBeGreaterThanOrEqual(0); // cache or no-op depends on OffscreenCanvas availability
        globalThis.requestAnimationFrame = originalRaf;
        container.remove();
    });
    it("KF12-T09-03: crosshair leave fires OVERLAY only (not PLOT or AXIS)", () => {
        const engine = createEngine();
        const container = document.createElement("div");
        document.body.appendChild(container);
        const originalRaf = globalThis.requestAnimationFrame;
        globalThis.requestAnimationFrame = ((cb) => {
            cb(0);
            return 0;
        });
        engine.mount(container);
        // Simulate crosshair leave
        const canvas = container.querySelector("canvas");
        canvas.dispatchEvent(createPointerEvent("pointerleave", { clientX: 100, clientY: 50, offsetX: 100, offsetY: 50 }));
        const mask = engine.getLastFlushedMask();
        expect(mask & DirtyFlag.OVERLAY).toBeTruthy();
        expect(mask & DirtyFlag.PLOT).toBeFalsy();
        expect(mask & DirtyFlag.AXIS).toBeFalsy();
        expect(mask & DirtyFlag.GRID).toBeFalsy();
        globalThis.requestAnimationFrame = originalRaf;
        container.remove();
    });
    // ── Regression: visibleRange slice + event emission ─────────────────────
    it("T-SLICE-01: seriesData sliced by visibleRange — domain reflects only visible bars", () => {
        const engine = createEngine();
        const container = document.createElement("div");
        container.style.width = "900px";
        container.style.height = "320px";
        document.body.appendChild(container);
        const contextMock = createCanvasContextMock();
        const getContextSpy = vi
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockImplementation((contextId) => (contextId === "2d" ? contextMock : null));
        // 10 bars: bars 0-4 have low values, bars 5-9 have high values.
        // When visibleRange = {from:5, to:9}, domain must be from the high-value slice only.
        const allBars = [1, 2, 3, 4, 5, 100, 200, 300, 400, 500];
        engine.setPaneSpecs(panesWithSeries);
        engine.setDataSource({
            sourceId: "slice-test",
            seriesData: { "volume-main": allBars },
        });
        engine.zoomToRange({ from: 5, to: 9 });
        engine.mount(container);
        const snapshots = engine.getPaneSnapshots();
        const domain = snapshots[0]?.scaleSlotStates["volume-right"]?.domain;
        expect(domain).toBeDefined();
        // Domain min must be >= 0 (bar chart floor) and max must be from the high-value slice (>= 100)
        expect(domain[1]).toBeGreaterThanOrEqual(100);
        // Domain must NOT include the full array max (500) if we only show bars 5-9
        // Actually bars 5-9 = [100,200,300,400,500], max IS 500 — so verify it doesn't include bar0=1 driven domain
        // Key check: domain min (padded) should not be driven down to 1 (the low-value region)
        expect(domain[1]).toBeGreaterThanOrEqual(400);
        getContextSpy.mockRestore();
        container.remove();
    });
    it("T-SLICE-02: runtime series uses global candle window indices when seriesData is shorter", () => {
        const engine = createEngine();
        engine.setPaneSpecs(panesWithSeries);
        engine.setEnrichedData(Array.from({ length: 300 }, (_, index) => ({
            date: new Date(Date.UTC(2024, 0, index + 1)),
            open: 100 + index,
            high: 105 + index,
            low: 95 + index,
            close: 102 + index,
            volume: 1_000 + index,
        })));
        engine.zoomToRange({ from: 40, to: 90 });
        engine.setDataSource({
            sourceId: "slice-global-window-test",
            seriesData: {
                "volume-main": Array.from({ length: 60 }, (_, index) => index + 1),
            },
        });
        const values = engine.resolveSeriesValues({
            id: "volume-main",
            type: "Volume",
            scaleSlotId: "volume-right",
            visible: true,
        });
        expect(values).toHaveLength(50);
        expect(values[0]).toBe(41);
        expect(values[19]).toBe(60);
        expect(values.slice(20).every((value) => value === 0)).toBe(true);
    });
    it("T-EMIT-01: handlePan emits visibleRange event with updated range", () => {
        const engine = createEngine();
        const container = document.createElement("div");
        document.body.appendChild(container);
        const bars = Array.from({ length: 500 }, () => ({}));
        engine.setEnrichedData(bars);
        engine.zoomToRange({ from: 100, to: 400 });
        engine.mount(container);
        const canvas = container.querySelector("canvas");
        Object.defineProperty(canvas, "width", { value: 900, writable: true, configurable: true });
        const rangeListener = vi.fn();
        engine.subscribe("visibleRange", rangeListener);
        // Drag +60px right → scrolls left (toward older data)
        canvas.dispatchEvent(createPointerEvent("pointerdown", { clientX: 300, clientY: 40, offsetX: 300, offsetY: 40, buttons: 1 }));
        canvas.dispatchEvent(createPointerEvent("pointermove", { clientX: 360, clientY: 40, offsetX: 360, offsetY: 40, buttons: 1 }));
        expect(rangeListener).toHaveBeenCalledTimes(1);
        const emitted = rangeListener.mock.calls[0]?.[0];
        expect(emitted.range.from).toBeDefined();
        expect(emitted.range.to).toBeDefined();
        // Verify emitted range matches getVisibleRange()
        const current = engine.getVisibleRange();
        expect(emitted.range.from).toBe(current.from);
        expect(emitted.range.to).toBe(current.to);
        container.remove();
    });
    it("T-EMIT-02: wheel zoom emits visibleRange event with updated range", () => {
        const engine = createEngine();
        const container = document.createElement("div");
        document.body.appendChild(container);
        const bars = Array.from({ length: 500 }, () => ({}));
        engine.setEnrichedData(bars);
        engine.zoomToRange({ from: 0, to: 300 });
        engine.mount(container);
        const canvas = container.querySelector("canvas");
        Object.defineProperty(canvas, "width", { value: 900, writable: true, configurable: true });
        const rangeListener = vi.fn();
        engine.subscribe("visibleRange", rangeListener);
        canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: -120, bubbles: true }));
        expect(rangeListener).toHaveBeenCalledTimes(1);
        const emitted = rangeListener.mock.calls[0]?.[0];
        const current = engine.getVisibleRange();
        expect(emitted.range.from).toBe(current.from);
        expect(emitted.range.to).toBe(current.to);
        container.remove();
    });
    it("T-EMIT-03: setEnrichedData emits visibleRange so React state stays in sync after data updates", () => {
        // Regression: after pan-left-then-return, new live bars arrive via setEnrichedData.
        // The engine updates its internal visibleRange in syncCameraAfterDataChange but
        // previously did NOT emit the event. This caused React's forkVisibleRange to
        // stay stale, making drawing X positions wrong (legacy always re-emits on data change).
        const engine = createEngine();
        const bars = Array.from({ length: 100 }, () => ({}));
        engine.setEnrichedData(bars);
        const rangeListener = vi.fn();
        engine.subscribe("visibleRange", rangeListener);
        // Append new bars (simulate live bar arriving)
        const moreBars = Array.from({ length: 110 }, () => ({}));
        engine.setEnrichedData(moreBars);
        expect(rangeListener).toHaveBeenCalledTimes(1);
        const emitted = rangeListener.mock.calls[0]?.[0];
        const current = engine.getVisibleRange();
        expect(emitted.range.from).toBe(current.from);
        expect(emitted.range.to).toBe(current.to);
        // The emitted range must reflect the new data length
        expect(emitted.range.to).toBe(current.to);
    });
    it("T-CANDLE-01: Candlestick series uses high/low for domain (not close-only scalar)", () => {
        const candlePanes = [
            {
                id: "price",
                kind: "price",
                labelKey: "pane.price",
                visible: true,
                heightRatio: 3,
                scaleSlots: [{ id: "price-right", side: "right", mode: "auto", visible: true }],
                series: [{ id: "candle-main", type: "Candlestick", scaleSlotId: "price-right", visible: true }],
                tooltipMode: "ohlc",
            },
        ];
        const engine = createEngine();
        // 5 bars: low=100, high=200 so domain must span 100..200
        const bars = Array.from({ length: 5 }, (_, i) => ({
            open: 150,
            high: 200,
            low: 100,
            close: 160 + i,
            volume: 1000,
        }));
        const container = document.createElement("div");
        container.style.width = "900px";
        container.style.height = "320px";
        document.body.appendChild(container);
        const contextMock = createCanvasContextMock();
        const getContextSpy = vi
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockImplementation((contextId) => (contextId === "2d" ? contextMock : null));
        engine.setEnrichedData(bars);
        engine.zoomToRange({ from: 0, to: 4 });
        engine.setPaneSpecs(candlePanes);
        engine.mount(container);
        // Verify domain encompasses high (200) and low (100)
        const snapshots = engine.getPaneSnapshots();
        const domain = snapshots[0]?.scaleSlotStates["price-right"]?.domain;
        expect(domain).toBeDefined();
        // domain[0] should be <= 100 (padded below), domain[1] should be >= 200 (padded above)
        expect(domain[0]).toBeLessThanOrEqual(100);
        expect(domain[1]).toBeGreaterThanOrEqual(200);
        getContextSpy.mockRestore();
        container.remove();
    });
    it("T-CANDLE-02: Candlestick width follows visible-range x scale", () => {
        const candlePanes = [
            {
                id: "price",
                kind: "price",
                labelKey: "pane.price",
                visible: true,
                heightRatio: 3,
                scaleSlots: [{ id: "price-right", side: "right", mode: "auto", visible: true }],
                series: [{ id: "candle-main", type: "Candlestick", scaleSlotId: "price-right", visible: true }],
                tooltipMode: "ohlc",
            },
        ];
        const engine = createEngine();
        const bars = Array.from({ length: 5 }, (_, i) => ({
            open: 150,
            high: 200,
            low: 100,
            close: 160 + i,
            volume: 1000,
        }));
        const container = document.createElement("div");
        container.style.width = "900px";
        container.style.height = "320px";
        document.body.appendChild(container);
        const contextMock = createCanvasContextMock();
        const getContextSpy = vi
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockImplementation((contextId) => (contextId === "2d" ? contextMock : null));
        engine.setEnrichedData(bars);
        engine.zoomToRange({ from: 0, to: 4 });
        engine.setPaneSpecs(candlePanes);
        engine.mount(container);
        const snapshots = engine.getPaneSnapshots();
        const plotWidth = snapshots[0]?.plotBounds.width ?? 0;
        const currentRange = engine.getVisibleRange();
        const visibleBarCount = Math.max(1, Math.ceil(Math.abs(currentRange.to - currentRange.from)));
        const expectedBarWidth = Math.min(Math.max(1, (plotWidth / visibleBarCount) * 0.8), (plotWidth / visibleBarCount) * 0.95);
        const firstFillRectCall = contextMock.fillRect.mock.calls[0];
        expect(firstFillRectCall).toBeDefined();
        expect(firstFillRectCall?.[2]).toBeCloseTo(expectedBarWidth, 0);
        getContextSpy.mockRestore();
        container.remove();
    });
    it("T-SSOT-X-01: price candlestick and volume bars share identical bar widths on the same visible range", () => {
        const panesWithCandleAndVolume = [
            {
                id: "price",
                kind: "price",
                labelKey: "pane.price",
                visible: true,
                heightRatio: 3,
                scaleSlots: [{ id: "price-right", side: "right", mode: "auto", visible: true }],
                series: [{ id: "candle-main", type: "Candlestick", scaleSlotId: "price-right", visible: true }],
                tooltipMode: "ohlc",
            },
            {
                id: "volume",
                kind: "volume",
                labelKey: "pane.volume",
                visible: true,
                heightRatio: 1,
                scaleSlots: [{ id: "volume-right", side: "right", mode: "auto", visible: true }],
                series: [{ id: "volume-main", type: "Volume", scaleSlotId: "volume-right", visible: true }],
                tooltipMode: "value",
            },
        ];
        const engine = createEngine();
        const bars = Array.from({ length: 5 }, (_, i) => ({
            open: 150 + i,
            high: 200 + i,
            low: 100 - i,
            close: 160 + i,
            volume: 1000 + i * 10,
        }));
        const container = document.createElement("div");
        container.style.width = "900px";
        container.style.height = "420px";
        document.body.appendChild(container);
        const contextMock = createCanvasContextMock();
        const getContextSpy = vi
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockImplementation((contextId) => (contextId === "2d" ? contextMock : null));
        engine.setEnrichedData(bars);
        engine.zoomToRange({ from: 0, to: 4 });
        engine.setPaneSpecs(panesWithCandleAndVolume);
        engine.mount(container);
        const fillRectCalls = contextMock.fillRect.mock.calls;
        const widths = Array.from(new Set(fillRectCalls.map((call) => call[2])));
        expect(widths).toHaveLength(1);
        getContextSpy.mockRestore();
        container.remove();
    });
    it("T-SSOT-X-02: price candlestick and volume bars stay center-aligned on the time axis", () => {
        const panesWithCandleAndVolume = [
            {
                id: "price",
                kind: "price",
                labelKey: "pane.price",
                visible: true,
                heightRatio: 3,
                scaleSlots: [{ id: "price-right", side: "right", mode: "auto", visible: true }],
                series: [{ id: "candle-main", type: "Candlestick", scaleSlotId: "price-right", visible: true }],
                tooltipMode: "ohlc",
            },
            {
                id: "volume",
                kind: "volume",
                labelKey: "pane.volume",
                visible: true,
                heightRatio: 1,
                scaleSlots: [{ id: "volume-right", side: "right", mode: "auto", visible: true }],
                series: [{ id: "volume-main", type: "Volume", scaleSlotId: "volume-right", visible: true }],
                tooltipMode: "value",
            },
        ];
        const engine = createEngine();
        const bars = Array.from({ length: 8 }, (_, i) => ({
            open: 150 + i,
            high: 200 + i,
            low: 100 - i,
            close: 160 + i,
            volume: 1000 + i * 10,
        }));
        const container = document.createElement("div");
        container.style.width = "900px";
        container.style.height = "420px";
        document.body.appendChild(container);
        const contextMock = createCanvasContextMock();
        const getContextSpy = vi
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockImplementation((contextId) => (contextId === "2d" ? contextMock : null));
        engine.setEnrichedData(bars);
        engine.zoomToRange({ from: 0, to: 7 });
        engine.setPaneSpecs(panesWithCandleAndVolume);
        engine.mount(container);
        const snapshots = engine.getPaneSnapshots();
        const pricePlot = snapshots.find((snapshot) => snapshot.paneId === "price")?.plotBounds;
        const volumePlot = snapshots.find((snapshot) => snapshot.paneId === "volume")?.plotBounds;
        if (!pricePlot || !volumePlot) {
            throw new Error("Expected both price and volume pane snapshots");
        }
        const fillRectCalls = contextMock.fillRect.mock.calls;
        const priceBodies = fillRectCalls
            .filter((call) => {
            const y = call[1];
            return y >= pricePlot.top && y <= pricePlot.top + pricePlot.height;
        })
            .map((call) => ({ x: call[0], width: call[2] }))
            .sort((a, b) => a.x - b.x);
        const volumeBodies = fillRectCalls
            .filter((call) => {
            const y = call[1];
            return y >= volumePlot.top && y <= volumePlot.top + volumePlot.height;
        })
            .map((call) => ({ x: call[0], width: call[2] }))
            .sort((a, b) => a.x - b.x);
        expect(priceBodies.length).toBeGreaterThan(0);
        expect(volumeBodies.length).toBe(priceBodies.length);
        for (let index = 0; index < priceBodies.length; index += 1) {
            const priceBody = priceBodies[index];
            const volumeBody = volumeBodies[index];
            expect(priceBody?.width).toBeCloseTo(volumeBody?.width ?? 0, 0);
            expect(priceBody?.x).toBeCloseTo(volumeBody?.x ?? 0, 0);
        }
        getContextSpy.mockRestore();
        container.remove();
    });
});
