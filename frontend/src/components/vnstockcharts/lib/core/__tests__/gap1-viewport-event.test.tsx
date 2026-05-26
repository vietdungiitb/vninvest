// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { scaleTime } from "d3-scale";

import type { PaneDescriptor } from "../types/pane-descriptor";

const reactActEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let ChartCanvas: typeof import("../../ChartCanvas").default;
let Chart: typeof import("../../Chart").default;
let DynamicChart: typeof import("../DynamicChart").DynamicChart;

beforeAll(async () => {
	({ act } = await import("react"));
	({ createRoot } = await import("react-dom/client"));
	({ default: ChartCanvas } = await import("../../ChartCanvas"));
	({ default: Chart } = await import("../../Chart"));
	({ DynamicChart } = await import("../DynamicChart"));
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

function alterBarValues(data: readonly SampleBar[], index: number): SampleBar[] {
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

function createChartChildren() {
	return (
		<Chart id={1} height={220} yExtents={(datum: SampleBar) => [datum.high, datum.low]} />
	);
}

function createChartCanvasProps(overrides: Partial<Record<string, unknown>> = {}) {
	const bars = createBars(100);
	const xAccessor = (datum?: SampleBar) => datum?.date ?? new Date(0);
	return {
		height: 320,
		width: 640,
		margin: { top: 20, right: 20, bottom: 20, left: 40 },
		ratio: 1,
		type: "hybrid" as const,
		seriesName: "gap1-chart-canvas",
		data: bars,
		xScale: scaleTime(),
		xAccessor,
		displayXAccessor: xAccessor,
		xExtents: [bars[80]?.date ?? new Date(0), bars[99]?.date ?? new Date(0)] as const,
		children: createChartChildren(),
		...overrides,
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
		seriesName: "gap1-dynamic-chart",
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

describe("Gap 1 — viewport range events", () => {
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

	it("emits a visible-range payload when the viewport slice changes", async () => {
		const onVisibleRangeChange = vi.fn();

		await act(async () => {
			root?.render(
				<ChartCanvas
					{...createChartCanvasProps({
						onVisibleRangeChange,
					})}
				>
					{createChartChildren()}
				</ChartCanvas>,
			);
		});

		await act(async () => {
			root?.render(
				<ChartCanvas
					{...createChartCanvasProps({
						xExtents: [new Date("2026-02-10T00:00:00.000Z"), new Date("2026-03-01T00:00:00.000Z")],
						onVisibleRangeChange,
					})}
				>
					{createChartChildren()}
				</ChartCanvas>,
			);
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
		const xExtents = [new Date("2026-03-22T00:00:00.000Z"), new Date("2026-04-10T00:00:00.000Z")] as const;

		await act(async () => {
			root?.render(
				<ChartCanvas
					{...createChartCanvasProps({ onVisibleRangeChange, xExtents })}
				>
					{createChartChildren()}
				</ChartCanvas>,
			);
		});

		await act(async () => {
			root?.render(
				<ChartCanvas
					{...createChartCanvasProps({
						onVisibleRangeChange,
						xExtents: [new Date(xExtents[0].getTime()), new Date(xExtents[1].getTime())],
					})}
				>
					{createChartChildren()}
				</ChartCanvas>,
			);
		});

		expect(onVisibleRangeChange).toHaveBeenCalledTimes(0);
	});

	it("keeps the barCount aligned with the visible viewport", async () => {
		const onVisibleRangeChange = vi.fn();

		await act(async () => {
			root?.render(
				<ChartCanvas
					{...createChartCanvasProps({
						onVisibleRangeChange,
					})}
				>
					{createChartChildren()}
				</ChartCanvas>,
			);
		});

		onVisibleRangeChange.mockClear();

		await act(async () => {
			root?.render(
				<ChartCanvas
					{...createChartCanvasProps({
						onVisibleRangeChange,
						xExtents: [new Date("2026-02-19T00:00:00.000Z"), new Date("2026-03-05T00:00:00.000Z")],
					})}
				>
					{createChartChildren()}
				</ChartCanvas>,
			);
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
		const xExtents = [bars[80]?.date ?? new Date(0), bars[99]?.date ?? new Date(0)] as const;

		await act(async () => {
			root?.render(
				<ChartCanvas
					{...createChartCanvasProps({
						data: bars,
						xExtents,
						onVisibleRangeChange,
					})}
				>
					{createChartChildren()}
				</ChartCanvas>,
			);
		});

		onVisibleRangeChange.mockClear();

		await act(async () => {
			root?.render(
				<ChartCanvas
					{...createChartCanvasProps({
						data: createBars(101),
						xExtents,
						onVisibleRangeChange,
					})}
				>
					{createChartChildren()}
				</ChartCanvas>,
			);
		});

		expect(onVisibleRangeChange).toHaveBeenCalledTimes(0);
	});

	it("does not emit when the chart has no bars", async () => {
		const onVisibleRangeChange = vi.fn();
		const onVisibleDomainChange = vi.fn();
		const xAccessor = (datum?: SampleBar) => datum?.date ?? new Date(0);

		await act(async () => {
			root?.render(
				<ChartCanvas
					height={320}
					width={640}
					margin={{ top: 20, right: 20, bottom: 20, left: 40 }}
					ratio={1}
					type="hybrid"
					seriesName="gap1-empty-chart"
					data={[]}
					xScale={scaleTime()}
					xAccessor={xAccessor}
					displayXAccessor={xAccessor}
					xExtents={[new Date("2026-01-01T00:00:00.000Z"), new Date("2026-01-02T00:00:00.000Z")]}
					onVisibleRangeChange={onVisibleRangeChange}
					onVisibleDomainChange={onVisibleDomainChange}
				>
					{createChartChildren()}
				</ChartCanvas>,
			);
		});

		expect(onVisibleRangeChange).toHaveBeenCalledTimes(0);
		expect(onVisibleDomainChange).toHaveBeenCalledTimes(0);
	});

	it("forwards onVisibleRangeChange through DynamicChart", async () => {
		const onVisibleRangeChange = vi.fn();

		await act(async () => {
			root?.render(<DynamicChart {...createDynamicChartProps({ onVisibleRangeChange })} />);
		});

		onVisibleRangeChange.mockClear();

		await act(async () => {
			root?.render(
				<DynamicChart
					{...createDynamicChartProps({
						onVisibleRangeChange,
						xExtents: [new Date("2026-02-10T00:00:00.000Z"), new Date("2026-03-01T00:00:00.000Z")],
					})}
				/>,
			);
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
		const xExtents = [bars[80]?.date ?? new Date(0), bars[99]?.date ?? new Date(0)] as const;

		await act(async () => {
			root?.render(
				<DynamicChart
					{...createDynamicChartProps({
						data: bars,
						xExtents,
						onVisibleRangeChange,
					})}
				/>,
			);
		});

		onVisibleRangeChange.mockClear();

		await act(async () => {
			root?.render(
				<DynamicChart
					{...createDynamicChartProps({
						data: alterBarValues(bars, 95),
						xExtents,
						onVisibleRangeChange,
					})}
				/>,
			);
		});

		expect(onVisibleRangeChange).toHaveBeenCalledTimes(0);
	});
});
