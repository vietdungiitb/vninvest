import { enrichData } from "../lib/core/calculators/enrichData";
import type { EnrichedDatum, IndicatorBandValue, IndicatorMacdValue, RawOHLCV } from "../lib/core/calculators/types";
import type { SeriesConfig } from "../lib/core/types/pane-descriptor";
import bitstampCsv from "../../docs/data/bitfinex_xbtusd_1m.csv";

export type BollingerBandPoint = IndicatorBandValue;
export type MACDPoint = IndicatorMacdValue;
export type DemoDatum = EnrichedDatum;

export const BOLLINGER_BAND_OPTIONS = {
	windowSize: 20,
	sourcePath: "close",
	multiplier: 2,
	movingAverageType: "sma",
} as const;

const DEMO_WINDOW = 1000;
const BINANCE_MAX_LIMIT = 1000;
const BINANCE_BASE = "https://api.binance.com/api/v3/klines";
const DEMO_CANONICAL_SERIES: readonly SeriesConfig[] = [
	{ type: "EMA", yAxis: "right", params: { period: 20 } },
	{ type: "EMA", yAxis: "right", params: { period: 50 } },
	{ type: "RSI", yAxis: "left", params: { period: 14 } },
	{ type: "MACD", yAxis: "right", params: { fast: 12, slow: 26, signal: 9 } },
	{ type: "BollingerBand", yAxis: "right", params: { period: 20, stdDev: 2 } },
];

/** Map demo timeframe labels → Binance interval strings */
export const BINANCE_INTERVAL_MAP: Record<string, string> = {
	"1m": "1m", "3m": "3m", "5m": "5m", "15m": "15m", "30m": "30m",
	"1h": "1h", "4h": "4h", "1D": "1d", "1W": "1w",
};

function sortBars(data: readonly RawOHLCV[]) {
	return data
		.slice()
		.sort((left, right) => left.date.valueOf() - right.date.valueOf());
}

function normalizeBars(data: readonly RawOHLCV[], limit = DEMO_WINDOW): RawOHLCV[] {
	const sorted = sortBars(data);
	return sorted.slice(-limit);
}

export function mergeBarsByDate(primary: readonly RawOHLCV[], secondary: readonly RawOHLCV[]): RawOHLCV[] {
	const merged = sortBars([...primary, ...secondary]);
	if (merged.length === 0) {
		return [];
	}

	const deduped: RawOHLCV[] = [merged[0]];
	for (const bar of merged.slice(1)) {
		const lastBar = deduped[deduped.length - 1];
		if (lastBar.date.valueOf() === bar.date.valueOf()) {
			deduped[deduped.length - 1] = bar;
		} else {
			deduped.push(bar);
		}
	}

	return deduped;
}

function parseDateTime(value: string) {
	return new Date(value.replace(" ", "T"));
}

function parseCsvRow(row: string): RawOHLCV {
	const [date, open, high, low, close, volume] = row.split(",");

	return {
		date: parseDateTime(date),
		open: Number(open),
		high: Number(high),
		low: Number(low),
		close: Number(close),
		volume: Number(volume),
	};
}

function computeIndicators(data: readonly RawOHLCV[], limit = DEMO_WINDOW) {
	return enrichData(normalizeBars(data, limit), { series: DEMO_CANONICAL_SERIES });
}

export function getOfflineDemoBars(): RawOHLCV[] {
	return normalizeBars(bitstampCsv.trim().split(/\r?\n/).slice(1).map(parseCsvRow));
}

export function getOfflineDemoData(): DemoDatum[] {
	return computeIndicators(getOfflineDemoBars());
}

type BinanceKline = [number | string, string, string, string, string, string, ...unknown[]];

export function formatBinanceKlineBars(json: BinanceKline[], limit = DEMO_WINDOW): RawOHLCV[] {
	return normalizeBars(json.map((d: any) => ({
		date: new Date(d[0]),
		open: parseFloat(d[1]),
		high: parseFloat(d[2]),
		low: parseFloat(d[3]),
		close: parseFloat(d[4]),
		volume: parseFloat(d[5]),
	})), limit);
}

export function formatBinanceKlines(json: BinanceKline[]): DemoDatum[] {
	return computeIndicators(formatBinanceKlineBars(json));
}

export interface FetchLiveOptions {
	symbol?: string;
	interval?: string;
	limit?: number;
	startTime?: number | Date;
	endTime?: number | Date;
	signal?: AbortSignal;
}

function toTimeValue(value?: number | Date) {
	if (value === undefined) {
		return undefined;
	}
	return value instanceof Date ? value.valueOf() : value;
}

async function fetchBinanceKlinePage(options: FetchLiveOptions = {}): Promise<RawOHLCV[]> {
	const { symbol = "BTCUSDT", interval = "1h", limit = DEMO_WINDOW, startTime, endTime, signal } = options;
	const binanceInterval = BINANCE_INTERVAL_MAP[interval] ?? interval;
	const params = new URLSearchParams({
		symbol,
		interval: binanceInterval,
		limit: String(Math.max(1, Math.min(BINANCE_MAX_LIMIT, limit))),
	});
	const startTimeValue = toTimeValue(startTime);
	const endTimeValue = toTimeValue(endTime);
	if (startTimeValue !== undefined) {
		params.set("startTime", String(startTimeValue));
	}
	if (endTimeValue !== undefined) {
		params.set("endTime", String(endTimeValue));
	}
	const url = `${BINANCE_BASE}?${params.toString()}`;
	const response = await fetch(url, { signal });

	if (!response.ok) {
		throw new Error(`Không tải được dữ liệu Binance: ${response.status}`);
	}

	const json = await response.json() as BinanceKline[];
	return formatBinanceKlineBars(json, limit);
}

export async function fetchLiveDemoBars(options: FetchLiveOptions = {}): Promise<RawOHLCV[]> {
	return fetchBinanceKlinePage(options);
}

export async function fetchHistoricalDemoBars(options: FetchLiveOptions & { pages?: number } = {}): Promise<RawOHLCV[]> {
	const { pages = 1, limit = BINANCE_MAX_LIMIT, endTime, ...rest } = options;
	let nextEndTime = toTimeValue(endTime);
	let bars: RawOHLCV[] = [];

	for (let page = 0; page < Math.max(1, pages); page += 1) {
		const pageBars = await fetchBinanceKlinePage({
			...rest,
			limit,
			endTime: nextEndTime,
		});

		if (pageBars.length === 0) {
			break;
		}

		bars = mergeBarsByDate(pageBars, bars);
		if (pageBars.length < limit) {
			break;
		}

		nextEndTime = pageBars[0].date.valueOf() - 1;
	}

	return bars;
}

export async function fetchLiveDemoData(options: FetchLiveOptions = {}): Promise<DemoDatum[]> {
	return computeIndicators(await fetchLiveDemoBars(options), options.limit ?? DEMO_WINDOW);
}