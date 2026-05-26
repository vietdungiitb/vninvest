export type MagnetSensitivity = "weak" | "normal" | "strong";

export const MAGNET_TOLERANCE: Record<MagnetSensitivity, number> = {
	weak: 5,
	normal: 10,
	strong: 20,
};

export interface MeasurementPoint {
	index: number;
	date: Date;
	price: number;
}

export interface MeasurementSelection {
	start: MeasurementPoint;
	end: MeasurementPoint;
}

export interface MeasurementSummary {
	bars: number;
	priceDelta: number;
	priceDeltaPercent: number;
}

export interface OverlayCanvasStyle {
	stroke?: string;
	strokeWidth?: number;
	strokeDasharray?: "solid" | "dashed" | "dotted" | readonly number[];
	fill?: string;
	fillOpacity?: number;
	opacity?: number;
	fontSize?: number;
	fontFamily?: string;
}

interface OverlayCanvasBase {
	points: ReadonlyArray<{ x: number; y: number }>;
	style: OverlayCanvasStyle;
}

export type OverlayCanvasPrimitive =
	| ({ type: "trendLine" } & OverlayCanvasBase)
	| ({ type: "arrow" } & OverlayCanvasBase)
	| ({ type: "hLine" } & OverlayCanvasBase)
	| ({ type: "vLine" } & OverlayCanvasBase)
	| ({ type: "rectangle" } & OverlayCanvasBase)
	| ({ type: "dateAndPriceRange" } & OverlayCanvasBase)
	| ({ type: "text"; text?: string } & OverlayCanvasBase);

export interface OverlaySnapPoint {
	chartPoint: { x: number; y: number };
	pixelPoint: { x: number; y: number };
}

export interface OverlayEndpointSnap extends OverlaySnapPoint {
	snapType: "endpoint";
}

interface ResolveMeasurementPointInput<TDatum> {
	plotData: readonly TDatum[];
	xAccessor: (datum: TDatum) => Date | number | undefined;
	dateValue: Date;
	priceValue: number;
}

interface MeasurementPointToPixelInput {
	point: MeasurementPoint;
	xScale: (value: Date) => number;
	yScale: (value: number) => number;
}

interface CanvasRenderOptions {
	chartWidth?: number;
	chartHeight?: number;
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function toDate(value: Date | number | undefined): Date {
	if (value instanceof Date) {
		return value;
	}

	return new Date(value ?? Number.NaN);
}

function distanceSquared(ax: number, ay: number, bx: number, by: number) {
	const dx = ax - bx;
	const dy = ay - by;
	return dx * dx + dy * dy;
}

function resolveDasharray(strokeDasharray?: OverlayCanvasStyle["strokeDasharray"]): number[] {
	if (Array.isArray(strokeDasharray)) {
		return [...strokeDasharray];
	}

	switch (strokeDasharray) {
		case "dashed":
			return [6, 4];
		case "dotted":
			return [2, 4];
		case "solid":
		case undefined:
		default:
			return [];
	}
}

function applyCanvasStyle(ctx: CanvasRenderingContext2D, style: OverlayCanvasStyle) {
	ctx.strokeStyle = style.stroke ?? "#2962ff";
	ctx.fillStyle = style.fill ?? style.stroke ?? "#2962ff";
	ctx.lineWidth = style.strokeWidth ?? 1;
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	ctx.globalAlpha = style.opacity ?? 1;
	ctx.setLineDash(resolveDasharray(style.strokeDasharray));
}

function drawLine(
	ctx: CanvasRenderingContext2D,
	start: { x: number; y: number },
	end: { x: number; y: number },
	style: OverlayCanvasStyle,
) {
	ctx.save();
	applyCanvasStyle(ctx, style);
	ctx.beginPath();
	ctx.moveTo(start.x, start.y);
	ctx.lineTo(end.x, end.y);
	ctx.stroke();
	ctx.restore();
}

function drawArrowHead(
	ctx: CanvasRenderingContext2D,
	start: { x: number; y: number },
	end: { x: number; y: number },
	style: OverlayCanvasStyle,
) {
	const angle = Math.atan2(end.y - start.y, end.x - start.x);
	const size = Math.max(8, (style.strokeWidth ?? 1) * 4);

	ctx.save();
	applyCanvasStyle(ctx, style);
	ctx.beginPath();
	ctx.moveTo(end.x, end.y);
	ctx.lineTo(end.x - Math.cos(angle - Math.PI / 6) * size, end.y - Math.sin(angle - Math.PI / 6) * size);
	ctx.lineTo(end.x - Math.cos(angle + Math.PI / 6) * size, end.y - Math.sin(angle + Math.PI / 6) * size);
	ctx.closePath();
	ctx.fillStyle = style.stroke ?? "#2962ff";
	ctx.fill();
	ctx.restore();
}

function drawRectangle(
	ctx: CanvasRenderingContext2D,
	start: { x: number; y: number },
	end: { x: number; y: number },
	style: OverlayCanvasStyle,
) {
	const left = Math.min(start.x, end.x);
	const top = Math.min(start.y, end.y);
	const width = Math.abs(end.x - start.x);
	const height = Math.abs(end.y - start.y);

	ctx.save();
	applyCanvasStyle(ctx, style);
	if (style.fill) {
		ctx.globalAlpha = style.fillOpacity ?? 0.12;
		ctx.fillRect(left, top, width, height);
		ctx.globalAlpha = style.opacity ?? 1;
	}
	ctx.strokeRect(left, top, width, height);
	ctx.restore();
}

function drawText(ctx: CanvasRenderingContext2D, point: { x: number; y: number }, style: OverlayCanvasStyle, text?: string) {
	ctx.save();
	ctx.globalAlpha = style.opacity ?? 1;
	ctx.fillStyle = style.fill ?? style.stroke ?? "#e2e8f0";
	ctx.font = `${style.fontSize ?? 12}px ${style.fontFamily ?? "Inter, system-ui, sans-serif"}`;
	ctx.textBaseline = "top";
	ctx.fillText(text ?? "", point.x, point.y);
	ctx.restore();
}

export function resolveMeasurementPointFromValues<TDatum>({
	plotData,
	xAccessor,
	dateValue,
	priceValue,
}: ResolveMeasurementPointInput<TDatum>): MeasurementPoint | undefined {
	if (!Array.isArray(plotData) || plotData.length === 0 || typeof xAccessor !== "function" || !isFiniteNumber(priceValue)) {
		return undefined;
	}

	let bestIndex = -1;
	let bestDate = new Date(Number.NaN);
	let bestDistance = Number.POSITIVE_INFINITY;
	const targetTime = dateValue.getTime();

	plotData.forEach((datum, index) => {
		const candidateDate = toDate(xAccessor(datum));
		const candidateTime = candidateDate.getTime();
		if (!Number.isFinite(candidateTime)) {
			return;
		}

		const distance = Math.abs(candidateTime - targetTime);
		if (distance < bestDistance) {
			bestDistance = distance;
			bestIndex = index;
			bestDate = candidateDate;
		}
	});

	if (bestIndex < 0 || !Number.isFinite(bestDate.getTime())) {
		return undefined;
	}

	return {
		index: bestIndex,
		date: bestDate,
		price: priceValue,
	};
}

export function measurementPointToPixelFromScales({ point, xScale, yScale }: MeasurementPointToPixelInput) {
	const x = xScale(point.date);
	const y = yScale(point.price);
	if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
		return undefined;
	}

