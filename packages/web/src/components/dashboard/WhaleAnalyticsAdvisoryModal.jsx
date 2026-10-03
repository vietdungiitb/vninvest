import React, { useEffect, useMemo, useState } from 'react';
import { coreApiAdapter } from '../../adapters/coreApiAdapter.js';
import { useI18n } from '../../context/LangContext.js';

function formatConfidence(value) {
  const numericValue = Number(value ?? null);
  if (!Number.isFinite(numericValue)) return '--';
  return `${numericValue}/10`;
}

export default function WhaleAnalyticsAdvisoryModal({ isOpen, symbol, onClose }) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [session, setSession] = useState(null);
  const [summary, setSummary] = useState(null);

  const normalizedSymbol = useMemo(() => String(symbol || '').trim().toUpperCase(), [symbol]);

  useEffect(() => {
    if (!isOpen || !normalizedSymbol) return;

    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await coreApiAdapter.getStockAIAdvisorySession(normalizedSymbol, { contract: 'v2', include_benchmarks: 1 });
        if (!active) return;
        const payload = response || {};
        setSession(payload.advisory || payload.aggregate || null);
        const firstSummary = Array.isArray(payload.executive_summaries) ? payload.executive_summaries[0] : null;
        setSummary(payload.executive_summary || firstSummary || null);
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.message || t('whaleAnalytics.aiAdvisoryLoadFailed', { defaultValue: 'Không thể tải tư vấn AI cho mã này.' }));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [isOpen, normalizedSymbol, t]);

  const handleRefresh = async () => {
    if (!normalizedSymbol) return;
    setRefreshing(true);
    setError('');
    try {
      const response = await coreApiAdapter.refreshStockAIAdvisorySession(normalizedSymbol);
      const payload = response || {};
      setSession(payload.advisory || session);
      const firstSummary = Array.isArray(payload.executive_summaries) ? payload.executive_summaries[0] : null;
      setSummary(payload.executive_summary || firstSummary || summary || null);
    } catch (err) {
      setError(err?.response?.data?.message || t('whaleAnalytics.aiAdvisoryRefreshFailed', { defaultValue: 'Không thể làm mới tư vấn AI lúc này.' }));
    } finally {
      setRefreshing(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">{t('whaleAnalytics.aiAdvisoryModalTitle', { defaultValue: 'Tư vấn AI' })}</div>
            <div className="mt-1 text-lg font-semibold text-slate-100">{normalizedSymbol || '--'}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              className="rounded-full border border-cyan-700/60 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20"
              disabled={refreshing}
            >
              {refreshing ? t('common.loading', { defaultValue: 'Đang tải...' }) : t('whaleAnalytics.aiAdvisoryRefresh', { defaultValue: 'Làm mới AI' })}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-300 hover:border-slate-500"
            >
              {t('common.close', { defaultValue: 'Đóng' })}
            </button>
          </div>
        </div>

        <div className="space-y-4 px-5 py-4 text-sm text-slate-300">
          {loading ? (
            <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-6 text-slate-400">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-700 border-t-cyan-400" />
              <span>{t('whaleAnalytics.aiAdvisoryLoading', { defaultValue: 'Đang tải phân tích AI...' })}</span>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-800/60 bg-rose-950/20 px-4 py-4 text-rose-300">{error}</div>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{t('whaleAnalytics.aiAdvisoryAction', { defaultValue: 'Hành động' })}</div>
                  <div className="mt-2 text-base font-semibold text-cyan-300">{session?.strategy_action || session?.action || '--'}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{t('whaleAnalytics.aiAdvisoryRisk', { defaultValue: 'Rủi ro' })}</div>
                  <div className="mt-2 text-base font-semibold text-amber-300">{session?.risk_level || summary?.risk_level || '--'}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{t('whaleAnalytics.aiAdvisoryConfidence', { defaultValue: 'Độ tin cậy' })}</div>
                  <div className="mt-2 text-base font-semibold text-emerald-300">{formatConfidence(summary?.overall_confidence || session?.confidence_score)}</div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{t('whaleAnalytics.aiAdvisorySummary', { defaultValue: 'Tóm tắt AI' })}</div>
                <div className="mt-3 whitespace-pre-line leading-6 text-slate-200">
                  {summary?.synthesis_text || session?.summary || session?.executive_summary || t('whaleAnalytics.aiAdvisoryEmpty', { defaultValue: 'Chưa có bản tóm tắt AI sẵn sàng cho mã này.' })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
