/**
 * Column Definition Presets for RealtimeQuoteTable
 * 
 * Pre-configured column sets for common use cases (Dashboard, Watchlist, etc.)
 */

export const COLUMN_PRESETS = {
  // Dashboard market status columns
  DASHBOARD_MARKET_STATUS: [
    {
      key: 'symbol',
      label: 'Mã CK',
      sortable: true,
      width: '100px',
    },
    {
      key: 'current_price',
      label: 'Giá',
      sortable: true,
      width: '120px',
    },
    {
      key: 'change_pct',
      label: '% Thay đổi',
      sortable: true,
      width: '120px',
    },
    {
      key: 'freshness_seconds',
      label: 'Mới nhất',
      sortable: false,
      width: '100px',
    },
    {
      key: 'age_seconds',
      label: 'Tuổi dữ liệu',
      sortable: false,
      width: '110px',
    },
  ],

  // Watchlist tracked symbols columns
  WATCHLIST_TRACKED: [
    {
      key: 'symbol',
      label: 'Mã CK',
      sortable: true,
      width: '100px',
    },
    {
      key: 'current_price',
      label: 'Giá hiện tại',
      sortable: true,
      width: '120px',
    },
    {
      key: 'change_pct',
      label: '% Thay đổi',
      sortable: true,
      width: '120px',
    },
    {
      key: 'change',
      label: 'Thay đổi',
      sortable: true,
      width: '100px',
    },
    {
      key: 'freshness_seconds',
      label: 'Mới nhất',
      sortable: false,
      width: '100px',
    },
    {
      key: 'age_seconds',
      label: 'Tuổi dữ liệu',
      sortable: false,
      width: '110px',
    },
  ],

  // Watchlist groups columns
  WATCHLIST_GROUPS: [
    {
      key: 'symbol',
      label: 'Mã CK',
      sortable: true,
      width: '100px',
    },
    {
      key: 'current_price',
      label: 'Giá',
      sortable: true,
      width: '120px',
    },
    {
      key: 'change_pct',
      label: '% Thay đổi',
      sortable: true,
      width: '120px',
    },
    {
      key: 'freshness_seconds',
      label: 'Mới nhất',
      sortable: false,
      width: '100px',
    },
    {
      key: 'age_seconds',
      label: 'Tuổi dữ liệu',
      sortable: false,
      width: '110px',
    },
  ],
};

/**
 * Filter quote by search term
 */
export function filterQuotesBySearch(quotes, searchTerm) {
  if (!searchTerm || searchTerm.trim() === '') {
    return quotes;
  }

  const term = searchTerm.toUpperCase();
  return quotes.filter((q) => q.symbol.includes(term));
}

/**
 * Filter quotes by price movement
 */
export function filterQuotesByMovement(quotes, filter) {
  // filter: 'gainers', 'losers', 'flat', 'all'
  if (filter === 'all') return quotes;

  return quotes.filter((q) => {
    const change = q.change_pct ?? 0;
    if (filter === 'gainers') return change > 0;
    if (filter === 'losers') return change < 0;
    if (filter === 'flat') return change === 0;
    return true;
  });
}

/**
 * Filter quotes by data freshness
 */
export function filterQuotesByFreshness(quotes, filter) {
  // filter: 'synced', 'stale', 'all'
  if (filter === 'all') return quotes;

  return quotes.filter((q) => {
    if (filter === 'synced') return !q.stale;
    if (filter === 'stale') return q.stale;
    return true;
  });
}

/**
 * Sort quotes by key and direction
 */
export function sortQuotes(quotes, sortConfig) {
  if (!sortConfig || !sortConfig.key) {
    return quotes;
  }

  const sorted = [...quotes].sort((a, b) => {
    const aVal = a[sortConfig.key];
    const bVal = b[sortConfig.key];

    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    if (typeof aVal === 'string') {
      return sortConfig.direction === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
  });

  return sorted;
}

/**
 * Paginate quotes
 */
export function paginateQuotes(quotes, page = 1, pageSize = 20) {
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  return quotes.slice(start, end);
}

/**
 * Get total pages
 */
export function getTotalPages(totalItems, pageSize = 20) {
  return Math.ceil(totalItems / pageSize);
}
