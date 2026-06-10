import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Human-readable fallback labels for each series type
const SERIES_LABELS = {
    Candlestick: "Candlestick",
    HollowCandle: "Hollow Candle",
    OHLC: "OHLC Bar",
    HeikinAshi: "Heikin-Ashi",
    Line: "Line",
    Area: "Area",
    Bar: "Bar",
    EMA: "Exponential Moving Average",
    BollingerBand: "Bollinger Bands",
    Volume: "Volume",
    Whale: "Whale Orders",
    CVDApprox: "Cumulative Volume Delta",
    CVDRealtime: "Real-time Cumulative Volume Delta",
    RSI: "Relative Strength Index",
    MACD: "Moving Average Convergence Divergence",
    StrengthElder: "Elder Ray Index",
    StrengthRelative: "Relative Strength",
    KDJ: "Stochastic KDJ",
    CCI: "Commodity Channel Index",
    DMI: "Directional Movement Index",
    BIAS: "Bias Ratio",
    BRAR: "Bull Bear Ratio",
    MTM: "Momentum",
    EMV: "Ease of Movement",
    AO: "Awesome Oscillator",
    ROC: "Rate of Change",
    TRIX: "Triple Exponential Moving Average",
    DMA: "Differential Moving Average",
    PVT: "Price Volume Trend",
    PSY: "Psychological Line",
    CR: "CR Indicator",
};
function paramNumber(params, key, fallback) {
    const value = params?.[key];
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function seriesLabel(type, params) {
    const base = SERIES_LABELS[type] ?? type;
    if (type === "EMA")
        return `${base} (${paramNumber(params, "period", 20)})`;
    if (type === "RSI")
        return `${base} (${paramNumber(params, "period", 14)})`;
    if (type === "BollingerBand")
        return `${base} (${paramNumber(params, "period", 20)},${paramNumber(params, "stdDev", 2)})`;
    if (type === "MACD")
        return `${base} (${paramNumber(params, "fast", 12)},${paramNumber(params, "slow", 26)},${paramNumber(params, "signal", 9)})`;
    if (type === "KDJ")
        return `${base} (${paramNumber(params, "period", 9)},${paramNumber(params, "m1", 3)},${paramNumber(params, "m2", 3)})`;
    if (type === "CCI")
        return `${base} (${paramNumber(params, "period", 20)})`;
    if (type === "DMI")
        return `${base} (${paramNumber(params, "period", 14)})`;
    if (type === "BIAS")
        return `${base} (${paramNumber(params, "period", 6)})`;
    if (type === "BRAR")
        return `${base} (${paramNumber(params, "period", 26)})`;
    if (type === "MTM")
        return `${base} (${paramNumber(params, "period", 6)})`;
    if (type === "EMV")
        return `${base} (${paramNumber(params, "period", 14)})`;
    if (type === "ROC")
        return `${base} (${paramNumber(params, "period", 12)})`;
    if (type === "TRIX")
        return `${base} (${paramNumber(params, "period", 12)})`;
    if (type === "DMA")
        return `${base} (${paramNumber(params, "fastPeriod", 10)},${paramNumber(params, "slowPeriod", 50)})`;
    if (type === "PSY")
        return `${base} (${paramNumber(params, "period", 12)})`;
    if (type === "CR")
        return `${base} (${paramNumber(params, "period", 26)})`;
    if (type === "Whale")
        return `${base} (${paramNumber(params, "threshold", 50_000)})`;
    return base;
}
// Price-chart primary series: shown in the chip strip only for non-pinned panes.
// For the pinned (price) pane, price type chips are hidden since chart type is
// controlled separately by the chart type button in the topbar.
const PRIMARY_CHART_TYPES = [
    "Candlestick", "HollowCandle", "OHLC", "HeikinAshi", "Line", "Area", "Bar",
];
export function IndicatorLegend({ pane, onToggleSeries, onRemoveSeries, className, labels }) {
    // For the price pane: exclude primary chart types (controlled by topbar chart type picker)
    // For other panes: show all series
    const chips = pane.pinned
        ? pane.series.filter((s) => !PRIMARY_CHART_TYPES.includes(s.type))
        : pane.series;
    if (chips.length === 0)
        return null;
    return (_jsx("div", { className: `rsc-indicator-legend${className ? ` ${className}` : ""}`, children: chips.map((series) => {
            const seriesIndex = pane.series.indexOf(series);
            const hidden = series.visible === false;
            const shortLabel = labels?.seriesLabel?.(series.type, series.params) ?? seriesLabel(series.type, series.params);
            const chipStyle = series.color
                ? { "--chip-color": series.color }
                : undefined;
            return (_jsxs("div", { className: `rsc-indicator-chip${hidden ? " rsc-indicator-chip--hidden" : ""}`, style: chipStyle, children: [_jsx("span", { className: "rsc-indicator-chip__dot", "aria-hidden": "true" }), _jsx("span", { className: "rsc-indicator-chip__name", children: shortLabel }), _jsx("button", { type: "button", className: "rsc-indicator-chip__btn rsc-indicator-chip__btn--eye", onClick: () => onToggleSeries(series.type, seriesIndex), title: hidden ? labels?.showIndicatorTitle ?? "Hiện indicator" : labels?.hideIndicatorTitle ?? "Ẩn indicator", "aria-label": hidden ? labels?.showIndicatorAriaLabel?.(shortLabel) ?? `Hiện ${series.type}` : labels?.hideIndicatorAriaLabel?.(shortLabel) ?? `Ẩn ${series.type}`, "aria-pressed": !hidden, children: hidden ? "◌" : "👁" }), _jsx("button", { type: "button", className: "rsc-indicator-chip__btn rsc-indicator-chip__btn--remove", onClick: () => onRemoveSeries(series.type, seriesIndex), title: labels?.removeIndicatorTitle ?? "Xóa indicator khỏi pane này", "aria-label": labels?.removeIndicatorAriaLabel?.(shortLabel) ?? `Xóa ${series.type}`, children: "\u00D7" })] }, `${series.type}-${seriesIndex}`));
        }) }));
}
