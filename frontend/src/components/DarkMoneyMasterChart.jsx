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

const PERIODS = ['1M', '3M', '6M', '1Y', '10Y'];
const PERIOD_EXPANSION_ORDER = ['1M', '3M', '6M', '1Y', '10Y'];
// 1h cần backend intraday support — xem views_dark_money_history.py
const INTERVALS = ['1D', '1W'];
const INTRADAY_INTERVALS = ['1h', '30m', '15m'];
const MIN_VISIBLE_BARS = 30;
const MAX_VISIBLE_BARS = 5000;
const PRICE_PANE_HEIGHT = 350;
const SECONDARY_PANE_HEIGHT = 112;

function computeZoomBarSpacingLimits(width, candleCount) {
  const safeWidth = Math.max(320, Number(width) || 320);
  const safeCount = Math.max(1, Number(candleCount) || 1);
  const minBars = Math.max(1, Math.min(MIN_VISIBLE_BARS, safeCount));
  const maxBars = Math.max(minBars, Math.min(MAX_VISIBLE_BARS, safeCount));
  return {
    minBarSpacing: Math.max(0.05, safeWidth / maxBars),
    maxBarSpacing: safeWidth / minBars,
  };
}

function getNextExpandedPeriod(currentPeriod) {
  const currentIndex = PERIOD_EXPANSION_ORDER.indexOf(String(currentPeriod || '').toUpperCase());
  if (currentIndex < 0 || currentIndex >= PERIOD_EXPANSION_ORDER.length - 1) return null;
  return PERIOD_EXPANSION_ORDER[currentIndex + 1];
}

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

function fmtPrice(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return Number(v).toLocaleString('vi-VN');
}

function fmtVolume(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('vi-VN');
}

function fmtDate(timeStr) {
  if (!timeStr && timeStr !== 0) return '';
  if (typeof timeStr === 'number' || /^\d+$/.test(String(timeStr))) {
    const d = new Date(Number(timeStr) * 1000);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  const parts = String(timeStr).split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return String(timeStr);
}

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseTime(str) {
  if (!str) return null;
  const parts = str.split('-');
  if (parts.length !== 3) return null;
  return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
}

function normalizeChartTimeKey(time) {
  if (time && typeof time === 'object' && time.year != null) {
    return `${time.year}-${String(time.month).padStart(2, '0')}-${String(time.day).padStart(2, '0')}`;
  }
  return String(time);
}

function toEpochSecondsFromChartTimeKey(timeKey) {
  if (!timeKey) return null;
  if (/^\d+$/.test(String(timeKey))) {
    const n = Number(timeKey);
    return Number.isFinite(n) ? n : null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(timeKey))) {
    const d = new Date(`${timeKey}T00:00:00Z`);
    const t = Math.floor(d.getTime() / 1000);
    return Number.isFinite(t) ? t : null;
  }
  // Support ISO-like timestamps from whale signals, e.g. 2026-04-16T14:19:34+07:00
  const parsed = Date.parse(String(timeKey));
  if (Number.isFinite(parsed)) {
    const t = Math.floor(parsed / 1000);
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

function normalizeSignalTimeKey(time) {
  if (time == null) return '';
  const raw = String(time);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed)) {
    const d = new Date(parsed);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }
  return raw;
}

function getWhaleMatchWindowSeconds(interval) {
  const iv = String(interval || '').toLowerCase();
  if (iv === '1w') return 8 * 24 * 3600;
  if (iv === '1d') return 36 * 3600;
  if (iv === '1h') return 2 * 3600;
  if (iv === '30m') return 60 * 60;
  if (iv === '15m') return 30 * 60;
  return 36 * 3600;
}

function sortTimeKeysAsc(left, right) {
  const leftEpoch = toEpochSecondsFromChartTimeKey(left);
  const rightEpoch = toEpochSecondsFromChartTimeKey(right);
  if (leftEpoch != null && rightEpoch != null) return leftEpoch - rightEpoch;
  return String(left).localeCompare(String(right));
}

function normalizeCandlesForChart(rawCandles) {
  if (!Array.isArray(rawCandles) || !rawCandles.length) return [];

  const dedupedByTime = new Map();
  rawCandles.forEach((candle) => {
    const time = String(candle?.time || '');
    if (!time) return;
    dedupedByTime.set(time, {
      time,
      open: toFiniteNumber(candle?.open),
      high: toFiniteNumber(candle?.high),
      low: toFiniteNumber(candle?.low),
      close: toFiniteNumber(candle?.close),
      volume: toFiniteNumber(candle?.volume),
    });
  });

  return [...dedupedByTime.values()].sort((left, right) => sortTimeKeysAsc(left.time, right.time));
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
  if (!series || !Array.isArray(markers)) return;
  if (typeof series.setMarkers === 'function') {
    series.setMarkers(markers);
    return;
  }
  if (typeof createSeriesMarkers === 'function') {
    createSeriesMarkers(series, markers);
  }
}

