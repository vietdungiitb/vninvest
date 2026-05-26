/**
 * OB-M02 — VNInvestClient
 * HTTP client for the VNInvest REST API with PAT Bearer authentication.
 * No React dependency — safe to use in non-component contexts.
 */

import type {
	ChartPoint,
	ChartResponse,
	StockItem,
	WhaleFeedResponse,
	RawOHLCVBar,
	OrderFlowResponse,
} from "../vninvest/types";

const PAT_STORAGE_KEY = "vni_pat";
const API_BASE_STORAGE_KEY = "vni_api_base";
const DEFAULT_API_BASE = "http://127.0.0.1";

function normalizeApiBase(value: string): string {
	const trimmed = value.trim();
	return trimmed.replace(/\/+$/, "");
}

/** Resolve API base URL (priority: global override → localStorage → current origin → default). */
export function resolveApiBase(): string {
	try {
		const globalScope = globalThis as typeof globalThis & { __VNI_API_BASE__?: string };
		if (typeof globalScope.__VNI_API_BASE__ === "string") {
			return normalizeApiBase(globalScope.__VNI_API_BASE__);
		}
	} catch { /* ignore */ }

	try {
		if (typeof localStorage !== "undefined") {
			const stored = localStorage.getItem(API_BASE_STORAGE_KEY);
			if (stored) return normalizeApiBase(stored);
		}
	} catch { /* ignore */ }

	try {
		if (typeof location !== "undefined") {
			return normalizeApiBase(location.origin);
		}
	} catch { /* ignore */ }

	return DEFAULT_API_BASE;
}

/** Map of common timeframe aliases to VNInvest canonical formats. */
export const TIMEFRAME_MAP: Record<string, string> = {
	"1m": "1m",
	"5m": "5m",
	"15m": "15m",
	"1h": "1H",
	"1H": "1H",
	"2H": "2H",
	"4H": "4H",
	"1d": "D",
	"1D": "D",
	"d": "D",
	"D": "D",
	"W": "W",
	"M": "M",
	"Y": "Y",
};

function normalizeTimeframe(tf: string): string {
	return TIMEFRAME_MAP[tf] ?? tf;
}

function asObject(value: unknown): Record<string, unknown> | null {
	if (value && typeof value === "object" && !Array.isArray(value)) {
		return value as Record<string, unknown>;
	}
	return null;
}

function asNumber(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === "string") {
		const parsed = Number(value.trim());
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}

function parseDateValue(value: string | number): Date {
	if (typeof value === "number") {
		// Accept Unix seconds (10 digits) and milliseconds (13 digits).
		if (value > 0 && value < 1e12) {
			return new Date(value * 1000);
		}
		return new Date(value);
	}

	const numeric = Number(value.trim());
	if (Number.isFinite(numeric)) {
		if (numeric > 0 && numeric < 1e12) {
			return new Date(numeric * 1000);
		}
		return new Date(numeric);
	}

	return new Date(value);
}

function normalizeChartPoint(value: unknown): ChartPoint | null {
	const point = asObject(value);
	if (!point) {
		return null;
	}

	const dateRaw = point.date ?? point.timestamp ?? point.time ?? point.t;
	const open = asNumber(point.open ?? point.o);
	const high = asNumber(point.high ?? point.h);
	const low = asNumber(point.low ?? point.l);
	const close = asNumber(point.close ?? point.c);
	const volume = asNumber(point.volume ?? point.v);

	if ((typeof dateRaw !== "string" && typeof dateRaw !== "number") || open === null || high === null || low === null || close === null || volume === null) {
		return null;
	}

	const dateValue = parseDateValue(dateRaw);
	if (!Number.isFinite(dateValue.valueOf())) {
		return null;
	}

	return {
		date: dateValue.toISOString(),
		open,
		high,
		low,
		close,
		volume,
	};
}

function extractChartPoints(data: unknown): ChartPoint[] {
	if (Array.isArray(data)) {
		return data.map(normalizeChartPoint).filter((point): point is ChartPoint => point !== null);
	}

	const payload = asObject(data);
	if (!payload) {
		return [];
	}

	const nestedData = asObject(payload.data);
	const candidates: unknown[] = [
		payload.points,
		nestedData?.points,
		payload.candles,
		nestedData?.candles,
		payload.ohlcv,
		nestedData?.ohlcv,
		payload.results,
		nestedData?.results,
		payload.data,
	];

	for (const candidate of candidates) {
		if (!Array.isArray(candidate)) {
			continue;
		}
		const normalized = candidate
			.map(normalizeChartPoint)
			.filter((point): point is ChartPoint => point !== null);
		if (normalized.length > 0 || candidate.length === 0) {
			return normalized;
		}
	}

	return [];
}

