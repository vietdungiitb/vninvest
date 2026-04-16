import React, { useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import QuoteTableRow from './QuoteTableRow';
import { useI18n } from '../../context/LangContext';

/**
 * Unified Realtime Quote Table Component
 * 
 * Supports both Dashboard and Watchlist use cases with configurable columns,
 * row-level memoization, and optional sorting/filtering.
 * 
 * Props:
 * - quotes: Array of quote objects {symbol, current_price, change_pct, freshness_seconds, ...}
 * - columns: Array of column definitions [{key, label, render?, sortable?, width?}]
 * - onRowClick?: (symbol) => void
 * - onAction?: (symbol, actionKey, actionData?) => void
 * - sortConfig?: {key, direction} - initial sort
 * - isLoading?: boolean
 * - emptyMessage?: string
 * - className?: string
 * - maxHeight?: string - for scrollable container
 * - showHint?: boolean - show price unit hint below header
 * - customRowActions?: Array of {key, label, icon?, onClick}
 */
export default function RealtimeQuoteTable({
  quotes = [],
  columns = [],
  onRowClick,
  onAction,
  sortConfig = null,
  isLoading = false,
  emptyMessage = 'Không có mã nào',
  className = '',
  maxHeight = '308px',
  showHint = true,
  customRowActions = [],
}) {
  const { t } = useI18n();
  const [localSortConfig, setLocalSortConfig] = useState(sortConfig);

  // Handle sort toggle
  const handleSort = useCallback((columnKey) => {
    setLocalSortConfig((prev) => {
      if (prev?.key === columnKey) {
        // Toggle direction
        return {
          key: columnKey,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        };
      }
      return { key: columnKey, direction: 'asc' };
    });
  }, []);

  // Memoized sorted quotes
  const sortedQuotes = useMemo(() => {
    if (!localSortConfig || !localSortConfig.key) {
      return quotes;
    }

    const sorted = [...quotes].sort((a, b) => {
      const aVal = a[localSortConfig.key];
      const bVal = b[localSortConfig.key];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === 'string') {
        return localSortConfig.direction === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return localSortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return sorted;
  }, [quotes, localSortConfig]);

  if (isLoading) {
    return (
      <div className={`rounded-xl border border-gray-800 overflow-hidden ${className}`}>
        <div className="px-4 py-8 text-center text-gray-500 text-sm">
          {t('common.loading') || 'Đang tải...'}
        </div>
      </div>
    );
  }

  if (sortedQuotes.length === 0) {
    return (
      <div className={`rounded-xl border border-gray-800 overflow-hidden ${className}`}>
        <div className="px-4 py-8 text-center text-gray-500 text-sm">
          {emptyMessage}
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-gray-800 overflow-hidden ${className}`}>
      <div className="overflow-x-auto" style={{ maxHeight }}>
        {showHint && (
          <p className="px-4 py-2 text-[11px] text-gray-500 bg-gray-950/30">
            {t('watchlist.priceUnitHint') || 'Giá được tính bằng nghìn VND'}
          </p>
        )}
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b border-gray-800 sticky top-0 bg-gray-950/70">
              {columns.map((col) => {
                const isSortable = col.sortable !== false;
                const isCurrentSort = localSortConfig?.key === col.key;
                const sortIndicator = isCurrentSort
                  ? localSortConfig?.direction === 'asc'
                    ? ' ▲'
                    : ' ▼'
                  : '';

                return (
                  <th
                    key={col.key}
                    className={`px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap ${
                      isSortable ? 'cursor-pointer hover:text-gray-300 transition-colors' : ''
                    }`}
                    style={{ width: col.width }}
                    onClick={() => isSortable && handleSort(col.key)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      {col.label}
                      {isCurrentSort && <span className="text-[10px] text-brand-300">{sortIndicator}</span>}
                    </div>
                  </th>
                );
              })}
              {customRowActions.length > 0 && (
                <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">
                  {t('watchlist.tableActions') || 'Hành động'}
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60">
            {sortedQuotes.map((quote) => (
              <QuoteTableRow
                key={quote.symbol}
                quote={quote}
                columns={columns}
                customRowActions={customRowActions}
                onRowClick={onRowClick}
                onAction={onAction}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
