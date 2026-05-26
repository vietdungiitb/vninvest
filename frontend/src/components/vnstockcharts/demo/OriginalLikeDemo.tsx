import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "d3-format";
import { timeFormat } from "d3-time-format";

import ChartCanvas from "../lib/ChartCanvas";
import Chart from "../lib/Chart";
import { Brush } from "../lib/interactive";
import ZoomButtons from "../lib/ZoomButtons";
import BarSeries from "../lib/series/BarSeries";
import AreaSeries from "../lib/series/AreaSeries";
import CandlestickSeries from "../lib/series/CandlestickSeries";
import LineSeries from "../lib/series/LineSeries";
import MACDSeries from "../lib/series/MACDSeries";
import { XAxis, YAxis } from "../lib/axes";
import {
    CrossHairCursor,
    CurrentCoordinate,
    EdgeIndicator,
    MouseCoordinateX,
    MouseCoordinateY,
} from "../lib/coordinates";
import { OHLCTooltip, MovingAverageTooltip, MACDTooltip } from "../lib/tooltip";
import { discontinuousTimeScaleProvider } from "../lib/scale";
import { sma } from "../lib/indicator";
import { enrichData } from "../lib/core/calculators/enrichData";
import { resolveSeriesStructuredValue, resolveSeriesValue } from "../lib/core/seriesValueResolver";
import type { SeriesConfig } from "../lib/core/types/pane-descriptor";
import { last } from "../lib/utils";
import { getOfflineDemoBars, type DemoDatum, type MACDPoint } from "./demoData";
import DemoPageShell from "./DemoPageShell";
import { DemoI18nBoundary, useDemoI18n } from "./i18n";
import "./demo.css";

type BrushPoint = {
    xValue: Date | number;
    yValue: number;
};

type BrushSelection = {
    start: BrushPoint;
    end: BrushPoint;
};

type OriginalLikeDatum = DemoDatum & {
    ema12?: number;
    ema26?: number;
    smaVolume10?: number;
    macd?: MACDPoint;
};

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

const smaVolume10 = (sma() as any)
    .id(3)
    .options({
        windowSize: 10,
        sourcePath: "volume",
    })
    .merge((datum: OriginalLikeDatum, value: number | undefined) => {
        datum.smaVolume10 = value;
    })
    .accessor((datum: OriginalLikeDatum) => datum.smaVolume10);

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

const EMA12_SERIES: SeriesConfig = { type: "EMA", yAxis: "right", params: { period: 12 } };
const EMA26_SERIES: SeriesConfig = { type: "EMA", yAxis: "right", params: { period: 26 } };
const MACD_SERIES: SeriesConfig = { type: "MACD", yAxis: "right", params: { fast: 12, slow: 26, signal: 9 } };

const ema26Accessor = (datum: OriginalLikeDatum) => datum.ema26;
const ema12Accessor = (datum: OriginalLikeDatum) => datum.ema12;
const macdAccessor = (datum: OriginalLikeDatum) => datum.macd;

