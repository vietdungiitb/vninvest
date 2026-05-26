import { useEffect, useMemo, useRef, useState } from "react";
import { scaleTime } from "d3-scale";
import { format } from "d3-format";
import { timeFormat } from "d3-time-format";

import ChartCanvas from "../lib/ChartCanvas";
import Chart from "../lib/Chart";
import { Brush } from "../lib/interactive";
import ZoomButtons from "../lib/ZoomButtons";
import BarSeries from "../lib/series/BarSeries";
import CandlestickSeries from "../lib/series/CandlestickSeries";
import BollingerSeries from "../lib/series/BollingerSeries";
import LineSeries from "../lib/series/LineSeries";
import MACDSeries from "../lib/series/MACDSeries";
import RSISeries from "../lib/series/RSISeries";
import { XAxis, YAxis } from "../lib/axes";
import { CrossHairCursor, CurrentCoordinate, EdgeIndicator, MouseCoordinateX, MouseCoordinateY } from "../lib/coordinates";
import { BollingerBandTooltip, MACDTooltip, OHLCTooltip, RSITooltip } from "../lib/tooltip";
import { BOLLINGER_BAND_OPTIONS, fetchLiveDemoData, getOfflineDemoData, type DemoDatum } from "./demoData";
import DemoPageShell from "./DemoPageShell";
import { DemoI18nBoundary, useDemoI18n } from "./i18n";
import "./demo.css";

type DemoSourceMode = "local" | "live";
type DemoLoadState = "local" | "loading" | "live" | "fallback";

interface BrushPoint {
    xValue: Date | number;
    yValue: number;
}

interface BrushSelection {
    start: BrushPoint;
    end: BrushPoint;
}

interface MetricTileProps {
    label: string;
    value: string;
    detail: string;
    tone?: "neutral" | "positive" | "negative" | "accent";
}

interface LegendRowProps {
    label: string;
    detail: string;
    color: string;
    variant?: "line" | "block";
}

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

function formatSigned(value: number, formatter: (input: number) => string) {
    const sign = value > 0 ? "+" : value < 0 ? "-" : "";
    return `${sign}${formatter(Math.abs(value))}`;
}

function MetricTile({ label, value, detail, tone = "neutral" }: MetricTileProps) {
    return (
        <div className={`metric-tile metric-tile--${tone}`}>
            <div className="metric-tile__label">{label}</div>
            <div className="metric-tile__value">{value}</div>
            <div className="metric-tile__detail">{detail}</div>
        </div>
    );
}

function LegendRow({ label, detail, color, variant = "line" }: LegendRowProps) {
    return (
        <div className="legend-row">
            <div className="legend-row__key">
                <span className={`legend-swatch legend-swatch--${variant}`} style={{ background: color }} />
                <div className="legend-row__label">{label}</div>
            </div>
            <div className="legend-row__detail">{detail}</div>
        </div>
    );
}

function createOrigin(offsetFromBottom: number) {
    return (_width: number, height: number) => [0, height - offsetFromBottom] as [number, number];
}

function getInitialExtents(data: DemoDatum[], visibleCount = 160): [Date, Date] {
    const endIndex = data.length - 1;
    const startIndex = Math.max(0, data.length - Math.min(visibleCount, data.length));
    return [data[startIndex].date as Date, data[endIndex].date as Date];
}

function normalizeBrushExtents(start: BrushPoint, end: BrushPoint): [Date, Date] {
    const startDate = new Date(start.xValue);
    const endDate = new Date(end.xValue);
    return startDate.valueOf() <= endDate.valueOf()
        ? [startDate, endDate]
        : [endDate, startDate];
}

