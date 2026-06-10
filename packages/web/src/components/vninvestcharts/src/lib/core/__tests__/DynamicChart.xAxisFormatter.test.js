import { jsx as _jsx } from "react/jsx-runtime";
// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { scaleTime } from "d3-scale";
const reactActEnvironment = globalThis;
reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
const xAxisCalls = [];
const mouseCoordinateXCalls = [];
const paneTooltipCalls = [];
const yAxisCalls = [];
vi.mock("../../ChartCanvas", async () => {
    const React = await import("react");
    return {
        default: React.forwardRef(function MockChartCanvas({ children }, ref) {
            return React.createElement("div", { ref, "data-testid": "chart-canvas" }, children);
        }),
    };
});
vi.mock("../../Chart", async () => {
    const React = await import("react");
    return {
        default: function MockChart({ children }) {
            return React.createElement(React.Fragment, null, children);
        },
    };
});
vi.mock("../../axes", async () => {
    const React = await import("react");
    return {
        XAxis(props) {
            xAxisCalls.push(props);
            return React.createElement("g", { "data-testid": "x-axis" });
        },
        YAxis(props) {
            yAxisCalls.push(props);
            return React.createElement("g", { "data-testid": "y-axis" });
        },
    };
});
vi.mock("../../coordinates", async () => {
    const React = await import("react");
    return {
        CrossHairCursor() {
            return null;
        },
        MouseCoordinateX(props) {
            mouseCoordinateXCalls.push(props);
            return React.createElement("g", { "data-testid": "mouse-coordinate-x" });
        },
        MouseCoordinateY(props) {
            void props;
            return React.createElement("g", { "data-testid": "mouse-coordinate-y" });
        },
    };
});
vi.mock("../PaneTooltip", async () => {
    const React = await import("react");
    return {
        PaneTooltip(props) {
            paneTooltipCalls.push(props);
            return React.createElement("g", { "data-testid": "pane-tooltip" });
        },
    };
});
let act;
let createRoot;
let DynamicChart;
function createBars(count, startDate, stepMs) {
    return Array.from({ length: count }, (_unused, index) => {
        const date = new Date(startDate.getTime() + index * stepMs);
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
function createDynamicChartProps(data) {
    const xAccessor = (datum) => datum?.date ?? new Date(0);
    const pane = {
        id: "price",
        label: "Price",
        pinned: true,
        visible: true,
        heightRatio: 1,
        series: [],
        splitScale: false,
        tooltip: "value",
    };
    const firstDate = data[0]?.date ?? new Date(0);
    const lastDate = data.at(-1)?.date ?? firstDate;
    return {
        panes: [pane],
        heights: [240],
        data,
        width: 640,
        height: 320,
        margin: { left: 40, right: 20, top: 20, bottom: 20 },
        type: "hybrid",
        seriesName: "x-axis-formatter-chart",
        xScale: scaleTime(),
        xAccessor,
        displayXAccessor: xAccessor,
        xExtents: [firstDate, lastDate],
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
    };
}
function resetCapturedCalls() {
    xAxisCalls.length = 0;
    mouseCoordinateXCalls.length = 0;
    paneTooltipCalls.length = 0;
    yAxisCalls.length = 0;
}
describe("DynamicChart x-axis formatters", () => {
    let container = null;
    let root = null;
    let consoleErrorSpy;
    beforeAll(async () => {
        ({ act } = await import("react"));
        ({ createRoot } = await import("react-dom/client"));
        ({ DynamicChart } = await import("../DynamicChart"));
    }, 30_000);
    beforeEach(() => {
        resetCapturedCalls();
        consoleErrorSpy = vi.spyOn(console, "error");
        consoleErrorSpy.mockImplementation(() => { });
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });
    afterEach(() => {
        root?.unmount();
        root = null;
        container?.remove();
        container = null;
        consoleErrorSpy.mockRestore();
    });
    it("returns an empty x-axis formatter when there is no data", async () => {
        await act(async () => {
            root?.render(_jsx(DynamicChart, { ...createDynamicChartProps([]) }));
        });
        const xAxisProps = xAxisCalls.at(-1);
        expect(xAxisProps?.tickFormat?.(new Date(2026, 4, 1, 0, 0, 0))).toBe("");
    });
    it("uses intraday tick and tooltip formats for short datasets", async () => {
        const data = createBars(30, new Date(2026, 4, 1, 0, 0, 0), 60_000);
        await act(async () => {
            root?.render(_jsx(DynamicChart, { ...createDynamicChartProps(data) }));
        });
        const xAxisProps = xAxisCalls.at(-1);
        const mouseCoordinateProps = mouseCoordinateXCalls.at(-1);
        const tooltipProps = paneTooltipCalls.at(-1);
        expect(xAxisProps?.tickFormat?.(new Date(2026, 4, 1, 0, 0, 0))).toMatch(/^\d{2}-\d{4}$/);
        expect(xAxisProps?.tickFormat?.(new Date(2026, 4, 1, 13, 0, 0))).toMatch(/^\d{2}:\d{2}$/);
        expect(mouseCoordinateProps?.displayFormat?.(new Date(2026, 4, 1, 13, 0, 20))).toMatch(/^\d{2}:\d{2}:\d{2}$/);
        expect(tooltipProps?.xDisplayFormat?.(new Date(2026, 4, 1, 13, 0, 20))).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    });
    it("uses daily tick and date-only tooltip formats for daily datasets", async () => {
        const data = createBars(100, new Date(2026, 4, 1, 0, 0, 0), 24 * 60 * 60 * 1000);
        await act(async () => {
            root?.render(_jsx(DynamicChart, { ...createDynamicChartProps(data) }));
        });
        const xAxisProps = xAxisCalls.at(-1);
        const mouseCoordinateProps = mouseCoordinateXCalls.at(-1);
        const tooltipProps = paneTooltipCalls.at(-1);
        expect(xAxisProps?.tickFormat?.(new Date(2026, 4, 1, 0, 0, 0))).toMatch(/^\d{2}-\d{4}$/);
        expect(xAxisProps?.tickFormat?.(new Date(2026, 4, 15, 0, 0, 0))).toMatch(/^\d{2}-\d{2}$/);
        expect(mouseCoordinateProps?.displayFormat?.(new Date(2026, 4, 15, 13, 45, 20))).toBe("15/05/2026");
        expect(tooltipProps?.xDisplayFormat?.(new Date(2026, 4, 15, 13, 45, 20))).toBe("15/05/2026");
    });
    it("keeps date-only tooltip format when the daily dataset is large", async () => {
        const data = createBars(500, new Date(2026, 0, 1, 0, 0, 0), 24 * 60 * 60 * 1000);
        await act(async () => {
            root?.render(_jsx(DynamicChart, { ...createDynamicChartProps(data) }));
        });
        const mouseCoordinateProps = mouseCoordinateXCalls.at(-1);
        const tooltipProps = paneTooltipCalls.at(-1);
        expect(mouseCoordinateProps?.displayFormat?.(new Date(2026, 4, 15, 13, 45, 20))).toBe("15/05/2026");
        expect(tooltipProps?.xDisplayFormat?.(new Date(2026, 4, 15, 13, 45, 20))).toBe("15/05/2026");
    });
});