function resolveTechnical(data: unknown): ChartResponse["technical"] | undefined {
	if (Array.isArray(data)) {
		return undefined;
	}
	const payload = asObject(data);
	if (!payload) {
		return undefined;
	}
	const nestedData = asObject(payload.data);
	const technical = (payload.technical ?? nestedData?.technical) as ChartResponse["technical"] | undefined;
	return technical;
}

function normalizeChartBars(data: unknown): RawOHLCVBar[] {
	const points = extractChartPoints(data);
	const technical = resolveTechnical(data);

	return points
		.map((point) => ({
			date: new Date(point.date),
			open: point.open,
			high: point.high,
			low: point.low,
			close: point.close,
			volume: point.volume,
			technical,
		}))
		.filter((bar) => Number.isFinite(bar.date.valueOf()));
}

function isWhaleFeedResponse(data: unknown): data is WhaleFeedResponse {
	if (!data || Array.isArray(data) || typeof data !== "object") {
		return false;
	}

	return "summary" in data && "whale_orders" in data;
}

function buildEndpoints(base: string) {
	return {
		CHART: (symbol: string) => `${base}/api/stock-management/stocks/${encodeURIComponent(symbol)}/chart/`,
		BARS: (symbol: string) => `${base}/api/stock-management/stocks/${encodeURIComponent(symbol)}/bars/`,
		ORDER_FLOW: (symbol: string) => `${base}/api/stock-management/stocks/${encodeURIComponent(symbol)}/order-flow/`,
		STOCKS_LIST: `${base}/api/stock-management/stocks/`,
		AUTH_TOKEN: `${base}/api/auth/token/`,
		TICKER: (symbol: string) => `${base}/api/realtime/ticker/${encodeURIComponent(symbol)}/`,
		WHALE_FEED: (symbol: string) => `${base}/api/realtime/whale-feed/${encodeURIComponent(symbol)}/`,
	};
}

/** Parameters for the cursor-paged /bars/ endpoint. */
export type VNIBarsParams =
	| { type: "init"; symbol: string; timeframe: string; from?: number; to?: number; limit?: number }
	| { type: "backward"; symbol: string; timeframe: string; before: number; limit: number; snapshotId?: string };

/** Response from the cursor-paged /bars/ endpoint. */
export interface VNIBarsPageResponse {
	bars: RawOHLCVBar[];
	hasMoreBefore: boolean;
	hasMoreAfter: boolean;
	nextBefore: number | null;
	snapshotId: string | null;
}

export class VNInvestClient {
	private _pat: string = "";
	private _base: string;

	constructor(patToken?: string) {
		this._base = resolveApiBase();
		// Load persisted PAT on construction
		try {
			if (typeof localStorage !== "undefined") {
				this._pat = localStorage.getItem(PAT_STORAGE_KEY) ?? "";
			}
		} catch { /* ignore */ }
		if (patToken) {
			this.setPAT(patToken);
		}
	}

	/**
	 * Validate and persist a PAT token.
	 * Never logs the token value.
	 */
	setPAT(token: string): void {
		const trimmed = (token ?? "").trim();
		if (!trimmed) {
			this._pat = "";
			try {
				if (typeof localStorage !== "undefined") {
					localStorage.removeItem(PAT_STORAGE_KEY);
				}
			} catch { /* ignore */ }
			return;
		}
		this._pat = trimmed;
		try {
			if (typeof localStorage !== "undefined") {
				localStorage.setItem(PAT_STORAGE_KEY, trimmed);
			}
		} catch { /* ignore */ }
	}

	getPAT(): string {
		return this._pat;
	}

	/** Update API base URL at runtime and persist to localStorage. */
	setBase(url: string): void {
		const trimmed = (url ?? "").trim().replace(/\/+$/, "");
		if (!trimmed) return;
		this._base = trimmed;
		try {
			if (typeof localStorage !== "undefined") {
				localStorage.setItem(API_BASE_STORAGE_KEY, trimmed);
			}
		} catch { /* ignore */ }
	}

	getBase(): string {
		return this._base;
	}

	hasPAT(): boolean {
		return this._pat.length > 0;
	}

	private buildHeaders(): HeadersInit {
		const headers: Record<string, string> = { "Content-Type": "application/json" };
		if (this._pat) {
			headers["Authorization"] = `Bearer ${this._pat}`;
		}
		return headers;
	}

	private async _fetch<T>(url: string, init?: RequestInit): Promise<T> {
		const response = await fetch(url, { ...init, headers: this.buildHeaders() });
		if (response.status === 401) {
			throw new Error("TOKEN_EXPIRED");
		}
		if (response.status === 404) {
			throw new Error("SYMBOL_NOT_FOUND");
		}
		if (!response.ok) {
			const text = await response.text().catch(() => String(response.status));
			throw new Error(`HTTP_${response.status}: ${text.slice(0, 200)}`);
		}
		return response.json() as Promise<T>;
	}

