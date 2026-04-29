import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getStockAIAdvisorySession, getStockPriceChart, getStockWorkspaceOverview, getWhaleFeed } from '../api/client';
import KLineChartPanel from '../components/KLineChartPanel';
import WhaleBubbleChart from '../components/WhaleBubbleChart';
import CompactDarkMoneyFlow from '../components/CompactDarkMoneyFlow';
import { DepthChartPanel } from '../components/DepthChartPanel';
import { MoneyFlowDonut } from '../components/MoneyFlowDonut';
import { RVOLChartPanel } from '../components/RVOLChartPanel';
import { WhaleFeedPanel } from '../components/WhaleFeedPanel';
import WhaleAdvisoryCommandPanel from '../components/advisory/WhaleAdvisoryCommandPanel';
import useRealtimeFeed from '../hooks/useRealtimeFeed';
import useWhaleAnalyticsData from '../hooks/useWhaleAnalyticsData';
import { useI18n } from '../context/LangContext';
import { resolveAdvisoryConflictState } from './stockDetailAdvisoryUtils';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtBil(v) {
  if (v == null) return '—';
  const n = Number(v);
  if (n >= 1_000_000_000_000) return `${(n / 1_000_000_000_000).toFixed(1)}N`;
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}T`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  return n.toLocaleString(undefined);
}

const BUBBLE_TIMEFRAME_OPTIONS = [
  { value: '15m', label: '15 phút' },
  { value: '30m', label: '30 phút' },
  { value: '1h', label: '1 giờ' },
  { value: 'morning', label: 'Phiên sáng' },
  { value: 'afternoon', label: 'Phiên chiều' },
  { value: 'session', label: 'Cả phiên' },
];

// ─── Main Dashboard ──────────────────────────────────────────────────────────

export default function WhaleAlertsDashboard() {
  const { t, formatDateTime } = useI18n();
  const { symbol } = useParams();
  const normalizedSymbol = (symbol || '').toUpperCase();
  const [chartData, setChartData] = useState([]);
  const [loadingChart, setLoadingChart] = useState(true);
  const [activePeriod, setActivePeriod] = useState(180);
  const [activeTimeframe, setActiveTimeframe] = useState('1H');
  const [chartVisibleRange, setChartVisibleRange] = useState({ from_ts: null, to_ts: null });
  const [bubbleTimeframe, setBubbleTimeframe] = useState('session');
  const [selectedSession, setSelectedSession] = useState(null);
  const [advisorySession, setAdvisorySession] = useState(null);
  const [advisoryLoading, setAdvisoryLoading] = useState(false);
  const [advisoryRowMessage, setAdvisoryRowMessage] = useState('');
  const advisoryRequestIdRef = useRef(0);
  const selectedTradeDate = selectedSession?.symbol === normalizedSymbol ? selectedSession.tradeDate ?? null : null;

  const { alerts, darkFlowAlerts, latestWhaleAlert, latestDarkFlowAlert, realtimeStatus, lastEventAt } = useRealtimeFeed({
    symbols: normalizedSymbol ? [normalizedSymbol] : [],
  });

  const {
    data: chartAnalyticsData,
  } = useWhaleAnalyticsData(normalizedSymbol, activeTimeframe, null, { includeBaseline: false });

  const {
    data: bubbleAnalyticsData,
    loading: whaleAnalyticsLoading,
    error: whaleAnalyticsError,
  } = useWhaleAnalyticsData(normalizedSymbol, bubbleTimeframe, selectedTradeDate);

  const normalizeSymbol = (value) => String(value || '').trim().toUpperCase();

  const symbolAlerts = (alerts || []).filter((a) => normalizeSymbol(a?.symbol) === normalizedSymbol);
  const symbolDarkFlowAlerts = (darkFlowAlerts || []).filter((a) => normalizeSymbol(a?.symbol) === normalizedSymbol);

  const liveBoardAlerts = React.useMemo(() => {
    const whaleItems = symbolAlerts.map((a) => ({
      ...a,
      alert_kind: 'whale_alert',
    }));

    const darkFlowItems = symbolDarkFlowAlerts.map((a) => ({
      ...a,
      alert_kind: 'dark_flow_alert',
      side: (a.signal_type || '').toLowerCase().includes('sell') ? 'sell' : (a.signal_type || '').toLowerCase().includes('buy') ? 'buy' : null,
      matched_value: a.matched_value ?? null,
    }));

    return [...whaleItems, ...darkFlowItems]
      .sort((left, right) => {
        const lt = new Date(left?.ts || 0).getTime();
        const rt = new Date(right?.ts || 0).getTime();
        return rt - lt;
      })
      .slice(0, 8);
  }, [symbolAlerts, symbolDarkFlowAlerts]);

  const symbolWhaleAlert = latestWhaleAlert?.symbol === normalizedSymbol ? latestWhaleAlert : null;
  const symbolDarkFlowAlert = latestDarkFlowAlert?.symbol === normalizedSymbol ? latestDarkFlowAlert : null;

  // Lấy whale feed + summary
  const [feedData, setFeedData] = useState(null);
  const [feedLoading, setFeedLoading] = useState(true);
  const [companyName, setCompanyName] = useState('');

  const whaleSignalsForChart = useMemo(() => {
    const snapshotOrders = chartAnalyticsData?.bubbles?.orders;
    const flattenedSnapshotOrders = snapshotOrders
      ? [
        ...(Array.isArray(snapshotOrders.buy) ? snapshotOrders.buy : []),
        ...(Array.isArray(snapshotOrders.sell) ? snapshotOrders.sell : []),
        ...(Array.isArray(snapshotOrders.internal) ? snapshotOrders.internal : []),
      ]
      : [];

    if (flattenedSnapshotOrders.length > 0) {
      return flattenedSnapshotOrders;
    }

    if (Array.isArray(feedData?.whale_orders) && feedData.whale_orders.length > 0) {
      return feedData.whale_orders;
    }

    return symbolAlerts;
  }, [chartAnalyticsData, feedData, symbolAlerts]);

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

  const fetchAdvisorySession = useCallback(async ({ silent = false } = {}) => {
    if (!normalizedSymbol) {
      setAdvisorySession(null);
      setAdvisoryRowMessage('');
      return;
    }

    const requestId = ++advisoryRequestIdRef.current;
    if (!silent) {
      setAdvisoryLoading(true);
    }
    setAdvisoryRowMessage('');

    try {
      const advisoryParams = { contract: 'v2', include_benchmarks: 1 };
      if (selectedTradeDate) {
        advisoryParams.trade_date = selectedTradeDate;
      }

      const response = await getStockAIAdvisorySession(normalizedSymbol, advisoryParams);
      if (requestId !== advisoryRequestIdRef.current) {
        return;
      }

      const payload = response?.data || {};
      if (payload && payload.ok === false) {
        const conflictState = resolveAdvisoryConflictState(payload, t);
        setAdvisorySession(conflictState.advisory || conflictState.aggregate || null);
        setAdvisoryRowMessage(conflictState.message || '');
        return;
      }

      setAdvisorySession(payload.advisory || payload.aggregate || null);
    } catch (error) {
      if (requestId !== advisoryRequestIdRef.current) {
        return;
      }
      setAdvisorySession(null);
      setAdvisoryRowMessage(error?.response?.data?.message || t('whaleAnalytics.aiAdvisoryLoadFailed', { defaultValue: 'Không thể tải tư vấn AI cho phiên này.' }));
    } finally {
      if (requestId === advisoryRequestIdRef.current && !silent) {
        setAdvisoryLoading(false);
      }
    }
  }, [normalizedSymbol, selectedTradeDate, t]);

  useEffect(() => {
    fetchAdvisorySession({ silent: false });
  }, [fetchAdvisorySession]);

  useEffect(() => {
    setSelectedSession(null);
  }, [normalizedSymbol]);

  useEffect(() => {
    if (!normalizedSymbol) {
      setChartData([]);
      return undefined;
    }

    let cancelled = false;

    const fetchChart = async () => {
      setLoadingChart(true);
      try {
        const response = await getStockPriceChart(normalizedSymbol, activePeriod, activeTimeframe);
        if (!cancelled) {
          const nextChartData = response?.data?.points || [];
          setChartData(nextChartData);
          if (!nextChartData.length) {
            setSelectedSession(null);
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('getStockPriceChart:', err);
          setChartData([]);
          setSelectedSession(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingChart(false);
        }
      }
    };

    fetchChart();

    return () => {
      cancelled = true;
    };
  }, [normalizedSymbol, activePeriod, activeTimeframe]);

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
              {lastEventAt ? ` · ${formatDateTime(lastEventAt, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}
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

      {/* Main grid: left 2 cols (Kline + Bubble) | right col (Feed + RVOL + Donut + Depth) */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_340px]">
        {/* Left 2 columns — stacked vertically */}
        <div className="xl:col-span-2 flex flex-col gap-4">
          <section className="card-section p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <p className="text-label">{t('stockDetail.klineWorkspace')}</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-100">
                  {t('stockDetail.candlestickFor', { symbol: normalizedSymbol })}
                </h2>
              </div>
              <div className="text-[11px] text-slate-500">
                {chartVisibleRange.from_ts && chartVisibleRange.to_ts ? (
                  <span>
                    {t('whaleAlertsDashboard.viewingRange', { defaultValue: 'Phạm vi đang xem' })}: {' '}
                    {formatDateTime(chartVisibleRange.from_ts, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    {' → '}
                    {formatDateTime(chartVisibleRange.to_ts, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                ) : (
                  <span>{t('whaleAlertsDashboard.viewingRange', { defaultValue: 'Phạm vi đang xem' })}: --</span>
                )}
              </div>
            </div>

            <div className="mt-3 h-[520px]">
              {loadingChart ? (
                <div className="h-full animate-pulse rounded-2xl bg-slate-900" />
              ) : chartData.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-800 text-sm text-slate-500">
                  {t('stockDetail.noChartData')}
                </div>
              ) : (
                <KLineChartPanel
                  data={chartData}
                  activePeriod={activePeriod}
                  activeTimeframe={activeTimeframe}
                  onPeriodChange={setActivePeriod}
                  onTimeframeChange={({ timeframe, days }) => {
                    setSelectedSession(null);
                    setActiveTimeframe(timeframe);
                    if (Number.isFinite(days)) {
                      setActivePeriod(days);
                    }
                  }}
                  onVisibleRangeChange={setChartVisibleRange}
                  flowData={chartAnalyticsData?.flow || null}
                  whaleSignals={whaleSignalsForChart}
                  onSessionChange={({ tradeDate }) => {
                    setSelectedSession(tradeDate ? { symbol: normalizedSymbol, tradeDate } : null);
                  }}
                />
              )}
            </div>
          </section>

          <section className="card-section p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <p className="text-label">{t('whaleAlertsDashboard.largeOrderDistribution')}</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-100">{t('whaleAlertsDashboard.priceVolumeBubble')}</h2>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      {t('whaleChart.timeframe') || 'Khoảng thời gian'}
                    </label>
                    <select
                      value={bubbleTimeframe}
                      onChange={(e) => setBubbleTimeframe(e.target.value)}
                      className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs font-bold text-emerald-400 outline-none focus:border-emerald-500 transition-all"
                    >
                      {BUBBLE_TIMEFRAME_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {t('whaleAlertsDashboard.selectedSession', { defaultValue: 'Phiên đang xem' })}: {' '}
                    <span className="text-slate-300">
                      {selectedTradeDate
                        ? formatDateTime(`${selectedTradeDate}T12:00:00`, { day: '2-digit', month: '2-digit', year: 'numeric' })
                        : '--'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3">
              <WhaleBubbleChart
                isControlled
                externalSymbol={normalizedSymbol}
                externalTimeframe={bubbleTimeframe}
                externalData={bubbleAnalyticsData?.bubbles || null}
                externalFlowData={bubbleAnalyticsData?.flow || null}
                externalLoading={whaleAnalyticsLoading}
                externalError={whaleAnalyticsError}
                onTimeframeChange={setBubbleTimeframe}
                onSymbolChange={() => {}}
                isEmbedded={true}
                syncTimestamp={chartVisibleRange.to_ts ? Math.floor(Number(chartVisibleRange.to_ts) / 1000) : null}
              />
            </div>
          </section>

          <section className="card-section p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <p className="text-label">{t('whaleAlertsDashboard.aiAdvisoryLabel', { defaultValue: 'Tư vấn AI theo phiên' })}</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-100">
                  {selectedTradeDate
                    ? formatDateTime(`${selectedTradeDate}T12:00:00`, { day: '2-digit', month: '2-digit', year: 'numeric' })
                    : t('whaleAlertsDashboard.latestSessionLabel', { defaultValue: 'Phiên gần nhất có dữ liệu' })}
                </h2>
              </div>
              <div className="text-[11px] text-slate-500">
                {t('whaleAlertsDashboard.selectedSession', { defaultValue: 'Phiên đang xem' })}: {' '}
                <span className="text-slate-300">
                  {selectedTradeDate
                    ? formatDateTime(`${selectedTradeDate}T12:00:00`, { day: '2-digit', month: '2-digit', year: 'numeric' })
                    : '--'}
                </span>
              </div>
            </div>

            <div className="mt-3 h-[760px]">
              <WhaleAdvisoryCommandPanel
                item={advisorySession}
                activeSymbol={normalizedSymbol}
                onRefresh={() => fetchAdvisorySession({ silent: false })}
                refreshing={advisoryLoading}
                deleting={false}
                rowMessage={advisoryRowMessage}
              />
            </div>
          </section>
        </div>

        {/* Right column — widget stack */}
        <div className="flex flex-col gap-4">
          <WhaleFeedPanel
            symbol={normalizedSymbol}
            realtimeAlerts={liveBoardAlerts}
            feedData={feedData}
            loading={feedLoading}
            onRefresh={fetchFeed}
            feedHeightClass="h-[320px] sm:h-[360px]"
          />
          <RVOLChartPanel symbol={normalizedSymbol} loading={false} />
          <MoneyFlowDonut summary={feedData?.summary} loading={feedLoading} compact />
          <DepthChartPanel symbol={normalizedSymbol} compact />
          <CompactDarkMoneyFlow
            symbol={normalizedSymbol}
            flowData={bubbleAnalyticsData?.flow || null}
            height={260}
            syncTimestamp={chartVisibleRange.to_ts ? Math.floor(Number(chartVisibleRange.to_ts) / 1000) : null}
          />
        </div>
      </div>
    </div>
  );
}
