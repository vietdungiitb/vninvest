import { PriceCoordinate } from "../coordinates";
import { DEFAULT_FIB_EXTENSION_LEVELS, DEFAULT_FIB_LEVELS } from "./renderCanvas";
import { resolveDrawingStyle } from "./drawingStyleRegistry";
import type { DrawingObject } from "./types";

export interface DrawingPriceMarker {
	key: string;
	price: number;
}

export interface DrawingPriceLabelsProps {
	drawing?: DrawingObject | null;
	enabled?: boolean;
	/** CE19-04: When true, render labels with a highlighted (accent) fill color to indicate selected drawing */
	highlighted?: boolean;
	displayFormat?: (value: number) => string;
	at?: "left" | "right";
	orient?: "left" | "right";
	fill?: string;
	stroke?: string;
	textFill?: string;
	strokeWidth?: number;
	rectWidth?: number;
	rectHeight?: number;
}

function isFinitePrice(price: unknown): price is number {
	return typeof price === "number" && Number.isFinite(price);
}

function addPriceMarker(markers: DrawingPriceMarker[], seen: Set<string>, key: string, price: number) {
	if (!isFinitePrice(price)) {
		return;
	}
	const normalized = price.toFixed(8);
	if (seen.has(normalized)) {
		return;
	}
	seen.add(normalized);
	markers.push({ key, price });
}

function collectPointPriceMarkers(drawing: DrawingObject, points: DrawingObject["points"], keyPrefix: string) {
	const markers: DrawingPriceMarker[] = [];
	const seen = new Set<string>();
	points.forEach((point, index) => {
		addPriceMarker(markers, seen, `${drawing.id}-${keyPrefix}-${index}`, point.y);
	});
	return markers;
}

function resolveFibonacciMarkers(drawing: DrawingObject) {
	const [startPoint, endPoint] = drawing.points;
	if (!startPoint || !endPoint) {
		return [];
	}

	const markers: DrawingPriceMarker[] = [];
	const seen = new Set<string>();
	const levels = drawing.fibLevels ?? DEFAULT_FIB_LEVELS;
	const priceDelta = endPoint.y - startPoint.y;

	levels.forEach((level, index) => {
		addPriceMarker(markers, seen, `${drawing.id}-fib-${index}`, startPoint.y + priceDelta * level);
	});

	return markers;
}

function resolveFibExtensionMarkers(drawing: DrawingObject) {
	const [startPoint, endPoint] = drawing.points;
	if (!startPoint || !endPoint) {
		return [];
	}

	const markers: DrawingPriceMarker[] = [];
	const seen = new Set<string>();
	const levels = drawing.fibLevels ?? DEFAULT_FIB_EXTENSION_LEVELS;
	const priceDelta = endPoint.y - startPoint.y;

	levels.forEach((level, index) => {
		addPriceMarker(markers, seen, `${drawing.id}-fib-extension-${index}`, endPoint.y + priceDelta * level);
	});

	return markers;
}

export function resolveDrawingPriceMarkers(drawing?: DrawingObject | null): DrawingPriceMarker[] {
	if (!drawing || drawing.visible === false) {
		return [];
	}

	switch (drawing.type) {
		case "trendLine":
		case "ray":
		case "extendedLine":
		case "arrow":
		case "polyline":
		case "text": {
			const lastPoint = drawing.points[drawing.points.length - 1];
			return lastPoint ? [{ key: `${drawing.id}-anchor`, price: lastPoint.y }] : [];
		}
		case "hLine": {
			const firstPoint = drawing.points[0];
			return firstPoint ? [{ key: `${drawing.id}-hline`, price: firstPoint.y }] : [];
		}
		case "rectangle":
		case "dateAndPriceRange":
		case "channel":
		case "parallelChannel":
		case "pitchfork":
		case "abcdPattern":
		case "fibArc":
		case "regressionChannel":
			return collectPointPriceMarkers(drawing, drawing.points, drawing.type);
		case "longPosition":
		case "shortPosition": {
			const riskReward = drawing.riskReward;
			if (!riskReward) {
				return collectPointPriceMarkers(drawing, drawing.points, drawing.type);
			}
			return [
				{ key: `${drawing.id}-entry`, price: riskReward.entry },
				{ key: `${drawing.id}-stop`, price: riskReward.stop },
				{ key: `${drawing.id}-target`, price: riskReward.target },
			];
		}
		case "fibonacci":
			return resolveFibonacciMarkers(drawing);
		case "fibExtension":
			return resolveFibExtensionMarkers(drawing);
		case "vLine":
		case "fibTimeZone":
			return [];
		default:
			return collectPointPriceMarkers(drawing, drawing.points, drawing.type);
	}
}

export function DrawingPriceLabels({
	drawing,
	enabled = true,
	highlighted = false,
	displayFormat = (value: number) => value.toFixed(2),
	at = "right",
	orient = "right",
	fill,
	stroke,
	textFill,
	strokeWidth,
	rectWidth,
	rectHeight,
}: DrawingPriceLabelsProps) {
	if (!enabled) {
		return null;
	}

	const markers = resolveDrawingPriceMarkers(drawing);
	if (markers.length === 0 || !drawing) {
		return null;
	}

	const effectiveDrawing = {
		...drawing,
		style: resolveDrawingStyle(drawing),
	};

	// CE19-04: When highlighted (selected drawing), use a vivid accent fill
	const highlightFill = "#f59e0b";
	const labelFill = fill ?? (highlighted ? highlightFill : (effectiveDrawing.style.fill && effectiveDrawing.style.fill !== "transparent" ? effectiveDrawing.style.fill : "#BAB8B8"));
	const labelStroke = stroke ?? (highlighted ? highlightFill : effectiveDrawing.style.stroke);
	const labelTextFill = textFill ?? "#FFFFFF";
	const labelStrokeWidth = strokeWidth ?? effectiveDrawing.style.strokeWidth;

	return (
		<g aria-hidden="true" data-rsc-drawing-price-labels="legacy">
			{markers.map((marker) => (
				<PriceCoordinate
					key={marker.key}
					price={marker.price}
					displayFormat={displayFormat}
					at={at}
					orient={orient}
					fill={labelFill}
					stroke={labelStroke}
					textFill={labelTextFill}
					strokeWidth={labelStrokeWidth}
					rectWidth={rectWidth}
					rectHeight={rectHeight}
				/>
			))}
		</g>
	);
}

export default DrawingPriceLabels;