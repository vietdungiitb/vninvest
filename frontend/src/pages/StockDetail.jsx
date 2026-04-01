import React, { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
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

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900/95 px-4 py-3 shadow-2xl">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-blue-300">{formatCurrency(payload[0].value)}</p>
    </div>
  );
}

function StatBox({ label, value, subValue, accentClass = 'text-gray-100' }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/80 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-gray-500">{label}</p>
      <p className={`mt-2 text-lg font-semibold ${accentClass}`}>{value}</p>
      {subValue ? <p className="mt-1 text-xs text-gray-500">{subValue}</p> : null}
    </div>
  );
}

function biasMeta(bias) {
  if (bias === 'BULLISH') {
    return {
      label: 'Bullish',
      className: 'border-emerald-700 bg-emerald-950/40 text-emerald-300',
      description: 'Gia dang nam tren SMA20 va SMA50, dong luong duy tri tich cuc.',
    };
  }
  if (bias === 'WEAK') {
    return {
      label: 'Weak',
      className: 'border-red-700 bg-red-950/40 text-red-300',
      description: 'Gia dang nam duoi cac duong trung binh va dong luong yeu.',
    };
  }
  return {
    label: 'Neutral',
    className: 'border-gray-700 bg-gray-900/70 text-gray-300',
    description: 'Cau truc gia chua nghieng ro theo mot huong manh.',
  };
}