function buildCompactWhaleMarkers(whaleSignals, candles, showLabels, options = {}) {
  if (!whaleSignals?.length || !candles?.length) return [];

  const {
    topPercent = 0.1,
    visibleRange = null,
    minMarkers = 1,
    chartType = 'candle',
  } = options;

  const candleTimes = new Set(candles.map((c) => c.time));

  const getSignalStrength = (signal) => {
    const matchedValue = Number(signal?.matched_value);
    if (Number.isFinite(matchedValue)) return Math.abs(matchedValue);
    const value = Number(signal?.value);
    if (Number.isFinite(value)) return Math.abs(value);
    return 0;
  };

  const normalizeSignalEpoch = (time) => toEpochSecondsFromChartTimeKey(normalizeChartTimeKey(time));

  const validSignals = whaleSignals
    .filter((signal) => candleTimes.has(signal.time))
    .map((signal, idx) => ({
      ...signal,
      _index: idx,
      _strength: getSignalStrength(signal),
      _epoch: normalizeSignalEpoch(signal.time),
    }));

  let rangeSignals = validSignals;
  if (visibleRange?.from != null && visibleRange?.to != null) {
    const fromEpoch = normalizeSignalEpoch(visibleRange.from);
    const toEpoch = normalizeSignalEpoch(visibleRange.to);
    if (Number.isFinite(fromEpoch) && Number.isFinite(toEpoch)) {
      const minEpoch = Math.min(fromEpoch, toEpoch);
      const maxEpoch = Math.max(fromEpoch, toEpoch);
      rangeSignals = validSignals.filter((signal) => {
        if (!Number.isFinite(signal._epoch)) return false;
        return signal._epoch >= minEpoch && signal._epoch <= maxEpoch;
      });
    }
  }

  if (!rangeSignals.length) return [];

  const targetCount = Math.max(minMarkers, Math.ceil(rangeSignals.length * topPercent));

  const selectedIds = new Set(
    [...rangeSignals]
      .sort((left, right) => {
        if (right._strength !== left._strength) return right._strength - left._strength;
        return String(left.time).localeCompare(String(right.time));
      })
      .slice(0, targetCount)
      .map((signal) => signal._index),
  );

  return rangeSignals
    .filter((signal) => selectedIds.has(signal._index))
    .sort((left, right) => String(left.time).localeCompare(String(right.time)))
    .map((signal) => {
      const signalType = String(signal.type || '').toLowerCase();
      const isBuy = signalType === 'buy';

      return {
        time: signal.time,
        position: chartType === 'line' ? 'inBar' : (isBuy ? 'belowBar' : 'aboveBar'),
        color: isBuy ? 'rgba(163, 230, 53, 0.96)' : 'rgba(251, 113, 133, 0.96)',
        shape: 'circle',
        text: showLabels ? `${isBuy ? 'BUY' : 'SELL'}` : '',
        size: 1,
      };
    });
}

function buildWhaleSignalSummaryByTime(whaleSignals, candles, interval) {
  const summary = {};
  if (!whaleSignals?.length) return summary;

  const candleKeys = (candles || []).map((c) => String(c?.time || '')).filter(Boolean);
  const candleSet = new Set(candleKeys);
  const candleEpochs = candleKeys
    .map((key) => ({ key, epoch: toEpochSecondsFromChartTimeKey(key) }))
    .filter((item) => item.epoch != null)
    .sort((a, b) => a.epoch - b.epoch);
  const windowSeconds = getWhaleMatchWindowSeconds(interval);

  whaleSignals.forEach((signal) => {
    const rawTime = signal?.time;
    const normalizedSignalKey = normalizeSignalTimeKey(rawTime);
    let timeKey = normalizedSignalKey;

    if (timeKey && !candleSet.has(timeKey) && candleEpochs.length) {
      const signalEpoch = toEpochSecondsFromChartTimeKey(rawTime) ?? toEpochSecondsFromChartTimeKey(normalizedSignalKey);
      if (signalEpoch != null) {
        let nearest = null;
        for (let i = 0; i < candleEpochs.length; i += 1) {
          const candidate = candleEpochs[i];
          const distance = Math.abs(candidate.epoch - signalEpoch);
          if (!nearest || distance < nearest.distance) {
            nearest = { key: candidate.key, distance };
          }
        }
        if (nearest && nearest.distance <= windowSeconds) {
          timeKey = nearest.key;
        }
      }
    }

    if (!timeKey) return;
    if (!summary[timeKey]) {
      summary[timeKey] = {
        buyCount: 0,
        sellCount: 0,
        buyValue: 0,
        sellValue: 0,
      };
    }

    const signalType = String(signal?.type || '').toLowerCase();
    const value = Number(signal?.matched_value || 0);
    if (signalType === 'buy') {
      summary[timeKey].buyCount += 1;
      summary[timeKey].buyValue += Number.isFinite(value) ? value : 0;
    } else if (signalType === 'sell') {
      summary[timeKey].sellCount += 1;
      summary[timeKey].sellValue += Number.isFinite(value) ? value : 0;
    }
  });

  return summary;
}

// ─── Quick Signal Bar ────────────────────────────────────────────────────────

const QUICK_SIGNAL_STYLES = {
  allin:      { bar: 'bg-emerald-950/50 border-b border-emerald-900/40', text: 'text-emerald-300', badge: 'bg-emerald-900/40 border border-emerald-700/40 text-emerald-200', icon: '🟢' },
  accumulate: { bar: 'bg-amber-950/50 border-b border-amber-900/40',    text: 'text-amber-300',   badge: 'bg-amber-900/40 border border-amber-700/40 text-amber-200',   icon: '🟡' },
  distribute: { bar: 'bg-rose-950/50 border-b border-rose-900/40',      text: 'text-rose-300',    badge: 'bg-rose-900/40 border border-rose-700/40 text-rose-200',      icon: '🔴' },
  standby:    { bar: 'bg-slate-900/40 border-b border-slate-800/40',    text: 'text-slate-400',   badge: 'bg-slate-800/60 border border-slate-700/40 text-slate-300',   icon: '⚪' },
};

function QuickSignalBar({ strategyTable }) {
  const active = strategyTable?.find((r) => r.is_active);
  if (!active) return null;
  const s = QUICK_SIGNAL_STYLES[active.id] || QUICK_SIGNAL_STYLES.standby;
  return (
    <div className={`flex flex-wrap items-center gap-2 px-4 py-2 text-[11px] ${s.bar}`}>
      <span className="text-base leading-none">{s.icon}</span>
      <span className={`font-semibold ${s.text}`}>{active.tactical_meaning}</span>
      <span className={`ml-auto rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${s.badge}`}>
        Rủi ro: {active.risk_level}
      </span>
    </div>
  );
}

