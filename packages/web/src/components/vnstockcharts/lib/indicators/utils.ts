export function numericExtent(values: readonly number[]): [number, number] {
	const finiteValues = values.filter((value) => Number.isFinite(value));
	if (finiteValues.length === 0) {
		return [0, 1];
	}

	const minValue = Math.min(...finiteValues);
	const maxValue = Math.max(...finiteValues);
	if (minValue === maxValue) {
		return [minValue - 1, maxValue + 1];
	}
	return [minValue, maxValue];
}

export function collectNumbers(value: unknown, collected: number[] = []): number[] {
	if (Array.isArray(value)) {
		for (const item of value) {
			collectNumbers(item, collected);
		}
		return collected;
	}

	if (typeof value === "number" && Number.isFinite(value)) {
		collected.push(value);
		return collected;
	}

	if (value && typeof value === "object") {
		for (const item of Object.values(value as Record<string, unknown>)) {
			collectNumbers(item, collected);
		}
	}

	return collected;
}

export function emaSeries(values: readonly number[], period: number): number[] {
	if (values.length === 0) {
		return [];
	}

	const smoothing = 2 / (Math.max(period, 1) + 1);
	const series: number[] = [];
	let previousEma = values[0] ?? 0;

	for (let index = 0; index < values.length; index += 1) {
		const current = values[index] ?? previousEma;
		if (index === 0) {
			previousEma = current;
			series.push(current);
			continue;
		}

		previousEma = (current - previousEma) * smoothing + previousEma;
		series.push(previousEma);
	}

	return series;
}

export function smaSeries(values: readonly number[], period: number): number[] {
	if (values.length === 0) {
		return [];
	}

	const window = Math.max(period, 1);
	const series: number[] = [];
	let rollingSum = 0;

	for (let index = 0; index < values.length; index += 1) {
		rollingSum += values[index] ?? 0;
		if (index >= window) {
			rollingSum -= values[index - window] ?? 0;
		}

		const divisor = Math.min(index + 1, window);
		series.push(rollingSum / divisor);
	}

	return series;
}

// ── CE15/CE16 compute functions ───────────────────────────────────────────────

export interface PriceBar {
	open?: number;
	close: number;
	high: number;
	low: number;
	volume: number;
}

export interface KdjSeriesResult {
	k: number[];
	d: number[];
	j: number[];
}

export interface DmiSeriesResult {
	plusDI: number[];
	minusDI: number[];
	adx: number[];
}

export interface BrarSeriesResult {
	ar: number[];
	br: number[];
}

export interface MtmSeriesResult {
	mtm: number[];
	signal: number[];
}

export interface EmvSeriesResult {
	emv: number[];
	signal: number[];
}

export interface TrixSeriesResult {
	trix: number[];
	signal: number[];
}

export interface DmaSeriesResult {
	ddd: number[];
	ama: number[];
}

export interface PsySeriesResult {
	psy: number[];
	signal: number[];
}

export interface CrSeriesResult {
	cr: number[];
	ma1: number[];
	ma2: number[];
	ma3: number[];
	ma4: number[];
}

export function bbiSeries(bars: readonly PriceBar[]): number[] {
	const close = bars.map((b) => b.close);
	const ma3 = smaSeries(close, 3);
	const ma6 = smaSeries(close, 6);
	const ma12 = smaSeries(close, 12);
	const ma24 = smaSeries(close, 24);
	return close.map((_, i) => (ma3[i]! + ma6[i]! + ma12[i]! + ma24[i]!) / 4);
}

