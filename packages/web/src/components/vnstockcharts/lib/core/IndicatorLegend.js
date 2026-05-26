import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Human-readable short labels for each series type
const SERIES_LABELS = {
    Candlestick: "Candle",
    HollowCandle: "Hollow",
    OHLC: "OHLC",
    HeikinAshi: "HA",
    Line: "Line",
    Area: "Area",
    Bar: "Bar",
    EMA: "EMA",
    BollingerBand: "BB",
    Volume: "Vol",
    Whale: "Whale",
    CVDApprox: "CVD",
    CVDRealtime: "CVD RT",
    RSI: "RSI",
    MACD: "MACD",
    StrengthElder: "Elder",
    StrengthRelative: "RS",
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
};
function paramNumber(params, key, fallback) {
    const value = params?.[key];
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function seriesLabel(type, params) {
    const base = SERIES_LABELS[type] ?? type;
    if (type === "EMA" && typeof params?.period === "number")
        return `EMA(${params.period})`;
    if (type === "RSI" && typeof params?.period === "number")
        return `RSI(${params.period})`;
    if (type === "BollingerBand" && typeof params?.period === "number")
        return `BB(${params.period})`;
    if (type === "MACD") {
        const fast = typeof params?.fast === "number" ? params.fast : 12;
        const slow = typeof params?.slow === "number" ? params.slow : 26;
        return `MACD(${fast},${slow})`;
    }
    if (type === "KDJ")
        return `KDJ(${paramNumber(params, "period", 9)},${paramNumber(params, "m1", 3)},${paramNumber(params, "m2", 3)})`;
    if (type === "CCI")
        return `CCI(${paramNumber(params, "period", 20)})`;
    if (type === "DMI")
        return `DMI(${paramNumber(params, "period", 14)})`;
    if (type === "BIAS")
        return `BIAS(${paramNumber(params, "period", 6)})`;
    if (type === "BRAR")
        return `BRAR(${paramNumber(params, "period", 26)})`;
    if (type === "MTM")
        return `MTM(${paramNumber(params, "period", 6)})`;
    if (type === "EMV")
        return `EMV(${paramNumber(params, "period", 14)})`;
    if (type === "ROC")
        return `ROC(${paramNumber(params, "period", 12)})`;
    if (type === "TRIX")
        return `TRIX(${paramNumber(params, "period", 12)})`;
    if (type === "DMA")
        return `DMA(${paramNumber(params, "fastPeriod", 10)},${paramNumber(params, "slowPeriod", 50)})`;
    if (type === "PSY")
        return `PSY(${paramNumber(params, "period", 12)})`;
    if (type === "CR")
        return `CR(${paramNumber(params, "period", 26)})`;
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
