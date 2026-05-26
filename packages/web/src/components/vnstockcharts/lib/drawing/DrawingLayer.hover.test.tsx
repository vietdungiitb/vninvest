// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { scaleLinear, scaleTime } from "d3-scale";

import "./index";
import DrawingLayer from "./DrawingLayer";
import { createDrawingObject } from "./shared";

const reactActEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

let capturedProps: any = null;

vi.mock("../GenericChartComponent", async () => {
	const actual = await vi.importActual<typeof import("../GenericChartComponent")>("../GenericChartComponent");
	return {
		...actual,
		default: (props: any) => {
			capturedProps = props;
			return null;
		},
	};
});

describe("DrawingLayer hover cursor", () => {
	let container: HTMLDivElement | null = null;
	let root: ReturnType<typeof createRoot> | null = null;
	const baseChartConfig = {
		id: 1,
		paneId: "price",
		width: 200,
		height: 100,
		origin: [0, 0] as [number, number],
		yScale: scaleLinear().domain([0, 100]).range([100, 0]),
	};
	const momentumChartConfig = {
		id: 2,
		paneId: "momentum",
		yScaleId: "right",
		width: 200,
		height: 100,
		origin: [0, 100] as [number, number],
		yScale: scaleLinear().domain([0, 100]).range([100, 0]),
	};

	beforeEach(() => {
		capturedProps = null;
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
	});

	afterEach(() => {
		act(() => {
			root?.unmount();
		});
		root = null;
		container?.remove();
		container = null;
	});

	it("enables hover detection on selectable drawings so cursor feedback can change", () => {
		const drawing = createDrawingObject("trendLine", [
			{ x: Date.parse("2026-01-01T00:00:00.000Z"), y: 20 },
			{ x: Date.parse("2026-01-02T00:00:00.000Z"), y: 40 },
		], { id: "drawing-1" });

		const interaction = {
			drawingState: { type: "idle" },
			history: { present: [drawing] },
			selectObject: vi.fn(),
			setSelectedObjects: vi.fn(),
			cancelDrawing: vi.fn(),
			startMoving: vi.fn(),
			startResizing: vi.fn(),
			replaceDrawings: vi.fn(),
			dispatch: vi.fn(),
			startEditing: vi.fn(),
		} as any;

		act(() => {
			root?.render(createElement(DrawingLayer, {
				activeTool: "cursor",
				interaction,
			}));
		});

		expect(capturedProps).not.toBeNull();
		expect(capturedProps.selected).toBe(false);
		expect(capturedProps.disablePan).toBe(false);
		expect(capturedProps.interactiveCursorClass).toBeUndefined();
		expect(typeof capturedProps.onHover).toBe("function");
		expect(typeof capturedProps.onUnHover).toBe("function");

		const xScale = scaleTime()
			.domain([new Date("2026-01-01T00:00:00.000Z"), new Date("2026-01-02T00:00:00.000Z")])
			.range([0, 200]);

		expect(capturedProps.isHover({
			mouseXY: [0, 80],
			chartConfig: baseChartConfig,
			chartConfigList: [baseChartConfig],
			xScale,
			xAccessor: (datum: { date: Date }) => datum.date,
			plotData: [{ date: new Date("2026-01-01T00:00:00.000Z"), open: 10, high: 12, low: 8, close: 11, volume: 1_000 }],
		})).toBe(true);

		expect(capturedProps.isHover({
			mouseXY: [180, 10],
			chartConfig: baseChartConfig,
			chartConfigList: [baseChartConfig],
			xScale,
			xAccessor: (datum: { date: Date }) => datum.date,
			plotData: [{ date: new Date("2026-01-01T00:00:00.000Z"), open: 10, high: 12, low: 8, close: 11, volume: 1_000 }],
		})).toBe(false);
	});

	it("keeps plain cursor drags free for chart pan instead of starting rubber-band selection", () => {
		const drawing = createDrawingObject("trendLine", [
			{ x: Date.parse("2026-01-01T00:00:00.000Z"), y: 20 },
			{ x: Date.parse("2026-01-02T00:00:00.000Z"), y: 40 },
		], { id: "drawing-pan" });
		const interaction = {
			drawingState: { type: "idle" },
			history: { present: [drawing] },
			selectObject: vi.fn(),
			setSelectedObjects: vi.fn(),
			cancelDrawing: vi.fn(),
			startMoving: vi.fn(),
			startResizing: vi.fn(),
			replaceDrawings: vi.fn(),
			dispatch: vi.fn(),
			startEditing: vi.fn(),
		} as any;

		act(() => {
			root?.render(createElement(DrawingLayer, {
				activeTool: "cursor",
				interaction,
			}));
		});

		const xScale = scaleTime()
			.domain([new Date("2026-01-01T00:00:00.000Z"), new Date("2026-01-02T00:00:00.000Z")])
			.range([0, 200]);
		const baseMoreProps = {
			chartConfig: baseChartConfig,
			chartConfigList: [baseChartConfig],
			currentCharts: [1],
			currentItem: { date: new Date("2026-01-01T00:00:00.000Z") },
			xScale,
			xAccessor: (datum: { date: Date }) => datum.date,
			plotData: [{ date: new Date("2026-01-01T00:00:00.000Z"), open: 10, high: 12, low: 8, close: 11, volume: 1_000 }],
		};

		act(() => {
			capturedProps.onMouseDown({
				...baseMoreProps,
				mouseXY: [10, 10],
				startPos: [10, 10],
				event: { ctrlKey: false, metaKey: false, shiftKey: false },
			});
			capturedProps.onMouseMove({
				...baseMoreProps,
				mouseXY: [140, 90],
				event: { ctrlKey: false, metaKey: false, shiftKey: false },
			});
			document.dispatchEvent(new PointerEvent("pointerup"));
		});

		expect(interaction.setSelectedObjects).not.toHaveBeenCalled();
	});

	it("uses Ctrl/Cmd drag to commit rubber-band selection in cursor mode", () => {
		const drawing = createDrawingObject("trendLine", [
			{ x: Date.parse("2026-01-01T00:00:00.000Z"), y: 20 },
			{ x: Date.parse("2026-01-02T00:00:00.000Z"), y: 40 },
		], { id: "drawing-rubber-band" });
		const interaction = {
			drawingState: { type: "idle" },
			history: { present: [drawing] },
			selectObject: vi.fn(),
			setSelectedObjects: vi.fn(),
			cancelDrawing: vi.fn(),
			startMoving: vi.fn(),
			startResizing: vi.fn(),
			replaceDrawings: vi.fn(),
			dispatch: vi.fn(),
			startEditing: vi.fn(),
		} as any;

		act(() => {
			root?.render(createElement(DrawingLayer, {
				activeTool: "cursor",
				interaction,
			}));
		});

		const xScale = scaleTime()
			.domain([new Date("2026-01-01T00:00:00.000Z"), new Date("2026-01-02T00:00:00.000Z")])
			.range([0, 200]);
		const baseMoreProps = {
			chartConfig: baseChartConfig,
			chartConfigList: [baseChartConfig],
			currentCharts: [1],
			currentItem: { date: new Date("2026-01-01T00:00:00.000Z") },
			xScale,
			xAccessor: (datum: { date: Date }) => datum.date,
			plotData: [{ date: new Date("2026-01-01T00:00:00.000Z"), open: 10, high: 12, low: 8, close: 11, volume: 1_000 }],
		};

		act(() => {
			document.dispatchEvent(new KeyboardEvent("keydown", { key: "Control", ctrlKey: true }));
		});

		expect(capturedProps.disablePan).toBe(true);

		act(() => {
			capturedProps.onMouseDown({
				...baseMoreProps,
				mouseXY: [0, 90],
				startPos: [0, 90],
				event: { ctrlKey: true, metaKey: false, shiftKey: false },
			});
			capturedProps.onMouseMove({
				...baseMoreProps,
				mouseXY: [150, 50],
				event: { ctrlKey: true, metaKey: false, shiftKey: false },
			});
			document.dispatchEvent(new PointerEvent("pointerup"));
			document.dispatchEvent(new KeyboardEvent("keyup", { key: "Control", ctrlKey: false }));
		});

		expect(interaction.setSelectedObjects).toHaveBeenCalledWith(["drawing-rubber-band"]);
		expect(capturedProps.disablePan).toBe(false);
	});

	it("disables pan only while the selection modifier is held in cursor mode", () => {
		const interaction = {
			drawingState: { type: "idle" },
			history: { present: [] },
			selectObject: vi.fn(),
			setSelectedObjects: vi.fn(),
			cancelDrawing: vi.fn(),
			startMoving: vi.fn(),
			startResizing: vi.fn(),
			replaceDrawings: vi.fn(),
			dispatch: vi.fn(),
			startEditing: vi.fn(),
		} as any;

		act(() => {
			root?.render(createElement(DrawingLayer, {
				activeTool: "cursor",
				interaction,
			}));
		});

		expect(capturedProps.disablePan).toBe(false);

		act(() => {
			document.dispatchEvent(new KeyboardEvent("keydown", { key: "Meta", metaKey: true }));
		});

		expect(capturedProps.disablePan).toBe(true);

		act(() => {
			document.dispatchEvent(new KeyboardEvent("keyup", { key: "Meta", metaKey: false }));
		});

		expect(capturedProps.disablePan).toBe(false);
	});

	it("keeps new drafts pane-scoped when drawing starts on a secondary pane", () => {
		const drawing = createDrawingObject("hLine", [
			{ x: Date.parse("2026-01-01T00:00:00.000Z"), y: 20 },
			{ x: Date.parse("2026-01-02T00:00:00.000Z"), y: 20 },
		], { id: "drawing-pane-2", paneId: "momentum", yScaleId: "right" });
		const onToolUsed = vi.fn();
		const interaction = {
			drawingState: { type: "idle" },
			history: { present: [drawing] },
			selectObject: vi.fn(),
			setSelectedObjects: vi.fn(),
			cancelDrawing: vi.fn(),
			startMoving: vi.fn(),
			startResizing: vi.fn(),
			replaceDrawings: vi.fn(),
			dispatch: vi.fn(),
			startEditing: vi.fn(),
		} as any;

		act(() => {
			root?.render(createElement(DrawingLayer, {
				activeTool: "text",
				interaction,
				onToolUsed,
			}));
		});

		expect(capturedProps).not.toBeNull();
		expect(capturedProps.disablePan).toBe(true);

		const xScale = scaleTime()
			.domain([new Date("2026-01-01T00:00:00.000Z"), new Date("2026-01-02T00:00:00.000Z")])
			.range([0, 200]);

		act(() => {
			capturedProps.onMouseDown({
				mouseXY: [50, 180],
				startPos: [50, 180],
				currentCharts: [2],
				chartConfig: baseChartConfig,
				chartConfigList: [baseChartConfig, momentumChartConfig],
				currentItem: { date: new Date("2026-01-01T00:00:00.000Z") },
				xScale,
				xAccessor: (datum: { date: Date }) => datum.date,
				plotData: [{ date: new Date("2026-01-01T00:00:00.000Z"), open: 10, high: 12, low: 8, close: 11, volume: 1_000 }],
				event: { shiftKey: false },
			});
		});

		expect(interaction.dispatch).toHaveBeenCalledWith(expect.objectContaining({
			type: "START_DRAWING",
			toolName: "text",
			object: expect.objectContaining({
				paneId: "momentum",
				yScaleId: "right",
			}),
		}));
		expect(onToolUsed).not.toHaveBeenCalled();
	});

	it("hit-tests drawings using the correct secondary pane chart config", () => {
		const drawing = createDrawingObject("hLine", [
			{ x: Date.parse("2026-01-01T00:00:00.000Z"), y: 20 },
			{ x: Date.parse("2026-01-02T00:00:00.000Z"), y: 20 },
		], { id: "drawing-pane-2", paneId: "momentum", yScaleId: "right" });
		const interaction = {
			drawingState: { type: "idle" },
			history: { present: [drawing] },
			selectObject: vi.fn(),
			setSelectedObjects: vi.fn(),
			cancelDrawing: vi.fn(),
			startMoving: vi.fn(),
			startResizing: vi.fn(),
			replaceDrawings: vi.fn(),
			dispatch: vi.fn(),
			startEditing: vi.fn(),
		} as any;

		act(() => {
			root?.render(createElement(DrawingLayer, {
				activeTool: "cursor",
				interaction,
			}));
		});

		expect(capturedProps.isHover({
			mouseXY: [50, 180],
			chartConfig: baseChartConfig,
			chartConfigList: [baseChartConfig, momentumChartConfig],
			currentCharts: [2],
			xScale: scaleTime()
				.domain([new Date("2026-01-01T00:00:00.000Z"), new Date("2026-01-02T00:00:00.000Z")])
				.range([0, 200]),
			xAccessor: (datum: { date: Date }) => datum.date,
			plotData: [{ date: new Date("2026-01-01T00:00:00.000Z"), open: 10, high: 12, low: 8, close: 11, volume: 1_000 }],
		})).toBe(true);
	});
});