export function sarSeries(
	bars: readonly PriceBar[],
	afStep = 0.02,
	afMax = 0.2,
): number[] {
	if (bars.length < 2) {
		return bars.map(() => NaN);
	}

	const result: number[] = new Array(bars.length).fill(NaN) as number[];
	let isUpTrend = bars[1]!.close > bars[0]!.close;
	let af = afStep;
	let ep = isUpTrend ? bars[0]!.high : bars[0]!.low;
	let sar = isUpTrend ? bars[0]!.low : bars[0]!.high;

	result[0] = sar;

	for (let i = 1; i < bars.length; i++) {
		const bar = bars[i]!;
		const prevSar = sar;

		// Calculate new SAR
		sar = prevSar + af * (ep - prevSar);

		if (isUpTrend) {
			// SAR must be below prior two lows
			sar = Math.min(sar, bars[i - 1]!.low);
			if (i >= 2) sar = Math.min(sar, bars[i - 2]!.low);

			if (bar.low < sar) {
				// Trend reversal: down
				isUpTrend = false;
				sar = ep;
				ep = bar.low;
				af = afStep;
			} else {
				if (bar.high > ep) {
					ep = bar.high;
					af = Math.min(af + afStep, afMax);
				}
			}
		} else {
			// SAR must be above prior two highs
			sar = Math.max(sar, bars[i - 1]!.high);
			if (i >= 2) sar = Math.max(sar, bars[i - 2]!.high);

			if (bar.high > sar) {
				// Trend reversal: up
				isUpTrend = true;
				sar = ep;
				ep = bar.high;
				af = afStep;
			} else {
				if (bar.low < ep) {
					ep = bar.low;
					af = Math.min(af + afStep, afMax);
				}
			}
		}

		result[i] = sar;
	}

	return result;
}

export function obvSeries(bars: readonly PriceBar[]): number[] {
	const result: number[] = [0];
	for (let i = 1; i < bars.length; i++) {
		const delta =
			bars[i]!.close > bars[i - 1]!.close
				? bars[i]!.volume
				: bars[i]!.close < bars[i - 1]!.close
				? -bars[i]!.volume
				: 0;
		result.push(result[i - 1]! + delta);
	}
	return result;
}

export function wrSeries(bars: readonly PriceBar[], period = 14): number[] {
	return bars.map((_, i) => {
		if (i < period - 1) return NaN;
		const slice = bars.slice(i - period + 1, i + 1);
		const hh = Math.max(...slice.map((b) => b.high));
		const ll = Math.min(...slice.map((b) => b.low));
		if (hh === ll) return -50;
		return ((hh - bars[i]!.close) / (hh - ll)) * -100;
	});
}

export function vrSeries(bars: readonly PriceBar[], period = 26): number[] {
	return bars.map((_, i) => {
		if (i < period) return NaN;
		const slice = bars.slice(i - period + 1, i + 1);
		let up = 0, down = 0, flat = 0;
		for (let j = 1; j < slice.length; j++) {
			if (slice[j]!.close > slice[j - 1]!.close) up += slice[j]!.volume;
			else if (slice[j]!.close < slice[j - 1]!.close) down += slice[j]!.volume;
			else flat += slice[j]!.volume;
		}
		const denom = down + flat * 0.5;
		if (denom === 0) return 100;
		return ((up + flat * 0.5) / denom) * 100;
	});
}

function isFiniteNumber(value: number): boolean {
	return Number.isFinite(value);
}

export function emaSeriesSkipNaN(values: readonly number[], period: number): number[] {
	if (values.length === 0) {
		return [];
	}

	const smoothing = 2 / (Math.max(period, 1) + 1);
	const series: number[] = new Array(values.length).fill(NaN) as number[];
	let previousEma: number | undefined;

	for (let index = 0; index < values.length; index += 1) {
		const current = values[index] ?? NaN;
		if (!isFiniteNumber(current)) {
			if (previousEma !== undefined) {
				series[index] = previousEma;
			}
			continue;
		}

		if (previousEma === undefined) {
			previousEma = current;
		} else {
			previousEma = (current - previousEma) * smoothing + previousEma;
		}
		series[index] = previousEma;
	}

	return series;
}

export function smaSeriesSkipNaN(values: readonly number[], period: number): number[] {
	if (values.length === 0) {
		return [];
	}

	const window = Math.max(period, 1);
	const series: number[] = new Array(values.length).fill(NaN) as number[];
	const queue: number[] = [];
	let rollingSum = 0;
	let finiteCount = 0;

	for (let index = 0; index < values.length; index += 1) {
		const current = values[index] ?? NaN;
		queue.push(current);
		if (isFiniteNumber(current)) {
			rollingSum += current;
			finiteCount += 1;
		}

		if (queue.length > window) {
			const removed = queue.shift() ?? NaN;
			if (isFiniteNumber(removed)) {
				rollingSum -= removed;
				finiteCount -= 1;
			}
		}

		if (queue.length === window && finiteCount === window) {
			series[index] = rollingSum / window;
		}
	}

	return series;
}

