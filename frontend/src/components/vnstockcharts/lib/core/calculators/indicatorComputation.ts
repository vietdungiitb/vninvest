import {
	aoSeries,
	biasSeries,
	bbiSeries,
	bollingerSeries,
	brarSeries,
	cciSeries,
	crSeries,
	dmaSeries,
	dmiSeries,
	emaSeries,
	emvSeries,
	kdjSeries,
	macdSeries,
	mtmSeries,
	obvSeries,
	pvtSeries,
	psySeries,
	rsiSeries,
	rocSeries,
	sarSeries,
	smaSeries,
	trixSeries,
	vrSeries,
	wrSeries,
} from "../../indicators/utils";
import { buildIndicatorSeriesKey } from "../seriesValueResolver";
import type { SeriesConfig } from "../types/pane-descriptor";
import { calcCVDApprox } from "./calcCVDApprox";
import { calcStrengthElder } from "./calcStrengthElder";
import { calcWhaleApprox } from "./calcWhaleApprox";
import type {
	IndicatorBandValue,
	IndicatorBrarValue,
	IndicatorCrValue,
	IndicatorDmaValue,
	IndicatorDmiValue,
	IndicatorDatumValue,
	IndicatorEmvValue,
	IndicatorKdjValue,
	IndicatorMacdValue,
	IndicatorMtmValue,
	IndicatorPsyValue,
	IndicatorTrixValue,
	IndicatorWhaleValue,
	RawOHLCV,
} from "./types";

interface MacdConfig {
	fast: number;
	slow: number;
	signal: number;
}

interface BollingerConfig {
	period: number;
	stdDev: number;
}

interface KdjConfig {
	period: number;
	m1: number;
	m2: number;
}

interface PeriodSignalConfig {
	period: number;
	signalPeriod: number;
}

interface DmaConfig {
	fastPeriod: number;
	slowPeriod: number;
	signalPeriod: number;
}

interface CrConfig {
	period: number;
	m1: number;
	m2: number;
	m3: number;
	m4: number;
}

function blankUntil<T>(values: readonly T[], startIndex: number): Array<T | undefined> {
	return values.map((value, index) => (index >= startIndex ? value : undefined));
}

function mergeBand(
	upper: readonly number[],
	middle: readonly number[],
	lower: readonly number[],
	startIndex: number,
): Array<IndicatorBandValue | undefined> {
	return upper.map((top, index) => {
		if (index < startIndex) {
			return undefined;
		}
		return {
			top,
			middle: middle[index] ?? middle[middle.length - 1] ?? top,
			bottom: lower[index] ?? lower[lower.length - 1] ?? top,
		};
	});
}

