import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  AreaSeries,
  createSeriesMarkers,
} from 'lightweight-charts';
import { getDarkMoneyHistory } from '../api/client';
import { useI18n } from '../context/LangContext';

// ─── Theme Config ────────────────────────────────────────────────────────────

const CHART_THEME = {
  layout: {
    background: { type: ColorType.Solid, color: 'transparent' },
    textColor: '#94a3b8',
    fontFamily: "'IBM Plex Sans', 'Segoe UI', sans-serif",
    fontSize: 11,
  },
  grid: {
    vertLines: { color: 'rgba(30, 41, 59, 0.5)' },
    horzLines: { color: 'rgba(30, 41, 59, 0.5)' },
  },
  crosshair: {
    mode: 0,
    vertLine: { color: '#3dd9eb', width: 1, style: 2, labelBackgroundColor: '#0f172a' },
    horzLine: { color: '#3dd9eb', width: 1, style: 2, labelBackgroundColor: '#0f172a' },
  },
  timeScale: {
    borderColor: '#1e293b',
    timeVisible: false,
    secondsVisible: false,
  },
  rightPriceScale: {
    borderColor: '#1e293b',
    scaleMargins: { top: 0.1, bottom: 0.1 },
  },
};

const CANDLE_COLORS = {
  upColor: '#22c55e',
  downColor: '#f43f5e',
  borderUpColor: '#16a34a',
  borderDownColor: '#be123c',
  wickUpColor: '#16a34a',
  wickDownColor: '#be123c',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtCompact(v) {
  if (v == null) return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1_000_000_000_000) return `${(n / 1_000_000_000_000).toFixed(1)}T`;
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString(undefined);
}

function parseTime(str) {
  if (!str) return null;
  const parts = str.split('-');
  if (parts.length !== 3) return null;
  return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
}

function addSeriesCompat(chart, legacyMethod, seriesCtor, options) {
  if (!chart) return null;
  if (typeof chart[legacyMethod] === 'function') {
    return chart[legacyMethod](options);
  }
  if (typeof chart.addSeries === 'function') {
    return chart.addSeries(seriesCtor, options);
  }
  throw new Error(`Unsupported chart API: ${legacyMethod}`);
}

function setMarkersCompat(series, markers) {
  if (!series || !markers?.length) return;
  if (typeof series.setMarkers === 'function') {
    series.setMarkers(markers);
    return;
  }
  if (typeof createSeriesMarkers === 'function') {
    createSeriesMarkers(series, markers);
  }
}

// ─── Strategy Interpretation Table ───────────────────────────────────────────

