import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createChart, CandlestickSeries, HistogramSeries } from 'lightweight-charts';
import { Link, useParams } from 'react-router-dom';
import {
  addTrackedSymbol,
  addWatchlistItem,
  createPriceAlert,
  deleteTrackedSymbol,
  deleteWatchlistItem,
  getIntradayMatched,
  getPriceBoard,
  getSectorBreadth,
  getStockPriceChart,
  getStockWorkspaceOverview,
  getWatchlistGroups,
} from '../api/client';
import useRealtimeFeed from '../hooks/useRealtimeFeed';

const PERIODS = [30, 90, 180, 365];

function formatCurrency(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }

  return Number(value).toLocaleString('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  });
}

function formatCompactNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }

  return Number(value).toLocaleString('vi-VN');
}

function formatChartAxis(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return value;
  }
  if (numericValue >= 1_000_000) {
    return `${(numericValue / 1_000_000).toFixed(1)}M`;
  }
  if (numericValue >= 1_000) {
    return `${(numericValue / 1_000).toFixed(0)}K`;
  }
  return numericValue.toFixed(0);
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }

  const numericValue = Number(value);
  return `${numericValue > 0 ? '+' : ''}${numericValue.toFixed(2)}%`;
}

function formatPercentDelta(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  const numericValue = Number(value);
  return `${numericValue > 0 ? '+' : ''}${numericValue.toFixed(2)}%`;
}

function fmtPrice(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return Number(v).toLocaleString('vi-VN');
}

function fmtVol(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString('vi-VN');
}

function CandlestickChart({ data }) {
  const wrapRef = useRef(null);
  const containerRef = useRef(null);
  const tooltipRef = useRef(null);
  const chartRef = useRef(null);
  const candleRef = useRef(null);
  const volumeRef = useRef(null);

  // Create chart + series once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#64748b',
        fontFamily: 'inherit',
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
      },
      crosshair: {
        mode: 1, // Magnet — snaps to nearest bar
        vertLine: { color: '#475569', labelBackgroundColor: '#0f172a', width: 1, style: 0 },
        horzLine: { color: '#475569', labelBackgroundColor: '#0f172a', width: 1, style: 0 },
      },
      rightPriceScale: {
        borderColor: '#1e293b',
        textColor: '#64748b',
        scaleMargins: { top: 0.05, bottom: 0.22 }, // leave room for volume
      },
      timeScale: {
        borderColor: '#1e293b',
        timeVisible: true,
        secondsVisible: false,
      },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });

    // Candlestick series
    const candle = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#f43f5e',
      borderUpColor: '#16a34a',
      borderDownColor: '#be123c',
      wickUpColor: '#16a34a',
      wickDownColor: '#be123c',
    });

    // Volume histogram — separate price scale pinned to bottom
    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    });
    chart.priceScale('vol').applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    // OHLC tooltip via crosshair subscription
    chart.subscribeCrosshairMove((param) => {
      const el = tooltipRef.current;
      if (!el) return;
      if (!param.point || !param.time || !param.seriesData.get(candle)) {
        el.style.opacity = '0';
        return;
      }
      const bar = param.seriesData.get(candle);
      const vol = param.seriesData.get(volume);
      const isUp = bar.close >= bar.open;
      el.style.opacity = '1';
      el.innerHTML = `
        <span class="ohlc-label" style="color:${isUp ? '#22c55e' : '#f43f5e'}">
          O <b>${fmtPrice(bar.open)}</b>
          H <b>${fmtPrice(bar.high)}</b>
          L <b>${fmtPrice(bar.low)}</b>
          C <b>${fmtPrice(bar.close)}</b>
        </span>
        ${vol ? `<span style="color:#64748b;margin-left:10px">KL <b style="color:#94a3b8">${fmtVol(vol.value)}</b></span>` : ''}
      `;
    });

    chartRef.current = chart;
    candleRef.current = candle;
    volumeRef.current = volume;

    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, []);

  // Update data when prop changes
  useEffect(() => {
    if (!candleRef.current || !data?.length) return;

    const sorted = data
      .filter((d) => d.date && d.open != null && d.high != null && d.low != null && d.close != null)
      .map((d) => ({
        time: d.date,
        open: Number(d.open),
        high: Number(d.high),
        low: Number(d.low),
        close: Number(d.close),
        volume: d.volume != null ? Number(d.volume) : null,
      }))
      .sort((a, b) => (a.time > b.time ? 1 : -1));

    candleRef.current.setData(sorted.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })));

    if (volumeRef.current) {
      const volPoints = sorted
        .filter((d) => d.volume != null)
        .map((d) => ({
          time: d.time,
          value: d.volume,
          color: d.close >= d.open ? 'rgba(34,197,94,0.35)' : 'rgba(244,63,94,0.35)',
        }));
      volumeRef.current.setData(volPoints);
    }

    chartRef.current.timeScale().fitContent();
  }, [data]);

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {/* OHLC tooltip overlay — top-left, fades in/out */}
      <div
        ref={tooltipRef}
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          pointerEvents: 'none',
          opacity: 0,
          transition: 'opacity 0.15s',
          fontSize: '11px',
          lineHeight: '1.7',
          background: 'rgba(2,6,23,0.82)',
          border: '1px solid #1e293b',
          borderRadius: 8,
          padding: '4px 10px',
          color: '#94a3b8',
          whiteSpace: 'nowrap',
          backdropFilter: 'blur(4px)',
        }}
      />
    </div>
  );
}

