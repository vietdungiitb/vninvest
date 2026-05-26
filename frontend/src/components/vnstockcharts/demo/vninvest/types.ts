/**
 * OB-M02 — VNInvest TypeScript type definitions
 * Source: react-stockcharts-master backport
 */

export interface TechnicalIndicators {
	bias?: number;
	rsi14?: number;
	sma20?: number;
	sma50?: number;
	sma200?: number;
	ema9?: number;
	ema21?: number;
	macd?: number;
	macd_signal?: number;
	macd_histogram?: number;
	atr_14?: number;
	bb_upper?: number;
	bb_middle?: number;
	bb_lower?: number;
	volume_sma20?: number;
}

export interface ChartPoint {
	/** ISO 8601 date string */
	date: string;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
}

export interface ChartResponse {
	symbol: string;
	days: number;
	timeframe: string;
	points: ChartPoint[];
	technical?: TechnicalIndicators;
}

export interface StockItem {
	symbol: string;
	company_name: string;
	exchange: string;
	sector?: string;
}

export interface TickerResponse {
	symbol: string;
	current_price: number;
	change_pct: number;
	volume: number;
	market_phase: string;
}

export type WhaleSizeClass = "small" | "shark" | "whale";
export type WhaleSide = "buy" | "sell";

export interface WhaleOrder {
	/** ISO 8601 timestamp string */
	ts: string;
	price: number;
	volume: number;
	matched_value: number;
	side: WhaleSide;
	size_class: WhaleSizeClass;
}

export interface WhaleOrderSummary {
	buy_value: number;
	sell_value: number;
	shark_buy: number;
	shark_sell: number;
	whale_buy: number;
	whale_sell: number;
	small_buy: number;
	small_sell: number;
}

export interface WhaleFeedResponse {
	symbol: string;
	whale_orders: WhaleOrder[];
	summary: WhaleOrderSummary;
}

export interface IntradayTrade {
	/** HH:MM:SS time string */
	time: string;
	price: number;
	volume: number;
	side: WhaleSide;
}

export interface IntradayResponse {
	symbol: string;
	trades: IntradayTrade[];
}

export interface APIError {
	detail: string;
}

// ── Order Flow / CVD / Dark Flow ─────────────────────────────────────────────

/** One intraday CVD bucket from compute_cvd_series. */
export interface CVDPoint {
	/** ISO 8601 datetime — today + bucket start time. */
	bucket_ts: string;
	buy_value: number;
	sell_value: number;
	/** Net delta for this bucket (buy_value - sell_value). */
	cvd: number;
	/** Running cumulative delta from session start. */
	cumulative_cvd: number;
}

export type DarkFlowSignalType = "none" | "absorption" | "iceberg" | "twap_bot" | "mixed";

/** Dark flow strength result from detect_dark_flow. */
export interface DarkFlowResult {
	signal_type: DarkFlowSignalType;
	/** 0–100 composite strength score. */
	strength: number;
	/** 0–1 confidence. */
	confidence: number;
	components?: Record<string, unknown>;
	triggered_at?: string | null;
}

export interface OrderFlowSignal {
	id: number;
	symbol: string;
	signal_type: string;
	strength: number;
	confidence: number;
	tick_rate: number;
	small_order_ratio: number;
	cvd_at_signal: number | null;
	price_at_signal: number | null;
	created_at: string;
	event_id: string | null;
	severity: string;
}

/** Response from GET /api/stock-management/stocks/<symbol>/order-flow/. */
export interface OrderFlowResponse {
	ok: boolean;
	symbol: string;
	window: string;
	window_minutes: number;
	latest_signal: OrderFlowSignal | null;
	signals: OrderFlowSignal[];
	cvd_series: CVDPoint[];
	dark_flow: DarkFlowResult;
	tick_rate: Record<string, unknown>;
	size_distribution: Record<string, unknown>;
}

/** Raw API chart point before normalization — fields may be null. */
export interface NullableChartPoint {
	/** ISO 8601 date string */
	date: string;
	open: number | null;
	high: number | null;
	low: number | null;
	close: number | null;
	volume: number | null;
}

export interface RawOHLCVBar {
	date: Date;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
	technical?: Partial<TechnicalIndicators>;
}
