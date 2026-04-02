import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createChart, CandlestickSeries } from 'lightweight-charts';
import { Link, useParams } from 'react-router-dom';
import {
  addTrackedSymbol,
  addWatchlistItem,
  createPriceAlert,
  deleteTrackedSymbol,
  deleteWatchlistItem,
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

function CandlestickChart({ data }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  // Create chart once
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
        vertLine: { color: '#475569', labelBackgroundColor: '#1e293b' },
        horzLine: { color: '#475569', labelBackgroundColor: '#1e293b' },
      },
      rightPriceScale: {
        borderColor: '#1e293b',
        textColor: '#64748b',
      },
      timeScale: {
        borderColor: '#1e293b',
        timeVisible: false,
      },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#f43f5e',
      borderUpColor: '#16a34a',
      borderDownColor: '#be123c',
      wickUpColor: '#16a34a',
      wickDownColor: '#be123c',
    });

    chartRef.current = chart;
    seriesRef.current = series;

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
    if (!seriesRef.current || !data || !data.length) return;
    const points = data
      .filter((d) => d.date && d.open != null && d.high != null && d.low != null && d.close != null)
      .map((d) => ({
        time: d.date,
        open: Number(d.open),
        high: Number(d.high),
        low: Number(d.low),
        close: Number(d.close),
      }))
      .sort((a, b) => (a.time > b.time ? 1 : -1));
    seriesRef.current.setData(points);
    chartRef.current.timeScale().fitContent();
  }, [data]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}

