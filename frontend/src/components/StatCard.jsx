/**
 * components/StatCard.jsx
 * Card hiển thị một chỉ số tài chính (Net Worth, P/L...).
 */
import React from 'react';
import { getLocaleTag } from '../i18n';
import { useI18n } from '../context/LangContext';

function formatVND(value, locale = 'vi') {
  if (value === null || value === undefined) return '—';
  const num = parseFloat(value);
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat(getLocaleTag(locale), {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export default function StatCard({ label, value, sub, isPositive, isNegative, loading }) {
  const { locale } = useI18n();
  const valueColor =
    isPositive ? 'text-brand-500' :
    isNegative ? 'text-red-400' :
    'text-gray-100';

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{label}</p>
      {loading ? (
        <div className="h-7 bg-gray-800 rounded animate-pulse w-3/4" />
      ) : (
        <p className={`text-2xl font-bold ${valueColor}`}>{formatVND(value, locale)}</p>
      )}
      {sub && !loading && (
        <p className={`text-xs mt-1 ${isPositive ? 'text-brand-500' : isNegative ? 'text-red-400' : 'text-gray-500'}`}>
          {sub}
        </p>
      )}
    </div>
  );
}

export { formatVND };
