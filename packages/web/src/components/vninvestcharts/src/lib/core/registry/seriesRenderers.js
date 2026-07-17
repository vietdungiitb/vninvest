import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import AreaSeries from "../../series/AreaSeries.js";
import BarSeries from "../../series/BarSeries.js";
import BollingerSeries from "../../series/BollingerSeries.js";
import CandlestickSeries from "../../series/CandlestickSeries.js";
import ElderRaySeries from "../../series/ElderRaySeries.js";
import LineSeries from "../../series/LineSeries.js";
import MACDSeries from "../../series/MACDSeries.js";
import OHLCSeries from "../../series/OHLCSeries.js";
import RSISeries from "../../series/RSISeries.js";
import StraightLine from "../../series/StraightLine.js";
import { resolveSeriesStructuredValue, resolveSeriesValue } from "../seriesValueResolver.js";

function renderCandlestick(ctx) {
    var sc = function (key, fallback) { var _a; return (_a = ctx.series.subColors) === null || _a === void 0 ? void 0 : _a[key]; };
    var sv = ctx.styleOverride;
    var upColor = sv === null || sv === void 0 ? void 0 : sv.color ? ctx.lineColor : ctx.upColor;
    var downColor = sv === null || sv === void 0 ? void 0 : sv.color ? ctx.lineColor : ctx.downColor;
    return _jsx(CandlestickSeries, { width: ctx.candleBodyWidth, yAccessor: function (datum) { return datum; }, fill: function (datum) { return (sv !== null && sv !== void 0 && sv.color ? ctx.lineColor : datum.close >= datum.open ? upColor : downColor); }, stroke: function (datum) { return (sv !== null && sv !== void 0 && sv.color ? ctx.lineColor : datum.close >= datum.open ? upColor : downColor); }, wickStroke: function (datum) { return (sv !== null && sv !== void 0 && sv.color ? ctx.lineColor : datum.close >= datum.open ? upColor : downColor); }, candleStrokeWidth: (sv === null || sv === void 0 ? void 0 : sv.lineWidth) ?? 0.5, opacity: (sv === null || sv === void 0 ? void 0 : sv.opacity) ?? 0.5 }, ctx.seriesKey);
}

function renderHollowCandle(ctx) {
    var sv = ctx.styleOverride;
    var upColor = sv === null || sv === void 0 ? void 0 : sv.color ? ctx.lineColor : ctx.upColor;
    var downColor = sv === null || sv === void 0 ? void 0 : sv.color ? ctx.lineColor : ctx.downColor;
    return _jsx(CandlestickSeries, { width: ctx.candleBodyWidth, yAccessor: function (datum) { return datum; }, fill: function (datum) { return (sv !== null && sv !== void 0 && sv.color ? ctx.lineColor : datum.close >= datum.open ? "transparent" : downColor); }, stroke: function (datum) { return (sv !== null && sv !== void 0 && sv.color ? ctx.lineColor : datum.close >= datum.open ? upColor : downColor); }, wickStroke: function (datum) { return (sv !== null && sv !== void 0 && sv.color ? ctx.lineColor : datum.close >= datum.open ? upColor : downColor); }, candleStrokeWidth: (sv === null || sv === void 0 ? void 0 : sv.lineWidth) ?? 0.5, opacity: (sv === null || sv === void 0 ? void 0 : sv.opacity) ?? 0.5 }, ctx.seriesKey);
}

function renderOHLC(ctx) {
    var sv = ctx.styleOverride;
    return _jsx(OHLCSeries, { stroke: function (datum) { return (sv !== null && sv !== void 0 && sv.color ? ctx.lineColor : datum.close >= datum.open ? ctx.upColor : ctx.downColor); } }, ctx.seriesKey);
}

function renderLine(ctx) {
    return _jsx(LineSeries, { yAccessor: ctx.accessor, stroke: ctx.lineColor, strokeWidth: ctx.lineWidth, strokeOpacity: ctx.strokeOpacity, strokeDasharray: ctx.dashArray }, ctx.seriesKey);
}

function renderArea(ctx) {
    return _jsx(AreaSeries, { yAccessor: ctx.accessor, stroke: ctx.lineColor, fill: ctx.fillColor, strokeWidth: ctx.lineWidth, strokeOpacity: ctx.strokeOpacity, opacity: ctx.fillOpacity, strokeDasharray: ctx.dashArray }, ctx.seriesKey);
}

