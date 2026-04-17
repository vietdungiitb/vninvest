/**
 * components/StatCard.jsx
 * Card hiển thị một chỉ số tài chính (Net Worth, P/L...) với hiệu ứng Glassmorphism và Sparkline.
 */
import React from 'react';
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';
import { useI18n } from '../context/LangContext';

function formatLocalVND(value, showInteger, formatQuotePrice, formatQuoteInteger) {
  if (value === null || value === undefined) return '—';
  if (showInteger) {
    return formatQuoteInteger(value);
  }
  return formatQuotePrice(value);
}

export default function StatCard({
  label,
  value,
  sub,
  unit,
  isPositive,
  isNegative,
  loading,
  showInteger = false,
  sparklineData = [], // [{ value: 123 }, ...]
}) {
  const { formatQuotePrice, formatQuoteInteger } = useI18n();
  const displayValue = formatLocalVND(value, showInteger, formatQuotePrice, formatQuoteInteger);

  const themeColor = isPositive ? '#10b981' : isNegative ? '#f43f5e' : '#3b82f6';
  const textColor = isPositive ? 'text-emerald-400' : isNegative ? 'text-rose-400' : 'text-gray-100';

  return (
    <div className="relative overflow-hidden bg-gray-900/40 backdrop-blur-md border border-white/5 rounded-2xl p-5 group hover:border-white/10 transition-all duration-300">
      {/* Glow Effect */}
      <div className={`absolute -right-4 -top-4 w-16 h-16 rounded-full blur-2xl opacity-10 transition-opacity group-hover:opacity-20`}
           style={{ backgroundColor: themeColor }} />

      <div className="relative z-10 flex flex-col h-full justify-between">
        <div>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] mb-1">{label}</p>
          {loading ? (
            <div className="h-8 bg-white/5 rounded-lg animate-pulse w-3/4" />
          ) : (
            <div className="flex items-baseline gap-1.5">
              <span className={`text-2xl font-black tracking-tight ${textColor}`}>
                {displayValue}
              </span>
              {unit && (
                <span className="text-[10px] font-medium text-gray-500 uppercase">{unit}</span>
              )}
            </div>
          )}
          {sub && !loading && (
            <div className={`inline-flex items-center px-1.5 py-0.5 mt-2 rounded text-[10px] font-bold leading-none ${isPositive ? 'bg-emerald-500/10 text-emerald-400' : isNegative ? 'bg-rose-500/10 text-rose-400' : 'bg-gray-500/10 text-gray-400'}`}>
              {sub}
            </div>
          )}
        </div>

        {/* Mini Sparkline */}
        <div className="h-10 mt-4 -mx-5 -mb-5 overflow-hidden opacity-50 group-hover:opacity-80 transition-opacity">
          {sparklineData && sparklineData.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineData}>
                <defs>
                  <linearGradient id={`grad-${label.replace(/\s+/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={themeColor} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={themeColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <YAxis hide domain={['auto', 'auto']} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={themeColor}
                  strokeWidth={1.5}
                  fill={`url(#grad-${label.replace(/\s+/g, '-')})`}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full">
               <div className="w-full h-px bg-white/5 mx-5" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
