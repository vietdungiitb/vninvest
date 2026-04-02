import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getTrackedSymbols, getRealtimeHealth } from '../api/client';
import useRealtimeFeed from '../hooks/useRealtimeFeed';
import RealtimeDebugPanel from './RealtimeDebugPanel';

const REALTIME_LABELS = {
  idle: 'Chưa kết nối',
  connecting: 'Đang kết nối',
  live: 'Realtime đang chạy',
  polling: 'Fallback polling',
};

function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  return Number(value).toLocaleString('vi-VN');
}

function formatPrice(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  return `${Number(value).toLocaleString('vi-VN')} đ`;
}

function formatTime(value) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleTimeString('vi-VN');
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function fmtBil(value) {
  const v = Number(value) || 0;
  if (v >= 1_000_000_000_000) return `${(v / 1_000_000_000_000).toFixed(1)}N`;
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}T`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(0)}Tr`;
  return formatNumber(v);
}

function sizeClassEmoji(cls) {
  if (cls === 'shark') return '🦈';
  return '🐋';
}

export default function DashboardRealtimePanel({ holdings }) {
  const [trackedSymbols, setTrackedSymbols] = useState([]);
  const [realtimeHealth, setRealtimeHealth] = useState(null);

  const holdingSymbols = useMemo(
    () => [...new Set((holdings || []).map((item) => item.symbol).filter(Boolean))],
    [holdings],
  );

  const trackedSymbolNames = useMemo(
    () => trackedSymbols.map((item) => item.symbol).filter(Boolean),
    [trackedSymbols],
  );

  const monitoredSymbols = useMemo(
    () => [...new Set([...holdingSymbols, ...trackedSymbolNames])],
    [holdingSymbols, trackedSymbolNames],
  );

  const monitoredKey = useMemo(
    () => monitoredSymbols.slice().sort().join('|'),
    [monitoredSymbols],
  );

  useEffect(() => {
    let cancelled = false;

    const fetchTracked = async () => {
      try {
        const res = await getTrackedSymbols();
        if (!cancelled) {
          setTrackedSymbols(res.data || []);
        }
      } catch (err) {
        console.error('Load tracked symbols failed:', err);
      }
    };

    fetchTracked();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    getRealtimeHealth()
      .then((res) => setRealtimeHealth(res.data))
      .catch(() => setRealtimeHealth(null));
  }, []);

  const {
    quotesBySymbol,
    realtimeStatus,
    lastEventAt,
    alerts,
    metrics,
  } = useRealtimeFeed({ symbols: monitoredSymbols, maxAlerts: 5 });

  const quoteList = useMemo(
    () => monitoredSymbols.map((symbol) => quotesBySymbol[symbol] || { symbol }),
    [monitoredSymbols, quotesBySymbol],
  );

  const realtimePortfolioStats = useMemo(() => {
    const stats = (holdings || []).reduce((acc, holding) => {
      const quantity = toNumber(holding.quantity);
      const costBasis = toNumber(holding.cost_basis);
      const snapshotMarketValue = toNumber(holding.market_value);
      const liveQuote = quotesBySymbol[holding.symbol] || {};
      const livePrice = liveQuote.current_price ?? holding.current_price;
      const liveMarketValue = livePrice !== null && livePrice !== undefined
        ? toNumber(livePrice) * quantity
        : snapshotMarketValue;
      const unrealizedPL = liveMarketValue - costBasis;
      const unrealizedPLPct = costBasis > 0 ? (unrealizedPL / costBasis) * 100 : 0;

      acc.totalMarketValue += liveMarketValue;
      acc.totalUnrealizedPL += unrealizedPL;
      acc.snapshotMarketValue += snapshotMarketValue;

      if (liveQuote.stale) {
        acc.stalePositions += 1;
      }

      return acc;
    }, {
      totalMarketValue: 0,
      totalUnrealizedPL: 0,
      snapshotMarketValue: 0,
      stalePositions: 0,
    });

    const impliedCostBasis = stats.totalMarketValue - stats.totalUnrealizedPL;
    return {
      ...stats,
      totalUnrealizedPLPct: impliedCostBasis > 0
        ? (stats.totalUnrealizedPL / impliedCostBasis) * 100
        : 0,
    };
  }, [holdings, quotesBySymbol]);

  const liveVsSnapshotDelta = realtimePortfolioStats.totalMarketValue - realtimePortfolioStats.snapshotMarketValue;

  const marketStats = useMemo(() => {
    return quoteList.reduce((acc, item) => {
      if (item.stale) {
        acc.stale += 1;
      }
      if ((item.change_pct ?? 0) > 0) {
        acc.up += 1;
      } else if ((item.change_pct ?? 0) < 0) {
        acc.down += 1;
      } else {
        acc.flat += 1;
      }
      return acc;
    }, { up: 0, down: 0, flat: 0, stale: 0 });
  }, [quoteList]);

  const statusClasses = realtimeStatus === 'live'
    ? 'border-emerald-700 bg-emerald-950/30 text-emerald-300'
    : realtimeStatus === 'connecting'
      ? 'border-amber-700 bg-amber-950/30 text-amber-300'
      : 'border-gray-700 bg-gray-950 text-gray-400';

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
            Radar Realtime
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Theo dõi giá và whale alerts cho danh mục đang nắm giữ cùng shortlist theo dõi cá nhân.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`px-2.5 py-1 rounded-full border ${statusClasses}`}>
            {REALTIME_LABELS[realtimeStatus]}
          </span>
          <span className="px-2.5 py-1 rounded-full border border-gray-800 bg-gray-950 text-gray-400">
            Sự kiện gần nhất: {formatTime(lastEventAt)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs mt-2 w-full">
          <span className="text-gray-600 mr-0.5">Observability:</span>
          <span className="px-2 py-0.5 rounded border border-gray-800 bg-gray-950 text-gray-500">
            📈 {metrics?.eventCounts?.ticker_update ?? 0} tickers
          </span>
          <span className="px-2 py-0.5 rounded border border-gray-800 bg-gray-950 text-gray-500">
            🐋 {metrics?.eventCounts?.whale_alert ?? 0} whale
          </span>
          <span className="px-2 py-0.5 rounded border border-gray-800 bg-gray-950 text-gray-500">
            💓 {metrics?.eventCounts?.heartbeat ?? 0} hb
          </span>
          {(metrics?.eventCounts?.reconnect_attempts ?? 0) > 0 && (
            <span className="px-2 py-0.5 rounded border border-amber-800 bg-amber-950/20 text-amber-400">
              ↺ {metrics.eventCounts.reconnect_attempts} reconnect
            </span>
          )}
          {metrics?.lastLatencyMs !== null && metrics?.lastLatencyMs !== undefined && (
            <span className={`px-2 py-0.5 rounded border bg-gray-950 ${
              metrics.lastLatencyMs > 1500 ? 'border-red-800 text-red-400' : 'border-gray-800 text-gray-500'
            }`}>
              ⚡ {metrics.lastLatencyMs}ms
            </span>
          )}
          {realtimeHealth && (
            <span className={`px-2 py-0.5 rounded border bg-gray-950 ${
              realtimeHealth.channel_layer_type === 'inmemory'
                ? 'border-yellow-800 text-yellow-500'
                : realtimeHealth.redis_ok === false
                  ? 'border-red-800 text-red-400'
                  : 'border-emerald-900 text-emerald-500'
            }`}>
              {realtimeHealth.channel_layer_type === 'inmemory'
                ? '🧠 inmemory'
                : realtimeHealth.redis_ok === false
                  ? '🔴 redis down'
                  : '🟢 redis'}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-blue-900/60 bg-blue-950/20 px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-blue-300">Giá trị gần realtime</p>
          <p className="text-2xl font-bold text-gray-100 mt-1">{formatPrice(realtimePortfolioStats.totalMarketValue)}</p>
          <p className="text-xs text-gray-500 mt-1">Tính từ holdings đang nắm giữ + ticker realtime mới nhất</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-950 px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-gray-500">P/L chưa chốt gần realtime</p>
          <p className={`text-2xl font-bold mt-1 ${realtimePortfolioStats.totalUnrealizedPL > 0 ? 'text-emerald-300' : realtimePortfolioStats.totalUnrealizedPL < 0 ? 'text-red-300' : 'text-gray-100'}`}>
            {formatPrice(realtimePortfolioStats.totalUnrealizedPL)}
          </p>
          <p className={`text-xs mt-1 ${realtimePortfolioStats.totalUnrealizedPL > 0 ? 'text-emerald-300' : realtimePortfolioStats.totalUnrealizedPL < 0 ? 'text-red-300' : 'text-gray-500'}`}>
            {realtimePortfolioStats.totalUnrealizedPL > 0 ? '+' : ''}{realtimePortfolioStats.totalUnrealizedPLPct.toFixed(2)}%
          </p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-950 px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-gray-500">Mã đang giám sát</p>
          <p className="text-2xl font-bold text-gray-100 mt-1">{monitoredSymbols.length}</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-950 px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-gray-500">Lệch so với snapshot</p>
          <p className={`text-2xl font-bold mt-1 ${liveVsSnapshotDelta > 0 ? 'text-emerald-300' : liveVsSnapshotDelta < 0 ? 'text-red-300' : 'text-gray-100'}`}>
            {formatPrice(liveVsSnapshotDelta)}
          </p>
          <p className="text-xs text-gray-500 mt-1">So với market value từ lần đồng bộ giá gần nhất</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-950 px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-gray-500">Stale</p>
          <p className={`text-2xl font-bold mt-1 ${realtimePortfolioStats.stalePositions > 0 ? 'text-amber-300' : 'text-gray-100'}`}>
            {realtimePortfolioStats.stalePositions}
          </p>
          <p className="text-xs text-gray-500 mt-1">Số vị thế holdings đang dùng quote stale</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-950 px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-gray-500">Tăng / Giảm / Giữ</p>
          <p className="text-2xl font-bold text-gray-100 mt-1">{marketStats.up} / {marketStats.down} / {marketStats.flat}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-4">
        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 bg-gray-950/70">
            <h3 className="text-sm font-semibold text-gray-200">Trạng thái thị trường theo mã</h3>
          </div>
          {quoteList.length === 0 ? (
            <div className="px-4 py-8 text-sm text-gray-500 text-center">
              Chưa có mã để theo dõi realtime trên dashboard.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium">Mã</th>
                    <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium">Giá</th>
                    <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium">% thay đổi</th>
                    <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium">Độ tươi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {quoteList.map((item) => {
                    const isUp = (item.change_pct ?? 0) > 0;
                    const isDown = (item.change_pct ?? 0) < 0;
                    return (
                      <tr key={item.symbol} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 font-bold text-brand-300">{item.symbol}</td>
                        <td className="px-4 py-3 text-gray-200">{formatPrice(item.current_price)}</td>
                        <td className={`px-4 py-3 font-semibold ${isUp ? 'text-emerald-300' : isDown ? 'text-red-300' : 'text-gray-400'}`}>
                          {item.change_pct === null || item.change_pct === undefined
                            ? '—'
                            : `${isUp ? '+' : ''}${Number(item.change_pct).toFixed(2)}%`}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {item.stale ? (
                            <span className="text-amber-300">Stale</span>
                          ) : (
                            <span className="text-gray-500">{item.freshness_seconds ?? 0}s</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 bg-gray-950/70 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-gray-200">Whale alerts gần nhất</h3>
            <Link
              to="/whale-alerts"
              className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
            >
              Xem tất cả →
            </Link>
          </div>
          {alerts.length === 0 ? (
            <div className="px-4 py-8 text-sm text-gray-500 text-center">
              Chưa có whale alert mới. Panel sẽ tự cập nhật khi có event.
            </div>
          ) : (
            <div className="px-3 py-3 flex flex-col gap-2">
              {alerts.slice(0, 8).map((alert, index) => {
                const side = alert.side?.toLowerCase();
                const isBuy = side === 'buy';
                const sizeClass = (alert.matched_value || 0) >= 5_000_000_000 ? 'shark' : 'whale';
                const isBig = sizeClass === 'shark';
                return (
                  <Link
                    key={`${alert.symbol}-${alert.ts}-${index}`}
                    to={`/whale-alerts/${alert.symbol}`}
                    className="block"
                  >
                    <div className={`relative overflow-hidden rounded-xl border px-3 py-2.5 text-[12px] transition-colors hover:brightness-110 ${
                      isBuy
                        ? 'border-emerald-700/60 bg-emerald-950/30'
                        : side === 'sell'
                        ? 'border-rose-700/60 bg-rose-950/30'
                        : 'border-slate-700/60 bg-slate-900/30'
                    } ${index === 0 ? 'animate-pulse-once' : ''}`}>
                      {isBig && (
                        <span className="absolute right-2 top-1.5 text-[18px] opacity-50">
                          {sizeClassEmoji(sizeClass)}
                        </span>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-white text-[13px]">{alert.symbol}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          isBuy
                            ? 'bg-emerald-900/60 text-emerald-300'
                            : side === 'sell'
                            ? 'bg-rose-900/60 text-rose-300'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {isBuy ? '▲ MUA LỚN' : side === 'sell' ? '▼ BÁN LỚN' : 'TRUNG LẬP'}
                        </span>
                      </div>
                      <div className="mt-1 flex items-baseline justify-between gap-2">
                        <span className="text-sm font-bold text-white">{fmtBil(alert.matched_value)}</span>
                        <span className="text-[11px] text-slate-500">{formatTime(alert.ts)}</span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        Ngưỡng: {fmtBil(alert.threshold)}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
        <RealtimeDebugPanel />
      </div>
    </div>
  );
}
