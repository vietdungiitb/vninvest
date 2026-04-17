import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getPortfolioNewsDigest } from '../api/client';
import { useI18n } from '../context/LangContext';

const POLL_INTERVAL_MS = 10 * 60 * 1000; // 10 phút

export default function PortfolioDigestPanel() {
  const { t, formatDateTime } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [digest, setDigest] = useState(null);

  const fetchDigest = useCallback(async () => {
    try {
      const res = await getPortfolioNewsDigest();
      setDigest(res?.data || null);
      setError('');
    } catch (err) {
      setError(err?.response?.data?.detail || t('portfolioDigest.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    let alive = true;

    const run = async () => {
      if (!alive) return;
      await fetchDigest();
    };

    run();
    const timer = window.setInterval(run, POLL_INTERVAL_MS);

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [fetchDigest]);

  const symbolsText = useMemo(() => {
    const list = digest?.symbols;
    if (!Array.isArray(list) || list.length === 0) return '-';
    return list.join(', ');
  }, [digest]);

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

          <div>
            <p className="text-xs uppercase tracking-wider text-gray-500">{t('portfolioDigest.summary')}</p>
            <p className="mt-1 text-sm leading-relaxed text-gray-100">{digest.digest_summary || '-'}</p>
          </div>

          {digest.digest_full ? (
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500">{t('portfolioDigest.full')}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-gray-300">{digest.digest_full}</p>
            </div>
          ) : null}

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
