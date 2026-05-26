import { deserializeDrawings, serializeDrawings } from "./serialization";
import type { DrawingObject, DrawingStyle, DrawingToolType, FibLevelConfig, Point, DrawingAlertCondition, DrawingAlertDirection, HarmonicRatioConfig, CycleParams } from "./types";

const DRAWING_TOOL_TYPES: DrawingToolType[] = [
	"trendLine",
	"hLine",
	"vLine",
	"fibonacci",
	"channel",
	"text",
	"rectangle",
	"arrow",
	"ray",
	"extendedLine",
	"polyline",
	"dateAndPriceRange",
	"longPosition",
	"shortPosition",
	"fibExtension",
	"parallelChannel",
	"pitchfork",
	"abcdPattern",
	"fibArc",
	"fibTimeZone",
	"regressionChannel",
	"gannFan",
	"elliottImpulse",
	"elliottCorrection",
	"elliottTriangle",
	"elliottDoubleCombo",
	"elliottTripleCombo",
	"xabcdPattern",
	"cypherPattern",
	"headAndShoulders",
	"trianglePattern",
	"threeDrivesPattern",
	// DT-13: Extended Fibonacci
	"fibChannel",
	"fibSpeedResistanceFan",
	"trendBasedFibTime",
	"fibCircles",
	"fibSpiral",
	"fibSpeedResistanceArcs",
	"fibWedge",
	"pitchfan",
	// DT-14: Gann Advanced
	"gannBox",
	"gannSquareFixed",
	"gannSquare",
	// DT-15: Cycle Tools
	"cyclicLines",
	"timeCycles",
	"sineLine",
];

export class DrawingImportError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "DrawingImportError";
	}
}

export interface DrawingStorageAdapter {
	save(symbol: string, timeframe: string, drawings: DrawingObject[]): void;
	load(symbol: string, timeframe: string): DrawingObject[];
	clear(symbol: string, timeframe: string): void;
	exportJSON(drawings: readonly DrawingObject[]): string;
	importJSON(payload: string): DrawingObject[];
}

function getStorage() {
	if (typeof globalThis === "undefined" || typeof globalThis.localStorage === "undefined") {
		throw new Error("localStorage is not available in this environment");
	}
	return globalThis.localStorage;
}

