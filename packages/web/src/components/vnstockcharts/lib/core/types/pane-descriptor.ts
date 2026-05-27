export type SeriesTypeId =
	| "Candlestick"
	| "HollowCandle"
	| "OHLC"
	| "HeikinAshi"
	| "Line"
	| "Area"
	| "Bar"
	| "Volume"
	| "EMA"
	| "BollingerBand"
	| "RSI"
	| "MACD"
	| "CVDApprox"
	| "CVDRealtime"
	| "StrengthElder"
	| "StrengthRelative"
	| "Whale"
	// CE15 additions
	| "MA"
	| "BBI"
	| "SAR"
	| "OBV"
	| "WR"
	| "VR"
	// CE16 additions
	| "KDJ"
	| "CCI"
	| "DMI"
	| "BIAS"
	| "BRAR"
	| "MTM"
	| "EMV"
	| "AO"
	| "ROC"
	| "TRIX"
	| "DMA"
	| "PVT"
	| "PSY"
	| "CR";

export type YAxisSide = "left" | "right";

export interface SeriesConfig {
	id?: string;
	type: SeriesTypeId;
	params?: Record<string, unknown>;
	yAxis: YAxisSide;
	/** Optional explicit scale-slot id for native-style grouping. */
	scaleSlotId?: string;
	overlay?: boolean;
	color?: string;
	/** Per-component color overrides for multi-line indicators (MACD, BB, KDJ, …) */
	subColors?: Record<string, string>;
	visible?: boolean;  // undefined | true = render; false = hidden (soft-hide, data still computed)
}

export type TooltipMode = "ohlc" | "value" | "none";

export interface PaneDescriptor {
	id: string;
	label: string;
	pinned: boolean;
	visible: boolean;
	heightRatio: number;
	series: SeriesConfig[];
	splitScale: boolean;
	tooltip: TooltipMode;
}

export const PANE_LAYOUT_STORAGE_KEY = "rsc-pane-layout-v1";
export const PANE_MAX_VISIBLE = 5;

const LEGACY_SERIES_TYPE_ALIASES: Record<string, SeriesTypeId> = {
	BollingerBands: "BollingerBand",
	BuyStrength: "StrengthElder",
	InstitutionalStrength: "StrengthRelative",
};

export function normalizeSeriesTypeId(type: unknown): SeriesTypeId | null {
	if (typeof type !== "string" || type.length === 0) {
		return null;
	}

	return LEGACY_SERIES_TYPE_ALIASES[type] ?? (type as SeriesTypeId);
}

export const DEFAULT_PANES: PaneDescriptor[] = [
	// ── 1: PRICE — pinned, always visible ────────────────────────────────────
	{
		id: "price",
		label: "Price",
		pinned: true,
		visible: true,
		heightRatio: 0.50,
		splitScale: false,
		tooltip: "ohlc",
		series: [
			{ type: "Candlestick", yAxis: "right" },
			{ type: "EMA", params: { period: 20, color: "#2d9cdb" }, yAxis: "right", overlay: true },
			{ type: "EMA", params: { period: 50, color: "#f2994a" }, yAxis: "right", overlay: true },
			{ type: "BollingerBand", params: { period: 20, stdDev: 2 }, yAxis: "right", overlay: true },
		],
	},
	// ── 2: VOLUME — visible by default ───────────────────────────────────────
	{
		id: "volume",
		label: "Volume",
		pinned: false,
		visible: true,
		heightRatio: 0.22,
		splitScale: false,
		tooltip: "value",
		series: [
			{ type: "Volume", yAxis: "right" },
		],
	},
	// ── 3: MOMENTUM (RSI + MACD) — visible by default ────────────────────────
	{
		id: "momentum",
		label: "RSI+MACD",
		pinned: false,
		visible: true,
		heightRatio: 0.28,
		splitScale: true,
		tooltip: "value",
		series: [
			{ type: "RSI", params: { period: 14 }, yAxis: "left", scaleSlotId: "momentum-left" },
			{ type: "MACD", params: { fast: 12, slow: 26, signal: 9 }, yAxis: "right", scaleSlotId: "momentum-right" },
		],
	},
	// ── 4: ORDER FLOW — hidden by default, enable via Panes menu ─────────────
	{
		id: "orderflow",
		label: "Order Flow",
		pinned: false,
		visible: false,
		heightRatio: 0.20,
		splitScale: false,
		tooltip: "value",
		series: [
			{ type: "Whale", params: { threshold: 50_000 }, yAxis: "right" },
			{ type: "CVDApprox", yAxis: "right" },
		],
	},
	// ── 5: STRENGTH — hidden by default, enable via Panes menu ───────────────
	{
		id: "strength",
		label: "Strength",
		pinned: false,
		visible: false,
		heightRatio: 0.18,
		splitScale: true,
		tooltip: "value",
		series: [
			{ type: "StrengthElder", yAxis: "left", scaleSlotId: "strength-left" },
			{ type: "StrengthRelative", yAxis: "right", scaleSlotId: "strength-right" },
		],
	},
];

const DEFAULT_PANE_ID_SET = new Set(DEFAULT_PANES.map((pane) => pane.id));

export function isDefaultPaneId(id: string): boolean {
	return DEFAULT_PANE_ID_SET.has(id);
}
