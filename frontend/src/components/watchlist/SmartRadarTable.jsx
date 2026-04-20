/**
 * components/watchlist/SmartRadarTable.jsx
 * Bảng Watchlist nâng cao:
 * - Strategy Filter Bar (Phase B): RSI, RVOL, MA20, Whale
 * - Cột kỹ thuật: RSI(14), MA20_Dist%, RVOL
 * - Cột Sparkline (Phase A): mini SVG chart xu hướng giá
 * - Price Flash animation khi giá thay đổi
 * - Row memoization với React.memo
 */
import React, { memo, useRef, useEffect, useState, useCallback } from 'react';
import { RsiCell, RvolCell, Ma20DistCell, SparklineCell, ChangeCell } from './WatchlistCells';
import { RealtimeQuoteTable } from '../RealtimeQuoteTable';

// ─── Strategy Filter Bar ──────────────────────────────────────────────────────

const STRATEGY_FILTERS = [
  { key: 'all', labelKey: 'watchlist.strategyAll' },
  { key: 'rsi_overbought', labelKey: 'watchlist.strategyOverbought', color: 'text-red-300' },
  { key: 'rsi_oversold', labelKey: 'watchlist.strategyOversold', color: 'text-green-300' },
  { key: 'vol_breakout', labelKey: 'watchlist.strategyVolBreakout', color: 'text-amber-300' },
  { key: 'near_ma20', labelKey: 'watchlist.strategyNearMa20', color: 'text-cyan-300' },
  { key: 'gainers', labelKey: 'watchlist.dataFilterGainers', color: 'text-green-400' },
  { key: 'losers', labelKey: 'watchlist.dataFilterLosers', color: 'text-red-400' },
  { key: 'stale', labelKey: 'watchlist.dataFilterStale', color: 'text-gray-500' },
];

