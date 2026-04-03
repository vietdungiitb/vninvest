import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAggregateWhaleFeed, getTrackedSymbols, getWatchlistGroups, getWhaleAdvisories } from '../api/client';
import { usePortfolio } from '../context/PortfolioContext';

function formatMoney(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString('vi-VN');
}

function formatCompactMoney(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('vi-VN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(value));
}

function formatTime(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString('vi-VN');
}

function getSideTone(side) {
  const normalizedSide = String(side || '').toLowerCase();
  if (normalizedSide === 'buy') {
    return {
      container: 'border-emerald-800/60 bg-emerald-950/20',
      badge: 'bg-emerald-950/70 text-emerald-300',
      label: 'Mua lớn',
    };
  }
  if (normalizedSide === 'sell') {
    return {
      container: 'border-rose-800/60 bg-rose-950/20',
      badge: 'bg-rose-950/70 text-rose-300',
      label: 'Bán lớn',
    };
  }
  return {
    container: 'border-slate-800 bg-slate-950/70',
    badge: 'bg-slate-900 text-slate-300',
    label: 'Trung lập',
  };
}

function getSizeClassLabel(sizeClass) {
  if (sizeClass === 'shark') return 'Shark';
  if (sizeClass === 'whale') return 'Whale';
  return 'Large';
}

function getSeverityTone(severity) {
  const normalizedSeverity = String(severity || '').toLowerCase();
  if (normalizedSeverity === 'extreme') {
    return 'bg-rose-500 text-white';
  }
  if (normalizedSeverity === 'high') {
    return 'bg-amber-400 text-slate-950';
  }
  if (normalizedSeverity === 'medium') {
    return 'bg-cyan-400 text-slate-950';
  }
  return 'bg-slate-800 text-slate-200';
}

function getAggregateSourceMeta(source) {
  const normalizedSource = String(source || '').toLowerCase();
  if (normalizedSource === 'redis_stream') {
    return {
      label: 'Redis stream',
      tone: 'border-emerald-800/60 bg-emerald-950/30 text-emerald-200',
      description: 'Ưu tiên realtime stream mới nhất từ worker ingestion.',
    };
  }
  if (normalizedSource === 'intraday_tick_db') {
    return {
      label: 'IntradayTick DB',
      tone: 'border-cyan-900/60 bg-cyan-950/30 text-cyan-200',
      description: 'Fallback sang read model trong DB khi stream chưa có dữ liệu phù hợp.',
    };
  }
  if (normalizedSource === 'vnstock') {
    return {
      label: 'vnstock',
      tone: 'border-amber-800/60 bg-amber-950/30 text-amber-200',
      description: 'Fallback cuối cùng ra nguồn bên ngoài khi stream và DB đều trống.',
    };
  }
  return {
    label: 'Không xác định',
    tone: 'border-slate-800 bg-slate-950/70 text-slate-300',
    description: 'Chưa xác định được nguồn aggregate hiện tại.',
  };
}

function buildTrackedSymbolBuckets(trackedSymbols) {
  const unique = [];
  const seen = new Set();

  for (const item of trackedSymbols || []) {
    const symbol = String(item.symbol || '').trim().toUpperCase();
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);
    unique.push(symbol);
  }

  return unique;
}

