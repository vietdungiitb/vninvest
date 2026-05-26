/**
 * utils/VNInvestSignalAdapter.js
 * Adapter to map SaaS OpenAPI responses to VNStockChart structure.
 */

/**
 * Normalizes a list of historical OHLCV chart points from getStockPriceChart
 * to the standard OHLCVBar format expected by the D3 engine.
 *
 * @param {Array} points - Raw API chart points.
 * @returns {Array} OHLCVBar array sorted chronologically.
 */
export function mapToOHLCVBars(points) {
  if (!points || !Array.isArray(points)) return [];
  
  return points
    .filter((d) => d.date && d.close != null)
    .map((d, index) => {
      const parsedDate = new Date(d.date);
      return {
        ...d,
        date: parsedDate,
        timestamp: parsedDate.getTime(),
        open: d.open != null ? Number(d.open) : Number(d.close),
        high: d.high != null ? Number(d.high) : Number(d.close),
        low: d.low != null ? Number(d.low) : Number(d.close),
        close: Number(d.close),
        volume: d.volume != null ? Number(d.volume) : 0,
        index,
        dataIndex: index,
        // Carry over technical indicators if present from backend
        technical: d.technical || {},
      };
    })
    .sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Standardizes a list of whale orders from the realtime alerts / whale feed API
 * to the WhaleOrder shape expected by the VNStockChart.
 *
 * @param {Array} orders - Raw order alerts.
 * @returns {Array} WhaleOrder array.
 */
export function mapToWhaleOrders(orders) {
  if (!orders || !Array.isArray(orders)) return [];
  
  return orders
    .filter((o) => o.price != null && o.ts != null)
    .map((o) => {
      const matchedValue = Number(o.matched_value || o.value || (Number(o.price) * Number(o.volume || 0)));
      return {
        ts: String(o.ts),
        price: Number(o.price),
        volume: Number(o.volume || 0),
        matched_value: matchedValue,
        side: String(o.side || 'buy').toLowerCase() === 'buy' ? 'buy' : 'sell',
        size_class: String(o.size_class || 'shark').toLowerCase() === 'whale' ? 'whale' : 'shark',
      };
    });
}

/**
 * Normalizes cvd_series to CVDPoint array.
 *
 * @param {Array} cvdSeries - Raw CVD series array from getStockOrderFlow or SessionFacts.
 * @returns {Array} CVDPoint array.
 */
export function mapToCvdSeries(cvdSeries) {
  if (!cvdSeries || !Array.isArray(cvdSeries)) return [];
  
  return cvdSeries
    .filter((pt) => pt.bucket_ts != null)
    .map((pt) => ({
      bucket_ts: String(pt.bucket_ts),
      buy_value: Number(pt.buy_value || 0),
      sell_value: Number(pt.sell_value || 0),
      cvd: Number(pt.cvd || 0),
      cumulative_cvd: Number(pt.cumulative_cvd || pt.cvd || 0),
    }));
}
