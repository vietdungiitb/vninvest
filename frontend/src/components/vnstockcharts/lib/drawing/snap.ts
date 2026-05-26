import { chartPointToPixel, type ChartScales, type PlotDatum } from "./coordinateUtils";
import type { DrawingObject } from "./types";
import {
	findNearestOverlayEndpointSnap,
	MAGNET_TOLERANCE as CORE_MAGNET_TOLERANCE,
	type MagnetSensitivity as CoreMagnetSensitivity,
	type OverlaySnapPoint,
} from "@vnstockcharts/vn-kline-engine-core";

// CE19-03: Magnet sensitivity levels
export type MagnetSensitivity = CoreMagnetSensitivity;

export const MAGNET_TOLERANCE = CORE_MAGNET_TOLERANCE;

export interface SnapResult {
	chartPoint: { x: number; y: number };
	pixelPoint: { x: number; y: number };
	/** GAP-7: "fib" added for Fibonacci level snapping */
	snapType: "ohlc" | "fib" | "endpoint";
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

/** GAP-7: Collect price candidates from visible Fibonacci level drawings. */
export function collectFibLevelSnapCandidates(
	drawings: DrawingObject[],
): Array<{ price: number }> {
	const candidates: Array<{ price: number }> = [];
	for (const drawing of drawings) {
		if (drawing.visible === false) continue;
		if (!drawing.fibLevelConfigs?.length) continue;
		if (drawing.points.length < 2) continue;
		const p0y = drawing.points[0].y;
		const p1y = drawing.points[1].y;
		for (const level of drawing.fibLevelConfigs) {
			if (!level.visible) continue;
			const price = p0y + (p1y - p0y) * level.ratio;
			candidates.push({ price });
		}
	}
	return candidates;
}

function findFibLevelSnap(
	mouseX: number,
	mouseY: number,
	scales: ChartScales,
	existingDrawings: DrawingObject[],
	yTolerance: number,
): SnapResult | null {
	const candidates = collectFibLevelSnapCandidates(existingDrawings);
	let best: SnapResult | null = null;
	let bestDist = Number.POSITIVE_INFINITY;
	for (const c of candidates) {
		const pixelY = scales.yScale(c.price);
		const dist = Math.abs(mouseY - pixelY);
		if (dist <= yTolerance && dist < bestDist) {
			bestDist = dist;
			best = {
				chartPoint: { x: scales.xScaleInvert(mouseX).getTime(), y: c.price },
				pixelPoint: { x: mouseX, y: pixelY },
				snapType: "fib",
			};
		}
	}
	return best;
}

export function findSnapPoint(
	mouseX: number,
	mouseY: number,
	scales: ChartScales,
	plotData: PlotDatum[],
	existingDrawings: DrawingObject[],
	tolerance = 8,
	sensitivity: MagnetSensitivity = "normal"
): SnapResult | null {
	const isStrong = sensitivity === "strong";
	const xTolerance = isStrong ? Infinity : 20;
	const yTolerance = isStrong ? Infinity : tolerance;

	const nearestBar = findNearestBar(mouseX, scales, plotData, xTolerance);
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
			if ((isStrong || distance <= yTolerance) && distance < bestDistance) {
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

	// GAP-7: Fibonacci level snap (between OHLC and endpoint priority)
	const fibSnap = findFibLevelSnap(mouseX, mouseY, scales, existingDrawings, yTolerance);
	if (fibSnap) return fibSnap;

	return pickEndpointSnap(mouseX, mouseY, scales, existingDrawings, isStrong ? Infinity : tolerance * 1.5);
}