// @vitest-environment jsdom
import type { ReactElement } from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { WidgetPaneRuntimeSnapshot } from "../VNStockChart";

const reactActEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
const originalConsoleError = console.error;
console.error = (..._args: unknown[]) => {};

vi.mock("../../lib/core/hooks/useCanvasResize", () => {
	const ref = { current: null as HTMLDivElement | null };
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
] as const;
const engineHostPropsHistory: Array<Record<string, unknown>> = [];
let mockVisibleRange = { from: 0, to: 1 };

function resolveMockForkHoveredPaneId(localX: number, localY: number) {
	const hoveredSnapshot = forkEngineSnapshots.find((snapshot) => {
		const right = snapshot.bounds.left + snapshot.bounds.width;
		const bottom = snapshot.bounds.top + snapshot.bounds.height;
		return localX >= snapshot.bounds.left && localX <= right && localY >= snapshot.bounds.top && localY <= bottom;
	});

	return hoveredSnapshot?.paneId ?? null;
}

vi.mock("@vnstockcharts/vn-kline-engine-react", async () => {
	const React = await import("react");

	return {
		EngineHost(props: {
			className?: string;
			dataSource?: { seriesData?: Record<string, number[]> };
			engineOptions?: { useWebGL?: boolean };
			locale?: string;
			panes?: readonly unknown[];
			onPaneHover?: (paneId: string | null) => void;
			onPaneSnapshotsChange?: (snapshots: readonly unknown[]) => void;
			onVisibleRangeChange?: (range: { from: number; to: number }) => void;
			style?: React.CSSProperties;
		}) {
			engineHostPropsHistory.push(props as unknown as Record<string, unknown>);
			React.useEffect(() => {
				props.onPaneSnapshotsChange?.(forkEngineSnapshots);
				props.onVisibleRangeChange?.(mockVisibleRange);
			}, [props.onPaneSnapshotsChange, props.onVisibleRangeChange]);

			const emitPaneHover = (event: React.PointerEvent<HTMLDivElement>) => {
				const rect = event.currentTarget.getBoundingClientRect();
				const localX = event.clientX - rect.left;
				const localY = event.clientY - rect.top;
				props.onPaneHover?.(resolveMockForkHoveredPaneId(localX, localY));
			};

			return (
				<div
					data-vn-kline-engine-host="true"
					className={props.className}
					style={props.style}
					onPointerMove={emitPaneHover}
					onPointerOut={() => props.onPaneHover?.(null)}
					onPointerOver={emitPaneHover}
				>
					<div data-vn-kline-engine="surface" data-locale={props.locale}>
						<canvas data-vn-kline-engine="canvas" width={600} height={320} />
					</div>
				</div>
			);
		},
	};
});

let act: typeof import("react").act;
let createDrawingObject: typeof import("../../lib/drawing/shared").createDrawingObject;
let chartPointToPixelWithBridge: typeof import("../../lib/drawing/coordinateBridge").chartPointToPixelWithBridge;
let createRoot: typeof import("react-dom/client").createRoot;
let measurementPointToPixelWithBridge: typeof import("../../lib/drawing/coordinateBridge").measurementPointToPixelWithBridge;
let normalizePaneDescriptorsForExplicitScaleSlots: typeof import("../VNStockChart").normalizePaneDescriptorsForExplicitScaleSlots;
let resolveChartPointWithBridge: typeof import("../../lib/drawing/coordinateBridge").resolveChartPointWithBridge;
let resolveMeasurementPointWithBridge: typeof import("../../lib/drawing/coordinateBridge").resolveMeasurementPointWithBridge;
let VNStockChart: typeof import("../VNStockChart").VNStockChart;
let WidgetErrorBoundary: typeof import("../WidgetErrorBoundary").WidgetErrorBoundary;
let WidgetI18nProvider: typeof import("../context/WidgetI18nContext").WidgetI18nProvider;

beforeAll(async () => {
	({ act } = await import("react"));
	({ createRoot } = await import("react-dom/client"));
	({ createDrawingObject } = await import("../../lib/drawing/shared"));
	({
		chartPointToPixelWithBridge,
		measurementPointToPixelWithBridge,
		resolveChartPointWithBridge,
		resolveMeasurementPointWithBridge,
	} = await import("../../lib/drawing/coordinateBridge"));
	({ VNStockChart, normalizePaneDescriptorsForExplicitScaleSlots } = await import("../VNStockChart"));
	({ WidgetErrorBoundary } = await import("../WidgetErrorBoundary"));
	({ WidgetI18nProvider } = await import("../context/WidgetI18nContext"));
}, 30_000);

type Deferred<T> = {
	promise: Promise<T>;
	resolve: (value: T) => void;
	reject: (reason?: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((promiseResolve, promiseReject) => {
		resolve = promiseResolve;
		reject = promiseReject;
	});
	return { promise, resolve, reject };
}

async function flushMicrotasks() {
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
}

async function waitForTruthyValue<T>(resolveValue: () => T | undefined, attempts = 6) {
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

function createAdapter(fetchBarsPromise: Promise<any[]>, label: string) {
	return {
		fetchBars: vi.fn().mockReturnValue(fetchBarsPromise),
		fetchMoreBars: vi.fn().mockResolvedValue([]),
		subscribeToBar: vi.fn().mockReturnValue(() => {}),
		subscribeToTrades: vi.fn().mockReturnValue(() => {}),
		subscribeToOrderbook: vi.fn().mockReturnValue(() => {}),
		searchSymbols: vi.fn().mockResolvedValue([]),
		label,
	};
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

describe("VNStockChart", () => {
	let container: HTMLDivElement | null = null;
	let root: ReturnType<typeof createRoot> | null = null;
	let abortSpy: any = null;

	beforeEach(() => {
		window.localStorage.clear();
		document.documentElement.lang = "en";
		mockVisibleRange = { from: 0, to: 1 };
		abortSpy = vi.spyOn(AbortController.prototype, "abort");
		engineHostPropsHistory.length = 0;
	});

	afterEach(async () => {
		root?.unmount();
		await flushMicrotasks();
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
		const fetchDeferred = createDeferred<any[]>();
		const adapter = createAdapter(fetchDeferred.promise, "empty");

		container = document.createElement("div");
		container.style.width = "1200px";
		container.style.height = "720px";
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root?.render(<VNStockChart adapter={adapter as never} locale="vi" />);
		});

		expect(container.textContent).toContain("Đang tải biểu đồ…");

		await act(async () => {
			fetchDeferred.resolve([]);
			await flushMicrotasks();
		});

		expect(container.textContent).toContain("Chưa có dữ liệu");
		expect(adapter.fetchBars).toHaveBeenCalledTimes(1);
	});

	it("aborts the in-flight fetch when adapter changes", async () => {
		const firstFetch = createDeferred<any[]>();
		const secondFetch = createDeferred<any[]>();
		const firstAdapter = createAdapter(firstFetch.promise, "first");
		const secondAdapter = createAdapter(secondFetch.promise, "second");

		container = document.createElement("div");
		container.style.width = "1200px";
		container.style.height = "720px";
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root?.render(<VNStockChart adapter={firstAdapter as never} locale="en" />);
		});

		await act(async () => {
			root?.render(<VNStockChart adapter={secondAdapter as never} locale="en" />);
		});

		expect(abortSpy?.mock.calls.length ?? 0).toBeGreaterThan(0);

		await act(async () => {
			firstFetch.resolve([]);
			secondFetch.resolve([]);
			await flushMicrotasks();
		});
	});

	it("renders the error boundary fallback when the chart subtree throws", async () => {
		function ThrowingChild(): ReactElement {
			throw new Error("boom");
		}

		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root?.render(
				<WidgetI18nProvider locale="en">
					<WidgetErrorBoundary>
						<ThrowingChild />
					</WidgetErrorBoundary>
				</WidgetI18nProvider>,
			);
		});

		expect(container.textContent).toContain("An error occurred in the chart");
	});

	it("mounts the experimental fork runtime host when requested", async () => {
		const adapter = createAdapter(Promise.resolve([]), "fork-host");

		container = document.createElement("div");
		container.style.width = "1200px";
		container.style.height = "720px";
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root?.render(
				<VNStockChart
					adapter={adapter as never}
					data={forkRuntimeData as never}
					engineRuntime="fork"
					locale="vi"
				/>,
			);
		});

		const host = container.querySelector('[data-vn-kline-engine-host="true"]');
		const surface = container.querySelector('[data-vn-kline-engine="surface"]') as HTMLDivElement | null;

		expect(host).not.toBeNull();
		expect(surface).not.toBeNull();
		expect(surface?.dataset.locale).toBe("vi");
		expect(adapter.fetchBars).not.toHaveBeenCalled();
	});

	it("passes oscillator-aware series data to fork engine host", async () => {
		const adapter = createAdapter(Promise.resolve([]), "fork-series-data");
		const data = Array.from({ length: 80 }, (_, index) => {
			const close = 100 + Math.sin(index / 4) * 12 + index * 0.15;
			const open = index % 2 === 0 ? close - 2 : close + 2;
			return {
				date: new Date(2024, 0, 1, index),
				open,
				high: Math.max(open, close) + 3,
				low: Math.min(open, close) - 3,
				close,
				volume: 120000 + index * 1000,
				index,
				dataIndex: index,
			};
		});

		const panes = [
			{
				id: "momentum",
				label: "Momentum",
				pinned: false,
				visible: true,
				heightRatio: 0.5,
				splitScale: true,
				tooltip: "value",
				series: [
					{ id: "macd-series", type: "MACD", yAxis: "right", params: { fast: 12, slow: 26, signal: 9 } },
				],
			},
			{
				id: "orderflow",
				label: "Order Flow",
				pinned: false,
				visible: true,
				heightRatio: 0.5,
				splitScale: false,
				tooltip: "value",
				series: [
					{ id: "whale-series", type: "Whale", yAxis: "right", params: { threshold: 1 } },
					{ id: "cvd-series", type: "CVDApprox", yAxis: "right" },
				],
			},
		];

		container = document.createElement("div");
		container.style.width = "1200px";
		container.style.height = "720px";
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root?.render(
				<VNStockChart
					adapter={adapter as never}
					data={data as never}
					panes={panes as never}
					engineRuntime="fork"
				/>,
			);
			await flushMicrotasks();
		});

		const latestHostProps = engineHostPropsHistory.at(-1);
		const seriesData = latestHostProps?.dataSource && typeof latestHostProps.dataSource === "object"
			? (latestHostProps.dataSource as { seriesData?: Record<string, number[]> }).seriesData
			: undefined;

		expect(seriesData?.["macd-series"]?.length ?? 0).toBeGreaterThan(0);
		expect(seriesData?.["whale-series"]?.length ?? 0).toBeGreaterThan(0);
		expect(seriesData?.["cvd-series"]?.length ?? 0).toBeGreaterThan(0);
		expect(seriesData?.["whale-series"]?.some((value) => value !== 0)).toBe(true);
	});

	it("KF10-T04-01: forwards per-series params into EngineHost pane specs", async () => {
		const adapter = createAdapter(Promise.resolve([]), "fork-params-forward");
		const panes = [
			{
				id: "price",
				label: "Price",
				pinned: false,
				visible: true,
				heightRatio: 1,
				splitScale: false,
				tooltip: "value",
				series: [
					{ id: "ema-13", type: "EMA", yAxis: "right", params: { period: 13 } },
					{ id: "ema-20", type: "EMA", yAxis: "right", params: { period: 20 } },
				],
			},
		] as const;

		container = document.createElement("div");
		container.style.width = "1200px";
		container.style.height = "720px";
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root?.render(
				<VNStockChart
					adapter={adapter as never}
					data={forkRuntimeData as never}
					panes={panes as never}
					engineRuntime="fork"
				/>,
			);
			await flushMicrotasks();
		});

		const latestHostProps = engineHostPropsHistory.at(-1);
		const enginePanes = (latestHostProps?.panes ?? []) as Array<{ series?: Array<{ id?: string; params?: Record<string, unknown> }> }>;
		const pricePane = enginePanes[0];
		const ema13 = pricePane?.series?.find((series) => series.id === "ema-13");
		const ema20 = pricePane?.series?.find((series) => series.id === "ema-20");

		expect(ema13?.params).toEqual({ period: 13 });
		expect(ema20?.params).toEqual({ period: 20 });
	});

	it("KF10-T04-02: keeps params undefined for series without params", async () => {
		const adapter = createAdapter(Promise.resolve([]), "fork-params-undefined");
		const panes = [
			{
				id: "price",
				label: "Price",
				pinned: false,
				visible: true,
				heightRatio: 1,
				splitScale: false,
				tooltip: "value",
				series: [
					{ id: "ema-default", type: "EMA", yAxis: "right" },
				],
			},
		] as const;

		container = document.createElement("div");
		container.style.width = "1200px";
		container.style.height = "720px";
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root?.render(
				<VNStockChart
					adapter={adapter as never}
					data={forkRuntimeData as never}
					panes={panes as never}
					engineRuntime="fork"
				/>,
			);
			await flushMicrotasks();
		});

		const latestHostProps = engineHostPropsHistory.at(-1);
		const enginePanes = (latestHostProps?.panes ?? []) as Array<{ series?: Array<{ id?: string; params?: Record<string, unknown> }> }>;
		const pricePane = enginePanes[0];
		const emaDefault = pricePane?.series?.find((series) => series.id === "ema-default");

		expect(emaDefault?.params).toBeUndefined();
	});

	it("KF11-T04-01: forwards default useWebGL=false to EngineHost", async () => {
		const adapter = createAdapter(Promise.resolve([]), "fork-webgl-default");

		container = document.createElement("div");
		container.style.width = "1200px";
		container.style.height = "720px";
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root?.render(
				<VNStockChart
					adapter={adapter as never}
					data={forkRuntimeData as never}
					engineRuntime="fork"
				/>,
			);
			await flushMicrotasks();
		});

		const latestHostProps = engineHostPropsHistory.at(-1) as { engineOptions?: { useWebGL?: boolean } } | undefined;
		expect(latestHostProps?.engineOptions?.useWebGL).toBe(false);
	});

	it("falls back to legacy when fork runtime produces no canvas pixels", async () => {
		const adapter = createAdapter(Promise.resolve([]), "fork-degrade");
		const handleRuntimeCapabilitiesChange = vi.fn();
		const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ({
			getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, 0]) }),
		} as unknown as CanvasRenderingContext2D));

		container = document.createElement("div");
		container.style.width = "1200px";
		container.style.height = "720px";
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root?.render(
				<VNStockChart
					adapter={adapter as never}
					data={forkRuntimeData as never}
					engineRuntime="fork"
					onRuntimeCapabilitiesChange={handleRuntimeCapabilitiesChange}
				/>,
			);
		});

		await act(async () => {
			await new Promise((resolve) => window.setTimeout(resolve, 520));
			await flushMicrotasks();
		});

		const legacyCapabilities = handleRuntimeCapabilitiesChange.mock.calls
			.map((call) => call[0])
			.findLast((value) => value?.engineRuntime === "legacy");
		expect(legacyCapabilities).toMatchObject({
			engineRuntime: "legacy",
			chartCanvasOverlays: true,
			drawingOverlays: true,
		});

		getContextSpy.mockRestore();
	});

	it("exposes pane snapshots through the widget contract on the legacy runtime", async () => {
		const adapter = createAdapter(Promise.resolve([]), "legacy-snapshots");
		const handlePaneSnapshotsChange = vi.fn();
		const handlePaneHover = vi.fn();

		container = document.createElement("div");
		container.style.width = "1200px";
		container.style.height = "720px";
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root?.render(
				<VNStockChart
					adapter={adapter as never}
					data={forkRuntimeData as never}
					locale="vi"
					onPaneSnapshotsChange={handlePaneSnapshotsChange}
					onPaneHover={handlePaneHover}
				/>,
			);
		});

		expect(handlePaneSnapshotsChange).toHaveBeenCalled();
		const snapshots = handlePaneSnapshotsChange.mock.calls.at(-1)?.[0];
		if (!Array.isArray(snapshots)) {
			throw new Error("Expected pane snapshots");
		}
		const paneSnapshots = snapshots as readonly WidgetPaneRuntimeSnapshot[];
		expect(paneSnapshots.length).toBeGreaterThan(0);
		expect(paneSnapshots[0]).toMatchObject({
			paneId: expect.any(String),
			plotBounds: expect.objectContaining({ left: expect.any(Number), width: expect.any(Number) }),
		});
		const priceSnapshot = paneSnapshots.find((snapshot) => snapshot.paneId === "price");
		expect(priceSnapshot?.scaleSlotStates["price-right"]?.domain?.length).toBe(2);
		expect(priceSnapshot?.scaleSlotStates["price-right"]?.domain?.[0]).toBeLessThan(priceSnapshot?.scaleSlotStates["price-right"]?.domain?.[1] ?? Number.POSITIVE_INFINITY);

		const widgetRoot = container.firstElementChild as HTMLDivElement | null;
		expect(widgetRoot).not.toBeNull();
		Object.defineProperty(widgetRoot, "getBoundingClientRect", {
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
		const PointerEventCtor = window.PointerEvent ?? window.MouseEvent;
		const hoveredSnapshot = paneSnapshots[Math.min(1, paneSnapshots.length - 1)];

		await act(async () => {
			const clientX = hoveredSnapshot.bounds.left + 8;
			const clientY = hoveredSnapshot.bounds.top + 8;
			widgetRoot?.dispatchEvent(new PointerEventCtor("pointermove", { bubbles: true, clientX, clientY }));
			widgetRoot?.dispatchEvent(new PointerEventCtor("pointerout", { bubbles: true }));
		});

		expect(handlePaneHover).toHaveBeenCalled();
		expect(handlePaneHover.mock.calls[0]?.[0]).toBe(hoveredSnapshot.paneId);
		expect(handlePaneHover.mock.calls.at(-1)?.[0]).toBeNull();
		expect(adapter.fetchBars).not.toHaveBeenCalled();
	});

	it("exposes fork pane snapshots and hover events through the widget contract", async () => {
		const adapter = createAdapter(Promise.resolve([]), "fork-bridge");
		const handlePaneSnapshotsChange = vi.fn();
		const handlePaneHover = vi.fn();

		container = document.createElement("div");
		container.style.width = "1200px";
		container.style.height = "720px";
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root?.render(
				<VNStockChart
					adapter={adapter as never}
					data={forkRuntimeData as never}
					engineRuntime="fork"
					locale="vi"
					onPaneSnapshotsChange={handlePaneSnapshotsChange}
					onPaneHover={handlePaneHover}
				/>,
			);
		});

		expect(handlePaneSnapshotsChange).toHaveBeenCalled();
		const snapshots = handlePaneSnapshotsChange.mock.calls.at(-1)?.[0];
		expect(Array.isArray(snapshots)).toBe(true);
		expect(snapshots.length).toBeGreaterThan(0);
		expect(snapshots[0]).toMatchObject({
			paneId: expect.any(String),
			headerAnchor: expect.objectContaining({ top: expect.any(Number), left: expect.any(Number) }),
		});
		expect(snapshots[0]?.scaleSlotStates["price-right"]?.domain).toEqual([98, 107]);
		expect(snapshots[1]?.scaleSlotStates["volume-right"]?.domain).toEqual([0, 1500]);

		const host = container.querySelector('[data-vn-kline-engine-host="true"]') as HTMLDivElement | null;
		expect(host).not.toBeNull();
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
		const hoveredSnapshot = snapshots[Math.min(1, snapshots.length - 1)];

		const PointerEventCtor = window.PointerEvent ?? window.MouseEvent;
		await act(async () => {
			const clientX = hoveredSnapshot.bounds.left + 8;
			const clientY = hoveredSnapshot.bounds.top + 8;
			host?.dispatchEvent(new PointerEventCtor("pointerover", { bubbles: true, clientX, clientY }));
			if (host) {
				host.dispatchEvent(new PointerEventCtor("pointermove", { bubbles: true, clientX, clientY }));
			}
			host?.dispatchEvent(new PointerEventCtor("pointerout", { bubbles: true }));
		});

		expect(handlePaneHover).toHaveBeenCalled();
		expect(handlePaneHover.mock.calls[0]?.[0]).toBe(hoveredSnapshot.paneId);
		expect(handlePaneHover.mock.calls.at(-1)?.[0]).toBeNull();
	});

	it("normalizes fork visible-range updates back into the widget contract", async () => {
		const adapter = createAdapter(Promise.resolve([]), "fork-visible-range");
		const handleVisibleRangeChange = vi.fn();
		const handleVisibleDomainChange = vi.fn();

		container = document.createElement("div");
		container.style.width = "1200px";
		container.style.height = "720px";
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root?.render(
				<VNStockChart
					adapter={adapter as never}
					data={forkRuntimeData as never}
					engineRuntime="fork"
					locale="vi"
					onVisibleRangeChange={handleVisibleRangeChange}
					onVisibleDomainChange={handleVisibleDomainChange}
				/>,
			);
		});

		expect(handleVisibleRangeChange).toHaveBeenCalledWith({
			startIndex: 0,
			endIndex: 1,
			startDate: forkRuntimeData[0].date,
			endDate: forkRuntimeData[1].date,
			barCount: 2,
		});
		expect(handleVisibleDomainChange).toHaveBeenCalledWith([
			forkRuntimeData[0].date,
			forkRuntimeData[1].date,
		]);
	});

	it("normalizes reversed fork visible-range updates back into the widget contract", async () => {
		const adapter = createAdapter(Promise.resolve([]), "fork-visible-range-reversed");
		const handleVisibleRangeChange = vi.fn();
		const handleVisibleDomainChange = vi.fn();

		mockVisibleRange = { from: 1, to: 0 };

		container = document.createElement("div");
		container.style.width = "1200px";
		container.style.height = "720px";
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root?.render(
				<VNStockChart
					adapter={adapter as never}
					data={forkRuntimeData as never}
					engineRuntime="fork"
					locale="vi"
					onVisibleRangeChange={handleVisibleRangeChange}
					onVisibleDomainChange={handleVisibleDomainChange}
				/>,
			);
		});

		expect(handleVisibleRangeChange).toHaveBeenCalledWith({
			startIndex: 0,
			endIndex: 1,
			startDate: forkRuntimeData[0].date,
			endDate: forkRuntimeData[1].date,
			barCount: 2,
		});
		expect(handleVisibleDomainChange).toHaveBeenCalledWith([
			forkRuntimeData[0].date,
			forkRuntimeData[1].date,
		]);
	});

	it("forwards fork click and context-menu events through the widget contract", async () => {
		const adapter = createAdapter(Promise.resolve([]), "fork-pointer-contract");
		const handleClick = vi.fn();
		const handleContextMenu = vi.fn();

		container = document.createElement("div");
		container.style.width = "1200px";
		container.style.height = "720px";
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root?.render(
				<VNStockChart
					adapter={adapter as never}
					data={forkRuntimeData as never}
					engineRuntime="fork"
					locale="vi"
					onClick={handleClick}
					onContextMenu={handleContextMenu}
				/>,
			);
			await flushMicrotasks();
		});

		const engineSurface = await waitForTruthyValue(() => container?.querySelector(".rsc-engine-surface") as HTMLDivElement | null);
		expect(engineSurface).not.toBeNull();
		Object.defineProperty(engineSurface, "getBoundingClientRect", {
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

		await act(async () => {
			engineSurface.dispatchEvent(new MouseEvent("click", {
				bubbles: true,
				clientX: 120,
				clientY: 120,
			}));
			engineSurface.dispatchEvent(new MouseEvent("contextmenu", {
				bubbles: true,
				cancelable: true,
				clientX: 120,
				clientY: 120,
			}));
		});

		expect(handleClick).toHaveBeenCalledWith(expect.objectContaining({
			currentItem: expect.objectContaining({
				date: forkRuntimeData[0].date,
				close: forkRuntimeData[0].close,
				open: forkRuntimeData[0].open,
			}),
			currentCharts: [0],
			mouseXY: [120, 120],
		}), expect.any(MouseEvent));
		expect(handleContextMenu).toHaveBeenCalledWith(expect.objectContaining({
			currentItem: expect.objectContaining({
				date: forkRuntimeData[0].date,
				close: forkRuntimeData[0].close,
				open: forkRuntimeData[0].open,
			}),
			currentCharts: [0],
			mouseXY: [120, 120],
		}), expect.any(MouseEvent));
	});

	it("renders pane toolbar and splitter consumers from the widget contract", async () => {
		const adapter = createAdapter(Promise.resolve([]), "pane-toolbar-contract");
		const handlePaneToggleVisibleRequest = vi.fn();
		const handlePaneAddSeriesRequest = vi.fn();
		const handlePaneToggleSeriesRequest = vi.fn();
		const handleRuntimeCapabilitiesChange = vi.fn();

		container = document.createElement("div");
		container.style.width = "1200px";
		container.style.height = "720px";
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root?.render(
				<VNStockChart
					adapter={adapter as never}
					data={forkRuntimeData as never}
					locale="vi"
					renderPaneToolbar={({ pane, actions }) => (
						<div data-pane-toolbar={pane.id}>
							<button type="button" data-pane-toggle={pane.id} onClick={actions.toggleVisibility}>
								toggle
							</button>
							<button type="button" data-pane-add-series={pane.id} onClick={actions.addSeries}>
								add
							</button>
							<button type="button" data-pane-toggle-series={pane.id} onClick={() => actions.toggleSeries(pane.series[0]?.type ?? "Line", 0)}>
								series
							</button>
						</div>
					)}
					renderPaneSplitter={({ pane, splitterIndex, top }) => (
						<div key={`${pane.id}-splitter`} data-pane-splitter={splitterIndex} data-pane-splitter-top={String(top)} />
					)}
					onPaneToggleVisibleRequest={handlePaneToggleVisibleRequest}
					onPaneAddSeriesRequest={handlePaneAddSeriesRequest}
					onPaneToggleSeriesRequest={handlePaneToggleSeriesRequest}
					onRuntimeCapabilitiesChange={handleRuntimeCapabilitiesChange}
				/>,
			);
		});

		const toolbar = container.querySelector('[data-pane-toolbar="price"]');
		const splitters = container.querySelectorAll("[data-pane-splitter]");
		expect(toolbar).not.toBeNull();
		expect(splitters.length).toBeGreaterThan(0);
		const mountedContainer = container;
		expect(mountedContainer).not.toBeNull();
		if (!mountedContainer) {
			throw new Error("Expected mounted container");
		}

		await act(async () => {
			(mountedContainer.querySelector('[data-pane-toggle="price"]') as HTMLButtonElement | null)?.click();
			(mountedContainer.querySelector('[data-pane-add-series="price"]') as HTMLButtonElement | null)?.click();
			(mountedContainer.querySelector('[data-pane-toggle-series="price"]') as HTMLButtonElement | null)?.click();
		});

		expect(handlePaneToggleVisibleRequest).toHaveBeenCalledWith("price");
		expect(handlePaneAddSeriesRequest).toHaveBeenCalledWith("price");
		expect(handlePaneToggleSeriesRequest).toHaveBeenCalledWith("price", expect.any(String), 0);
		expect(handleRuntimeCapabilitiesChange).toHaveBeenCalledWith({
			engineRuntime: "fork",
			paneToolbar: true,
			paneSplitters: true,
			chartCanvasOverlays: false,
			measurementOverlay: true,
			drawingOverlays: false,
		});
	});

	it("reports the remaining overlay capability gaps for the fork runtime", async () => {
		const adapter = createAdapter(Promise.resolve([]), "fork-capabilities");
		const handleRuntimeCapabilitiesChange = vi.fn();

		container = document.createElement("div");
		container.style.width = "1200px";
		container.style.height = "720px";
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root?.render(
				<VNStockChart
					adapter={adapter as never}
					data={forkRuntimeData as never}
					engineRuntime="fork"
					locale="vi"
					onRuntimeCapabilitiesChange={handleRuntimeCapabilitiesChange}
				/>,
			);
			await flushMicrotasks();
		});

		const capabilities = await waitForTruthyValue(() => handleRuntimeCapabilitiesChange.mock.calls
			.map((call) => call[0])
			.findLast((value) => value?.measurementOverlay === true));
		expect(capabilities).toEqual({
			engineRuntime: "fork",
			paneToolbar: true,
			paneSplitters: true,
			chartCanvasOverlays: false,
			measurementOverlay: true,
			drawingOverlays: false,
		});
	});

	it("renders a bridge-backed measurement overlay on the fork runtime", async () => {
		const adapter = createAdapter(Promise.resolve([]), "fork-measurement-overlay");
		const handlePaneHover = vi.fn();

		container = document.createElement("div");
		container.style.width = "1200px";
		container.style.height = "720px";
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root?.render(
				<VNStockChart
					adapter={adapter as never}
					data={forkRuntimeData as never}
					engineRuntime="fork"
					locale="vi"
					measurementEnabled
					onPaneHover={handlePaneHover}
				/>,
			);
			await flushMicrotasks();
		});

		const overlay = await waitForTruthyValue(() => container?.querySelector('[data-rsc-measurement-mode="bridge"]') as HTMLCanvasElement | null);
		expect(overlay).not.toBeNull();

		const widgetRoot = container.firstElementChild as HTMLDivElement | null;
		expect(widgetRoot).not.toBeNull();
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
		Object.defineProperty(widgetRoot, "getBoundingClientRect", {
			configurable: true,
			value: () => rect,
		});
		Object.defineProperty(overlay, "getBoundingClientRect", {
			configurable: true,
			value: () => rect,
		});

		const PointerEventCtor = window.PointerEvent ?? window.MouseEvent;
		await act(async () => {
			overlay.dispatchEvent(new PointerEventCtor("pointermove", {
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
			root?.render(
				<VNStockChart
					adapter={adapter as never}
					data={forkRuntimeData as never}
					engineRuntime="fork"
					locale="vi"
					onCoordinateBridgeChange={handleCoordinateBridgeChange}
				/>,
			);
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
			point: point!,
			scaleSlotId: "price-right",
		});
		expect(pixel?.x).toBe(1200);
		expect(pixel?.y).toBeCloseTo(224, 6);

		const chartPoint = resolveChartPointWithBridge(bridge, {
			paneId: "price",
			x: 1200,
			y: 224,
			scaleSlotId: "price-right",
		});
		expect(chartPoint).toEqual({
			x: forkRuntimeData[1].date.getTime(),
			y: point?.price,
		});
		const chartPixel = chartPointToPixelWithBridge(bridge, {
			paneId: "price",
			point: chartPoint!,
			scaleSlotId: "price-right",
		});
		expect(chartPixel).toEqual({
			x: 1200,
			y: expect.closeTo(224, 6),
		});
	});

	it("renders selected drawing price labels on fork runtime", async () => {
		const adapter = createAdapter(Promise.resolve([]), "fork-price-labels");
		const selectedDrawing = createDrawingObject("trendLine", [
			{ x: forkRuntimeData[0].date.getTime(), y: 100 },
			{ x: forkRuntimeData[1].date.getTime(), y: 106 },
		], {
			id: "price-label-drawing",
			paneId: "price",
			yScaleId: "price-right",
		});

		container = document.createElement("div");
		container.style.width = "1200px";
		container.style.height = "720px";
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root?.render(
				<VNStockChart
					adapter={adapter as never}
					data={forkRuntimeData as never}
					engineRuntime="fork"
					locale="vi"
					selectedDrawing={selectedDrawing as never}
					showDrawingPriceMarkers
				/>,
			);
		});

		const overlay = await waitForTruthyValue(() => container?.querySelector('[data-rsc-drawing-price-labels="fork"]') as HTMLDivElement | null);
		expect(overlay).not.toBeNull();
		expect(overlay?.textContent).toContain("106.00");
		expect(overlay?.querySelector('[data-rsc-drawing-price-label="price-label-drawing-anchor"]')).not.toBeNull();
	});

	it("renders and removes selected drawing price labels on legacy runtime without crashing the chart", async () => {
		const adapter = createAdapter(Promise.resolve([]), "legacy-price-labels");
		const selectedDrawing = createDrawingObject("trendLine", [
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
			root?.render(
				<VNStockChart
					adapter={adapter as never}
					data={forkRuntimeData as never}
					engineRuntime="legacy"
					locale="vi"
					selectedDrawing={selectedDrawing as never}
					showDrawingPriceMarkers
				/>,
			);
		});

		const overlay = await waitForTruthyValue(() => container?.querySelector('[data-rsc-drawing-price-labels="legacy"]') as HTMLDivElement | null);
		expect(overlay).not.toBeNull();
		expect(container?.textContent).not.toContain("Đã xảy ra lỗi trong biểu đồ");

		await act(async () => {
			root?.render(
				<VNStockChart
					adapter={adapter as never}
					data={forkRuntimeData as never}
					engineRuntime="legacy"
					locale="vi"
					selectedDrawing={null}
					showDrawingPriceMarkers
				/>,
			);
		});

		expect(container?.querySelector('[data-rsc-drawing-price-labels="legacy"]')).toBeNull();
		expect(container?.textContent).not.toContain("Đã xảy ra lỗi trong biểu đồ");
	});

	it("normalizes legacy BollingerBands pane types at the widget boundary", () => {
		const panes = normalizePaneDescriptorsForExplicitScaleSlots([
			{
				id: "price",
				label: "Price",
				pinned: true,
				visible: true,
				heightRatio: 1,
				splitScale: false,
				tooltip: "ohlc",
				series: [{ type: "BollingerBands" as never, yAxis: "right" }],
			},
		]);

		expect(panes[0]?.series).toHaveLength(1);
		expect(panes[0]?.series[0]?.type).toBe("BollingerBand");
	});

	it("keeps legacy children, measurement overlay, and dark-flow badge mounted on legacy runtime", async () => {
		const adapter = createAdapter(Promise.resolve([]), "legacy-overlay-contract");

		container = document.createElement("div");
		container.style.width = "1200px";
		container.style.height = "720px";
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root?.render(
				<VNStockChart
					adapter={adapter as never}
					data={forkRuntimeData as never}
					engineRuntime="legacy"
					locale="vi"
					measurementEnabled
					darkFlowStrength={64}
					darkFlowSignalType="iceberg"
				>
					<div data-legacy-child="true" />
				</VNStockChart>,
			);
		});

		const measurementOverlay = await waitForTruthyValue(() => container?.querySelector('[data-rsc-measurement-mode="bridge"]') as HTMLCanvasElement | null);
		const legacyChild = await waitForTruthyValue(() => container?.querySelector('[data-legacy-child="true"]') as HTMLDivElement | null);
		const darkFlowBadge = await waitForTruthyValue(() => container?.querySelector('.gc-darkflow-badge') as HTMLDivElement | null);

		expect(measurementOverlay).not.toBeNull();
		expect(legacyChild).not.toBeNull();
		expect(darkFlowBadge?.textContent).toContain("Dark Flow");
		expect(darkFlowBadge?.textContent).toContain("64");
	});
});
