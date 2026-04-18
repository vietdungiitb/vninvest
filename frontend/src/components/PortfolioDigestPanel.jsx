import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getPortfolioNewsDigest } from '../api/client';
import { useI18n } from '../context/LangContext';

const POLL_INTERVAL_MS = 10 * 60 * 1000; // 10 phút
const PAGE_SIZE_OPTIONS = [5, 10, 15];

export default function PortfolioDigestPanel() {
  const { t, formatDateTime } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [digest, setDigest] = useState(null);
  const [pageSize, setPageSize] = useState(5);
  const [page, setPage] = useState(0);

  const fetchDigest = useCallback(async () => {
    try {
      const res = await getPortfolioNewsDigest();
      setDigest(res?.data || null);
      setError('');
      setPage(0);
    } catch (err) {
      setError(err?.response?.data?.detail || t('portfolioDigest.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    let alive = true;
    const run = async () => { if (!alive) return; await fetchDigest(); };
    run();
    const timer = window.setInterval(run, POLL_INTERVAL_MS);
    return () => { alive = false; window.clearInterval(timer); };
  }, [fetchDigest]);

  // Tách digest_full thành danh sách dòng tin tức (bỏ dòng trống)
  const digestLines = useMemo(() => {
    const text = digest?.digest_full || '';
    return text.split('\n').map((l) => l.trim()).filter(Boolean);
  }, [digest]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(digestLines.length / pageSize)), [digestLines.length, pageSize]);
  const pagedLines = useMemo(() => digestLines.slice(page * pageSize, page * pageSize + pageSize), [digestLines, page, pageSize]);

  const symbolsText = useMemo(() => {
    const list = digest?.symbols;
    if (!Array.isArray(list) || list.length === 0) return '-';
    return list.join(', ');
  }, [digest]);

  const handlePageSizeChange = (size) => {
    setPageSize(size);
    setPage(0);
  };

  return (
    <section className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-300">
          {t('portfolioDigest.sectionLabel')}
        </h3>
      </div>

      {loading && (
        <div className="space-y-2">
          <div className="h-4 w-40 animate-pulse rounded bg-gray-800" />
          <div className="h-3 w-full animate-pulse rounded bg-gray-800" />
          <div className="h-3 w-11/12 animate-pulse rounded bg-gray-800" />
        </div>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && (!digest || !digest.has_digest) && (
        <div className="space-y-2">
          <div className="text-sm text-gray-400">{t('portfolioDigest.noData')}</div>
          <div className="rounded-lg border border-slate-700/60 bg-slate-800/40 px-3 py-2 text-xs text-slate-400">
            💡 Bản tin được tạo tự động lúc 16:05 các ngày Thứ 2 – Thứ 6 bằng AI.
            Để bật tính năng này, hãy cấu hình <span className="text-cyan-400 font-semibold">AI API Key</span> trong phần Cài đặt tài khoản.
          </div>
        </div>
      )}

      {!loading && !error && digest?.has_digest && (
        <div className="space-y-3">
          {digest.is_latest_fallback && (
            <div className="flex items-center gap-2 rounded-md border border-amber-700/50 bg-amber-950/30 px-3 py-1.5 text-xs text-amber-300">
              <span>⚠</span>
              <span>Đây là bản tin gần nhất (ngày <span className="font-semibold">{digest.date}</span>), chưa có bản tin cho hôm nay.</span>
            </div>
          )}

          {/* Tóm tắt ngắn — luôn hiển thị */}
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-500">{t('portfolioDigest.summary')}</p>
            <p className="mt-1 text-sm leading-relaxed text-gray-100">{digest.digest_summary || '-'}</p>
          </div>

          {/* Chi tiết có phân trang + scroll */}
          {digestLines.length > 0 && (
            <div>
              {/* Header: label + page size selector */}
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs uppercase tracking-wider text-gray-500">
                  {t('portfolioDigest.full')}
                  <span className="ml-2 text-gray-600 normal-case">({digestLines.length} dòng)</span>
                </p>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-500">Hiện:</span>
                  {PAGE_SIZE_OPTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => handlePageSizeChange(s)}
                      className={`rounded px-2 py-0.5 text-[10px] font-semibold transition-colors ${pageSize === s ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scrollable content */}
              <div className="overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/40 p-3" style={{ maxHeight: '260px' }}>
                <ul className="space-y-2">
                  {pagedLines.map((line, idx) => (
                    <li key={idx} className="flex gap-2 text-sm leading-relaxed text-gray-300">
                      <span className="mt-0.5 shrink-0 text-xs text-slate-500">{page * pageSize + idx + 1}.</span>
                      <span className="whitespace-pre-wrap">{line}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                  <span>Trang {page + 1} / {totalPages}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setPage(0)}
                      disabled={page === 0}
                      className="rounded px-2 py-0.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                    >«</button>
                    <button
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="rounded px-2 py-0.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                    >‹</button>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      className="rounded px-2 py-0.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                    >›</button>
                    <button
                      onClick={() => setPage(totalPages - 1)}
                      disabled={page >= totalPages - 1}
                      className="rounded px-2 py-0.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                    >»</button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-2 text-xs text-gray-400 sm:grid-cols-2">
            <p>{t('portfolioDigest.symbols')}: <span className="text-gray-200">{symbolsText}</span></p>
            <p>{t('portfolioDigest.itemCount')}: <span className="text-gray-200">{digest.item_count ?? 0}</span></p>
            <p>{t('portfolioDigest.aiModel')}: <span className="text-gray-200">{digest.ai_model || '-'}</span></p>
            <p>
              {t('portfolioDigest.createdAt')}:{' '}
              <span className="text-gray-200">
                {digest.created_at ? formatDateTime(digest.created_at) : '-'}
              </span>
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