function createOrigin(offsetFromBottom: number) {
    return (_width: number, height: number) => [0, height - offsetFromBottom] as [number, number];
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
    const chartSurfaceRef = useRef<HTMLDivElement | null>(null);
    const [chartWidth, setChartWidth] = useState(0);
    const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);

    const rawData = useMemo(() => {
        return enrichData(getOfflineDemoBars(), { series: [EMA12_SERIES, EMA26_SERIES, MACD_SERIES] })
            .map((datum) => ({
                ...datum,
                ema12: resolveSeriesValue(datum, EMA12_SERIES),
                ema26: resolveSeriesValue(datum, EMA26_SERIES),
                macd: resolveSeriesStructuredValue(datum, MACD_SERIES) as MACDPoint | undefined,
            })) as OriginalLikeDatum[];
    }, []);

    const calculatedData = useMemo(() => {
        return smaVolume10(rawData) as OriginalLikeDatum[];
    }, [rawData]);

    const xScaleProvider = useMemo(() => {
        return discontinuousTimeScaleProvider.inputDateAccessor((datum: OriginalLikeDatum) => datum.date);
    }, []);

    const { data, xScale, xAccessor, displayXAccessor } = useMemo(() => {
        return xScaleProvider(calculatedData);
    }, [calculatedData, xScaleProvider]);

    const initialXExtents = useMemo<[number, number]>(() => {
        const endIndex = data.length - 1;
        const startIndex = Math.max(0, data.length - 150);
        return [xAccessor(data[startIndex]), xAccessor(last(data))] as [number, number];
    }, [data, xAccessor]);

    const [visibleDomain, setVisibleDomain] = useState<[number, number]>(initialXExtents);
    const [xExtents, setXExtents] = useState<[number, number]>(initialXExtents);
    const [brushEnabled, setBrushEnabled] = useState(false);

    useEffect(() => {
        setXExtents(initialXExtents);
        setVisibleDomain(initialXExtents);
    }, [initialXExtents]);

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

    const handleBrush = ({ start, end }: BrushSelection) => {
        const left = Math.min(start.xValue as number, end.xValue as number);
        const right = Math.max(start.xValue as number, end.xValue as number);
        setBrushEnabled(false);
        setXExtents([left, right]);
    };

    const handleVisibleDomainChange = (domain: [number, number]) => {
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
    const xAxisTickFormat = (tickValue: number) => {
        const tickIndex = Math.max(0, Math.min(data.length - 1, Math.round(tickValue)));
        const tickDatum = data[tickIndex];

        if (!tickDatum) return "";
        if (visibleBars <= 35) return timeFormat("%H:%M:%S")(tickDatum.date);
        if (visibleBars <= 70) return timeFormat("%H:%M")(tickDatum.date);
        if (visibleBars <= 120) return timeFormat("%-I:%M %p")(tickDatum.date);
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

    return (
        <DemoPageShell className="demo-page--classic" frameClassName="demo-frame--classic">
            <section className="demo-chart-card demo-chart-card--classic">
                    <header className="demo-chart-card__header demo-chart-card__header--classic">
                        <div>
                            <h1 className="demo-chart-card__title">{t("original.title")}</h1>
                            <p className="demo-chart-card__meta">
                                {t("original.meta")}
                            </p>
                        </div>
                        <div className="demo-chart-card__chips">
                            <span className="source-chip source-chip--neutral">{t("original.viewRange", { visible: visibleBars, total: data.length })}</span>
                            <span className="source-chip source-chip--accent">X: {visibleDomainLabel}</span>
                            <button
                                className={`source-chip source-chip--btn${language === "vi" ? " source-chip--btn-active" : ""}`}
                                onClick={() => setLanguage("vi")}
                                title={t("language.label")}
                            >
                                {t("language.vi")}
                            </button>
                            <button
                                className={`source-chip source-chip--btn${language === "en" ? " source-chip--btn-active" : ""}`}
                                onClick={() => setLanguage("en")}
                                title={t("language.label")}
                            >
                                {t("language.en")}
                            </button>
                            <button
                                className={`source-chip source-chip--btn${brushEnabled ? " source-chip--btn-active" : ""}`}
                                onClick={() => setBrushEnabled(v => !v)}
                                title={brushEnabled ? t("original.brushOnTitle") : t("original.brushOffTitle")}
                            >
                                {brushEnabled ? t("original.brushOn") : t("original.brushOff")}
                            </button>
                        </div>
                    </header>

                    <div className="chart-shell chart-shell--classic">
                        <div className="chart-surface chart-surface--classic" ref={chartSurfaceRef}>
                            {resolvedChartWidth > 0 ? (
                                <ChartCanvas
                                    height={chartHeight}
                                    width={resolvedChartWidth}
                                    ratio={window.devicePixelRatio || 1}
                                    margin={margin}
                                    type="hybrid"
                                    seriesName="BTCUSD-brush-demo"
                                    data={data}
                                    xScale={xScale}
                                    xAccessor={xAccessor}
                                    displayXAccessor={displayXAccessor}
                                    xExtents={xExtents}
                                    mouseMoveEvent
                                    panEvent
                                    zoomEvent
                                    useCrossHairStyleCursor
                                    clamp={true}
                                    onVisibleDomainChange={handleVisibleDomainChange}

                                >
                                    <Chart
                                        id={1}
                                        height={priceHeight}
                                        yExtents={[(datum: OriginalLikeDatum) => [datum.high, datum.low], ema26Accessor, ema12Accessor]}
                                        padding={{ top: 10, bottom: 20 }}
                                    >
                                        <XAxis
                                            axisAt="bottom"
                                            orient="bottom"
                                            showTicks={isZoomedIn}
                                            outerTickSize={isZoomedIn ? 5 : 0}
                                            ticks={isZoomedIn ? 8 : 6}
                                            tickFormat={xAxisTickFormat}
                                        />
                                        <YAxis axisAt="right" orient="right" ticks={priceYAxisTicks} {...priceYAxisTheme} />
                                        <MouseCoordinateY {...coordinateTheme} at="right" orient="right" displayFormat={priceYAxisTickFormat} />
                                        <CandlestickSeries />
                                        <LineSeries yAccessor={ema26Accessor} stroke={ema26Stroke} />
                                        <LineSeries yAccessor={ema12Accessor} stroke={ema12Stroke} />
                                        <CurrentCoordinate yAccessor={ema26Accessor} fill={ema26Stroke} />
                                        <CurrentCoordinate yAccessor={ema12Accessor} fill={ema12Stroke} />
                                        <EdgeIndicator
                                            itemType="last"
                                            orient="right"
                                            edgeAt="right"
                                            yAccessor={(datum: OriginalLikeDatum) => datum.close}
                                            fill={(datum: OriginalLikeDatum) => (datum.close > datum.open ? "#6BA583" : "#FF0000")}
                                        />
                                        <OHLCTooltip origin={[-40, 0]} displayTexts={tooltipDisplayTexts} xDisplayFormat={tooltipDateFormat} volumeFormat={volumeFormat} />
                                        <MovingAverageTooltip
                                            origin={[-38, 15]}
                                            displayFormat={priceFormat}
                                            options={[
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
                                            ]}
                                        />
                                        <Brush
                                            enabled={brushEnabled}
                                            type={BRUSH_TYPE}
                                            stroke="#22d3ee"
                                            fill="#22d3ee"
                                            fillOpacity={0.18}
                                            strokeOpacity={0.95}
                                            onStart={() => {}}
                                            onBrush={handleBrush}
                                        />
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

                                    <Chart id={2} height={volumeHeight} origin={volumeOrigin} yExtents={[(datum: OriginalLikeDatum) => datum.volume, smaVolume10.accessor()] }>
                                        <YAxis axisAt="left" orient="left" {...volumeYAxisTheme} />
                                        <MouseCoordinateY {...coordinateTheme} at="left" orient="left" displayFormat={volumeMouseFormat} />
                                        <BarSeries yAccessor={(datum: OriginalLikeDatum) => datum.volume} fill={(datum: OriginalLikeDatum) => (datum.close > datum.open ? "#6BA583" : "#FF0000")} />
                                        <AreaSeries yAccessor={smaVolume10.accessor()} stroke={smaVolume10.stroke()} fill={smaVolume10.fill()} />
                                    </Chart>

                                    <Chart
                                        id={3}
                                        height={macdHeight}
                                        origin={macdOrigin}
                                        yExtents={macdAccessor}
                                        padding={{ top: 10, bottom: 10 }}
                                    >
                                        <XAxis
                                            axisAt="bottom"
                                            orient="bottom"
                                            showTicks={isZoomedIn}
                                            outerTickSize={isZoomedIn ? 5 : 0}
                                            ticks={isZoomedIn ? 10 : 6}
                                            tickFormat={xAxisTickFormat}
                                        />
                                        <YAxis axisAt="right" orient="right" {...macdYAxisTheme} />
                                        <MouseCoordinateX at="bottom" orient="bottom" displayFormat={macdDateFormat} />
                                        <MouseCoordinateY {...coordinateTheme} at="right" orient="right" displayFormat={macdYAxisTickFormat} />
                                        <Brush
                                            enabled={brushEnabled}
                                            type={BRUSH_TYPE}
                                            stroke="#22d3ee"
                                            fill="#22d3ee"
                                            fillOpacity={0.18}
                                            strokeOpacity={0.95}
                                            onStart={() => {}}
                                            onBrush={handleBrush}
                                        />
                                        <MACDSeries yAccessor={macdAccessor} stroke={macdAppearance.stroke} fill={macdAppearance.fill} />
                                        <MACDTooltip
                                            origin={[-38, 15]}
                                            yAccessor={macdAccessor}
                                            options={{ fast: 12, slow: 26, signal: 9 }}
                                            appearance={macdAppearance}
                                        />
                                    </Chart>

                                    <CrossHairCursor stroke="#e2e8f0" opacity={0.16} strokeDasharray="ShortDash" />
                                </ChartCanvas>
                            ) : (
                                <div className="chart-placeholder">{t("common.chartInitializing")}</div>
                            )}
                        </div>
                    </div>
                </section>
        </DemoPageShell>
    );
};

export default function OriginalLikeDemo() {
    return (
        <DemoI18nBoundary>
            <OriginalLikeDemoContent />
        </DemoI18nBoundary>
    );
}
