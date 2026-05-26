import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "d3-format";
import { timeFormat } from "d3-time-format";
import ChartCanvas from "../lib/ChartCanvas.js";
import Chart from "../lib/Chart.js";
import { Brush } from "../lib/interactive/index.js";
import ZoomButtons from "../lib/ZoomButtons.js";
import BarSeries from "../lib/series/BarSeries.js";
import AreaSeries from "../lib/series/AreaSeries.js";
import CandlestickSeries from "../lib/series/CandlestickSeries.js";
import LineSeries from "../lib/series/LineSeries.js";
import MACDSeries from "../lib/series/MACDSeries.js";
import { XAxis, YAxis } from "../lib/axes/index.js";
import { CrossHairCursor, CurrentCoordinate, EdgeIndicator, MouseCoordinateX, MouseCoordinateY, } from "../lib/coordinates/index.js";
import { OHLCTooltip, MovingAverageTooltip, MACDTooltip } from "../lib/tooltip/index.js";
import { discontinuousTimeScaleProvider } from "../lib/scale/index.js";
import { sma } from "../lib/indicator/index.js";
import { enrichData } from "../lib/core/calculators/enrichData.js";
import { resolveSeriesStructuredValue, resolveSeriesValue } from "../lib/core/seriesValueResolver.js";
import { last } from "../lib/utils/index.js";
import { getOfflineDemoBars } from "./demoData.js";
import DemoPageShell from "./DemoPageShell.js";
import { DemoI18nBoundary, useDemoI18n } from "./i18n.js";
import "./demo.css";
const priceFormat = format(".2f");
const priceFormat1 = format(".1f");
const priceFormat3 = format(".3f");
const volumeFormat = format(".3s");
const volumeAxisFormat = format(".2s");
const volumeMouseFormat = format(".4s");
const macdFormat = format(".2f");
const macdFormat3 = format(".3f");
const tooltipDateFormat = timeFormat("%d/%m/%Y %H:%M");
const macdDateFormat = timeFormat("%Y-%m-%d");
const themeFontFamily = '"Segoe UI Variable Text", "Aptos", "Segoe UI", sans-serif';
const axisTheme = {
    stroke: "rgba(148, 163, 184, 0.38)",
    tickStroke: "rgba(148, 163, 184, 0.38)",
    tickLabelFill: "#cbd5e1",
    fontFamily: themeFontFamily,
    fontSize: 12,
    fontWeight: 500,
};
const coordinateTheme = {
    fill: "rgba(15, 23, 42, 0.96)",
    opacity: 1,
    stroke: "rgba(148, 163, 184, 0.38)",
    strokeOpacity: 1,
    strokeWidth: 1,
    fontFamily: themeFontFamily,
    fontSize: 12,
    textFill: "#e2e8f0",
};
const bullishColor = "#10b981";
const bearishColor = "#ef4444";
const ema12Stroke = "#22d3ee";
const ema26Stroke = "#f59e0b";
const smaVolume10 = sma()
    .id(3)
    .options({
    windowSize: 10,
    sourcePath: "volume",
})
    .merge((datum, value) => {
    datum.smaVolume10 = value;
})
    .accessor((datum) => datum.smaVolume10);
