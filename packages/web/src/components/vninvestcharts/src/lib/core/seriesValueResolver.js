function numberParam(series, key, fallback) {
    const value = series.params?.[key];
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function asNumber(value, pick) {
    if (value === undefined) {
        return undefined;
    }
    if (typeof value === "number") {
        return value;
    }
    return pick?.(value);
}
export function buildIndicatorSeriesKey(series) {
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
        case "CVDApprox":
            return "CVDApprox";
        case "CVDRealtime":
            return "CVDRealtime";
        case "StrengthElder":
            return "StrengthElder";
        case "BBI":
            return "BBI";
        case "OBV":
            return "OBV";
        default:
            return undefined;
    }
}
export function resolveSeriesDatumValue(datum, series) {
    const key = buildIndicatorSeriesKey(series);
    if (key) {
        return datum.indicatorValues?.[key];
    }
    return undefined;
}
export function resolveSeriesValue(datum, series) {
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
            return asNumber(resolveSeriesDatumValue(datum, series), (value) => value.j);
        case "DMI":
            return asNumber(resolveSeriesDatumValue(datum, series), (value) => value.adx);
        case "BBI":
            return asNumber(resolveSeriesDatumValue(datum, series));
        case "SAR":
            return asNumber(resolveSeriesDatumValue(datum, series));
        case "OBV":
            return asNumber(resolveSeriesDatumValue(datum, series));
        case "BRAR":
            return asNumber(resolveSeriesDatumValue(datum, series), (value) => value.br);
        case "MTM":
            return asNumber(resolveSeriesDatumValue(datum, series), (value) => value.mtm);
        case "EMV":
            return asNumber(resolveSeriesDatumValue(datum, series), (value) => value.emv);
        case "MACD":
            return asNumber(resolveSeriesDatumValue(datum, series), (value) => value.macd);
        case "BollingerBand":
            return asNumber(resolveSeriesDatumValue(datum, series), (value) => value.middle);
        case "Whale":
            return asNumber(resolveSeriesDatumValue(datum, series), (value) => {
                const whale = value;
                return whale.whaleBuyVol ?? whale.whaleSellVol;
            });
        case "TRIX":
            return asNumber(resolveSeriesDatumValue(datum, series), (value) => value.trix);
        case "DMA":
            return asNumber(resolveSeriesDatumValue(datum, series), (value) => value.ddd);
        case "PSY":
            return asNumber(resolveSeriesDatumValue(datum, series), (value) => value.psy);
        case "CR":
            return asNumber(resolveSeriesDatumValue(datum, series), (value) => value.cr);
        case "StrengthElder":
            return asNumber(resolveSeriesDatumValue(datum, series), (value) => value.bullPower);
        default:
            return datum.close;
    }
}
export function resolveSeriesStructuredValue(datum, series) {
    switch (series.type) {
        case "BollingerBand":
            return resolveSeriesDatumValue(datum, series);
        case "MACD":
            return resolveSeriesDatumValue(datum, series);
        case "Whale":
            return resolveSeriesDatumValue(datum, series);
        case "KDJ":
            return resolveSeriesDatumValue(datum, series);
        case "DMI":
            return resolveSeriesDatumValue(datum, series);
        case "BRAR":
            return resolveSeriesDatumValue(datum, series);
        case "MTM":
            return resolveSeriesDatumValue(datum, series);
        case "EMV":
            return resolveSeriesDatumValue(datum, series);
        case "TRIX":
            return resolveSeriesDatumValue(datum, series);
        case "DMA":
            return resolveSeriesDatumValue(datum, series);
        case "PSY":
            return resolveSeriesDatumValue(datum, series);
        case "CR":
            return resolveSeriesDatumValue(datum, series);
        case "StrengthElder":
            return resolveSeriesDatumValue(datum, series);
        default:
            return resolveSeriesDatumValue(datum, series);
    }
}
export function resolveSeriesValueAccessors(series) {
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
                (datum) => resolveSeriesStructuredValue(datum, series)?.k,
                (datum) => resolveSeriesStructuredValue(datum, series)?.d,
                (datum) => resolveSeriesStructuredValue(datum, series)?.j,
            ];
        case "DMI":
            return [
                (datum) => resolveSeriesStructuredValue(datum, series)?.plusDI,
                (datum) => resolveSeriesStructuredValue(datum, series)?.minusDI,
                (datum) => resolveSeriesStructuredValue(datum, series)?.adx,
            ];
        case "BRAR":
            return [
                (datum) => resolveSeriesStructuredValue(datum, series)?.ar,
                (datum) => resolveSeriesStructuredValue(datum, series)?.br,
            ];
        case "MTM":
            return [
                (datum) => resolveSeriesStructuredValue(datum, series)?.mtm,
                (datum) => resolveSeriesStructuredValue(datum, series)?.signal,
            ];
        case "EMV":
            return [
                (datum) => resolveSeriesStructuredValue(datum, series)?.emv,
                (datum) => resolveSeriesStructuredValue(datum, series)?.signal,
            ];
        case "BollingerBand":
            return [
                (datum) => resolveSeriesStructuredValue(datum, series)?.top,
                (datum) => resolveSeriesStructuredValue(datum, series)?.middle,
                (datum) => resolveSeriesStructuredValue(datum, series)?.bottom,
            ];
        case "MACD":
            return [
                (datum) => resolveSeriesStructuredValue(datum, series)?.macd,
                (datum) => resolveSeriesStructuredValue(datum, series)?.signal,
                (datum) => resolveSeriesStructuredValue(datum, series)?.divergence,
            ];
        case "TRIX":
            return [
                (datum) => resolveSeriesStructuredValue(datum, series)?.trix,
                (datum) => resolveSeriesStructuredValue(datum, series)?.signal,
            ];
        case "DMA":
            return [
                (datum) => resolveSeriesStructuredValue(datum, series)?.ddd,
                (datum) => resolveSeriesStructuredValue(datum, series)?.ama,
            ];
        case "PSY":
            return [
                (datum) => resolveSeriesStructuredValue(datum, series)?.psy,
                (datum) => resolveSeriesStructuredValue(datum, series)?.signal,
            ];
        case "CR":
            return [
                (datum) => resolveSeriesStructuredValue(datum, series)?.cr,
                (datum) => resolveSeriesStructuredValue(datum, series)?.ma1,
                (datum) => resolveSeriesStructuredValue(datum, series)?.ma2,
                (datum) => resolveSeriesStructuredValue(datum, series)?.ma3,
                (datum) => resolveSeriesStructuredValue(datum, series)?.ma4,
            ];
        case "StrengthElder":
            return [
                (datum) => resolveSeriesStructuredValue(datum, series)?.bullPower,
                (datum) => resolveSeriesStructuredValue(datum, series)?.bearPower,
            ];
        case "Whale":
            return [
                (datum) => resolveSeriesStructuredValue(datum, series)?.whaleBuyVol,
                (datum) => resolveSeriesStructuredValue(datum, series)?.whaleSellVol,
            ];
        default:
            return [(datum) => resolveSeriesValue(datum, series)];
    }
}