function formatPercentDelta(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  const numericValue = Number(value);
  return `${numericValue > 0 ? '+' : ''}${numericValue.toFixed(2)}%`;
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

  const { quotesBySymbol, realtimeStatus, lastEventAt } = useRealtimeFeed({
    symbols: normalizedSymbol ? [normalizedSymbol] : [],
  });

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
  }, [normalizedSymbol]);

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
      return 'text-red-400';
    }
    return 'text-gray-400';
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

  const technicalBias = biasMeta(technical?.bias);
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
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="h-52 animate-pulse rounded-[28px] bg-gray-900" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-2xl bg-gray-900" />
          ))}
        </div>
        <div className="h-[420px] animate-pulse rounded-[28px] bg-gray-900" />
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="rounded-[28px] border border-red-900/70 bg-red-950/30 p-8 text-center">
          <p className="text-sm font-semibold text-red-300">Không mở được workspace mã</p>
          <p className="mt-2 text-sm text-gray-400">{error || `Không tìm thấy dữ liệu cho ${normalizedSymbol}.`}</p>
          <Link to="/watchlist" className="mt-4 inline-flex rounded-full border border-gray-700 px-4 py-2 text-sm text-gray-200 transition-colors hover:border-gray-500 hover:text-white">
            Quay lại Radar thị trường
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <section className="overflow-hidden rounded-[28px] border border-gray-800 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_32%),linear-gradient(135deg,_rgba(15,23,42,0.96),_rgba(3,7,18,0.98))]">
        <div className="flex flex-wrap items-start justify-between gap-6 p-6 lg:p-8">
          <div className="max-w-3xl space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.22em] text-gray-500">
              <Link to="/watchlist" className="transition-colors hover:text-gray-300">
                Radar thị trường
              </Link>
              <span>/</span>
              <span>Stock workspace</span>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-500/30 bg-blue-500/10 text-2xl font-bold text-blue-300">
                {overview.symbol}
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white">{overview.company_name || overview.symbol}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-400">
                  <span>{overview.exchange || 'Chưa rõ sàn'}</span>
                  <span className="text-gray-700">•</span>
                  <span>{overview.industry || 'Chưa rõ ngành'}</span>
                  {overview.listed_date ? (
                    <>
                      <span className="text-gray-700">•</span>
                      <span>Niêm yết từ {overview.listed_date}</span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-4">
              <div>
                <p className="text-sm text-gray-500">Giá hiện tại</p>
                <div className="mt-1 flex flex-wrap items-end gap-3">
                  <span className="text-4xl font-semibold text-white">{formatCurrency(currentPrice)}</span>
                  <span className={`pb-1 text-sm font-semibold ${changeClass}`}>
                    {changeValue > 0 ? '+' : ''}{changeValue !== null && changeValue !== undefined ? formatCurrency(Math.abs(changeValue)).replace('₫', '').trim() : '—'}
                    {' · '}
                    {formatPercent(changePct)}
                  </span>
                </div>
              </div>
              <div className="rounded-full border border-gray-700 bg-gray-900/70 px-4 py-2 text-xs text-gray-400">
                Feed: {realtimeStatus === 'live' ? 'Realtime' : realtimeStatus === 'polling' ? 'Fallback polling' : 'Đang kết nối'}
                {lastEventAt ? ` · Sự kiện cuối ${new Date(lastEventAt).toLocaleTimeString('vi-VN')}` : ''}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${overview.is_tracked ? 'border-emerald-700 bg-emerald-950/40 text-emerald-300' : 'border-gray-700 bg-gray-900/70 text-gray-400'}`}>
                {overview.is_tracked ? 'Đang có trong shortlist' : 'Chưa có trong shortlist'}
              </span>
              {overview.source_group_name ? (
                <span className="rounded-full border border-blue-800 bg-blue-950/30 px-3 py-1 text-xs font-semibold text-blue-300">
                  Nguồn thêm: {overview.source_group_name}
                </span>
              ) : null}
              {overview.market_groups.map((groupName) => (
                <span key={groupName} className="rounded-full border border-gray-700 bg-gray-900/70 px-3 py-1 text-xs text-gray-300">
                  Nhóm thị trường: {groupName}
                </span>
              ))}
              {overview.watchlist_groups.map((groupName) => (
                <span key={groupName} className="rounded-full border border-amber-800 bg-amber-950/30 px-3 py-1 text-xs text-amber-300">
                  DS cá nhân: {groupName}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-3">
              <button
                onClick={handleToggleTracked}
                disabled={!!actionLoading}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${overview.is_tracked ? 'bg-gray-100 text-gray-900 hover:bg-white' : 'bg-blue-600 text-white hover:bg-blue-500'} disabled:opacity-50`}
              >
                {actionLoading === 'tracked'
                  ? 'Đang cập nhật...'
                  : overview.is_tracked ? 'Bỏ khỏi shortlist' : 'Đưa vào shortlist'}
              </button>
              <div className="flex flex-wrap items-center gap-2 rounded-full border border-gray-700 bg-gray-900/70 p-1.5">
                <select
                  value={selectedWatchlistGroupId}
                  onChange={(event) => setSelectedWatchlistGroupId(event.target.value)}
                  className="bg-transparent px-3 py-1.5 text-sm text-gray-200 outline-none"
                >
                  {availableWatchlistGroups.length === 0 ? (
                    <option value="">Khong con danh sach nao de them</option>
                  ) : availableWatchlistGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAddToWatchlist}
                  disabled={!!actionLoading || availableWatchlistGroups.length === 0}
                  className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-gray-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
                >
                  {actionLoading === 'watchlist-add' ? 'Đang thêm...' : 'Thêm vào DS cá nhân'}
                </button>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-gray-700 bg-gray-900/70 p-1.5">
                <input
                  value={alertTargetPrice}
                  onChange={(event) => setAlertTargetPrice(event.target.value)}
                  placeholder="Mức giá cảnh báo"
                  className="w-36 bg-transparent px-3 py-1.5 text-sm text-gray-100 outline-none placeholder:text-gray-600"
                />
                <button
                  onClick={handleCreateAlert}
                  disabled={!!actionLoading}
                  className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
                >
                  {actionLoading === 'alert' ? 'Đang tạo...' : 'Tạo alert'}
                </button>
              </div>
            </div>
            {workspaceMessage ? <p className="text-sm text-emerald-300">{workspaceMessage}</p> : null}
            {workspaceError ? <p className="text-sm text-red-300">{workspaceError}</p> : null}
          </div>

          <div className="grid min-w-[280px] grid-cols-1 gap-3 sm:grid-cols-2">
            <StatBox label="Giá tham chiếu" value={formatCurrency(overview.reference_price)} subValue={`Trần ${formatCurrency(overview.ceiling_price)} · Sàn ${formatCurrency(overview.floor_price)}`} />
            <StatBox label="Biên độ phiên gần nhất" value={`${formatCurrency(overview.low_price)} → ${formatCurrency(overview.high_price)}`} subValue={`Mở ${formatCurrency(overview.open_price)} · Đóng ${formatCurrency(overview.close_price)}`} />
            <StatBox label="Khối lượng" value={formatCompactNumber(overview.volume)} subValue={`Giá bình quân gần đúng ${formatCurrency(overview.average_price)}`} />
            <StatBox label="Range 52 tuần" value={`${formatCurrency(overview.week52_low)} → ${formatCurrency(overview.week52_high)}`} subValue={`Cập nhật giá cuối ${overview.last_date || '—'}`} />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.95fr)]">
        <section className="rounded-[28px] border border-gray-800 bg-gray-900/80 p-5 lg:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-gray-500">EOD price map</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Diễn biến giá theo khung {activePeriod} ngày</h2>
              {chartPerformance !== null ? (
                <p className={`mt-2 text-sm font-medium ${chartPerformance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {chartPerformance >= 0 ? '+' : ''}{chartPerformance.toFixed(2)}% trong khung đang xem
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-1 rounded-full border border-gray-800 bg-gray-950/80 p-1">
              {PERIODS.map((period) => (
                <button
                  key={period}
                  onClick={() => setActivePeriod(period)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${activePeriod === period ? 'bg-blue-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                >
                  {period >= 365 ? '1N' : `${Math.round(period / 30)}T`}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 h-[360px]">
            {loadingChart ? (
              <div className="h-full animate-pulse rounded-2xl bg-gray-950" />
            ) : chartData.length < 2 ? (
              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-gray-800 text-sm text-gray-500">
                Chưa đủ dữ liệu giá EOD để dựng chart cho khung này.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="stockDetailArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6b7280', fontSize: 11 }}
                    tickFormatter={(value) => {
                      const dateValue = new Date(value);
                      return `${dateValue.getDate()}/${dateValue.getMonth() + 1}`;
                    }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6b7280', fontSize: 11 }}
                    tickFormatter={formatChartAxis}
                    width={64}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="close"
                    stroke="#60a5fa"
                    strokeWidth={2}
                    fill="url(#stockDetailArea)"
                    dot={false}
                    activeDot={{ r: 4, fill: '#93c5fd', strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-[28px] border border-gray-800 bg-gray-900/80 p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-gray-500">Workspace context</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Cách mã này đang được theo dõi</h2>
            <div className="mt-5 space-y-4 text-sm">
              <div>
                <p className="text-gray-500">Shortlist tổng hợp</p>
                <p className="mt-1 font-medium text-gray-100">
                  {overview.is_tracked ? 'Đang hiện diện trong danh sách theo dõi tổng hợp.' : 'Chưa được đưa vào danh sách theo dõi tổng hợp.'}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Nhóm thị trường liên quan</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {overview.market_groups.length > 0 ? overview.market_groups.map((groupName) => (
                    <span key={groupName} className="rounded-full border border-gray-700 px-3 py-1 text-xs text-gray-300">
                      {groupName}
                    </span>
                  )) : <span className="text-gray-600">Chưa nằm trong nhóm thị trường nào của bạn.</span>}
                </div>
              </div>
              <div>
                <p className="text-gray-500">Danh sách theo dõi cá nhân</p>
                <div className="mt-2 flex flex-col gap-2">
                  {overview.watchlist_memberships.length > 0 ? overview.watchlist_memberships.map((item) => (
                    <div key={item.item_id} className="flex items-center justify-between rounded-2xl border border-amber-900/40 bg-amber-950/10 px-3 py-2">
                      <span className="text-xs text-amber-300">{item.group_name}</span>
                      <button
                        onClick={() => handleRemoveFromWatchlist(item.item_id, item.group_name)}
                        disabled={!!actionLoading}
                        className="text-xs font-semibold text-gray-300 transition-colors hover:text-white disabled:opacity-50"
                      >
                        {actionLoading === `watchlist-remove-${item.item_id}` ? 'Đang bỏ...' : 'Bỏ khỏi danh sách'}
                      </button>
                    </div>
                  )) : <span className="text-gray-600">Chưa có trong danh sách theo dõi cá nhân nào.</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-gray-800 bg-gray-900/80 p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-gray-500">Technical snapshot</p>
            <div className="mt-2 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-white">Tóm tắt kỹ thuật phase 1</h2>
                <p className="mt-2 text-sm text-gray-400">{technicalBias.description}</p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${technicalBias.className}`}>
                {technicalBias.label}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <StatBox label="SMA20" value={formatCurrency(technical?.sma20)} subValue={`Gia vs SMA20: ${formatPercentDelta(technical?.price_vs_sma20_pct)}`} />
              <StatBox label="SMA50" value={formatCurrency(technical?.sma50)} subValue={`Gia vs SMA50: ${formatPercentDelta(technical?.price_vs_sma50_pct)}`} />
              <StatBox label="RSI14" value={technical?.rsi14 ?? '—'} subValue="Muc can bang dong luong ngan han" />
              <StatBox label="Avg volume 20" value={formatCompactNumber(technical?.avg_volume_20)} subValue={`Dong luong 20 phien: ${formatPercentDelta(technical?.momentum_20d_pct)} momentum`} />
              <StatBox label="Vi tri range 52T" value={formatPercentDelta(technical?.range_position_pct)} subValue={`Latest close: ${formatCurrency(technical?.latest_close)}`} />
            </div>
          </div>

          <div className="rounded-[28px] border border-gray-800 bg-gray-900/80 p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-gray-500">Data note</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Giới hạn của foundation phase</h2>
            <div className="mt-4 space-y-3 text-sm text-gray-400">
              <p>Trang này đang dùng gia realtime de overlay gia hien tai va dung chuoi EOD de ve chart nen tang.</p>
              <p>Order book, time and sales, intraday breadth va depth chart chua duoc mo o phase nay vi can data vendor rieng va contract feed chi tiet hon.</p>
              <p>Foundation hien tai du de di tiep sang stock technical workspace o phase ke tiep ma khong phai pha lai route hay API.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}