const macdAppearance = {
    stroke: {
        macd: "#38bdf8",
        signal: "#f59e0b",
    },
    fill: {
        divergence: "#ef4444",
    },
};
const BRUSH_TYPE = "2D";
const EMA12_SERIES = { type: "EMA", yAxis: "right", params: { period: 12 } };
const EMA26_SERIES = { type: "EMA", yAxis: "right", params: { period: 26 } };
const MACD_SERIES = { type: "MACD", yAxis: "right", params: { fast: 12, slow: 26, signal: 9 } };
const ema26Accessor = (datum) => datum.ema26;
const ema12Accessor = (datum) => datum.ema12;
const macdAccessor = (datum) => datum.macd;
function createOrigin(offsetFromBottom) {
    return (_width, height) => [0, height - offsetFromBottom];
}
const OriginalLikeDemoContent = () => {
    const { language, setLanguage, t } = useDemoI18n();
    const tooltipDisplayTexts = useMemo(() => ({
        d: t("full.tooltip.date"),
        o: t("full.tooltip.open"),
        h: t("full.tooltip.high"),
        l: t("full.tooltip.low"),
        c: t("full.tooltip.close"),
        v: t("full.tooltip.volume"),
        na: t("common.na"),
    }), [t]);
    const chartSurfaceRef = useRef(null);
    const [chartWidth, setChartWidth] = useState(0);
    const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);
    const rawData = useMemo(() => {
        return enrichData(getOfflineDemoBars(), { series: [EMA12_SERIES, EMA26_SERIES, MACD_SERIES] })
            .map((datum) => ({
            ...datum,
            ema12: resolveSeriesValue(datum, EMA12_SERIES),
            ema26: resolveSeriesValue(datum, EMA26_SERIES),
            macd: resolveSeriesStructuredValue(datum, MACD_SERIES),
        }));
    }, []);
    const calculatedData = useMemo(() => {
        return smaVolume10(rawData);
    }, [rawData]);
    const xScaleProvider = useMemo(() => {
        return discontinuousTimeScaleProvider.inputDateAccessor((datum) => datum.date);
    }, []);
    const { data, xScale, xAccessor, displayXAccessor } = useMemo(() => {
        return xScaleProvider(calculatedData);
    }, [calculatedData, xScaleProvider]);
    const initialXExtents = useMemo(() => {
        const endIndex = data.length - 1;
        const startIndex = Math.max(0, data.length - 150);
        return [xAccessor(data[startIndex]), xAccessor(last(data))];
    }, [data, xAccessor]);
    const [visibleDomain, setVisibleDomain] = useState(initialXExtents);
    const [xExtents, setXExtents] = useState(initialXExtents);
    const [brushEnabled, setBrushEnabled] = useState(false);
    useEffect(() => {
        setXExtents(initialXExtents);
        setVisibleDomain(initialXExtents);
    }, [initialXExtents]);
    useEffect(() => {
        const node = chartSurfaceRef.current;
        if (!node)
            return;
        const updateWidth = () => {
            setChartWidth(Math.floor(node.getBoundingClientRect().width));
        };
        updateWidth();
        if (typeof ResizeObserver === "undefined") {
            window.addEventListener("resize", updateWidth);
            return () => window.removeEventListener("resize", updateWidth);
        }
        const observer = new ResizeObserver(() => updateWidth());
        observer.observe(node);
        window.addEventListener("resize", updateWidth);
        return () => {
            observer.disconnect();
            window.removeEventListener("resize", updateWidth);
        };
    }, []);
    useEffect(() => {
        const handleResize = () => setViewportHeight(window.innerHeight);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);
    const handleBrush = ({ start, end }) => {
        const left = Math.min(start.xValue, end.xValue);
        const right = Math.max(start.xValue, end.xValue);
        setBrushEnabled(false);
        setXExtents([left, right]);
    };
    const handleVisibleDomainChange = (domain) => {
        setVisibleDomain(domain);
    };
    const handleResetView = () => {
        setBrushEnabled(false);
        setXExtents(initialXExtents);
        setVisibleDomain(initialXExtents);
    };
    const visibleBars = Math.max(1, Math.min(data.length, Math.round(Math.abs(visibleDomain[1] - visibleDomain[0]))));
    const isZoomedIn = visibleBars <= 120;
    const visibleDomainLabel = `${visibleDomain[0].toFixed(1)} → ${visibleDomain[1].toFixed(1)}`;
    const priceYAxisTicks = visibleBars <= 120 ? 7 : 5;
    const priceYAxisTickFormat = visibleBars <= 120 ? priceFormat3 : priceFormat;
    const macdYAxisTicks = visibleBars <= 120 ? 5 : 2;
    const macdYAxisTickFormat = visibleBars <= 120 ? macdFormat3 : macdFormat;
    const xAxisTickFormat = (tickValue) => {
        const tickIndex = Math.max(0, Math.min(data.length - 1, Math.round(tickValue)));
        const tickDatum = data[tickIndex];
        if (!tickDatum)
            return "";
        if (visibleBars <= 35)
            return timeFormat("%H:%M:%S")(tickDatum.date);
        if (visibleBars <= 70)
            return timeFormat("%H:%M")(tickDatum.date);
        if (visibleBars <= 120)
            return timeFormat("%-I:%M %p")(tickDatum.date);
        return timeFormat("%-I %p")(tickDatum.date);
    };
    const resolvedChartWidth = chartWidth || Math.max(960, Math.floor(window.innerWidth - 48));
    const chartHeight = Math.max(340, Math.min(360, Math.round(viewportHeight * 0.70)));
    const margin = { left: 70, right: 70, top: 20, bottom: 30 };
    const priceHeight = Math.round(chartHeight * 0.64);
    const volumeHeight = Math.round(chartHeight * 0.18);
    const macdHeight = chartHeight - priceHeight - volumeHeight;
    const priceYAxisTheme = {
        ...axisTheme,
        innerTickSize: -(resolvedChartWidth - margin.left - margin.right),
        tickStrokeOpacity: 0.08,
        tickFormat: priceYAxisTickFormat,
    };
    const volumeYAxisTheme = {
        ...axisTheme,
        ticks: 5,
        tickFormat: volumeAxisFormat,
    };
    const macdYAxisTheme = {
        ...axisTheme,
        ticks: macdYAxisTicks,
        tickFormat: macdYAxisTickFormat,
    };
    const volumeOrigin = createOrigin(macdHeight + volumeHeight);
    const macdOrigin = createOrigin(macdHeight);
    return (_jsx(DemoPageShell, { className: "demo-page--classic", frameClassName: "demo-frame--classic", children: _jsxs("section", { className: "demo-chart-card demo-chart-card--classic", children: [_jsxs("header", { className: "demo-chart-card__header demo-chart-card__header--classic", children: [_jsxs("div", { children: [_jsx("h1", { className: "demo-chart-card__title", children: t("original.title") }), _jsx("p", { className: "demo-chart-card__meta", children: t("original.meta") })] }), _jsxs("div", { className: "demo-chart-card__chips", children: [_jsx("span", { className: "source-chip source-chip--neutral", children: t("original.viewRange", { visible: visibleBars, total: data.length }) }), _jsxs("span", { className: "source-chip source-chip--accent", children: ["X: ", visibleDomainLabel] }), _jsx("button", { className: `source-chip source-chip--btn${language === "vi" ? " source-chip--btn-active" : ""}`, onClick: () => setLanguage("vi"), title: t("language.label"), children: t("language.vi") }), _jsx("button", { className: `source-chip source-chip--btn${language === "en" ? " source-chip--btn-active" : ""}`, onClick: () => setLanguage("en"), title: t("language.label"), children: t("language.en") }), _jsx("button", { className: `source-chip source-chip--btn${brushEnabled ? " source-chip--btn-active" : ""}`, onClick: () => setBrushEnabled(v => !v), title: brushEnabled ? t("original.brushOnTitle") : t("original.brushOffTitle"), children: brushEnabled ? t("original.brushOn") : t("original.brushOff") })] })] }), _jsx("div", { className: "chart-shell chart-shell--classic", children: _jsx("div", { className: "chart-surface chart-surface--classic", ref: chartSurfaceRef, children: resolvedChartWidth > 0 ? (_jsxs(ChartCanvas, { height: chartHeight, width: resolvedChartWidth, ratio: window.devicePixelRatio || 1, margin: margin, type: "hybrid", seriesName: "BTCUSD-brush-demo", data: data, xScale: xScale, xAccessor: xAccessor, displayXAccessor: displayXAccessor, xExtents: xExtents, mouseMoveEvent: true, panEvent: true, zoomEvent: true, useCrossHairStyleCursor: true, clamp: true, onVisibleDomainChange: handleVisibleDomainChange, children: [_jsxs(Chart, { id: 1, height: priceHeight, yExtents: [(datum) => [datum.high, datum.low], ema26Accessor, ema12Accessor], padding: { top: 10, bottom: 20 }, children: [_jsx(XAxis, { axisAt: "bottom", orient: "bottom", showTicks: isZoomedIn, outerTickSize: isZoomedIn ? 5 : 0, ticks: isZoomedIn ? 8 : 6, tickFormat: xAxisTickFormat }), _jsx(YAxis, { axisAt: "right", orient: "right", ticks: priceYAxisTicks, ...priceYAxisTheme }), _jsx(MouseCoordinateY, { ...coordinateTheme, at: "right", orient: "right", displayFormat: priceYAxisTickFormat }), _jsx(CandlestickSeries, {}), _jsx(LineSeries, { yAccessor: ema26Accessor, stroke: ema26Stroke }), _jsx(LineSeries, { yAccessor: ema12Accessor, stroke: ema12Stroke }), _jsx(CurrentCoordinate, { yAccessor: ema26Accessor, fill: ema26Stroke }), _jsx(CurrentCoordinate, { yAccessor: ema12Accessor, fill: ema12Stroke }), _jsx(EdgeIndicator, { itemType: "last", orient: "right", edgeAt: "right", yAccessor: (datum) => datum.close, fill: (datum) => (datum.close > datum.open ? "#6BA583" : "#FF0000") }), _jsx(OHLCTooltip, { origin: [-40, 0], displayTexts: tooltipDisplayTexts, xDisplayFormat: tooltipDateFormat, volumeFormat: volumeFormat }), _jsx(MovingAverageTooltip, { origin: [-38, 15], displayFormat: priceFormat, options: [
                                                {
                                                    yAccessor: ema26Accessor,
                                                    type: "EMA",
                                                    stroke: ema26Stroke,
                                                    windowSize: 26,
                                                },
                                                {
                                                    yAccessor: ema12Accessor,
                                                    type: "EMA",
                                                    stroke: ema12Stroke,
                                                    windowSize: 12,
                                                },
                                            ] }), _jsx(Brush, { enabled: brushEnabled, type: BRUSH_TYPE, stroke: "#22d3ee", fill: "#22d3ee", fillOpacity: 0.18, strokeOpacity: 0.95, onStart: () => { }, onBrush: handleBrush }), _jsx(ZoomButtons, { onReset: handleResetView, size: [28, 24], heightFromBase: 48, fill: "rgba(15, 23, 42, 0.88)", fillOpacity: 1, stroke: "rgba(148, 163, 184, 0.28)", strokeWidth: 1, textFill: "#e2e8f0", textStrokeWidth: 0 })] }), _jsxs(Chart, { id: 2, height: volumeHeight, origin: volumeOrigin, yExtents: [(datum) => datum.volume, smaVolume10.accessor()], children: [_jsx(YAxis, { axisAt: "left", orient: "left", ...volumeYAxisTheme }), _jsx(MouseCoordinateY, { ...coordinateTheme, at: "left", orient: "left", displayFormat: volumeMouseFormat }), _jsx(BarSeries, { yAccessor: (datum) => datum.volume, fill: (datum) => (datum.close > datum.open ? "#6BA583" : "#FF0000") }), _jsx(AreaSeries, { yAccessor: smaVolume10.accessor(), stroke: smaVolume10.stroke(), fill: smaVolume10.fill() })] }), _jsxs(Chart, { id: 3, height: macdHeight, origin: macdOrigin, yExtents: macdAccessor, padding: { top: 10, bottom: 10 }, children: [_jsx(XAxis, { axisAt: "bottom", orient: "bottom", showTicks: isZoomedIn, outerTickSize: isZoomedIn ? 5 : 0, ticks: isZoomedIn ? 10 : 6, tickFormat: xAxisTickFormat }), _jsx(YAxis, { axisAt: "right", orient: "right", ...macdYAxisTheme }), _jsx(MouseCoordinateX, { at: "bottom", orient: "bottom", displayFormat: macdDateFormat }), _jsx(MouseCoordinateY, { ...coordinateTheme, at: "right", orient: "right", displayFormat: macdYAxisTickFormat }), _jsx(Brush, { enabled: brushEnabled, type: BRUSH_TYPE, stroke: "#22d3ee", fill: "#22d3ee", fillOpacity: 0.18, strokeOpacity: 0.95, onStart: () => { }, onBrush: handleBrush }), _jsx(MACDSeries, { yAccessor: macdAccessor, stroke: macdAppearance.stroke, fill: macdAppearance.fill }), _jsx(MACDTooltip, { origin: [-38, 15], yAccessor: macdAccessor, options: { fast: 12, slow: 26, signal: 9 }, appearance: macdAppearance })] }), _jsx(CrossHairCursor, { stroke: "#e2e8f0", opacity: 0.16, strokeDasharray: "ShortDash" })] })) : (_jsx("div", { className: "chart-placeholder", children: t("common.chartInitializing") })) }) })] }) }));
};
export default function OriginalLikeDemo() {
    return (_jsx(DemoI18nBoundary, { children: _jsx(OriginalLikeDemoContent, {}) }));
}
