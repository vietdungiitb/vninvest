// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { scaleTime } from "d3-scale";
import type { ReactNode } from "react";

import type { PaneDescriptor } from "../types/pane-descriptor";

const reactActEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

const xAxisCalls: Array<Record<string, unknown>> = [];
const mouseCoordinateXCalls: Array<Record<string, unknown>> = [];
const paneTooltipCalls: Array<Record<string, unknown>> = [];
const yAxisCalls: Array<Record<string, unknown>> = [];

vi.mock("../../ChartCanvas", async () => {
	const React = await import("react");

	return {
		default: React.forwardRef<HTMLDivElement, { children?: ReactNode }>(function MockChartCanvas({ children }, ref) {
			return React.createElement("div", { ref, "data-testid": "chart-canvas" }, children);
		}),
	};
});

vi.mock("../../Chart", async () => {
	const React = await import("react");

	return {
		default: function MockChart({ children }: { children?: ReactNode }) {
			return React.createElement(React.Fragment, null, children);
		},
	};
});

vi.mock("../../axes", async () => {
	const React = await import("react");

	return {
		XAxis(props: Record<string, unknown>) {
			xAxisCalls.push(props);
			return React.createElement("g", { "data-testid": "x-axis" });
		},
		YAxis(props: Record<string, unknown>) {
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
		MouseCoordinateX(props: Record<string, unknown>) {
			mouseCoordinateXCalls.push(props);
			return React.createElement("g", { "data-testid": "mouse-coordinate-x" });
		},
		MouseCoordinateY(props: Record<string, unknown>) {
			void props;
			return React.createElement("g", { "data-testid": "mouse-coordinate-y" });
		},
	};
});

vi.mock("../PaneTooltip", async () => {
	const React = await import("react");

	return {
		PaneTooltip(props: Record<string, unknown>) {
			paneTooltipCalls.push(props);
			return React.createElement("g", { "data-testid": "pane-tooltip" });
		},
	};
});



let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let DynamicChart: typeof import("../DynamicChart").DynamicChart;

type SampleBar = {
	date: Date;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
};

function createBars(count: number, startDate: Date, stepMs: number): SampleBar[] {
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

function createDynamicChartProps(data: SampleBar[]) {
	const xAccessor = (datum?: SampleBar) => datum?.date ?? new Date(0);
	const pane: PaneDescriptor = {
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
		type: "hybrid" as const,
		seriesName: "x-axis-formatter-chart",
		xScale: scaleTime(),
		xAccessor,
		displayXAccessor: xAccessor,
		xExtents: [firstDate, lastDate] as const,
		ratio: 1,
		mouseMoveEvent: true,
		panEvent: true,
		zoomEvent: true,
		useCrossHairStyleCursor: true,
		defaultFocus: true,
		axisStroke: "#64748b",
		axisTickFill: "#e2e8f0",
		isDark: false,
		dateFormat: (date: Date) => date.toISOString(),
		priceFormat: (value: number) => value.toFixed(2),
		volumeFormat: (value: number) => value.toFixed(0),
	};
}

function resetCapturedCalls() {
	xAxisCalls.length = 0;
	mouseCoordinateXCalls.length = 0;
	paneTooltipCalls.length = 0;
	yAxisCalls.length = 0;
}

describe("DynamicChart x-axis formatters", () => {
	let container: HTMLDivElement | null = null;
	let root: ReturnType<typeof createRoot> | null = null;
	let consoleErrorSpy: any;

	beforeAll(async () => {
		({ act } = await import("react"));
		({ createRoot } = await import("react-dom/client"));
		({ DynamicChart } = await import("../DynamicChart"));
	}, 30_000);

	beforeEach(() => {
		resetCapturedCalls();
		consoleErrorSpy = vi.spyOn(console, "error");
		consoleErrorSpy.mockImplementation(() => {});
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
			root?.render(<DynamicChart {...createDynamicChartProps([])} />);
		});

		const xAxisProps = xAxisCalls.at(-1) as { tickFormat?: (value: Date | number) => string } | undefined;
		expect(xAxisProps?.tickFormat?.(new Date(2026, 4, 1, 0, 0, 0))).toBe("");
	});

	it("uses intraday tick and tooltip formats for short datasets", async () => {
		const data = createBars(30, new Date(2026, 4, 1, 0, 0, 0), 60_000);

		await act(async () => {
			root?.render(<DynamicChart {...createDynamicChartProps(data)} />);
		});

		const xAxisProps = xAxisCalls.at(-1) as { tickFormat?: (value: Date | number) => string } | undefined;
		const mouseCoordinateProps = mouseCoordinateXCalls.at(-1) as { displayFormat?: (date: Date) => string } | undefined;
		const tooltipProps = paneTooltipCalls.at(-1) as { xDisplayFormat?: (date: Date) => string } | undefined;

		expect(xAxisProps?.tickFormat?.(new Date(2026, 4, 1, 0, 0, 0))).toMatch(/^\d{2}-\d{4}$/);
		expect(xAxisProps?.tickFormat?.(new Date(2026, 4, 1, 13, 0, 0))).toMatch(/^\d{2}:\d{2}$/);
		expect(mouseCoordinateProps?.displayFormat?.(new Date(2026, 4, 1, 13, 0, 20))).toMatch(/^\d{2}:\d{2}:\d{2}$/);
		expect(tooltipProps?.xDisplayFormat?.(new Date(2026, 4, 1, 13, 0, 20))).toMatch(/^\d{2}:\d{2}:\d{2}$/);
	});

	it("uses daily tick and date-only tooltip formats for daily datasets", async () => {
		const data = createBars(100, new Date(2026, 4, 1, 0, 0, 0), 24 * 60 * 60 * 1000);

		await act(async () => {
			root?.render(<DynamicChart {...createDynamicChartProps(data)} />);
		});

		const xAxisProps = xAxisCalls.at(-1) as { tickFormat?: (value: Date | number) => string } | undefined;
		const mouseCoordinateProps = mouseCoordinateXCalls.at(-1) as { displayFormat?: (date: Date) => string } | undefined;
		const tooltipProps = paneTooltipCalls.at(-1) as { xDisplayFormat?: (date: Date) => string } | undefined;

		expect(xAxisProps?.tickFormat?.(new Date(2026, 4, 1, 0, 0, 0))).toMatch(/^\d{2}-\d{4}$/);
		expect(xAxisProps?.tickFormat?.(new Date(2026, 4, 15, 0, 0, 0))).toMatch(/^\d{2}-\d{2}$/);
		expect(mouseCoordinateProps?.displayFormat?.(new Date(2026, 4, 15, 13, 45, 20))).toBe("15/05/2026");
		expect(tooltipProps?.xDisplayFormat?.(new Date(2026, 4, 15, 13, 45, 20))).toBe("15/05/2026");
	});

	it("keeps date-only tooltip format when the daily dataset is large", async () => {
		const data = createBars(500, new Date(2026, 0, 1, 0, 0, 0), 24 * 60 * 60 * 1000);

		await act(async () => {
			root?.render(<DynamicChart {...createDynamicChartProps(data)} />);
		});

		const mouseCoordinateProps = mouseCoordinateXCalls.at(-1) as { displayFormat?: (date: Date) => string } | undefined;
		const tooltipProps = paneTooltipCalls.at(-1) as { xDisplayFormat?: (date: Date) => string } | undefined;

		expect(mouseCoordinateProps?.displayFormat?.(new Date(2026, 4, 15, 13, 45, 20))).toBe("15/05/2026");
		expect(tooltipProps?.xDisplayFormat?.(new Date(2026, 4, 15, 13, 45, 20))).toBe("15/05/2026");
	});
});