export function wilderSeries(values: readonly number[], period: number): number[] {
	if (values.length === 0) {
		return [];
	}

	const window = Math.max(period, 1);
	const series: number[] = new Array(values.length).fill(NaN) as number[];
	if (values.length < window) {
		return series;
	}

	let rollingSum = 0;
	for (let index = 0; index < window; index += 1) {
		rollingSum += values[index] ?? 0;
	}

	let previous = rollingSum / window;
	series[window - 1] = previous;

	for (let index = window; index < values.length; index += 1) {
		const current = values[index] ?? 0;
		previous = previous + ((current - previous) / window);
		series[index] = previous;
	}

	return series;
}

export function wilderSeriesSkipNaN(values: readonly number[], period: number): number[] {
	if (values.length === 0) {
		return [];
	}

	const window = Math.max(period, 1);
	const series: number[] = new Array(values.length).fill(NaN) as number[];
	let previous: number | undefined;

	for (let index = 0; index < values.length; index += 1) {
		const current = values[index] ?? NaN;
		if (!isFiniteNumber(current)) {
			if (previous !== undefined) {
				series[index] = previous;
			}
			continue;
		}

		if (previous === undefined) {
			previous = current;
		} else {
			previous = previous + ((current - previous) / window);
		}
		series[index] = previous;
	}

	return series;
}

function midpointSeries(bars: readonly PriceBar[]): number[] {
	return bars.map((bar) => (bar.high + bar.low) / 2);
}

function typicalPriceSeries(bars: readonly PriceBar[]): number[] {
	return bars.map((bar) => (bar.high + bar.low + bar.close) / 3);
}

function meanAbsoluteDeviationSeries(values: readonly number[], period: number): number[] {
	if (values.length === 0) {
		return [];
	}

	const window = Math.max(period, 1);
	const series: number[] = new Array(values.length).fill(NaN) as number[];
	for (let index = window - 1; index < values.length; index += 1) {
		const slice = values.slice(index - window + 1, index + 1);
		const mean = slice.reduce((sum, value) => sum + (value ?? 0), 0) / slice.length;
		const deviation = slice.reduce((sum, value) => sum + Math.abs((value ?? 0) - mean), 0) / slice.length;
		series[index] = deviation;
	}

	return series;
}

function risingVolumeColor(values: readonly number[], index: number): string | undefined {
	const current = values[index];
	if (!isFiniteNumber(current)) {
		return undefined;
	}
	const previous = values[index - 1];
	if (!isFiniteNumber(previous)) {
		return "#089981";
	}
	return current >= previous ? "#089981" : "#f23645";
}

export function aoColorSeries(values: readonly number[]): Array<string | undefined> {
	return values.map((_, index) => risingVolumeColor(values, index));
}

export function kdjSeries(bars: readonly PriceBar[], period = 9, m1 = 3, m2 = 3): KdjSeriesResult {
	const rsv: number[] = new Array(bars.length).fill(NaN) as number[];
	for (let index = Math.max(period - 1, 0); index < bars.length; index += 1) {
		const slice = bars.slice(index - period + 1, index + 1);
		const highestHigh = Math.max(...slice.map((bar) => bar.high));
		const lowestLow = Math.min(...slice.map((bar) => bar.low));
		const range = highestHigh - lowestLow;
		if (range === 0) {
			rsv[index] = 50;
			continue;
		}
		rsv[index] = ((bars[index]!.close - lowestLow) / range) * 100;
	}

	const k = emaSeriesSkipNaN(rsv, m1);
	const d = emaSeriesSkipNaN(k, m2);
	const j = k.map((value, index) => {
		const dValue = d[index];
		if (!isFiniteNumber(value) || !isFiniteNumber(dValue)) {
			return NaN;
		}
		return (3 * value) - (2 * dValue);
	});

	return { k, d, j };
}

export function cciSeries(bars: readonly PriceBar[], period = 20): number[] {
	const tp = typicalPriceSeries(bars);
	const sma = smaSeries(tp, period);
	const mad = meanAbsoluteDeviationSeries(tp, period);
	return tp.map((value, index) => {
		if (index < Math.max(period - 1, 0)) {
			return NaN;
		}
		const meanDeviation = mad[index];
		const average = sma[index];
		if (!isFiniteNumber(meanDeviation) || meanDeviation === 0 || !isFiniteNumber(average)) {
			return 0;
		}
		return (value - average) / (0.015 * meanDeviation);
	});
}

