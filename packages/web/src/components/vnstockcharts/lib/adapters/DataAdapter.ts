/**
 * CE20: DataAdapter abstraction for demo data fetching.
 *
 * This is intentionally separate from `StockDataAdapter` (used by VNStockChart for
 * chart rendering). `DataAdapter` handles historical bar loading for the demo shell.
 */

/** A single OHLCV bar with a Unix-ms timestamp. */
export interface KLineBar {
	timestamp: number;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
}

/** Whether we are fetching the initial set, newer bars, or older bars. */
export type GetBarsType = "init" | "forward" | "backward";

export interface GetBarsParams {
	type: GetBarsType;
	symbol: string;
	interval: string;
	/**
	 * Anchor timestamp (ms).
	 * - "init"/"forward": unused (pass null)
	 * - "backward": fetch bars whose close time is strictly before this value
	 */
	timestamp: number | null;
	limit: number;
	signal?: AbortSignal;
}

export interface GetBarsResult {
	bars: KLineBar[];
	/** true when the source may have more bars further back */
	hasMore: boolean;
}

export interface DataAdapter {
	readonly name: string;
	getBars(params: GetBarsParams): Promise<GetBarsResult>;
}
