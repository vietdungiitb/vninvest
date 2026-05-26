import type { ChartScales, PlotDatum } from "./coordinateUtils";
import type { MeasurementPoint } from "./measuring";
import type { Point } from "./types";

function toDate(value: Date | number | undefined) {
	if (value instanceof Date) {
		return value;
	}

	return new Date(value ?? Number.NaN);
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function resolveReferenceDate(
	plotData: readonly PlotDatum[],
	xAccessor?: (datum: PlotDatum) => Date | number | undefined,
) {
	for (const datum of plotData) {
		const resolved = toDate(xAccessor ? xAccessor(datum) : datum.date);
		if (Number.isFinite(resolved.getTime())) {
			return resolved;
		}
	}

	return new Date(0);
}

function resolveReferencePrice(
	plotData: readonly PlotDatum[],
	yDomain?: readonly [number, number],
) {
	if (Array.isArray(yDomain) && yDomain.length >= 2) {
		const [start, end] = yDomain;
		if (isFiniteNumber(start) && isFiniteNumber(end)) {
			return (start + end) / 2;
		}
	}

	for (const datum of plotData) {
		const candidates = [datum.close, datum.open, datum.high, datum.low];
		for (const candidate of candidates) {
			if (isFiniteNumber(candidate)) {
				return candidate;
			}
		}
	}

	return 0;
}

export interface MeasurementCoordinateInput {
	paneId: string;
	x: number;
	y: number;
	scaleSlotId?: string;
}

export interface MeasurementCoordinatePixelInput {
	paneId: string;
	point: MeasurementPoint;
	scaleSlotId?: string;
}

export interface DrawingCoordinateInput {
	paneId: string;
	x: number;
	y: number;
	scaleSlotId?: string;
}

export interface DrawingCoordinatePixelInput {
	paneId: string;
	point: Point;
	scaleSlotId?: string;
}

export interface DrawingCoordinateScaleContext {
	paneId: string;
	scaleSlotId?: string;
	plotData: readonly PlotDatum[];
	xAccessor?: (datum: PlotDatum) => Date | number | undefined;
	yDomain?: readonly [number, number];
	pixelOffset?: { x: number; y: number };
}

export interface DrawingCoordinateBridge {
	resolveChartPoint(input: DrawingCoordinateInput): Point | undefined;
	chartPointToPixel(input: DrawingCoordinatePixelInput): { x: number; y: number } | undefined;
}

export interface MeasurementCoordinateBridge extends DrawingCoordinateBridge {
	resolveMeasurementPoint(input: MeasurementCoordinateInput): MeasurementPoint | undefined;
	measurementPointToPixel(input: MeasurementCoordinatePixelInput): { x: number; y: number } | undefined;
}

export function resolveChartPointWithBridge(
	bridge: DrawingCoordinateBridge,
	input: DrawingCoordinateInput,
) {
	return bridge.resolveChartPoint(input);
}

export function chartPointToPixelWithBridge(
	bridge: DrawingCoordinateBridge,
	input: DrawingCoordinatePixelInput,
) {
	return bridge.chartPointToPixel(input);
}

export function buildRenderScalesFromBridge(
	bridge: DrawingCoordinateBridge,
	context: DrawingCoordinateScaleContext,
): ChartScales | undefined {
	const pixelOffset = context.pixelOffset ?? { x: 0, y: 0 };
	const toBridgePixel = (x: number, y: number) => ({
		x: x + pixelOffset.x,
		y: y + pixelOffset.y,
	});
	const fromBridgePixel = (pixel: { x: number; y: number }) => ({
		x: pixel.x - pixelOffset.x,
		y: pixel.y - pixelOffset.y,
	});
	const referenceDate = resolveReferenceDate(context.plotData, context.xAccessor);
	const referencePrice = resolveReferencePrice(context.plotData, context.yDomain);
	const referencePoint = { x: referenceDate.getTime(), y: referencePrice };
	const bridgeReferencePixel = bridge.chartPointToPixel({
		paneId: context.paneId,
		scaleSlotId: context.scaleSlotId,
		point: referencePoint,
	});

	if (!bridgeReferencePixel) {
		return undefined;
	}

	const referencePixel = fromBridgePixel(bridgeReferencePixel);

	return {
		xScale: (date: Date) => {
			const pixel = bridge.chartPointToPixel({
				paneId: context.paneId,
				scaleSlotId: context.scaleSlotId,
				point: { x: date.getTime(), y: referencePrice },
			});
			return pixel ? fromBridgePixel(pixel).x : Number.NaN;
		},
		xScaleInvert: (pixelX: number) => new Date(bridge.resolveChartPoint({
			paneId: context.paneId,
			scaleSlotId: context.scaleSlotId,
			...toBridgePixel(pixelX, referencePixel.y),
		})?.x ?? Number.NaN),
		yScale: (price: number) => {
			const pixel = bridge.chartPointToPixel({
				paneId: context.paneId,
				scaleSlotId: context.scaleSlotId,
				point: { x: referencePoint.x, y: price },
			});
			return pixel ? fromBridgePixel(pixel).y : Number.NaN;
		},
		yScaleInvert: (pixelY: number) => bridge.resolveChartPoint({
			paneId: context.paneId,
			scaleSlotId: context.scaleSlotId,
			...toBridgePixel(referencePixel.x, pixelY),
		})?.y ?? Number.NaN,
		xAccessor: context.xAccessor as ChartScales["xAccessor"],
		plotData: context.plotData as PlotDatum[],
	};
}

export function resolveMeasurementPointWithBridge(
	bridge: MeasurementCoordinateBridge,
	input: MeasurementCoordinateInput,
) {
	return bridge.resolveMeasurementPoint(input);
}

export function measurementPointToPixelWithBridge(
	bridge: MeasurementCoordinateBridge,
	input: MeasurementCoordinatePixelInput,
) {
	return bridge.measurementPointToPixel(input);
}