function renderBar(ctx) {
    var sv = ctx.styleOverride;
    return _jsx(BarSeries, { width: ctx.candleBodyWidth, yAccessor: ctx.accessor, fill: function (datum) { return (sv !== null && sv !== void 0 && sv.color ? ctx.lineColor : datum.close >= datum.open ? ctx.upColor : ctx.downColor); }, opacity: (sv === null || sv === void 0 ? void 0 : sv.opacity) ?? 0.75 }, ctx.seriesKey);
}

function renderWhale(ctx) {
    var series = ctx.series;
    var sv = ctx.styleOverride;
    return _jsx(BarSeries, { width: ctx.candleBodyWidth, yAccessor: function (datum) {
            var whale = resolveSeriesStructuredValue(datum, series);
            return (whale === null || whale === void 0 ? void 0 : whale.whaleBuyVol) !== null && (whale === null || whale === void 0 ? void 0 : whale.whaleBuyVol) !== void 0 ? whale.whaleBuyVol : (whale === null || whale === void 0 ? void 0 : whale.whaleSellVol) ? -whale.whaleSellVol : undefined;
        }, fill: function (datum) { return (sv !== null && sv !== void 0 && sv.color ? ctx.lineColor : datum.close >= datum.open ? ctx.upColor : ctx.downColor); }, opacity: (sv === null || sv === void 0 ? void 0 : sv.opacity) ?? 0.6 }, ctx.seriesKey);
}