function BreadthMiniPanel({ marketGroups, symbol, technicalBias }) {
  const [peerData, setPeerData] = useState([]);

  useEffect(() => {
    // Mock breadth data based on market groups
    // In production, you would fetch actual peer stocks for each group
    if (marketGroups && marketGroups.length > 0) {
      const generatedPeers = marketGroups.slice(0, 3).flatMap((group, groupIdx) => {
        // Generate 3-5 mock peer symbols per group
        const peers = [];
        const peerCount = 3 + (groupIdx % 2);
        for (let i = 0; i < peerCount; i++) {
          const mockChange = (Math.random() - 0.5) * 8;
          peers.push({
            symbol: `${group.name.substring(0, 3).toUpperCase()}${i + 1}`,
            groupName: group.name,
            change: mockChange,
            status: mockChange > 1 ? 'up' : mockChange < -1 ? 'down' : 'flat',
          });
        }
        return peers;
      });
      setPeerData(generatedPeers);
    }
  }, [marketGroups]);

  if (!peerData.length) {
    return (
      <section className="card-section p-4">
        <div className="text-label pb-3 border-b border-slate-800">
          Chỉ số ngành
        </div>
        <div className="mt-3 text-slate-500 text-sm">
          Không có dữ liệu nhóm ngành để hiển thị breadth.
        </div>
      </section>
    );
  }

  return (
    <section className="card-section p-4">
      <div className="text-label pb-3 border-b border-slate-800">
        Breadth - Động thái nhóm
      </div>

      {/* Group headers with breadth bars */}
      <div className="mt-4 space-y-3">
        {marketGroups.map((group) => {
          const groupPeers = peerData.filter((p) => p.groupName === group.name);
          if (!groupPeers.length) return null;

          const upCount = groupPeers.filter((p) => p.status === 'up').length;
          const downCount = groupPeers.filter((p) => p.status === 'down').length;
          const flatCount = groupPeers.filter((p) => p.status === 'flat').length;
          const total = groupPeers.length;

          const upPct = (upCount / total) * 100;
          const downPct = (downCount / total) * 100;

          return (
            <div key={group.name}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-slate-300">{group.name}</span>
                <span className="text-[10px] text-slate-500">
                  {upCount}↑ {downCount}↓ {flatCount}→
                </span>
              </div>
              <div className="flex h-5 gap-0.5 rounded-md overflow-hidden border border-slate-800 bg-slate-950">
                {upCount > 0 && (
                  <div
                    className="bg-emerald-700/70"
                    style={{ width: `${upPct}%` }}
                    title={`${upCount} tăng`}
                  />
                )}
                {flatCount > 0 && (
                  <div
                    className="bg-slate-700/50"
                    style={{ width: `${(flatCount / total) * 100}%` }}
                    title={`${flatCount} ngang`}
                  />
                )}
                {downCount > 0 && (
                  <div
                    className="bg-rose-700/70"
                    style={{ width: `${downPct}%` }}
                    title={`${downCount} giảm`}
                  />
                )}
              </div>

              {/* Peer symbols mini list */}
              <div className="mt-2 flex flex-wrap gap-1">
                {groupPeers.slice(0, 4).map((peer) => (
                  <div
                    key={`${group.name}-${peer.symbol}`}
                    className={`text-[10px] px-2 py-1 rounded border breadth-${peer.status}`}
                  >
                    <span>{peer.symbol}</span>
                    <span className="ml-1 font-semibold">
                      {peer.change > 0 ? '+' : ''}{peer.change.toFixed(1)}%
                    </span>
                  </div>
                ))}
                {groupPeers.length > 4 && (
                  <span className="text-[10px] px-2 py-1 text-slate-500">
                    +{groupPeers.length - 4}
                  </span>
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

function buildMockDepth(currentPrice, volume, referencePrice, ceilingPrice, floorPrice) {
  if (!Number.isFinite(Number(currentPrice))) {
    return [];
  }

  const current = Number(currentPrice);
  const step = Math.max(current * 0.0018, 10);
  const baseVolume = Math.max(Math.round(Number(volume || 0) / 18), 500);
  const buyMultiplier = [2.6, 1.9, 1.3, 0.9];
  const sellMultiplier = [0.9, 1.4, 2.1, 2.9];

  return buyMultiplier.map((multiplier, index) => {
    const bid = Math.max(Number(floorPrice || current - step * 4), current - step * (index + 1));
    const ask = Math.min(Number(ceilingPrice || current + step * 4), current + step * (index + 1));
    return {
      bidPrice: bid,
      askPrice: ask,
      bidVolume: Math.round(baseVolume * multiplier),
      askVolume: Math.round(baseVolume * sellMultiplier[index]),
      spreadPct: referencePrice ? ((ask - bid) / Number(referencePrice)) * 100 : null,
    };
  });
}

function buildMockTape(symbol, chartData, currentPrice) {
  const recentPoints = chartData.slice(-10).reverse();
  return recentPoints.map((point, index) => {
    const close = Number(point.close || currentPrice || 0);
    const baseline = Number(currentPrice || close || 0);
    return {
      id: `${symbol}-${point.date}-${index}`,
      time: `${9 + Math.floor(index / 12)}:${String((index * 5) % 60).padStart(2, '0')}`,
      price: close,
      volume: Math.round(900 + (index + 1) * 375 + ((close % 7) * 120)),
      side: close >= baseline ? 'buy' : 'sell',
      changePct: baseline > 0 ? ((close - baseline) / baseline) * 100 : 0,
    };
  });
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

  const mockDepth = useMemo(
    () => buildMockDepth(currentPrice, overview?.volume, overview?.reference_price, overview?.ceiling_price, overview?.floor_price),
    [currentPrice, overview?.volume, overview?.reference_price, overview?.ceiling_price, overview?.floor_price],
  );

  const tapeRows = useMemo(
    () => buildMockTape(normalizedSymbol, chartData, currentPrice),
    [normalizedSymbol, chartData, currentPrice],
  );

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
                <p className="mt-1 text-sm font-medium text-slate-100">{formatCurrency(overview.low_price)} → {formatCurrency(overview.high_price)}</p>
                <p className="mt-1 text-[10px] text-slate-500">Q: {formatCompactNumber(overview.volume)}</p>
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

      {/* Main chart + right sidebar */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.74fr)_380px]">
        {/* Chart section with candlestick */}
        <section className="card-section p-4">
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

          <div className="mt-4 h-[470px]">
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

        {/* Right sidebar: depth, tape, breadth, technical */}
        <aside className="grid gap-4 grid-rows-max">
          {/* Simulated Depth */}
          <section className="card-section p-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <p className="text-label">Độ sâu thị trường</p>
                <h3 className="mt-1 text-base font-semibold text-white">Độ sâu giá lập</h3>
              </div>
              <span className="text-[11px] text-slate-500">4 mức quanh giá</span>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">
              <span>KL Mua</span>
              <span>Giá mua</span>
              <span>Giá bán</span>
              <span className="text-right">KL Bán</span>
            </div>
            <div className="mt-2 space-y-2">
              {mockDepth.map((row, index) => (
                <div key={`${row.bidPrice}-${row.askPrice}-${index}`} className="grid grid-cols-4 gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm">
                  <span className="text-slate-300">{formatCompactNumber(row.bidVolume)}</span>
                  <span className="font-semibold text-emerald-300">{formatCurrency(row.bidPrice)}</span>
                  <span className="font-semibold text-rose-300">{formatCurrency(row.askPrice)}</span>
                  <span className="text-right text-slate-300">{formatCompactNumber(row.askVolume)}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Simulated Tape */}
          <section className="card-section p-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <p className="text-label">Khớp lệnh</p>
                <h3 className="mt-1 text-base font-semibold text-white">Tape tiến gần nhất</h3>
              </div>
              <span className="text-[11px] text-slate-500">10 dòng</span>
            </div>
            <div className="mt-3 space-y-2">
              {tapeRows.map((row) => (
                <div key={row.id} className="grid grid-cols-[56px_1fr_82px_52px] items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-[12px]">
                  <span className="text-slate-500">{row.time}</span>
                  <span className={`font-semibold ${row.side === 'buy' ? 'text-emerald-300' : 'text-rose-300'}`}>{formatCurrency(row.price)}</span>
                  <span className="text-slate-300">{formatCompactNumber(row.volume)}</span>
                  <span className={`text-right font-medium ${row.side === 'buy' ? 'text-emerald-400' : 'text-rose-400'}`}>{row.side === 'buy' ? 'Mua' : 'Bán'}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Breadth mini-panel */}
          <BreadthMiniPanel marketGroups={overview.market_group_refs || []} symbol={normalizedSymbol} technicalBias={technicalBias} />

          {/* Technical snapshot */}
          <section className="card-section p-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <p className="text-label">Tóm tắt kỹ thuật</p>
                <h3 className="mt-1 text-base font-semibold text-white">Technical snapshot</h3>
                <p className="mt-1 text-[12px] text-slate-400">{technicalBias.description}</p>
              </div>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${technicalBias.className}`}>
                {technicalBias.label}
              </span>
            </div>

            <div className="mt-3 space-y-2 text-[12px]">
              <div className="flex items-center justify-between border-b border-slate-800/90 py-2 last:border-b-0">
                <span className="text-slate-500">SMA20</span>
                <span className="font-medium text-slate-100">{formatCurrency(technical?.sma20)}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-800/90 py-2 last:border-b-0">
                <span className="text-slate-500">SMA50</span>
                <span className="font-medium text-slate-100">{formatCurrency(technical?.sma50)}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-800/90 py-2 last:border-b-0">
                <span className="text-slate-500">RSI14</span>
                <span className="font-medium text-slate-100">{technical?.rsi14 ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-800/90 py-2 last:border-b-0">
                <span className="text-slate-500">KL TB 20</span>
                <span className="font-medium text-slate-100">{formatCompactNumber(technical?.avg_volume_20)}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-800/90 py-2 last:border-b-0">
                <span className="text-slate-500">Momentum 20d</span>
                <span className={`font-medium ${technical?.momentum_20d_pct >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {formatPercentDelta(technical?.momentum_20d_pct)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-500">Vị trí Range 52T</span>
                <span className="font-medium text-slate-100">{formatPercentDelta(technical?.range_position_pct)}</span>
              </div>
            </div>
          </section>

          {/* Personal context: watchlist memberships */}
          <section className="card-section p-4">
            <p className="text-label pb-3 border-b border-slate-800">Ngữ cảnh cá nhân</p>
            <div className="mt-3 space-y-2.5">
              <div className="card-compact">
                <p className="text-label">Shortlist</p>
                <p className={`mt-1 text-sm font-medium ${overview.is_tracked ? 'text-emerald-300' : 'text-slate-200'}`}>
                  {overview.is_tracked ? 'Đang theo dõi' : 'Chưa theo dõi'}
                </p>
              </div>
              {overview.watchlist_memberships.length > 0 ? (
                <div className="card-compact">
                  <p className="text-label">DS cá nhân ({overview.watchlist_memberships.length})</p>
                  <div className="mt-2 space-y-1.5">
                    {overview.watchlist_memberships.map((item) => (
                      <div key={item.item_id} className="flex items-center justify-between gap-2 rounded-lg border border-amber-900/30 bg-amber-950/10 px-2.5 py-1.5 text-[12px]">
                        <span className="font-medium text-amber-300">{item.group_name}</span>
                        <button
                          onClick={() => handleRemoveFromWatchlist(item.item_id, item.group_name)}
                          disabled={!!actionLoading}
                          className="text-[11px] font-semibold text-slate-300 transition-colors hover:text-white disabled:opacity-50"
                        >
                          {actionLoading === `watchlist-remove-${item.item_id}` ? 'Bỏ...' : 'Bỏ'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="card-compact">
                  <p className="text-label">DS cá nhân</p>
                  <p className="mt-1 text-slate-500">Chưa có trong danh sách nào.</p>
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>

      {/* S13-07: Signal Summary Panel */}
      {(symbolWhaleAlert || symbolAlerts.length > 0) && (
        <section className="card-section p-4">
          <p className="text-label border-b border-slate-800 pb-3 mb-4">Tín hiệu &amp; Cảnh báo — {normalizedSymbol}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Whale alert */}
            {symbolWhaleAlert && (
              <div className="rounded-xl border border-amber-700/40 bg-amber-950/20 px-4 py-3">
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
            )}

            {/* Active price alerts */}
            {symbolAlerts.length > 0 && symbolAlerts.map((alert, idx) => (
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
  );
}