function getStorageKey(symbol: string, timeframe: string) {
	return `rsc-drawings-v1-${symbol}-${timeframe}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isPoint(value: unknown): value is Point {
	return isRecord(value) && typeof value.x === "number" && Number.isFinite(value.x) && typeof value.y === "number" && Number.isFinite(value.y);
}

function isStyle(value: unknown): value is DrawingStyle {
	return isRecord(value) && typeof value.stroke === "string" && typeof value.strokeWidth === "number";
}

function isFibLevelConfig(value: unknown): value is FibLevelConfig {
	return isRecord(value)
		&& typeof value.ratio === "number" && Number.isFinite(value.ratio)
		&& typeof value.visible === "boolean";
}

/** DT-12: Safely parse harmonic ratio config. */
function isHarmonicRatioConfig(value: unknown): value is HarmonicRatioConfig {
	return isRecord(value) && Array.isArray(value.ratioLabels)
		&& value.ratioLabels.every((r: unknown) => typeof r === "string");
}

/** DT-15: Safely parse cycle params. */
function isCycleParams(value: unknown): value is CycleParams {
	return isRecord(value) && typeof value.count === "number" && Number.isFinite(value.count);
}

/** DT-10-T10: Safely parse alert condition from deserialized JSON. */
function parseAlertCondition(value: unknown): DrawingAlertCondition | undefined {
	if (!isRecord(value)) return undefined;
	const validDirections: DrawingAlertDirection[] = ["crossAbove", "crossBelow", "either"];
	const direction = validDirections.includes(value.direction as DrawingAlertDirection)
		? (value.direction as DrawingAlertDirection)
		: "either";
	const enabled = typeof value.enabled === "boolean" ? value.enabled : false;
	const cooldownMs = typeof value.cooldownMs === "number" && Number.isFinite(value.cooldownMs) && value.cooldownMs > 0
		? value.cooldownMs
		: undefined;
	const triggeredAt = typeof value.triggeredAt === "number" && Number.isFinite(value.triggeredAt)
		? value.triggeredAt
		: undefined;
	return { direction, enabled, cooldownMs, triggeredAt };
}

/**
 * Migrate legacy `fibLevels: number[]` to `fibLevelConfigs: FibLevelConfig[]`.
 * Returns `fibLevelConfigs` if already present, converts from fibLevels otherwise.
 * Returns undefined when neither field exists.
 */
function migrateFibLevelConfigs(value: Record<string, unknown>): FibLevelConfig[] | undefined {
	if (Array.isArray(value.fibLevelConfigs)) {
		const parsed = value.fibLevelConfigs.filter(isFibLevelConfig);
		return parsed.length > 0 ? parsed : undefined;
	}
	if (Array.isArray(value.fibLevels)) {
		const converted = value.fibLevels
			.filter((item): item is number => typeof item === "number" && Number.isFinite(item))
			.map((ratio): FibLevelConfig => ({ ratio, visible: true }));
		return converted.length > 0 ? converted : undefined;
	}
	return undefined;
}

function isRiskReward(value: unknown): value is NonNullable<DrawingObject["riskReward"]> {
	return isRecord(value)
		&& typeof value.entry === "number" && Number.isFinite(value.entry)
		&& typeof value.stop === "number" && Number.isFinite(value.stop)
		&& typeof value.target === "number" && Number.isFinite(value.target)
		&& (typeof value.quantity === "undefined" || (typeof value.quantity === "number" && Number.isFinite(value.quantity)));
}

function normalizeDasharray(value: unknown): DrawingStyle["strokeDasharray"] {
	if (typeof value !== "string") {
		return undefined;
	}
	const normalized = value.toLowerCase();
	if (normalized === "solid" || normalized === "dashed" || normalized === "dotted") {
		return normalized;
	}
	return undefined;
}

function isDrawingType(value: unknown): value is DrawingToolType {
	return typeof value === "string" && DRAWING_TOOL_TYPES.includes(value as DrawingToolType);
}

function normalizeDrawingObject(value: unknown, index: number): DrawingObject {
	if (!isRecord(value)) {
		throw new DrawingImportError(`Drawing[${index}] must be an object`);
	}
	if (typeof value.id !== "string" || value.id.length === 0) {
		throw new DrawingImportError(`Drawing[${index}].id must be a non-empty string`);
	}
	if (!isDrawingType(value.type)) {
		throw new DrawingImportError(`Drawing[${index}].type is invalid`);
	}
	if (!Array.isArray(value.points) || value.points.some((point) => !isPoint(point))) {
		throw new DrawingImportError(`Drawing[${index}].points must be an array of points`);
	}
	if (!isStyle(value.style)) {
		throw new DrawingImportError(`Drawing[${index}].style must include stroke and strokeWidth`);
	}

	const createdAt = typeof value.createdAt === "number" && Number.isFinite(value.createdAt) ? value.createdAt : Date.now();
	const updatedAt = typeof value.updatedAt === "number" && Number.isFinite(value.updatedAt) ? value.updatedAt : createdAt;
	const style: DrawingStyle = {
		stroke: value.style.stroke,
		strokeWidth: value.style.strokeWidth,
		strokeDasharray: normalizeDasharray(value.style.strokeDasharray),
		fill: typeof value.style.fill === "string" ? value.style.fill : undefined,
		fillOpacity: typeof value.style.fillOpacity === "number" && Number.isFinite(value.style.fillOpacity) ? value.style.fillOpacity : undefined,
		opacity: typeof value.style.opacity === "number" && Number.isFinite(value.style.opacity) ? value.style.opacity : undefined,
		fontSize: typeof value.style.fontSize === "number" && Number.isFinite(value.style.fontSize) ? value.style.fontSize : undefined,
		fontFamily: typeof value.style.fontFamily === "string" ? value.style.fontFamily : undefined,
	};

	return {
		id: value.id,
		type: value.type,
		points: value.points.map((point) => ({ x: point.x, y: point.y })),
		style,
		paneId: typeof value.paneId === "string" && value.paneId.length > 0 ? value.paneId : undefined,
		yScaleId: typeof value.yScaleId === "string" && value.yScaleId.length > 0 ? value.yScaleId : undefined,
		text: typeof value.text === "string" ? value.text : undefined,
		fibLevels: Array.isArray(value.fibLevels) ? value.fibLevels.filter((item): item is number => typeof item === "number" && Number.isFinite(item)) : undefined,
		fibLevelConfigs: migrateFibLevelConfigs(value),
		label: typeof value.label === "string" ? value.label : undefined,
		symbol: typeof value.symbol === "string" ? value.symbol : undefined,
		timeframe: typeof value.timeframe === "string" ? value.timeframe : undefined,
		zIndex: typeof value.zIndex === "number" && Number.isFinite(value.zIndex) ? value.zIndex : undefined,
		clonedFrom: typeof value.clonedFrom === "string" ? value.clonedFrom : undefined,
		riskReward: isRiskReward(value.riskReward)
			? {
				entry: value.riskReward.entry,
				stop: value.riskReward.stop,
				target: value.riskReward.target,
				quantity: value.riskReward.quantity,
			}
			: undefined,
		extendLeft: typeof value.extendLeft === "boolean" ? value.extendLeft : undefined,
		extendRight: typeof value.extendRight === "boolean" ? value.extendRight : undefined,
		locked: typeof value.locked === "boolean" ? value.locked : undefined,
		visible: typeof value.visible === "boolean" ? value.visible : undefined,
		alertCondition: parseAlertCondition(value.alertCondition),
		waveLabels: Array.isArray(value.waveLabels)
			? value.waveLabels.filter((item): item is string => typeof item === "string")
			: undefined,
		harmonicRatios: isHarmonicRatioConfig(value.harmonicRatios) ? value.harmonicRatios : undefined,
		gannSquareSize: typeof value.gannSquareSize === "number" && Number.isFinite(value.gannSquareSize) ? value.gannSquareSize : undefined,
		cycleParams: isCycleParams(value.cycleParams) ? value.cycleParams : undefined,
		createdAt,
		updatedAt,
	};
}

function normalizeDrawings(payload: unknown): DrawingObject[] {
	if (!Array.isArray(payload)) {
		throw new DrawingImportError("Drawing payload must be an array");
	}
	return payload.map((item, index) => normalizeDrawingObject(item, index));
}

export function createLocalStorageAdapter(): DrawingStorageAdapter {
	return {
		save(symbol, timeframe, drawings) {
			getStorage().setItem(getStorageKey(symbol, timeframe), serializeDrawings(drawings));
		},
		load(symbol, timeframe) {
			const raw = getStorage().getItem(getStorageKey(symbol, timeframe));
			if (!raw) {
				return [];
			}
			try {
				return normalizeDrawings(deserializeDrawings(raw));
			} catch (error) {
				if (error instanceof DrawingImportError) {
					getStorage().removeItem(getStorageKey(symbol, timeframe));
					console.warn(`Ignoring invalid drawing cache for ${symbol}/${timeframe}:`, error.message);
					return [];
				}
				return [];
			}
		},
		clear(symbol, timeframe) {
			getStorage().removeItem(getStorageKey(symbol, timeframe));
		},
		exportJSON(drawings) {
			return serializeDrawings(drawings);
		},
		importJSON(payload) {
			try {
				return normalizeDrawings(deserializeDrawings(payload));
			} catch (error) {
				if (error instanceof DrawingImportError) {
					throw error;
				}
				throw new DrawingImportError(error instanceof Error ? error.message : "Invalid drawing JSON payload");
			}
		},
	};
}