// ─── OHLC Crosshair Tooltip ───────────────────────────────────────────────────
function OhlcTooltip({ data: d, chartType = 'candle' }) {
  if (!d) return null;
  const changeColor = d.change == null ? 'text-slate-400' : d.change >= 0 ? 'text-emerald-400' : 'text-rose-400';
  const whaleInfo = d.whaleInfo || {
    buyCount: 0,
    sellCount: 0,
    buyValue: 0,
    sellValue: 0,
  };
  const isLine = chartType === 'line';
  return (
    <div className="pointer-events-none absolute left-3 top-10 z-20 flex flex-wrap items-center gap-x-4 gap-y-0.5 rounded-lg border border-slate-700/60 bg-slate-950/90 px-3 py-2 text-[11px] backdrop-blur-sm shadow-xl">
      <span className="text-slate-500">{fmtDate(d.time)}</span>
      {!isLine && d.open  != null && <span><span className="text-slate-500">O </span><span className="text-slate-200">{fmtPrice(d.open)}</span></span>}
      {!isLine && d.high  != null && <span><span className="text-slate-500">H </span><span className="text-emerald-300">{fmtPrice(d.high)}</span></span>}
      {!isLine && d.low   != null && <span><span className="text-slate-500">L </span><span className="text-rose-300">{fmtPrice(d.low)}</span></span>}
      {d.close != null && <span><span className="text-slate-500">{isLine ? 'Giá ' : 'C '}</span><span className="font-bold text-white">{fmtPrice(d.close)}</span></span>}
      {d.change != null && (
        <span className={`font-semibold ${changeColor}`}>
          {d.change >= 0 ? '+' : ''}{d.change.toFixed(2)}%
        </span>
      )}
      {d.volume != null && <span><span className="text-slate-500">Vol </span><span className="text-cyan-300">{fmtVolume(d.volume)}</span></span>}
      <span>
        <span className="text-slate-500">Whale Buy </span>
        <span className="text-lime-300">{fmtCompact(whaleInfo.buyValue)} ({whaleInfo.buyCount || 0})</span>
      </span>
      <span>
        <span className="text-slate-500">Whale Sell </span>
        <span className="text-rose-300">{fmtCompact(whaleInfo.sellValue)} ({whaleInfo.sellCount || 0})</span>
      </span>
    </div>
  );
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
      <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
        <span className="font-semibold text-slate-300">Chú thích Cường độ:</span> Thang điểm 0-100 phản ánh mức độ hoạt động
        của dòng tiền tổ chức trong phiên gần nhất. Điểm càng cao cho thấy dấu hiệu dòng tiền lớn can thiệp càng rõ.
      </p>

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
      <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
        <span className="font-semibold text-slate-300">Chú thích SMFI:</span> SMFI dương nghĩa là lực mua thông minh đang chiếm ưu thế,
        SMFI âm nghĩa là lực bán đang lấn át. Dùng chỉ số này để đối chiếu với trạng thái chiến thuật 2W-4W trước khi ra quyết định.
      </p>
    </section>
  );
}

// ─── Main DarkMoneyMasterChart Component ─────────────────────────────────────

