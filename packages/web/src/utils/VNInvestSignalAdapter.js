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

const ADVISORY_DECISION_MAP = {
  strong_buy: 'STRONG_BUY',
  strongbuy: 'STRONG_BUY',
  buy: 'BUY',
  follow: 'BUY',
  hold: 'HOLD',
  watch: 'HOLD',
  neutral: 'HOLD',
  informative: 'HOLD',
  reduce: 'SELL',
  sell: 'SELL',
  strong_sell: 'STRONG_SELL',
  strongsell: 'STRONG_SELL',
};

function mapAdvisoryAction(raw) {
  const key = String(raw ?? '').trim().toLowerCase();
  return ADVISORY_DECISION_MAP[key] ?? 'HOLD';
}

function advisorySign(decision) {
  if (decision === 'STRONG_BUY' || decision === 'BUY') return 1;
  if (decision === 'STRONG_SELL' || decision === 'SELL') return -1;
  return 0;
}

/**
 * W-A: map native V2 advisory session -> legacy widget AdvisoryResult.
 * Widget 0.4.4 khong forward `advisorySession` xuong bottom panel
 * (chi truyen legacy `result`), nen app map truoc khi truyen prop.
 * Tra null khi: empty-state / queued (PENDING co aggregate default
 * conf 5.0 -> action 'reduce' — hien SELL gia neu khong chan) /
 * thieu decision / het component dong gop.
 *
 * @param {object|null} session - V2 payload (da unwrap envelope).
 * @returns {object|null} Legacy AdvisoryResult {decision, confidence, weighted_score, agents, explanation, triggered_at}.
 */
export function mapAdvisorySessionToResult(session) {
  if (!session || typeof session !== 'object') return null;
  // M-1: queued PENDING luon co aggregate default -> phai chan truoc.
  if (session.queued === true) return null;
  const aggregate = session.aggregate && typeof session.aggregate === 'object' ? session.aggregate : null;
  const summary = session.executive_summary && typeof session.executive_summary === 'object' ? session.executive_summary : null;
  const advisory = session.advisory && typeof session.advisory === 'object' ? session.advisory : null;
  const decisionRaw =
    aggregate?.decision?.action ?? summary?.strategy_action ?? session.strategy_action ?? advisory?.strategy_action ?? null;
  if (!decisionRaw) return null;
  const components = Array.isArray(session.components) ? session.components : [];
  // Chi component dong gop (chua xoa + tinh vao summary; thieu flag coi nhu true).
  const active = components.filter((c) => c && !c.is_deleted && c.include_in_summary !== false);
  if (active.length === 0) return null;

  const decision = mapAdvisoryAction(decisionRaw);
  const sign = advisorySign(decision);
  let overall = Number(summary?.overall_confidence ?? session.confidence_score ?? advisory?.confidence_score ?? NaN);
  if (!Number.isFinite(overall) && aggregate?.decision?.score != null && Number.isFinite(Number(aggregate.decision.score))) {
    overall = Number(aggregate.decision.score) * 10;
  }
  if (!Number.isFinite(overall)) overall = 5.0;
  overall = Math.max(0, Math.min(10, overall));
  const confidence = Math.max(0, Math.min(1, overall / 10));
  const weighted_score = Math.max(-100, Math.min(100, sign * overall * 10));

  const n = active.length;
  const agents = active.map((c) => {
    const signal = mapAdvisoryAction(c.suggested_action);
    const status = String(c.status ?? '').trim().toLowerCase();
    const statusSign = status === 'bullish' ? 1 : status === 'bearish' ? -1 : advisorySign(signal);
    let cConf = Number(c.confidence_score ?? 5);
    if (!Number.isFinite(cConf)) cConf = 5;
    cConf = Math.max(0, Math.min(10, cConf));
    return {
      name: String(c.indicator_name || c.component_type || 'Signal'),
      weight: 1 / n,
      score: Math.max(-100, Math.min(100, statusSign * cConf * 10)),
      signal,
      explanation: String(c.rationale_text ?? ''),
    };
  });

  const explanation = String(summary?.summary_text ?? advisory?.advisory_text ?? session.advisory_text ?? '');
  const sessionDate = String(aggregate?.session_date ?? summary?.session_date ?? '');
  const triggered_at = /^\d{4}-\d{2}-\d{2}$/.test(sessionDate)
    ? `${sessionDate}T00:00:00+07:00`
    : sessionDate || new Date().toISOString();

  return { decision, confidence, weighted_score, agents, explanation, triggered_at };
}