function StrategyFilterBar({ t, strategyFilter, setStrategyFilter, filteredCount, totalCount }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-3">
      <span className="text-xs text-gray-500 uppercase tracking-wider mr-1">
        {t('watchlist.strategyFilterLabel')}
      </span>
      {STRATEGY_FILTERS.map(({ key, labelKey, color }) => {
        const isActive = strategyFilter === key;
        return (
          <button
            key={key}
            onClick={() => setStrategyFilter(key)}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
              isActive
                ? 'bg-brand-700 border-brand-500 text-white shadow-sm shadow-brand-500/20'
                : `border-gray-700 bg-gray-900/60 ${color || 'text-gray-400'} hover:border-gray-500`
            }`}
          >
            {t(labelKey, { defaultValue: key })}
          </button>
        );
      })}
      {strategyFilter !== 'all' && (
        <span className="text-xs text-gray-500 ml-1">
          {t('watchlist.strategyFilterResult', { count: filteredCount, total: totalCount, defaultValue: `${filteredCount}/${totalCount}` })}
        </span>
      )}
    </div>
  );
}

// ─── Quick Alert Popover ──────────────────────────────────────────────────────

function QuickAlertPopover({ symbol, currentPrice, onSubmit, onClose }) {
  const [condition, setCondition] = useState('ABOVE');
  const [targetPrice, setTargetPrice] = useState(currentPrice != null ? String(Math.round(currentPrice)) : '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const price = Number(targetPrice);
    if (!Number.isFinite(price) || price <= 0) return;
    setSaving(true);
    try {
      await onSubmit({ symbol, condition, targetPrice: price });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 bg-blue-950/30 border border-blue-800/50 rounded-lg px-4 py-3">
      <span className="text-xs font-bold text-blue-300 whitespace-nowrap">🔔 Đặt alert {symbol}</span>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
        <select
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          className="bg-gray-950 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 outline-none focus:border-blue-500"
        >
          <option value="ABOVE">Vượt lên trên</option>
          <option value="BELOW">Giảm xuống dưới</option>
        </select>
        <input
          type="number"
          value={targetPrice}
          onChange={(e) => setTargetPrice(e.target.value)}
          placeholder="Giá mục tiêu"
          className="w-28 bg-gray-950 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={saving}
          className="px-3 py-1 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-bold rounded transition-colors"
        >
          {saving ? 'Đang lưu...' : 'Lưu'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold rounded transition-colors"
        >
          Huỷ
        </button>
      </form>
    </div>
  );
}

// ─── Price Flash Hook ─────────────────────────────────────────────────────────

function usePriceFlash(price) {
  const prevPriceRef = useRef(price);
  const [flashClass, setFlashClass] = useState('');

  useEffect(() => {
    const prev = prevPriceRef.current;
    const current = Number(price);
    if (prev == null || !Number.isFinite(current)) {
      prevPriceRef.current = price;
      return;
    }
    if (current > Number(prev)) {
      setFlashClass('price-flash-up');
    } else if (current < Number(prev)) {
      setFlashClass('price-flash-down');
    }
    prevPriceRef.current = price;
    const timer = setTimeout(() => setFlashClass(''), 700);
    return () => clearTimeout(timer);
  }, [price]);

  return flashClass;
}

// ─── Memoized Price Cell with Flash ──────────────────────────────────────────

const FlashPriceCell = memo(function FlashPriceCell({ price, formatQuotePrice }) {
  const flashClass = usePriceFlash(price);
  return (
    <td className={`px-4 py-3 text-gray-200 tabular-nums font-medium ${flashClass}`}>
      {price != null ? formatQuotePrice(price) : <span className="text-gray-600">—</span>}
    </td>
  );
});

// ─── Memoized Table Row ───────────────────────────────────────────────────────

const TrackedRow = memo(function TrackedRow({
  item,
  t,
  formatNumber,
  formatQuotePrice,
  formatDateTime,
  editingTrackedId,
  editingTrackedThresholdValue,
  setEditingTrackedThresholdValue,
  updatingTrackedId,
  onStartEdit,
  onSaveThreshold,
  onCancelEdit,
  onOpenStock,
  onDelete,
  onQuickAlert,
  sparklinePrices,
  showIndicators,
}) {
  return (
    <tr className="hover:bg-gray-900/40 transition-colors border-b border-gray-800/50">
      {/* Symbol */}
      <td className="px-4 py-3">
        <button
          onClick={() => onOpenStock(item.symbol)}
          className="font-bold text-sm px-2 py-0.5 rounded bg-brand-900/40 text-brand-300 hover:text-brand-200 transition-colors"
        >
          {item.symbol}
        </button>
        {item.whale_alert_threshold_million != null && (
          <span className="ml-1 text-amber-400 text-xs" title={t('watchlist.thresholdPrecedenceLabel')}>🐋</span>
        )}
      </td>

      {/* Source group */}
      <td
        className="px-4 py-3 text-gray-400 text-xs truncate max-w-[160px]"
        title={item.source_group_name || t('watchlist.manualAdded')}
      >
        {item.source_group_name || t('watchlist.manualAdded')}
      </td>

      {/* Price with flash */}
      <FlashPriceCell price={item.current_price} formatQuotePrice={formatQuotePrice} />

      {/* Change */}
      <td className="px-4 py-3">
        <ChangeCell value={item.change_value} />
      </td>

      {/* % Change */}
      <td className="px-4 py-3">
        {item.change_pct != null ? (
          <span className={`font-bold tabular-nums text-sm ${Number(item.change_pct) > 0 ? 'text-green-400' : Number(item.change_pct) < 0 ? 'text-red-400' : 'text-gray-400'}`}>
            {Number(item.change_pct) > 0 ? '+' : ''}{Number(item.change_pct).toFixed(2)}%
          </span>
        ) : <span className="text-gray-600 text-xs">—</span>}
      </td>

      {/* Phase B: RSI(14) */}
      {showIndicators && (
        <td className="px-4 py-3"><RsiCell value={item.rsi_14} /></td>
      )}

      {/* Phase B: RVOL */}
      {showIndicators && (
        <td className="px-4 py-3"><RvolCell value={item.rvol} /></td>
      )}

      {/* Phase B: MA20 Dist */}
      {showIndicators && (
        <td className="px-4 py-3"><Ma20DistCell value={item.ma20_dist_pct} /></td>
      )}

      {/* Phase A: Sparkline */}
      <td className="px-4 py-3">
        <SparklineCell prices={sparklinePrices} />
      </td>

      {/* Whale threshold */}
      <td className="px-4 py-3 text-xs">
        {editingTrackedId === item.id ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              step="1"
              value={editingTrackedThresholdValue}
              onChange={(e) => setEditingTrackedThresholdValue(e.target.value)}
              placeholder={t('watchlist.useGlobalThreshold')}
              className="w-24 bg-gray-950 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 outline-none focus:border-brand-600"
            />
            <button
              onClick={() => onSaveThreshold(item)}
              disabled={updatingTrackedId === item.id}
              className="text-xs text-emerald-300 hover:text-emerald-200 font-semibold disabled:opacity-50"
            >
              {updatingTrackedId === item.id ? t('watchlist.saving') : t('watchlist.save')}
            </button>
            <button
              onClick={onCancelEdit}
              disabled={updatingTrackedId === item.id}
              className="text-xs text-gray-300 hover:text-gray-100 font-semibold disabled:opacity-50"
            >
              {t('watchlist.cancel')}
            </button>
          </div>
        ) : (
          <button
            onClick={() => onStartEdit(item)}
            className="text-gray-300 tabular-nums whitespace-nowrap hover:text-blue-200"
            title={t('watchlist.editThreshold')}
          >
            {item.whale_alert_threshold_million == null
              ? '—'
              : `${formatNumber(item.whale_alert_threshold_million)}M`}
          </button>
        )}
      </td>

      {/* Updated at */}
      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
        {item.updated_at ? formatDateTime(item.updated_at) : '—'}
      </td>

      {/* Actions */}
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => onQuickAlert(item.symbol)}
            className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
            title="Đặt cảnh báo giá nhanh"
          >
            🔔
          </button>
          <button
            onClick={() => onDelete(item.id, item.symbol)}
            className="text-xs text-red-400 hover:text-red-300 font-semibold"
          >
            {t('watchlist.delete')}
          </button>
        </div>
      </td>
    </tr>
  );
}, (prevProps, nextProps) => {
  // Only re-render when meaningful data changes
  return (
    prevProps.item.symbol === nextProps.item.symbol &&
    prevProps.item.current_price === nextProps.item.current_price &&
    prevProps.item.change_pct === nextProps.item.change_pct &&
    prevProps.item.rsi_14 === nextProps.item.rsi_14 &&
    prevProps.item.rvol === nextProps.item.rvol &&
    prevProps.item.whale_alert_threshold_million === nextProps.item.whale_alert_threshold_million &&
    prevProps.editingTrackedId === nextProps.editingTrackedId &&
    prevProps.sparklinePrices === nextProps.sparklinePrices &&
    prevProps.onQuickAlert === nextProps.onQuickAlert
  );
});

// ─── Table Header ─────────────────────────────────────────────────────────────

function TableHeader({ t, trackedSortBy, toggleTrackedSort, getTrackedSortIndicator, showIndicators }) {
  const cols = [
    { key: 'symbol', label: t('watchlist.tableSymbol') },
    { key: 'source_group_name', label: t('watchlist.sourceGroup'), noSort: true },
    { key: 'current_price', label: t('watchlist.tableCurrentPrice') },
    { key: 'change_value', label: t('watchlist.tableChange') },
    { key: 'change_pct', label: t('watchlist.tablePctChange') },
  ];
  if (showIndicators) {
    cols.push(
      { key: 'rsi', label: 'RSI(14)' },
      { key: 'rvol', label: 'RVOL' },
      { key: 'ma20_dist', label: 'MA20 Dist', noSort: true },
    );
  }
  cols.push(
    { key: 'sparkline', label: t('watchlist.trend', { defaultValue: 'Xu hướng' }), noSort: true },
    { key: 'whale_alert_threshold_million', label: t('watchlist.whaleThresholdColumn'), noSort: true },
    { key: 'updated_at', label: t('watchlist.tableUpdatedAt') },
    { key: 'actions', label: t('watchlist.tableActions'), noSort: true },
  );

  return (
    <thead className="sticky top-0 z-10 bg-gray-900">
      <tr className="border-b border-gray-800">
        {cols.map(({ key, label, noSort }) => (
          <th
            key={key}
            className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap last:text-right cursor-pointer select-none"
            onClick={noSort ? undefined : () => toggleTrackedSort(key)}
          >
            {label}{!noSort && <span className="ml-1 text-gray-600">{getTrackedSortIndicator(key)}</span>}
          </th>
        ))}
      </tr>
    </thead>
  );
}

// ─── Main SmartRadarTable Component ──────────────────────────────────────────

export default function SmartRadarTable({
  t,
  formatNumber,
  formatQuotePrice,
  formatDateTime,
  // Paged data
  pagedTracked,
  sortedTracked,
  trackedTotalPages,
  trackedCurrentPage,
  trackedPageSize,
  setTrackedPage,
  // Strategy filters
  strategyFilter,
  setStrategyFilter,
  trackedSymbolsWithRealtime,
  // Sort
  trackedSortBy,
  toggleTrackedSort,
  getTrackedSortIndicator,
  // Inline editing
  editingTrackedId,
  editingTrackedThresholdValue,
  setEditingTrackedThresholdValue,
  updatingTrackedId,
  onStartEdit,
  onSaveThreshold,
  onCancelEdit,
  // Actions
  onOpenStock,
  onDelete,
  onQuickAlert,
  // Sparklines
  getSparklinePrices,
  // Loading
  trackedLoading,
  emptyMessage,
}) {
  // Determine if backend is sending indicators (any row has rsi_14 non-null)
  const showIndicators = pagedTracked.some((item) => item.rsi_14 != null);
  const [quickAlertRowSymbol, setQuickAlertRowSymbol] = useState(null);
  const totalCols = showIndicators ? 12 : 9;

  if (trackedLoading) {
    return (
      <div className="py-10 text-center text-gray-500 text-sm">
        {t('watchlist.loadingTracked')}
      </div>
    );
  }

  if (trackedSymbolsWithRealtime.length === 0) {
    return (
      <div className="py-10 text-center text-gray-500 text-sm">
        {t('watchlist.emptyTracked')}
      </div>
    );
  }

  return (
    <div>
      {/* Strategy Filter Bar */}
      <div className="px-4 pt-3 pb-0">
        <StrategyFilterBar
          t={t}
          strategyFilter={strategyFilter}
          setStrategyFilter={setStrategyFilter}
          filteredCount={sortedTracked.length}
          totalCount={trackedSymbolsWithRealtime.length}
        />
      </div>

      {sortedTracked.length === 0 ? (
        <div className="py-10 text-center text-gray-500 text-sm">{emptyMessage || t('watchlist.noMatchFilter')}</div>
      ) : (
        <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: '480px' }}>
          <table className="w-full text-sm min-w-[700px]">
            <TableHeader
              t={t}
              trackedSortBy={trackedSortBy}
              toggleTrackedSort={toggleTrackedSort}
              getTrackedSortIndicator={getTrackedSortIndicator}
              showIndicators={showIndicators}
            />
            <tbody>
              {pagedTracked.map((item) => (
                <React.Fragment key={item.symbol}>
                  <TrackedRow
                    item={item}
                    t={t}
                    formatNumber={formatNumber}
                    formatQuotePrice={formatQuotePrice}
                    formatDateTime={formatDateTime}
                    editingTrackedId={editingTrackedId}
                    editingTrackedThresholdValue={editingTrackedThresholdValue}
                    setEditingTrackedThresholdValue={setEditingTrackedThresholdValue}
                    updatingTrackedId={updatingTrackedId}
                    onStartEdit={onStartEdit}
                    onSaveThreshold={onSaveThreshold}
                    onCancelEdit={onCancelEdit}
                    onOpenStock={onOpenStock}
                    onDelete={onDelete}
                    onQuickAlert={(sym) => setQuickAlertRowSymbol((prev) => prev === sym ? null : sym)}
                    sparklinePrices={getSparklinePrices(item.symbol)}
                    showIndicators={showIndicators}
                  />
                  {quickAlertRowSymbol === item.symbol && (
                    <tr className="bg-blue-950/10">
                      <td colSpan={totalCols} className="px-4 py-2">
                        <QuickAlertPopover
                          symbol={item.symbol}
                          currentPrice={item.current_price}
                          onSubmit={onQuickAlert}
                          onClose={() => setQuickAlertRowSymbol(null)}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination — always visible */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-gray-800 bg-gray-950/50 text-xs text-gray-400">
        <span>
          {t('watchlist.paginationSummary', {
            from: formatNumber((trackedCurrentPage - 1) * trackedPageSize + 1),
            to: formatNumber(Math.min(trackedCurrentPage * trackedPageSize, sortedTracked.length)),
            total: formatNumber(sortedTracked.length),
          })}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTrackedPage((p) => Math.max(1, p - 1))}
            disabled={trackedCurrentPage <= 1}
            className="px-2.5 py-1 rounded border border-gray-700 text-gray-300 disabled:opacity-40"
          >
            {t('watchlist.prevPage')}
          </button>
          <span>
            {t('watchlist.pageLabel', {
              page: formatNumber(trackedCurrentPage),
              total: formatNumber(trackedTotalPages),
            })}
          </span>
          <button
            onClick={() => setTrackedPage((p) => Math.min(trackedTotalPages, p + 1))}
            disabled={trackedCurrentPage >= trackedTotalPages}
            className="px-2.5 py-1 rounded border border-gray-700 text-gray-300 disabled:opacity-40"
          >
            {t('watchlist.nextPage')}
          </button>
        </div>
      </div>
    </div>
  );
}
