// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { scaleTime } from "d3-scale";

import type { PaneDescriptor } from "../types/pane-descriptor";
import type { ChartHandle } from "../types/chart";

const reactActEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let DynamicChart: typeof import("../DynamicChart").DynamicChart;
let ChartCanvas: typeof import("../../ChartCanvas").default;

beforeAll(async () => {
	({ act } = await import("react"));
	({ createRoot } = await import("react-dom/client"));
	({ DynamicChart } = await import("../DynamicChart"));
	({ default: ChartCanvas } = await import("../../ChartCanvas"));
}, 30_000);

type SampleBar = {
	date: Date;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
};

function createBars(count: number, startDate = new Date("2026-01-01T00:00:00.000Z")): SampleBar[] {
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
		set fillStyle(_value: string) {
			void _value;
		},
		set strokeStyle(_value: string) {
			void _value;
		},
		set lineWidth(_value: number) {
			void _value;
		},
		set font(_value: string) {
			void _value;
		},
		set textAlign(_value: string) {
			void _value;
		},
		set textBaseline(_value: string) {
			void _value;
		},
	};
}

function createDynamicChartProps(overrides: Partial<Record<string, unknown>> = {}) {
	const bars = createBars(100);
	const xAccessor = (datum?: SampleBar) => datum?.date ?? new Date(0);
	const pane: PaneDescriptor = {
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
		type: "hybrid" as const,
		seriesName: "gap3-dynamic-chart",
		xScale: scaleTime(),
		xAccessor,
		displayXAccessor: xAccessor,
		xExtents: [bars[80]?.date ?? new Date(0), bars[99]?.date ?? new Date(0)] as const,
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
		...overrides,
	};
}

describe("Gap 3 — scroll and zoom imperative API", () => {
	let container: HTMLDivElement | null = null;
	let root: ReturnType<typeof createRoot> | null = null;
	let getContextSpy: any = null;
	let canvasContext: ReturnType<typeof createCanvasContextMock>;
	let consoleErrorSpy: any;

	beforeEach(() => {
		canvasContext = createCanvasContextMock();
		getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => canvasContext as never);
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
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
		const chartRef = { current: null as ChartHandle | null };

		await act(async () => {
			root?.render(<DynamicChart ref={chartRef as never} {...createDynamicChartProps()} />);
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
		const chartRef = { current: null as ChartHandle | null };

		await act(async () => {
			root?.render(<DynamicChart ref={chartRef as never} {...createDynamicChartProps()} />);
		});

		await act(async () => {
			chartRef.current?.scrollToIndex(-1);
		});

		expect(setXExtentsSpy).toHaveBeenCalledTimes(0);
		setXExtentsSpy.mockRestore();
	});

	it("zoomToRange forwards the exact [startIndex, endIndex] dates", async () => {
		const setXExtentsSpy = vi.spyOn(ChartCanvas.prototype, "setXExtents");
		const chartRef = { current: null as ChartHandle | null };

		await act(async () => {
			root?.render(<DynamicChart ref={chartRef as never} {...createDynamicChartProps()} />);
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
		const chartRef = { current: null as ChartHandle | null };

		await act(async () => {
			root?.render(<DynamicChart ref={chartRef as never} {...createDynamicChartProps()} />);
		});

		await act(async () => {
			chartRef.current?.zoomToRange(30, 10);
		});

		expect(setXExtentsSpy).not.toHaveBeenCalled();
		setXExtentsSpy.mockRestore();
	});

	it("scrollToDate finds the next matching bar and scrolls to it", async () => {
		const setXExtentsSpy = vi.spyOn(ChartCanvas.prototype, "setXExtents");
		const chartRef = { current: null as ChartHandle | null };

		await act(async () => {
			root?.render(<DynamicChart ref={chartRef as never} {...createDynamicChartProps()} />);
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
		const chartRef = { current: null as ChartHandle | null };

		await act(async () => {
			root?.render(<DynamicChart ref={chartRef as never} {...createDynamicChartProps()} />);
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
			root?.render(<DynamicChart {...createDynamicChartProps()} />);
		});

		expect(container?.querySelector("svg")).not.toBeNull();
	});
});
