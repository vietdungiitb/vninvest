/**
 * components/watchlist/PriceAlertModule.jsx
 * Module quản lý và hiển thị cảnh báo giá cá nhân.
 * Tách ra từ Watchlist.jsx để dễ maintain và test.
 */
import React from 'react';
import { isPriceAlertMatched, extractApiErrorMessage } from '../../utils/watchlistHelpers';

export default function PriceAlertModule({
  t,
  formatNumber,
  formatQuotePrice,
  formatDateTime,
  priceAlerts,
  priceAlertsWithRealtime,
  priceAlertsLoading,
  priceAlertForm,
  setPriceAlertForm,
  priceAlertSaving,
  priceAlertError,
  priceAlertMsg,
  triggeredPriceAlerts,
  priceAlertConditionLabels,
  onCreatePriceAlert,
  onTogglePriceAlert,
  onDeletePriceAlert,
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-100 uppercase tracking-wider">
            {t('watchlist.personalPriceAlerts')}
          </h3>
          <p className="text-xs text-gray-500 mt-1">{t('watchlist.personalPriceAlertsDesc')}</p>
        </div>
        {priceAlertMsg && <span className="text-xs text-blue-300">{priceAlertMsg}</span>}
      </div>

      {/* Create form */}
      <form
        onSubmit={onCreatePriceAlert}
        className="grid grid-cols-1 lg:grid-cols-[1fr_180px_1fr_180px_140px] gap-3"
      >
        <div>
          <label
            htmlFor="price-alert-symbol"
            className="block text-xs uppercase tracking-wider text-gray-500 mb-2"
          >
            {t('watchlist.stockSymbol')}
          </label>
          <input
            id="price-alert-symbol"
            name="price_alert_symbol"
            value={priceAlertForm.symbol}
            onChange={(e) =>
              setPriceAlertForm((prev) => ({ ...prev, symbol: e.target.value.toUpperCase() }))
            }
            placeholder={t('watchlist.symbolExample')}
            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-brand-600"
          />
        </div>
        <div>
          <label
            htmlFor="price-alert-condition"
            className="block text-xs uppercase tracking-wider text-gray-500 mb-2"
          >
            {t('watchlist.condition')}
          </label>
          <select
            id="price-alert-condition"
            name="price_alert_condition"
            value={priceAlertForm.condition}
            onChange={(e) => setPriceAlertForm((prev) => ({ ...prev, condition: e.target.value }))}
            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-brand-600"
          >
            <option value="ABOVE">{t('watchlist.above')}</option>
            <option value="BELOW">{t('watchlist.below')}</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="price-alert-target-price"
            className="block text-xs uppercase tracking-wider text-gray-500 mb-2"
          >
            {t('watchlist.targetPrice')}
          </label>
          <input
            id="price-alert-target-price"
            name="price_alert_target_price"
            type="number"
            min="0"
            step="0.01"
            value={priceAlertForm.targetPrice}
            onChange={(e) =>
              setPriceAlertForm((prev) => ({ ...prev, targetPrice: e.target.value }))
            }
            placeholder="120000"
            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-brand-600"
          />
        </div>
        <div>
          <label
            htmlFor="price-alert-cooldown-seconds"
            className="block text-xs uppercase tracking-wider text-gray-500 mb-2"
          >
            {t('watchlist.cooldownSeconds')}
          </label>
          <input
            id="price-alert-cooldown-seconds"
            name="price_alert_cooldown_seconds"
            type="number"
            min="0"
            step="1"
            value={priceAlertForm.cooldownSeconds}
            onChange={(e) =>
              setPriceAlertForm((prev) => ({ ...prev, cooldownSeconds: e.target.value }))
            }
            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-brand-600"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={priceAlertSaving}
            className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
          >
            {priceAlertSaving ? t('watchlist.seeding') : t('watchlist.addAlert')}
          </button>
        </div>
      </form>

      {priceAlertError && <p className="text-sm text-red-400">{priceAlertError}</p>}

      {/* Recent triggers */}
      {triggeredPriceAlerts.length > 0 && (
        <div className="rounded-xl border border-blue-900/50 bg-blue-950/20 px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-blue-300 mb-2">
            {t('watchlist.recentTriggers')}
          </p>
          <div className="space-y-2 text-sm">
            {triggeredPriceAlerts.map((alert) => (
              <div
                key={`${alert.id}-${alert.triggered_at}`}
                className="flex flex-wrap items-center gap-3 text-gray-300"
              >
                <span className="font-semibold text-gray-100">{alert.symbol}</span>
                <span>{alert.condition === 'ABOVE' ? t('watchlist.above') : t('watchlist.below')}</span>
                <span className="tabular-nums">{formatNumber(alert.target_price)} VNĐ</span>
                <span className="text-xs text-gray-500">{formatDateTime(alert.triggered_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alert list table */}
      <div className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden">
        {priceAlertsLoading ? (
          <div className="py-8 text-center text-gray-500 text-sm">
            {t('watchlist.loadingPriceAlerts')}
          </div>
        ) : priceAlertsWithRealtime.length === 0 ? (
          <div className="py-8 text-center text-gray-500 text-sm">
            {t('watchlist.emptyPriceAlerts')}
          </div>
        ) : (
          <>
            <p className="px-4 pt-3 text-[11px] text-gray-500">{t('watchlist.priceUnitHint')}</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {[
                    'tableSymbol', 'tableCondition', 'tableTarget', 'tableCurrentPrice',
                    'tableStatus', 'tableCooldown', 'tableLastTrigger', 'tableActions',
                  ].map((key) => (
                    <th
                      key={key}
                      className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap last:text-right"
                    >
                      {t(`watchlist.${key}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {priceAlertsWithRealtime.map((rule) => {
                  const matched = isPriceAlertMatched(rule, rule.current_price) && !rule.stale;
                  return (
                    <tr key={rule.id} className="hover:bg-gray-900/40 transition-colors">
                      <td className="px-4 py-3 font-bold text-blue-300">{rule.symbol}</td>
                      <td className="px-4 py-3 text-gray-300">{priceAlertConditionLabels[rule.condition]}</td>
                      <td className="px-4 py-3 text-gray-300 tabular-nums">{formatQuotePrice(rule.target_price)}</td>
                      <td className="px-4 py-3 text-gray-300 tabular-nums">
                        {rule.current_price != null ? formatQuotePrice(rule.current_price) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                          !rule.is_active
                            ? 'bg-gray-800 text-gray-400'
                            : matched
                              ? 'bg-blue-900/40 text-blue-300'
                              : 'bg-emerald-900/30 text-emerald-300'
                        }`}>
                          {!rule.is_active
                            ? t('watchlist.paused')
                            : matched
                              ? t('watchlist.hitThreshold')
                              : t('watchlist.tracking')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{rule.cooldown_seconds}s</td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {formatDateTime(rule.last_triggered_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => onTogglePriceAlert(rule)}
                            className="text-xs text-gray-300 hover:text-gray-100 font-semibold"
                          >
                            {rule.is_active ? t('watchlist.pause') : t('watchlist.activate')}
                          </button>
                          <button
                            onClick={() => onDeletePriceAlert(rule)}
                            className="text-xs text-red-400 hover:text-red-300 font-semibold"
                          >
                            {t('watchlist.delete')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
