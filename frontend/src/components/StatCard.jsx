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

export default function StatCard({ label, value, sub, unit, isPositive, isNegative, loading, showInteger = false }) {
  const { formatQuotePrice, formatQuoteInteger } = useI18n();
  const displayValue = showInteger ? formatQuoteInteger(value) : formatQuotePrice(value);
  
  const valueColor =
    isPositive ? 'text-brand-500' :
    isNegative ? 'text-red-400' :
    'text-gray-100';

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
      <p className="text-[10px] text-gray-500 uppercase tracking-[0.12em] mb-1">{label}</p>
      {loading ? (
        <div className="h-5 bg-gray-800 rounded animate-pulse w-3/4" />
      ) : (
        <p className={`text-[30px] leading-none font-black ${valueColor}`}>
          {displayValue}
          {unit && (
            <span className="text-[10px] font-normal text-gray-500 ml-1.5">{unit}</span>
          )}
        </p>
      )}
      {sub && !loading && (
        <p className={`text-[10px] mt-1 ${isPositive ? 'text-brand-500' : isNegative ? 'text-red-400' : 'text-gray-500'}`}>
          {sub}
        </p>
      )}
    </div>
  );
}

export { formatVND };
