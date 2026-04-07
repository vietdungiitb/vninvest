import React, { useEffect, useState } from 'react';
import { useI18n } from '../../context/LangContext';
import { getWhaleAdvisories } from '../../api/client';
import useTrustTelemetry from '../../hooks/useTrustTelemetry';

/**
 * S24-10 — RecommendationHistoryMini
 *
 * Shows a compact historical view of AI advisory outcomes for a symbol
 * (T+1, T+3, T+5 horizons) to help users evaluate advisory track record.
 *
 * Props:
 *   symbol   – ticker string
 *   limit    – number of past advisories to show (default: 5)
 *
 * Data comes from the existing getWhaleAdvisories API, filtered by symbol.
 * The T+1/T+3/T+5 outcome fields are optional (may be null for recent records).
 */

function OutcomeBadge({ value }) {
  if (value == null) {
    return <span className="text-[11px] text-slate-600">—</span>;
  }
  const num = Number(value);
  const color = num > 0 ? 'text-emerald-400' : num < 0 ? 'text-red-400' : 'text-slate-400';
  return (
    <span className={`text-[11px] font-semibold ${color}`}>
      {num > 0 ? '+' : ''}{num.toFixed(2)}%
    </span>
  );
}

export default function RecommendationHistoryMini({ symbol, limit = 5 }) {
  const { t, formatTime } = useI18n();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const { trackHistoryOpened } = useTrustTelemetry();

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setLoading(true);
    trackHistoryOpened(symbol);

    getWhaleAdvisories({ symbol, limit, ordering: '-created_at' })
      .then((res) => {
        if (!cancelled) setHistory(res.data?.results || res.data || []);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [symbol, limit]);

  if (!symbol) return null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden text-sm">
      <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/40">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {t('historyMini.title', { symbol, defaultValue: `Lịch sử khuyến nghị · ${symbol}` })}
        </p>
      </div>

      {loading ? (
        <div className="px-4 py-6 text-xs text-slate-500 text-center">
          {t('historyMini.loading', { defaultValue: 'Đang tải…' })}
        </div>
      ) : history.length === 0 ? (
        <div className="px-4 py-6 text-xs text-slate-500 text-center">
          {t('historyMini.empty', { defaultValue: 'Chưa có lịch sử khuyến nghị cho mã này.' })}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/30">
                <th className="px-4 py-2 text-left text-[11px] text-slate-500 font-medium uppercase tracking-wider">
                  {t('historyMini.colDate', { defaultValue: 'Ngày' })}
                </th>
                <th className="px-4 py-2 text-left text-[11px] text-slate-500 font-medium uppercase tracking-wider">
                  {t('historyMini.colSummary', { defaultValue: 'Tóm tắt' })}
                </th>
                <th className="px-3 py-2 text-center text-[11px] text-slate-500 font-medium uppercase tracking-wider">
                  T+1
                </th>
                <th className="px-3 py-2 text-center text-[11px] text-slate-500 font-medium uppercase tracking-wider">
                  T+3
                </th>
                <th className="px-3 py-2 text-center text-[11px] text-slate-500 font-medium uppercase tracking-wider">
                  T+5
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {history.map((item, idx) => (
                <tr key={item.id ?? idx} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-2 text-slate-500 whitespace-nowrap">
                    {formatTime(item.created_at)}
                  </td>
                  <td className="px-4 py-2 text-slate-300 max-w-[220px] truncate">
                    {item.ai_summary
                      ? item.ai_summary.slice(0, 80) + (item.ai_summary.length > 80 ? '…' : '')
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <OutcomeBadge value={item.outcome_t1} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <OutcomeBadge value={item.outcome_t3} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <OutcomeBadge value={item.outcome_t5} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="px-4 py-2 border-t border-slate-800 bg-slate-950/20 text-[11px] text-slate-600">
        {t('historyMini.outcomeNote', {
          defaultValue: 'T+1/T+3/T+5: % thay đổi giá so với ngày khuyến nghị. Null = chưa đến thời điểm đánh giá.',
        })}
      </div>
    </div>
  );
}
