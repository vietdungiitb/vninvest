import { createElement } from 'react';
import { useI18n } from '../../context/LangContext.js';

const e = createElement;

function latestItemFor(items, symbol) {
  const list = (Array.isArray(items) ? items : []).filter((i) => i && i.symbol === symbol);
  list.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  return list[0] || null;
}

export function AdvisoryCompareTable({ symbols, symbolStats, items, onRemove }) {
  const { t, localeTag } = useI18n();
  const picks = Array.isArray(symbols) ? symbols.slice(0, 5) : [];
  const rows = picks.map((symbol) => {
    const stat = (Array.isArray(symbolStats) ? symbolStats : []).find((s) => s && s.symbol === symbol) || {};
    const item = latestItemFor(items, symbol);
    return {
      symbol,
      side: item?.side || '—',
      confidence: item?.confidence != null ? `${item.confidence}%` : '—',
      intensity: stat?.whaleIntensity ?? stat?.whale_intensity ?? null,
      updated: item?.created_at ? new Date(item.created_at).toLocaleString(localeTag) : '—',
    };
  });

  if (picks.length === 0) {
    return e('div', { className: 'py-6 text-center text-xs text-slate-500' }, t('aiAdvisory.compare.empty', { defaultValue: 'Chưa chọn mã nào để so sánh.' }));
  }

  return e(
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
          e('th', { className: 'px-4 py-2 text-left text-[11px] text-slate-500 font-medium uppercase tracking-wider' }, t('aiAdvisory.compare.colSymbol', { defaultValue: 'Mã' })),
          e('th', { className: 'px-4 py-2 text-left text-[11px] text-slate-500 font-medium uppercase tracking-wider' }, t('aiAdvisory.compare.colSide', { defaultValue: 'Hướng' })),
          e('th', { className: 'px-4 py-2 text-left text-[11px] text-slate-500 font-medium uppercase tracking-wider' }, t('aiAdvisory.compare.colConfidence', { defaultValue: 'Tin cậy' })),
          e('th', { className: 'px-4 py-2 text-left text-[11px] text-slate-500 font-medium uppercase tracking-wider' }, t('aiAdvisory.compare.colIntensity', { defaultValue: 'Cường độ' })),
          e('th', { className: 'px-4 py-2 text-left text-[11px] text-slate-500 font-medium uppercase tracking-wider' }, t('aiAdvisory.compare.colUpdated', { defaultValue: 'Cập nhật' })),
          e('th', { className: 'px-4 py-2' }, '')
        )
      ),
      e(
        'tbody',
        { className: 'divide-y divide-slate-800/60' },
        rows.map((row) => e(
          'tr',
          { key: row.symbol, className: 'hover:bg-slate-800/30 transition-colors' },
          e('td', { className: 'px-4 py-2 font-bold text-slate-100' }, row.symbol),
          e('td', { className: 'px-4 py-2 text-slate-300 uppercase' }, row.side),
          e('td', { className: 'px-4 py-2 text-cyan-400 font-mono' }, row.confidence),
          e('td', { className: 'px-4 py-2 text-slate-300 font-mono' }, row.intensity != null ? `${row.intensity}%` : '—'),
          e('td', { className: 'px-4 py-2 text-slate-500 whitespace-nowrap' }, row.updated),
          e(
            'td',
            { className: 'px-4 py-2 text-right' },
            onRemove && e(
              'button',
              { type: 'button', onClick: () => onRemove(row.symbol), className: 'text-[10px] font-bold text-slate-500 uppercase hover:text-rose-400 transition-colors' },
              t('aiAdvisory.compare.remove', { defaultValue: 'Bỏ' })
            )
          )
        ))
      )
    )
  );
}

export default AdvisoryCompareTable;
