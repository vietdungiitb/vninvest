import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { getSeries, listRegistered } from "./registry/SeriesRegistry.js";
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
    MA: "Moving Average",
    BBI: "Bull and Bear Index",
    SAR: "Parabolic SAR",
    OBV: "On Balance Volume",
    WR: "Williams %R",
    VR: "Volume Ratio",
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
function formatSeriesLabel(type, params) {
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
function buildDefaultSeries(type) {
    const entry = getSeries(type);
    return {
        type,
        params: { ...entry.defaultParams },
        yAxis: entry.defaultYAxis,
    };
}
export function SeriesPicker({ pane, onAddSeries, onRemoveSeries, anchorRef, onClose }) {
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const pickerRef = useRef(null);
    const seriesTypes = useMemo(() => listRegistered(), []);
    useEffect(() => {
        const updatePosition = () => {
            const anchor = anchorRef.current;
            if (!anchor) {
                return;
            }
            const container = anchor.closest(".rsc-pane-wrap");
            const anchorRect = anchor.getBoundingClientRect();
            const containerRect = container?.getBoundingClientRect();
            setPosition({
                top: containerRect ? anchorRect.bottom - containerRect.top + 6 : anchorRect.bottom + 6,
                left: containerRect ? anchorRect.left - containerRect.left : anchorRect.left,
            });
        };
        updatePosition();
        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition, true);
        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                onClose?.();
            }
        };
        const handleMouseDown = (event) => {
            const target = event.target;
            const anchor = anchorRef.current;
            const picker = pickerRef.current;
            const clickInsidePicker = Boolean(picker?.contains(target));
            const clickInsideAnchor = Boolean(anchor?.contains(target));
            if (!clickInsidePicker && !clickInsideAnchor) {
                onClose?.();
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        document.addEventListener("mousedown", handleMouseDown);
        return () => {
            window.removeEventListener("resize", updatePosition);
            window.removeEventListener("scroll", updatePosition, true);
            document.removeEventListener("keydown", handleKeyDown);
            document.removeEventListener("mousedown", handleMouseDown);
        };
    }, [anchorRef, onClose]);
    return (_jsxs("div", { ref: pickerRef, className: "rsc-series-picker", style: { top: position.top, left: position.left }, role: "dialog", "aria-label": "Series picker", children: [_jsx("ul", { className: "rsc-series-picker__list", children: seriesTypes.map((type) => {
                    const active = pane.series.some((series) => series.type === type);
                    return (_jsx("li", { children: _jsxs("button", { type: "button", className: `rsc-series-picker__item${active ? " rsc-series-picker__item--active" : ""}`, onClick: () => {
                                if (active) {
                                    onRemoveSeries(type);
                                }
                                else {
                                    onAddSeries(buildDefaultSeries(type));
                                }
                            }, "aria-pressed": active, children: [_jsx("span", { children: formatSeriesLabel(type, getSeries(type).defaultParams) }), _jsx("span", { className: "rsc-series-picker__check", children: active ? "✓" : "" })] }) }, type));
                }) }), _jsx("div", { className: "rsc-series-picker__footer", children: "Nh\u1EA5n Esc \u0111\u1EC3 \u0111\u00F3ng. Ch\u1EA1m l\u1EA1i v\u00E0o m\u1ED9t m\u1EE5c \u0111\u1EC3 x\u00F3a series." })] }));
}
