import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getDepthChart, getRVOL, getStockOrderFlow, getStockWorkspaceOverview, getWhaleFeed } from '../api/client';
import DarkMoneyMasterChart from '../components/DarkMoneyMasterChart';
import useRealtimeFeed from '../hooks/useRealtimeFeed';
import { useI18n } from '../context/LangContext';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtBil(v) {
  if (v == null) return '—';
  const n = Number(v);
  if (n >= 1_000_000_000_000) return `${(n / 1_000_000_000_000).toFixed(1)}N`;
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}T`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  return n.toLocaleString(undefined);
}

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

function fmtVol(v) {
  if (v == null) return '—';
  const n = Number(v);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString(undefined);
}

function fmtPrice(v) {
  if (v == null) return '—';
  return Number(v).toLocaleString(undefined);
}

function formatPercentDelta(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  const numericValue = Number(value);
  return `${numericValue > 0 ? '+' : ''}${numericValue.toFixed(2)}%`;
}

function sizeClassEmoji(cls) {
  if (cls === 'shark') return '🦈';
  if (cls === 'whale') return '🐋';
  return '🐟';
}

function sideColor(side) {
  if (side === 'buy') return '#22c55e';
  if (side === 'sell') return '#f43f5e';
  return '#94a3b8';
}

function severityTone(severity) {
  if (severity === 'extreme') return 'bg-rose-500 text-white';
  if (severity === 'high') return 'bg-amber-400 text-slate-950';
  if (severity === 'medium') return 'bg-cyan-400 text-slate-950';
  return 'bg-slate-800 text-slate-200';
}

function severityLabel(severity, t) {
  const normalizedSeverity = String(severity || '').toLowerCase();
  if (normalizedSeverity === 'extreme') return t('whaleHub.severityExtreme');
  if (normalizedSeverity === 'high') return t('whaleHub.severityHigh');
  if (normalizedSeverity === 'medium') return t('whaleHub.severityMedium');
  return t('whaleHub.severityLow');
}

function formatFeedTime(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString(undefined);
}

function getFeedSourceMeta(source, t) {
  const normalizedSource = String(source || '').toLowerCase();
  if (normalizedSource === 'redis_stream') {
    return {
      label: t('whaleAlertsDashboard.sourceRedisStream'),
      tone: 'border-emerald-800/60 bg-emerald-950/30 text-emerald-200',
    };
  }
  if (normalizedSource === 'intraday_tick_db') {
    return {
      label: t('whaleAlertsDashboard.sourceIntradayDb'),
      tone: 'border-cyan-900/60 bg-cyan-950/30 text-cyan-200',
    };
  }
  if (normalizedSource === 'vnstock') {
    return {
      label: t('whaleAlertsDashboard.sourceVnstock'),
      tone: 'border-amber-800/60 bg-amber-950/30 text-amber-200',
    };
  }
  return {
    label: t('whaleAlertsDashboard.sourceUnknown'),
    tone: 'border-slate-700 bg-slate-950/70 text-slate-300',
  };
}

import { WhaleFeedPanel } from '../components/WhaleFeedPanel';
import { MoneyFlowDonut } from '../components/MoneyFlowDonut';
import { BubbleOrderChart } from '../components/BubbleOrderChart';
import { RVOLChartPanel } from '../components/RVOLChartPanel';
import { DepthChartPanel } from '../components/DepthChartPanel';
import { OrderFlowRadarPanel } from '../components/OrderFlowRadarPanel';

// ─── Main Dashboard ──────────────────────────────────────────────────────────

export default function WhaleAlertsDashboard() {
  const { t } = useI18n();
  const { symbol } = useParams();
  const normalizedSymbol = (symbol || '').toUpperCase();

  const { alerts, latestWhaleAlert, latestDarkFlowAlert, realtimeStatus, lastEventAt } = useRealtimeFeed({
    symbols: normalizedSymbol ? [normalizedSymbol] : [],
  });

  const symbolAlerts = (alerts || []).filter((a) => a.symbol === normalizedSymbol);
  const symbolWhaleAlert = latestWhaleAlert?.symbol === normalizedSymbol ? latestWhaleAlert : null;
  const symbolDarkFlowAlert = latestDarkFlowAlert?.symbol === normalizedSymbol ? latestDarkFlowAlert : null;

  // Lấy whale feed + summary
  const [feedData, setFeedData] = useState(null);
  const [feedLoading, setFeedLoading] = useState(true);
  const [companyName, setCompanyName] = useState('');
  const [orderFlowData, setOrderFlowData] = useState(null);
  const [orderFlowLoading, setOrderFlowLoading] = useState(true);
  const [orderFlowWindow, setOrderFlowWindow] = useState('30m');

  const fetchFeed = useCallback(async () => {
    setFeedLoading(true);
    try {
      const [feedResp, overviewResp] = await Promise.allSettled([
        getWhaleFeed(normalizedSymbol),
        getStockWorkspaceOverview(normalizedSymbol),
      ]);

      if (feedResp.status === 'fulfilled') {
        setFeedData(feedResp.value.data);
      }
      if (overviewResp.status === 'fulfilled') {
        setCompanyName(overviewResp.value.data?.company_name || '');
      }
    } catch (_) {}
    finally { setFeedLoading(false); }
  }, [normalizedSymbol]);

  useEffect(() => { setFeedData(null); fetchFeed(); }, [fetchFeed]);

  // Re-fetch khi có WS whale alert
  const prevWhaleRef = useRef(null);
  useEffect(() => {
    if (symbolWhaleAlert && symbolWhaleAlert?.ts !== prevWhaleRef.current) {
      prevWhaleRef.current = symbolWhaleAlert.ts;
      fetchFeed();
    }
  }, [symbolWhaleAlert, fetchFeed]);

  // Auto-refresh mỗi 60s
  useEffect(() => {
    const id = setInterval(fetchFeed, 60_000);
    return () => clearInterval(id);
  }, [fetchFeed]);

  const fetchOrderFlow = useCallback(async ({ silent = false } = {}) => {
    if (!normalizedSymbol) return;
    if (!silent) setOrderFlowLoading(true);
    try {
      const response = await getStockOrderFlow(normalizedSymbol, orderFlowWindow);
      setOrderFlowData(response?.data || null);
    } catch (_) {
      setOrderFlowData(null);
    } finally {
      if (!silent) setOrderFlowLoading(false);
    }
  }, [normalizedSymbol, orderFlowWindow]);

  useEffect(() => {
    if (!normalizedSymbol) return;
    let cancelled = false;

    const run = async (silent = false) => {
      if (cancelled) return;
      await fetchOrderFlow({ silent });
    };

    run(false);
    const interval = setInterval(() => {
      run(true);
    }, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [fetchOrderFlow, normalizedSymbol]);

  const prevDarkFlowRef = useRef(null);
  useEffect(() => {
    if (symbolDarkFlowAlert && symbolDarkFlowAlert?.ts !== prevDarkFlowRef.current) {
      prevDarkFlowRef.current = symbolDarkFlowAlert.ts;
      fetchOrderFlow({ silent: true });
    }
  }, [symbolDarkFlowAlert, fetchOrderFlow]);

  return (
    <div className="mx-auto max-w-[1800px] space-y-4 p-4 xl:px-5">
      {/* Header */}
      <section className="card-section px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/watchlist" className="text-label hover:text-slate-300 transition-colors">
              {t('layout.nav.watchlist')}
            </Link>
            <span className="text-slate-700">/</span>
            <Link to={`/stocks/${normalizedSymbol}`} className="text-label hover:text-slate-300 transition-colors">
              {normalizedSymbol}
            </Link>
            <span className="text-slate-700">/</span>
            <span className="text-slate-200 text-sm font-semibold">🦈 {t('layout.nav.whaleAlerts')}</span>

            <div className="w-full mt-1 text-xs text-slate-400">
              <span className="text-slate-500">{t('whaleAlertsDashboard.stockSymbol')}:</span> <span className="font-semibold text-slate-200">{normalizedSymbol}</span>
              <span className="mx-2 text-slate-700">|</span>
              <span className="text-slate-500">{t('whaleAlertsDashboard.companyName')}:</span>{' '}
              <span className="font-semibold text-slate-200">{companyName || t('whaleAlertsDashboard.updating')}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* WS whale alert badge */}
            {symbolWhaleAlert && (
              <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold animate-pulse ${
                (symbolWhaleAlert.side || '').toLowerCase() === 'buy'
                  ? 'border-emerald-600/60 bg-emerald-950/40 text-emerald-300'
                  : 'border-rose-600/60 bg-rose-950/40 text-rose-300'
              }`}>
                🚨 {(symbolWhaleAlert.side || '').toUpperCase()} · {fmtBil(symbolWhaleAlert.matched_value)}
              </div>
            )}
            <div className="rounded-full border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-[11px] text-slate-400">
              {realtimeStatus === 'live' ? t('whaleAlertsDashboard.statusLive') : realtimeStatus === 'polling' ? t('whaleAlertsDashboard.statusPolling') : t('whaleAlertsDashboard.statusConnecting')}
              {lastEventAt ? ` · ${new Date(lastEventAt).toLocaleTimeString(undefined)}` : ''}
            </div>
            <Link
              to={`/stocks/${normalizedSymbol}`}
              className="rounded-full border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
            >
              ← {t('whaleAlertsDashboard.stockWorkspace')}
            </Link>
          </div>
        </div>
      </section>

      {/* Main grid: left 2 cols (chart + radar) | right col (Feed + RVOL + Donut + Depth) */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_340px]">
        {/* Left 2 columns — stacked vertically */}
        <div className="xl:col-span-2 space-y-4">
          <DarkMoneyMasterChart symbol={normalizedSymbol} />
          <OrderFlowRadarPanel
            symbol={normalizedSymbol}
            loading={orderFlowLoading}
            orderFlowData={orderFlowData}
            latestRealtimeAlert={symbolDarkFlowAlert}
            window={orderFlowWindow}
            onWindowChange={setOrderFlowWindow}
          />
        </div>

        {/* Right column — widget stack */}
        <div className="flex flex-col gap-4">
          <WhaleFeedPanel
            symbol={normalizedSymbol}
            realtimeAlerts={symbolAlerts}
            feedData={feedData}
            loading={feedLoading}
            onRefresh={fetchFeed}
            feedHeightClass="h-[320px] sm:h-[360px]"
          />
          <RVOLChartPanel symbol={normalizedSymbol} loading={false} />
          <MoneyFlowDonut summary={feedData?.summary} loading={feedLoading} compact />
          <DepthChartPanel symbol={normalizedSymbol} compact />
        </div>
      </div>
    </div>
  );
}
