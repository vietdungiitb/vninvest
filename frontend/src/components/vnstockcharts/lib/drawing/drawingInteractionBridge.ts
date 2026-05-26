import type { ChartScales, PlotDatum } from "./coordinateUtils";
import {
	buildRenderScalesFromBridge,
	resolveChartPointWithBridge,
	type DrawingCoordinateBridge,
} from "./coordinateBridge";
import { hitTestDrawing, type PointerDeviceType } from "./hitTest";
import { findSnapPoint, MAGNET_TOLERANCE, type MagnetSensitivity, type SnapResult } from "./snap";
import type { DrawingObject, Point } from "./types";

export interface DrawingInteractionContextInput {
	bridge: DrawingCoordinateBridge;
	paneId: string;
	chartWidth: number;
	chartHeight: number;
	x: number;
	y: number;
	plotData: readonly PlotDatum[];
	xAccessor?: (datum: PlotDatum) => Date | number | undefined;
	scaleSlotId?: string;
	yDomain?: readonly [number, number];
	pixelOffset?: { x: number; y: number };
}

export interface DrawingInteractionContext {
	paneId: string;
	scaleSlotId?: string;
	chartWidth: number;
	chartHeight: number;
	mousePosition: readonly [number, number];
	plotData: PlotDatum[];
	renderScales: ChartScales;
	chartPoint: Point;
}

function sortVisibleDrawings(drawings: readonly DrawingObject[]) {
	return drawings
		.map((drawing, index) => ({ drawing, index }))
		.filter(({ drawing }) => drawing.visible !== false)
		.sort((left, right) => (left.drawing.zIndex ?? 0) - (right.drawing.zIndex ?? 0) || left.index - right.index)
		.map(({ drawing }) => drawing);
}

export function resolveDrawingInteractionContext({
	bridge,
	paneId,
	chartWidth,
	chartHeight,
	x,
	y,
	plotData,
	xAccessor,
	scaleSlotId,
	yDomain,
	pixelOffset,
}: DrawingInteractionContextInput): DrawingInteractionContext | undefined {
	const renderScales = buildRenderScalesFromBridge(bridge, {
		paneId,
		scaleSlotId,
		plotData,
		xAccessor,
		yDomain,
		pixelOffset,
	});
	if (!renderScales) {
		return undefined;
	}

	const chartPoint = resolveChartPointWithBridge(bridge, {
		paneId,
		scaleSlotId,
		x,
		y,
	});
	if (!chartPoint) {
		return undefined;
	}

	const offsetX = pixelOffset?.x ?? 0;
	const offsetY = pixelOffset?.y ?? 0;
	return {
		paneId,
		scaleSlotId,
		chartWidth,
		chartHeight,
		mousePosition: [x - offsetX, y - offsetY] as const,
		plotData: (renderScales.plotData ?? plotData) as PlotDatum[],
		renderScales,
		chartPoint,
	};
}

export function hitTestDrawingWithContext(
	drawing: DrawingObject,
	context: DrawingInteractionContext,
	toleranceOrPointerType: number | PointerDeviceType = "mouse",
) {
	const [mouseX, mouseY] = context.mousePosition;
	return hitTestDrawing(
		drawing,
		mouseX,
		mouseY,
		context.renderScales,
		{
			chartWidth: context.chartWidth,
			chartHeight: context.chartHeight,
			plotData: context.plotData,
		},
		toleranceOrPointerType,
	);
}

export function findHitDrawingWithContext(
	drawings: readonly DrawingObject[],
	context: DrawingInteractionContext,
	toleranceOrPointerType: number | PointerDeviceType = "mouse",
) {
	const orderedDrawings = sortVisibleDrawings(drawings);
	return [...orderedDrawings].reverse().find((drawing) => hitTestDrawingWithContext(drawing, context, toleranceOrPointerType));
}

export function findSnapPointWithContext(
	drawings: readonly DrawingObject[],
	context: DrawingInteractionContext,
	magnetSensitivity: MagnetSensitivity,
): SnapResult | null {
	const [mouseX, mouseY] = context.mousePosition;
	return findSnapPoint(
		mouseX,
		mouseY,
		context.renderScales,
		context.plotData,
		sortVisibleDrawings(drawings),
		MAGNET_TOLERANCE[magnetSensitivity],
		magnetSensitivity,
	);
}

export function resolveDrawingPointWithContext(
	drawings: readonly DrawingObject[],
	context: DrawingInteractionContext,
	magnetSensitivity: MagnetSensitivity,
) {
	const snap = findSnapPointWithContext(drawings, context, magnetSensitivity);
	return {
		point: snap?.chartPoint ?? context.chartPoint,
		snap,
	};
}