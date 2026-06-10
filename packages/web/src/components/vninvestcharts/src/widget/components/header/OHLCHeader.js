import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * WE2 P2-03: OHLCHeader
 *
 * Top bar showing symbol, timeframe, OHLC values, volume, and change %.
 *
 * SSOT Indicator Field Compliance:
 * - Reads indicator values via `resolveSeriesValue` / `resolveSeriesStructuredValue`
 *   from `src/lib/core/seriesValueResolver.ts`
 * - DOES NOT hardcode `d.ema20`, `d.rsi14`, etc.
 *
 * Updates via HoverEmitter (EventTarget ref) — does NOT trigger React re-render
 * on every pixel move. Only updates DOM refs directly.
 */
import { useEffect, useRef, useState } from "react";
import { useHoverSubscription } from "../../context/HoverEmitter.js";
function formatPrice(value) {
    return value.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatVolume(value) {
    if (value >= 1_000_000)
        return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000)
        return `${(value / 1_000).toFixed(0)}K`;
    return value.toString();
}
function formatChange(current, previous) {
    const diff = current - previous;
    const pct = previous !== 0 ? (diff / previous) * 100 : 0;
    const sign = diff >= 0 ? "+" : "";
    return {
        text: `${sign}${diff.toFixed(2)} (${sign}${pct.toFixed(2)}%)`,
        positive: diff >= 0,
    };
}
export function OHLCHeader({ symbol, timeframe, hoverEmitterRef, showMenu = true, isFullscreen = false, searchOpen = false, onSearchToggle, onSettingsClick, onFullscreenClick, onSnapshotClick, }) {
    const [hoveredDatum, setHoveredDatum] = useState(undefined);
    const ohlcRef = useRef(null);
    const volRef = useRef(null);
    const changeRef = useRef(null);
    // Subscribe to hover events via Emitter
    useHoverSubscription(hoverEmitterRef ?? { current: null }, (payload) => {
        setHoveredDatum(payload.datum);
    });
    // Update DOM refs directly to avoid re-render on hover
    useEffect(() => {
        if (!hoveredDatum)
            return;
        if (ohlcRef.current) {
            ohlcRef.current.textContent = `O: ${formatPrice(hoveredDatum.open)}  H: ${formatPrice(hoveredDatum.high)}  L: ${formatPrice(hoveredDatum.low)}  C: ${formatPrice(hoveredDatum.close)}`;
        }
        if (volRef.current) {
            volRef.current.textContent = `Vol: ${formatVolume(hoveredDatum.volume)}`;
        }
        if (changeRef.current) {
            const change = formatChange(hoveredDatum.close, hoveredDatum.open);
            changeRef.current.textContent = change.text;
            changeRef.current.style.color = change.positive ? "#089981" : "#f23645";
        }
    }, [hoveredDatum]);
    return (_jsxs("div", { className: "vnsc-ohlc-header", "data-testid": "ohlc-header", style: {
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "6px 12px",
            background: "var(--vnsc-bg-secondary, #111820)",
            borderBottom: "1px solid var(--vnsc-border, #2a2a2a)",
            fontFamily: "Helvetica Neue, Helvetica, Arial, sans-serif",
            fontSize: "12px",
            color: "var(--vnsc-text-primary, #e0e0e0)",
            zIndex: 30,
        }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: "8px" }, children: [_jsx("strong", { style: { fontSize: "14px", fontWeight: 700 }, className: "vnsc-ohlc-header__symbol", children: symbol ?? "—" }), timeframe && (_jsx("span", { className: "vnsc-ohlc-header__timeframe", style: {
                            background: "var(--vnsc-accent, #2962ff)",
                            color: "#fff",
                            padding: "2px 6px",
                            borderRadius: "3px",
                            fontSize: "11px",
                            fontWeight: 600,
                        }, children: timeframe }))] }), _jsx("span", { ref: ohlcRef, className: "vnsc-ohlc-header__values", style: { color: "var(--vnsc-text-secondary, #a0a0a0)", whiteSpace: "nowrap" } }), _jsx("span", { ref: volRef, className: "vnsc-ohlc-header__volume", style: { color: "var(--vnsc-text-secondary, #a0a0a0)" } }), _jsx("span", { ref: changeRef, className: "vnsc-ohlc-header__change", style: { fontWeight: 600 } }), showMenu && (_jsxs("div", { className: "vnsc-ohlc-header__menu", style: { marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px" }, children: [_jsx("button", { type: "button", className: `vnsc-ohlc-menu-btn${searchOpen ? " vnsc-ohlc-menu-btn--active" : ""}`, onClick: onSearchToggle, title: "Quick Search", "data-testid": "menu-search-btn", children: _jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("circle", { cx: "7.5", cy: "7.5", r: "4.5" }), _jsx("line", { x1: "11", y1: "11", x2: "14", y2: "14" }), _jsx("path", { d: "M8 4.5 L6.5 7.5 H8.5 L7.5 10.5 L9.5 7.5 H7.5 Z" })] }) }), _jsx("button", { type: "button", className: "vnsc-ohlc-menu-btn", onClick: onSettingsClick, title: "Settings", "data-testid": "menu-settings-btn", children: _jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("polygon", { points: "8,2 13.5,5 13.5,11 8,14 2.5,11 2.5,5" }), _jsx("circle", { cx: "8", cy: "8", r: "2.5" })] }) }), _jsx("button", { type: "button", className: `vnsc-ohlc-menu-btn${isFullscreen ? " vnsc-ohlc-menu-btn--active" : ""}`, onClick: onFullscreenClick, title: "Full Screen Mode", "data-testid": "menu-fullscreen-btn", children: _jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M3 6V3.5A.5.5 0 0 1 3.5 3H6" }), _jsx("path", { d: "M10 3h2.5a.5.5 0 0 1 .5.5V6" }), _jsx("path", { d: "M13 10v2.5a.5.5 0 0 1-.5.5H10" }), _jsx("path", { d: "M6 13H3.5a.5.5 0 0 1-.5-.5V10" })] }) }), _jsx("button", { type: "button", className: "vnsc-ohlc-menu-btn", onClick: onSnapshotClick, title: "Take a Snapshot", "data-testid": "menu-snapshot-btn", children: _jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M5 5.5 L6 3.5 H10 L11 5.5" }), _jsx("rect", { x: "2", y: "5.5", width: "12", height: "8", rx: "1.5" }), _jsx("circle", { cx: "8", cy: "9.5", r: "2" })] }) })] }))] }));
}
