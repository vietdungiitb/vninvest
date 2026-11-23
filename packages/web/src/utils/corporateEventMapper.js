/**
 * corporateEventMapper.js — map du lieu BE sang shape widget (Task 3).
 *
 * Widget tu dien `timeIndex` tu `timestamp` (pK trong bundle), host chi can
 * dua `timestamp` (ms) + `date` (ISO). Xem docs/evidence/widget-news-events/call-path.md.
 */

// Module-level constants (L-F10: khong object literal trong hook render).
export const CORPORATE_EVENT_TYPE_BY_ACTION = { DIV: 'D', ISS: 'S' };

const MS_PER_HOUR = 3600 * 1000;
const VN_UTC_OFFSET_HOURS = 7; // Asia/Ho_Chi_Minh, khong DST

/**
 * 'YYYY-MM-DD' (ngay ex_date) -> ms epoch luc 00:00 Asia/Ho_Chi_Minh.
 * @param {string} exDate
 * @returns {number|null} ms epoch, hoac null khi parse hong.
 */
export function exDateToTimestampMs(exDate) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(exDate || ''));
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    - VN_UTC_OFFSET_HOURS * MS_PER_HOUR;
  return Number.isFinite(ms) ? ms : null;
}

/**
 * BE CorporateAction -> widget CorporateEvent (thieu timeIndex, widget tu dien).
 * @param {object} action
 * @returns {object|null} null khi thieu du lieu bat buoc (bo item, khong crash).
 */
export function mapCorporateActionToCorporateEvent(action) {
  if (!action || typeof action !== 'object') return null;
  const type = CORPORATE_EVENT_TYPE_BY_ACTION[action.action_type] || 'N';
  const timestamp = exDateToTimestampMs(action.ex_date);
  if (timestamp == null) return null;
  const date = String(action.ex_date).slice(0, 10);
  const cash = action.cash_amount_per_share;
  const ratio = action.stock_ratio_pct;
  const title = action.raw_title
    || `Su kien ${action.action_type || ''}`.trim();
  const description = type === 'D' && cash != null
    ? `Co tuc tien mat ${cash} VND/CP`
    : type === 'S' && ratio != null
      ? `Phat hanh/thuong ${ratio}%`
      : '';
  return {
    id: `${action.source}:${action.source_event_id}`,
    type,
    timestamp,
    date,
    label: type,
    title,
    description,
    data: {
      action_type: action.action_type ?? null,
      cash_amount_per_share: cash ?? null,
      stock_ratio_pct: ratio ?? null,
      source: action.source ?? null,
      parse_status: action.parse_status ?? null,
    },
  };
}

/**
 * BE news item -> widget NewsItem (`publishedAt` ms epoch).
 * @param {object} item
 * @param {string} [symbol]
 * @returns {object|null} null khi ngay hong (bo item).
 */
export function mapNewsToNewsItem(item, symbol = '') {
  if (!item || typeof item !== 'object') return null;
  const publishedAt = Date.parse(item.published_at);
  if (!Number.isFinite(publishedAt)) return null;
  return {
    id: item.news_id || item.url || '',
    symbol,
    title: item.title || '',
    url: item.url || '',
    publishedAt,
    source: item.source ?? null,
    snippet: item.summary || '',
  };
}

/**
 * Map + loc ngay hong + cat theo limit (tam thay Task 2 BE dang tach slice).
 * @param {Array} news
 * @param {number} [limit]
 * @returns {Array}
 */
export function mapNewsListToNewsItems(news, limit = 20) {
  const capped = Array.isArray(news)
    ? news.slice(0, Math.max(0, limit ?? 20))
    : [];
  const out = [];
  for (const item of capped) {
    const mapped = mapNewsToNewsItem(item);
    if (mapped) out.push(mapped);
  }
  return out;
}