	return { x, y };
}

export function summarizeMeasurement(selection: MeasurementSelection): MeasurementSummary {
	const priceDelta = selection.end.price - selection.start.price;
	return {
		bars: Math.abs(selection.end.index - selection.start.index),
		priceDelta,
		priceDeltaPercent: selection.start.price !== 0 ? priceDelta / selection.start.price : 0,
	};
}

export function findNearestOverlayEndpointSnap(
	mouseX: number,
	mouseY: number,
	candidates: readonly OverlaySnapPoint[],
	tolerance: number,
): OverlayEndpointSnap | null {
	const toleranceSquared = tolerance * tolerance;
	let bestMatch: OverlaySnapPoint | null = null;
	let bestDistance = Number.POSITIVE_INFINITY;

	for (const candidate of candidates) {
		const distance = distanceSquared(mouseX, mouseY, candidate.pixelPoint.x, candidate.pixelPoint.y);
		if (distance <= toleranceSquared && distance < bestDistance) {
			bestDistance = distance;
			bestMatch = candidate;
		}
	}

	return bestMatch ? { ...bestMatch, snapType: "endpoint" } : null;
}

export function resolveDrawingGroupMemberIds<TDrawing extends { id: string; groupId?: string }>(
	drawings: readonly TDrawing[],
	groupId: string,
) {
	return drawings.filter((drawing) => drawing.groupId === groupId).map((drawing) => drawing.id);
}

export function deleteDrawingGroup<TDrawing extends { groupId?: string }>(drawings: readonly TDrawing[], groupId: string) {
	return drawings.filter((drawing) => drawing.groupId !== groupId);
}

export function renderOverlayPrimitiveToCanvas(
	ctx: CanvasRenderingContext2D,
	primitive: OverlayCanvasPrimitive,
	options: CanvasRenderOptions = {},
) {
	const chartWidth = options.chartWidth ?? ctx.canvas.width;
	const chartHeight = options.chartHeight ?? ctx.canvas.height;
	const [start, end] = primitive.points;

	switch (primitive.type) {
		case "trendLine":
			if (start && end) {
				drawLine(ctx, start, end, primitive.style);
			}
			return;
		case "arrow":
			if (start && end) {
				drawLine(ctx, start, end, primitive.style);
				drawArrowHead(ctx, start, end, primitive.style);
			}
			return;
		case "hLine":
			if (start) {
				drawLine(ctx, { x: 0, y: start.y }, { x: chartWidth, y: start.y }, primitive.style);
			}
			return;
		case "vLine":
			if (start) {
				drawLine(ctx, { x: start.x, y: 0 }, { x: start.x, y: chartHeight }, primitive.style);
			}
			return;
		case "rectangle":
		case "dateAndPriceRange":
			if (start && end) {
				drawRectangle(ctx, start, end, primitive.style);
			}
			return;
		case "text":
			if (start) {
				drawText(ctx, start, primitive.style, primitive.text);
			}
			return;
		default:
			return;
	}
}