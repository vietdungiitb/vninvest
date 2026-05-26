import type {
	EnrichedDatum,
	IndicatorBandValue,
	IndicatorBrarValue,
	IndicatorCrValue,
	IndicatorDmaValue,
	IndicatorDmiValue,
	IndicatorEmvValue,
	IndicatorDatumValue,
	IndicatorKdjValue,
	IndicatorMacdValue,
	IndicatorMtmValue,
	IndicatorPsyValue,
	IndicatorTrixValue,
	IndicatorWhaleValue,
} from "./calculators/types";
import type { SeriesConfig } from "./types/pane-descriptor";

function numberParam(series: SeriesConfig, key: string, fallback: number) {
	const value = series.params?.[key];
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function exactLegacyValue(datum: EnrichedDatum, series: SeriesConfig): IndicatorDatumValue | undefined {
	switch (series.type) {
		case "EMA": {
			const period = numberParam(series, "period", 20);
			if (period === 13) return datum.ema13;
			if (period === 20) return datum.ema20;
			if (period === 50) return datum.ema50;
			return undefined;
		}
		case "MA":
			return undefined;
		case "BollingerBand": {
			const period = numberParam(series, "period", 20);
			const stdDev = numberParam(series, "stdDev", 2);
			return period === 20 && stdDev === 2 ? datum.bollingerBand : undefined;
		}
		case "RSI": {
			const period = numberParam(series, "period", 14);
			return period === 14 ? datum.rsi : undefined;
		}
		case "MACD": {
			const fast = numberParam(series, "fast", 12);
			const slow = numberParam(series, "slow", 26);
			const signal = numberParam(series, "signal", 9);
			return fast === 12 && slow === 26 && signal === 9 ? datum.macd : undefined;
		}
		case "Whale": {
			const threshold = numberParam(series, "threshold", 50_000);
			return threshold === 50_000
				? { whaleBuyVol: datum.whaleBuyVol, whaleSellVol: datum.whaleSellVol }
				: undefined;
		}
		case "KDJ": {
			const period = numberParam(series, "period", 9);
			const m1 = numberParam(series, "m1", 3);
			const m2 = numberParam(series, "m2", 3);
			return period === 9 && m1 === 3 && m2 === 3 ? datum.kdj : undefined;
		}
		case "CCI": {
			const period = numberParam(series, "period", 20);
			return period === 20 ? datum.cci : undefined;
		}
		case "DMI": {
			const period = numberParam(series, "period", 14);
			return period === 14 ? datum.dmi : undefined;
		}
		case "BIAS": {
			const period = numberParam(series, "period", 6);
			return period === 6 ? datum.bias : undefined;
		}
		case "BRAR": {
			const period = numberParam(series, "period", 26);
			return period === 26 ? datum.brar : undefined;
		}
		case "MTM": {
			const period = numberParam(series, "period", 6);
			const signalPeriod = numberParam(series, "signalPeriod", 6);
			return period === 6 && signalPeriod === 6 ? datum.mtm : undefined;
		}
		case "EMV": {
			const period = numberParam(series, "period", 14);
			return period === 14 ? datum.emv : undefined;
		}
		case "AO":
			return datum.ao;
		case "ROC": {
			const period = numberParam(series, "period", 12);
			return period === 12 ? datum.roc : undefined;
		}
		case "TRIX": {
			const period = numberParam(series, "period", 12);
			const signalPeriod = numberParam(series, "signalPeriod", 9);
			return period === 12 && signalPeriod === 9 ? datum.trix : undefined;
		}
		case "DMA": {
			const fastPeriod = numberParam(series, "fastPeriod", 10);
			const slowPeriod = numberParam(series, "slowPeriod", 50);
			const signalPeriod = numberParam(series, "signalPeriod", 10);
			return fastPeriod === 10 && slowPeriod === 50 && signalPeriod === 10 ? datum.dma : undefined;
		}
		case "PVT":
			return datum.pvt;
		case "PSY": {
			const period = numberParam(series, "period", 12);
			const signalPeriod = numberParam(series, "signalPeriod", 6);
			return period === 12 && signalPeriod === 6 ? datum.psy : undefined;
		}
		case "CR": {
			const period = numberParam(series, "period", 26);
			const m1 = numberParam(series, "m1", 10);
			const m2 = numberParam(series, "m2", 20);
			const m3 = numberParam(series, "m3", 40);
			const m4 = numberParam(series, "m4", 60);
			return period === 26 && m1 === 10 && m2 === 20 && m3 === 40 && m4 === 60 ? datum.cr : undefined;
		}
		default:
			return undefined;
	}
}

function asNumber(value: IndicatorDatumValue | undefined, pick?: (value: IndicatorDatumValue) => number | undefined) {
	if (value === undefined) {
		return undefined;
	}
	if (typeof value === "number") {
		return value;
	}
	return pick?.(value);
}

export function buildIndicatorSeriesKey(series: SeriesConfig): string | undefined {
	switch (series.type) {
		case "EMA":
			return `EMA:period=${numberParam(series, "period", 20)}`;
		case "MA":
			return `MA:period=${numberParam(series, "period", 20)}`;
		case "BollingerBand":
			return `BollingerBand:period=${numberParam(series, "period", 20)}:stdDev=${numberParam(series, "stdDev", 2)}`;
		case "RSI":
			return `RSI:period=${numberParam(series, "period", 14)}`;
		case "MACD":
			return `MACD:fast=${numberParam(series, "fast", 12)}:slow=${numberParam(series, "slow", 26)}:signal=${numberParam(series, "signal", 9)}`;
		case "Whale":
			return `Whale:threshold=${numberParam(series, "threshold", 50_000)}`;
		case "SAR":
			return `SAR:afStep=${numberParam(series, "afStep", 0.02)}:afMax=${numberParam(series, "afMax", 0.2)}`;
		case "WR":
			return `WR:period=${numberParam(series, "period", 14)}`;
		case "VR":
			return `VR:period=${numberParam(series, "period", 26)}`;
		case "KDJ":
			return `KDJ:period=${numberParam(series, "period", 9)}:m1=${numberParam(series, "m1", 3)}:m2=${numberParam(series, "m2", 3)}`;
		case "CCI":
			return `CCI:period=${numberParam(series, "period", 20)}`;
		case "DMI":
			return `DMI:period=${numberParam(series, "period", 14)}`;
		case "BIAS":
			return `BIAS:period=${numberParam(series, "period", 6)}`;
		case "BRAR":
			return `BRAR:period=${numberParam(series, "period", 26)}`;
		case "MTM":
			return `MTM:period=${numberParam(series, "period", 6)}:signalPeriod=${numberParam(series, "signalPeriod", 6)}`;
		case "EMV":
			return `EMV:period=${numberParam(series, "period", 14)}`;
		case "AO":
			return "AO";
		case "ROC":
			return `ROC:period=${numberParam(series, "period", 12)}`;
		case "TRIX":
			return `TRIX:period=${numberParam(series, "period", 12)}:signalPeriod=${numberParam(series, "signalPeriod", 9)}`;
		case "DMA":
			return `DMA:fastPeriod=${numberParam(series, "fastPeriod", 10)}:slowPeriod=${numberParam(series, "slowPeriod", 50)}:signalPeriod=${numberParam(series, "signalPeriod", 10)}`;
		case "PVT":
			return "PVT";
		case "PSY":
			return `PSY:period=${numberParam(series, "period", 12)}:signalPeriod=${numberParam(series, "signalPeriod", 6)}`;
		case "CR":
			return `CR:period=${numberParam(series, "period", 26)}:m1=${numberParam(series, "m1", 10)}:m2=${numberParam(series, "m2", 20)}:m3=${numberParam(series, "m3", 40)}:m4=${numberParam(series, "m4", 60)}`;
		default:
			return undefined;
	}
}

export function resolveSeriesDatumValue(datum: EnrichedDatum, series: SeriesConfig): IndicatorDatumValue | undefined {
	const key = buildIndicatorSeriesKey(series);
	if (key) {
		const value = datum.indicatorValues?.[key];
		if (value !== undefined) {
			return value;
		}
	}

	return exactLegacyValue(datum, series);
}

export function resolveSeriesValue(datum: EnrichedDatum, series: SeriesConfig): number | undefined {
	switch (series.type) {
		case "Candlestick":
		case "HollowCandle":
		case "OHLC":
		case "HeikinAshi":
		case "Line":
		case "Area":
		case "Bar":
			return datum.close;
		case "Volume":
			return datum.volume;
		case "EMA":
		case "MA":
		case "RSI":
		case "CVDApprox":
		case "CVDRealtime":
		case "StrengthRelative":
		case "CCI":
		case "BIAS":
		case "AO":
		case "ROC":
		case "PVT":
		case "WR":
		case "VR":
			return asNumber(resolveSeriesDatumValue(datum, series));
		case "KDJ":
			return asNumber(resolveSeriesDatumValue(datum, series), (value) => (value as IndicatorKdjValue).j);
		case "DMI":
			return asNumber(resolveSeriesDatumValue(datum, series), (value) => (value as IndicatorDmiValue).adx);
		case "BBI":
			return datum.bbi;
		case "SAR":
			return datum.sar ?? asNumber(resolveSeriesDatumValue(datum, series));
		case "OBV":
			return datum.obv;
		case "BRAR":
			return asNumber(resolveSeriesDatumValue(datum, series), (value) => (value as IndicatorBrarValue).br);
		case "MTM":
			return asNumber(resolveSeriesDatumValue(datum, series), (value) => (value as IndicatorMtmValue).mtm);
		case "EMV":
			return asNumber(resolveSeriesDatumValue(datum, series), (value) => (value as IndicatorEmvValue).emv);
		case "MACD":
			return asNumber(resolveSeriesDatumValue(datum, series), (value) => (value as IndicatorMacdValue).macd);
		case "BollingerBand":
			return asNumber(resolveSeriesDatumValue(datum, series), (value) => (value as IndicatorBandValue).middle);
		case "Whale":
			return asNumber(resolveSeriesDatumValue(datum, series), (value) => {
				const whale = value as IndicatorWhaleValue;
				return whale.whaleBuyVol ?? whale.whaleSellVol;
			});
		case "TRIX":
			return asNumber(resolveSeriesDatumValue(datum, series), (value) => (value as IndicatorTrixValue).trix);
		case "DMA":
			return asNumber(resolveSeriesDatumValue(datum, series), (value) => (value as IndicatorDmaValue).ddd);
		case "PSY":
			return asNumber(resolveSeriesDatumValue(datum, series), (value) => (value as IndicatorPsyValue).psy);
		case "CR":
			return asNumber(resolveSeriesDatumValue(datum, series), (value) => (value as IndicatorCrValue).cr);
		case "StrengthElder":
			return datum.bullPower;
		default:
			return datum.close;
	}
}

export function resolveSeriesStructuredValue(datum: EnrichedDatum, series: SeriesConfig) {
	switch (series.type) {
		case "BollingerBand":
			return (resolveSeriesDatumValue(datum, series) as IndicatorBandValue | undefined) ?? datum.bollingerBand;
		case "MACD":
			return (resolveSeriesDatumValue(datum, series) as IndicatorMacdValue | undefined) ?? datum.macd;
		case "Whale":
			return (resolveSeriesDatumValue(datum, series) as IndicatorWhaleValue | undefined)
				?? { whaleBuyVol: datum.whaleBuyVol, whaleSellVol: datum.whaleSellVol };
			case "KDJ":
				return (resolveSeriesDatumValue(datum, series) as IndicatorKdjValue | undefined) ?? datum.kdj;
			case "DMI":
				return (resolveSeriesDatumValue(datum, series) as IndicatorDmiValue | undefined) ?? datum.dmi;
			case "BRAR":
				return (resolveSeriesDatumValue(datum, series) as IndicatorBrarValue | undefined) ?? datum.brar;
			case "MTM":
				return (resolveSeriesDatumValue(datum, series) as IndicatorMtmValue | undefined) ?? datum.mtm;
			case "EMV":
				return (resolveSeriesDatumValue(datum, series) as IndicatorEmvValue | undefined) ?? datum.emv;
			case "TRIX":
				return (resolveSeriesDatumValue(datum, series) as IndicatorTrixValue | undefined) ?? datum.trix;
			case "DMA":
				return (resolveSeriesDatumValue(datum, series) as IndicatorDmaValue | undefined) ?? datum.dma;
			case "PSY":
				return (resolveSeriesDatumValue(datum, series) as IndicatorPsyValue | undefined) ?? datum.psy;
			case "CR":
				return (resolveSeriesDatumValue(datum, series) as IndicatorCrValue | undefined) ?? datum.cr;
		case "StrengthElder":
			return { bullPower: datum.bullPower, bearPower: datum.bearPower };
		default:
			return resolveSeriesDatumValue(datum, series);
	}
}

export function resolveSeriesValueAccessors(series: SeriesConfig): Array<(datum: EnrichedDatum) => number | undefined> {
	switch (series.type) {
		case "Candlestick":
		case "HollowCandle":
		case "OHLC":
		case "HeikinAshi":
			return [(datum) => datum.low, (datum) => datum.high];
		case "Volume":
			return [(datum) => datum.volume];
		case "EMA":
		case "MA":
		case "RSI":
		case "CVDApprox":
		case "CVDRealtime":
		case "StrengthRelative":
		case "Line":
		case "Area":
		case "Bar":
		case "CCI":
		case "BIAS":
		case "AO":
		case "ROC":
		case "PVT":
			return [(datum) => resolveSeriesValue(datum, series)];
		case "KDJ":
			return [
				(datum) => (resolveSeriesStructuredValue(datum, series) as IndicatorKdjValue | undefined)?.k,
				(datum) => (resolveSeriesStructuredValue(datum, series) as IndicatorKdjValue | undefined)?.d,
				(datum) => (resolveSeriesStructuredValue(datum, series) as IndicatorKdjValue | undefined)?.j,
			];
		case "DMI":
			return [
				(datum) => (resolveSeriesStructuredValue(datum, series) as IndicatorDmiValue | undefined)?.plusDI,
				(datum) => (resolveSeriesStructuredValue(datum, series) as IndicatorDmiValue | undefined)?.minusDI,
				(datum) => (resolveSeriesStructuredValue(datum, series) as IndicatorDmiValue | undefined)?.adx,
			];
		case "BRAR":
			return [
				(datum) => (resolveSeriesStructuredValue(datum, series) as IndicatorBrarValue | undefined)?.ar,
				(datum) => (resolveSeriesStructuredValue(datum, series) as IndicatorBrarValue | undefined)?.br,
			];
		case "MTM":
			return [
				(datum) => (resolveSeriesStructuredValue(datum, series) as IndicatorMtmValue | undefined)?.mtm,
				(datum) => (resolveSeriesStructuredValue(datum, series) as IndicatorMtmValue | undefined)?.signal,
			];
		case "EMV":
			return [
				(datum) => (resolveSeriesStructuredValue(datum, series) as IndicatorEmvValue | undefined)?.emv,
				(datum) => (resolveSeriesStructuredValue(datum, series) as IndicatorEmvValue | undefined)?.signal,
			];
		case "BollingerBand":
			return [
				(datum) => (resolveSeriesStructuredValue(datum, series) as IndicatorBandValue | undefined)?.top,
				(datum) => (resolveSeriesStructuredValue(datum, series) as IndicatorBandValue | undefined)?.middle,
				(datum) => (resolveSeriesStructuredValue(datum, series) as IndicatorBandValue | undefined)?.bottom,
			];
		case "MACD":
			return [
				(datum) => (resolveSeriesStructuredValue(datum, series) as IndicatorMacdValue | undefined)?.macd,
				(datum) => (resolveSeriesStructuredValue(datum, series) as IndicatorMacdValue | undefined)?.signal,
				(datum) => (resolveSeriesStructuredValue(datum, series) as IndicatorMacdValue | undefined)?.divergence,
			];
		case "TRIX":
			return [
				(datum) => (resolveSeriesStructuredValue(datum, series) as IndicatorTrixValue | undefined)?.trix,
				(datum) => (resolveSeriesStructuredValue(datum, series) as IndicatorTrixValue | undefined)?.signal,
			];
		case "DMA":
			return [
				(datum) => (resolveSeriesStructuredValue(datum, series) as IndicatorDmaValue | undefined)?.ddd,
				(datum) => (resolveSeriesStructuredValue(datum, series) as IndicatorDmaValue | undefined)?.ama,
			];
		case "PSY":
			return [
				(datum) => (resolveSeriesStructuredValue(datum, series) as IndicatorPsyValue | undefined)?.psy,
				(datum) => (resolveSeriesStructuredValue(datum, series) as IndicatorPsyValue | undefined)?.signal,
			];
		case "CR":
			return [
				(datum) => (resolveSeriesStructuredValue(datum, series) as IndicatorCrValue | undefined)?.cr,
				(datum) => (resolveSeriesStructuredValue(datum, series) as IndicatorCrValue | undefined)?.ma1,
				(datum) => (resolveSeriesStructuredValue(datum, series) as IndicatorCrValue | undefined)?.ma2,
				(datum) => (resolveSeriesStructuredValue(datum, series) as IndicatorCrValue | undefined)?.ma3,
				(datum) => (resolveSeriesStructuredValue(datum, series) as IndicatorCrValue | undefined)?.ma4,
			];
		case "StrengthElder":
			return [(datum) => datum.bullPower, (datum) => datum.bearPower];
		case "Whale":
			return [
				(datum) => (resolveSeriesStructuredValue(datum, series) as IndicatorWhaleValue | undefined)?.whaleBuyVol,
				(datum) => (resolveSeriesStructuredValue(datum, series) as IndicatorWhaleValue | undefined)?.whaleSellVol,
			];
		default:
			return [(datum) => resolveSeriesValue(datum, series)];
	}
}