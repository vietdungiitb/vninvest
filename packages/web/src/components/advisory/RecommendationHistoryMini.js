/**
 * RecommendationHistoryMini — Mini recommendation history for Whale Advisory
 * Converted from JSX to createElement pattern
 */
import { createElement, useEffect, useState } from 'react';
import { coreApiAdapter } from '../../adapters/coreApiAdapter.js';
import { useTrustTelemetry } from '../../hooks/useTrustTelemetry.js';

const e = createElement;

function OutcomeBadge({ value }) {
  if (value == null) {
    return e('span', { className: 'text-[11px] text-slate-600' }, '—');
  }
  const num = Number(value);
  const color = num > 0 ? 'text-emerald-400' : num < 0 ? 'text-red-400' : 'text-slate-400';
  return e('span', { className: `text-[11px] font-semibold ${color}` }, `${num > 0 ? '+' : ''}${num.toFixed(2)}%`);
}

export function RecommendationHistoryMini({ symbol, limit = 5 }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const { trackHistoryOpened } = useTrustTelemetry();

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setLoading(true);
    trackHistoryOpened(symbol);

    coreApiAdapter.getWhaleAdvisories({ symbol, limit, ordering: '-created_at' })
      .then((res) => {
        if (!cancelled) setHistory(res?.results || res?.data?.results || res?.data || []);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [symbol, limit, trackHistoryOpened]);

  if (!symbol) return null;

  return e(
    'div',
    { className: 'rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden text-sm' },
    e(
      'div',
      { className: 'px-4 py-3 border-b border-slate-800 bg-slate-950/40' },
      e('p', { className: 'text-xs font-semibold uppercase tracking-wider text-slate-400' }, `Lịch sử khuyến nghị · ${symbol}`)
    ),
    loading ? e('div', { className: 'px-4 py-6 text-xs text-slate-500 text-center' }, 'Đang tải…') : history.length === 0 ? e('div', { className: 'px-4 py-6 text-xs text-slate-500 text-center' }, 'Chưa có lịch sử khuyến nghị cho mã này.') : e(
      'div',
      { className: 'overflow-x-auto' },
      e(
        'table',
        { className: 'w-full text-xs' },
        e(
          'thead',
          null,
          e(
            'tr',
            { className: 'border-b border-slate-800 bg-slate-950/30' },
            e('th', { className: 'px-4 py-2 text-left text-[11px] text-slate-500 font-medium uppercase tracking-wider' }, 'Ngày'),
            e('th', { className: 'px-4 py-2 text-left text-[11px] text-slate-500 font-medium uppercase tracking-wider' }, 'Tóm tắt'),
            e('th', { className: 'px-3 py-2 text-center text-[11px] text-slate-500 font-medium uppercase tracking-wider' }, 'T+1'),
            e('th', { className: 'px-3 py-2 text-center text-[11px] text-slate-500 font-medium uppercase tracking-wider' }, 'T+3'),
            e('th', { className: 'px-3 py-2 text-center text-[11px] text-slate-500 font-medium uppercase tracking-wider' }, 'T+5')
          )
        ),
        e(
          'tbody',
          { className: 'divide-y divide-slate-800/60' },
          history.map((item, idx) => e(
            'tr',
            { key: item.id ?? idx, className: 'hover:bg-slate-800/30 transition-colors' },
            e('td', { className: 'px-4 py-2 text-slate-500 whitespace-nowrap' }, item.created_at ? new Date(item.created_at).toLocaleString() : '—'),
            e('td', { className: 'px-4 py-2 text-slate-300 max-w-[220px] truncate' }, item.ai_summary ? item.ai_summary.slice(0, 80) + (item.ai_summary.length > 80 ? '…' : '') : '—'),
            e('td', { className: 'px-3 py-2 text-center' }, e(OutcomeBadge, { value: item.outcome_t1 })),
            e('td', { className: 'px-3 py-2 text-center' }, e(OutcomeBadge, { value: item.outcome_t3 })),
            e('td', { className: 'px-3 py-2 text-center' }, e(OutcomeBadge, { value: item.outcome_t5 }))
          ))
        )
      )
    ),
    e(
      'div',
      { className: 'px-4 py-2 border-t border-slate-800 bg-slate-950/20 text-[11px] text-slate-600' },
      'T+1/T+3/T+5: % thay đổi giá so với ngày khuyến nghị. Null = chưa đến thời điểm đánh giá.'
    )
  );
}

export default RecommendationHistoryMini;