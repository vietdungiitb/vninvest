import { useEffect, useState } from "react";
import { scaleTime } from "d3-scale";
import ChartCanvas from "../lib/ChartCanvas";
import Chart from "../lib/Chart";
import CandlestickSeries from "../lib/series/CandlestickSeries";
import { formatBinanceKlines, getOfflineDemoData, type DemoDatum } from "./demoData";
import DemoPageShell from "./DemoPageShell";
import { DemoI18nBoundary, useDemoI18n } from "./i18n";

const LiveDemoContent = () => {
    const { language, setLanguage, t } = useDemoI18n();
    const [data, setData] = useState<DemoDatum[]>(() => getOfflineDemoData());
    const [sourceMode, setSourceMode] = useState<"local" | "live">("local");

    useEffect(() => {
        let cancelled = false;

        // Try live BTCUSDT data first, but keep the local fallback available.
        fetch("https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=100")
            .then(res => res.json())
            .then(json => {
                if (cancelled) return;
                setData(formatBinanceKlines(json));
                setSourceMode("live");
            })
            .catch(err => {
                console.error("Failed to fetch data:", err);
                if (cancelled) return;
                setData(getOfflineDemoData());
                setSourceMode("local");
            });

        return () => {
            cancelled = true;
        };
    }, []);

    if (data.length === 0) return <div style={{ color: "red", padding: 20 }}>{t("live.error")}</div>;

    const width = window.innerWidth - 40;
    const height = window.innerHeight - 150;
    const margin = { left: 50, right: 50, top: 20, bottom: 30 };
    const sourceLabel = t(sourceMode === "live" ? "live.binance" : "live.localFallback");

    return (
        <DemoPageShell className="demo-page--classic" frameClassName="demo-frame--full-bleed">
            <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", color: "white", padding: "0 20px 12px", flexWrap: "wrap" }}>
                <div>{sourceLabel}</div>
                <div style={{ display: "flex", gap: 8 }} role="group" aria-label={t("language.label")}>
                    <button type="button" onClick={() => setLanguage("vi")} style={{ padding: "4px 10px", borderRadius: 999, border: language === "vi" ? "1px solid #22d3ee" : "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "white" }}>
                        {t("language.vi")}
                    </button>
                    <button type="button" onClick={() => setLanguage("en")} style={{ padding: "4px 10px", borderRadius: 999, border: language === "en" ? "1px solid #22d3ee" : "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "white" }}>
                        {t("language.en")}
                    </button>
                </div>
            </div>
            <ChartCanvas
                height={height}
                width={width}
                margin={margin}
                type="hybrid"
                seriesName="BTCUSDT"
                data={data}
                xScale={scaleTime()}
                xAccessor={(d: any) => d.date}
                xExtents={[data[0].date, data[data.length - 1].date]}
                ratio={window.devicePixelRatio || 1}
            >
                <Chart id={1} yExtents={(d: any) => [d.high, d.low]}>
                    <CandlestickSeries />
                </Chart>
            </ChartCanvas>
        </DemoPageShell>
    );
};

export default function LiveDemo() {
    return (
        <DemoI18nBoundary>
            <LiveDemoContent />
        </DemoI18nBoundary>
    );
}
