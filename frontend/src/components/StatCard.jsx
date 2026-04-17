/**
 * components/StatCard.jsx
 * Card hiển thị một chỉ số tài chính (Net Worth, P/L...).
 */
import React from 'react';
import { useI18n } from '../context/LangContext';

function formatVND(value, showInteger = false) {
  const { formatQuotePrice, formatQuoteInteger } = useI18n();
  if (showInteger) {
    return formatQuoteInteger(value);
  }
  return formatQuotePrice(value);
}

export default function StatCard({ label, value, sub, unit, isPositive, isNegative, loading, showInteger = false, iconKey = 'marketValue' }) {
  const { formatQuotePrice, formatQuoteInteger } = useI18n();
  const displayValue = showInteger ? formatQuoteInteger(value) : formatQuotePrice(value);

  const iconByKey = {
    marketValue: '💰',
    unrealizedPL: '📈',
    realizedPL: '📑',
    dividends: '🌿',
  };
  const trendByKey = {
    marketValue: [22, 24, 23, 26, 28, 27, 29, 31, 30, 32, 33, 35],
    unrealizedPL: [26, 25, 27, 24, 22, 20, 21, 19, 20, 18, 17, 16],
    realizedPL: [16, 16, 17, 18, 18, 19, 20, 20, 21, 22, 23, 24],
    dividends: [12, 12, 13, 13, 14, 14, 15, 16, 16, 17, 18, 19],
  };
  const trendPoints = trendByKey[iconKey] || trendByKey.marketValue;
  const icon = iconByKey[iconKey] || iconByKey.marketValue;

  const strokeColor = isNegative ? '#f43f5e' : '#10b981';
  const min = Math.min(...trendPoints);
  const max = Math.max(...trendPoints);
  const points = trendPoints
    .map((point, index) => {
      const x = (index / (trendPoints.length - 1)) * 96;
      const y = 22 - (((point - min) / Math.max(max - min, 1)) * 18);
      return `${x},${y}`;
    })
    .join(' ');
  const areaPoints = `0,22 ${points} 96,22`;
  
  const valueColor =
    isPositive ? 'text-brand-500' :
    isNegative ? 'text-red-400' :
    'text-gray-100';

  return (
    <div className="bg-slate-900/85 border border-slate-700 rounded-xl p-3">
      <p className="text-[10px] text-slate-400 uppercase tracking-[0.12em] mb-1 flex items-center gap-1.5">
        <span>{icon}</span>
        {label}
      </p>
      {loading ? (
        <div className="h-5 bg-slate-800 rounded animate-pulse w-3/4" />
      ) : (
        <p className={`text-[30px] leading-none font-black ${valueColor}`}>
          {displayValue}
          {unit && (
            <span className="text-[10px] font-normal text-slate-500 ml-1.5">{unit}</span>
          )}
        </p>
      )}
      {sub && !loading && (
        <p className={`text-[10px] mt-1 ${isPositive ? 'text-brand-500' : isNegative ? 'text-red-400' : 'text-slate-500'}`}>
          {sub}
        </p>
      )}
      {!loading && (
        <svg viewBox="0 0 96 24" className="mt-2 h-6 w-full opacity-90" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="kpiSparkFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.35" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={areaPoints} fill="url(#kpiSparkFill)" />
          <polyline points={points} fill="none" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

export { formatVND };
