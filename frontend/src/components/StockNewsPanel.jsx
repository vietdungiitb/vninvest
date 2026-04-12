/**
 * components/StockNewsPanel.jsx
 * Sprint 34 Layer 1 — Hiển thị tin tức gần đây theo mã cổ phiếu.
 * Tự fetch dữ liệu, polling mỗi 30 phút, graceful degradation khi lỗi.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getStockNews } from '../api/client';
import { useI18n } from '../context/LangContext';

const POLL_INTERVAL_MS = 30 * 60 * 1000; // 30 phút

function formatPublishedAt(isoStr) {
  if (!isoStr) return null;
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return isoStr;
  }
}

function NewsItem({ item }) {
  const { t } = useI18n();
  const dateStr = formatPublishedAt(item.published_at);

  return (
    <div className="border-b border-gray-800 last:border-0 py-3 first:pt-0">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-200 hover:text-brand-400 transition-colors leading-snug line-clamp-2"
            >
              {item.title}
            </a>
          ) : (
            <p className="text-sm text-gray-200 leading-snug line-clamp-2">{item.title}</p>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {item.source && (
              <span className="text-xs text-gray-500">{item.source}</span>
            )}
            {dateStr && (
              <span className="text-xs text-gray-600">{dateStr}</span>
            )}
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-brand-500 hover:text-brand-400 transition-colors"
              >
                {t('stockNews.readMore')} ↗
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StockNewsPanel({ symbol }) {
  const { t } = useI18n();
  const [news, setNews] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const pollTimerRef = useRef(null);

  const fetchNews = useCallback(async ({ force = false } = {}) => {
    if (!symbol) return;
    if (force) {
      setRefreshing(true);
    }
    try {
      const res = await getStockNews(symbol, { force });
      setNews(res.data);
      setError(null);
    } catch (err) {
      setError(t('stockNews.fetchFailed'));
    } finally {
      if (force) {
        setRefreshing(false);
      }
      setLoading(false);
    }
  }, [symbol, t]);

  useEffect(() => {
    setLoading(true);
    setNews(null);
    setError(null);
    fetchNews();

    pollTimerRef.current = setInterval(fetchNews, POLL_INTERVAL_MS);
    return () => clearInterval(pollTimerRef.current);
  }, [fetchNews]);

  const items = news?.items ?? [];
  const unavailable = news?.unavailable ?? false;
  const cachedLabel = news?.cached ? t('stockNews.cachedLabel') : null;
  const fetchedAt = news?.fetched_at ? formatPublishedAt(news.fetched_at) : null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          {t('stockNews.sectionLabel')}
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchNews({ force: true })}
            disabled={loading || refreshing || !symbol}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              loading || refreshing || !symbol
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                : 'bg-brand-600/20 text-brand-400 hover:bg-brand-600/30'
            }`}
          >
            {refreshing ? t('stockNews.refreshing') : t('stockNews.refreshNow')}
          </button>
          {cachedLabel && (
            <span className="text-xs text-gray-600">{cachedLabel}</span>
          )}
          {fetchedAt && (
            <span className="text-xs text-gray-600">{t('stockNews.updatedAt')}: {fetchedAt}</span>
          )}
        </div>
      </div>

      {/* Body */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-2">
              <div className="h-4 bg-gray-800 rounded animate-pulse w-full" />
              <div className="h-3 bg-gray-800 rounded animate-pulse w-1/3" />
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      {!loading && !error && unavailable && (
        <p className="text-xs text-gray-500">{t('stockNews.unavailable')}</p>
      )}

      {!loading && !error && !unavailable && items.length === 0 && (
        <p className="text-xs text-gray-500">{t('stockNews.noData')}</p>
      )}

      {!loading && !error && items.length > 0 && (
        <div>
          {items.map((item, idx) => (
            <NewsItem key={idx} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
