import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getWhaleAdvisories } from '../api/client';
import { usePortfolio } from '../context/PortfolioContext';
import Can from '../components/Can';

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('vi-VN');
}

function formatTime(value) {
  if (!value) {
    return 'Khong ro';
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('vi-VN');
}

function AdvisoryCard({ item }) {
  const side = (item.side || '').toUpperCase();
  const isBuy = side === 'BUY';

  return (
    <article className="card-section overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-semibold text-slate-100">{item.symbol}</span>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              isBuy
                ? 'bg-emerald-950/50 text-emerald-300'
                : 'bg-rose-950/50 text-rose-300'
            }`}>
              {side || 'UNKNOWN'}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-400">
            Khop {formatCurrency(item.matched_value)} VND
          </p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <p>{formatTime(item.created_at)}</p>
          <p className="mt-1 uppercase tracking-[0.2em]">{item.ai_provider || 'openclaw'}</p>
        </div>
      </div>

      <div className="grid gap-4 px-5 py-4 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-2xl border border-cyan-900/60 bg-cyan-950/20 p-4">
          <p className="text-label">Tom tat AI</p>
          <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-200">{item.ai_summary || 'Chua co tom tat.'}</p>
        </section>

        <Can
          I="read"
          a="WhaleAdvisoryDetail"
          fallback={(
            <section className="rounded-2xl border border-amber-800/60 bg-amber-950/20 p-4">
              <p className="text-label text-amber-400">Phan tich sau</p>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Noi dung chi tiet chi mo cho goi Premium tro len. Ban van nhan duoc tom tat AI de loc nhanh cac whale signal quan trong.
              </p>
              <Link
                to="/upgrade"
                className="btn-accent mt-4 inline-flex items-center justify-center"
              >
                Nang cap de xem chi tiet
              </Link>
            </section>
          )}
        >
          <section className="rounded-2xl border border-slate-800 bg-slate-950/65 p-4">
            <p className="text-label">Phan tich sau</p>
            <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-200">{item.ai_detail || 'Chua co phan tich chi tiet.'}</p>
          </section>
        </Can>
      </div>
    </article>
  );
}

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
      setError(err.response?.data?.detail || 'Khong tai duoc danh sach AI advisory.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 p-4 xl:px-5">
      <section className="card-section px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-label">Whale intelligence</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-100">AI Advisory Feed</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-400">
              Tong hop cac phan tich AI duoc tao tu whale signal gan day. Goi hien tai cua ban la {userPlan || 'free'}.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/watchlist" className="btn-secondary inline-flex items-center justify-center">
              Ve radar
            </Link>
            <button type="button" onClick={fetchData} className="btn-primary">
              Lam moi
            </button>
          </div>
        </div>
      </section>

      {error && (
        <section className="rounded-2xl border border-rose-800/60 bg-rose-950/20 px-5 py-4 text-sm text-rose-200">
          {error}
        </section>
      )}

      {loading ? (
        <section className="card-section px-5 py-10 text-center text-sm text-slate-500">
          Dang tai AI advisory...
        </section>
      ) : items.length === 0 ? (
        <section className="card-section px-5 py-10 text-center">
          <p className="text-sm text-slate-400">Chua co advisory nao duoc tao.</p>
          <p className="mt-2 text-xs text-slate-600">
            Advisory se xuat hien sau khi backend ghi nhan whale signal va task OpenClaw hoan tat.
          </p>
        </section>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <AdvisoryCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}