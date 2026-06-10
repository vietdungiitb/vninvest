import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo } from "react";
import { VNInvestCharts } from "../index.js";
import { binanceAdapter } from "../lib/adapters/index.js";
import { widgetMessagesVi } from "../index.js";
import { useStockChartAdapter } from "./useStockChartAdapter.js";
// Import all styles to ensure the core widget renders perfectly
import "../widget/styles/widget.css";
import "../widget/styles/chart-splitter.css";
import "../widget/styles/pane-overlays.css";
import "../widget/styles/paper-trade.css";
import "../widget/styles/replay.css";
import "../widget/styles/overlays.css";
import "../widget/styles/drawing.css";
import "../widget/styles/toolbar.css";
import "../widget/styles/header.css";
import "../widget/styles/footer.css";
import "../widget/styles/settings.css";
export default function StandaloneEmbedDemo() {
    const [theme, setTheme] = useState("dark");
    const [symbol, setSymbol] = useState("BTCUSDT");
    const [timeframe, setTimeframe] = useState("1h");
    const [showDrawingPriceMarkers, setShowDrawingPriceMarkers] = useState(true);
    // Wrap binanceAdapter to map KLineBar.timestamp to OHLCVBar.date correctly
    const chartAdapter = useStockChartAdapter({
        activeSource: "binance",
        dataAdapter: binanceAdapter,
        selectedSymbol: symbol,
        useWidgetOwnedHistory: true,
        widgetData: [],
        backfillPageLimit: 1000,
    });
    // Core default panes configuration
    const panes = useMemo(() => [
        {
            id: "price",
            label: "Price",
            visible: true,
            heightRatio: 3,
            pinned: false,
            splitScale: false,
            tooltip: "value",
            series: [
                {
                    id: "price-main",
                    type: "Candlestick",
                    yAxis: "right",
                }
            ]
        },
        {
            id: "volume",
            label: "Volume",
            visible: true,
            heightRatio: 1,
            pinned: false,
            splitScale: false,
            tooltip: "value",
            series: [
                {
                    id: "vol-main",
                    type: "Volume",
                    yAxis: "right",
                }
            ]
        }
    ], []);
    const isDark = theme === "dark";
    return (_jsxs("div", { style: {
            display: "flex",
            flexDirection: "column",
            width: "100vw",
            height: "100vh",
            background: isDark ? "#080d16" : "#f4f6fa",
            color: isDark ? "#f3f4f6" : "#1f2937",
            fontFamily: "'Outfit', 'Inter', system-ui, -apple-system, sans-serif",
            overflow: "hidden",
            transition: "background-color 0.3s ease, color 0.3s ease",
        }, children: [_jsxs("header", { style: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 24px",
                    background: isDark ? "rgba(10, 17, 28, 0.85)" : "rgba(255, 255, 255, 0.85)",
                    borderBottom: `1px solid ${isDark ? "#1f293d" : "#e5e7eb"}`,
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                    zIndex: 100,
                }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: "12px" }, children: [_jsx("div", { style: {
                                    background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                                    color: "#ffffff",
                                    padding: "6px 12px",
                                    borderRadius: "8px",
                                    fontWeight: "bold",
                                    fontSize: "14px",
                                    letterSpacing: "0.5px",
                                    boxShadow: "0 4px 12px rgba(37, 99, 235, 0.3)",
                                }, children: "VNINVESTCHARTS" }), _jsx("h1", { style: { margin: 0, fontSize: "16px", fontWeight: 600 }, children: "Standalone Core Widget Test" }), _jsx("span", { style: {
                                    background: isDark ? "#1e293b" : "#e2e8f0",
                                    color: isDark ? "#94a3b8" : "#64748b",
                                    fontSize: "11px",
                                    padding: "3px 8px",
                                    borderRadius: "12px",
                                    fontWeight: 500,
                                }, children: "Embedded Mode" })] }), _jsxs("div", { style: { display: "flex", alignItems: "center", gap: "16px" }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: "8px" }, children: [_jsx("label", { style: { fontSize: "12px", color: isDark ? "#94a3b8" : "#64748b" }, children: "Symbol:" }), _jsxs("select", { value: symbol, onChange: (e) => setSymbol(e.target.value), style: {
                                            padding: "4px 8px",
                                            borderRadius: "6px",
                                            background: isDark ? "#111b27" : "#ffffff",
                                            color: isDark ? "#ffffff" : "#000000",
                                            border: `1px solid ${isDark ? "#334155" : "#cbd5e1"}`,
                                            outline: "none",
                                            fontSize: "13px",
                                        }, children: [_jsx("option", { value: "BTCUSDT", children: "BTCUSDT" }), _jsx("option", { value: "ETHUSDT", children: "ETHUSDT" }), _jsx("option", { value: "SOLUSDT", children: "SOLUSDT" })] })] }), _jsxs("div", { style: { display: "flex", alignItems: "center", gap: "8px" }, children: [_jsx("label", { style: { fontSize: "12px", color: isDark ? "#94a3b8" : "#64748b" }, children: "Timeframe:" }), _jsxs("select", { value: timeframe, onChange: (e) => setTimeframe(e.target.value), style: {
                                            padding: "4px 8px",
                                            borderRadius: "6px",
                                            background: isDark ? "#111b27" : "#ffffff",
                                            color: isDark ? "#ffffff" : "#000000",
                                            border: `1px solid ${isDark ? "#334155" : "#cbd5e1"}`,
                                            outline: "none",
                                            fontSize: "13px",
                                        }, children: [_jsx("option", { value: "1m", children: "1m" }), _jsx("option", { value: "5m", children: "5m" }), _jsx("option", { value: "15m", children: "15m" }), _jsx("option", { value: "1h", children: "1h" }), _jsx("option", { value: "1d", children: "1d" })] })] }), _jsx("button", { type: "button", onClick: () => setTheme((prev) => (prev === "dark" ? "light" : "dark")), style: {
                                    padding: "6px 12px",
                                    borderRadius: "8px",
                                    background: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
                                    color: "inherit",
                                    border: "none",
                                    cursor: "pointer",
                                    fontSize: "13px",
                                    fontWeight: 500,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    transition: "background-color 0.2s",
                                }, onMouseEnter: (e) => e.currentTarget.style.backgroundColor = isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.08)", onMouseLeave: (e) => e.currentTarget.style.backgroundColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)", children: isDark ? "☀️ Light Mode" : "🌙 Dark Mode" })] })] }), _jsxs("div", { style: { display: "flex", flex: 1, minHeight: 0, position: "relative" }, children: [_jsxs("aside", { style: {
                            width: "320px",
                            background: isDark ? "#0e1624" : "#ffffff",
                            borderRight: `1px solid ${isDark ? "#1f293d" : "#e5e7eb"}`,
                            padding: "20px",
                            overflowY: "auto",
                            display: "flex",
                            flexDirection: "column",
                            gap: "20px",
                        }, children: [_jsxs("div", { children: [_jsx("h2", { style: { fontSize: "14px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "#3b82f6", margin: "0 0 12px 0" }, children: "Ph\u00E2n t\u00EDch nh\u00FAng \u0111\u1ED9c l\u1EADp" }), _jsxs("p", { style: { fontSize: "13px", lineHeight: "1.6", color: isDark ? "#94a3b8" : "#4b5563", margin: 0 }, children: ["Trang n\u00E0y \u0111ang tr\u1EF1c ti\u1EBFp render component ", _jsx("code", { children: "<VNInvestCharts>" }), " t\u1EEB ", _jsx("code", { children: "src/widget" }), " m\u00E0 kh\u00F4ng s\u1EED d\u1EE5ng giao di\u1EC7n bao ngo\u00E0i Demo Showcase."] })] }), _jsxs("div", { style: {
                                    background: isDark ? "rgba(59, 130, 246, 0.08)" : "rgba(59, 130, 246, 0.05)",
                                    border: `1px solid ${isDark ? "rgba(59, 130, 246, 0.2)" : "rgba(59, 130, 246, 0.15)"}`,
                                    borderRadius: "8px",
                                    padding: "14px",
                                }, children: [_jsx("h3", { style: { fontSize: "13px", fontWeight: 600, color: "#3b82f6", margin: "0 0 8px 0" }, children: "T\u00EDnh n\u0103ng c\u00F3 s\u1EB5n \u1EDF Widget:" }), _jsxs("ul", { style: { fontSize: "12px", color: isDark ? "#cbd5e1" : "#374151", margin: 0, paddingLeft: "16px", lineHeight: "1.8" }, children: [_jsx("li", { children: "V\u1EBD k\u1EF9 thu\u1EADt \u0111\u1EA7y \u0111\u1EE7 (Magnet, Lock, Hide) v\u00E0 toolbar b\u00EAn tr\u00E1i." }), _jsx("li", { children: "Thanh hi\u1EC3n th\u1ECB OHLC \u0111\u1ED9ng chuy\u00EAn nghi\u1EC7p." }), _jsx("li", { children: "T\u1EF1 thay \u0111\u1ED5i m\u00E3 ch\u1EE9ng kho\u00E1n (Quick Search) v\u00E0 khung th\u1EDDi gian tr\u1EF1c ti\u1EBFp tr\u00EAn thanh c\u00F4ng c\u1EE5." }), _jsx("li", { children: "T\u00EDch h\u1EE3p Settings Modal c\u1EA5u h\u00ECnh ch\u1EC9 b\u00E1o k\u1EF9 thu\u1EADt, \u0111\u01B0\u1EDDng l\u01B0\u1EDBi, giao di\u1EC7n." }), _jsx("li", { children: "\u0110\u1ED3ng b\u1ED9 h\u00F3a/n\u1EA1p d\u1EEF li\u1EC7u l\u1ECBch s\u1EED v\u00E0 th\u1EDDi gian th\u1EF1c t\u1EF1 \u0111\u1ED9ng cho Binance & VNInvest." }), _jsx("li", { children: "H\u1ED7 tr\u1EE3 m\u00F4 ph\u1ECFng Replay d\u1EEF li\u1EC7u l\u1ECBch s\u1EED v\u00E0 Giao d\u1ECBch gi\u1EA3 l\u1EADp (Paper Trading)." }), _jsx("li", { children: "Ch\u1EE9c n\u0103ng ch\u1EE5p \u1EA3nh m\u00E0n h\u00ECnh (Snapshot) to\u00E0n b\u1ED9 viewport k\u00E8m preview xem tr\u01B0\u1EDBc khi l\u01B0u." })] })] }), _jsxs("div", { style: {
                                    background: isDark ? "rgba(16, 185, 129, 0.08)" : "rgba(16, 185, 129, 0.05)",
                                    border: `1px solid ${isDark ? "rgba(16, 185, 129, 0.2)" : "rgba(16, 185, 129, 0.15)"}`,
                                    borderRadius: "8px",
                                    padding: "14px",
                                }, children: [_jsx("h3", { style: { fontSize: "13px", fontWeight: 600, color: "#10b981", margin: "0 0 8px 0" }, children: "L\u01B0u \u00FD t\u00EDch h\u1EE3p & c\u1EA5u h\u00ECnh:" }), _jsxs("ul", { style: { fontSize: "12px", color: isDark ? "#cbd5e1" : "#374151", margin: 0, paddingLeft: "16px", lineHeight: "1.8" }, children: [_jsx("li", { children: "N\u00FAt ch\u1ECDn \u1EDF header trang n\u00E0y m\u00F4 ph\u1ECFng c\u00E1ch \u1EE9ng d\u1EE5ng ch\u1EE7 ki\u1EC3m so\u00E1t m\u00E3 ch\u1EE9ng kho\u00E1n/khung th\u1EDDi gian t\u1EEB b\u00EAn ngo\u00E0i (Controlled Mode)." }), _jsx("li", { children: "C\u1EA7n c\u1EA5u h\u00ECnh Data Adapter ph\u00F9 h\u1EE3p \u0111\u1EC3 kh\u1EDFi t\u1EA1o lu\u1ED3ng d\u1EEF li\u1EC7u t\u1EF1 \u0111\u1ED9ng." }), _jsx("li", { children: "Thi\u1EBFt l\u1EADp Personal Access Token (PAT) n\u1EBFu mu\u1ED1n truy c\u1EADp c\u00E1c ngu\u1ED3n d\u1EEF li\u1EC7u b\u1EA3o m\u1EADt." }), _jsx("li", { children: "C\u00F3 th\u1EC3 b\u1EADt/t\u1EAFt toolbar, header, footer v\u00E0 c\u1EA5u h\u00ECnh hi\u1EC3n th\u1ECB Pane qua thu\u1ED9c t\u00EDnh Props." })] })] }), _jsxs("div", { style: { display: "flex", flexDirection: "column", gap: "8px" }, children: [_jsx("label", { style: { fontSize: "12px", fontWeight: 600, color: isDark ? "#94a3b8" : "#4b5563" }, children: "C\u1EA5u h\u00ECnh Widget Props:" }), _jsxs("label", { style: { display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", cursor: "pointer" }, children: [_jsx("input", { type: "checkbox", checked: showDrawingPriceMarkers, onChange: (e) => setShowDrawingPriceMarkers(e.target.checked) }), "Hi\u1EC3n th\u1ECB nh\u00E3n gi\u00E1 c\u1EE7a h\u00ECnh v\u1EBD"] })] })] }), _jsx("main", { style: { flex: 1, display: "flex", flexDirection: "column", minHeight: 0, position: "relative" }, children: _jsx(VNInvestCharts, { adapter: chartAdapter, symbol: symbol, timeframe: timeframe, panes: panes, theme: theme, drawingUiEnabled: true, showToolbar: true, showHeader: true, showFooter: true, showDrawingPriceMarkers: showDrawingPriceMarkers, locale: "vi", messages: widgetMessagesVi }) })] })] }));
}
