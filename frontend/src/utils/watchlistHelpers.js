/**
 * utils/watchlistHelpers.js
 * Pure utility functions for Watchlist — no React dependencies.
 * Safe to import in hooks, workers, and components.
 */

// ─── Severity helpers ────────────────────────────────────────────────────────

export function severityTone(severity) {
  if (severity === 'extreme') return 'bg-rose-500 text-white border-rose-400/40';
  if (severity === 'high') return 'bg-amber-400 text-slate-950 border-amber-300/40';
  if (severity === 'medium') return 'bg-cyan-400 text-slate-950 border-cyan-300/40';
  return 'bg-slate-800 text-slate-200 border-slate-600/40';
}

export function severityLabel(severity, t) {
  const normalizedSeverity = String(severity || '').toLowerCase();
  if (normalizedSeverity === 'extreme') return t('whaleHub.severityExtreme');
  if (normalizedSeverity === 'high') return t('whaleHub.severityHigh');
  if (normalizedSeverity === 'medium') return t('whaleHub.severityMedium');
  return t('whaleHub.severityLow');
}

// ─── Number helpers ───────────────────────────────────────────────────────────

export function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function resolveWatchlistPriceScale(currentPrice, prevPrice) {
  const current = toFiniteNumber(currentPrice);
  const prev = toFiniteNumber(prevPrice);

  if (current === null || current <= 0) return 1;
  // Quy ước hiển thị nghìn VNĐ nếu giá ở đơn vị VNĐ tuyệt đối (>= 2000)
  if (current >= 2000) return 0.001;
  if (prev !== null && prev > 0 && prev >= 2000) return 0.001;
  return 1;
}

// ─── Realtime merge helpers ───────────────────────────────────────────────────

/**
 * Merge a realtime ticker update into a tracked symbol row.
 * Supports Phase B indicator fields: rsi_14, ma20_dist_pct, rvol.
 */
export function mergeTickerIntoItem(item, update) {
  if (!update || Object.keys(update).length === 0) return item;
  if (item.symbol !== update.symbol) return item;

  const realtimeDate = update.last_date ?? update.ts;

  return {
    ...item,
    current_price: update.current_price ?? update.price ?? item.current_price,
    prev_price: update.prev_price ?? item.prev_price,
    change_value: update.change_value ?? item.change_value,
    change_pct: update.change_pct ?? item.change_pct,
    last_date: realtimeDate ?? item.last_date,
    updated_at: realtimeDate ?? item.updated_at,
    freshness_seconds: update.freshness_seconds ?? item.freshness_seconds,
    stale: update.stale ?? item.stale,
    // Phase B: indicator fields from backend compute
    rsi_14: update.rsi_14 ?? item.rsi_14 ?? null,
    ma20_dist_pct: update.ma20_dist_pct ?? item.ma20_dist_pct ?? null,
    rvol: update.rvol ?? item.rvol ?? null,
    indicator_ts: update.indicator_ts ?? item.indicator_ts ?? null,
  };
}

// ─── Price alert helpers ──────────────────────────────────────────────────────

export function isPriceAlertMatched(rule, currentPrice) {
  const targetPrice = Number(rule?.target_price);
  const normalizedCurrentPrice = Number(currentPrice);
  if (!Number.isFinite(targetPrice) || !Number.isFinite(normalizedCurrentPrice)) return false;

  return rule.condition === 'ABOVE'
    ? normalizedCurrentPrice >= targetPrice
    : normalizedCurrentPrice <= targetPrice;
}

// ─── API error extraction ─────────────────────────────────────────────────────

export function extractApiErrorMessage(error, fallbackMessage) {
  const payload = error?.response?.data;
  if (!payload) return fallbackMessage;
  if (typeof payload === 'string') return payload;
  if (typeof payload.detail === 'string' && payload.detail.trim()) return payload.detail;
  const firstField = Object.values(payload).find((value) => value != null);
  if (typeof firstField === 'string') return firstField;
  if (Array.isArray(firstField) && firstField.length > 0) return String(firstField[0]);
  return fallbackMessage;
}

// ─── Strategy filter logic (Phase B) ─────────────────────────────────────────

/**
 * Apply strategy filter to an array of tracked symbol rows.
 * @param {Array} rows - merged symbol rows with realtime data
 * @param {string} strategyFilter - one of: 'all', 'rsi_overbought', 'rsi_oversold',
 *   'vol_breakout', 'near_ma20', 'whale_triggered', 'gainers', 'losers', 'stale'
 * @param {Object} options - { userWhaleThreshold } for whale_triggered filter
 */