export default function DarkMoneyMasterChart({ symbol }) {
  const { t } = useI18n();

  // State
  const [data, setData] = useState(null);
  const [datasetCache, setDatasetCache] = useState({});
  const [loading, setLoading] = useState(true);
  const [chartError, setChartError] = useState('');
  const [period, setPeriod] = useState('6M');
  const [interval, setInterval] = useState('1D');
  const [showWhaleSignals, setShowWhaleSignals] = useState(true);
  const [showWhaleLabels, setShowWhaleLabels] = useState(false);
  const [showMa20, setShowMa20] = useState(true);
  const [showMa50, setShowMa50] = useState(true);
  const [chartType, setChartType] = useState('candle'); // 'candle' | 'line'
  const [ohlcTooltip, setOhlcTooltip] = useState(null);
  const [prefetchState, setPrefetchState] = useState({
    running: false,
    completed: 0,
    total: 0,
    loaded: false,
    error: '',
  });

  // Refs for chart containers
  const priceChartRef = useRef(null);
  const cvdChartRef = useRef(null);
  const darkFlowChartRef = useRef(null);

  // Refs for chart instances (cleanup)
  const priceChartInstance = useRef(null);
  const cvdChartInstance = useRef(null);
  const darkFlowChartInstance = useRef(null);
  const priceMainSeriesRef = useRef(null);
  const cvdMainSeriesRef = useRef(null);
  const darkFlowMainSeriesRef = useRef(null);
  const datasetCacheRef = useRef({});
  const hasMovedAwayFromLeftEdgeRef = useRef(false);
  const autoExpandInFlightRef = useRef(false);

  useEffect(() => {
    datasetCacheRef.current = datasetCache;
  }, [datasetCache]);

  useEffect(() => {
    hasMovedAwayFromLeftEdgeRef.current = false;
    autoExpandInFlightRef.current = false;
  }, [symbol, interval, period]);

  useEffect(() => {
    setDatasetCache({});
    datasetCacheRef.current = {};
    setData(null);
    setChartError('');
    setPrefetchState({
      running: false,
      completed: 0,
      total: 0,
      loaded: false,
      error: '',
    });
  }, [symbol]);

  const buildDatasetKey = useCallback((targetPeriod, targetInterval) => `${targetPeriod}:${targetInterval}`, []);

  const loadDataset = useCallback(async (targetPeriod, targetInterval, { force = false } = {}) => {
    const cacheKey = buildDatasetKey(targetPeriod, targetInterval);
    if (!force && datasetCacheRef.current[cacheKey]) {
      return datasetCacheRef.current[cacheKey];
    }

    const resp = await getDarkMoneyHistory(symbol, { period: targetPeriod, interval: targetInterval });
    const payload = resp?.data || null;
    setDatasetCache((prev) => {
      const next = { ...prev, [cacheKey]: payload };
      datasetCacheRef.current = next;
      return next;
    });
    return payload;
  }, [buildDatasetKey, symbol]);

  // ─── Fetch Data ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const payload = await loadDataset(period, interval);
      setData(payload);
    } catch (err) {
      console.error('DarkMoneyHistory fetch error:', err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [symbol, period, interval, loadDataset]);

  const prefetchAllDatasets = useCallback(async () => {
    if (!symbol || prefetchState.running) return;

    const combinations = INTERVALS.flatMap((targetInterval) => (
      PERIODS.map((targetPeriod) => ({ targetPeriod, targetInterval }))
    ));

    setPrefetchState({
      running: true,
      completed: 0,
      total: combinations.length,
      loaded: false,
      error: '',
    });

    let completed = 0;
    const failures = [];

    for (const item of combinations) {
      try {
        await loadDataset(item.targetPeriod, item.targetInterval, { force: true });
      } catch (error) {
        failures.push(`${item.targetPeriod}/${item.targetInterval}`);
        console.error('DarkMoneyHistory prefetch error:', item, error);
      } finally {
        completed += 1;
        setPrefetchState((prev) => ({
          ...prev,
          running: true,
          completed,
          total: combinations.length,
        }));
      }
    }

    const currentPayload = datasetCacheRef.current[buildDatasetKey(period, interval)] || null;
    if (currentPayload) {
      setData(currentPayload);
    }

    setPrefetchState({
      running: false,
      completed: combinations.length,
      total: combinations.length,
      loaded: failures.length === 0,
      error: failures.length ? t('darkMoneyChart.manualLoadPartial', { count: failures.length }) : '',
    });
  }, [symbol, prefetchState.running, loadDataset, buildDatasetKey, period, interval, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Render Charts ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!data || !data.candles?.length) {
      setChartError('');
      setOhlcTooltip(null);
      return;
    }

    setChartError('');

    // Cleanup previous charts
    const cleanupCharts = () => {
      setOhlcTooltip(null);
      priceMainSeriesRef.current = null;
      cvdMainSeriesRef.current = null;
      darkFlowMainSeriesRef.current = null;
      [priceChartInstance, cvdChartInstance, darkFlowChartInstance].forEach((ref) => {
        if (ref.current) {
          try { ref.current.remove(); } catch (_) {}
          ref.current = null;
        }
      });
    };
    cleanupCharts();

    const normalizedCandles = normalizeCandlesForChart(data.candles);
    const candles = normalizedCandles.map((c) => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    const lineData = candles
      .filter((c) => c.close != null)
      .map((c) => ({ time: c.time, value: c.close }));

    // B2: lookup map time → candle (with index for prev-close % calc)
    const candlesByTime = {};
    normalizedCandles.forEach((c, idx) => { candlesByTime[c.time] = { ...c, idx }; });
    const whaleSignalsByTime = buildWhaleSignalSummaryByTime(data.whale_signals || [], normalizedCandles, interval);
    const priceByTime = Object.fromEntries(normalizedCandles.map((c) => [String(c.time), Number(c.close || 0)]));
    const cvdByTime = Object.fromEntries(
      (data.dark_flow_series || [])
        .filter((d) => d.cvd !== undefined && d.cvd !== null)
        .map((d) => [String(d.time), Number(d.cvd || 0)]),
    );
    const darkFlowByTime = Object.fromEntries(
      (data.dark_flow_series || []).map((d) => [String(d.time), Number(d.strength || 0)]),
    );

    // A2: tick formatters — LW Charts v5 passes BusinessDay {year,month,day} for YYYY-MM-DD strings
    const tickFmtShort = (time) => {
      if (time && typeof time === 'object' && time.day != null) {
        return `${String(time.day).padStart(2, '0')}/${String(time.month).padStart(2, '0')}`;
      }
      if (typeof time === 'number') {
        const d = new Date(time * 1000);
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      }
      if (typeof time === 'string') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(time)) {
          const [y, m, d] = time.split('-');
          return `${d}/${m}`;
        }
        if (/^\d+$/.test(time)) {
          const d = new Date(Number(time) * 1000);
          return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        }
      }
      return '';
    };
    const tickFmtFull = (time) => {
      if (time && typeof time === 'object' && time.day != null) {
        return `${String(time.day).padStart(2, '0')}/${String(time.month).padStart(2, '0')}/${String(time.year).slice(-2)}`;
      }
      if (typeof time === 'number' || /^\d+$/.test(String(time))) {
        const d = new Date(Number(time) * 1000);
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      }
      if (typeof time === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(time)) {
        const [y, m, d] = time.split('-');
        return `${d}/${m}/${y.slice(-2)}`;
      }
      return tickFmtShort(time);
    };

    let resizeObserver = null;

    try {
      // ── PANE 1: Price + Volume + Whale Markers ──────────────────────────
      if (priceChartRef.current) {
        const priceZoomLimits = computeZoomBarSpacingLimits(priceChartRef.current.clientWidth, candles.length);
        const chart1 = createChart(priceChartRef.current, {
          ...CHART_THEME,
          width: priceChartRef.current.clientWidth,
          height: PRICE_PANE_HEIGHT,
          // A2: trục X hiển thị với format dd/MM
          timeScale: {
            ...CHART_THEME.timeScale,
            visible: true,
            timeVisible: true,
            secondsVisible: false,
            tickMarkFormatter: tickFmtShort,
            minBarSpacing: priceZoomLimits.minBarSpacing,
            maxBarSpacing: priceZoomLimits.maxBarSpacing,
          },
        });
        priceChartInstance.current = chart1;

        // B1: Candle hoặc Line tùy chartType state
        let priceSeries;
        if (chartType === 'line') {
          priceSeries = addSeriesCompat(chart1, 'addLineSeries', LineSeries, {
            lineColor: '#2ea8ff',
            lineWidth: 2.5,
            priceLineVisible: false,
            lastValueVisible: true,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 3,
          });
          priceSeries.setData(lineData);
        } else {
          priceSeries = addSeriesCompat(chart1, 'addCandlestickSeries', CandlestickSeries, CANDLE_COLORS);
          priceSeries.setData(candles);
        }
        priceMainSeriesRef.current = priceSeries;

        // Volume overlay
        const volumeSeries = addSeriesCompat(chart1, 'addHistogramSeries', HistogramSeries, {
          priceFormat: { type: 'volume' },
          priceScaleId: 'volume',
        });
        chart1.priceScale('volume').applyOptions({
          scaleMargins: { top: 0.85, bottom: 0 },
        });
        volumeSeries.setData(
          normalizedCandles.map((c) => ({
            time: c.time,
            value: c.volume,
            color: c.close >= c.open ? 'rgba(34, 197, 94, 0.2)' : 'rgba(244, 63, 94, 0.2)',
          })),
        );

        // A4: MA20 — lineWidth 2.5 + crosshairMarker
        if (showMa20 && data.moving_averages?.ma20?.length) {
          const ma20Series = addSeriesCompat(chart1, 'addLineSeries', LineSeries, {
            color: '#22d3ee',
            lineWidth: 2.5,
            lineStyle: 0,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 4,
          });
          ma20Series.setData(data.moving_averages.ma20);
        }

        // A4: MA50 — lineWidth 2.5 + crosshairMarker
        if (showMa50 && data.moving_averages?.ma50?.length) {
          const ma50Series = addSeriesCompat(chart1, 'addLineSeries', LineSeries, {
            color: '#f59e0b',
            lineWidth: 2.5,
            lineStyle: 0,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 4,
          });
          ma50Series.setData(data.moving_averages.ma50);
        }

        // Whale Markers: top 10% trong khung thời gian đang hiển thị
        if (showWhaleSignals && data.whale_signals?.length) {
          const renderWhaleMarkersByRange = (range) => {
            const markers = buildCompactWhaleMarkers(data.whale_signals, candles, showWhaleLabels, {
              topPercent: 0.1,
              visibleRange: range,
              minMarkers: 3,
              chartType,
            });
            setMarkersCompat(priceSeries, markers);
          };

          renderWhaleMarkersByRange(chart1.timeScale().getVisibleRange?.() || null);
          chart1.timeScale().subscribeVisibleTimeRangeChange((range) => {
            renderWhaleMarkersByRange(range);
          });
        }

        // Auto-expand period từng nấc khi zoom-out/pan chạm biên trái dữ liệu.
        const firstCandleEpoch = toEpochSecondsFromChartTimeKey(String(data.candles?.[0]?.time || ''));
        if (Number.isFinite(firstCandleEpoch)) {
          chart1.timeScale().subscribeVisibleTimeRangeChange((range) => {
            if (!range || autoExpandInFlightRef.current) return;

            const rangeFromEpoch = toEpochSecondsFromChartTimeKey(normalizeChartTimeKey(range.from));
            if (!Number.isFinite(rangeFromEpoch)) return;

            const toleranceSeconds = interval === '1W' ? 14 * 24 * 3600 : 2 * 24 * 3600;
            const atLeftEdge = rangeFromEpoch <= (firstCandleEpoch + toleranceSeconds);

            if (!atLeftEdge) {
              hasMovedAwayFromLeftEdgeRef.current = true;
              return;
            }

            if (!hasMovedAwayFromLeftEdgeRef.current) return;

            const nextPeriod = getNextExpandedPeriod(period);
            if (!nextPeriod) return;

            autoExpandInFlightRef.current = true;
            hasMovedAwayFromLeftEdgeRef.current = false;
            setPeriod(nextPeriod);
          });
        }

        // B2: Subscribe crosshairMove → OHLC tooltip
        chart1.subscribeCrosshairMove((param) => {
          if (!param?.time || !param?.point) {
            setOhlcTooltip(null);
            return;
          }
          // LW Charts v5: param.time là BusinessDay object cho YYYY-MM-DD strings
          let timeKey;
          if (typeof param.time === 'object' && param.time.year != null) {
            timeKey = `${param.time.year}-${String(param.time.month).padStart(2, '0')}-${String(param.time.day).padStart(2, '0')}`;
          } else {
            timeKey = String(param.time);
          }
          const candle = candlesByTime[timeKey];
          if (!candle) { setOhlcTooltip(null); return; }
          const prev = candle.idx > 0 ? normalizedCandles[candle.idx - 1] : null;
          const change = prev && prev.close > 0 ? ((candle.close - prev.close) / prev.close) * 100 : null;
          setOhlcTooltip({ ...candle, change, whaleInfo: whaleSignalsByTime[timeKey] || null });
        });

        chart1.timeScale().fitContent();
      }

      // ── PANE 2: CVD — trục X ẩn (pane giữa không cần lặp label) ────────
      if (cvdChartRef.current && data.dark_flow_series?.length) {
        const cvdZoomLimits = computeZoomBarSpacingLimits(cvdChartRef.current.clientWidth, candles.length);
        const chart2 = createChart(cvdChartRef.current, {
          ...CHART_THEME,
          width: cvdChartRef.current.clientWidth,
          height: SECONDARY_PANE_HEIGHT,
          timeScale: {
            ...CHART_THEME.timeScale,
            visible: false,
            minBarSpacing: cvdZoomLimits.minBarSpacing,
            maxBarSpacing: cvdZoomLimits.maxBarSpacing,
          },
          rightPriceScale: {
            ...CHART_THEME.rightPriceScale,
            scaleMargins: { top: 0.1, bottom: 0.1 },
          },
        });
        cvdChartInstance.current = chart2;

        const cvdData = data.dark_flow_series
          .filter((d) => d.cvd !== undefined && d.cvd !== null)
          .map((d) => ({ time: d.time, value: d.cvd }));

        if (cvdData.length) {
          // A3: priceFormat compact (-2.5B thay vì -2500000000.00)
          const cvdSeries = addSeriesCompat(chart2, 'addAreaSeries', AreaSeries, {
            lineColor: '#22d3ee',
            topColor: 'rgba(34, 211, 238, 0.3)',
            bottomColor: 'rgba(244, 63, 94, 0.15)',
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: true,
            baseValue: { type: 'price', price: 0 },
            priceFormat: { type: 'custom', formatter: (v) => fmtCompact(v) },
          });
          cvdSeries.setData(cvdData);
          cvdMainSeriesRef.current = cvdSeries;
        }

        chart2.timeScale().fitContent();
      }

      // ── PANE 3: Dark Flow Strength — trục X hiện với full date ──────────
      if (darkFlowChartRef.current && data.dark_flow_series?.length) {
        const darkFlowZoomLimits = computeZoomBarSpacingLimits(darkFlowChartRef.current.clientWidth, candles.length);
        const chart3 = createChart(darkFlowChartRef.current, {
          ...CHART_THEME,
          width: darkFlowChartRef.current.clientWidth,
          height: SECONDARY_PANE_HEIGHT,
          // A2: trục X pane dưới cùng — hiện ngày đầy đủ dd/MM/yy
          timeScale: {
            ...CHART_THEME.timeScale,
            visible: true,
            timeVisible: true,
            secondsVisible: false,
            tickMarkFormatter: tickFmtFull,
            minBarSpacing: darkFlowZoomLimits.minBarSpacing,
            maxBarSpacing: darkFlowZoomLimits.maxBarSpacing,
          },
          rightPriceScale: {
            ...CHART_THEME.rightPriceScale,
            scaleMargins: { top: 0.05, bottom: 0 },
          },
        });
        darkFlowChartInstance.current = chart3;

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
        darkFlowMainSeriesRef.current = histSeries;

        // Mốc trung tính 50 để định lượng lực dòng tiền mạnh/yếu
        const baseline50 = addSeriesCompat(chart3, 'addLineSeries', LineSeries, {
          color: 'rgba(148, 163, 184, 0.65)',
          lineWidth: 1,
          lineStyle: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          crosshairMarkerVisible: false,
        });
        baseline50.setData(histData.map((d) => ({ time: d.time, value: 50 })));

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

      // ── A1: Cross-chart Time Sync — dùng TIME range thay logical index ──
      // setVisibleLogicalRange sync theo index → sai khi mỗi pane có số điểm khác nhau
      // setVisibleRange sync theo giá trị thời gian thực → đúng
      const charts = [priceChartInstance.current, cvdChartInstance.current, darkFlowChartInstance.current].filter(Boolean);
      if (charts.length > 1) {
        let isSyncing = false;

        const primaryRangeSource = priceChartInstance.current;
        const secondaryRangeTargets = [cvdChartInstance.current, darkFlowChartInstance.current].filter(Boolean);

        primaryRangeSource?.timeScale().subscribeVisibleTimeRangeChange((range) => {
          if (isSyncing || !range) return;
          isSyncing = true;
          secondaryRangeTargets.forEach((target) => {
            try { target.timeScale().setVisibleRange(range); } catch (_) {}
          });
          isSyncing = false;
        });

        const syncTargets = [
          { chart: priceChartInstance.current, series: priceMainSeriesRef.current, valueMap: priceByTime },
          { chart: cvdChartInstance.current, series: cvdMainSeriesRef.current, valueMap: cvdByTime },
          { chart: darkFlowChartInstance.current, series: darkFlowMainSeriesRef.current, valueMap: darkFlowByTime },
        ]
          .filter((item) => item.chart && item.series)
          .map((item) => {
            const sortedTimeKeys = Object.keys(item.valueMap || {}).sort((a, b) => {
              const ae = toEpochSecondsFromChartTimeKey(a);
              const be = toEpochSecondsFromChartTimeKey(b);
              if (ae != null && be != null) return ae - be;
              return String(a).localeCompare(String(b));
            });
            return { ...item, sortedTimeKeys };
          });

        let isSyncingCrosshair = false;

        const resolveTargetPoint = (target, timeKey, fallbackTime) => {
          const exactValue = target.valueMap[timeKey];
          if (Number.isFinite(exactValue)) {
            return { time: fallbackTime, value: exactValue };
          }

          if (!target.sortedTimeKeys?.length) return null;

          const requestedEpoch = toEpochSecondsFromChartTimeKey(timeKey);
          let bestKey = null;
          let bestDistance = Number.POSITIVE_INFINITY;

          target.sortedTimeKeys.forEach((key) => {
            const value = target.valueMap[key];
            if (!Number.isFinite(value)) return;

            if (requestedEpoch == null) {
              if (bestKey == null) bestKey = key;
              return;
            }

            const keyEpoch = toEpochSecondsFromChartTimeKey(key);
            if (keyEpoch == null) return;

            const distance = Math.abs(keyEpoch - requestedEpoch);
            if (distance < bestDistance) {
              bestDistance = distance;
              bestKey = key;
            }
          });

          if (!bestKey) return null;

          const bestValue = target.valueMap[bestKey];
          if (!Number.isFinite(bestValue)) return null;

          let resolvedTime = bestKey;
          if (/^\d+$/.test(String(bestKey))) {
            resolvedTime = Number(bestKey);
          } else if (/^\d{4}-\d{2}-\d{2}$/.test(String(bestKey))) {
            const [year, month, day] = String(bestKey).split('-').map(Number);
            resolvedTime = { year, month, day };
          }

          return { time: resolvedTime, value: bestValue };
        };

        const syncCrosshairAtTime = (time) => {
          if (!time) {
            setOhlcTooltip(null);
            syncTargets.forEach((target) => {
              if (typeof target.chart.clearCrosshairPosition === 'function') {
                target.chart.clearCrosshairPosition();
              }
            });
            return;
          }

          const timeKey = normalizeChartTimeKey(time);

          syncTargets.forEach((target) => {
            if (typeof target.chart.setCrosshairPosition !== 'function') return;
            const resolvedPoint = resolveTargetPoint(target, timeKey, time);
            if (resolvedPoint) {
              target.chart.setCrosshairPosition(resolvedPoint.value, resolvedPoint.time, target.series);
            }
          });

          const candle = candlesByTime[timeKey];
          if (!candle) {
            setOhlcTooltip(null);
            return;
          }
          const prev = candle.idx > 0 ? normalizedCandles[candle.idx - 1] : null;
          const change = prev && prev.close > 0 ? ((candle.close - prev.close) / prev.close) * 100 : null;
          setOhlcTooltip({ ...candle, change, whaleInfo: whaleSignalsByTime[timeKey] || null });
        };

        syncTargets.forEach((source) => {
          if (typeof source.chart.subscribeCrosshairMove !== 'function') return;
          source.chart.subscribeCrosshairMove((param) => {
            if (isSyncingCrosshair) return;
            isSyncingCrosshair = true;
            try {
              if (!param?.time || !param?.point) {
                syncCrosshairAtTime(null);
                return;
              }
              syncCrosshairAtTime(param.time);
            } finally {
              isSyncingCrosshair = false;
            }
          });

          if (typeof source.chart.subscribeClick === 'function') {
            source.chart.subscribeClick((param) => {
              if (isSyncingCrosshair || !param?.time) return;
              isSyncingCrosshair = true;
              try {
                syncCrosshairAtTime(param.time);
              } finally {
                isSyncingCrosshair = false;
              }
            });
          }
        });
      }

      // ── Resize Observer ─────────────────────────────────────────────────
      resizeObserver = new ResizeObserver(() => {
        if (priceChartRef.current && priceChartInstance.current) {
          const priceZoomLimits = computeZoomBarSpacingLimits(priceChartRef.current.clientWidth, candles.length);
          priceChartInstance.current.applyOptions({
            width: priceChartRef.current.clientWidth,
            timeScale: {
              minBarSpacing: priceZoomLimits.minBarSpacing,
              maxBarSpacing: priceZoomLimits.maxBarSpacing,
            },
          });
        }
        if (cvdChartRef.current && cvdChartInstance.current) {
          const cvdZoomLimits = computeZoomBarSpacingLimits(cvdChartRef.current.clientWidth, candles.length);
          cvdChartInstance.current.applyOptions({
            width: cvdChartRef.current.clientWidth,
            timeScale: {
              minBarSpacing: cvdZoomLimits.minBarSpacing,
              maxBarSpacing: cvdZoomLimits.maxBarSpacing,
            },
          });
        }
        if (darkFlowChartRef.current && darkFlowChartInstance.current) {
          const darkFlowZoomLimits = computeZoomBarSpacingLimits(darkFlowChartRef.current.clientWidth, candles.length);
          darkFlowChartInstance.current.applyOptions({
            width: darkFlowChartRef.current.clientWidth,
            timeScale: {
              minBarSpacing: darkFlowZoomLimits.minBarSpacing,
              maxBarSpacing: darkFlowZoomLimits.maxBarSpacing,
            },
          });
        }
      });

      if (priceChartRef.current) resizeObserver.observe(priceChartRef.current);
      if (cvdChartRef.current) resizeObserver.observe(cvdChartRef.current);
      if (darkFlowChartRef.current) resizeObserver.observe(darkFlowChartRef.current);
    } catch (error) {
      console.error('DarkMoney chart render error:', error);
      setChartError('Biểu đồ dark money tạm thời lỗi khởi tạo. Vui lòng tải lại trang.');
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      cleanupCharts();
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      cleanupCharts();
    };
  }, [data, showWhaleSignals, showWhaleLabels, showMa20, showMa50, chartType]);

  // ─── Latest dark flow for SMFI gauge ─────────────────────────────────────
  const latestDarkFlow = data?.dark_flow_series?.length
    ? data.dark_flow_series[data.dark_flow_series.length - 1]
    : null;

  // B3: Giá trị hiện tại của MA để hiển thị trong legend
  const ma20Last = data?.moving_averages?.ma20?.at?.(-1)?.value ?? null;
  const ma50Last = data?.moving_averages?.ma50?.at?.(-1)?.value ?? null;

  // ─── Render ──────────────────────────────────────────────────────────────
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
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
              <button
                type="button"
                onClick={prefetchAllDatasets}
                disabled={loading || prefetchState.running}
                className="rounded-full border border-cyan-700/70 bg-cyan-950/40 px-3 py-1.5 font-semibold text-cyan-200 transition-colors hover:bg-cyan-900/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {prefetchState.running
                  ? t('darkMoneyChart.manualLoadRunning', { completed: prefetchState.completed, total: prefetchState.total })
                  : t('darkMoneyChart.manualLoadButton')}
              </button>
              {prefetchState.loaded ? (
                <span className="rounded-full border border-emerald-800/70 bg-emerald-950/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-300">
                  {t('darkMoneyChart.manualLoadReady')}
                </span>
              ) : null}
              {prefetchState.error ? (
                <span className="text-amber-300">{prefetchState.error}</span>
              ) : null}
              <button
                type="button"
                onClick={() => setShowWhaleSignals((prev) => !prev)}
                className={`rounded-full border px-3 py-1.5 font-semibold transition-colors ${
                  showWhaleSignals
                    ? 'border-emerald-700/70 bg-emerald-950/30 text-emerald-200 hover:bg-emerald-900/40'
                    : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {showWhaleSignals ? t('darkMoneyChart.hideWhaleSignals') : t('darkMoneyChart.showWhaleSignals')}
              </button>
              <button
                type="button"
                onClick={() => setShowWhaleLabels((prev) => !prev)}
                disabled={!showWhaleSignals}
                className={`rounded-full border px-3 py-1.5 font-semibold transition-colors ${
                  showWhaleLabels && showWhaleSignals
                    ? 'border-amber-700/70 bg-amber-950/30 text-amber-200 hover:bg-amber-900/40'
                    : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {showWhaleLabels ? t('darkMoneyChart.hideWhaleLabels') : t('darkMoneyChart.showWhaleLabels')}
              </button>
              <button
                type="button"
                onClick={() => setShowMa20((prev) => !prev)}
                className={`rounded-full border px-3 py-1.5 font-semibold transition-colors ${
                  showMa20
                    ? 'border-cyan-700/70 bg-cyan-950/30 text-cyan-200 hover:bg-cyan-900/40'
                    : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {showMa20 ? t('darkMoneyChart.hideMa20') : t('darkMoneyChart.showMa20')}
              </button>
              <button
                type="button"
                onClick={() => setShowMa50((prev) => !prev)}
                className={`rounded-full border px-3 py-1.5 font-semibold transition-colors ${
                  showMa50
                    ? 'border-amber-700/70 bg-amber-950/30 text-amber-200 hover:bg-amber-900/40'
                    : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {showMa50 ? t('darkMoneyChart.hideMa50') : t('darkMoneyChart.showMa50')}
              </button>
            </div>
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
                  {iv === '1D' ? t('darkMoneyChart.daily') : iv === '1W' ? t('darkMoneyChart.weekly') : iv}
                </button>
              ))}
              {INTRADAY_INTERVALS.map((iv) => (
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
                  {iv}
                </button>
              ))}
            </div>
            {/* B1: Chart Type Toggle — Nến / Đường */}
            <div className="flex rounded-lg border border-slate-700 overflow-hidden text-[10px]">
              {['candle', 'line'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setChartType(type)}
                  className={`px-2.5 py-1 transition-colors ${
                    chartType === type
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  {type === 'candle' ? t('darkMoneyChart.typeCandle') : t('darkMoneyChart.typeLine')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* C3: Quick Signal Bar — chiến thuật đang active hiển thị ngay dưới header */}
        {data?.strategy_table && <QuickSignalBar strategyTable={data.strategy_table} />}

        {loading ? (
          <div className="space-y-1 p-4">
            <div className="h-[350px] animate-pulse rounded-xl bg-slate-900" />
            <div className="h-[112px] animate-pulse rounded-xl bg-slate-900" />
            <div className="h-[112px] animate-pulse rounded-xl bg-slate-900" />
          </div>
        ) : !data?.candles?.length ? (
          <div className="flex h-[500px] items-center justify-center text-sm text-slate-500">
            {t('darkMoneyChart.noData')}
          </div>
        ) : chartError ? (
          <div className="flex h-[500px] flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-sm font-semibold text-rose-300">Biểu đồ tạm thời gián đoạn</p>
            <p className="text-xs text-slate-400">{chartError}</p>
          </div>
        ) : (
          <div className="p-2">
            {/* Pane 1: Price + Whale Markers */}
            <div className="relative">
              <div className="absolute left-3 top-2 z-10 flex items-center gap-2 text-[10px]">
                {showMa20 ? (
                  <span className="flex items-center gap-1">
                    <span className="h-0.5 w-3 bg-cyan-400 inline-block" />
                    <span className="text-cyan-400">MA20{ma20Last != null ? `: ${fmtPrice(ma20Last)}` : ''}</span>
                  </span>
                ) : null}
                {showMa50 ? (
                  <span className="flex items-center gap-1">
                    <span className="h-0.5 w-3 bg-amber-400 inline-block" />
                    <span className="text-amber-400">MA50{ma50Last != null ? `: ${fmtPrice(ma50Last)}` : ''}</span>
                  </span>
                ) : null}
                {showWhaleSignals ? (
                  <>
                    <span className="flex items-center gap-1 text-lime-300">
                      <span className="inline-block h-2 w-2 rounded-full bg-lime-300" />
                      {t('darkMoneyChart.whaleBuy')}
                    </span>
                    <span className="flex items-center gap-1 text-rose-300">
                      <span className="inline-block h-2 w-2 rounded-full bg-rose-300" />
                      {t('darkMoneyChart.whaleSell')}
                    </span>
                  </>
                ) : null}
              </div>
              <div ref={priceChartRef} className="lw-chart-container" />
                          {/* B2: OHLC Crosshair Tooltip */}
                          <OhlcTooltip data={ohlcTooltip} chartType={chartType} t={t} />
            </div>

            {/* Pane 2: CVD */}
            <div className="relative mt-1 border-t border-slate-800/70 pt-5">
              <div className="absolute left-3 top-0 z-20 text-[10px] text-slate-400">
                {t('darkMoneyChart.cvdLabel')}
              </div>
              <div ref={cvdChartRef} className="lw-chart-container" />
            </div>

            {/* Pane 3: Dark Flow Strength */}
            <div className="relative mt-1 border-t border-slate-800/70 pt-5">
              <div className="absolute left-3 top-0 z-20 flex items-center gap-2 text-[10px]">
                <span className="text-slate-400">{t('darkMoneyChart.darkFlowStrength')}</span>
                <span
                  className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-slate-600 text-[9px] text-slate-400"
                  title="Chỉ số đo lường dòng tiền ngầm của các tổ chức lớn"
                >
                  ?
                </span>
                <span className="text-slate-500">Mốc 50</span>
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
