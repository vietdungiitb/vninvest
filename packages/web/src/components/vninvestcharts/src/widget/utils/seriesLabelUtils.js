export var seriesLabelKeys = {
    Candlestick: "indicator.candlestick",
    HollowCandle: "indicator.hollowCandle",
    OHLC: "indicator.ohlc",
    HeikinAshi: "indicator.heikinAshi",
    Line: "indicator.line",
    Area: "indicator.area",
    Bar: "indicator.bar",
    Volume: "indicator.volume",
    EMA: "indicator.ema",
    BollingerBand: "indicator.bollingerBand",
    RSI: "indicator.rsi",
    MACD: "indicator.macd",
    CVDApprox: "indicator.cvdApprox",
    CVDRealtime: "indicator.cvdRealtime",
    StrengthElder: "indicator.strengthElder",
    StrengthRelative: "indicator.strengthRelative",
    Whale: "indicator.whale",
    MA: "indicator.ma",
    BBI: "indicator.bbi",
    SAR: "indicator.sar",
    OBV: "indicator.obv",
    WR: "indicator.wr",
    VR: "indicator.vr",
    KDJ: "indicator.kdj",
    CCI: "indicator.cci",
    DMI: "indicator.dmi",
    BIAS: "indicator.bias",
    BRAR: "indicator.brar",
    MTM: "indicator.mtm",
    EMV: "indicator.emv",
    AO: "indicator.ao",
    ROC: "indicator.roc",
    TRIX: "indicator.trix",
    DMA: "indicator.dma",
    PVT: "indicator.pvt",
    PSY: "indicator.psy",
    CR: "indicator.cr",
};

export var seriesAbbreviations = {
    EMA: "EMA",
    BollingerBand: "BB",
    RSI: "RSI",
    MACD: "MACD",
    CVDApprox: "CVD Approx",
    CVDRealtime: "CVD Realtime",
    StrengthElder: "Elder Strength",
    StrengthRelative: "RS",
    Whale: "Whale Flow",
    MA: "MA",
    BBI: "BBI",
    SAR: "SAR",
    OBV: "OBV",
    WR: "WR",
    VR: "VR",
    KDJ: "KDJ",
    CCI: "CCI",
    DMI: "DMI",
    BIAS: "BIAS",
    BRAR: "BRAR",
    MTM: "MTM",
    EMV: "EMV",
    AO: "AO",
    ROC: "ROC",
    TRIX: "TRIX",
    DMA: "DMA",
    PVT: "PVT",
    PSY: "PSY",
    CR: "CR",
    Candlestick: "Candlestick",
    HollowCandle: "Hollow Candle",
    OHLC: "OHLC",
    HeikinAshi: "HA",
    Line: "Line",
    Area: "Area",
    Bar: "Bar",
    Volume: "Volume",
};

function numberParam(p, key, fallback) {
    var val = p === null || p === void 0 ? void 0 : p[key];
    return typeof val === "number" && Number.isFinite(val) ? val : fallback;
}

export function formatSeriesSuffix(type, params) {
    switch (type) {
        case "EMA":
            return "(".concat(numberParam(params, "period", 20), ")");
        case "RSI":
            return "(".concat(numberParam(params, "period", 14), ")");
        case "BollingerBand":
            return "(".concat(numberParam(params, "period", 20), ",").concat(numberParam(params, "stdDev", 2), ")");
        case "MACD":
            return "(".concat(numberParam(params, "fast", 12), ",").concat(numberParam(params, "slow", 26), ",").concat(numberParam(params, "signal", 9), ")");
        case "KDJ":
            return "(".concat(numberParam(params, "period", 9), ",").concat(numberParam(params, "m1", 3), ",").concat(numberParam(params, "m2", 3), ")");
        case "CCI":
            return "(".concat(numberParam(params, "period", 20), ")");
        case "DMI":
            return "(".concat(numberParam(params, "period", 14), ")");
        case "BIAS":
            return "(".concat(numberParam(params, "period", 6), ")");
        case "BRAR":
            return "(".concat(numberParam(params, "period", 26), ")");
        case "MTM":
            return "(".concat(numberParam(params, "period", 6), ")");
        case "EMV":
            return "(".concat(numberParam(params, "period", 14), ")");
        case "ROC":
            return "(".concat(numberParam(params, "period", 12), ")");
        case "TRIX":
            return "(".concat(numberParam(params, "period", 12), ")");
        case "DMA":
            return "(".concat(numberParam(params, "fastPeriod", 10), ",").concat(numberParam(params, "slowPeriod", 50), ")");
        case "PSY":
            return "(".concat(numberParam(params, "period", 12), ")");
        case "CR":
            return "(".concat(numberParam(params, "period", 26), ")");
        case "Whale":
            return "(".concat(numberParam(params, "threshold", 50000), ")");
        default:
            return "";
    }
}

export function formatSeriesDisplayName(type, params, t, index) {
    var _a;
    var baseLabel = t ? ((_a = t(seriesLabelKeys[type])) !== null && _a !== void 0 ? _a : type) : type;
    var suffix = formatSeriesSuffix(type, params);
    var withSuffix = suffix ? "".concat(baseLabel, " ").concat(suffix) : baseLabel;
    if (!params) {
        var abbreviation = seriesAbbreviations[type];
        if (abbreviation && baseLabel !== abbreviation) {
            withSuffix = "".concat(baseLabel, " (").concat(abbreviation, ")");
        }
    }
    return typeof index === "number" ? "".concat(withSuffix, " #").concat(index + 1) : withSuffix;
}
