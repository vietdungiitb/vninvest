/**
 * WhaleAdvisoryBentoHeader — Header for Whale Advisory page
 * Converted from JSX to createElement pattern
 */
import { createElement } from 'react';
import { useI18n } from '../../context/LangContext.js';

const e = createElement;

export function WhaleAdvisoryBentoHeader({
  userPlan,
  statsLoading,
  onRefresh,
}) {
  const { t } = useI18n();
  return e(
    'header',
    { className: 'neon-glass-panel p-6 mb-6 overflow-hidden relative group' },
    e('div', { className: 'absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 blur-[100px] -mr-32 -mt-32 rounded-full transition-all duration-1000 group-hover:bg-cyan-500/20' }),
    e(
      'div',
      { className: 'flex flex-wrap items-center justify-between gap-6 relative z-10' },
      e(
        'div',
        { className: 'flex-1 min-w-[300px]' },
        e(
          'div',
          { className: 'flex items-center gap-3 mb-3' },
          e(
            'div',
            { className: 'w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-inner' },
            e('svg', { xmlns: 'http://www.w3.org/2000/svg', className: 'h-6 w-6', viewBox: '0 0 20 20', fill: 'currentColor' },
              e('path', { fillRule: 'evenodd', d: 'M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z', clipRule: 'evenodd' })
            )
          ),
          e(
            'div',
            { className: 'flex flex-col' },
            e('span', { className: 'text-[11px] font-black uppercase tracking-[0.4em] text-slate-500 leading-none' }, t('aiAdvisory.eyebrow', { defaultValue: 'TRUNG TÂM CHỈ HUY' })),
            e('div', { className: 'h-px w-full bg-gradient-to-r from-cyan-500/50 to-transparent mt-1.5' })
          )
        ),
        e(
          'h1',
          { className: 'text-4xl font-black text-white tracking-tighter leading-tight' },
          t('aiAdvisory.title', { defaultValue: 'AI Tư vấn v2.0' })
        ),
        e(
          'p',
          { className: 'mt-4 max-w-2xl text-sm font-medium text-slate-400 leading-relaxed' },
          t('aiAdvisory.description', { defaultValue: 'Phân tích và khuyến nghị giao dịch dựa trên trí tuệ nhân tạo, dòng tiền thông minh và dữ liệu thị trường realtime. ' }),
          e('span', { className: 'ml-3 inline-flex items-center px-2.5 py-0.5 rounded-lg bg-slate-800 text-cyan-300 font-black text-[9px] uppercase border border-slate-700 shadow-lg' }, userPlan || 'Miễn phí')
        )
      ),
      e(
        'div',
        { className: 'flex flex-col items-end gap-4' },
        e(
          'div',
          { className: 'flex items-center gap-4 bg-slate-950/60 p-2.5 pl-5 rounded-3xl border border-slate-800/40 backdrop-blur-xl shadow-2xl' },
          e(
            'div',
            { className: 'flex flex-col' },
            e('span', { className: 'text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none' }, t('aiAdvisory.dataTitle', { defaultValue: 'TRUNG TÂM DỮ LIỆU' })),
            e('span', { className: 'text-[11px] font-black text-slate-200 mt-1.5 tracking-tight' }, t('aiAdvisory.dataSource', { defaultValue: 'Nguồn dữ liệu realtime' }))
          ),
          e(
            'button',
            {
              onClick: onRefresh,
              disabled: statsLoading,
              'aria-label': t('aiAdvisory.refresh', { defaultValue: 'Làm mới dữ liệu' }),
              className: `p-3 rounded-2xl transition-all active:scale-90 shadow-lg ${
                statsLoading ? 'bg-slate-800 text-slate-600' : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-900/20'
              }`,
              title: t('aiAdvisory.refresh', { defaultValue: 'Làm mới dữ liệu' })
            },
            e('svg', { xmlns: 'http://www.w3.org/2000/svg', className: `h-5 w-5 ${statsLoading ? 'animate-spin' : ''}`, fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
              e('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2, d: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' })
            )
          )
        ),
        e(
          'div',
          { className: 'flex items-center gap-3 bg-slate-950/30 px-4 py-2 rounded-2xl border border-slate-800/30' },
          e('div', { className: `h-2.5 w-2.5 rounded-full ${statsLoading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500 live-dot-pulse'}` }),
          e('span', { className: `text-[10px] font-black uppercase tracking-[0.2em] ${statsLoading ? 'text-amber-500' : 'text-emerald-500'}` }, statsLoading ? t('aiAdvisory.syncing', { defaultValue: 'ĐANG ĐỒNG BỘ DỮ LIỆU' }) : t('aiAdvisory.networkStatus', { defaultValue: 'MẠNG LƯỚI GLOBAL ĐANG HOẠT ĐỘNG' }))
        )
      )
    )
  );
}

export default WhaleAdvisoryBentoHeader;