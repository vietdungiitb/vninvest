/**
 * WhaleAdvisoryCommandPanel — Main command panel for Whale Advisory
 * Converted from JSX to createElement pattern
 */
import { createElement } from 'react';
import { Link } from 'react-router-dom';
import Can from '../shared/Can.jsx';
import { RecommendationCardExplainability } from './RecommendationCardExplainability.js';
import { DataFreshnessBadge } from './DataFreshnessBadge.js';
import { ActionChecklist } from './ActionChecklist.js';
import { AgenticThoughtStream } from './AgenticThoughtStream.js';

const e = createElement;

function fmtCompact(val) {
  return Number(val || 0).toLocaleString();
}

function fmtTime(ts) {
  return ts ? new Date(ts).toLocaleTimeString() : '--:--';
}

export function WhaleAdvisoryCommandPanel({
  item,
  activeSymbol,
  onRefresh,
  onDeleteCurrent,
  refreshing,
  deleting,
  rowMessage,
}) {
  const advisory = item || {};
  const symbol = activeSymbol || advisory.symbol || '';
  const resolvedSymbol = String(symbol).toUpperCase();
  const hasAdvisory = Boolean(item);
  const side = (advisory.side || '').toUpperCase();
  const isBuy = side === 'BUY';

  return e(
    'div',
    { className: `flex flex-col h-full neon-glass-panel overflow-hidden bg-slate-900/20 transition-all duration-500 ${refreshing ? 'shadow-[0_0_35px_rgba(6,182,212,0.5)] border-cyan-500/60 scale-[1.01]' : 'agentic-glow-cyan'}` },
    e(
      'div',
      { className: 'p-6 border-b border-slate-800/60 bg-slate-900/40' },
      e(
        'div',
        { className: 'flex items-start justify-between' },
        e(
          'div',
          null,
          e(
            'div',
            { className: 'flex items-center gap-3 mb-2' },
            e('h2', { className: 'text-2xl font-black tracking-tighter text-white' }, resolvedSymbol || 'Chọn mã chứng khoán'),
            hasAdvisory && e(
              'div',
              { className: 'flex gap-2' },
              e('span', {
                className: `px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all duration-500 ${
                  isBuy ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'bg-rose-500/20 text-rose-400 border-rose-500/30 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                }`
              }, side),
              advisory.is_discovery && e(
                'span',
                { className: 'px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-500/20 text-amber-500 border border-amber-500/30 animate-pulse' },
                advisory.discovery_bucket || 'Discovery'
              )
            )
          ),
          e(
            'div',
            { className: 'flex items-center gap-3' },
            e('span', { className: 'text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2' },
              e('div', { className: `w-1.5 h-1.5 rounded-full ${hasAdvisory ? 'bg-cyan-500 animate-pulse' : 'bg-slate-700'}` }),
              `Phân tích lúc ${fmtTime(advisory.created_at)}`
            )
          )
        ),
        e(
          'div',
          { className: 'flex gap-2' },
          e('button', {
            onClick: () => onRefresh?.(resolvedSymbol),
            disabled: refreshing || !resolvedSymbol,
            className: `relative px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all overflow-hidden group ${
              refreshing ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-cyan-600 text-white hover:bg-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.3)] active:scale-95'
            }`
          },
            e('span', { className: 'relative z-10' }, refreshing ? 'Đang tải…' : 'Làm mới'),
            !refreshing && e('div', { className: 'absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700' })
          )
        )
      )
    ),
    e(
      'div',
      { className: 'flex-1 overflow-y-auto panel-scrollbar p-6 space-y-6 bg-slate-950/10' },
      e(
        'div',
        { className: 'grid grid-cols-1 md:grid-cols-4 gap-3' },
        e(
          'div',
          { className: 'p-4 rounded-2xl bg-slate-900/40 border border-slate-800/40 backdrop-blur-sm group relative overflow-hidden' },
          e('div', { className: 'text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1' }, 'Cường độ dòng tiền'),
          e(
            'div',
            { className: 'flex items-end gap-2' },
            e('div', { className: 'text-lg font-black text-white font-mono' }, `${advisory.whale_intensity || 0}%`),
            e(
              'div',
              { className: 'flex-1 h-1.5 bg-slate-800 rounded-full mb-1.5 overflow-hidden' },
              e('div', {
                className: `h-full transition-all duration-1000 ${advisory.whale_intensity > 75 ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]' : 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]'}`,
                style: { width: `${advisory.whale_intensity || 0}%` }
              })
            )
          ),
          e('div', { className: 'absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-500/5 to-cyan-500/0 -translate-x-full group-hover:animate-[shimmer_2s_infinite] pointer-events-none' })
        ),
        e(
          'div',
          { className: 'p-4 rounded-2xl bg-slate-900/40 border border-slate-800/40 backdrop-blur-sm' },
          e('div', { className: 'text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1' }, 'Độ tin cậy'),
          e('div', { className: 'text-lg font-black text-cyan-400 font-mono' }, `${advisory.confidence || 0}%`)
        ),
        e(
          'div',
          { className: 'p-4 rounded-2xl bg-slate-900/40 border border-slate-800/40 backdrop-blur-sm' },
          e('div', { className: 'text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1' }, 'Trạng thái'),
          e('div', { className: 'text-sm font-bold text-slate-300 uppercase' }, hasAdvisory ? (advisory.is_discovery ? 'Discovery' : 'Đang hoạt động') : 'Chờ')
        ),
        e(
          'div',
          { className: 'p-4 rounded-2xl bg-slate-900/40 border border-slate-800/40 backdrop-blur-sm' },
          e('div', { className: 'text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1' }, 'Giá trị tham chiếu'),
          e('div', { className: 'text-sm font-bold text-slate-300 font-mono' }, `${fmtCompact(advisory.matched_value || 0)} `, e('span', { className: 'text-[10px] text-slate-500 font-normal' }, 'VNĐ'))
        )
      ),
      hasAdvisory ? e(
        'div',
        { className: 'space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500' },
        e(
          'div',
          { className: 'flex items-center justify-between' },
          e(
            'div',
            { className: 'flex items-center gap-2' },
            e('div', { className: 'w-1.5 h-4 bg-cyan-500 rounded-full shadow-[0_0_8px_rgba(6,182,212,0.6)]' }),
            e('h3', { className: 'text-[11px] font-black text-slate-200 uppercase tracking-widest' }, 'Dòng suy nghĩ')
          ),
          e('div', { className: 'text-[10px] font-mono text-slate-600' }, `${advisory.ai_provider} / ${advisory.ai_model}`)
        ),
        e(
          'div',
          { className: 'p-6 rounded-3xl bg-slate-950/40 border border-slate-800/60 leading-relaxed shadow-inner group' },
          e(
            'div',
            { className: 'prose prose-invert prose-sm max-w-none' },
            e(AgenticThoughtStream, { content: advisory.ai_summary })
          )
        ),
        e(
          Can,
          { I: 'read', a: 'WhaleAdvisoryDetail', fallback: e(
            Link,
            { to: '/upgrade', className: 'flex items-center justify-center gap-2 p-4 rounded-2xl bg-amber-500/5 border border-dashed border-amber-500/30 text-[11px] text-amber-500 hover:bg-amber-500/10 transition-colors' },
            e('span', null, '🔒 Phân tích chuyên sâu'),
            e('span', { className: 'bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded font-black text-[9px] uppercase' }, 'Nâng cấp')
          )},
          advisory.ai_detail && e(
            'div',
            { className: 'mt-4 p-6 rounded-3xl bg-slate-900/30 border border-slate-800/40' },
            e('h4', { className: 'text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center justify-between' },
              e('span', null, 'Phân tích chi tiết'),
              e('div', { className: 'h-px flex-1 mx-4 bg-slate-800/60' })
            ),
            e('p', { className: 'text-slate-400 text-[13px] leading-7 italic font-medium' }, advisory.ai_detail)
          )
        )
      ) : e(
        'div',
        { className: 'flex flex-col items-center justify-center py-24 text-slate-600 text-center animate-pulse' },
        e('div', { className: 'mb-4' },
          e('svg', { xmlns: 'http://www.w3.org/2000/svg', className: 'h-12 w-12 opacity-20', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
            e('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 1, d: 'M13 10V3L4 14h7v7l9-11h-7z' })
          )
        ),
        e('p', { className: 'text-xs uppercase tracking-widest font-bold max-w-[200px]' }, 'Chưa có mã nào đang hoạt động')
      ),
      hasAdvisory && e(
        'div',
        { className: 'rounded-3xl overflow-hidden border border-slate-800/40' },
        e(RecommendationCardExplainability, { advisory: advisory, realtimeStatus: 'live' })
      ),
      hasAdvisory && e(
        'div',
        { className: 'p-6 rounded-3xl bg-slate-900/40 border border-slate-800/40 shadow-xl' },
        e(ActionChecklist, { symbol: resolvedSymbol, onProceed: () => onRefresh?.(resolvedSymbol) })
      )
    ),
    e(
      'div',
      { className: 'px-6 py-4 flex items-center justify-between border-t border-slate-800/60 bg-slate-900/60 backdrop-blur-md' },
      e(
        'div',
        { className: 'flex-1' },
        rowMessage ? e('p', { className: 'text-[11px] font-bold text-cyan-400 animate-in fade-in duration-300' }, rowMessage) : e(
          'div',
          { className: 'flex gap-4' },
          e(Link, { to: `/whale-alerts/${resolvedSymbol}`, className: 'text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-slate-300 transition-colors' }, 'Bảng điều khiển cá voi'),
          e(Link, { to: `/stocks/${resolvedSymbol}`, className: 'text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-slate-300 transition-colors' }, 'Workspace')
        )
      ),
      hasAdvisory && onDeleteCurrent && e(
        'button',
        {
          type: 'button',
          onClick: () => onDeleteCurrent?.(resolvedSymbol),
          disabled: deleting || refreshing,
          className: `text-[9px] font-black uppercase tracking-widest transition-colors ${deleting ? 'text-slate-600' : 'text-slate-700 hover:text-rose-500'}`
        },
        deleting ? 'Đang xoá…' : 'Xoá tư vấn'
      )
    )
  );
}

export default WhaleAdvisoryCommandPanel;