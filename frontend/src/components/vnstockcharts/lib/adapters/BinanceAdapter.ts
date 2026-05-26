import type { DataAdapter, GetBarsParams, GetBarsResult, KLineBar } from "./DataAdapter";

const BINANCE_BASE = "https://api.binance.com/api/v3/klines";
const MAX_LIMIT = 1000;

/** Allowlist of valid Binance interval strings */
const BINANCE_INTERVALS = new Set([
	"1m", "3m", "5m", "15m", "30m",
	"1h", "2h", "4h", "6h", "8h", "12h",
	"1d", "3d", "1w", "1M",
]);

/** Map demo timeframe labels → Binance interval strings */
const INTERVAL_MAP: Record<string, string> = {
	"1m": "1m", "3m": "3m", "5m": "5m", "15m": "15m", "30m": "30m",
	"1h": "1h", "4h": "4h", "1D": "1d", "1W": "1w",
};

/** OWASP: validate symbol against allowlist pattern before sending to API */
const SYMBOL_RE = /^[A-Z0-9]{2,20}$/;

function validateSymbol(symbol: string): string {
	const upper = symbol.toUpperCase();
	if (!SYMBOL_RE.test(upper)) {
		throw new Error(`Tên symbol không hợp lệ: "${symbol}"`);
	}
	return upper;
}

function resolveInterval(interval: string): string {
	const mapped = INTERVAL_MAP[interval] ?? interval;
	if (!BINANCE_INTERVALS.has(mapped)) {
		throw new Error(`Interval không hợp lệ: "${interval}"`);
	}
	return mapped;
}

type BinanceKline = [number | string, string, string, string, string, string, ...unknown[]];

function parseKlines(json: BinanceKline[]): KLineBar[] {
	return json.map((d) => ({
		timestamp: Number(d[0]),
		open: parseFloat(d[1] as string),
		high: parseFloat(d[2] as string),
		low: parseFloat(d[3] as string),
		close: parseFloat(d[4] as string),
		volume: parseFloat(d[5] as string),
	}));
}

export class BinanceAdapter implements DataAdapter {
	readonly name = "binance";

	async getBars(params: GetBarsParams): Promise<GetBarsResult> {
		const { symbol, interval, timestamp, limit, signal } = params;
		const safeSymbol = validateSymbol(symbol);
		const safeInterval = resolveInterval(interval);
		const safeLimit = Math.max(1, Math.min(MAX_LIMIT, limit));

		const urlParams = new URLSearchParams({
			symbol: safeSymbol,
			interval: safeInterval,
			limit: String(safeLimit),
		});

		// backward fetch: only return bars ending before `timestamp`
		if (params.type === "backward" && timestamp !== null) {
			urlParams.set("endTime", String(timestamp - 1));
		}

		const response = await fetch(`${BINANCE_BASE}?${urlParams.toString()}`, { signal });
		if (!response.ok) {
			throw new Error(`Không tải được dữ liệu Binance: ${response.status}`);
		}

		const json = await response.json() as BinanceKline[];
		const bars = parseKlines(json);
		return { bars, hasMore: bars.length >= safeLimit };
	}
}

export const binanceAdapter = new BinanceAdapter();