function numberParam(series: SeriesConfig, key: string, fallback: number) {
	const value = series.params?.[key];
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function indicatorKey(series: SeriesConfig) {
	return buildIndicatorSeriesKey(series);
}

function defaultSeries(type: SeriesConfig["type"], params: Record<string, number> = {}): SeriesConfig {
	return { type, yAxis: "right", params };
}

export interface IndicatorComputationPlan {
	emaPeriods: Set<number>;
	smaPeriods: Set<number>;
	rsiPeriods: Set<number>;
	macdConfigs: Map<string, MacdConfig>;
	bollingerConfigs: Map<string, BollingerConfig>;
	whaleThresholds: Set<number>;
	bbiEnabled: boolean;
	sarByKey: Map<string, { afStep: number; afMax: number }>;
	obvEnabled: boolean;
	wrPeriods: Set<number>;
	vrPeriods: Set<number>;
	kdjConfigs: Map<string, KdjConfig>;
	cciPeriods: Set<number>;
	dmiPeriods: Set<number>;
	biasPeriods: Set<number>;
	brarPeriods: Set<number>;
	mtmConfigs: Map<string, PeriodSignalConfig>;
	emvPeriods: Set<number>;
	aoEnabled: boolean;
	rocPeriods: Set<number>;
	trixConfigs: Map<string, PeriodSignalConfig>;
	dmaConfigs: Map<string, DmaConfig>;
	pvtEnabled: boolean;
	psyConfigs: Map<string, PeriodSignalConfig>;
	crConfigs: Map<string, CrConfig>;
	defaultMacdKey: string;
	defaultBollingerKey: string;
	defaultWhaleKey: string;
}

export interface IndicatorComputationResult {
	emaByPeriod: Map<number, Array<number | undefined>>;
	smaByPeriod: Map<number, Array<number | undefined>>;
	rsiByPeriod: Map<number, Array<number | undefined>>;
	macdByKey: Map<string, Array<IndicatorMacdValue | undefined>>;
	bollingerByKey: Map<string, Array<IndicatorBandValue | undefined>>;
	whaleByKey: Map<string, Array<IndicatorWhaleValue | undefined>>;
	bbi: Array<number | undefined>;
	sarByKey: Map<string, Array<number | undefined>>;
	obv: Array<number | undefined>;
	wrByPeriod: Map<number, Array<number | undefined>>;
	vrByPeriod: Map<number, Array<number | undefined>>;
	kdjByKey: Map<string, Array<IndicatorKdjValue | undefined>>;
	cciByPeriod: Map<number, Array<number | undefined>>;
	dmiByPeriod: Map<number, Array<IndicatorDmiValue | undefined>>;
	biasByPeriod: Map<number, Array<number | undefined>>;
	brarByPeriod: Map<number, Array<IndicatorBrarValue | undefined>>;
	mtmByKey: Map<string, Array<IndicatorMtmValue | undefined>>;
	emvByPeriod: Map<number, Array<IndicatorEmvValue | undefined>>;
	ao: Array<number | undefined>;
	rocByPeriod: Map<number, Array<number | undefined>>;
	trixByKey: Map<string, Array<IndicatorTrixValue | undefined>>;
	dmaByKey: Map<string, Array<IndicatorDmaValue | undefined>>;
	pvt: Array<number | undefined>;
	psyByKey: Map<string, Array<IndicatorPsyValue | undefined>>;
	crByKey: Map<string, Array<IndicatorCrValue | undefined>>;
	cvd: ReturnType<typeof calcCVDApprox>;
	strength: ReturnType<typeof calcStrengthElder>;
}

export function buildIndicatorComputationPlan(series: readonly SeriesConfig[], whaleThreshold: number): IndicatorComputationPlan {
	const emaPeriods = new Set<number>([13, 20, 50]);
	const smaPeriods = new Set<number>();
	const rsiPeriods = new Set<number>([14]);
	const macdConfigs = new Map<string, MacdConfig>();
	const bollingerConfigs = new Map<string, BollingerConfig>();
	const whaleThresholds = new Set<number>([whaleThreshold]);
	const sarByKey = new Map<string, { afStep: number; afMax: number }>();
	const wrPeriods = new Set<number>();
	const vrPeriods = new Set<number>();
	const kdjConfigs = new Map<string, KdjConfig>();
	const cciPeriods = new Set<number>();
	const dmiPeriods = new Set<number>();
	const biasPeriods = new Set<number>();
	const brarPeriods = new Set<number>();
	const mtmConfigs = new Map<string, PeriodSignalConfig>();
	const emvPeriods = new Set<number>();
	const rocPeriods = new Set<number>();
	const trixConfigs = new Map<string, PeriodSignalConfig>();
	const dmaConfigs = new Map<string, DmaConfig>();
	const psyConfigs = new Map<string, PeriodSignalConfig>();
	const crConfigs = new Map<string, CrConfig>();
	let bbiEnabled = false;
	let obvEnabled = false;
	let aoEnabled = false;
	let pvtEnabled = false;
	const defaultMacdSeries = defaultSeries("MACD", { fast: 12, slow: 26, signal: 9 });
	const defaultBollingerSeries = defaultSeries("BollingerBand", { period: 20, stdDev: 2 });
	const defaultWhaleSeries = defaultSeries("Whale", { threshold: whaleThreshold });

	const defaultMacdKey = indicatorKey(defaultMacdSeries)!;
	const defaultBollingerKey = indicatorKey(defaultBollingerSeries)!;
	const defaultWhaleKey = indicatorKey(defaultWhaleSeries)!;

	macdConfigs.set(defaultMacdKey, { fast: 12, slow: 26, signal: 9 });
	bollingerConfigs.set(defaultBollingerKey, { period: 20, stdDev: 2 });

	for (const nextSeries of series) {
		switch (nextSeries.type) {
			case "EMA":
				emaPeriods.add(numberParam(nextSeries, "period", 20));
				break;
			case "MA":
				smaPeriods.add(numberParam(nextSeries, "period", 20));
				break;
			case "RSI":
				rsiPeriods.add(numberParam(nextSeries, "period", 14));
				break;
			case "MACD": {
				const key = indicatorKey(nextSeries);
				if (key) {
					macdConfigs.set(key, {
						fast: numberParam(nextSeries, "fast", 12),
						slow: numberParam(nextSeries, "slow", 26),
						signal: numberParam(nextSeries, "signal", 9),
					});
				}
				break;
			}
			case "BollingerBand": {
				const key = indicatorKey(nextSeries);
				if (key) {
					bollingerConfigs.set(key, {
						period: numberParam(nextSeries, "period", 20),
						stdDev: numberParam(nextSeries, "stdDev", 2),
					});
				}
				break;
			}
			case "Whale":
				whaleThresholds.add(numberParam(nextSeries, "threshold", whaleThreshold));
				break;
			case "BBI":
				bbiEnabled = true;
				break;
			case "SAR": {
				const key = indicatorKey(nextSeries);
				if (key) {
					sarByKey.set(key, {
						afStep: numberParam(nextSeries, "afStep", 0.02),
						afMax: numberParam(nextSeries, "afMax", 0.2),
					});
				}
				break;
			}
			case "OBV":
				obvEnabled = true;
				break;
			case "WR":
				wrPeriods.add(numberParam(nextSeries, "period", 14));
				break;
			case "VR":
				vrPeriods.add(numberParam(nextSeries, "period", 26));
				break;
			case "KDJ": {
				const key = indicatorKey(nextSeries);
				if (key) {
					kdjConfigs.set(key, {
						period: numberParam(nextSeries, "period", 9),
						m1: numberParam(nextSeries, "m1", 3),
						m2: numberParam(nextSeries, "m2", 3),
					});
				}
				break;
			}
			case "CCI":
				cciPeriods.add(numberParam(nextSeries, "period", 20));
				break;
			case "DMI":
				dmiPeriods.add(numberParam(nextSeries, "period", 14));
				break;
			case "BIAS":
				biasPeriods.add(numberParam(nextSeries, "period", 6));
				break;
			case "BRAR":
				brarPeriods.add(numberParam(nextSeries, "period", 26));
				break;
			case "MTM": {
				const key = indicatorKey(nextSeries);
				if (key) {
					mtmConfigs.set(key, {
						period: numberParam(nextSeries, "period", 6),
						signalPeriod: numberParam(nextSeries, "signalPeriod", 6),
					});
				}
				break;
			}
			case "EMV":
				emvPeriods.add(numberParam(nextSeries, "period", 14));
				break;
			case "AO":
				aoEnabled = true;
				break;
			case "ROC":
				rocPeriods.add(numberParam(nextSeries, "period", 12));
				break;
			case "TRIX": {
				const key = indicatorKey(nextSeries);
				if (key) {
					trixConfigs.set(key, {
						period: numberParam(nextSeries, "period", 12),
						signalPeriod: numberParam(nextSeries, "signalPeriod", 9),
					});
				}
				break;
			}
			case "DMA": {
				const key = indicatorKey(nextSeries);
				if (key) {
					dmaConfigs.set(key, {
						fastPeriod: numberParam(nextSeries, "fastPeriod", 10),
						slowPeriod: numberParam(nextSeries, "slowPeriod", 50),
						signalPeriod: numberParam(nextSeries, "signalPeriod", 10),
					});
				}
				break;
			}
			case "PVT":
				pvtEnabled = true;
				break;
			case "PSY": {
				const key = indicatorKey(nextSeries);
				if (key) {
					psyConfigs.set(key, {
						period: numberParam(nextSeries, "period", 12),
						signalPeriod: numberParam(nextSeries, "signalPeriod", 6),
					});
				}
				break;
			}
			case "CR": {
				const key = indicatorKey(nextSeries);
				if (key) {
					crConfigs.set(key, {
						period: numberParam(nextSeries, "period", 26),
						m1: numberParam(nextSeries, "m1", 10),
						m2: numberParam(nextSeries, "m2", 20),
						m3: numberParam(nextSeries, "m3", 40),
						m4: numberParam(nextSeries, "m4", 60),
					});
				}
				break;
			}
			default:
				break;
		}
	}

	return {
		emaPeriods,
		smaPeriods,
		rsiPeriods,
		macdConfigs,
		bollingerConfigs,
		whaleThresholds,
		bbiEnabled,
		sarByKey,
		obvEnabled,
		wrPeriods,
		vrPeriods,
		kdjConfigs,
		cciPeriods,
	dmiPeriods,
	biasPeriods,
	brarPeriods,
	mtmConfigs,
	emvPeriods,
	aoEnabled,
	rocPeriods,
	trixConfigs,
	dmaConfigs,
	pvtEnabled,
	psyConfigs,
	crConfigs,
		defaultMacdKey,
		defaultBollingerKey,
		defaultWhaleKey,
	};
}

export function computeIndicatorComputationResult(raw: readonly RawOHLCV[], plan: IndicatorComputationPlan): IndicatorComputationResult {
	const closes = raw.map((bar) => bar.close);

	const emaByPeriod = new Map<number, Array<number | undefined>>();
	for (const period of plan.emaPeriods) {
		emaByPeriod.set(period, blankUntil(emaSeries(closes, period), Math.max(period - 1, 0)));
	}

	const smaByPeriod = new Map<number, Array<number | undefined>>();
	for (const period of plan.smaPeriods) {
		smaByPeriod.set(period, blankUntil(smaSeries(closes, period), Math.max(period - 1, 0)));
	}

	const rsiByPeriod = new Map<number, Array<number | undefined>>();
	for (const period of plan.rsiPeriods) {
		rsiByPeriod.set(period, blankUntil(rsiSeries(closes, period), Math.max(period, 1)));
	}

	const macdByKey = new Map<string, Array<IndicatorMacdValue | undefined>>();
	for (const [key, config] of plan.macdConfigs) {
		const macd = macdSeries(closes, config.fast, config.slow, config.signal);
		const macdLine = blankUntil(macd.macd, Math.max(config.slow - 1, 0));
		const signalLine = blankUntil(macd.signal, Math.max(config.slow - 1, 0));
		const histogramLine = blankUntil(macd.histogram, Math.max(config.slow - 1, 0));
		macdByKey.set(key, raw.map((_, index) => {
			const macdValue = macdLine[index];
			const signalValue = signalLine[index];
			const histogramValue = histogramLine[index];
			if (macdValue === undefined || signalValue === undefined || histogramValue === undefined) {
				return undefined;
			}
			return {
				macd: macdValue,
				signal: signalValue,
				divergence: histogramValue,
			};
		}));
	}

	const bollingerByKey = new Map<string, Array<IndicatorBandValue | undefined>>();
	for (const [key, config] of plan.bollingerConfigs) {
		const series = bollingerSeries(closes, config.period, config.stdDev);
		bollingerByKey.set(key, mergeBand(series.upper, series.middle, series.lower, Math.max(config.period - 1, 0)));
	}

	const cvd = calcCVDApprox(raw);
	const strength = calcStrengthElder(raw);

	// CE15 indicators
	const bbi: Array<number | undefined> = plan.bbiEnabled
		? bbiSeries(raw)
		: new Array(raw.length).fill(undefined) as Array<undefined>;

	const sarByKey = new Map<string, Array<number | undefined>>();
	for (const [key, config] of plan.sarByKey) {
		sarByKey.set(key, blankUntil(sarSeries(raw, config.afStep, config.afMax), 1));
	}

	const obv: Array<number | undefined> = plan.obvEnabled
		? (obvSeries(raw) as Array<number | undefined>)
		: new Array(raw.length).fill(undefined) as Array<undefined>;

	const wrByPeriod = new Map<number, Array<number | undefined>>();
	for (const period of plan.wrPeriods) {
		wrByPeriod.set(period, blankUntil(wrSeries(raw, period), Math.max(period - 1, 0)));
	}

	const vrByPeriod = new Map<number, Array<number | undefined>>();
	for (const period of plan.vrPeriods) {
		vrByPeriod.set(period, blankUntil(vrSeries(raw, period), Math.max(period, 1)));
	}

	const kdjByKey = new Map<string, Array<IndicatorKdjValue | undefined>>();
	for (const [key, config] of plan.kdjConfigs) {
		const series = kdjSeries(raw, config.period, config.m1, config.m2);
		kdjByKey.set(key, raw.map((_, index) => {
			const k = series.k[index];
			const d = series.d[index];
			const j = series.j[index];
			if (!Number.isFinite(k) || !Number.isFinite(d) || !Number.isFinite(j)) {
				return undefined;
			}
			return { k, d, j };
		}));
	}

	const cciByPeriod = new Map<number, Array<number | undefined>>();
	for (const period of plan.cciPeriods) {
		cciByPeriod.set(period, blankUntil(cciSeries(raw, period), Math.max(period - 1, 0)));
	}

	const dmiByPeriod = new Map<number, Array<IndicatorDmiValue | undefined>>();
	for (const period of plan.dmiPeriods) {
		const series = dmiSeries(raw, period);
		dmiByPeriod.set(period, raw.map((_, index) => {
			const plusDI = series.plusDI[index];
			const minusDI = series.minusDI[index];
			const adx = series.adx[index];
			if (!Number.isFinite(plusDI) || !Number.isFinite(minusDI) || !Number.isFinite(adx)) {
				return undefined;
			}
			return { plusDI, minusDI, adx };
		}));
	}

	const biasByPeriod = new Map<number, Array<number | undefined>>();
	for (const period of plan.biasPeriods) {
		biasByPeriod.set(period, blankUntil(biasSeries(raw, period), Math.max(period - 1, 0)));
	}

	const brarByPeriod = new Map<number, Array<IndicatorBrarValue | undefined>>();
	for (const period of plan.brarPeriods) {
		const series = brarSeries(raw, period);
		brarByPeriod.set(period, raw.map((_, index) => {
			const ar = series.ar[index];
			const br = series.br[index];
			if (!Number.isFinite(ar) || !Number.isFinite(br)) {
				return undefined;
			}
			return { ar, br };
		}));
	}

	const mtmByKey = new Map<string, Array<IndicatorMtmValue | undefined>>();
	for (const [key, config] of plan.mtmConfigs) {
		const series = mtmSeries(raw, config.period, config.signalPeriod);
		mtmByKey.set(key, raw.map((_, index) => {
			const mtm = series.mtm[index];
			const signal = series.signal[index];
			if (!Number.isFinite(mtm) || !Number.isFinite(signal)) {
				return undefined;
			}
			return { mtm, signal };
		}));
	}

	const emvByPeriod = new Map<number, Array<IndicatorEmvValue | undefined>>();
	for (const period of plan.emvPeriods) {
		const series = emvSeries(raw, period);
		emvByPeriod.set(period, raw.map((_, index) => {
			const emv = series.emv[index];
			const signal = series.signal[index];
			if (!Number.isFinite(emv) || !Number.isFinite(signal)) {
				return undefined;
			}
			return { emv, signal };
		}));
	}

	const ao = plan.aoEnabled
		? blankUntil(aoSeries(raw), 33)
		: new Array(raw.length).fill(undefined) as Array<undefined>;

	const rocByPeriod = new Map<number, Array<number | undefined>>();
	for (const period of plan.rocPeriods) {
		rocByPeriod.set(period, blankUntil(rocSeries(raw, period), Math.max(period, 0)));
	}

	const trixByKey = new Map<string, Array<IndicatorTrixValue | undefined>>();
	for (const [key, config] of plan.trixConfigs) {
		const series = trixSeries(raw, config.period, config.signalPeriod);
		const warmup = Math.max(config.period * 3 - 3, config.signalPeriod - 1, 0);
		const trixValues = blankUntil(series.trix, warmup);
		const signalValues = blankUntil(series.signal, warmup);
		trixByKey.set(key, raw.map((_, index) => {
			const trix = trixValues[index];
			const signal = signalValues[index];
			if (!Number.isFinite(trix ?? NaN) || !Number.isFinite(signal ?? NaN)) {
				return undefined;
			}
			return { trix: trix!, signal: signal! };
		}));
	}

	const dmaByKey = new Map<string, Array<IndicatorDmaValue | undefined>>();
	for (const [key, config] of plan.dmaConfigs) {
		const series = dmaSeries(raw, config.fastPeriod, config.slowPeriod, config.signalPeriod);
		const warmup = Math.max(config.slowPeriod - 1, 0);
		const dddValues = blankUntil(series.ddd, warmup);
		const amaValues = blankUntil(series.ama, warmup);
		dmaByKey.set(key, raw.map((_, index) => {
			const ddd = dddValues[index];
			const ama = amaValues[index];
			if (!Number.isFinite(ddd ?? NaN) || !Number.isFinite(ama ?? NaN)) {
				return undefined;
			}
			return { ddd: ddd!, ama: ama! };
		}));
	}

	const pvt = plan.pvtEnabled
		? (pvtSeries(raw) as Array<number | undefined>)
		: new Array(raw.length).fill(undefined) as Array<undefined>;

	const psyByKey = new Map<string, Array<IndicatorPsyValue | undefined>>();
	for (const [key, config] of plan.psyConfigs) {
		const series = psySeries(raw, config.period, config.signalPeriod);
		psyByKey.set(key, raw.map((_, index) => {
			const psy = series.psy[index];
			const signal = series.signal[index];
			if (!Number.isFinite(psy) || !Number.isFinite(signal)) {
				return undefined;
			}
			return { psy, signal };
		}));
	}

	const crByKey = new Map<string, Array<IndicatorCrValue | undefined>>();
	for (const [key, config] of plan.crConfigs) {
		const series = crSeries(raw, config.period, config.m1, config.m2, config.m3, config.m4);
		crByKey.set(key, raw.map((_, index) => {
			const cr = series.cr[index];
			const ma1 = series.ma1[index];
			const ma2 = series.ma2[index];
			const ma3 = series.ma3[index];
			const ma4 = series.ma4[index];
			if (!Number.isFinite(cr) || !Number.isFinite(ma1) || !Number.isFinite(ma2) || !Number.isFinite(ma3) || !Number.isFinite(ma4)) {
				return undefined;
			}
			return { cr, ma1, ma2, ma3, ma4 };
		}));
	}

	const whaleByKey = new Map<string, Array<IndicatorWhaleValue | undefined>>();
	for (const threshold of plan.whaleThresholds) {
		const key = indicatorKey(defaultSeries("Whale", { threshold }));
		if (!key) {
			continue;
		}
		whaleByKey.set(
			key,
			calcWhaleApprox(raw, threshold).map((point) => (
				point.whaleBuyVol === undefined && point.whaleSellVol === undefined
					? undefined
					: { whaleBuyVol: point.whaleBuyVol, whaleSellVol: point.whaleSellVol }
			)),
		);
	}

	return {
		emaByPeriod,
		smaByPeriod,
		rsiByPeriod,
		macdByKey,
		bollingerByKey,
		whaleByKey,
		bbi,
		sarByKey,
		obv,
		wrByPeriod,
		vrByPeriod,
		kdjByKey,
		cciByPeriod,
		dmiByPeriod,
		biasByPeriod,
		brarByPeriod,
		mtmByKey,
		emvByPeriod,
		ao,
		rocByPeriod,
		trixByKey,
		dmaByKey,
		pvt,
		psyByKey,
		crByKey,
		cvd,
		strength,
	};
}

export function materializeIndicatorValues(index: number, plan: IndicatorComputationPlan, result: IndicatorComputationResult): Record<string, IndicatorDatumValue | undefined> {
	const indicatorValues: Record<string, IndicatorDatumValue | undefined> = {};

	for (const [period, values] of result.emaByPeriod) {
		const key = indicatorKey(defaultSeries("EMA", { period }));
		const value = values[index];
		if (key && value !== undefined) {
			indicatorValues[key] = value;
		}
	}

	for (const [period, values] of result.smaByPeriod) {
		const key = indicatorKey(defaultSeries("MA", { period }));
		const value = values[index];
		if (key && value !== undefined) {
			indicatorValues[key] = value;
		}
	}

	for (const [period, values] of result.rsiByPeriod) {
		const key = indicatorKey(defaultSeries("RSI", { period }));
		const value = values[index];
		if (key && value !== undefined) {
			indicatorValues[key] = value;
		}
	}

	for (const [key, values] of result.macdByKey) {
		const value = values[index];
		if (value !== undefined) {
			indicatorValues[key] = value;
		}
	}

	for (const [key, values] of result.bollingerByKey) {
		const value = values[index];
		if (value !== undefined) {
			indicatorValues[key] = value;
		}
	}

	for (const [key, values] of result.whaleByKey) {
		const value = values[index];
		if (value !== undefined) {
			indicatorValues[key] = value;
		}
	}

	// CE15 — SAR, WR, VR go into indicatorValues map
	for (const [key, values] of result.sarByKey) {
		const value = values[index];
		if (value !== undefined) {
			indicatorValues[key] = value;
		}
	}

	for (const [period, values] of result.wrByPeriod) {
		const key = indicatorKey(defaultSeries("WR", { period }));
		const value = values[index];
		if (key && value !== undefined) {
			indicatorValues[key] = value;
		}
	}

	for (const [period, values] of result.vrByPeriod) {
		const key = indicatorKey(defaultSeries("VR", { period }));
		const value = values[index];
		if (key && value !== undefined) {
			indicatorValues[key] = value;
		}
	}

	for (const [key, values] of result.kdjByKey) {
		const value = values[index];
		if (value !== undefined) {
			indicatorValues[key] = value;
		}
	}

	for (const [period, values] of result.cciByPeriod) {
		const key = indicatorKey(defaultSeries("CCI", { period }));
		const value = values[index];
		if (key && value !== undefined) {
			indicatorValues[key] = value;
		}
	}

	for (const [period, values] of result.dmiByPeriod) {
		const key = indicatorKey(defaultSeries("DMI", { period }));
		const value = values[index];
		if (key && value !== undefined) {
			indicatorValues[key] = value;
		}
	}

	for (const [period, values] of result.biasByPeriod) {
		const key = indicatorKey(defaultSeries("BIAS", { period }));
		const value = values[index];
		if (key && value !== undefined) {
			indicatorValues[key] = value;
		}
	}

	for (const [period, values] of result.brarByPeriod) {
		const key = indicatorKey(defaultSeries("BRAR", { period }));
		const value = values[index];
		if (key && value !== undefined) {
			indicatorValues[key] = value;
		}
	}

	for (const [key, values] of result.mtmByKey) {
		const value = values[index];
		if (value !== undefined) {
			indicatorValues[key] = value;
		}
	}

	for (const [period, values] of result.emvByPeriod) {
		const key = indicatorKey(defaultSeries("EMV", { period }));
		const value = values[index];
		if (key && value !== undefined) {
			indicatorValues[key] = value;
		}
	}

	const aoKey = indicatorKey(defaultSeries("AO"));
	if (aoKey && result.ao[index] !== undefined) {
		indicatorValues[aoKey] = result.ao[index];
	}

	for (const [period, values] of result.rocByPeriod) {
		const key = indicatorKey(defaultSeries("ROC", { period }));
		const value = values[index];
		if (key && value !== undefined) {
			indicatorValues[key] = value;
		}
	}

	for (const [key, values] of result.trixByKey) {
		const value = values[index];
		if (value !== undefined) {
			indicatorValues[key] = value;
		}
	}

	for (const [key, values] of result.dmaByKey) {
		const value = values[index];
		if (value !== undefined) {
			indicatorValues[key] = value;
		}
	}

	const pvtKey = indicatorKey(defaultSeries("PVT"));
	if (pvtKey && result.pvt[index] !== undefined) {
		indicatorValues[pvtKey] = result.pvt[index];
	}

	for (const [key, values] of result.psyByKey) {
		const value = values[index];
		if (value !== undefined) {
			indicatorValues[key] = value;
		}
	}

	for (const [key, values] of result.crByKey) {
		const value = values[index];
		if (value !== undefined) {
			indicatorValues[key] = value;
		}
	}

	return indicatorValues;
}