function renderBollingerBand(ctx) {
    var series = ctx.series;
    var sc = function (key, fallback) { var _a; return (_a = series.subColors) !== null && _a !== void 0 ? _a : fallback; }(key, fallback);
    var bbMidColor = sc("middle", ctx.lineColor);
    var bbTopRaw = sc("top", ctx.lineColor);
    var bbBotRaw = sc("bottom", ctx.lineColor);
    var _a = series.params || {};
    var _b = _a.fillMode, bbFillModeRaw = _b === void 0 ? "none" : _b;
    var bbFillMode = bbFillModeRaw === "solid" || bbFillModeRaw === "fade" ? bbFillModeRaw : "none";
    var _c = _a.fillOpacity, bbFillOpacityRaw = _c === void 0 ? (ctx.styleOverride === null || ctx.styleOverride === void 0 ? void 0 : ctx.styleOverride.opacity) ?? 0.15 : _c;
    var bbFillOpacity = typeof bbFillOpacityRaw === "number" ? Math.max(0, Math.min(1, bbFillOpacityRaw)) : 0.15;
    var bbFillColor = typeof _a.fillColor === "string" ? _a.fillColor : ctx.fillColor;
    var withAlpha = function (c) { return c.match(/^#[0-9a-fA-F]{6}$/) ? c + "88" : c; };
    return _jsx(BollingerSeries, { yAccessor: function (datum) { return resolveSeriesStructuredValue(datum, series); }, stroke: { top: withAlpha(bbTopRaw), middle: bbMidColor, bottom: withAlpha(bbBotRaw) }, strokeWidth: { top: ctx.lineWidth, middle: ctx.lineWidth, bottom: ctx.lineWidth }, fill: bbFillColor, opacity: bbFillMode === "none" ? 0 : bbFillOpacity, fillMode: bbFillMode }, ctx.seriesKey);
}

function renderRSI(ctx) {
    var sc = function (key, fallback) { var _a; return (_a = ctx.series.subColors) !== null && _a !== void 0 ? _a : fallback; }(key, fallback);
    var rsiLine = sc("line", ctx.lineColor);
    var rsiOB = sc("overbought", "#f23645");
    var rsiMid = sc("middle", "#9ca3af");
    var rsiOS = sc("oversold", "#089981");
    return _jsx(RSISeries, { yAccessor: function (datum) { return resolveSeriesValue(datum, ctx.series); }, stroke: {
            top: rsiOB,
            middle: rsiMid,
            bottom: rsiOS,
            outsideThreshold: rsiLine,
            insideThreshold: rsiLine,
        }, opacity: { top: 0.5, middle: 0.4, bottom: 0.5 }, strokeDasharray: { line: ctx.dashArray, top: "ShortDash", middle: "ShortDash", bottom: "ShortDash" }, strokeWidth: {
            outsideThreshold: ctx.lineWidth,
            insideThreshold: ctx.lineWidth,
            top: 1,
            middle: 1,
            bottom: 1,
        } }, ctx.seriesKey);
}

function renderMACD(ctx) {
    var sc = function (key, fallback) { var _a; return (_a = ctx.series.subColors) !== null && _a !== void 0 ? _a : fallback; }(key, fallback);
    var macdColor = sc("macd", ctx.lineColor);
    var signalColor = sc("signal", "#ff6d00");
    var divergeColor = sc("diverge", "#26a69a");
    return _jsx(MACDSeries, { yAccessor: function (datum) { return resolveSeriesStructuredValue(datum, ctx.series); }, stroke: { macd: macdColor, signal: signalColor }, strokeWidth: { macd: ctx.lineWidth, signal: ctx.lineWidth }, fill: { divergence: divergeColor }, opacity: ctx.strokeOpacity }, ctx.seriesKey);
}

function renderElderRay(ctx) {
    var sc = function (key, fallback) { var _a; return (_a = ctx.series.subColors) !== null && _a !== void 0 ? _a : fallback; }(key, fallback);
    return _jsx(ElderRaySeries, { yAccessor: function (datum) { return resolveSeriesStructuredValue(datum, ctx.series); }, bullPowerFill: sc("bull", "#089981"), bearPowerFill: sc("bear", "#f23645"), straightLineStroke: ctx.lineColor, straightLineOpacity: ctx.strokeOpacity, opacity: ctx.fillOpacity }, ctx.seriesKey);
}

function renderKDJ(ctx) {
    var sc = function (key, fallback) { var _a; return (_a = ctx.series.subColors) !== null && _a !== void 0 ? _a : fallback; }(key, fallback);
    var structured = function (datum) { return resolveSeriesStructuredValue(datum, ctx.series); };
    var fa = function (field) { return function (datum) { var _a; return (_a = structured(datum)) === null || _a === void 0 ? void 0 : _a[field]; }; };
    var kC = sc("k", ctx.lineColor), dC = sc("d", "#ff6d00"), jC = sc("j", "#26a69a");
    return _jsxs("g", { children: [_jsx(LineSeries, { yAccessor: fa("k"), stroke: kC, strokeWidth: ctx.lineWidth }, ctx.seriesKey + "-k"), _jsx(LineSeries, { yAccessor: fa("d"), stroke: dC, strokeWidth: ctx.lineWidth }, ctx.seriesKey + "-d"), _jsx(LineSeries, { yAccessor: fa("j"), stroke: jC, strokeWidth: ctx.lineWidth }, ctx.seriesKey + "-j"), _jsx(StraightLine, { stroke: kC, opacity: 0.35, yValue: 80, strokeDasharray: "ShortDash" }), _jsx(StraightLine, { stroke: kC, opacity: 0.35, yValue: 50, strokeDasharray: "ShortDash" }), _jsx(StraightLine, { stroke: kC, opacity: 0.35, yValue: 20, strokeDasharray: "ShortDash" })] }, ctx.seriesKey);
}

function renderCCI(ctx) {
    return _jsxs("g", { children: [_jsx(LineSeries, { yAccessor: ctx.accessor, stroke: ctx.lineColor, strokeWidth: ctx.lineWidth }, ctx.seriesKey + "-line"), _jsx(StraightLine, { stroke: ctx.lineColor, opacity: 0.35, yValue: 100, strokeDasharray: "ShortDash" }), _jsx(StraightLine, { stroke: ctx.lineColor, opacity: 0.35, yValue: 0, strokeDasharray: "ShortDash" }), _jsx(StraightLine, { stroke: ctx.lineColor, opacity: 0.35, yValue: -100, strokeDasharray: "ShortDash" })] }, ctx.seriesKey);
}

function renderDMI(ctx) {
    var sc = function (key, fallback) { var _a; return (_a = ctx.series.subColors) !== null && _a !== void 0 ? _a : fallback; }(key, fallback);
    var structured = function (datum) { return resolveSeriesStructuredValue(datum, ctx.series); };
    var fa = function (field) { return function (datum) { var _a; return (_a = structured(datum)) === null || _a === void 0 ? void 0 : _a[field]; }; };
    return _jsxs("g", { children: [_jsx(LineSeries, { yAccessor: fa("plusDI"), stroke: sc("plusDI", "#089981"), strokeWidth: ctx.lineWidth }, ctx.seriesKey + "-plus"), _jsx(LineSeries, { yAccessor: fa("minusDI"), stroke: sc("minusDI", "#f23645"), strokeWidth: ctx.lineWidth }, ctx.seriesKey + "-minus"), _jsx(LineSeries, { yAccessor: fa("adx"), stroke: sc("adx", ctx.lineColor), strokeWidth: ctx.lineWidth }, ctx.seriesKey + "-adx")] }, ctx.seriesKey);
}

function renderBRAR(ctx) {
    var sc = function (key, fallback) { var _a; return (_a = ctx.series.subColors) !== null && _a !== void 0 ? _a : fallback; }(key, fallback);
    var structured = function (datum) { return resolveSeriesStructuredValue(datum, ctx.series); };
    var fa = function (field) { return function (datum) { var _a; return (_a = structured(datum)) === null || _a === void 0 ? void 0 : _a[field]; }; };
    return _jsxs("g", { children: [_jsx(LineSeries, { yAccessor: fa("ar"), stroke: sc("ar", ctx.lineColor), strokeWidth: ctx.lineWidth }, ctx.seriesKey + "-ar"), _jsx(LineSeries, { yAccessor: fa("br"), stroke: sc("br", "#ff6d00"), strokeWidth: ctx.lineWidth }, ctx.seriesKey + "-br")] }, ctx.seriesKey);
}

function renderMTM(ctx) {
    var sc = function (key, fallback) { var _a; return (_a = ctx.series.subColors) !== null && _a !== void 0 ? _a : fallback; }(key, fallback);
    var structured = function (datum) { return resolveSeriesStructuredValue(datum, ctx.series); };
    var fa = function (field) { return function (datum) { var _a; return (_a = structured(datum)) === null || _a === void 0 ? void 0 : _a[field]; }; };
    return _jsxs("g", { children: [_jsx(LineSeries, { yAccessor: fa("mtm"), stroke: sc("mtm", ctx.lineColor), strokeWidth: ctx.lineWidth }, ctx.seriesKey + "-mtm"), _jsx(LineSeries, { yAccessor: fa("signal"), stroke: sc("signal", "#ff6d00"), strokeWidth: ctx.lineWidth }, ctx.seriesKey + "-signal")] }, ctx.seriesKey);
}

function renderEMV(ctx) {
    var sc = function (key, fallback) { var _a; return (_a = ctx.series.subColors) !== null && _a !== void 0 ? _a : fallback; }(key, fallback);
    var structured = function (datum) { return resolveSeriesStructuredValue(datum, ctx.series); };
    var fa = function (field) { return function (datum) { var _a; return (_a = structured(datum)) === null || _a === void 0 ? void 0 : _a[field]; }; };
    return _jsxs("g", { children: [_jsx(LineSeries, { yAccessor: fa("emv"), stroke: sc("emv", ctx.lineColor), strokeWidth: ctx.lineWidth }, ctx.seriesKey + "-emv"), _jsx(LineSeries, { yAccessor: fa("signal"), stroke: sc("signal", "#ff6d00"), strokeWidth: ctx.lineWidth }, ctx.seriesKey + "-signal")] }, ctx.seriesKey);
}

function renderAO(ctx) {
    return _jsx(BarSeries, { width: ctx.candleBodyWidth, yAccessor: ctx.accessor, fill: function (datum) { return datum.aoColor ?? ctx.lineColor; }, opacity: 0.85 }, ctx.seriesKey);
}

function renderTRIX(ctx) {
    var sc = function (key, fallback) { var _a; return (_a = ctx.series.subColors) !== null && _a !== void 0 ? _a : fallback; }(key, fallback);
    var structured = function (datum) { return resolveSeriesStructuredValue(datum, ctx.series); };
    var fa = function (field) { return function (datum) { var _a; return (_a = structured(datum)) === null || _a === void 0 ? void 0 : _a[field]; }; };
    return _jsxs("g", { children: [_jsx(LineSeries, { yAccessor: fa("trix"), stroke: sc("trix", ctx.lineColor), strokeWidth: ctx.lineWidth }, ctx.seriesKey + "-trix"), _jsx(LineSeries, { yAccessor: fa("signal"), stroke: sc("signal", "#ff6d00"), strokeWidth: ctx.lineWidth }, ctx.seriesKey + "-signal")] }, ctx.seriesKey);
}

function renderDMA(ctx) {
    var sc = function (key, fallback) { var _a; return (_a = ctx.series.subColors) !== null && _a !== void 0 ? _a : fallback; }(key, fallback);
    var structured = function (datum) { return resolveSeriesStructuredValue(datum, ctx.series); };
    var fa = function (field) { return function (datum) { var _a; return (_a = structured(datum)) === null || _a === void 0 ? void 0 : _a[field]; }; };
    return _jsxs("g", { children: [_jsx(LineSeries, { yAccessor: fa("ddd"), stroke: sc("ddd", ctx.lineColor), strokeWidth: ctx.lineWidth }, ctx.seriesKey + "-ddd"), _jsx(LineSeries, { yAccessor: fa("ama"), stroke: sc("ama", "#ff6d00"), strokeWidth: ctx.lineWidth }, ctx.seriesKey + "-ama")] }, ctx.seriesKey);
}

function renderPSY(ctx) {
    var sc = function (key, fallback) { var _a; return (_a = ctx.series.subColors) !== null && _a !== void 0 ? _a : fallback; }(key, fallback);
    var structured = function (datum) { return resolveSeriesStructuredValue(datum, ctx.series); };
    var fa = function (field) { return function (datum) { var _a; return (_a = structured(datum)) === null || _a === void 0 ? void 0 : _a[field]; }; };
    return _jsxs("g", { children: [_jsx(LineSeries, { yAccessor: fa("psy"), stroke: sc("psy", ctx.lineColor), strokeWidth: ctx.lineWidth }, ctx.seriesKey + "-psy"), _jsx(LineSeries, { yAccessor: fa("signal"), stroke: sc("signal", "#ff6d00"), strokeWidth: ctx.lineWidth }, ctx.seriesKey + "-signal")] }, ctx.seriesKey);
}

function renderCR(ctx) {
    var sc = function (key, fallback) { var _a; return (_a = ctx.series.subColors) !== null && _a !== void 0 ? _a : fallback; }(key, fallback);
    var structured = function (datum) { return resolveSeriesStructuredValue(datum, ctx.series); };
    var fa = function (field) { return function (datum) { var _a; return (_a = structured(datum)) === null || _a === void 0 ? void 0 : _a[field]; }; };
    return _jsxs("g", { children: [_jsx(LineSeries, { yAccessor: fa("cr"), stroke: sc("cr", ctx.lineColor), strokeWidth: ctx.lineWidth }, ctx.seriesKey + "-cr"), _jsx(LineSeries, { yAccessor: fa("ma1"), stroke: sc("ma1", "#ff6d00"), strokeWidth: ctx.lineWidth }, ctx.seriesKey + "-ma1"), _jsx(LineSeries, { yAccessor: fa("ma2"), stroke: sc("ma2", "#26a69a"), strokeWidth: ctx.lineWidth }, ctx.seriesKey + "-ma2"), _jsx(LineSeries, { yAccessor: fa("ma3"), stroke: sc("ma3", "#f23645"), strokeWidth: ctx.lineWidth }, ctx.seriesKey + "-ma3"), _jsx(LineSeries, { yAccessor: fa("ma4"), stroke: sc("ma4", "#9ca3af"), strokeWidth: ctx.lineWidth }, ctx.seriesKey + "-ma4")] }, ctx.seriesKey);
}

export var seriesRendererRegistry = {
    Candlestick: function (ctx) { return renderCandlestick(ctx); },
    HeikinAshi: function (ctx) { return renderCandlestick(ctx); },
    HollowCandle: function (ctx) { return renderHollowCandle(ctx); },
    OHLC: function (ctx) { return renderOHLC(ctx); },
    Line: function (ctx) { return renderLine(ctx); },
    EMA: function (ctx) { return renderLine(ctx); },
    CVDApprox: function (ctx) { return renderLine(ctx); },
    CVDRealtime: function (ctx) { return renderLine(ctx); },
    StrengthRelative: function (ctx) { return renderLine(ctx); },
    BIAS: function (ctx) { return renderLine(ctx); },
    ROC: function (ctx) { return renderLine(ctx); },
    PVT: function (ctx) { return renderLine(ctx); },
    Area: function (ctx) { return renderArea(ctx); },
    Bar: function (ctx) { return renderBar(ctx); },
    Volume: function (ctx) { return renderBar(ctx); },
    Whale: function (ctx) { return renderWhale(ctx); },
    BollingerBand: function (ctx) { return renderBollingerBand(ctx); },
    RSI: function (ctx) { return renderRSI(ctx); },
    MACD: function (ctx) { return renderMACD(ctx); },
    StrengthElder: function (ctx) { return renderElderRay(ctx); },
    KDJ: function (ctx) { return renderKDJ(ctx); },
    CCI: function (ctx) { return renderCCI(ctx); },
    DMI: function (ctx) { return renderDMI(ctx); },
    BRAR: function (ctx) { return renderBRAR(ctx); },
    MTM: function (ctx) { return renderMTM(ctx); },
    EMV: function (ctx) { return renderEMV(ctx); },
    AO: function (ctx) { return renderAO(ctx); },
    TRIX: function (ctx) { return renderTRIX(ctx); },
    DMA: function (ctx) { return renderDMA(ctx); },
    PSY: function (ctx) { return renderPSY(ctx); },
    CR: function (ctx) { return renderCR(ctx); },
};

export { renderCandlestick, renderHollowCandle, renderOHLC, renderLine, renderArea, renderBar, renderWhale, renderBollingerBand, renderRSI, renderMACD, renderElderRay, renderKDJ, renderCCI, renderDMI, renderBRAR, renderMTM, renderEMV, renderAO, renderTRIX, renderDMA, renderPSY, renderCR };
