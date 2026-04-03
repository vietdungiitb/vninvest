import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getTrackedSymbols, getWhaleAdvisories } from '../api/client';
import { usePortfolio } from '../context/PortfolioContext';

function formatMoney(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString('vi-VN');
}

function formatTime(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString('vi-VN');
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

export default function WhaleAlertsHub() {
  const { ability, userPlan } = usePortfolio();
  const [trackedSymbols, setTrackedSymbols] = useState([]);
  const [advisories, setAdvisories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const canReadAdvisory = ability.can('read', 'WhaleAdvisory');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const trackedResult = await getTrackedSymbols();
      setTrackedSymbols(trackedResult.data || []);

      if (canReadAdvisory) {
        const advisoryResult = await getWhaleAdvisories();
        setAdvisories((advisoryResult.data || []).slice(0, 6));
      } else {
        setAdvisories([]);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Không tải được Whale Alerts hub.');
    } finally {
      setLoading(false);
    }
  }, [canReadAdvisory]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const symbolShortcuts = useMemo(() => buildTrackedSymbolBuckets(trackedSymbols), [trackedSymbols]);

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