/**
 * components/HoldingsTable.jsx
 * Bảng danh sách các vị thế đang nắm giữ phiên bản Workstation (v6.7).
 * Tích hợp Performance Bar và Sparklines mini.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../context/LangContext';
import AlertBadge from './AlertBadge';

/**
 * PerformanceBar: Thanh tiến trình hiển thị mức độ Lãi/Lỗ
 */
function PerformanceBar({ pct }) {
  const numericPct = parseFloat(pct || 0);
  const isPositive = numericPct >= 0;
  const clampedPct = Math.min(Math.abs(numericPct), 30); // Clamp visual width to 30% for scale
  const widthStr = `${(clampedPct / 30) * 100}%`;

  return (
    <div className="flex flex-col gap-1 min-w-[80px]">
      <div className="flex justify-between items-center text-[10px] font-black tabular-nums">
        <span className={isPositive ? 'text-emerald-400' : 'text-rose-400'}>
          {isPositive ? '+' : ''}{numericPct.toFixed(2)}%
        </span>
      </div>
      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex relative">
        {/* Center line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-700 z-10" />
        
        <div 
          className={`h-full absolute transition-all duration-700 ease-out ${isPositive ? 'left-1/2 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'right-1/2 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'}`}
          style={{ width: widthStr }}
        />
      </div>
    </div>
  );
}

/**
 * MiniSparkline: Biểu đồ đường mini cho tile bảng
 */
function MiniSparkline({ points, width = 60, height = 24 }) {
  if (!points || points.length < 2) return <div className="w-[60px] h-6 border-b border-slate-800 opacity-20" />;
  
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const isUp = points[points.length - 1] >= points[0];
  
  const toX = (i) => (i / (points.length - 1)) * width;
  const toY = (v) => height - ((v - min) / range) * height;
  
  const pathData = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
  
  return (
    <svg width={width} height={height} className="overflow-visible">
      <path 
        d={pathData} 
        fill="none" 
        stroke={isUp ? '#10b981' : '#f43f5e'} 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
    </svg>
  );
}

function formatWhaleMatchedValue(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null;
  }

  if (numericValue >= 1_000_000_000_000) return `${(numericValue / 1_000_000_000_000).toFixed(1)}N`;
  if (numericValue >= 1_000_000_000) return `${(numericValue / 1_000_000_000).toFixed(1)}T`;
  if (numericValue >= 1_000_000) return `${(numericValue / 1_000_000).toFixed(0)}M`;
  if (numericValue >= 1_000) return `${(numericValue / 1_000).toFixed(0)}K`;
  return numericValue.toLocaleString('vi-VN');
}

function resolveWhaleAlertIcon(sizeClass, severity) {
  const normalizedSizeClass = String(sizeClass || '').toLowerCase();
  const normalizedSeverity = String(severity || '').toLowerCase();
  if (normalizedSizeClass === 'shark' || normalizedSeverity === 'critical' || normalizedSeverity === 'high') {
    return '🦈';
  }
  return '🐋';
}

function resolveWhaleAlertRowTone(severity) {
  const normalizedSeverity = String(severity || '').toLowerCase();
  if (normalizedSeverity === 'critical') {
    return 'border-rose-500/60 bg-rose-950/35 shadow-[0_0_0_1px_rgba(248,113,113,0.26),0_0_18px_rgba(244,63,94,0.18)]';
  }
  if (normalizedSeverity === 'high') {
    return 'border-amber-500/60 bg-amber-950/25 shadow-[0_0_0_1px_rgba(251,191,36,0.22),0_0_16px_rgba(245,158,11,0.14)]';
  }
  if (normalizedSeverity === 'medium') {
    return 'border-cyan-500/50 bg-cyan-950/18 shadow-[0_0_0_1px_rgba(34,211,238,0.18),0_0_14px_rgba(34,211,238,0.10)]';
  }
  return 'border-slate-500/60 bg-slate-900/35 shadow-[0_0_0_1px_rgba(148,163,184,0.14)]';
}

function resolveWhaleAlertBadgeTone(severity) {
  const normalizedSeverity = String(severity || '').toLowerCase();
  if (normalizedSeverity === 'critical') {
    return 'border-rose-400/80 bg-rose-950/55 text-rose-100 shadow-[0_0_12px_rgba(248,113,113,0.20)]';
  }
  if (normalizedSeverity === 'high') {
    return 'border-amber-400/80 bg-amber-950/40 text-amber-100 shadow-[0_0_12px_rgba(251,191,36,0.18)]';
  }
  if (normalizedSeverity === 'medium') {
    return 'border-cyan-400/70 bg-cyan-950/32 text-cyan-100 shadow-[0_0_10px_rgba(34,211,238,0.12)]';
  }
  return 'border-slate-500/70 bg-slate-900/70 text-slate-100';
}

function resolveWhaleAlertSeverityLabel(t, severity) {
  const normalizedSeverity = String(severity || '').toLowerCase();
  if (normalizedSeverity === 'critical') return t('severityCritical');
  if (normalizedSeverity === 'high') return t('severityHigh');
  if (normalizedSeverity === 'medium') return t('severityMedium');
  return t('severityLow');
}

function resolveWhaleAlertSideLabel(t, side) {
  const normalizedSide = String(side || '').toLowerCase();
  if (normalizedSide === 'sell') return t('typeSell');
  return t('typeBuy');
}

export default function HoldingsTable({ holdings, loading, whaleAlertsBySymbol = {} }) {
  const { t, formatQuotePrice, formatQuoteInteger } = useI18n();

  const renderSkeleton = () => (
    <div className="space-y-3 p-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-12 bg-slate-800/40 rounded-xl animate-pulse" />
      ))}
    </div>
  );

  if (loading) return renderSkeleton();

  if (!holdings || holdings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-600 opacity-50">
        <span className="text-4xl mb-3">📭</span>
        <p className="text-sm italic">{t('holdings.emptyTitle')}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto panel-scrollbar">
      <table className="w-full border-separate border-spacing-y-2 px-2">
        <thead>
          <tr className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-black">
            <th className="px-4 py-2 text-left">{t('holdings.headers.symbol')}</th>
            <th className="px-4 py-2 text-left">{t('holdings.headers.trend')}</th>
            <th className="px-4 py-2 text-right">{t('holdings.headers.quantity')}</th>
            <th className="px-4 py-2 text-right">{t('holdings.headers.costVsCurrent')}</th>
            <th className="px-4 py-2 text-right">{t('holdings.headers.marketValue')}</th>
            <th className="px-4 py-2 text-right">{t('holdings.headers.performance')}</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h, idx) => {
            const symbolKey = String(h.symbol || '').trim().toUpperCase();
            const whaleAlert = whaleAlertsBySymbol[symbolKey] || null;
            const currentPrice = h.live_current_price ?? h.current_price;
            const marketValue = h.live_market_value ?? h.market_value;
            const plPct = h.live_unrealized_pl_pct ?? h.unrealized_pl_pct;
            const isFresh = (h.live_freshness_seconds ?? Infinity) < 30;
            const whaleBadgeTone = whaleAlert ? resolveWhaleAlertBadgeTone(whaleAlert.severity) : '';
            const whaleRowTone = whaleAlert ? resolveWhaleAlertRowTone(whaleAlert.severity) : '';
            const whaleIcon = whaleAlert ? resolveWhaleAlertIcon(whaleAlert.sizeClass, whaleAlert.severity) : '';
            const whaleSeverityLabel = whaleAlert ? resolveWhaleAlertSeverityLabel(t, whaleAlert.severity) : '';
            const whaleSideLabel = whaleAlert ? resolveWhaleAlertSideLabel(t, whaleAlert.side) : '';
            const whaleMatchedValueLabel = whaleAlert ? formatWhaleMatchedValue(whaleAlert.matchedValue) : null;

            return (
              <tr 
                key={h.symbol} 
                className={`group bg-slate-900/30 hover:bg-slate-800/40 border border-slate-800/50 rounded-xl transition-all duration-300 relative overflow-hidden ${whaleRowTone}`}
              >
                <td className="px-4 py-3 first:rounded-l-xl last:rounded-r-xl relative">
                  {whaleAlert ? (
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${whaleAlert.severity === 'critical' ? 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.55)]' : whaleAlert.severity === 'high' ? 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.50)]' : 'bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.45)]'} fade-in`} />
                  ) : isFresh ? (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)] fade-in" />
                  ) : null}
                  <div className="flex flex-col">
                    <Link 
                      to={`/stocks/${h.symbol}`} 
                      className="text-sm font-black text-slate-100 group-hover:text-emerald-400 transition-colors uppercase tracking-tight"
                    >
                      {h.symbol}
                    </Link>
                    <span className="text-[9px] text-slate-500 mt-0.5 uppercase truncate max-w-[100px]">
                      {h.industry || 'Khác'}
                    </span>
                    {whaleAlert ? (
                      <AlertBadge
                        href={`/stocks/${h.symbol}`}
                        icon={whaleIcon}
                        tone={`${whaleBadgeTone} ${whaleAlert.severity === 'critical' || whaleAlert.severity === 'high' ? 'animate-pulse' : ''}`}
                        severityLabel={whaleSeverityLabel}
                        sideLabel={whaleSideLabel}
                        matchedValueLabel={whaleMatchedValueLabel || ''}
                        title={`${whaleSeverityLabel} ${whaleSideLabel}${whaleMatchedValueLabel ? ` · ${whaleMatchedValueLabel}` : ''}`}
                        className="mt-1"
                      />
                    ) : null}
                  </div>
                </td>

                <td className="px-4 py-3">
                   <MiniSparkline points={h.sparkline24} />
                </td>

                <td className="px-4 py-3 text-right tabular-nums">
                  <span className="text-xs font-bold text-slate-300">
                    {Number(h.quantity).toLocaleString('vi-VN')}
                  </span>
                </td>

                <td className="px-4 py-3 text-right tabular-nums">
                  <div className="flex flex-col items-end">
                    <span className="text-xs font-black text-slate-100">
                      {currentPrice ? formatQuotePrice(currentPrice) : '—'}
                    </span>
                    <span className="text-[9px] text-slate-500 mt-1">
                      B: {formatQuotePrice(h.avg_cost)}
                    </span>
                  </div>
                </td>

                <td className="px-4 py-3 text-right tabular-nums">
                  <div className="flex flex-col items-end">
                    <span className="text-xs font-black text-slate-200">
                      {marketValue ? formatQuoteInteger(marketValue) : '—'}
                    </span>
                    <span className="text-[9px] text-slate-600 uppercase tracking-tighter">{t('holdings.unitThousand')}</span>
                  </div>
                </td>

                <td className="px-4 py-3 text-right first:rounded-l-xl last:rounded-r-xl">
                  <div className="flex justify-end">
                    <PerformanceBar pct={plPct} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