export function dmiSeries(bars: readonly PriceBar[], period = 14): DmiSeriesResult {
	if (bars.length === 0) {
		return { plusDI: [], minusDI: [], adx: [] };
	}

	const tr: number[] = new Array(bars.length).fill(NaN) as number[];
	const plusDm: number[] = new Array(bars.length).fill(NaN) as number[];
	const minusDm: number[] = new Array(bars.length).fill(NaN) as number[];
	tr[0] = bars[0]!.high - bars[0]!.low;
	plusDm[0] = 0;
	minusDm[0] = 0;

	for (let index = 1; index < bars.length; index += 1) {
		const current = bars[index]!;
		const previous = bars[index - 1]!;
		const upMove = current.high - previous.high;
		const downMove = previous.low - current.low;
		plusDm[index] = upMove > downMove && upMove > 0 ? upMove : 0;
		minusDm[index] = downMove > upMove && downMove > 0 ? downMove : 0;
		tr[index] = Math.max(
			current.high - current.low,
			Math.abs(current.high - previous.close),
			Math.abs(current.low - previous.close),
		);
	}

	const smoothTr = wilderSeries(tr, period);
	const smoothPlus = wilderSeries(plusDm, period);
	const smoothMinus = wilderSeries(minusDm, period);

	const plusDI = smoothTr.map((value, index) => {
		if (!isFiniteNumber(value) || value === 0) {
			return NaN;
		}
		return ((smoothPlus[index] ?? 0) / value) * 100;
	});
	const minusDI = smoothTr.map((value, index) => {
		if (!isFiniteNumber(value) || value === 0) {
			return NaN;
		}
		return ((smoothMinus[index] ?? 0) / value) * 100;
	});
	const dx = plusDI.map((plus, index) => {
		const minus = minusDI[index];
		if (!isFiniteNumber(plus) || !isFiniteNumber(minus)) {
			return NaN;
		}
		const denominator = plus + minus;
		if (denominator === 0) {
			return 0;
		}
		return (Math.abs(plus - minus) / denominator) * 100;
	});
	const adx = wilderSeriesSkipNaN(dx, period);

	return { plusDI, minusDI, adx };
}

export function biasSeries(bars: readonly PriceBar[], period = 6): number[] {
	const closes = bars.map((bar) => bar.close);
	const movingAverage = smaSeries(closes, period);
	return closes.map((value, index) => {
		const average = movingAverage[index];
		if (!isFiniteNumber(average) || average === 0) {
			return NaN;
		}
		return ((value - average) / average) * 100;
	});
}

export function brarSeries(bars: readonly PriceBar[], period = 26): BrarSeriesResult {
	if (bars.length === 0) {
		return { ar: [], br: [] };
	}

	const ar: number[] = new Array(bars.length).fill(NaN) as number[];
	const br: number[] = new Array(bars.length).fill(NaN) as number[];

	for (let index = period; index < bars.length; index += 1) {
		let arNumerator = 0;
		let arDenominator = 0;
		let brNumerator = 0;
		let brDenominator = 0;

		for (let offset = 0; offset < period; offset += 1) {
			const currentIndex = index - period + 1 + offset;
			const current = bars[currentIndex]!;
			const open = current.open ?? current.close;
			const previous = bars[currentIndex - 1]!;
			arNumerator += Math.max(current.high - open, 0);
			arDenominator += Math.max(open - current.low, 0);
			brNumerator += Math.max(current.high - previous.close, 0);
			brDenominator += Math.max(previous.close - current.low, 0);
		}

		ar[index] = arDenominator === 0 ? 0 : (arNumerator / arDenominator) * 100;
		br[index] = brDenominator === 0 ? 0 : (brNumerator / brDenominator) * 100;
	}

	return { ar, br };
}

export function mtmSeries(bars: readonly PriceBar[], period = 6, signalPeriod = 6): MtmSeriesResult {
	const closes = bars.map((bar) => bar.close);
	const mtm: number[] = new Array(bars.length).fill(NaN) as number[];
	for (let index = period; index < closes.length; index += 1) {
		mtm[index] = closes[index]! - closes[index - period]!;
	}
	return {
		mtm,
		signal: smaSeriesSkipNaN(mtm, signalPeriod),
	};
}

