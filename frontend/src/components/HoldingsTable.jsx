/**
 * components/HoldingsTable.jsx
 * Bảng danh sách các vị thế đang nắm giữ.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import EmptyState from './EmptyState';
import { useI18n } from '../context/LangContext';

function PLCell({ value, pct, formatQuotePriceFn, showInteger = false }) {
  if (value === null || value === undefined) return <span className="text-gray-500">—</span>;
  const num = parseFloat(value);
  const color = num > 0 ? 'text-brand-500' : num < 0 ? 'text-red-400' : 'text-gray-400';
  const sign = num > 0 ? '+' : '';
  const displayValue = showInteger ? Math.round(num).toLocaleString('en-US') : formatQuotePriceFn(value);
  return (
    <span className={color}>
      {sign}{displayValue}
      {pct !== null && pct !== undefined && (
        <span className="ml-1 text-xs opacity-75">
          ({sign}{parseFloat(pct).toFixed(2)}%)
        </span>
      )}
    </span>
  );
}

export default function HoldingsTable({ holdings, loading }) {
  const { t, formatQuotePrice, formatQuoteVolume, formatQuoteInteger } = useI18n();
  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-10 bg-gray-800 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (!holdings || holdings.length === 0) {
    return (
      <EmptyState
        title={t('holdings.emptyTitle')}
        description={t('holdings.emptyDescription')}
      />
    );
  }

  const headers = [
    t('holdings.headers.symbol'),
    t('holdings.headers.quantity'),
    t('holdings.headers.avgCost'),
    t('holdings.headers.currentPrice'),
    t('holdings.headers.marketValue'),
    t('holdings.headers.unrealizedPL'),
    t('holdings.headers.realizedPL'),
    t('holdings.headers.dividends'),
  ];

  return (
    <div className="overflow-x-auto">
      <p className="mb-2 text-[11px] text-gray-500">{t('holdings.priceUnitHint')}</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-left">
            {headers.map((h) => (
              <th key={h} className="pb-2 pr-4 text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {holdings.map((h) => (
            <tr key={h.symbol} className="hover:bg-gray-900/50 transition-colors">
              <td className="py-3 pr-4 font-bold text-brand-400">
                <Link to={`/stocks/${h.symbol}`} className="hover:text-brand-300 transition-colors">
                  {h.symbol}
                </Link>
              </td>
              <td className="py-3 pr-4 text-gray-300">
                {formatQuoteVolume(h.quantity)}
              </td>
              <td className="py-3 pr-4 text-gray-300 tabular-nums">{formatQuotePrice(h.avg_cost)}</td>
              <td className="py-3 pr-4 text-gray-300">
                {(h.live_current_price ?? h.current_price)
                  ? formatQuotePrice(h.live_current_price ?? h.current_price)
                  : <span className="text-gray-600">{t('holdings.notSynced')}</span>}
              </td>
              <td className="py-3 pr-4 text-gray-300">
                {(h.live_market_value ?? h.market_value)
                  ? formatQuoteInteger(h.live_market_value ?? h.market_value)
                  : '—'}
              </td>
              <td className="py-3 pr-4">
                <PLCell
                  value={h.live_unrealized_pl ?? h.unrealized_pl}
                  pct={h.live_unrealized_pl_pct ?? h.unrealized_pl_pct}
                  formatQuotePriceFn={formatQuotePrice}
                  showInteger={true}
                />
              </td>
              <td className="py-3 pr-4">
                <PLCell value={h.realized_pl} pct={null} formatQuotePriceFn={formatQuotePrice} />
              </td>
              <td className="py-3 pr-4 text-yellow-400 text-sm">
                {parseFloat(h.dividends_received || 0) > 0
                  ? formatQuotePrice(h.dividends_received)
                  : <span className="text-gray-700">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