function StrategyInterpretationTable({ strategyTable, t }) {
  if (!strategyTable || !strategyTable.length) return null;

  const ICONS = { allin: '🟢', accumulate: '🟡', distribute: '🔴', standby: '⚪' };
  const BORDERS = {
    allin: 'border-l-emerald-500 bg-emerald-950/20',
    accumulate: 'border-l-amber-400 bg-amber-950/15',
    distribute: 'border-l-rose-500 bg-rose-950/20',
    standby: 'border-l-slate-600 bg-slate-950/30',
  };
  const RISK_COLORS = {
    low: 'text-emerald-400',
    medium: 'text-amber-400',
    high: 'text-rose-400',
    none: 'text-slate-500',
  };

  return (
    <section className="card-section p-4">
      <div className="border-b border-slate-800 pb-3">
        <p className="text-label">{t('darkMoneyChart.strategyTitle')}</p>
        <h3 className="mt-0.5 text-sm font-semibold text-white">{t('darkMoneyChart.strategySubtitle')}</h3>
      </div>
      <div className="mt-3 space-y-2">
        {strategyTable.map((row) => (
          <div
            key={row.id}
            className={`relative rounded-xl border-l-[3px] px-3 py-2.5 text-xs transition-all ${BORDERS[row.id] || BORDERS.standby} ${
              row.is_active
                ? 'ring-1 ring-cyan-500/30 shadow-[0_0_12px_rgba(61,217,235,0.1)]'
                : 'opacity-60'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-base leading-none">{ICONS[row.id] || '⚪'}</span>
              <span className="font-semibold text-slate-200">{row.tactical_meaning}</span>
              {row.is_active && (
                <span className="ml-auto rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-300 tracking-wider uppercase animate-pulse">
                  {t('darkMoneyChart.activeNow')}
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-400">
              <span>{t('darkMoneyChart.risk')}: <span className={`font-semibold ${RISK_COLORS[row.risk_level] || 'text-slate-500'}`}>{row.risk_level}</span></span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── SMFI Gauge Widget ───────────────────────────────────────────────────────

function SmfiGauge({ smfi, smfiComponents, darkFlow, t }) {
  const strengthValue = darkFlow?.strength || darkFlow?.max_strength || 0;
  const smfiColor = smfi >= 0 ? '#22c55e' : '#f43f5e';
  const confidenceDisplay = darkFlow?.confidence || 'low';

  return (
    <section className="card-section p-4">
      <div className="border-b border-slate-800 pb-3">
        <p className="text-label">{t('darkMoneyChart.darkMoneyDetection')}</p>
        <h3 className="mt-0.5 text-sm font-semibold text-white">{t('darkMoneyChart.darkMoneyTitle')}</h3>
      </div>

      {/* Strength Gauge */}
      <div className="mt-4 flex items-center gap-4">
        <div className="relative flex-shrink-0">
          <div className="flex flex-col items-center">
            <span
              className="text-3xl font-bold tracking-tight"
              style={{
                color: '#3dd9eb',
                textShadow: '0 0 20px rgba(61, 217, 235, 0.4)',
              }}
            >
              {strengthValue.toFixed(1)}
            </span>
            <span className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">{t('darkMoneyChart.strength')}</span>
          </div>
        </div>
        <div className="flex-1 space-y-2">
          {/* Strength bar */}
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${Math.min(100, Math.max(4, strengthValue))}%`,
                background: 'linear-gradient(90deg, #22d3ee, #22c55e, #f59e0b)',
              }}
            />
          </div>
          {/* Confidence badge */}
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              confidenceDisplay === 'high' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' :
              confidenceDisplay === 'medium' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
              'bg-slate-800 text-slate-400 border border-slate-700'
            }`}>
              {confidenceDisplay}
            </span>
          </div>
        </div>
      </div>

      {/* SMFI */}
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-400">{t('darkMoneyChart.smfiLabel')}</span>
          <span className="text-lg font-bold" style={{ color: smfiColor }}>
            {smfi >= 0 ? '+' : ''}{smfi.toFixed(1)}
          </span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-slate-800">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(100, Math.max(2, Math.abs(smfi) * 2))}%`,
              marginLeft: smfi < 0 ? `${Math.max(0, 50 - Math.abs(smfi))}%` : '50%',
              background: smfi >= 0
                ? 'linear-gradient(90deg, #064e3b, #22c55e)'
                : 'linear-gradient(270deg, #4c0519, #f43f5e)',
            }}
          />
        </div>
        {smfiComponents && (
          <div className="mt-2 flex justify-between text-[10px] text-slate-500">
            <span>{t('darkMoneyChart.whaleBuyTotal')}: <span className="text-emerald-400">{fmtCompact(smfiComponents.whale_buy_total)}</span></span>
            <span>{t('darkMoneyChart.whaleSellTotal')}: <span className="text-rose-400">{fmtCompact(smfiComponents.whale_sell_total)}</span></span>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Main DarkMoneyMasterChart Component ─────────────────────────────────────

export default function DarkMoneyMasterChart({ symbol }) {
  const { t } = useI18n();

  // State
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('3M');
  const [interval, setInterval] = useState('1D');

  // Refs for chart containers
  const priceChartRef = useRef(null);
  const cvdChartRef = useRef(null);
  const darkFlowChartRef = useRef(null);

  // Refs for chart instances (cleanup)
  const priceChartInstance = useRef(null);
  const cvdChartInstance = useRef(null);
  const darkFlowChartInstance = useRef(null);

  // ─── Fetch Data ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const resp = await getDarkMoneyHistory(symbol, { period, interval });
      setData(resp.data);
    } catch (err) {
      console.error('DarkMoneyHistory fetch error:', err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [symbol, period, interval]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Render Charts ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!data || !data.candles?.length) return;

    // Cleanup previous charts
    const cleanupCharts = () => {
      [priceChartInstance, cvdChartInstance, darkFlowChartInstance].forEach((ref) => {
        if (ref.current) {
          try { ref.current.remove(); } catch (_) {}
          ref.current = null;
        }
      });
    };
    cleanupCharts();

    const candles = data.candles.map((c) => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    // ── PANE 1: Price + Volume + Whale Markers ──────────────────────────
    if (priceChartRef.current) {
      const chart1 = createChart(priceChartRef.current, {
        ...CHART_THEME,
        width: priceChartRef.current.clientWidth,
        height: 350,
        timeScale: { ...CHART_THEME.timeScale, visible: false },
      });
      priceChartInstance.current = chart1;

      // Candlestick
      const candleSeries = addSeriesCompat(chart1, 'addCandlestickSeries', CandlestickSeries, CANDLE_COLORS);
      candleSeries.setData(candles);

      // Volume overlay
      const volumeSeries = addSeriesCompat(chart1, 'addHistogramSeries', HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      });
      chart1.priceScale('volume').applyOptions({
        scaleMargins: { top: 0.85, bottom: 0 },
      });
      volumeSeries.setData(
        data.candles.map((c) => ({
          time: c.time,
          value: c.volume,
          color: c.close >= c.open ? 'rgba(34, 197, 94, 0.2)' : 'rgba(244, 63, 94, 0.2)',
        })),
      );

      // MA20
      if (data.moving_averages?.ma20?.length) {
        const ma20Series = addSeriesCompat(chart1, 'addLineSeries', LineSeries, {
          color: '#22d3ee',
          lineWidth: 1,
          lineStyle: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        ma20Series.setData(data.moving_averages.ma20);
      }

      // MA50
      if (data.moving_averages?.ma50?.length) {
        const ma50Series = addSeriesCompat(chart1, 'addLineSeries', LineSeries, {
          color: '#f59e0b',
          lineWidth: 1,
          lineStyle: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        ma50Series.setData(data.moving_averages.ma50);
      }

      // Whale Markers
      if (data.whale_signals?.length) {
        const markers = data.whale_signals
          .filter((ws) => candles.some((c) => c.time === ws.time))
          .map((ws) => ({
            time: ws.time,
            position: ws.type === 'buy' ? 'belowBar' : 'aboveBar',
            color: ws.type === 'buy' ? '#22c55e' : '#f43f5e',
            shape: ws.type === 'buy' ? 'arrowUp' : 'arrowDown',
            text: ws.type === 'buy' ? `🦈 BUY ${fmtCompact(ws.matched_value)}` : `🦈 SELL ${fmtCompact(ws.matched_value)}`,
            size: ws.severity === 'extreme' ? 3 : ws.severity === 'high' ? 2 : 1,
          }))
          .sort((a, b) => (a.time > b.time ? 1 : -1));

        if (markers.length) {
          setMarkersCompat(candleSeries, markers);
        }
      }

      // Absorption zone annotations (semi-transparent rectangles)
      if (data.absorption_zones?.length) {
        data.absorption_zones.forEach((zone) => {
          if (!zone.time || !zone.price) return;
          const match = candles.find((c) => c.time === zone.time);
          if (!match) return;
          // Add as a marker with special styling
          // LW Charts doesn't support rectangles, so use markers
        });
      }

      chart1.timeScale().fitContent();
    }

    // ── PANE 2: CVD ─────────────────────────────────────────────────────
    if (cvdChartRef.current && data.dark_flow_series?.length) {
      const chart2 = createChart(cvdChartRef.current, {
        ...CHART_THEME,
        width: cvdChartRef.current.clientWidth,
        height: 140,
        timeScale: { ...CHART_THEME.timeScale, visible: false },
        rightPriceScale: {
          ...CHART_THEME.rightPriceScale,
          scaleMargins: { top: 0.1, bottom: 0.1 },
        },
      });
      cvdChartInstance.current = chart2;

      // CVD as area chart
      const cvdData = data.dark_flow_series
        .filter((d) => d.cvd !== undefined && d.cvd !== null)
        .map((d) => ({ time: d.time, value: d.cvd }));

      if (cvdData.length) {
        const cvdSeries = addSeriesCompat(chart2, 'addAreaSeries', AreaSeries, {
          lineColor: '#22d3ee',
          topColor: 'rgba(34, 211, 238, 0.3)',
          bottomColor: 'rgba(244, 63, 94, 0.15)',
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          baseValue: { type: 'price', price: 0 },
        });
        cvdSeries.setData(cvdData);
      }

      chart2.timeScale().fitContent();
    }

    // ── PANE 3: Dark Flow Strength Histogram ────────────────────────────
    if (darkFlowChartRef.current && data.dark_flow_series?.length) {
      const chart3 = createChart(darkFlowChartRef.current, {
        ...CHART_THEME,
        width: darkFlowChartRef.current.clientWidth,
        height: 140,
        rightPriceScale: {
          ...CHART_THEME.rightPriceScale,
          scaleMargins: { top: 0.05, bottom: 0 },
        },
      });
      darkFlowChartInstance.current = chart3;

      // Histogram bars
      const histData = data.dark_flow_series.map((d) => ({
        time: d.time,
        value: d.strength || 0,
        color: (d.strength || 0) >= 0
          ? `rgba(34, 197, 94, ${Math.min(0.9, 0.3 + (d.strength || 0) / 150)})`
          : `rgba(244, 63, 94, ${Math.min(0.9, 0.3 + Math.abs(d.strength || 0) / 150)})`,
      }));

      const histSeries = addSeriesCompat(chart3, 'addHistogramSeries', HistogramSeries, {
        priceFormat: { type: 'custom', formatter: (v) => v.toFixed(1) },
        priceLineVisible: false,
        lastValueVisible: true,
      });
      histSeries.setData(histData);

      // SMA trend overlay
      if (histData.length >= 5) {
        const smaWindow = Math.min(10, Math.floor(histData.length / 2));
        const smaData = [];
        for (let i = smaWindow - 1; i < histData.length; i++) {
          const windowSlice = histData.slice(i - smaWindow + 1, i + 1);
          const avg = windowSlice.reduce((s, d) => s + d.value, 0) / windowSlice.length;
          smaData.push({ time: histData[i].time, value: avg });
        }
        const smaSeries = addSeriesCompat(chart3, 'addLineSeries', LineSeries, {
          color: '#f59e0b',
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        smaSeries.setData(smaData);
      }

      chart3.timeScale().fitContent();
    }

    // ── Cross-chart Time Sync ───────────────────────────────────────────
    const charts = [priceChartInstance.current, cvdChartInstance.current, darkFlowChartInstance.current].filter(Boolean);
    if (charts.length > 1) {
      let isSyncing = false;
      charts.forEach((source, i) => {
        source.timeScale().subscribeVisibleLogicalRangeChange((range) => {
          if (isSyncing || !range) return;
          isSyncing = true;
          charts.forEach((target, j) => {
            if (i !== j && target) {
              try { target.timeScale().setVisibleLogicalRange(range); } catch (_) {}
            }
          });
          isSyncing = false;
        });
      });
    }

    // ── Resize Observer ─────────────────────────────────────────────────
    const resizeObserver = new ResizeObserver(() => {
      if (priceChartRef.current && priceChartInstance.current) {
        priceChartInstance.current.applyOptions({ width: priceChartRef.current.clientWidth });
      }
      if (cvdChartRef.current && cvdChartInstance.current) {
        cvdChartInstance.current.applyOptions({ width: cvdChartRef.current.clientWidth });
      }
      if (darkFlowChartRef.current && darkFlowChartInstance.current) {
        darkFlowChartInstance.current.applyOptions({ width: darkFlowChartRef.current.clientWidth });
      }
    });

    if (priceChartRef.current) resizeObserver.observe(priceChartRef.current);
    if (cvdChartRef.current) resizeObserver.observe(cvdChartRef.current);
    if (darkFlowChartRef.current) resizeObserver.observe(darkFlowChartRef.current);

    return () => {
      resizeObserver.disconnect();
      cleanupCharts();
    };
  }, [data]);

  // ─── Latest dark flow for SMFI gauge ─────────────────────────────────────
  const latestDarkFlow = data?.dark_flow_series?.length
    ? data.dark_flow_series[data.dark_flow_series.length - 1]
    : null;

  // ─── Render ──────────────────────────────────────────────────────────────
  const PERIODS = ['1M', '3M', '6M', '1Y'];
  const INTERVALS = ['1D', '1W'];

  return (
    <div className="space-y-4">
      {/* Master Chart Card */}
      <section className="card-section overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
          <div>
            <p className="text-label">{t('darkMoneyChart.chartLabel')}</p>
            <h2 className="mt-0.5 text-sm font-semibold text-white">
              {t('darkMoneyChart.chartTitle', { symbol })}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {/* Period Selector */}
            <div className="flex rounded-lg border border-slate-700 overflow-hidden text-[10px]">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`px-2.5 py-1 transition-colors ${
                    period === p
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            {/* Interval Toggle */}
            <div className="flex rounded-lg border border-slate-700 overflow-hidden text-[10px]">
              {INTERVALS.map((iv) => (
                <button
                  key={iv}
                  type="button"
                  onClick={() => setInterval(iv)}
                  className={`px-2.5 py-1 transition-colors ${
                    interval === iv
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  {iv === '1D' ? t('darkMoneyChart.daily') : t('darkMoneyChart.weekly')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-1 p-4">
            <div className="h-[350px] animate-pulse rounded-xl bg-slate-900" />
            <div className="h-[140px] animate-pulse rounded-xl bg-slate-900" />
            <div className="h-[140px] animate-pulse rounded-xl bg-slate-900" />
          </div>
        ) : !data?.candles?.length ? (
          <div className="flex h-[500px] items-center justify-center text-sm text-slate-500">
            {t('darkMoneyChart.noData')}
          </div>
        ) : (
          <div className="p-2">
            {/* Pane 1: Price + Whale Markers */}
            <div className="relative">
              <div className="absolute left-3 top-2 z-10 flex items-center gap-2 text-[10px]">
                <span className="flex items-center gap-1">
                  <span className="h-0.5 w-3 bg-cyan-400 inline-block" style={{ borderTop: '1px dashed #22d3ee' }} />
                  <span className="text-cyan-400">MA20</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-0.5 w-3 bg-amber-400 inline-block" style={{ borderTop: '1px dashed #f59e0b' }} />
                  <span className="text-amber-400">MA50</span>
                </span>
                <span className="flex items-center gap-1 text-emerald-400">▲ {t('darkMoneyChart.whaleBuy')}</span>
                <span className="flex items-center gap-1 text-rose-400">▼ {t('darkMoneyChart.whaleSell')}</span>
              </div>
              <div ref={priceChartRef} className="lw-chart-container" />
            </div>

            {/* Pane 2: CVD */}
            <div className="relative mt-1">
              <div className="absolute left-3 top-1 z-10 text-[10px] text-slate-400">
                {t('darkMoneyChart.cvdLabel')}
              </div>
              <div ref={cvdChartRef} className="lw-chart-container" />
            </div>

            {/* Pane 3: Dark Flow Strength */}
            <div className="relative mt-1">
              <div className="absolute left-3 top-1 z-10 flex items-center gap-2 text-[10px]">
                <span className="text-slate-400">{t('darkMoneyChart.darkFlowStrength')}</span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-sm bg-emerald-500 inline-block" />
                  <span className="text-emerald-400">{t('darkMoneyChart.inflow')}</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-sm bg-rose-500 inline-block" />
                  <span className="text-rose-400">{t('darkMoneyChart.outflow')}</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-0.5 w-3 bg-amber-400 inline-block" />
                  <span className="text-amber-400">SMA</span>
                </span>
              </div>
              <div ref={darkFlowChartRef} className="lw-chart-container" />
            </div>
          </div>
        )}
      </section>

      {/* Bottom Row: Strategy Table + SMFI Gauge */}
      {data && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <StrategyInterpretationTable strategyTable={data.strategy_table} t={t} />
          <SmfiGauge
            smfi={data.smart_money_flow_index || 0}
            smfiComponents={data.smfi_components}
            darkFlow={latestDarkFlow}
            t={t}
          />
        </div>
      )}
    </div>
  );
}
