import type React from "react";

export type Point = Readonly<{
	x: number;
	y: number;
}>;

export type DrawingToolType =
	| "trendLine"
	| "hLine"
	| "vLine"
	| "fibonacci"
	| "channel"
	| "text"
	| "rectangle"
	| "arrow"
	| "ray"
	| "extendedLine"
	| "polyline"
	| "dateAndPriceRange"
	| "longPosition"
	| "shortPosition"
	| "fibExtension"
	| "parallelChannel"
	| "pitchfork"
	| "abcdPattern"
	| "fibArc"
	| "fibTimeZone"
	| "regressionChannel"
	| "gannFan"
	| "elliottImpulse"
	| "elliottCorrection"
	| "elliottTriangle"
	| "elliottDoubleCombo"
	| "elliottTripleCombo"
	| "xabcdPattern"
	| "cypherPattern"
	| "headAndShoulders"
	| "trianglePattern"
	| "threeDrivesPattern"
	// DT-13: Extended Fibonacci
	| "fibChannel"
	| "fibSpeedResistanceFan"
	| "trendBasedFibTime"
	| "fibCircles"
	| "fibSpiral"
	| "fibSpeedResistanceArcs"
	| "fibWedge"
	| "pitchfan"
	// DT-14: Gann Advanced
	| "gannBox"
	| "gannSquareFixed"
	| "gannSquare"
	// DT-15: Cycle Tools
	| "cyclicLines"
	| "timeCycles"
	| "sineLine";

/** CE21-DT1: Action handle types rendered on selected drawings for delete / clone / lock operations. */
export type DrawingHandleType = "delete" | "clone" | "lock";

export interface DrawingStyle {
	stroke: string;
	strokeWidth: number;
	strokeDasharray?: "solid" | "dashed" | "dotted";
	fill?: string;
	fillOpacity?: number;
	opacity?: number;
	fontSize?: number;
	fontFamily?: string;
}

/** Per-level configuration for Fibonacci drawings (DT-7). */
export interface FibLevelConfig {
	/** Fibonacci ratio, e.g. 0.382 */
	ratio: number;
	/** Whether this level is rendered */
	visible: boolean;
	/** Per-level stroke color override; falls back to drawing.style.stroke when absent */
	color?: string;
}

export interface DrawingObject {
	id: string;
	type: DrawingToolType;
	points: Point[];
	style: DrawingStyle;
	paneId?: string;
	yScaleId?: string;
	text?: string;
	fibLevels?: number[];
	/** Per-level Fibonacci configuration (DT-7); supersedes fibLevels when present */
	fibLevelConfigs?: FibLevelConfig[];
	label?: string;
	symbol?: string;
	timeframe?: string;
	zIndex?: number;
	clonedFrom?: string;
	groupId?: string;
	riskReward?: { entry: number; stop: number; target: number; quantity?: number };
	extendLeft?: boolean;
	extendRight?: boolean;
	locked?: boolean;
	visible?: boolean;
	/** DT-10-T02: Alert condition — fires onDrawingAlert when price crosses drawing reference level */
	alertCondition?: DrawingAlertCondition;
	/** DT-11: Custom wave-point labels; overrides ELLIOTT_LABELS defaults when set */
	waveLabels?: string[];
	/** DT-12: Harmonic pattern ratio validation config */
	harmonicRatios?: HarmonicRatioConfig;
	/** DT-14: Gann square fixed size in price units */
	gannSquareSize?: number;
	/** DT-15: Cycle tool parameters (count, amplitude) */
	cycleParams?: CycleParams;
	createdAt: number;
	updatedAt: number;
}

export interface DrawingToolDefinition {
	name: DrawingToolType;
	createDraft: (startPoint: Point) => DrawingObject;
	updateDraft: (draft: DrawingObject, nextPoint: Point) => DrawingObject;
	render?: (ctx: CanvasRenderingContext2D, object: DrawingObject) => void;
}

/** DT-10-T01: Alert condition for a drawing — fires when price crosses a reference level. */
export type DrawingAlertDirection = "crossAbove" | "crossBelow" | "either";

export interface DrawingAlertCondition {
	/** Direction of the price cross that triggers the alert */
	direction: DrawingAlertDirection;
	/** Cooldown in milliseconds after firing before the alert can fire again (default: 60000) */
	cooldownMs?: number;
	/** Timestamp (ms) of the last time this alert fired; managed by the engine */
	triggeredAt?: number;
	/** Whether the alert is currently active */
	enabled: boolean;
}

/** DT-12: Harmonic pattern ratio labels and optional validation bounds. */
export interface HarmonicRatioConfig {
	/** e.g. ["XA","AB","BC","CD"] */
	ratioLabels: string[];
	/** [[min, max]] per leg, optional; used only for display, not enforced */
	targetRatios?: number[][];
}

/** DT-15: Cycle tool parameters. */
export interface CycleParams {
	/** How many cycle repetitions to render (default 8) */
	count: number;
	/** Amplitude in price units for sineLine */
	amplitude?: number;
}

/** CE19-01: Public plugin API for registering custom drawing tools from outside the library. */
export interface DrawingPluginDefinition {
	type: string;
	labelKey: string;
	iconKey?: string;
	defaultParams?: Record<string, unknown>;
	onStart(params: {
		paneId: string;
		xValue: number;
		yValue: number;
		pixelX: number;
		pixelY: number;
	}): Omit<DrawingObject, "id" | "createdAt" | "updatedAt">;
	onUpdate?(
		drawing: DrawingObject,
		params: { xValue: number; yValue: number; pixelX: number; pixelY: number },
	): Partial<DrawingObject>;
	onFinish?(drawing: DrawingObject): DrawingObject;
	render(props: {
		drawing: DrawingObject;
		xScale: (v: number) => number;
		yScale: (v: number) => number;
		isSelected: boolean;
	}): React.ReactElement | null;
	hitTest(
		drawing: DrawingObject,
		point: { pixelX: number; pixelY: number },
		xScale: (v: number) => number,
		yScale: (v: number) => number,
		tolerance: number,
	): boolean;
}