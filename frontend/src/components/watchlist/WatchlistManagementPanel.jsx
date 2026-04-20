/**
 * components/watchlist/WatchlistManagementPanel.jsx
 * UI thêm/xóa mã theo dõi, sync profile, bulk threshold.
 * Tách ra từ Watchlist.jsx để giảm kích thước file.
 */
import React from 'react';

export default function WatchlistManagementPanel({
  t,
  formatNumber,
  // Groups for source select
  groupsWithRealtime,
  // Add symbol form state
  srcGroupId,
  setSrcGroupId,
  addSymbol,
  setAddSymbol,
  addThresholdMillion,
  setAddThresholdMillion,
  addingSymbol,
  symbolError,
  onAddTracked,
  // Bulk threshold
  bulkThresholdMillion,
  setBulkThresholdMillion,
  trackedBulkAction,
  onBulkSetThreshold,
  onBulkClearThreshold,
}) {
  return (
    <div className="space-y-4">
      {/* Add symbol form */}
      <form
        onSubmit={onAddTracked}
        className="bg-gray-900 border border-gray-800 rounded-xl p-4"
      >
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px_180px_120px] gap-3">
          <div>
            <label
              htmlFor="tracked-add-symbol"
              className="block text-xs uppercase tracking-wider text-gray-500 mb-2"
            >
              {t('watchlist.stockSymbol')}
            </label>
            <input
              id="tracked-add-symbol"
              name="tracked_add_symbol"
              value={addSymbol}
              onChange={(e) => setAddSymbol(e.target.value.toUpperCase())}
              placeholder={t('watchlist.symbolExample')}
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-brand-600"
            />
          </div>
          <div>
            <label
              htmlFor="tracked-source-group"
              className="block text-xs uppercase tracking-wider text-gray-500 mb-2"
            >
              {t('watchlist.sourceGroup')}
            </label>
            <select
              id="tracked-source-group"
              name="tracked_source_group"
              value={srcGroupId}
              onChange={(e) => setSrcGroupId(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-brand-600"
            >
              <option value="">{t('watchlist.noSourceGroup')}</option>
              {groupsWithRealtime.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="tracked-threshold-override"
              className="block text-xs uppercase tracking-wider text-gray-500 mb-2"
            >
              {t('watchlist.whaleThresholdOverride')}
            </label>
            <input
              id="tracked-threshold-override"
              name="tracked_threshold_override"
              type="number"
              min="1"
              step="1"
              value={addThresholdMillion}
              onChange={(e) => setAddThresholdMillion(e.target.value)}
              placeholder={t('watchlist.useGlobalThreshold')}
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-brand-600"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={addingSymbol}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
            >
              {addingSymbol ? t('watchlist.addingSymbol') : t('watchlist.addSymbol')}
            </button>
          </div>
        </div>
        {symbolError && <p className="text-sm text-red-400 mt-3">{symbolError}</p>}
      </form>

      {/* Bulk threshold actions */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="tracked-bulk-threshold"
          name="tracked_bulk_threshold"
          aria-label={t('watchlist.bulkThresholdPlaceholder')}
          type="number"
          min="1"
          step="1"
          value={bulkThresholdMillion}
          onChange={(e) => setBulkThresholdMillion(e.target.value)}
          placeholder={t('watchlist.bulkThresholdPlaceholder')}
          className="w-44 bg-gray-950 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-100 outline-none focus:border-brand-600"
        />
        <button
          onClick={onBulkSetThreshold}
          disabled={trackedBulkAction != null}
          className="text-xs font-semibold px-3 py-1.5 rounded-md bg-emerald-700/80 hover:bg-emerald-700 text-white disabled:opacity-50"
        >
          {trackedBulkAction === 'set' ? t('watchlist.saving') : t('watchlist.bulkSetThreshold')}
        </button>
        <button
          onClick={onBulkClearThreshold}
          disabled={trackedBulkAction != null}
          className="text-xs font-semibold px-3 py-1.5 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-200 disabled:opacity-50"
        >
          {trackedBulkAction === 'clear' ? t('watchlist.saving') : t('watchlist.bulkClearThreshold')}
        </button>
      </div>
    </div>
  );
}
