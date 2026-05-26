import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { scaleTime } from "d3-scale";
import ChartCanvas from "../lib/ChartCanvas.js";
import Chart from "../lib/Chart.js";
import CandlestickSeries from "../lib/series/CandlestickSeries.js";
import { formatBinanceKlines, getOfflineDemoData } from "./demoData.js";
import DemoPageShell from "./DemoPageShell.js";
import { DemoI18nBoundary, useDemoI18n } from "./i18n.js";
const LiveDemoContent = () => {
    const { language, setLanguage, t } = useDemoI18n();
    const [data, setData] = useState(() => getOfflineDemoData());
    const [sourceMode, setSourceMode] = useState("local");
    useEffect(() => {
        let cancelled = false;
        // Try live BTCUSDT data first, but keep the local fallback available.
        fetch("https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=100")
            .then(res => res.json())
            .then(json => {
            if (cancelled)
                return;
            setData(formatBinanceKlines(json));
            setSourceMode("live");
        })
            .catch(err => {
            console.error("Failed to fetch data:", err);
            if (cancelled)
                return;
            setData(getOfflineDemoData());
            setSourceMode("local");
        });
        return () => {
            cancelled = true;
        };
    }, []);
    if (data.length === 0)
        return _jsx("div", { style: { color: "red", padding: 20 }, children: t("live.error") });
    const width = window.innerWidth - 40;
    const height = window.innerHeight - 150;
    const margin = { left: 50, right: 50, top: 20, bottom: 30 };
    const sourceLabel = t(sourceMode === "live" ? "live.binance" : "live.localFallback");
    return (_jsxs(DemoPageShell, { className: "demo-page--classic", frameClassName: "demo-frame--full-bleed", children: [_jsxs("div", { style: { display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", color: "white", padding: "0 20px 12px", flexWrap: "wrap" }, children: [_jsx("div", { children: sourceLabel }), _jsxs("div", { style: { display: "flex", gap: 8 }, role: "group", "aria-label": t("language.label"), children: [_jsx("button", { type: "button", onClick: () => setLanguage("vi"), style: { padding: "4px 10px", borderRadius: 999, border: language === "vi" ? "1px solid #22d3ee" : "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "white" }, children: t("language.vi") }), _jsx("button", { type: "button", onClick: () => setLanguage("en"), style: { padding: "4px 10px", borderRadius: 999, border: language === "en" ? "1px solid #22d3ee" : "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "white" }, children: t("language.en") })] })] }), _jsx(ChartCanvas, { height: height, width: width, margin: margin, type: "hybrid", seriesName: "BTCUSDT", data: data, xScale: scaleTime(), xAccessor: (d) => d.date, xExtents: [data[0].date, data[data.length - 1].date], ratio: window.devicePixelRatio || 1, children: _jsx(Chart, { id: 1, yExtents: (d) => [d.high, d.low], children: _jsx(CandlestickSeries, {}) }) })] }));
};
export default function LiveDemo() {
    return (_jsx(DemoI18nBoundary, { children: _jsx(LiveDemoContent, {}) }));
}