export function applyStrategyFilter(rows, strategyFilter, options = {}) {
  if (!strategyFilter || strategyFilter === 'all') return rows;

  return rows.filter((item) => {
    switch (strategyFilter) {
      case 'rsi_overbought':
        return item.rsi_14 != null && Number(item.rsi_14) > 70;
      case 'rsi_oversold':
        return item.rsi_14 != null && Number(item.rsi_14) < 30;
      case 'vol_breakout':
        return item.rvol != null && Number(item.rvol) >= 2.0;
      case 'near_ma20':
        return item.ma20_dist_pct != null && Math.abs(Number(item.ma20_dist_pct)) <= 1.0;
      case 'whale_triggered': {
        const threshold = item.whale_alert_threshold_million
          ?? options.userWhaleThreshold
          ?? null;
        if (threshold == null || item.current_price == null) return false;
        // Đơn giản: hiển thị nếu ngưỡng được thiết lập
        return item.whale_alert_threshold_million != null;
      }
      case 'gainers':
        return Number(item.change_pct) > 0;
      case 'losers':
        return Number(item.change_pct) < 0;
      case 'stale':
        return item.stale === true;
      default:
        return true;
    }
  });
}

// ─── Sorting helpers ──────────────────────────────────────────────────────────

export function sortTrackedRows(rows, trackedSortBy) {
  const sorted = [...rows];
  const scoreThreshold = (item) =>
    item.whale_alert_threshold_million == null ? -1 : Number(item.whale_alert_threshold_million);
  const scoreNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : -Infinity;
  };
  const scoreDate = (value) => {
    if (!value) return 0;
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  };

  switch (trackedSortBy) {
    case 'threshold_desc': sorted.sort((a, b) => scoreThreshold(b) - scoreThreshold(a)); break;
    case 'threshold_asc': sorted.sort((a, b) => scoreThreshold(a) - scoreThreshold(b)); break;
    case 'symbol_desc': sorted.sort((a, b) => String(b.symbol || '').localeCompare(String(a.symbol || ''))); break;
    case 'current_price_asc': sorted.sort((a, b) => scoreNumber(a.current_price) - scoreNumber(b.current_price)); break;
    case 'current_price_desc': sorted.sort((a, b) => scoreNumber(b.current_price) - scoreNumber(a.current_price)); break;
    case 'change_value_asc': sorted.sort((a, b) => scoreNumber(a.change_value) - scoreNumber(b.change_value)); break;
    case 'change_value_desc': sorted.sort((a, b) => scoreNumber(b.change_value) - scoreNumber(a.change_value)); break;
    case 'change_pct_asc': sorted.sort((a, b) => scoreNumber(a.change_pct) - scoreNumber(b.change_pct)); break;
    case 'change_pct_desc': sorted.sort((a, b) => scoreNumber(b.change_pct) - scoreNumber(a.change_pct)); break;
    case 'updated_at_asc': sorted.sort((a, b) => scoreDate(a.updated_at) - scoreDate(b.updated_at)); break;
    case 'updated_at_desc': sorted.sort((a, b) => scoreDate(b.updated_at) - scoreDate(a.updated_at)); break;
    case 'rsi_desc': sorted.sort((a, b) => scoreNumber(b.rsi_14) - scoreNumber(a.rsi_14)); break;
    case 'rsi_asc': sorted.sort((a, b) => scoreNumber(a.rsi_14) - scoreNumber(b.rsi_14)); break;
    case 'rvol_desc': sorted.sort((a, b) => scoreNumber(b.rvol) - scoreNumber(a.rvol)); break;
    default: sorted.sort((a, b) => String(a.symbol || '').localeCompare(String(b.symbol || '')));
  }
  return sorted;
}

export function sortGroupRows(rows, groupSort) {
  const sorted = [...rows];
  const safeString = (value) => String(value || '').toUpperCase();
  const safeNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : -Infinity;
  };
  const safeDate = (value) => {
    if (!value) return 0;
    const dt = new Date(value).getTime();
    return Number.isFinite(dt) ? dt : 0;
  };

  sorted.sort((left, right) => {
    let compare = 0;
    if (groupSort.key === 'symbol') {
      compare = safeString(left.symbol).localeCompare(safeString(right.symbol));
    } else if (groupSort.key === 'current_price') {
      compare = safeNumber(left.current_price) - safeNumber(right.current_price);
    } else if (groupSort.key === 'change_value') {
      compare = safeNumber(left.change_value) - safeNumber(right.change_value);
    } else if (groupSort.key === 'change_pct') {
      compare = safeNumber(left.change_pct) - safeNumber(right.change_pct);
    } else if (groupSort.key === 'last_date') {
      compare = safeDate(left.last_date) - safeDate(right.last_date);
    }
    if (compare === 0) compare = safeString(left.symbol).localeCompare(safeString(right.symbol));
    return groupSort.direction === 'asc' ? compare : -compare;
  });
  return sorted;
}
