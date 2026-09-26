import { createElement, useCallback, useEffect, useState } from 'react';
import { coreApiAdapter } from '../../adapters/coreApiAdapter.js';
import { useI18n } from '../../context/LangContext.js';

const e = createElement;

function pct(v) {
  if (v == null) return '—';
  const n = Number(v) * 100;
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
}

export function AdvisoryBacktestPanel({ symbol, fetchBacktest = null }) {
  const { t } = useI18n();
  const [windowDays, setWindowDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    setError('');
    try {
      const loader = fetchBacktest || ((s, w) => coreApiAdapter.getAdvisoryBacktest(s, w));
      setData(await loader(symbol, windowDays));
    } catch (_) {
      setData(null);
      setError(t('aiAdvisory.backtest.error', { defaultValue: 'Không tải được backtest.' }));
    } finally {
      setLoading(false);
    }
  }, [symbol, windowDays, fetchBacktest]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  return e(
    'div',
    { className: 'space-y-3' },
    e(
      'div',
      { className: 'flex items-center gap-2' },
      e('span', { className: 'text-[10px] font-black text-slate-500 uppercase tracking-widest' }, t('aiAdvisory.backtest.window', { defaultValue: 'Khung' })),
      [30, 90].map((w) => e(
        'button',
        {
          key: w,
          type: 'button',
          onClick: () => setWindowDays(w),
          className: `px-2 py-1 rounded-lg text-[10px] font-black transition ${windowDays === w ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-900/40 text-slate-400 border border-slate-800/60'}`,
        },
        t('aiAdvisory.backtest.windowDays', { count: w, defaultValue: `${w} ngày` })
      ))
    ),
    loading
      ? e('div', { className: 'py-6 text-center text-xs text-slate-500' }, t('aiAdvisory.backtest.loading', { defaultValue: 'Đang tính backtest…' }))
      : error
        ? e('div', { className: 'py-6 text-center text-xs text-rose-400' }, error)
        : !data || !data.enough_data
          ? e('div', { className: 'py-6 text-center text-xs text-slate-500' }, t('aiAdvisory.backtest.empty', { defaultValue: 'Chưa đủ mẫu để đánh giá (cần ≥ 5).' }))
          : e(
            'div',
            { className: 'space-y-3' },
            e(
              'div',
              { className: 'grid grid-cols-2 gap-2' },
              e(
                'div',
                { className: 'p-3 rounded-2xl bg-slate-900/40 border border-slate-800/40' },
                e('div', { className: 'text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1' }, t('aiAdvisory.backtest.hitRate', { defaultValue: 'Tỷ lệ đúng (T+5)' })),
                e('div', { className: 'text-lg font-black text-cyan-400 font-mono' }, pct(data.hit_rate))
              ),
              e(
                'div',
                { className: 'p-3 rounded-2xl bg-slate-900/40 border border-slate-800/40' },
                e('div', { className: 'text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1' }, t('aiAdvisory.backtest.samples', { defaultValue: 'Số mẫu' })),
                e('div', { className: 'text-lg font-black text-white font-mono' }, String(data.n_samples))
              )
            ),
            e(
              'div',
              { className: 'grid grid-cols-3 gap-2' },
              ['avg_return_t1', 'avg_return_t3', 'avg_return_t5'].map((k, i) => e(
                'div',
                { key: k, className: 'p-3 rounded-2xl bg-slate-900/40 border border-slate-800/40' },
                e('div', { className: 'text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1' }, t(`aiAdvisory.backtest.avgT${[1, 3, 5][i]}`, { defaultValue: `TB T+${[1, 3, 5][i]}` })),
                e('div', { className: `text-sm font-black font-mono ${Number(data[k]) > 0 ? 'text-emerald-400' : Number(data[k]) < 0 ? 'text-rose-400' : 'text-slate-300'}` }, pct(data[k]))
              ))
            ),
            data.reliable === false
              ? e(
                'p',
                { className: 'text-[10px] text-amber-400/90 italic' },
                t('aiAdvisory.backtest.lowConfidence', { n: data.n_samples, defaultValue: 'Mẫu chưa đủ lớn để tin cậy — chỉ mang tính tham khảo.' })
              )
              : null,
            data.duplicate_signals_skipped
              ? e(
                'p',
                { className: 'text-[10px] text-slate-500 italic' },
                t('aiAdvisory.backtest.deduped', { n: data.duplicate_signals_skipped, defaultValue: 'Đã gộp tín hiệu trùng cùng phiên để không thổi phồng mẫu.' })
              )
              : null,
            e('p', { className: 'text-[10px] text-slate-600 italic' }, t('aiAdvisory.backtest.disclaimer', { defaultValue: 'Kết quả quá khứ không đảm bảo cho tương lai. Giá chưa trừ phí/thuế.' }))
          )
  );
}

export default AdvisoryBacktestPanel;