export function emvSeries(bars: readonly PriceBar[], period = 14): EmvSeriesResult {
	if (bars.length === 0) {
		return { emv: [], signal: [] };
	}

	const emv: number[] = new Array(bars.length).fill(NaN) as number[];
	for (let index = 1; index < bars.length; index += 1) {
		const current = bars[index]!;
		const previous = bars[index - 1]!;
		const currentMid = (current.high + current.low) / 2;
		const previousMid = (previous.high + previous.low) / 2;
		const range = current.high - current.low;
		if (range === 0 || current.volume === 0) {
			emv[index] = 0;
			continue;
		}
		const boxRatio = current.volume / range;
		emv[index] = (currentMid - previousMid) / boxRatio;
	}

	return {
		emv,
		signal: smaSeriesSkipNaN(emv, period),
	};
}

export function aoSeries(bars: readonly PriceBar[]): number[] {
	const midpoints = midpointSeries(bars);
	const sma5 = smaSeries(midpoints, 5);
	const sma34 = smaSeries(midpoints, 34);
	return midpoints.map((_, index) => (sma5[index] ?? 0) - (sma34[index] ?? 0));
}

export function rocSeries(bars: readonly PriceBar[], period = 12): number[] {
	const closes = bars.map((bar) => bar.close);
	const result: number[] = new Array(closes.length).fill(NaN) as number[];
	for (let index = period; index < closes.length; index += 1) {
		const previous = closes[index - period]!;
		result[index] = previous === 0 ? 0 : ((closes[index]! - previous) / previous) * 100;
	}
	return result;
}

export function trixSeries(bars: readonly PriceBar[], period = 12, signalPeriod = 9): TrixSeriesResult {
	const closes = bars.map((bar) => bar.close);
	const ema1 = emaSeries(closes, period);
	const ema2 = emaSeries(ema1, period);
	const ema3 = emaSeries(ema2, period);
	const trix: number[] = new Array(closes.length).fill(NaN) as number[];
	for (let index = 1; index < ema3.length; index += 1) {
		const previous = ema3[index - 1];
		const current = ema3[index];
		if (!isFiniteNumber(previous) || !isFiniteNumber(current) || previous === 0) {
			continue;
		}
		trix[index] = ((current - previous) / previous) * 100;
	}
	return {
		trix,
		signal: emaSeriesSkipNaN(trix, signalPeriod),
	};
}

export function dmaSeries(bars: readonly PriceBar[], fastPeriod = 10, slowPeriod = 50, signalPeriod = 10): DmaSeriesResult {
	const closes = bars.map((bar) => bar.close);
	const fast = smaSeries(closes, fastPeriod);
	const slow = smaSeries(closes, slowPeriod);
	const ddd = closes.map((_, index) => (fast[index] ?? 0) - (slow[index] ?? 0));
	return {
		ddd,
		ama: smaSeriesSkipNaN(ddd, signalPeriod),
	};
}

export function pvtSeries(bars: readonly PriceBar[]): number[] {
	if (bars.length === 0) {
		return [];
	}

	const result: number[] = new Array(bars.length).fill(NaN) as number[];
	result[0] = 0;
	let cumulative = 0;
	for (let index = 1; index < bars.length; index += 1) {
		const previous = bars[index - 1]!.close;
		const current = bars[index]!;
		const change = previous === 0 ? 0 : (current.volume * (current.close - previous)) / previous;
		cumulative += change;
		result[index] = cumulative;
	}
	return result;
}

export function psySeries(bars: readonly PriceBar[], period = 12, signalPeriod = 6): PsySeriesResult {
	const closes = bars.map((bar) => bar.close);
	const psy: number[] = new Array(closes.length).fill(NaN) as number[];
	for (let index = period; index < closes.length; index += 1) {
		const slice = closes.slice(index - period + 1, index + 1);
		let upCount = 0;
		for (let offset = 1; offset < slice.length; offset += 1) {
			if (slice[offset]! > slice[offset - 1]!) {
				upCount += 1;
			}
		}
		psy[index] = (upCount / period) * 100;
	}

	return {
		psy,
		signal: smaSeriesSkipNaN(psy, signalPeriod),
	};
}

