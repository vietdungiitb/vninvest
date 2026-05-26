import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { scaleTime } from "d3-scale";
import { format } from "d3-format";
import { timeFormat } from "d3-time-format";
import ChartCanvas from "../lib/ChartCanvas.js";
import Chart from "../lib/Chart.js";
import { Brush } from "../lib/interactive/index.js";
import ZoomButtons from "../lib/ZoomButtons.js";
import BarSeries from "../lib/series/BarSeries.js";
import CandlestickSeries from "../lib/series/CandlestickSeries.js";
import BollingerSeries from "../lib/series/BollingerSeries.js";
import LineSeries from "../lib/series/LineSeries.js";
import MACDSeries from "../lib/series/MACDSeries.js";
import RSISeries from "../lib/series/RSISeries.js";
import { XAxis, YAxis } from "../lib/axes/index.js";
import { CrossHairCursor, CurrentCoordinate, EdgeIndicator, MouseCoordinateX, MouseCoordinateY } from "../lib/coordinates/index.js";
import { BollingerBandTooltip, MACDTooltip, OHLCTooltip, RSITooltip } from "../lib/tooltip/index.js";
import { BOLLINGER_BAND_OPTIONS, fetchLiveDemoData, getOfflineDemoData } from "./demoData.js";
import DemoPageShell from "./DemoPageShell.js";
import { DemoI18nBoundary, useDemoI18n } from "./i18n.js";
import "./demo.css";
const themeFontFamily = '"Segoe UI Variable Text", "Aptos", "Segoe UI", sans-serif';
const priceFormat = format(".2f");
const volumeFormat = format(".3s");
const percentFormat = format(".2%");
const integerFormat = format(".0f");
const dateFormat = timeFormat("%d/%m/%Y %H:%M");
const ema20Stroke = "#22d3ee";
const ema50Stroke = "#f59e0b";
const bullishColor = "#10b981";
const bearishColor = "#ef4444";
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
const macdAppearance = {
    stroke: {
        macd: "#38bdf8",
        signal: "#f59e0b",
    },
    fill: {
        divergence: "#ef4444",
    },
};
const bollingerAppearance = {
    stroke: {
        top: "#f97316",
        middle: "#e2e8f0",
        bottom: "#f97316",
    },
    fill: "#38bdf8",
};
const rsiAppearance = {
    stroke: {
        line: "#60a5fa",
        top: "#ef4444",
        middle: "#94a3b8",
        bottom: "#10b981",
        outsideThreshold: "#f97316",
        insideThreshold: "#60a5fa",
    },
    opacity: {
        top: 0.85,
        middle: 0.8,
        bottom: 0.85,
    },
    strokeDasharray: {
        line: "Solid",
        top: "ShortDash",
        middle: "ShortDash",
        bottom: "ShortDash",
    },
    strokeWidth: {
        outsideThreshold: 1,
        insideThreshold: 1,
        top: 1,
        middle: 1,
        bottom: 1,
    },
};
function formatSigned(value, formatter) {
    const sign = value > 0 ? "+" : value < 0 ? "-" : "";
    return `${sign}${formatter(Math.abs(value))}`;
}
function MetricTile({ label, value, detail, tone = "neutral" }) {
    return (_jsxs("div", { className: `metric-tile metric-tile--${tone}`, children: [_jsx("div", { className: "metric-tile__label", children: label }), _jsx("div", { className: "metric-tile__value", children: value }), _jsx("div", { className: "metric-tile__detail", children: detail })] }));
}
function LegendRow({ label, detail, color, variant = "line" }) {
    return (_jsxs("div", { className: "legend-row", children: [_jsxs("div", { className: "legend-row__key", children: [_jsx("span", { className: `legend-swatch legend-swatch--${variant}`, style: { background: color } }), _jsx("div", { className: "legend-row__label", children: label })] }), _jsx("div", { className: "legend-row__detail", children: detail })] }));
}
function createOrigin(offsetFromBottom) {
    return (_width, height) => [0, height - offsetFromBottom];
}
function getInitialExtents(data, visibleCount = 160) {
    const endIndex = data.length - 1;
    const startIndex = Math.max(0, data.length - Math.min(visibleCount, data.length));
    return [data[startIndex].date, data[endIndex].date];
}
function normalizeBrushExtents(start, end) {
    const startDate = new Date(start.xValue);
    const endDate = new Date(end.xValue);
    return startDate.valueOf() <= endDate.valueOf()
        ? [startDate, endDate]
        : [endDate, startDate];
}
const FullDemoContent = () => {
    const { language, setLanguage, t } = useDemoI18n();
    const offlineData = useMemo(() => getOfflineDemoData(), []);
    const [sourceMode, setSourceMode] = useState("local");
    const [loadState, setLoadState] = useState("local");
    const [rawData, setRawData] = useState(() => offlineData);
    const [xExtents, setXExtents] = useState(() => getInitialExtents(offlineData));
    const [resetToken, setResetToken] = useState(0);
    const chartSurfaceRef = useRef(null);
    const [chartWidth, setChartWidth] = useState(0);
    const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);
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
    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();
        if (sourceMode === "local") {
            setRawData(offlineData);
            setLoadState("local");
            return () => {
                cancelled = true;
                controller.abort();
            };
        }
        setLoadState("loading");
        void fetchLiveDemoData({ signal: controller.signal })
            .then((nextData) => {
            if (cancelled)
                return;
            setRawData(nextData);
            setLoadState("live");
        })
            .catch((error) => {
            if (cancelled)
                return;
            if (error.name === "AbortError")
                return;
            setRawData(offlineData);
            setLoadState("fallback");
        });
        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [offlineData, sourceMode]);
    useEffect(() => {
        setXExtents(getInitialExtents(rawData));
        setResetToken(token => token + 1);
    }, [rawData]);
    const tooltipDisplayTexts = useMemo(() => ({
        d: t("full.tooltip.date"),
        o: t("full.tooltip.open"),
        h: t("full.tooltip.high"),
        l: t("full.tooltip.low"),
        c: t("full.tooltip.close"),
        v: t("full.tooltip.volume"),
        na: t("common.na"),
    }), [t]);
    const chartData = rawData;
    if (!chartData.length) {
        return _jsx("div", { style: { color: "#f87171", padding: 20 }, children: t("live.error") });
    }
    const latest = chartData[chartData.length - 1];
    const previous = chartData[chartData.length - 2] ?? latest;
    const priceChange = latest && previous ? latest.close - previous.close : 0;
    const priceChangePercent = previous && previous.close ? priceChange / previous.close : 0;
    const emaTrendUp = Boolean(latest?.ema20 !== undefined && latest?.ema50 !== undefined && latest.ema20 >= latest.ema50);
    const rsiValue = latest?.rsi;
    const sourceStatusLabel = sourceMode === "local"
        ? t("full.source.local")
        : loadState === "loading"
            ? t("full.source.loading")
            : loadState === "live"
                ? t("full.source.live")
                : t("full.source.fallback");
    const sourceTone = sourceMode === "local"
        ? "neutral"
        : loadState === "loading"
            ? "accent"
            : loadState === "live"
                ? "positive"
                : "negative";
    const resolvedChartWidth = chartWidth || Math.max(320, Math.floor(window.innerWidth * 0.68));
    const chartHeight = Math.max(420, Math.min(760, Math.round(viewportHeight * 0.60)));
    const margin = { left: 60, right: 70, top: 18, bottom: 36 };
    const plotHeight = chartHeight - margin.top - margin.bottom;
    const priceHeight = Math.round(plotHeight * 0.4);
    const volumeHeight = Math.round(plotHeight * 0.14);
    const rsiPanelHeight = Math.round(plotHeight * 0.12);
    const macdHeight = Math.round(plotHeight * 0.14);
    const overviewHeight = plotHeight - priceHeight - volumeHeight - rsiPanelHeight - macdHeight;
    const gridWidth = Math.max(0, resolvedChartWidth - margin.left - margin.right);
    const topXAxisTheme = {
        ...axisTheme,
        outerTickSize: 0,
        showTicks: false,
    };
    const bottomXAxisTheme = {
        ...axisTheme,
        innerTickSize: -plotHeight,
        tickStrokeOpacity: 0.08,
    };
    const priceYAxisTheme = {
        ...axisTheme,
        innerTickSize: -gridWidth,
        tickStrokeOpacity: 0.08,
    };
    const volumeYAxisTheme = {
        ...axisTheme,
        ticks: 4,
        tickFormat: volumeFormat,
    };
    const volumeOrigin = createOrigin(overviewHeight + volumeHeight + rsiPanelHeight + macdHeight);
    const rsiOrigin = createOrigin(overviewHeight + rsiPanelHeight + macdHeight);
    const macdOrigin = createOrigin(overviewHeight + macdHeight);
    const overviewOrigin = createOrigin(overviewHeight);
    const handleBrush = ({ start, end }) => {
        setXExtents(normalizeBrushExtents(start, end));
        setResetToken(token => token + 1);
    };
    const handleResetView = () => {
        setXExtents(getInitialExtents(chartData));
        setResetToken(token => token + 1);
    };
    return (_jsxs(DemoPageShell, { className: "demo-page--classic", frameClassName: "demo-frame--classic", children: [_jsxs("section", { className: "demo-hero", children: [_jsxs("div", { className: "demo-hero__content", children: [_jsx("div", { className: "demo-eyebrow", children: t("full.eyebrow") }), _jsx("h1", { className: "demo-title", children: t("full.title") }), _jsx("p", { className: "demo-subtitle", children: t("full.subtitle") }), _jsx("div", { className: "demo-badges", children: [
                                    t("full.badge.candlestick"),
                                    t("full.badge.bollinger"),
                                    t("full.badge.volume"),
                                    t("full.badge.ema"),
                                    t("full.badge.rsi"),
                                    t("full.badge.macd"),
                                    t("full.badge.crosshair"),
                                    t("full.badge.zoomPan"),
                                    t("full.badge.brush"),
                                    t("full.badge.offline"),
                                ].map((badge) => _jsx("span", { className: "demo-badge", children: badge }, badge)) }), _jsxs("div", { className: "source-switch", role: "group", "aria-label": t("language.label"), children: [_jsx("button", { type: "button", className: "source-switch__button", "aria-pressed": language === "vi", onClick: () => setLanguage("vi"), children: t("language.vi") }), _jsx("button", { type: "button", className: "source-switch__button", "aria-pressed": language === "en", onClick: () => setLanguage("en"), children: t("language.en") })] })] }), _jsxs("aside", { className: "demo-summary-card", "aria-live": "polite", children: [_jsxs("div", { className: "demo-summary-card__header", children: [_jsx("span", { className: `source-chip source-chip--${sourceTone}`, children: sourceStatusLabel }), _jsx("span", { className: "demo-summary-card__meta", children: t("full.summaryMeta") })] }), _jsxs("div", { className: "demo-summary-grid", children: [_jsx(MetricTile, { label: t("full.metric.close"), value: priceFormat(latest.close), detail: `${formatSigned(priceChange, priceFormat)} (${formatSigned(priceChangePercent, percentFormat)})`, tone: priceChange >= 0 ? "positive" : "negative" }), _jsx(MetricTile, { label: t("full.metric.volume"), value: volumeFormat(latest.volume), detail: t("full.metric.volumeDetail"), tone: "accent" }), _jsx(MetricTile, { label: t("full.metric.rsi"), value: rsiValue != null ? priceFormat(rsiValue) : t("common.na"), detail: rsiValue != null ? (rsiValue > 70 ? t("full.metric.rsi.overbought") : rsiValue < 30 ? t("full.metric.rsi.oversold") : t("full.metric.rsi.neutral")) : t("common.na"), tone: rsiValue != null && rsiValue >= 70 ? "negative" : rsiValue != null && rsiValue <= 30 ? "positive" : "neutral" }), _jsx(MetricTile, { label: t("full.metric.ema"), value: emaTrendUp ? t("full.metric.ema.uptrend") : t("full.metric.ema.downtrend"), detail: latest.ema20 != null && latest.ema50 != null ? t("full.metric.ema.diff", { value: formatSigned(latest.ema20 - latest.ema50, priceFormat) }) : t("common.na"), tone: emaTrendUp ? "positive" : "negative" })] })] })] }), _jsxs("section", { className: "demo-grid", children: [_jsxs("article", { className: "demo-chart-card", children: [_jsxs("header", { className: "demo-chart-card__header", children: [_jsxs("div", { children: [_jsx("h2", { className: "demo-chart-card__title", children: t("full.chartTitle") }), _jsx("p", { className: "demo-chart-card__meta", children: t("full.chartMeta") })] }), _jsxs("div", { style: { display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "flex-end" }, children: [_jsxs("div", { className: "source-switch", role: "group", "aria-label": t("full.sourceSwitcher"), children: [_jsx("button", { type: "button", className: "source-switch__button", "aria-pressed": sourceMode === "local", onClick: () => setSourceMode("local"), children: t("full.sourceSwitcher.local") }), _jsx("button", { type: "button", className: "source-switch__button", "aria-pressed": sourceMode === "live", onClick: () => setSourceMode("live"), children: t("full.sourceSwitcher.live") })] }), _jsxs("div", { className: "source-switch", role: "group", "aria-label": t("language.label"), children: [_jsx("button", { type: "button", className: "source-switch__button", "aria-pressed": language === "vi", onClick: () => setLanguage("vi"), children: t("language.vi") }), _jsx("button", { type: "button", className: "source-switch__button", "aria-pressed": language === "en", onClick: () => setLanguage("en"), children: t("language.en") })] })] })] }), _jsx("div", { className: "chart-shell", children: _jsx("div", { className: "chart-surface", ref: chartSurfaceRef, children: resolvedChartWidth > 0 ? (_jsxs(ChartCanvas, { height: chartHeight, width: resolvedChartWidth, margin: margin, type: "hybrid", seriesName: `BTCUSD-${sourceMode}-${resetToken}`, data: chartData, xScale: scaleTime(), xAccessor: (datum) => datum.date, displayXAccessor: (datum) => datum.date, xExtents: xExtents, ratio: window.devicePixelRatio || 1, mouseMoveEvent: true, panEvent: true, zoomEvent: true, useCrossHairStyleCursor: true, children: [_jsxs(Chart, { id: 1, height: priceHeight, yExtents: [(datum) => [datum.high, datum.low], (datum) => datum.ema20, (datum) => datum.ema50, (datum) => datum.bollingerBand], padding: { top: 12, bottom: 18 }, children: [_jsx(XAxis, { axisAt: "bottom", orient: "bottom", ...topXAxisTheme }), _jsx(YAxis, { axisAt: "right", orient: "right", ticks: 6, ...priceYAxisTheme, tickFormat: priceFormat }), _jsx(BollingerSeries, { yAccessor: (datum) => datum.bollingerBand, stroke: bollingerAppearance.stroke, fill: bollingerAppearance.fill }), _jsx(CandlestickSeries, { fill: (datum) => (datum.close >= datum.open ? bullishColor : bearishColor), stroke: "rgba(15, 23, 42, 0.9)", wickStroke: "rgba(226, 232, 240, 0.78)" }), _jsx(LineSeries, { yAccessor: (datum) => datum.ema20, stroke: ema20Stroke }), _jsx(LineSeries, { yAccessor: (datum) => datum.ema50, stroke: ema50Stroke }), _jsx(CurrentCoordinate, { yAccessor: (datum) => datum.ema20, fill: ema20Stroke }), _jsx(CurrentCoordinate, { yAccessor: (datum) => datum.ema50, fill: ema50Stroke }), _jsx(EdgeIndicator, { itemType: "last", orient: "right", edgeAt: "right", yAccessor: (datum) => datum.close, fill: (datum) => (datum.close >= datum.open ? "#065f46" : "#991b1b"), lineStroke: (datum) => (datum.close >= datum.open ? "#14532d" : "#7f1d1d"), textFill: "#f8fafc" }), _jsx(OHLCTooltip, { origin: [12, 12], displayTexts: tooltipDisplayTexts, xDisplayFormat: dateFormat, volumeFormat: volumeFormat, textFill: "#f8fafc", labelFill: "#cbd5e1" }), _jsx(BollingerBandTooltip, { origin: [12, 56], yAccessor: (datum) => datum.bollingerBand, options: BOLLINGER_BAND_OPTIONS, displayFormat: priceFormat, textFill: "#f8fafc", labelFill: "#cbd5e1" }), _jsx(MouseCoordinateY, { ...coordinateTheme, at: "right", orient: "right", displayFormat: priceFormat }), _jsx(ZoomButtons, { onReset: handleResetView, size: [28, 24], heightFromBase: 48, fill: "rgba(15, 23, 42, 0.88)", fillOpacity: 1, stroke: "rgba(148, 163, 184, 0.28)", strokeWidth: 1, textFill: "#e2e8f0", textStrokeWidth: 0 })] }), _jsxs(Chart, { id: 2, height: volumeHeight, origin: volumeOrigin, yExtents: (datum) => datum.volume, padding: { top: 8, bottom: 8 }, children: [_jsx(YAxis, { axisAt: "left", orient: "left", ...volumeYAxisTheme }), _jsx(BarSeries, { yAccessor: (datum) => datum.volume, fill: (datum) => (datum.close >= datum.open ? bullishColor : bearishColor) }), _jsx(MouseCoordinateY, { ...coordinateTheme, at: "left", orient: "left", displayFormat: volumeFormat })] }), _jsxs(Chart, { id: 3, height: rsiPanelHeight, origin: rsiOrigin, yExtents: [0, 100], padding: { top: 10, bottom: 10 }, children: [_jsx(XAxis, { axisAt: "bottom", orient: "bottom", ...topXAxisTheme }), _jsx(YAxis, { axisAt: "right", orient: "right", tickValues: [30, 50, 70], ...axisTheme, tickFormat: integerFormat }), _jsx(RSISeries, { yAccessor: (datum) => datum.rsi, stroke: rsiAppearance.stroke, opacity: rsiAppearance.opacity, strokeDasharray: rsiAppearance.strokeDasharray, strokeWidth: rsiAppearance.strokeWidth, overSold: 70, middle: 50, overBought: 30 }), _jsx(RSITooltip, { origin: [12, 12], yAccessor: (datum) => datum.rsi, options: { windowSize: 14 }, textFill: "#f8fafc", labelFill: "#cbd5e1" }), _jsx(MouseCoordinateY, { ...coordinateTheme, at: "right", orient: "right", displayFormat: priceFormat })] }), _jsxs(Chart, { id: 4, height: macdHeight, origin: macdOrigin, yExtents: (datum) => datum.macd, padding: { top: 10, bottom: 10 }, children: [_jsx(XAxis, { axisAt: "bottom", orient: "bottom", ...bottomXAxisTheme }), _jsx(YAxis, { axisAt: "right", orient: "right", ticks: 2, ...axisTheme, tickFormat: priceFormat }), _jsx(MACDSeries, { yAccessor: (datum) => datum.macd, stroke: macdAppearance.stroke, fill: macdAppearance.fill }), _jsx(MACDTooltip, { origin: [12, 12], yAccessor: (datum) => datum.macd, options: { fast: 12, slow: 26, signal: 9 }, appearance: macdAppearance, labelFill: "#cbd5e1" }), _jsx(MouseCoordinateX, { ...coordinateTheme, at: "bottom", orient: "bottom", displayFormat: dateFormat }), _jsx(MouseCoordinateY, { ...coordinateTheme, at: "right", orient: "right", displayFormat: priceFormat })] }), _jsxs(Chart, { id: 5, height: overviewHeight, origin: overviewOrigin, yExtents: (datum) => datum.close, padding: { top: 6, bottom: 6 }, children: [_jsx(LineSeries, { yAccessor: (datum) => datum.close, stroke: "#67e8f9" }), _jsx(Brush, { enabled: true, type: "2D", onStart: () => { }, onBrush: handleBrush, stroke: "#22d3ee", fill: "rgba(34, 211, 238, 0.20)", strokeOpacity: 1, fillOpacity: 0.2, strokeDashArray: "ShortDash" })] }), _jsx(CrossHairCursor, { stroke: "#e2e8f0", opacity: 0.16, strokeDasharray: "ShortDash" })] })) : (_jsx("div", { className: "chart-placeholder", children: t("common.chartInitializing") })) }) })] }), _jsxs("aside", { className: "demo-side", children: [_jsxs("section", { className: "demo-panel", children: [_jsx("h2", { children: t("full.interactionGuide") }), _jsxs("div", { className: "feature-list", children: [_jsxs("div", { className: "feature-item", children: [_jsx("span", { className: "feature-dot" }), _jsx("p", { children: t("full.guide.zoom") })] }), _jsxs("div", { className: "feature-item", children: [_jsx("span", { className: "feature-dot" }), _jsx("p", { children: t("full.guide.hover") })] }), _jsxs("div", { className: "feature-item", children: [_jsx("span", { className: "feature-dot" }), _jsx("p", { children: t("full.guide.source") })] }), _jsxs("div", { className: "feature-item", children: [_jsx("span", { className: "feature-dot" }), _jsx("p", { children: t("full.guide.brush") })] }), _jsxs("div", { className: "feature-item", children: [_jsx("span", { className: "feature-dot" }), _jsx("p", { children: t("full.guide.fallback") })] })] })] }), _jsxs("section", { className: "demo-panel", children: [_jsx("h2", { children: t("full.legendTitle") }), _jsxs("div", { className: "legend-list", children: [_jsx(LegendRow, { color: bullishColor, label: t("full.badge.candlestick"), detail: t("full.legend.candlestick.detail"), variant: "block" }), _jsx(LegendRow, { color: "#38bdf8", label: t("full.badge.bollinger"), detail: t("full.legend.bollinger.detail") }), _jsx(LegendRow, { color: "#38bdf8", label: "EMA 20", detail: t("full.legend.ema20.detail") }), _jsx(LegendRow, { color: ema50Stroke, label: "EMA 50", detail: t("full.legend.ema50.detail") }), _jsx(LegendRow, { color: "#60a5fa", label: t("full.badge.rsi"), detail: t("full.legend.rsi.detail") }), _jsx(LegendRow, { color: "#f59e0b", label: t("full.badge.macd"), detail: t("full.legend.macd.detail") }), _jsx(LegendRow, { color: "#22d3ee", label: t("full.badge.brush"), detail: t("full.legend.brush.detail") })] })] }), _jsxs("section", { className: "demo-panel", children: [_jsx("h2", { children: t("full.dataNotes") }), _jsx("p", { className: "demo-note", children: t("full.dataNotesBody") })] })] })] })] }));
};
export default function FullDemo() {
    return (_jsx(DemoI18nBoundary, { children: _jsx(FullDemoContent, {}) }));
}
