import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getWhaleAdvisories } from '../api/client';
import { usePortfolio } from '../context/PortfolioContext';
import Can from '../components/Can';

function fmtCurrency(value) {
  return Number(value || 0).toLocaleString('vi-VN');
}

function fmtCompact(value) {
  const n = Number(value || 0);
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}T`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString('vi-VN');
}

function fmtTime(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('vi-VN');
}

// ─── Thống kê mỗi mã ────────────────────────────────────────────
function buildSymbolStats(items) {
  const map = {};
  for (const item of items) {
    const sym = item.symbol;
    if (!map[sym]) {
      map[sym] = { symbol: sym, buyCount: 0, sellCount: 0, totalValue: 0, count: 0 };
    }
    const side = (item.side || '').toUpperCase();
    if (side === 'BUY') map[sym].buyCount += 1;
    else if (side === 'SELL') map[sym].sellCount += 1;
    map[sym].totalValue += Number(item.matched_value || 0);
    map[sym].count += 1;
  }
  return Object.values(map).sort((a, b) => b.count - a.count);
}

// ─── Ô cột trái: thông tin mã ──────────────────────────────────
function SymbolCell({ stats, isActive, onClick }) {
  const avgValue = stats.count > 0 ? stats.totalValue / stats.count : 0;
  const totalOrders = stats.buyCount + stats.sellCount;
  const buyRatio = totalOrders > 0 ? (stats.buyCount / totalOrders) * 100 : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-4 transition-colors ${
        isActive
          ? 'bg-cyan-950/40 border-l-2 border-cyan-400'
          : 'hover:bg-slate-800/60 border-l-2 border-transparent'
      }`}
    >
      {/* Tên mã */}
      <p className={`text-sm font-bold ${isActive ? 'text-cyan-300' : 'text-slate-100'}`}>
        {stats.symbol}
      </p>

      {/* Số lệnh mua/bán */}
      <div className="mt-1.5 flex flex-wrap gap-3 text-xs">
        <span className="flex items-center gap-1 text-emerald-400">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Mua: {stats.buyCount}
        </span>
        <span className="flex items-center gap-1 text-rose-400">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-400" />
          Bán: {stats.sellCount}
        </span>
      </div>

      {/* Bar mua/bán */}
      {totalOrders > 0 && (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-rose-900/60">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${buyRatio}%` }}
          />
        </div>
      )}

      {/* Giá trị trung bình */}
      <p className="mt-2 text-xs text-slate-400">
        Avg: <span className="font-medium text-slate-200">{fmtCompact(avgValue)} VND</span>
      </p>
      <p className="mt-0.5 text-xs text-slate-500">
        Tổng {stats.count} lệnh lớn
      </p>
    </button>
  );
}

