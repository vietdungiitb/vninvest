import React, { useEffect, useRef, useMemo, useState } from 'react';
import { createChart, ColorType, AreaSeries, LineSeries } from 'lightweight-charts';
import { useI18n } from '../context/LangContext';
import { toCanonicalMinute } from '../utils/whaleTimeAdapter';

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

/**
 * CompactDarkMoneyFlow Component
 * 
 * Minimalist institutional flow visualization using Lightweight Charts.
 * Displays CVD (Area) and Institutional Strength (Line) in a compact 240px pane.
 * 
 * @param {string} symbol - Stock ticker
 * @param {object} flowData - Normalized flow data from parent SSOT
 * @param {number} height - Fixed height for the chart
 */
export default function CompactDarkMoneyFlow({ 
  symbol, 
  flowData, 
  height = 240,
  syncTimestamp,
  onSyncHover 
}) {
  const { t } = useI18n();
  const [chartError, setChartError] = useState('');
  const chartContainerRef = useRef();
  const chartRef = useRef();
  const cvdSeriesRef = useRef();
  const strengthSeriesRef = useRef();

  // Memoize data transformation to avoid unnecessary chart updates
  const chartData = useMemo(() => {
    if (!flowData) return { cvd: [], strength: [] };

    const cvd = (flowData.cvd_series || []).map((item) => ({
      time: toCanonicalMinute(item.ts ?? item.bucket_ts),
      value: Number(item.cvd ?? item.cumulative_cvd ?? 0),
    })).filter(item => item.time !== null);

    const strength = (flowData.strength_series || []).map((item) => ({
      time: toCanonicalMinute(item.ts ?? item.time ?? item.date),
      value: Number(item.strength || 0),
    })).filter(item => item.time !== null);

    return { cvd, strength };
  }, [flowData]);

  useEffect(() => {
    if (!chartContainerRef.current) return;
    let chart;
    let handleResize;

    try {
      setChartError('');
      chart = createChart(chartContainerRef.current, {
        height,
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: '#94a3b8',
          fontFamily: "'IBM Plex Sans', sans-serif",
          fontSize: 10,
        },
        grid: {
          vertLines: { color: 'rgba(30, 41, 59, 0.2)' },
          horzLines: { color: 'rgba(30, 41, 59, 0.2)' },
        },
        timeScale: {
          borderColor: '#1e293b',
          timeVisible: true,
          secondsVisible: false,
        },
        rightPriceScale: {
          borderColor: '#1e293b',
          scaleMargins: { top: 0.1, bottom: 0.2 },
        },
        crosshair: {
          mode: 0,
          vertLine: { color: '#3dd9eb', width: 1, style: 2, labelBackgroundColor: '#0f172a' },
          horzLine: { color: '#3dd9eb', width: 1, style: 2, labelBackgroundColor: '#0f172a' },
        },
      });

      const cvdSeries = addSeriesCompat(chart, 'addAreaSeries', AreaSeries, {
        lineColor: '#22d3ee',
        topColor: 'rgba(34, 211, 238, 0.3)',
        bottomColor: 'rgba(34, 211, 238, 0.05)',
        lineWidth: 2,
        priceFormat: { type: 'volume' },
        title: t('whaleAnalytics.cvdLabel'),
      });

      const strengthSeries = addSeriesCompat(chart, 'addLineSeries', LineSeries, {
        color: '#fbbf24',
        lineWidth: 2,
        priceScaleId: 'strength',
        title: t('whaleAnalytics.instStrengthShort'),
      });

      chart.priceScale('strength').applyOptions({
        scaleMargins: { top: 0.1, bottom: 0.7 },
        visible: true,
      });

      chart.subscribeCrosshairMove((param) => {
        if (!onSyncHover || !param.time) {
          return;
        }

        const syncedMinute = toCanonicalMinute(param.time);
        if (syncedMinute != null) {
          onSyncHover(syncedMinute);
        }
      });

      chartRef.current = chart;
      cvdSeriesRef.current = cvdSeries;
      strengthSeriesRef.current = strengthSeries;

      handleResize = () => {
        if (chartContainerRef.current) {
          chart.applyOptions({ width: chartContainerRef.current.clientWidth });
        }
      };
      window.addEventListener('resize', handleResize);
      handleResize();
    } catch (error) {
      console.error('[CompactDarkMoneyFlow] Chart init error:', error);
      chartRef.current = null;
      cvdSeriesRef.current = null;
      strengthSeriesRef.current = null;
      setChartError(error?.message || 'Chart initialization failed');
      if (chart) {
        chart.remove();
      }
    }

    return () => {
      if (handleResize) {
        window.removeEventListener('resize', handleResize);
      }
      if (chartRef.current) {
        chartRef.current.remove();
      }
      chartRef.current = null;
      cvdSeriesRef.current = null;
      strengthSeriesRef.current = null;
    };
  }, [height, onSyncHover, t]);

  useEffect(() => {
    if (!chartRef.current || !cvdSeriesRef.current || !strengthSeriesRef.current) return;

    cvdSeriesRef.current.setData(chartData.cvd);
    strengthSeriesRef.current.setData(chartData.strength);

    if (chartData.cvd.length > 0) {
      chartRef.current.timeScale().fitContent();
    }
  }, [chartData]);

  // Handle external sync
  useEffect(() => {
    if (!chartRef.current || !cvdSeriesRef.current || !syncTimestamp) {
      return;
    }

    const matchingPoint = chartData.cvd.find((item) => item.time === syncTimestamp)
      || chartData.strength.find((item) => item.time === syncTimestamp);

    if (!matchingPoint) {
      return;
    }

    chartRef.current.setCrosshairPosition(matchingPoint.value, matchingPoint.time, cvdSeriesRef.current);
  }, [chartData.cvd, chartData.strength, syncTimestamp]);

  return (
    <div className="relative w-full overflow-hidden">
      {chartError ? (
        <div className="flex h-[240px] items-center justify-center rounded-xl border border-rose-500/30 bg-slate-950/80 px-4 text-center text-xs text-rose-200">
          <div>
            <div className="font-semibold">Biểu đồ dòng tiền tạm thời gián đoạn</div>
            <div className="mt-1 text-rose-200/80">{chartError}</div>
          </div>
        </div>
      ) : null}

      {/* Legend / Overlay Header */}
      <div className="absolute top-2 left-3 z-10 flex gap-4 pointer-events-none">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-cyan-400" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('whaleAnalytics.cvdLabel')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('whaleAnalytics.instStrengthShort')}</span>
        </div>
      </div>
      
      <div ref={chartContainerRef} className={chartError ? 'hidden' : 'w-full'} />
    </div>
  );
}