const FullDemoContent = () => {
    const { language, setLanguage, t } = useDemoI18n();
    const offlineData = useMemo(() => getOfflineDemoData(), []);
    const [sourceMode, setSourceMode] = useState<DemoSourceMode>("local");
    const [loadState, setLoadState] = useState<DemoLoadState>("local");
    const [rawData, setRawData] = useState<DemoDatum[]>(() => offlineData);
    const [xExtents, setXExtents] = useState<[Date, Date]>(() => getInitialExtents(offlineData));
    const [resetToken, setResetToken] = useState(0);
    const chartSurfaceRef = useRef<HTMLDivElement | null>(null);
    const [chartWidth, setChartWidth] = useState(0);
    const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);

    useEffect(() => {
        const node = chartSurfaceRef.current;
        if (!node) return;

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
                if (cancelled) return;
                setRawData(nextData);
                setLoadState("live");
            })
            .catch((error: unknown) => {
                if (cancelled) return;
                if ((error as { name?: string }).name === "AbortError") return;
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
        return <div style={{ color: "#f87171", padding: 20 }}>{t("live.error")}</div>;
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

    const handleBrush = ({ start, end }: BrushSelection) => {
        setXExtents(normalizeBrushExtents(start, end));
        setResetToken(token => token + 1);
    };

    const handleResetView = () => {
        setXExtents(getInitialExtents(chartData));
        setResetToken(token => token + 1);
    };

    return (
        <DemoPageShell className="demo-page--classic" frameClassName="demo-frame--classic">
                <section className="demo-hero">
                    <div className="demo-hero__content">
                        <div className="demo-eyebrow">{t("full.eyebrow")}</div>
                        <h1 className="demo-title">{t("full.title")}</h1>
                        <p className="demo-subtitle">{t("full.subtitle")}</p>
                        <div className="demo-badges">
                            {[
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
                            ].map((badge) => <span key={badge} className="demo-badge">{badge}</span>)}
                        </div>
                        <div className="source-switch" role="group" aria-label={t("language.label")}>
                            <button type="button" className="source-switch__button" aria-pressed={language === "vi"} onClick={() => setLanguage("vi")}>
                                {t("language.vi")}
                            </button>
                            <button type="button" className="source-switch__button" aria-pressed={language === "en"} onClick={() => setLanguage("en")}>
                                {t("language.en")}
                            </button>
                        </div>
                    </div>

                    <aside className="demo-summary-card" aria-live="polite">
                        <div className="demo-summary-card__header">
                            <span className={`source-chip source-chip--${sourceTone}`}>{sourceStatusLabel}</span>
                            <span className="demo-summary-card__meta">{t("full.summaryMeta")}</span>
                        </div>
                        <div className="demo-summary-grid">
                            <MetricTile
                                label={t("full.metric.close")}
                                value={priceFormat(latest.close)}
                                detail={`${formatSigned(priceChange, priceFormat)} (${formatSigned(priceChangePercent, percentFormat)})`}
                                tone={priceChange >= 0 ? "positive" : "negative"}
                            />
                            <MetricTile
                                label={t("full.metric.volume")}
                                value={volumeFormat(latest.volume)}
                                detail={t("full.metric.volumeDetail")}
                                tone="accent"
                            />
                            <MetricTile
                                label={t("full.metric.rsi")}
                                value={rsiValue != null ? priceFormat(rsiValue) : t("common.na")}
                                detail={rsiValue != null ? (rsiValue > 70 ? t("full.metric.rsi.overbought") : rsiValue < 30 ? t("full.metric.rsi.oversold") : t("full.metric.rsi.neutral")) : t("common.na")}
                                tone={rsiValue != null && rsiValue >= 70 ? "negative" : rsiValue != null && rsiValue <= 30 ? "positive" : "neutral"}
                            />
                            <MetricTile
                                label={t("full.metric.ema")}
                                value={emaTrendUp ? t("full.metric.ema.uptrend") : t("full.metric.ema.downtrend")}
                                detail={latest.ema20 != null && latest.ema50 != null ? t("full.metric.ema.diff", { value: formatSigned(latest.ema20 - latest.ema50, priceFormat) }) : t("common.na")}
                                tone={emaTrendUp ? "positive" : "negative"}
                            />
                        </div>
                    </aside>
                </section>
                <section className="demo-grid">
                    <article className="demo-chart-card">
                        <header className="demo-chart-card__header">
                            <div>
                                <h2 className="demo-chart-card__title">{t("full.chartTitle")}</h2>
                                <p className="demo-chart-card__meta">{t("full.chartMeta")}</p>
                            </div>
                            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                <div className="source-switch" role="group" aria-label={t("full.sourceSwitcher")}>
                                    <button type="button" className="source-switch__button" aria-pressed={sourceMode === "local"} onClick={() => setSourceMode("local")}>
                                        {t("full.sourceSwitcher.local")}
                                    </button>
                                    <button type="button" className="source-switch__button" aria-pressed={sourceMode === "live"} onClick={() => setSourceMode("live")}>
                                        {t("full.sourceSwitcher.live")}
                                    </button>
                                </div>
                                <div className="source-switch" role="group" aria-label={t("language.label")}>
                                    <button type="button" className="source-switch__button" aria-pressed={language === "vi"} onClick={() => setLanguage("vi")}>
                                        {t("language.vi")}
                                    </button>
                                    <button type="button" className="source-switch__button" aria-pressed={language === "en"} onClick={() => setLanguage("en")}>
                                        {t("language.en")}
                                    </button>
                                </div>
                            </div>
                        </header>

                        <div className="chart-shell">
                            <div className="chart-surface" ref={chartSurfaceRef}>
                                {resolvedChartWidth > 0 ? (
                                    <ChartCanvas
                                        height={chartHeight}
                                        width={resolvedChartWidth}
                                        margin={margin}
                                        type="hybrid"
                                        seriesName={`BTCUSD-${sourceMode}-${resetToken}`}
                                        data={chartData}
                                        xScale={scaleTime()}
                                        xAccessor={(datum: DemoDatum) => datum.date}
                                        displayXAccessor={(datum: DemoDatum) => datum.date}
                                        xExtents={xExtents}
                                        ratio={window.devicePixelRatio || 1}
                                        mouseMoveEvent
                                        panEvent
                                        zoomEvent
                                        useCrossHairStyleCursor
                                    >
                                        <Chart id={1} height={priceHeight} yExtents={[(datum: DemoDatum) => [datum.high, datum.low], (datum: DemoDatum) => datum.ema20, (datum: DemoDatum) => datum.ema50, (datum: DemoDatum) => datum.bollingerBand]} padding={{ top: 12, bottom: 18 }}>
                                            <XAxis axisAt="bottom" orient="bottom" {...topXAxisTheme} />
                                            <YAxis axisAt="right" orient="right" ticks={6} {...priceYAxisTheme} tickFormat={priceFormat} />
                                            <BollingerSeries yAccessor={(datum: DemoDatum) => datum.bollingerBand} stroke={bollingerAppearance.stroke} fill={bollingerAppearance.fill} />
                                            <CandlestickSeries
                                                    fill={(datum) => (datum.close >= datum.open ? bullishColor : bearishColor)}
                                                    stroke="rgba(15, 23, 42, 0.9)"
                                                    wickStroke="rgba(226, 232, 240, 0.78)"
                                                />
                                            <LineSeries yAccessor={(datum: DemoDatum) => datum.ema20} stroke={ema20Stroke} />
                                            <LineSeries yAccessor={(datum: DemoDatum) => datum.ema50} stroke={ema50Stroke} />
                                            <CurrentCoordinate yAccessor={(datum: DemoDatum) => datum.ema20} fill={ema20Stroke} />
                                            <CurrentCoordinate yAccessor={(datum: DemoDatum) => datum.ema50} fill={ema50Stroke} />
                                            <EdgeIndicator
                                                itemType="last"
                                                orient="right"
                                                edgeAt="right"
                                                yAccessor={(datum: DemoDatum) => datum.close}
                                                fill={(datum: DemoDatum) => (datum.close >= datum.open ? "#065f46" : "#991b1b")}
                                                lineStroke={(datum: DemoDatum) => (datum.close >= datum.open ? "#14532d" : "#7f1d1d")}
                                                textFill="#f8fafc"
                                            />
                                            <OHLCTooltip origin={[12, 12]} displayTexts={tooltipDisplayTexts} xDisplayFormat={dateFormat} volumeFormat={volumeFormat} textFill="#f8fafc" labelFill="#cbd5e1" />
                                            <BollingerBandTooltip origin={[12, 56]} yAccessor={(datum: DemoDatum) => datum.bollingerBand} options={BOLLINGER_BAND_OPTIONS} displayFormat={priceFormat} textFill="#f8fafc" labelFill="#cbd5e1" />
                                            <MouseCoordinateY {...coordinateTheme} at="right" orient="right" displayFormat={priceFormat} />
                                            <ZoomButtons
                                                onReset={handleResetView}
                                                size={[28, 24]}
                                                heightFromBase={48}
                                                fill="rgba(15, 23, 42, 0.88)"
                                                fillOpacity={1}
                                                stroke="rgba(148, 163, 184, 0.28)"
                                                strokeWidth={1}
                                                textFill="#e2e8f0"
                                                textStrokeWidth={0}
                                            />
                                        </Chart>

                                        <Chart id={2} height={volumeHeight} origin={volumeOrigin} yExtents={(datum: DemoDatum) => datum.volume} padding={{ top: 8, bottom: 8 }}>
                                            <YAxis axisAt="left" orient="left" {...volumeYAxisTheme} />
                                            <BarSeries yAccessor={(datum: DemoDatum) => datum.volume} fill={(datum: DemoDatum) => (datum.close >= datum.open ? bullishColor : bearishColor)} />
                                            <MouseCoordinateY {...coordinateTheme} at="left" orient="left" displayFormat={volumeFormat} />
                                        </Chart>

                                        <Chart id={3} height={rsiPanelHeight} origin={rsiOrigin} yExtents={[0, 100]} padding={{ top: 10, bottom: 10 }}>
                                            <XAxis axisAt="bottom" orient="bottom" {...topXAxisTheme} />
                                            <YAxis axisAt="right" orient="right" tickValues={[30, 50, 70]} {...axisTheme} tickFormat={integerFormat} />
                                            <RSISeries yAccessor={(datum: DemoDatum) => datum.rsi} stroke={rsiAppearance.stroke} opacity={rsiAppearance.opacity} strokeDasharray={rsiAppearance.strokeDasharray} strokeWidth={rsiAppearance.strokeWidth} overSold={70} middle={50} overBought={30} />
                                            <RSITooltip origin={[12, 12]} yAccessor={(datum: DemoDatum) => datum.rsi} options={{ windowSize: 14 }} textFill="#f8fafc" labelFill="#cbd5e1" />
                                            <MouseCoordinateY {...coordinateTheme} at="right" orient="right" displayFormat={priceFormat} />
                                        </Chart>

                                        <Chart id={4} height={macdHeight} origin={macdOrigin} yExtents={(datum: DemoDatum) => datum.macd} padding={{ top: 10, bottom: 10 }}>
                                            <XAxis axisAt="bottom" orient="bottom" {...bottomXAxisTheme} />
                                            <YAxis axisAt="right" orient="right" ticks={2} {...axisTheme} tickFormat={priceFormat} />
                                            <MACDSeries yAccessor={(datum: DemoDatum) => datum.macd} stroke={macdAppearance.stroke} fill={macdAppearance.fill} />
                                            <MACDTooltip origin={[12, 12]} yAccessor={(datum: DemoDatum) => datum.macd} options={{ fast: 12, slow: 26, signal: 9 }} appearance={macdAppearance} labelFill="#cbd5e1" />
                                            <MouseCoordinateX {...coordinateTheme} at="bottom" orient="bottom" displayFormat={dateFormat} />
                                            <MouseCoordinateY {...coordinateTheme} at="right" orient="right" displayFormat={priceFormat} />
                                        </Chart>

                                        <Chart id={5} height={overviewHeight} origin={overviewOrigin} yExtents={(datum: DemoDatum) => datum.close} padding={{ top: 6, bottom: 6 }}>
                                            <LineSeries yAccessor={(datum: DemoDatum) => datum.close} stroke="#67e8f9" />
                                            <Brush
                                                enabled={true}
                                                type="2D"
                                                onStart={() => {}}
                                                onBrush={handleBrush}
                                                stroke="#22d3ee"
                                                fill="rgba(34, 211, 238, 0.20)"
                                                strokeOpacity={1}
                                                fillOpacity={0.2}
                                                strokeDashArray="ShortDash"
                                            />
                                        </Chart>

                                        <CrossHairCursor stroke="#e2e8f0" opacity={0.16} strokeDasharray="ShortDash" />
                                    </ChartCanvas>
                                ) : (
                                    <div className="chart-placeholder">{t("common.chartInitializing")}</div>
                                )}
                            </div>
                        </div>
                    </article>

                    <aside className="demo-side">
                        <section className="demo-panel">
                            <h2>{t("full.interactionGuide")}</h2>
                            <div className="feature-list">
                                <div className="feature-item"><span className="feature-dot" /><p>{t("full.guide.zoom")}</p></div>
                                <div className="feature-item"><span className="feature-dot" /><p>{t("full.guide.hover")}</p></div>
                                <div className="feature-item"><span className="feature-dot" /><p>{t("full.guide.source")}</p></div>
                                <div className="feature-item"><span className="feature-dot" /><p>{t("full.guide.brush")}</p></div>
                                <div className="feature-item"><span className="feature-dot" /><p>{t("full.guide.fallback")}</p></div>
                            </div>
                        </section>

                        <section className="demo-panel">
                            <h2>{t("full.legendTitle")}</h2>
                            <div className="legend-list">
                                <LegendRow color={bullishColor} label={t("full.badge.candlestick")} detail={t("full.legend.candlestick.detail")} variant="block" />
                                <LegendRow color="#38bdf8" label={t("full.badge.bollinger")} detail={t("full.legend.bollinger.detail")} />
                                <LegendRow color="#38bdf8" label="EMA 20" detail={t("full.legend.ema20.detail")} />
                                <LegendRow color={ema50Stroke} label="EMA 50" detail={t("full.legend.ema50.detail")} />
                                <LegendRow color="#60a5fa" label={t("full.badge.rsi")} detail={t("full.legend.rsi.detail")} />
                                <LegendRow color="#f59e0b" label={t("full.badge.macd")} detail={t("full.legend.macd.detail")} />
                                <LegendRow color="#22d3ee" label={t("full.badge.brush")} detail={t("full.legend.brush.detail")} />
                            </div>
                        </section>

                        <section className="demo-panel">
                            <h2>{t("full.dataNotes")}</h2>
                            <p className="demo-note">
                                {t("full.dataNotesBody")}
                            </p>
                        </section>
                    </aside>
                </section>
        </DemoPageShell>
    );
};

export default function FullDemo() {
    return (
        <DemoI18nBoundary>
            <FullDemoContent />
        </DemoI18nBoundary>
    );
}