// ─── Ô cột phải: AI Advisory tương ứng ────────────────────────
function AdvisoryCell({ item }) {
  const side = (item.side || '').toUpperCase();
  const isBuy = side === 'BUY';

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
            isBuy ? 'bg-emerald-900/60 text-emerald-300' : 'bg-rose-900/60 text-rose-300'
          }`}>
            {side || 'UNKNOWN'}
          </span>
          <span className="text-xs font-semibold text-slate-100">
            {fmtCompact(item.matched_value)} VND
          </span>
        </div>
        <div className="flex flex-col items-end gap-0.5 text-[11px] text-slate-500">
          <span>{fmtTime(item.created_at)}</span>
          <span className="uppercase tracking-widest">{item.ai_provider || 'openclaw'}</span>
        </div>
      </div>

      {/* AI Summary */}
      <p className="mt-3 text-xs leading-6 text-slate-300 line-clamp-3">
        {item.ai_summary || 'Chưa có tóm tắt AI.'}
      </p>

      {/* AI Detail (Premium) */}
      <Can
        I="read"
        a="WhaleAdvisoryDetail"
        fallback={
          <Link
            to="/upgrade"
            className="mt-2 inline-flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300"
          >
            🔒 Phân tích sâu (Premium+)
          </Link>
        }
      >
        {item.ai_detail ? (
          <p className="mt-2 text-xs leading-6 text-slate-400 line-clamp-2 border-t border-slate-800 pt-2">
            {item.ai_detail}
          </p>
        ) : null}
      </Can>

      {/* Liên kết nhanh */}
      <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-800 pt-3">
        <Link
          to={`/whale-alerts/${item.symbol}`}
          className="btn-secondary inline-flex items-center justify-center text-[11px]"
        >
          Mở dashboard mã
        </Link>
        <Link
          to={`/stocks/${item.symbol}`}
          className="btn-secondary inline-flex items-center justify-center text-[11px]"
        >
          Mở stock workspace
        </Link>
      </div>
    </div>
  );
}

// ─── Hàng của bảng ────────────────────────────────────────────
function TableRow({ stats, allItems, isFirst, isLast }) {
  const symbolItems = allItems.filter(i => i.symbol === stats.symbol);
  // Lấy advisory mới nhất của mã này
  const latest = symbolItems[0] || null;

  return (
    <div className={`grid grid-cols-[220px_1fr] divide-x divide-slate-800 ${
      isFirst ? '' : 'border-t border-slate-800'
    }`}>
      {/* Cột trái */}
      <div className="flex items-start">
        <SymbolCell stats={stats} isActive={false} onClick={() => {}} />
      </div>

      {/* Cột phải */}
      <div>
        {latest ? (
          <AdvisoryCell item={latest} />
        ) : (
          <div className="flex h-full items-center p-4 text-xs text-slate-600">
            Chưa có advisory.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────
export default function WhaleAdvisory() {
  const { userPlan } = usePortfolio();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getWhaleAdvisories();
      setItems(response.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Không tải được danh sách AI advisory.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const symbolStats = useMemo(() => buildSymbolStats(items), [items]);

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 p-4 xl:px-5">
      {/* Header */}
      <section className="card-section px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-label">Whale intelligence</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-100">AI Advisory Feed</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Mỗi hàng là một mã chứng khoán. Cột trái: thống kê lệnh mua/bán lớn.
              Cột phải: AI Advisory mới nhất. Gói hiện tại:{' '}
              <span className="font-semibold text-cyan-300">{userPlan || 'free'}</span>.
            </p>
          </div>
          <button type="button" onClick={fetchData} className="btn-primary">
            Làm mới
          </button>
        </div>
      </section>

      {error && (
        <section className="rounded-2xl border border-rose-800/60 bg-rose-950/20 px-5 py-4 text-sm text-rose-200">
          {error}
        </section>
      )}

      {/* Bảng */}
      <section className="card-section overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[220px_1fr] divide-x divide-slate-800 border-b border-slate-700 bg-slate-900/70">
          <div className="px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Mã / Thống kê
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              AI Advisory gần nhất
            </p>
          </div>
        </div>

        {/* Rows */}
        {loading ? (
          <div>
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={`grid grid-cols-[220px_1fr] divide-x divide-slate-800 ${
                  i > 0 ? 'border-t border-slate-800' : ''
                }`}
              >
                <div className="p-4">
                  <div className="h-4 w-16 animate-pulse rounded bg-slate-800" />
                  <div className="mt-2 h-3 w-24 animate-pulse rounded bg-slate-800" />
                  <div className="mt-1 h-3 w-20 animate-pulse rounded bg-slate-800" />
                </div>
                <div className="p-4">
                  <div className="h-4 w-32 animate-pulse rounded bg-slate-800" />
                  <div className="mt-2 h-12 animate-pulse rounded bg-slate-800" />
                </div>
              </div>
            ))}
          </div>
        ) : symbolStats.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-slate-400">Chưa có advisory nào được tạo.</p>
            <p className="mt-2 text-xs text-slate-600">
              Advisory xuất hiện sau khi backend ghi nhận whale signal và task OpenClaw hoàn tất.
            </p>
          </div>
        ) : (
          <div>
            {symbolStats.map((stats, idx) => {
              const latest = items.find(i => i.symbol === stats.symbol) || null;

              return (
                <div key={stats.symbol} className={`grid grid-cols-[220px_1fr] divide-x divide-slate-800 ${idx > 0 ? 'border-t border-slate-800' : ''}`}>
                  {/* Cột trái */}
                  <div>
                    <SymbolCell stats={stats} isActive={false} onClick={() => {}} />
                  </div>

                  {/* Cột phải: Advisory mới nhất */}
                  <div>
                    {latest ? (
                      <AdvisoryCell item={latest} />
                    ) : (
                      <div className="flex items-center p-4 text-xs text-slate-600">
                        Chưa có advisory.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