export function crSeries(bars: readonly PriceBar[], period = 26, m1 = 10, m2 = 20, m3 = 40, m4 = 60): CrSeriesResult {
	const cr: number[] = new Array(bars.length).fill(NaN) as number[];
	for (let index = period; index < bars.length; index += 1) {
		let numerator = 0;
		let denominator = 0;
		for (let offset = 0; offset < period; offset += 1) {
			const currentIndex = index - period + 1 + offset;
			const current = bars[currentIndex]!;
			const previous = bars[currentIndex - 1]!;
			const hm = (current.high + previous.high + previous.low + previous.close) / 4;
			numerator += Math.max(current.high - hm, 0);
			denominator += Math.max(hm - current.low, 0);
		}
		cr[index] = denominator === 0 ? 0 : (numerator / denominator) * 100;
	}

	return {
		cr,
		ma1: smaSeriesSkipNaN(cr, m1),
		ma2: smaSeriesSkipNaN(cr, m2),
		ma3: smaSeriesSkipNaN(cr, m3),
		ma4: smaSeriesSkipNaN(cr, m4),
	};
}

export function rsiSeries(values: readonly number[], period: number): number[] {
	if (values.length === 0) {
		return [];
	}

	const window = Math.max(period, 1);
	const series: number[] = [50];
	let averageGain = 0;
	let averageLoss = 0;

	for (let index = 1; index < values.length; index += 1) {
		const change = (values[index] ?? 0) - (values[index - 1] ?? 0);
		const gain = Math.max(change, 0);
		const loss = Math.max(-change, 0);

		if (index <= window) {
			averageGain += gain;
			averageLoss += loss;
			const divisor = Math.min(index, window);
			const gainAverage = averageGain / divisor;
			const lossAverage = averageLoss / divisor;
			const relativeStrength = lossAverage === 0 ? Number.POSITIVE_INFINITY : gainAverage / lossAverage;
			series.push(100 - (100 / (1 + relativeStrength)));
			continue;
		}

		averageGain = ((averageGain * (window - 1)) + gain) / window;
		averageLoss = ((averageLoss * (window - 1)) + loss) / window;
		const relativeStrength = averageLoss === 0 ? Number.POSITIVE_INFINITY : averageGain / averageLoss;
		series.push(100 - (100 / (1 + relativeStrength)));
	}

	return series;
}

export interface MacdSeriesResult {
	macd: number[];
	signal: number[];
	histogram: number[];
}

export function macdSeries(values: readonly number[], fastPeriod: number, slowPeriod: number, signalPeriod: number): MacdSeriesResult {
	const fastEma = emaSeries(values, fastPeriod);
	const slowEma = emaSeries(values, slowPeriod);
	const macd = values.map((_, index) => (fastEma[index] ?? 0) - (slowEma[index] ?? 0));
	const signal = emaSeries(macd, signalPeriod);
	const histogram = macd.map((value, index) => value - (signal[index] ?? 0));

	return { macd, signal, histogram };
}

export interface BollingerSeriesResult {
	upper: number[];
	middle: number[];
	lower: number[];
}

function rollingStandardDeviation(values: readonly number[], period: number): number[] {
	if (values.length === 0) {
		return [];
	}

	const window = Math.max(period, 1);
	const series: number[] = [];

	for (let index = 0; index < values.length; index += 1) {
		const startIndex = Math.max(0, index - window + 1);
		const slice = values.slice(startIndex, index + 1);
		const mean = slice.reduce((sum, value) => sum + (value ?? 0), 0) / slice.length;
		const variance = slice.reduce((sum, value) => {
			const delta = (value ?? 0) - mean;
			return sum + (delta * delta);
		}, 0) / slice.length;
		series.push(Math.sqrt(variance));
	}

	return series;
}

export function bollingerSeries(values: readonly number[], period: number, multiplier: number): BollingerSeriesResult {
	const middle = smaSeries(values, period);
	const deviation = rollingStandardDeviation(values, period);
	const upper = middle.map((value, index) => value + ((deviation[index] ?? 0) * multiplier));
	const lower = middle.map((value, index) => value - ((deviation[index] ?? 0) * multiplier));

	return { upper, middle, lower };
}