function AdvisoryPreviewCard({ item }) {
  const side = String(item.side || '').toUpperCase();
  const isBuy = side === 'BUY';

  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link to={`/whale-alerts/${item.symbol}`} className="text-lg font-semibold text-slate-100 hover:text-cyan-300 transition-colors">
              {item.symbol}
            </Link>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              isBuy ? 'bg-emerald-950/50 text-emerald-300' : 'bg-rose-950/50 text-rose-300'
            }`}>
              {side || 'UNKNOWN'}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">{formatTime(item.created_at)}</p>
        </div>
        <div className="text-right text-xs text-slate-400">
          <p>{formatMoney(item.matched_value)} VND</p>
          <p className="mt-1">Ngưỡng: {formatMoney(item.threshold)} VND</p>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-300 line-clamp-3">
        {item.ai_summary || 'Chưa có tóm tắt AI.'}
      </p>
      <div className="mt-4 flex gap-2">
        <Link to={`/whale-alerts/${item.symbol}`} className="btn-secondary inline-flex items-center justify-center">
          Mở dashboard mã
        </Link>
        <Link to={`/stocks/${item.symbol}`} className="btn-secondary inline-flex items-center justify-center">
          Mở stock workspace
        </Link>
      </div>
    </article>
  );
}

function AggregateFeedCard({ item }) {
  const tone = getSideTone(item.side);
  const severityTone = getSeverityTone(item.severity);

  return (
    <Link
      to={`/whale-alerts/${item.symbol}`}
      className={`block rounded-2xl border p-4 transition-colors hover:border-cyan-700/60 ${tone.container}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-slate-100">{item.symbol}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${tone.badge}`}>
              {tone.label}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">{formatTime(item.ts)}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="rounded-full border border-slate-800 bg-slate-950/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
            {getSizeClassLabel(item.size_class)}
          </div>
          <div className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${severityTone}`}>
            {item.severity || 'low'}
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Giá trị khớp</p>
          <p className="mt-1 text-xl font-semibold text-slate-100">{formatCompactMoney(item.matched_value)} VND</p>
        </div>
        <div className="text-right text-xs text-slate-400">
          <p>Display score: {item.display_score ?? '—'}</p>
          <p>Ngưỡng: {formatCompactMoney(item.threshold)} VND</p>
          <p className="mt-1">Nguồn: {item.source || 'realtime'}</p>
        </div>
      </div>
    </Link>
  );
}

export default function WhaleAlertsHub() {
  const { ability, userPlan } = usePortfolio();
  const [trackedSymbols, setTrackedSymbols] = useState([]);
  const [watchlistGroups, setWatchlistGroups] = useState([]);
  const [advisories, setAdvisories] = useState([]);
  const [aggregateFeed, setAggregateFeed] = useState([]);
  const [aggregateCursor, setAggregateCursor] = useState(null);
  const [aggregateHasMore, setAggregateHasMore] = useState(false);
  const [aggregateLoadingMore, setAggregateLoadingMore] = useState(false);
  const [aggregateEntitlements, setAggregateEntitlements] = useState(null);
  const [aggregateFilters, setAggregateFilters] = useState(null);
  const [aggregateSource, setAggregateSource] = useState('');
  const [aggregateServerTime, setAggregateServerTime] = useState('');
  const [feedSort, setFeedSort] = useState('ts');
  const [selectedFeedScope, setSelectedFeedScope] = useState('tracked');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const canReadAdvisory = ability.can('read', 'WhaleAdvisory');

  const activeWatchlistGroupId = useMemo(() => {
    if (!selectedFeedScope.startsWith('watchlist:')) return null;
    const parsedId = Number(selectedFeedScope.split(':')[1]);
    return Number.isFinite(parsedId) ? parsedId : null;
  }, [selectedFeedScope]);

  const activeWatchlistGroup = useMemo(
    () => watchlistGroups.find((group) => group.id === activeWatchlistGroupId) || null,
    [activeWatchlistGroupId, watchlistGroups]
  );

  const loadAggregateFeed = useCallback(async ({ cursor = null, append = false, sort = feedSort, scope = selectedFeedScope } = {}) => {
    const watchlistGroupId = scope.startsWith('watchlist:') ? Number(scope.split(':')[1]) : null;
    const response = await getAggregateWhaleFeed({
      cursor,
      sort,
      limit: 12,
      watchlistGroupIds: Number.isFinite(watchlistGroupId) ? [watchlistGroupId] : undefined,
    });
    const payload = response.data || {};
    const nextItems = payload.results || [];

    setAggregateFeed((prev) => (append ? [...prev, ...nextItems] : nextItems));
    setAggregateCursor(payload.next_cursor || null);
    setAggregateHasMore(Boolean(payload.has_more));
    setAggregateEntitlements(payload.entitlements || null);
    setAggregateFilters(payload.filters || null);
    setAggregateSource(payload.source || '');
    setAggregateServerTime(payload.server_time || '');
  }, [feedSort, selectedFeedScope]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const requests = [
        getTrackedSymbols(),
        getWatchlistGroups(),
        loadAggregateFeed({ cursor: null, append: false, sort: feedSort, scope: selectedFeedScope }),
      ];

      if (canReadAdvisory) {
        requests.push(getWhaleAdvisories());
      }

      const [trackedResult, watchlistGroupsResult, _aggregateResult, advisoryResult] = await Promise.all(requests);
      setTrackedSymbols(trackedResult.data || []);
      setWatchlistGroups(watchlistGroupsResult.data || []);
      setAdvisories(canReadAdvisory ? (advisoryResult.data || []).slice(0, 6) : []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Không tải được Whale Alerts hub.');
    } finally {
      setLoading(false);
    }
  }, [canReadAdvisory, feedSort, loadAggregateFeed, selectedFeedScope]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const symbolShortcuts = useMemo(() => buildTrackedSymbolBuckets(trackedSymbols), [trackedSymbols]);

  const handleLoadMore = useCallback(async () => {
    if (!aggregateHasMore || !aggregateCursor) return;

    setAggregateLoadingMore(true);
    try {
      await loadAggregateFeed({ cursor: aggregateCursor, append: true, sort: feedSort, scope: selectedFeedScope });
    } catch (err) {
      setError(err.response?.data?.detail || 'Không tải thêm được aggregate whale feed.');
    } finally {
      setAggregateLoadingMore(false);
    }
  }, [aggregateCursor, aggregateHasMore, feedSort, loadAggregateFeed, selectedFeedScope]);

  const handleSortChange = useCallback((nextSort) => {
    if (nextSort === feedSort) return;
    setFeedSort(nextSort);
  }, [feedSort]);

  const scopeLabel = useMemo(() => {
    if (aggregateFilters?.scope === 'watchlist' && activeWatchlistGroup) {
      return `watchlist: ${activeWatchlistGroup.name}`;
    }
    return 'tracked symbols';
  }, [activeWatchlistGroup, aggregateFilters?.scope]);

  const aggregateSourceMeta = useMemo(() => getAggregateSourceMeta(aggregateSource), [aggregateSource]);

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 p-4 xl:px-5">
      <section className="card-section px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-label">Whale radar hub</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-100">Whale Alerts Workspace</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-400">
              Điểm vào chung cho toàn bộ luồng whale signal. Từ đây có thể mở dashboard chuyên sâu theo mã,
              quay lại radar thị trường, hoặc xem AI Advisory nếu gói hiện tại cho phép.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-cyan-900/60 bg-cyan-950/30 px-3 py-1.5 text-xs text-cyan-200">
              Gói hiện tại: {userPlan || 'free'}
            </div>
            <button type="button" onClick={fetchData} className="btn-primary">
              Làm mới
            </button>
          </div>
        </div>
      </section>

      <section className="card-section px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-label">Aggregate feed</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-100">Live whale board</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Bảng tổng hợp tín hiệu whale theo danh sách mã đang theo dõi. Nguồn dữ liệu chạy theo thứ tự
              Redis stream, sau đó fallback về IntradayTick trong DB, và cuối cùng mới dùng vnstock nếu hai tầng nội bộ chưa có dữ liệu.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Scope</span>
              <select
                value={selectedFeedScope}
                onChange={(event) => setSelectedFeedScope(event.target.value)}
                className="min-w-[180px] bg-transparent px-2 py-1 text-sm text-slate-200 outline-none"
              >
                <option value="tracked">Tracked symbols</option>
                {watchlistGroups.map((group) => (
                  <option key={group.id} value={`watchlist:${group.id}`}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/70 p-1">
              <button
                type="button"
                onClick={() => handleSortChange('ts')}
                className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                  feedSort === 'ts' ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:text-slate-100'
                }`}
              >
                Mới nhất
              </button>
              <button
                type="button"
                onClick={() => handleSortChange('matched_value')}
                className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                  feedSort === 'matched_value' ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:text-slate-100'
                }`}
              >
                Giá trị lớn nhất
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-400">
          <div className="rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1.5">
            Scope: {loading ? 'đang tải' : scopeLabel}
          </div>
          <div className={`rounded-full border px-3 py-1.5 ${aggregateSourceMeta.tone}`}>
            Nguồn feed: {loading ? 'đang tải' : aggregateSourceMeta.label}
          </div>
          <div className="rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1.5">
            Advisory summary: {aggregateEntitlements?.can_read_whale_advisory ? 'Pro+' : 'chưa mở'}
          </div>
          <div className="rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1.5">
            Advisory detail: {aggregateEntitlements?.can_read_whale_advisory_detail ? 'Premium+' : 'chưa mở'}
          </div>
          <div className="rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1.5">
            Weights: {aggregateFilters?.scope ? aggregateFeed[0]?.weights_version || 'weights-v1' : 'đang tải'}
          </div>
          <div className="rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1.5">
            Server time: {aggregateServerTime ? formatTime(aggregateServerTime) : 'đang tải'}
          </div>
        </div>

        {!loading && (
          <div className="mt-3 text-xs text-slate-500">
            {aggregateSourceMeta.description}
          </div>
        )}

        {loading ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="h-40 animate-pulse rounded-2xl bg-slate-900" />
            ))}
          </div>
        ) : aggregateFeed.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-800 px-4 py-5 text-sm text-slate-500">
            Chưa có whale event vượt ngưỡng trong danh sách mã đang theo dõi. Khi backend detect thêm lệnh lớn,
            aggregate board này sẽ là điểm vào nhanh nhất trước khi mở dashboard theo mã.
          </div>
        ) : (
          <>
            <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {aggregateFeed.map((item) => (
                <AggregateFeedCard key={item.event_id} item={item} />
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                Đang hiển thị {aggregateFeed.length} tín hiệu gần nhất cho scope hiện tại từ {aggregateSourceMeta.label.toLowerCase()}.
              </div>
              {aggregateHasMore && (
                <button type="button" onClick={handleLoadMore} disabled={aggregateLoadingMore} className="btn-secondary">
                  {aggregateLoadingMore ? 'Đang tải thêm...' : 'Tải thêm'}
                </button>
              )}
            </div>
          </>
        )}
      </section>

      {error && (
        <section className="rounded-2xl border border-rose-800/60 bg-rose-950/20 px-5 py-4 text-sm text-rose-200">
          {error}
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <article className="card-section px-5 py-4">
          <p className="text-label">Đi tắt theo mã</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-100">Các mã đang theo dõi</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Mỗi nút mở WhaleAlertsDashboard cho đúng mã, nơi hiển thị feed lệnh lớn, money flow, RVOL và depth chart.
          </p>

          {loading ? (
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[...Array(8)].map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-xl bg-slate-900" />
              ))}
            </div>
          ) : symbolShortcuts.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-800 px-4 py-5 text-sm text-slate-500">
              Chưa có mã tracked riêng. Có thể thêm mã trong Radar thị trường rồi quay lại đây để mở nhanh Whale Alerts dashboard.
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
              {symbolShortcuts.map((symbol) => (
                <Link
                  key={symbol}
                  to={`/whale-alerts/${symbol}`}
                  className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-center text-sm font-semibold text-slate-200 transition-colors hover:border-cyan-700/70 hover:text-cyan-200"
                >
                  {symbol}
                </Link>
              ))}
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/watchlist" className="btn-secondary inline-flex items-center justify-center">
              Mở Radar thị trường
            </Link>
            <Link to="/dashboard" className="btn-secondary inline-flex items-center justify-center">
              Về Tổng quan
            </Link>
          </div>
        </article>

        <article className="card-section px-5 py-4">
          <p className="text-label">Phạm vi tính năng</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-100">Whale Alerts đang gồm gì</h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
              Dashboard theo mã: feed lệnh lớn, donut money flow, bubble chart, RVOL 15 phút và depth chart.
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
              Realtime: WebSocket báo whale alert mới, REST làm nguồn snapshot đầy đủ cho biểu đồ.
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
              AI Advisory: luồng riêng cho Pro/Premium, dùng để đọc tóm tắt và phân tích sâu sau khi hệ thống tạo advisory.
            </div>
          </div>
        </article>
      </section>

      <section className="card-section px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-label">AI advisory gần đây</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-100">Recent whale intelligence</h2>
          </div>
          {canReadAdvisory && (
            <Link to="/whale-advisory" className="btn-secondary inline-flex items-center justify-center">
              Mở AI Advisory feed
            </Link>
          )}
        </div>

        {!canReadAdvisory ? (
          <div className="mt-4 rounded-2xl border border-amber-800/60 bg-amber-950/20 px-4 py-5 text-sm leading-6 text-amber-100">
            Gói hiện tại chưa mở AI Advisory. Anh vẫn có thể dùng WhaleAlertsDashboard theo mã để theo dõi feed whale và biểu đồ realtime.
          </div>
        ) : loading ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="h-40 animate-pulse rounded-2xl bg-slate-900" />
            ))}
          </div>
        ) : advisories.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-800 px-4 py-5 text-sm text-slate-500">
            Chưa có advisory mới. Advisory chỉ xuất hiện sau khi backend phát hiện whale signal và Celery task AI hoàn tất.
          </div>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {advisories.map((item) => (
              <AdvisoryPreviewCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}