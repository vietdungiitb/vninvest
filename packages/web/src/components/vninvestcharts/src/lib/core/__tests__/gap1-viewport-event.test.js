import { jsx as _jsx } from "react/jsx-runtime";
// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { scaleTime } from "d3-scale";
const reactActEnvironment = globalThis;
reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
let act;
let createRoot;
let ChartCanvas;
let Chart;
let DynamicChart;
beforeAll(async () => {
    ({ act } = await import("react"));
    ({ createRoot } = await import("react-dom/client"));
    ({ default: ChartCanvas } = await import("../../ChartCanvas"));
    ({ default: Chart } = await import("../../Chart"));
    ({ DynamicChart } = await import("../DynamicChart"));
}, 30_000);
function createBars(count, startDate = new Date("2026-01-01T00:00:00.000Z")) {
    return Array.from({ length: count }, (_unused, index) => {
        const date = new Date(startDate.getTime() + index * 24 * 60 * 60 * 1000);
        const open = 100 + index;
        const close = open + (index % 2 === 0 ? 3 : -2);
        return {
            date,
            open,
            high: Math.max(open, close) + 2,
            low: Math.min(open, close) - 2,
            close,
            volume: 1_000 + index * 10,
        };
    });
}
function alterBarValues(data, index) {
    return data.map((bar, currentIndex) => {
        if (currentIndex !== index) {
            return bar;
        }
        return {
            ...bar,
            high: bar.high + 25,
            low: bar.low - 15,
            close: bar.close + 10,
            volume: bar.volume + 500,
        };
    });
}
function createCanvasContextMock() {
    return {
        canvas: { width: 0, height: 0 },
        setTransform: vi.fn(),
        clearRect: vi.fn(),
        scale: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        rect: vi.fn(),
        clip: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        setLineDash: vi.fn(),
        closePath: vi.fn(),
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        fillText: vi.fn(),
        set fillStyle(_value) {
            void _value;
        },
        set strokeStyle(_value) {
            void _value;
        },
        set lineWidth(_value) {
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
function createChartChildren() {
    return (_jsx(Chart, { id: 1, height: 220, yExtents: (datum) => [datum.high, datum.low] }));
}
function createChartCanvasProps(overrides = {}) {
    const bars = createBars(100);
    const xAccessor = (datum) => datum?.date ?? new Date(0);
    return {
        height: 320,
        width: 640,
        margin: { top: 20, right: 20, bottom: 20, left: 40 },
        ratio: 1,
        type: "hybrid",
        seriesName: "gap1-chart-canvas",
        data: bars,
        xScale: scaleTime(),
        xAccessor,
        displayXAccessor: xAccessor,
        xExtents: [bars[80]?.date ?? new Date(0), bars[99]?.date ?? new Date(0)],
        children: createChartChildren(),
        ...overrides,
    };
}
function createDynamicChartProps(overrides = {}) {
    const bars = createBars(100);
    const xAccessor = (datum) => datum?.date ?? new Date(0);
    const pane = {
        id: "price",
        label: "Price",
        pinned: true,
        visible: true,
        heightRatio: 1,
        series: [{ type: "Candlestick", yAxis: "right" }],
        splitScale: false,
        tooltip: "ohlc",
    };
    return {
        panes: [pane],
        heights: [240],
        data: bars,
        width: 640,
        height: 320,
        margin: { left: 40, right: 20, top: 20, bottom: 20 },
        type: "hybrid",
        seriesName: "gap1-dynamic-chart",
        xScale: scaleTime(),
        xAccessor,
        displayXAccessor: xAccessor,
        xExtents: [bars[80]?.date ?? new Date(0), bars[99]?.date ?? new Date(0)],
        ratio: 1,
        mouseMoveEvent: true,
        panEvent: true,
        zoomEvent: true,
        useCrossHairStyleCursor: true,
        defaultFocus: true,
        axisStroke: "#64748b",
        axisTickFill: "#e2e8f0",
        isDark: false,
        dateFormat: (date) => date.toISOString(),
        priceFormat: (value) => value.toFixed(2),
        volumeFormat: (value) => value.toFixed(0),
        ...overrides,
    };
}
describe("Gap 1 — viewport range events", () => {
    let container = null;
    let root = null;
    let getContextSpy = null;
    let canvasContext;
    let consoleErrorSpy;
    beforeEach(() => {
        canvasContext = createCanvasContextMock();
        getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => canvasContext);
        consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => { });
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });
    afterEach(() => {
        root?.unmount();
        root = null;
        container?.remove();
        container = null;
        getContextSpy?.mockRestore();
        getContextSpy = null;
        consoleErrorSpy.mockRestore();
    });
    afterAll(() => {
        void 0;
    });
    it("emits a visible-range payload when the viewport slice changes", async () => {
        const onVisibleRangeChange = vi.fn();
        await act(async () => {
            root?.render(_jsx(ChartCanvas, { ...createChartCanvasProps({
                    onVisibleRangeChange,
                }), children: createChartChildren() }));
        });
        await act(async () => {
            root?.render(_jsx(ChartCanvas, { ...createChartCanvasProps({
                    xExtents: [new Date("2026-02-10T00:00:00.000Z"), new Date("2026-03-01T00:00:00.000Z")],
                    onVisibleRangeChange,
                }), children: createChartChildren() }));
        });
        expect(onVisibleRangeChange).toHaveBeenCalledTimes(1);
        expect(onVisibleRangeChange).toHaveBeenCalledWith(expect.objectContaining({
            startIndex: 40,
            endIndex: 59,
            barCount: 20,
        }));
    });
    it("does not emit a duplicate event when the visible slice stays the same", async () => {
        const onVisibleRangeChange = vi.fn();
        const xExtents = [new Date("2026-03-22T00:00:00.000Z"), new Date("2026-04-10T00:00:00.000Z")];
        await act(async () => {
            root?.render(_jsx(ChartCanvas, { ...createChartCanvasProps({ onVisibleRangeChange, xExtents }), children: createChartChildren() }));
        });
        await act(async () => {
            root?.render(_jsx(ChartCanvas, { ...createChartCanvasProps({
                    onVisibleRangeChange,
                    xExtents: [new Date(xExtents[0].getTime()), new Date(xExtents[1].getTime())],
                }), children: createChartChildren() }));
        });
        expect(onVisibleRangeChange).toHaveBeenCalledTimes(0);
    });
    it("keeps the barCount aligned with the visible viewport", async () => {
        const onVisibleRangeChange = vi.fn();
        await act(async () => {
            root?.render(_jsx(ChartCanvas, { ...createChartCanvasProps({
                    onVisibleRangeChange,
                }), children: createChartChildren() }));
        });
        onVisibleRangeChange.mockClear();
        await act(async () => {
            root?.render(_jsx(ChartCanvas, { ...createChartCanvasProps({
                    onVisibleRangeChange,
                    xExtents: [new Date("2026-02-19T00:00:00.000Z"), new Date("2026-03-05T00:00:00.000Z")],
                }), children: createChartChildren() }));
        });
        expect(onVisibleRangeChange).toHaveBeenCalledTimes(1);
        expect(onVisibleRangeChange).toHaveBeenCalledWith(expect.objectContaining({
            startIndex: 49,
            endIndex: 63,
            barCount: 15,
        }));
    });
    it("does not emit when appended data stays outside the current viewport", async () => {
        const onVisibleRangeChange = vi.fn();
        const bars = createBars(100);
        const xExtents = [bars[80]?.date ?? new Date(0), bars[99]?.date ?? new Date(0)];
        await act(async () => {
            root?.render(_jsx(ChartCanvas, { ...createChartCanvasProps({
                    data: bars,
                    xExtents,
                    onVisibleRangeChange,
                }), children: createChartChildren() }));
        });
        onVisibleRangeChange.mockClear();
        await act(async () => {
            root?.render(_jsx(ChartCanvas, { ...createChartCanvasProps({
                    data: createBars(101),
                    xExtents,
                    onVisibleRangeChange,
                }), children: createChartChildren() }));
        });
        expect(onVisibleRangeChange).toHaveBeenCalledTimes(0);
    });
    it("does not emit when the chart has no bars", async () => {
        const onVisibleRangeChange = vi.fn();
        const onVisibleDomainChange = vi.fn();
        const xAccessor = (datum) => datum?.date ?? new Date(0);
        await act(async () => {
            root?.render(_jsx(ChartCanvas, { height: 320, width: 640, margin: { top: 20, right: 20, bottom: 20, left: 40 }, ratio: 1, type: "hybrid", seriesName: "gap1-empty-chart", data: [], xScale: scaleTime(), xAccessor: xAccessor, displayXAccessor: xAccessor, xExtents: [new Date("2026-01-01T00:00:00.000Z"), new Date("2026-01-02T00:00:00.000Z")], onVisibleRangeChange: onVisibleRangeChange, onVisibleDomainChange: onVisibleDomainChange, children: createChartChildren() }));
        });
        expect(onVisibleRangeChange).toHaveBeenCalledTimes(0);
        expect(onVisibleDomainChange).toHaveBeenCalledTimes(0);
    });
    it("forwards onVisibleRangeChange through DynamicChart", async () => {
        const onVisibleRangeChange = vi.fn();
        await act(async () => {
            root?.render(_jsx(DynamicChart, { ...createDynamicChartProps({ onVisibleRangeChange }) }));
        });
        onVisibleRangeChange.mockClear();
        await act(async () => {
            root?.render(_jsx(DynamicChart, { ...createDynamicChartProps({
                    onVisibleRangeChange,
                    xExtents: [new Date("2026-02-10T00:00:00.000Z"), new Date("2026-03-01T00:00:00.000Z")],
                }) }));
        });
        expect(onVisibleRangeChange).toHaveBeenCalledTimes(1);
        expect(onVisibleRangeChange).toHaveBeenCalledWith(expect.objectContaining({
            startIndex: 40,
            endIndex: 59,
            barCount: 20,
        }));
    });
    it("does not emit through DynamicChart when visible bars are altered but viewport dates stay the same", async () => {
        const onVisibleRangeChange = vi.fn();
        const bars = createBars(100);
        const xExtents = [bars[80]?.date ?? new Date(0), bars[99]?.date ?? new Date(0)];
        await act(async () => {
            root?.render(_jsx(DynamicChart, { ...createDynamicChartProps({
                    data: bars,
                    xExtents,
                    onVisibleRangeChange,
                }) }));
        });
        onVisibleRangeChange.mockClear();
        await act(async () => {
            root?.render(_jsx(DynamicChart, { ...createDynamicChartProps({
                    data: alterBarValues(bars, 95),
                    xExtents,
                    onVisibleRangeChange,
                }) }));
        });
        expect(onVisibleRangeChange).toHaveBeenCalledTimes(0);
    });
});
