import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../context/LangContext';

/**
 * Memoized Quote Table Row Component
 * 
 * Prevents unnecessary re-renders by using shallow comparison on:
 * - Quote current_price
 * - Quote change_pct
 * - Quote freshness_seconds
 * - Quote stale flag
 * 
 * This prevents UI shimmer when other rows are updated.
 */
const QuoteTableRow = React.memo(
  ({ quote, columns, customRowActions = [], onRowClick, onAction }) => {
    const { t, formatNumber, formatQuotePrice } = useI18n();

    // Default renderers for common column types
    const defaultRenderers = {
      symbol: () => (
        <td className="px-4 py-3 font-bold text-brand-300">
          <Link
            to={`/stocks/${quote.symbol}`}
            onClick={(e) => {
              if (onRowClick) {
                e.preventDefault();
                onRowClick(quote.symbol);
              }
            }}
            className="inline-flex items-center hover:text-cyan-300 transition-colors"
          >
            {quote.symbol}
          </Link>
        </td>
      ),
      current_price: () => (
        <td className="px-4 py-3 text-gray-200 tabular-nums">
          {formatQuotePrice(quote.current_price)}
        </td>
      ),
      change_pct: () => {
        const isUp = (quote.change_pct ?? 0) > 0;
        const isDown = (quote.change_pct ?? 0) < 0;
        return (
          <td
            className={`px-4 py-3 font-semibold ${
              isUp ? 'text-emerald-300' : isDown ? 'text-red-300' : 'text-gray-400'
            }`}
          >
            {quote.change_pct === null || quote.change_pct === undefined
              ? '—'
              : `${isUp ? '+' : ''}${Number(quote.change_pct).toFixed(2)}%`}
          </td>
        );
      },
      freshness_seconds: () => (
        <td className="px-4 py-3 text-xs">
          {quote.data_semantic === 'last_session_close' ||
          ['offhours', 'post_close', 'pre_open'].includes(
            String(quote.market_phase || '').toLowerCase()
          ) ? (
            <span className="text-sky-300">
              {t('dashboardRealtime.sessionCloseLabel') || 'Đóng cửa'}
            </span>
          ) : quote.stale ? (
            <span className="text-amber-300">
              {t('dashboardRealtime.stale') || 'Cũ'}
            </span>
          ) : (
            <span className="text-gray-500">
              {t('dashboardRealtime.secondsShort', {
                value: formatNumber(quote.freshness_seconds ?? 0),
              }) || `${quote.freshness_seconds ?? 0}s`}
            </span>
          )}
        </td>
      ),
      change: () => {
        const isUp = (quote.change ?? 0) > 0;
        const isDown = (quote.change ?? 0) < 0;
        return (
          <td
            className={`px-4 py-3 font-semibold tabular-nums ${
              isUp ? 'text-emerald-300' : isDown ? 'text-red-300' : 'text-gray-400'
            }`}
          >
            {quote.change === null || quote.change === undefined
              ? '—'
              : `${isUp ? '+' : ''}${formatNumber(Number(quote.change))}`}
          </td>
        );
      },
    };

    return (
      <tr className="hover:bg-gray-800/30 transition-colors">
        {columns.map((col) => {
          if (col.render) {
            // Custom renderer provided
            return <React.Fragment key={col.key}>{col.render(quote, { t, formatNumber, formatQuotePrice })}</React.Fragment>;
          }

          if (defaultRenderers[col.key]) {
            return <React.Fragment key={col.key}>{defaultRenderers[col.key]()}</React.Fragment>;
          }

          // Fallback: render as text
          return (
            <td key={col.key} className="px-4 py-3 text-gray-300">
              {quote[col.key] ?? '—'}
            </td>
          );
        })}

        {customRowActions.length > 0 && (
          <td className="px-4 py-3 text-right">
            <div className="flex items-center justify-end gap-2">
              {customRowActions.map((action) => (
                <button
                  key={action.key}
                  onClick={() => onAction?.(quote.symbol, action.key, action.data)}
                  className="text-xs text-gray-300 hover:text-gray-100 font-semibold px-2 py-1 rounded hover:bg-gray-700/30 transition-colors"
                  title={action.label}
                >
                  {action.icon || action.label}
                </button>
              ))}
            </div>
          </td>
        )}
      </tr>
    );
  },
  // Custom comparison: only re-render if meaningful quote data changed
  (prevProps, nextProps) => {
    // Deep comparison for quote properties that matter for display
    const quotesEqual =
      prevProps.quote.symbol === nextProps.quote.symbol &&
      prevProps.quote.current_price === nextProps.quote.current_price &&
      prevProps.quote.change_pct === nextProps.quote.change_pct &&
      prevProps.quote.freshness_seconds === nextProps.quote.freshness_seconds &&
      prevProps.quote.stale === nextProps.quote.stale &&
      prevProps.quote.change === nextProps.quote.change &&
      prevProps.quote.data_semantic === nextProps.quote.data_semantic &&
      prevProps.quote.market_phase === nextProps.quote.market_phase;

    const columnsEqual = prevProps.columns === nextProps.columns;
    const actionsEqual = prevProps.customRowActions === nextProps.customRowActions;
    const handlersEqual =
      prevProps.onRowClick === nextProps.onRowClick &&
      prevProps.onAction === nextProps.onAction;

    // Return true if props are equal (don't re-render), false if different (re-render)
    return quotesEqual && columnsEqual && actionsEqual && handlersEqual;
  }
);

QuoteTableRow.displayName = 'QuoteTableRow';

export default QuoteTableRow;
