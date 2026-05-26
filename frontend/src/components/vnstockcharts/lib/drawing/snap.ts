import { chartPointToPixel, type ChartScales, type PlotDatum } from "./coordinateUtils";
import type { DrawingObject } from "./types";
import {
	findNearestOverlayEndpointSnap,
	MAGNET_TOLERANCE as CORE_MAGNET_TOLERANCE,
	type MagnetSensitivity as CoreMagnetSensitivity,
	type OverlaySnapPoint,
} from "./engineCompat";

// CE19-03: Magnet sensitivity levels
export type MagnetSensitivity = CoreMagnetSensitivity;

export const MAGNET_TOLERANCE = CORE_MAGNET_TOLERANCE;

export interface SnapResult {
	chartPoint: { x: number; y: number };
	pixelPoint: { x: number; y: number };
	snapType: "ohlc" | "endpoint";
}

function toDate(value: Date | number) {
	return value instanceof Date ? value : new Date(value);
}

function getDatumDate(datum: PlotDatum, scales: ChartScales) {
	const xAccessor = scales.xAccessor;
	const value = xAccessor ? xAccessor(datum) : datum.date;
	return toDate(value);
}

function findNearestBar(mouseX: number, scales: ChartScales, plotData: PlotDatum[], xTolerance: number) {
	let best: { datum: PlotDatum; pixelX: number; distance: number } | null = null;

	for (const datum of plotData) {
		const date = getDatumDate(datum, scales);
		if (!Number.isFinite(date.getTime())) {
			continue;
		}

		const pixelX = scales.xScale(date);
		const distance = Math.abs(mouseX - pixelX);
		if (distance <= xTolerance && (!best || distance < best.distance)) {
			best = { datum, pixelX, distance };
		}
	}

	return best;
}

function pickEndpointSnap(
	mouseX: number,
	mouseY: number,
	scales: ChartScales,
	existingDrawings: DrawingObject[],
	tolerance: number,
) {
	const candidates: OverlaySnapPoint[] = [];

	for (const drawing of existingDrawings) {
		if (drawing.visible === false) {
			continue;
		}

		for (const point of drawing.points) {
			candidates.push({
				chartPoint: { x: point.x, y: point.y },
				pixelPoint: chartPointToPixel(point, scales),
			});
		}
	}

	const snap = findNearestOverlayEndpointSnap(mouseX, mouseY, candidates, tolerance);
	return snap
		? {
			chartPoint: snap.chartPoint,
			pixelPoint: snap.pixelPoint,
			snapType: snap.snapType,
		}
		: null;
}

export function findSnapPoint(
	mouseX: number,
	mouseY: number,
	scales: ChartScales,
	plotData: PlotDatum[],
	existingDrawings: DrawingObject[],
	tolerance = 8,
): SnapResult | null {
	const nearestBar = findNearestBar(mouseX, scales, plotData, 20);
	if (nearestBar) {
		const date = getDatumDate(nearestBar.datum, scales);
		const candidates: Array<{ key: "high" | "low" | "open" | "close"; price: number }> = [
			{ key: "high", price: Number(nearestBar.datum.high) },
			{ key: "low", price: Number(nearestBar.datum.low) },
			{ key: "open", price: Number(nearestBar.datum.open) },
			{ key: "close", price: Number(nearestBar.datum.close) },
		];

		let bestOhlc: SnapResult | null = null;
		let bestDistance = Number.POSITIVE_INFINITY;
		for (const candidate of candidates) {
			if (!Number.isFinite(candidate.price)) {
				continue;
			}

			const pixelPoint = {
				x: nearestBar.pixelX,
				y: scales.yScale(candidate.price),
			};
			const distance = Math.abs(mouseY - pixelPoint.y);
			if (distance <= tolerance && distance < bestDistance) {
				bestDistance = distance;
				bestOhlc = {
					chartPoint: { x: date.getTime(), y: candidate.price },
					pixelPoint,
					snapType: "ohlc",
				};
			}
		}

		if (bestOhlc) {
			return bestOhlc;
		}
	}

	return pickEndpointSnap(mouseX, mouseY, scales, existingDrawings, tolerance * 1.5);
}