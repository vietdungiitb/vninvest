/**
 * corporate.js — Corporate actions endpoints cho coreApiAdapter (Task 3).
 *
 * Tach rieng khoi market.js (holder song `stock-slow-load` :2022 giu market.js)
 * — cung factory pattern `createXClient({ coreGet })` nhu cac client khac.
 */

export function createCorporateClient({ coreGet }) {
  return {
    /**
     * Get corporate actions cho 1 ma trong khoang ex_date.
     * GET /core/v1/stock-management/stocks/{symbol}/corporate-actions/
     * @param {string} symbol
     * @param {object} [params] - { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD', limit }
     * @returns {Promise<{symbol, from, to, count, actions: object[]}>}
     */
    getCorporateActions(symbol, params = {}) {
      if (!symbol) throw new Error('symbol is required for getCorporateActions');
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null)),
      ).toString();
      return coreGet(`/stock-management/stocks/${encodeURIComponent(String(symbol).toUpperCase())}/corporate-actions/${query ? `?${query}` : ''}`);
    },
  };
}