function IntradayMatchedPanel({ symbol, liveVolume }) {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fetchedAt, setFetchedAt] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const debounceRef = useRef(null);
  const prevVolumeRef = useRef(null);

  const fetchTrades = useCallback(async () => {
    if (!symbol) return;
    setRefreshing(true);
    setError('');
    try {
      const resp = await getIntradayMatched(symbol, 50);
      setTrades(resp.data.trades || []);
      setFetchedAt(resp.data.fetched_at || null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Không lấy được dữ liệu khớp lệnh.');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [symbol]);

  // Reset khi đổi mã
  useEffect(() => {
    setTrades([]);
    setFetchedAt(null);
    setLoading(true);
    prevVolumeRef.current = null;
    fetchTrades();
  }, [fetchTrades]);

  // Fallback polling mỗi 30s
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchTrades, 30_000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchTrades]);

  // Trigger khi WebSocket phát hiện volume thay đổi (có giao dịch mới)
  // Dùng debounce 3s để tránh gọi API quá nhiều
  useEffect(() => {
    if (!autoRefresh) return;
    const vol = Number(liveVolume);
    if (!Number.isFinite(vol) || vol <= 0) return;
    if (prevVolumeRef.current !== null && vol === prevVolumeRef.current) return;
    if (prevVolumeRef.current !== null && vol > prevVolumeRef.current) {
      // Volume tăng = có lệnh khớp mới → refresh sau 3s debounce
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetchTrades();
      }, 3_000);
    }
    prevVolumeRef.current = vol;
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [liveVolume, autoRefresh, fetchTrades]);

  const buyCount = trades.filter((t) => t.side === 'buy').length;
  const sellCount = trades.filter((t) => t.side === 'sell').length;
  const totalVol = trades.reduce((sum, t) => sum + (t.volume || 0), 0);

  return (
    <section className="card-section p-4">
      <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <p className="text-label">Khớp lệnh trong phiên</p>
          <h3 className="mt-1 text-base font-semibold text-white">Thông tin khớp lệnh thực tế</h3>
          {fetchedAt && (
            <p className="mt-0.5 text-[10px] text-slate-500">
              {refreshing && <span className="mr-1 inline-block animate-spin">⟳</span>}
              Cập nhật: {new Date(fetchedAt).toLocaleTimeString('vi-VN')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors ${
              autoRefresh
                ? 'border-emerald-700 bg-emerald-950/40 text-emerald-300'
                : 'border-slate-700 bg-slate-900/50 text-slate-400'
            }`}
          >
            {autoRefresh ? '⟳ Tự làm mới' : '⏸ Tạm dừng'}
          </button>
          <button
            onClick={fetchTrades}
            disabled={refreshing}
            className="rounded-full border border-slate-700 bg-slate-900/50 px-2.5 py-1 text-[10px] text-slate-400 hover:text-slate-200 disabled:opacity-40"
          >
            {loading && !refreshing ? '...' : refreshing ? <span className="inline-block animate-spin">⟳</span> : '↻'}
          </button>
        </div>
      </div>

      {/* Summary bar */}
      {trades.length > 0 && (
        <div className="mt-3 flex gap-3 text-[11px]">
          <span className="rounded-lg border border-emerald-800/50 bg-emerald-950/20 px-2.5 py-1 text-emerald-300">
            ▲ Mua: {buyCount}
          </span>
          <span className="rounded-lg border border-rose-800/50 bg-rose-950/20 px-2.5 py-1 text-rose-300">
            ▼ Bán: {sellCount}
          </span>
          <span className="rounded-lg border border-slate-700 bg-slate-900/50 px-2.5 py-1 text-slate-300">
            KL: {fmtVol(totalVol)}
          </span>
        </div>
      )}

      <div className="mt-3">
        {loading && trades.length === 0 ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded-lg bg-slate-900" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-900/40 bg-rose-950/20 px-3 py-2.5 text-[12px] text-rose-300">
            {error}
          </div>
        ) : trades.length === 0 ? (
          <p className="py-4 text-center text-[12px] text-slate-500">
            Chưa có dữ liệu khớp lệnh (ngoài giờ giao dịch hoặc chưa có giao dịch).
          </p>
        ) : (
          <div className="space-y-1 max-h-[340px] overflow-y-auto pr-1">
            {/* Header row */}
            <div className="grid grid-cols-[64px_1fr_80px_64px_56px] gap-1.5 px-3 py-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
              <span>Giờ</span>
              <span>Giá</span>
              <span className="text-right">KL</span>
              <span className="text-right">Loại</span>
              <span className="text-right">KL mua/bán</span>
            </div>
            {trades.map((row, idx) => (
              <div
                key={`${row.time}-${idx}`}
                className={`grid grid-cols-[64px_1fr_80px_64px_56px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] ${
                  row.side === 'buy'
                    ? 'border-emerald-900/30 bg-emerald-950/10'
                    : row.side === 'sell'
                      ? 'border-rose-900/30 bg-rose-950/10'
                      : 'border-slate-800/50 bg-slate-950/30'
                }`}
              >
                <span className="text-slate-500">{row.time}</span>
                <span className={`font-semibold tabular-nums ${row.side === 'buy' ? 'text-emerald-300' : row.side === 'sell' ? 'text-rose-300' : 'text-slate-200'}`}>
                  {row.price != null ? Number(row.price).toLocaleString('vi-VN') : '—'}
                </span>
                <span className="text-right text-slate-300 tabular-nums">{fmtVol(row.volume)}</span>
                <span className={`text-right text-[10px] font-medium ${row.side === 'buy' ? 'text-emerald-400' : row.side === 'sell' ? 'text-rose-400' : 'text-slate-400'}`}>
                  {row.match_type || (row.side === 'buy' ? 'BU' : row.side === 'sell' ? 'SD' : '—')}
                </span>
                <span className={`text-right text-[10px] ${row.side === 'buy' ? 'text-emerald-500' : row.side === 'sell' ? 'text-rose-500' : 'text-slate-500'}`}>
                  {row.side === 'buy' ? 'Mua' : row.side === 'sell' ? 'Bán' : 'KL'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function BreadthMiniPanel({ symbol }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setLoading(true);
    getSectorBreadth(symbol)
      .then((resp) => {
        if (!cancelled) {
          setGroups(resp.data?.groups || []);
          setError('');
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.detail || 'Không lấy được dữ liệu breadth.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [symbol]);

  if (loading) {
    return (
      <section className="card-section p-4">
        <div className="h-32 animate-pulse rounded-xl bg-slate-900" />
      </section>
    );
  }

  if (error || !groups.length) {
    return (
      <section className="card-section p-4">
        <div className="text-label pb-3 border-b border-slate-800">Chỉ số ngành</div>
        <div className="mt-3 text-slate-500 text-sm">
          {error || 'Không có dữ liệu nhóm ngành.'}
        </div>
      </section>
    );
  }

  return (
    <section className="card-section p-4">
      <div className="text-label pb-3 border-b border-slate-800">Breadth — Động thái nhóm</div>
      <div className="mt-4 space-y-3">
        {groups.map((group) => {
          const peers = group.peers || [];
          const upCount = peers.filter((p) => p.status === 'up').length;
          const downCount = peers.filter((p) => p.status === 'down').length;
          const flatCount = peers.filter((p) => p.status === 'flat').length;
          const total = peers.length;
          return (
            <div key={group.name}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-slate-300">{group.name}</span>
                <span className="text-[10px] text-slate-500">{upCount}↑ {downCount}↓ {flatCount}→</span>
              </div>
              <div className="flex h-5 gap-0.5 rounded-md overflow-hidden border border-slate-800 bg-slate-950">
                {upCount > 0 && (
                  <div className="bg-emerald-700/70" style={{ width: `${(upCount / total) * 100}%` }} title={`${upCount} tăng`} />
                )}
                {flatCount > 0 && (
                  <div className="bg-slate-700/50" style={{ width: `${(flatCount / total) * 100}%` }} title={`${flatCount} ngang`} />
                )}
                {downCount > 0 && (
                  <div className="bg-rose-700/70" style={{ width: `${(downCount / total) * 100}%` }} title={`${downCount} giảm`} />
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {peers.slice(0, 6).map((peer) => (
                  <div
                    key={peer.symbol}
                    className={`text-[10px] px-2 py-1 rounded border breadth-${peer.status}${peer.is_self ? ' ring-1 ring-cyan-500' : ''}`}
                  >
                    <span>{peer.symbol}</span>
                    {peer.change_pct != null && (
                      <span className="ml-1 font-semibold">
                        {peer.change_pct > 0 ? '+' : ''}{peer.change_pct.toFixed(1)}%
                      </span>
                    )}
                  </div>
                ))}
                {peers.length > 6 && (
                  <span className="text-[10px] px-2 py-1 text-slate-500">+{peers.length - 6}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function biasMeta(bias) {
  if (bias === 'BULLISH') {
    return {
      label: 'Tăng',
      className: 'border-emerald-700 bg-emerald-950/40 text-emerald-300',
      description: 'Giá đang nằm trên SMA20 và SMA50, động lượng duy trì tích cực.',
    };
  }
  if (bias === 'WEAK') {
    return {
      label: 'Yếu',
      className: 'border-rose-700 bg-rose-950/40 text-rose-300',
      description: 'Giá đang nằm dưới các đường trung bình và động lượng suy yếu.',
    };
  }
  return {
    label: 'Trung tính',
    className: 'border-slate-700 bg-slate-900/70 text-slate-300',
    description: 'Cấu trúc giá chưa nghiêng rõ theo một hướng mạnh.',
  };
}

function PriceDepthPanel({ symbol, liveVolume }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const prevVolumeRef = useRef(null);
  const debounceRef = useRef(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const resp = await getPriceBoard(symbol);
      setData(resp.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Không lấy được sổ lệnh.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [symbol]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Trigger khi volume thay đổi (debounce 3s)
  useEffect(() => {
    if (liveVolume && liveVolume !== prevVolumeRef.current) {
      prevVolumeRef.current = liveVolume;
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => fetchData(true), 3000);
    }
  }, [liveVolume, fetchData]);

  // 30s polling
  useEffect(() => {
    const id = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(id);
  }, [fetchData]);

  if (loading) {
    return (
      <section className="card-section p-4">
        <div className="h-48 animate-pulse rounded-xl bg-slate-900" />
      </section>
    );
  }

  const depth = data?.depth || [];
  const match = data?.match || {};
  const ref = match.reference_price;

  return (
    <section className="card-section p-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <p className="text-label">Độ sâu thị trường</p>
          <h3 className="mt-1 text-base font-semibold text-white">Sổ lệnh 3 mức giá</h3>
        </div>
        <button
          onClick={() => fetchData(true)}
          className="rounded-full border border-slate-700 px-3 py-1.5 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
        >
          {refreshing ? '⟳' : 'Cập nhật'}
        </button>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-rose-400">{error}</p>
      ) : depth.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Chưa có dữ liệu sổ lệnh.</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-4 gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">
            <span>KL Mua</span>
            <span>Giá mua</span>
            <span>Giá bán</span>
            <span className="text-right">KL Bán</span>
          </div>
          <div className="mt-2 space-y-2">
            {depth.map((row) => (
              <div key={row.level} className="grid grid-cols-4 gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm">
                <span className="text-slate-300">{formatCompactNumber(row.bid_volume)}</span>
                <span className="font-semibold text-emerald-300">{formatCurrency(row.bid_price)}</span>
                <span className="font-semibold text-rose-300">{formatCurrency(row.ask_price)}</span>
                <span className="text-right text-slate-300">{formatCompactNumber(row.ask_volume)}</span>
              </div>
            ))}
          </div>

          {/* Nước ngoài */}
          {(match.foreign_buy_volume != null || match.foreign_sell_volume != null) && (
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2 text-[12px]">
              <div>
                <span className="text-slate-500">NN Mua </span>
                <span className="font-semibold text-cyan-300">{formatCompactNumber(match.foreign_buy_volume)}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-500">NN Bán </span>
                <span className="font-semibold text-orange-300">{formatCompactNumber(match.foreign_sell_volume)}</span>
              </div>
            </div>
          )}
          {ref && (
            <p className="mt-2 text-right text-[10px] text-slate-600">
              Ref {formatCurrency(ref)} · {data.fetched_at ? new Date(data.fetched_at).toLocaleTimeString('vi-VN') : ''}
            </p>
          )}
        </>
      )}
    </section>
  );
}

export default function StockDetail() {
  const { symbol } = useParams();
  const normalizedSymbol = (symbol || '').toUpperCase();
  const [overview, setOverview] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [technical, setTechnical] = useState(null);
  const [watchlistGroups, setWatchlistGroups] = useState([]);
  const [selectedWatchlistGroupId, setSelectedWatchlistGroupId] = useState('');
  const [workspaceMessage, setWorkspaceMessage] = useState('');
  const [workspaceError, setWorkspaceError] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [alertTargetPrice, setAlertTargetPrice] = useState('');
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingChart, setLoadingChart] = useState(true);
  const [activePeriod, setActivePeriod] = useState(180);
  const [error, setError] = useState('');

  const { quotesBySymbol, realtimeStatus, lastEventAt, alerts, latestWhaleAlert } = useRealtimeFeed({
    symbols: normalizedSymbol ? [normalizedSymbol] : [],
  });

  // Lọc alerts và whale signals theo symbol hiện tại
  const symbolAlerts = alerts ? alerts.filter((a) => a.symbol === normalizedSymbol) : [];
  const symbolWhaleAlert = latestWhaleAlert && latestWhaleAlert.symbol === normalizedSymbol ? latestWhaleAlert : null;

  useEffect(() => {
    let cancelled = false;

    const fetchWatchlistGroups = async () => {
      try {
        const response = await getWatchlistGroups();
        if (!cancelled) {
          setWatchlistGroups(response.data || []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('getWatchlistGroups:', err);
        }
      }
    };

    fetchWatchlistGroups();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!normalizedSymbol) {
      return;
    }

    let cancelled = false;

    const fetchOverview = async () => {
      setLoadingOverview(true);
      setError('');
      try {
        const response = await getStockWorkspaceOverview(normalizedSymbol);
        if (!cancelled) {
          setOverview(response.data);
          if (!selectedWatchlistGroupId && response.data?.watchlist_memberships?.length > 0) {
            setSelectedWatchlistGroupId(String(response.data.watchlist_memberships[0].group_id));
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.detail || `Không tải được dữ liệu cho ${normalizedSymbol}.`);
        }
      } finally {
        if (!cancelled) {
          setLoadingOverview(false);
        }
      }
    };

    fetchOverview();

    return () => {
      cancelled = true;
    };
  }, [normalizedSymbol, selectedWatchlistGroupId]);

  useEffect(() => {
    if (!normalizedSymbol) {
      return;
    }

    let cancelled = false;

    const fetchChart = async () => {
      setLoadingChart(true);
      try {
        const response = await getStockPriceChart(normalizedSymbol, activePeriod);
        if (!cancelled) {
          setChartData(response.data.points || []);
          setTechnical(response.data.technical || null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('getStockPriceChart:', err);
          setChartData([]);
          setTechnical(null);
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
  }, [normalizedSymbol, activePeriod]);

  const liveQuote = quotesBySymbol[normalizedSymbol] || {};
  const currentPrice = liveQuote.current_price ?? overview?.current_price ?? overview?.close_price ?? null;
  const changeValue = liveQuote.change_value ?? overview?.change_value ?? null;
  const changePct = liveQuote.change_pct ?? overview?.change_pct ?? null;
  const liveHighPrice = liveQuote.high_price ?? overview?.high_price ?? null;
  const liveLowPrice = liveQuote.low_price ?? overview?.low_price ?? null;
  const liveVolume = liveQuote.volume ?? overview?.volume ?? null;

  const changeClass = useMemo(() => {
    if (changeValue > 0) {
      return 'text-emerald-400';
    }
    if (changeValue < 0) {
      return 'text-rose-400';
    }
    return 'text-slate-300';
  }, [changeValue]);

  const chartPerformance = useMemo(() => {
    if (!chartData.length) {
      return null;
    }
    const firstClose = Number(chartData[0]?.close || 0);
    const lastClose = Number(chartData[chartData.length - 1]?.close || 0);
    if (firstClose <= 0) {
      return null;
    }
    return ((lastClose - firstClose) / firstClose) * 100;
  }, [chartData]);

  const technicalBiasFallback = biasMeta(technical?.bias);
  const technicalBias = {
    ...technicalBiasFallback,
    label: technical?.bias_label || technicalBiasFallback.label,
    description: technical?.bias_description || technicalBiasFallback.description,
  };

  const availableWatchlistGroups = useMemo(
    () => watchlistGroups.filter((group) => !overview?.watchlist_memberships?.some((item) => item.group_id === group.id)),
    [overview?.watchlist_memberships, watchlistGroups],
  );

  useEffect(() => {
    if (!selectedWatchlistGroupId && availableWatchlistGroups.length > 0) {
      setSelectedWatchlistGroupId(String(availableWatchlistGroups[0].id));
    }
  }, [availableWatchlistGroups, selectedWatchlistGroupId]);

  const refreshWorkspace = async () => {
    const [overviewResponse, chartResponse] = await Promise.all([
      getStockWorkspaceOverview(normalizedSymbol),
      getStockPriceChart(normalizedSymbol, activePeriod),
    ]);
    setOverview(overviewResponse.data);
    setChartData(chartResponse.data.points || []);
    setTechnical(chartResponse.data.technical || null);
  };

  const showWorkspaceMessage = (message) => {
    setWorkspaceMessage(message);
    setTimeout(() => setWorkspaceMessage(''), 4000);
  };

  const handleToggleTracked = async () => {
    setWorkspaceError('');
    setActionLoading('tracked');
    try {
      if (overview.is_tracked && overview.tracked_symbol_id) {
        await deleteTrackedSymbol(overview.tracked_symbol_id);
        showWorkspaceMessage(`Đã bỏ ${normalizedSymbol} khỏi shortlist.`);
      } else {
        const sourceGroupId = overview.market_group_refs?.[0]?.id || null;
        await addTrackedSymbol(normalizedSymbol, sourceGroupId);
        showWorkspaceMessage(`Đã đưa ${normalizedSymbol} vào shortlist.`);
      }
      await refreshWorkspace();
    } catch (err) {
      setWorkspaceError(err.response?.data?.detail || 'Không thể cập nhật shortlist cho mã này.');
    } finally {
      setActionLoading('');
    }
  };

  const handleAddToWatchlist = async () => {
    if (!selectedWatchlistGroupId) {
      setWorkspaceError('Chưa có danh sách theo dõi cá nhân để thêm mã.');
      return;
    }

    setWorkspaceError('');
    setActionLoading('watchlist-add');
    try {
      await addWatchlistItem(Number(selectedWatchlistGroupId), normalizedSymbol);
      showWorkspaceMessage(`Đã thêm ${normalizedSymbol} vào danh sách theo dõi cá nhân.`);
      await refreshWorkspace();
    } catch (err) {
      setWorkspaceError(err.response?.data?.detail || 'Không thể thêm mã vào danh sách theo dõi cá nhân.');
    } finally {
      setActionLoading('');
    }
  };

  const handleRemoveFromWatchlist = async (itemId, groupName) => {
    setWorkspaceError('');
    setActionLoading(`watchlist-remove-${itemId}`);
    try {
      await deleteWatchlistItem(itemId);
      showWorkspaceMessage(`Đã bỏ ${normalizedSymbol} khỏi ${groupName}.`);
      await refreshWorkspace();
    } catch (err) {
      setWorkspaceError(err.response?.data?.detail || 'Không thể bỏ mã khỏi danh sách theo dõi cá nhân.');
    } finally {
      setActionLoading('');
    }
  };

  const handleCreateAlert = async () => {
    const targetPrice = Number(alertTargetPrice);
    if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
      setWorkspaceError('Mức giá cảnh báo phải lớn hơn 0.');
      return;
    }

    setWorkspaceError('');
    setActionLoading('alert');
    try {
      await createPriceAlert({
        symbol: normalizedSymbol,
        condition: targetPrice >= Number(currentPrice || 0) ? 'ABOVE' : 'BELOW',
        target_price: targetPrice,
        cooldown_seconds: 300,
        is_active: true,
      });
      setAlertTargetPrice('');
      showWorkspaceMessage(`Đã tạo cảnh báo giá cho ${normalizedSymbol}.`);
    } catch (err) {
      setWorkspaceError(err.response?.data?.detail || 'Không thể tạo cảnh báo giá.');
    } finally {
      setActionLoading('');
    }
  };


  if (loadingOverview) {
    return (
      <div className="mx-auto max-w-[1800px] space-y-4 p-4 xl:px-5">
        <div className="h-44 animate-pulse rounded-[24px] bg-slate-900" />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.7fr)_380px]">
          <div className="h-[560px] animate-pulse rounded-[24px] bg-slate-900" />
          <div className="h-[560px] animate-pulse rounded-[24px] bg-slate-900" />
        </div>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="rounded-[28px] border border-rose-900/70 bg-rose-950/30 p-8 text-center">
          <p className="text-sm font-semibold text-rose-300">Không mở được workspace mã</p>
          <p className="mt-2 text-sm text-slate-400">{error || `Không tìm thấy dữ liệu cho ${normalizedSymbol}.`}</p>
          <Link to="/watchlist" className="mt-4 inline-flex rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 transition-colors hover:border-slate-500 hover:text-white">
            Quay lại Radar thị trường
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1800px] space-y-4 p-4 xl:px-5">
      {/* Header Quote Section */}
      <section className="card-section overflow-hidden shadow-[0_18px_60px_rgba(2,6,23,0.45)] border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.14),_transparent_26%),linear-gradient(180deg,_rgba(15,23,42,0.98),_rgba(2,6,23,1))]">
        {/* Top bar: breadcrumb + feed status */}
        <div className="border-b border-slate-800/80 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-label">
              <Link to="/watchlist" className="transition-colors hover:text-slate-300">
                Radar thị trường
              </Link>
              <span>/</span>
              <span>Stock workspace</span>
              <span>/</span>
              <span>{overview.symbol}</span>
            </div>
            <div className="rounded-full border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-[11px] text-slate-400">
              Feed {realtimeStatus === 'live' ? 'Realtime' : realtimeStatus === 'polling' ? 'Fallback polling' : 'Đang kết nối'}
              {lastEventAt ? ` · ${new Date(lastEventAt).toLocaleTimeString('vi-VN')}` : ''}
            </div>
          </div>
        </div>

        {/* Quote + key metrics grid */}
        <div className="grid gap-4 px-4 py-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(460px,0.95fr)]">
          <div className="space-y-4">
            {/* Symbol + name + exchange */}
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-500/25 bg-cyan-500/10 text-2xl font-bold text-cyan-300">
                {overview.symbol}
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white">{overview.company_name || overview.symbol}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-slate-400">
                  <span>{overview.exchange || 'Chưa rõ sàn'}</span>
                  <span className="text-slate-700">•</span>
                  <span>{overview.industry || 'Chưa rõ ngành'}</span>
                  {overview.listed_date ? (
                    <>
                      <span className="text-slate-700">•</span>
                      <span>Niêm yết {overview.listed_date}</span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Current price + change */}
            <div>
              <p className="text-label">Giá hiện tại</p>
              <div className="mt-1 flex flex-wrap items-end gap-4">
                <span className="text-5xl font-semibold leading-none text-white">{formatCurrency(currentPrice)}</span>
                <span className={`pb-1 text-lg font-semibold ${changeClass}`}>
                  {changeValue > 0 ? '+' : ''}
                  {changeValue !== null && changeValue !== undefined ? formatCurrency(Math.abs(changeValue)).replace('₫', '').trim() : '—'}
                  {' · '}
                  {formatPercent(changePct)}
                </span>
              </div>
            </div>

            {/* Quick tags: shortlist, groups */}
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${overview.is_tracked ? 'border-emerald-700 bg-emerald-950/40 text-emerald-300' : 'border-slate-700 bg-slate-900/70 text-slate-400'}`}>
                {overview.is_tracked ? '✓ Theo dõi realtime' : '◇ Theo dõi realtime'}
              </span>
              {overview.market_groups.slice(0, 2).map((groupName) => (
                <span key={groupName} className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-[11px] text-slate-300">
                  {groupName}
                </span>
              ))}
            </div>
          </div>

          {/* Key metrics grid on the right */}
          <div className="rounded-[20px] border border-slate-800 bg-black/30 p-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="card-compact">
                <p className="text-label">Ref / Ceil / Floor</p>
                <p className="mt-1 text-sm font-medium text-slate-100">{formatCurrency(overview.reference_price)}</p>
                <p className="mt-1 text-[10px] text-slate-500">{formatCurrency(overview.ceiling_price)} / {formatCurrency(overview.floor_price)}</p>
              </div>
              <div className="card-compact">
                <p className="text-label">Range</p>
                <p className="mt-1 text-sm font-medium text-slate-100">{formatCurrency(liveLowPrice)} → {formatCurrency(liveHighPrice)}</p>
                <p className="mt-1 text-[10px] text-slate-500">Q: {formatCompactNumber(liveVolume)}</p>
              </div>
              <div className="card-compact">
                <p className="text-label">52W Range</p>
                <p className="mt-1 text-sm font-medium text-slate-100">{formatCurrency(overview.week52_low)}</p>
                <p className="mt-1 text-[10px] text-slate-500">→ {formatCurrency(overview.week52_high)}</p>
              </div>
              <div className="card-compact">
                <p className="text-label">Trung bình</p>
                <p className="mt-1 text-sm font-medium text-slate-100">{formatCurrency(overview.average_price)}</p>
              </div>
              <div className="card-compact">
                <p className="text-label">Thiên hướng</p>
                <p className={`mt-1 text-sm font-medium ${technicalBias.className.split(' ').filter(c => c.startsWith('text-')).join(' ')}`}>{technicalBias.label}</p>
              </div>
              <div className="card-compact">
                <p className="text-label">Khung này</p>
                <p className={`mt-1 text-sm font-medium ${chartPerformance !== null && chartPerformance >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {chartPerformance !== null ? `${chartPerformance >= 0 ? '+' : ''}${chartPerformance.toFixed(2)}%` : '—'}
                </p>
              </div>
            </div>
            <p className="mt-3 text-[12px] text-slate-400">{technicalBias.description}</p>
          </div>
        </div>

        {/* Action bar: shortlist / watchlist / alert */}
        <div className="border-t border-slate-800/80 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleToggleTracked}
              disabled={!!actionLoading}
              className={`btn-${overview.is_tracked ? 'secondary' : 'primary'} ${!!actionLoading ? 'opacity-50' : ''}`}
            >
              {actionLoading === 'tracked' ? 'Cập nhật...' : overview.is_tracked ? 'Bỏ theo dõi' : 'Theo dõi realtime'}
            </button>

            <div className="flex min-w-[280px] flex-wrap items-center gap-2 rounded-full border border-slate-700 bg-slate-950/75 px-2 py-1.5">
              <select
                value={selectedWatchlistGroupId}
                onChange={(event) => setSelectedWatchlistGroupId(event.target.value)}
                className="min-w-[150px] bg-transparent px-2 py-1 text-sm text-slate-200 outline-none"
              >
                {availableWatchlistGroups.length === 0 ? (
                  <option value="">Không còn DS để thêm</option>
                ) : availableWatchlistGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAddToWatchlist}
                disabled={!!actionLoading || availableWatchlistGroups.length === 0}
                className={`btn-accent ${!!actionLoading ? 'opacity-50' : ''}`}
              >
                {actionLoading === 'watchlist-add' ? 'Lưu...' : 'Lưu vào nhóm'}
              </button>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/75 px-2 py-1.5">
              <input
                value={alertTargetPrice}
                onChange={(event) => setAlertTargetPrice(event.target.value)}
                placeholder="Mức giá cảnh báo"
                className="w-32 bg-transparent px-2 py-1 text-sm text-slate-100 outline-none placeholder:text-slate-600"
              />
              <button
                onClick={handleCreateAlert}
                disabled={!!actionLoading}
                className={`btn-success ${!!actionLoading ? 'opacity-50' : ''}`}
              >
                {actionLoading === 'alert' ? 'Tạo...' : 'Tạo cảnh báo'}
              </button>
            </div>
          </div>

          {workspaceMessage ? <p className="mt-2 text-sm text-emerald-300">{workspaceMessage}</p> : null}
          {workspaceError ? <p className="mt-2 text-sm text-rose-300">{workspaceError}</p> : null}
        </div>
      </section>

      {/* Main content: chart + panels — 3-column grid at xl */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.74fr)_minmax(0,1fr)_minmax(0,1fr)]">
        {/* Chart section */}
        <section className="card-section p-4 xl:row-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <p className="text-label">Biểu đồ giá EOD</p>
              <h2 className="mt-1 text-lg font-semibold text-white">Diễn biến nến {activePeriod} ngày</h2>
              {chartPerformance !== null ? (
                <p className={`mt-1 text-[12px] font-medium ${chartPerformance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {chartPerformance >= 0 ? '+' : ''}
                  {chartPerformance.toFixed(2)}% khung
                </p>
              ) : null}
            </div>

            <div className="flex items-center gap-1 rounded-full border border-slate-800 bg-slate-950/80 p-1">
              {PERIODS.map((period) => (
                <button
                  key={period}
                  onClick={() => setActivePeriod(period)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${activePeriod === period ? 'bg-cyan-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {period >= 365 ? '1N' : `${Math.round(period / 30)}T`}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 h-[440px]">
            {loadingChart ? (
              <div className="h-full animate-pulse rounded-2xl bg-slate-950" />
            ) : chartData.length < 2 ? (
              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-800 text-sm text-slate-500">
                Chưa đủ dữ liệu EOD để dựng chart.
              </div>
            ) : (
              <CandlestickChart data={chartData} />
            )}
          </div>
        </section>

        {/* Col 2: Price Depth + Technical */}
        <div className="flex flex-col gap-4">
          {/* Price Depth — sổ lệnh 3 mức giá thực từ vnstock */}
          <PriceDepthPanel symbol={normalizedSymbol} liveVolume={liveVolume} />

          {/* Technical snapshot — compact */}
          <section className="card-section p-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <p className="text-label">Technical snapshot</p>
              <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${technicalBias.className}`}>
                {technicalBias.label}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0 text-[12px]">
              {[
                ['SMA20', formatCurrency(technical?.sma20)],
                ['SMA50', formatCurrency(technical?.sma50)],
                ['RSI14', technical?.rsi14 ?? '—'],
                ['KL TB20', formatCompactNumber(technical?.avg_volume_20)],
                ['Mom 20d', formatPercentDelta(technical?.momentum_20d_pct)],
                ['52T pos', formatPercentDelta(technical?.range_position_pct)],
              ].map(([label, val]) => (
                <div key={label} className="flex items-center justify-between border-b border-slate-800/60 py-1.5 last:border-b-0">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-medium text-slate-100">{val}</span>
                </div>
              ))}
            </div>
            {technicalBias.description && (
              <p className="mt-2 text-[11px] text-slate-500 leading-relaxed">{technicalBias.description}</p>
            )}
          </section>
        </div>

        {/* Col 3: Intraday + Breadth */}
        <div className="flex flex-col gap-4">
          {/* Intraday Matched Orders */}
          <IntradayMatchedPanel symbol={normalizedSymbol} liveVolume={liveVolume} />

          {/* Breadth mini-panel */}
          <BreadthMiniPanel symbol={normalizedSymbol} />
        </div>

        {/* Bottom row: Personal context + Signals — spans full width */}
        <div className="xl:col-span-3">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Personal context */}
            <section className="card-section p-4">
              <p className="text-label pb-2.5 border-b border-slate-800">Ngữ cảnh cá nhân</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                <div className="card-compact">
                  <p className="text-label">Shortlist</p>
                  <p className={`mt-1 font-medium ${overview.is_tracked ? 'text-emerald-300' : 'text-slate-400'}`}>
                    {overview.is_tracked ? '✓ Theo dõi' : 'Chưa theo dõi'}
                  </p>
                </div>
                <div className="card-compact col-span-1">
                  <p className="text-label">DS nhóm ({overview.watchlist_memberships.length})</p>
                  {overview.watchlist_memberships.length > 0 ? (
                    <div className="mt-1.5 space-y-1">
                      {overview.watchlist_memberships.map((item) => (
                        <div key={item.item_id} className="flex items-center justify-between gap-1 rounded border border-amber-900/30 bg-amber-950/10 px-2 py-1">
                          <span className="text-amber-300 truncate">{item.group_name}</span>
                          <button
                            onClick={() => handleRemoveFromWatchlist(item.item_id, item.group_name)}
                            disabled={!!actionLoading}
                            className="text-[10px] text-slate-400 hover:text-white shrink-0 disabled:opacity-50"
                          >
                            {actionLoading === `watchlist-remove-${item.item_id}` ? '...' : '✕'}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-slate-500">Chưa có</p>
                  )}
                </div>
              </div>
            </section>

            {/* Whale alert */}
            {symbolWhaleAlert && (
              <section className="card-section p-4">
                <p className="text-label pb-2.5 border-b border-slate-800">Tín hiệu cá mập</p>
                <div className="mt-3 rounded-xl border border-amber-700/40 bg-amber-950/20 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-widest text-amber-500 mb-1">🐋 Whale Alert</p>
                  <p className="text-sm font-semibold text-amber-200">
                    {symbolWhaleAlert.side === 'BUY' ? '↑ Mua lớn' : '↓ Bán lớn'}{' '}
                    {symbolWhaleAlert.matched_value
                      ? ` — ${(symbolWhaleAlert.matched_value / 1_000_000_000).toFixed(1)} tỷ`
                      : ''}
                  </p>
                  {symbolWhaleAlert.ts && (
                    <p className="mt-1 text-[11px] text-slate-500">
                      {new Date(symbolWhaleAlert.ts).toLocaleTimeString('vi-VN')}
                    </p>
                  )}
                </div>
              </section>
            )}

            {/* Active price alerts */}
            {symbolAlerts.length > 0 && (
              <section className="card-section p-4">
                <p className="text-label pb-2.5 border-b border-slate-800">Cảnh báo giá ({symbolAlerts.length})</p>
                <div className="mt-3 space-y-2">
                  {symbolAlerts.map((alert, idx) => (
                    <div key={`${alert.symbol}-${alert.ts}-${idx}`} className="rounded-xl border border-rose-700/40 bg-rose-950/20 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-widest text-rose-400 mb-1">🔔 Cảnh báo giá</p>
                      <p className="text-sm font-semibold text-rose-200">
                        {alert.condition === 'ABOVE' ? '▲ Vượt' : '▼ Dưới'}{' '}
                        {alert.target_price
                          ? Number(alert.target_price).toLocaleString('vi-VN') + ' ₫'
                          : formatCurrency(alert.price)}
                      </p>
                      {alert.ts && (
                        <p className="mt-1 text-[11px] text-slate-500">
                          {new Date(alert.ts).toLocaleTimeString('vi-VN')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
