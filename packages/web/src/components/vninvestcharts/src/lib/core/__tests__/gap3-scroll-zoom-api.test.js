import { jsx as _jsx } from "react/jsx-runtime";
// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { scaleTime } from "d3-scale";
const reactActEnvironment = globalThis;
reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
let act;
let createRoot;
let DynamicChart;
let ChartCanvas;
beforeAll(async () => {
    ({ act } = await import("react"));
    ({ createRoot } = await import("react-dom/client"));
    ({ DynamicChart } = await import("../DynamicChart"));
    ({ default: ChartCanvas } = await import("../../ChartCanvas"));
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
        seriesName: "gap3-dynamic-chart",
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
describe("Gap 3 — scroll and zoom imperative API", () => {
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
    it("scrollToIndex(center) converts the current viewport into a new extent", async () => {
        const setXExtentsSpy = vi.spyOn(ChartCanvas.prototype, "setXExtents");
        const chartRef = { current: null };
        await act(async () => {
            root?.render(_jsx(DynamicChart, { ref: chartRef, ...createDynamicChartProps() }));
        });
        await act(async () => {
            chartRef.current?.scrollToIndex(50, "center");
        });
        expect(setXExtentsSpy).toHaveBeenCalledTimes(1);
        expect(setXExtentsSpy).toHaveBeenCalledWith([
            new Date("2026-02-10T00:00:00.000Z"),
            new Date("2026-03-02T00:00:00.000Z"),
        ]);
        setXExtentsSpy.mockRestore();
    });
    it("scrollToIndex ignores negative indexes", async () => {
        const setXExtentsSpy = vi.spyOn(ChartCanvas.prototype, "setXExtents");
        const chartRef = { current: null };
        await act(async () => {
            root?.render(_jsx(DynamicChart, { ref: chartRef, ...createDynamicChartProps() }));
        });
        await act(async () => {
            chartRef.current?.scrollToIndex(-1);
        });
        expect(setXExtentsSpy).toHaveBeenCalledTimes(0);
        setXExtentsSpy.mockRestore();
    });
    it("zoomToRange forwards the exact [startIndex, endIndex] dates", async () => {
        const setXExtentsSpy = vi.spyOn(ChartCanvas.prototype, "setXExtents");
        const chartRef = { current: null };
        await act(async () => {
            root?.render(_jsx(DynamicChart, { ref: chartRef, ...createDynamicChartProps() }));
        });
        await act(async () => {
            chartRef.current?.zoomToRange(10, 30);
        });
        expect(setXExtentsSpy).toHaveBeenCalledTimes(1);
        expect(setXExtentsSpy).toHaveBeenCalledWith([
            new Date("2026-01-11T00:00:00.000Z"),
            new Date("2026-01-31T00:00:00.000Z"),
        ]);
        setXExtentsSpy.mockRestore();
    });
    it("zoomToRange ignores invalid reversed ranges", async () => {
        const setXExtentsSpy = vi.spyOn(ChartCanvas.prototype, "setXExtents");
        const chartRef = { current: null };
        await act(async () => {
            root?.render(_jsx(DynamicChart, { ref: chartRef, ...createDynamicChartProps() }));
        });
        await act(async () => {
            chartRef.current?.zoomToRange(30, 10);
        });
        expect(setXExtentsSpy).not.toHaveBeenCalled();
        setXExtentsSpy.mockRestore();
    });
    it("scrollToDate finds the next matching bar and scrolls to it", async () => {
        const setXExtentsSpy = vi.spyOn(ChartCanvas.prototype, "setXExtents");
        const chartRef = { current: null };
        await act(async () => {
            root?.render(_jsx(DynamicChart, { ref: chartRef, ...createDynamicChartProps() }));
        });
        await act(async () => {
            chartRef.current?.scrollToDate(new Date("2026-01-26T00:00:00.000Z"));
        });
        expect(setXExtentsSpy).toHaveBeenCalledTimes(1);
        expect(setXExtentsSpy).toHaveBeenCalledWith([
            new Date("2026-01-16T00:00:00.000Z"),
            new Date("2026-02-05T00:00:00.000Z"),
        ]);
        setXExtentsSpy.mockRestore();
    });
    it("scrollToDate clamps to the first bar when the target date is before the dataset", async () => {
        const setXExtentsSpy = vi.spyOn(ChartCanvas.prototype, "setXExtents");
        const chartRef = { current: null };
        await act(async () => {
            root?.render(_jsx(DynamicChart, { ref: chartRef, ...createDynamicChartProps() }));
        });
        await act(async () => {
            chartRef.current?.scrollToDate(new Date("2025-12-01T00:00:00.000Z"));
        });
        expect(setXExtentsSpy).toHaveBeenCalledTimes(1);
        expect(setXExtentsSpy.mock.calls[0]?.[0]?.[0]).toEqual(new Date("2026-01-01T00:00:00.000Z"));
        setXExtentsSpy.mockRestore();
    });
    it("renders without a ref prop", async () => {
        await act(async () => {
            root?.render(_jsx(DynamicChart, { ...createDynamicChartProps() }));
        });
        expect(container?.querySelector("svg")).not.toBeNull();
    });
});