	/** Fetch OHLCV bars from VNInvest chart endpoint. */
	async getChart(
		symbol: string,
		options?: { timeframe?: string; days?: number },
	): Promise<RawOHLCVBar[]> {
		const endpoints = buildEndpoints(this._base);
		const params = new URLSearchParams();
		if (options?.timeframe) params.set("timeframe", normalizeTimeframe(options.timeframe));
		if (options?.days != null) params.set("days", String(options.days));

		const url = `${endpoints.CHART(symbol)}?${params.toString()}`;
		const data = await this._fetch<unknown>(url);

		return normalizeChartBars(data);
	}

	/**
	 * Fetch a page of OHLCV bars from the cursor-paged /bars/ endpoint.
	 * For `type: "init"` pass optional `from`/`to` (unix ms) to bound the initial window.
	 * For `type: "backward"` pass the `before` anchor (unix ms of oldest loaded bar).
	 */
	async getBarsPage(params: VNIBarsParams): Promise<VNIBarsPageResponse> {
		const endpoints = buildEndpoints(this._base);
		const urlParams = new URLSearchParams();
		urlParams.set("timeframe", normalizeTimeframe(params.timeframe));

		if (params.type === "backward") {
			urlParams.set("before", String(params.before));
			urlParams.set("limit", String(params.limit));
			if (params.snapshotId) urlParams.set("snapshot_id", params.snapshotId);
		} else {
			if (params.from != null) urlParams.set("from", String(params.from));
			if (params.to != null) urlParams.set("to", String(params.to));
			if (params.limit != null) urlParams.set("limit", String(params.limit));
		}

		const url = `${endpoints.BARS(params.symbol)}?${urlParams.toString()}`;
		const data = await this._fetch<unknown>(url);
		const payload = data as Record<string, unknown>;
		const rawBars = Array.isArray(payload?.bars) ? (payload.bars as unknown[]) : [];
		const bars: RawOHLCVBar[] = rawBars
			.map(normalizeChartPoint)
			.filter((p): p is ChartPoint => p !== null)
			.map((point) => ({
				date: new Date(point.date),
				open: point.open,
				high: point.high,
				low: point.low,
				close: point.close,
				volume: point.volume,
			}))
			.filter((bar) => Number.isFinite(bar.date.valueOf()));

		return {
			bars,
			hasMoreBefore: Boolean(payload?.has_more_before),
			hasMoreAfter: Boolean(payload?.has_more_after),
			nextBefore: typeof payload?.next_before === "number" ? (payload.next_before as number) : null,
			snapshotId: typeof payload?.snapshot_id === "string" ? (payload.snapshot_id as string) : null,
		};
	}

	/** Search/list stocks. */
	async getStocks(query?: string, exchange?: string): Promise<StockItem[]> {
		const endpoints = buildEndpoints(this._base);
		const params = new URLSearchParams();
		if (query) params.set("search", query);
		if (exchange) params.set("exchange", exchange);
		const url = `${endpoints.STOCKS_LIST}?${params.toString()}`;
		const data = await this._fetch<{ results?: StockItem[] } | StockItem[]>(url);
		if (Array.isArray(data)) return data;
		if ("results" in data && Array.isArray(data.results)) return data.results;
		return [];
	}

	/** Fetch whale feed for a symbol. */
	async getWhaleFeed(symbol: string): Promise<WhaleFeedResponse | null> {
		const endpoints = buildEndpoints(this._base);
		const data = await this._fetch<WhaleFeedResponse | unknown[]>(endpoints.WHALE_FEED(symbol));
		return isWhaleFeedResponse(data) ? data : null;
	}

	/**
	 * Fetch intraday CVD series + dark flow strength.
	 * GET /api/stock-management/stocks/<symbol>/order-flow/?window=<window>
	 * @param window  "5m" | "15m" | "30m" | "1h" (default "30m")
	 */
	async getOrderFlow(symbol: string, window: "5m" | "15m" | "30m" | "1h" = "30m"): Promise<OrderFlowResponse | null> {
		const endpoints = buildEndpoints(this._base);
		const params = new URLSearchParams({ window });
		const url = `${endpoints.ORDER_FLOW(symbol)}?${params.toString()}`;
		const data = await this._fetch<unknown>(url);
		const obj = data as Record<string, unknown>;
		if (!obj || obj["ok"] !== true) {
			return null;
		}
		return obj as unknown as OrderFlowResponse;
	}
}
