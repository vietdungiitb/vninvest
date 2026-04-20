/**
 * hooks/useWatchlistProcessor.js
 * Tách toàn bộ logic filter/sort/pagination/merge ra khỏi UI component.
 * Bao gồm: Strategy Filters (Phase B), Price History (Phase A sparklines).
 */
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  mergeTickerIntoItem,
  applyStrategyFilter,
  sortTrackedRows,
  sortGroupRows,
} from '../utils/watchlistHelpers';

const MAX_SPARKLINE_BUFFER = 30;

/**
 * @param {Object} params
 * @param {Array}  params.trackedSymbols       - raw tracked symbols from API
 * @param {Object} params.quotesBySymbol       - realtime quotes map
 * @param {Array}  params.priceAlerts          - price alert rules from API
 * @param {Array}  params.groups               - securities groups from API
 * @param {*}      params.view                 - 'tracked' | groupId (number)
 * @param {number} params.MAX_RT_SYMBOLS       - cap for realtime subscription
 */
export default function useWatchlistProcessor({
  trackedSymbols,
  quotesBySymbol,
  priceAlerts,
  groups,
  view,
  MAX_RT_SYMBOLS = 120,
}) {
  // ── Tracked symbol filters ────────────────────────────────────────────────
  const [trackedThresholdFilter, setTrackedThresholdFilter] = useState('all');
  const [trackedSortBy, setTrackedSortBy] = useState('symbol_asc');
  const [trackedDataFilter, setTrackedDataFilter] = useState('all');
  const [trackedSymbolSearch, setTrackedSymbolSearch] = useState('');
  const [trackedPageSize, setTrackedPageSize] = useState(20);
  const [trackedPage, setTrackedPage] = useState(1);

  // ── Group filters ─────────────────────────────────────────────────────────
  const [groupTrackedFilter, setGroupTrackedFilter] = useState('all');
  const [groupDataFilter, setGroupDataFilter] = useState('all');
  const [groupSymbolSearch, setGroupSymbolSearch] = useState('');
  const [groupSort, setGroupSort] = useState({ key: 'symbol', direction: 'asc' });
  const [groupPageSize, setGroupPageSize] = useState(20);
  const [groupPage, setGroupPage] = useState(1);

  // ── Strategy filter (Phase B) ─────────────────────────────────────────────
  const [strategyFilter, setStrategyFilter] = useState('all');

  // ── Sparkline price history (Phase A) ────────────────────────────────────
  // Map: symbol → circular buffer of prices (oldest→newest)
  const priceHistoryRef = useRef({});

  // Reset pagination when filters change
  useEffect(() => {
    setGroupPage(1);
  }, [view, groupTrackedFilter, groupDataFilter, groupSymbolSearch, groupPageSize]);

  useEffect(() => {
    setTrackedPage(1);
  }, [trackedThresholdFilter, trackedDataFilter, trackedSymbolSearch, trackedPageSize, strategyFilter]);

  // ── Accumulate price history for sparklines ───────────────────────────────
  useEffect(() => {
    if (!quotesBySymbol) return;
    Object.entries(quotesBySymbol).forEach(([symbol, quote]) => {
      const price = Number(quote?.current_price ?? quote?.price);
      if (!Number.isFinite(price) || price <= 0) return;
      if (!priceHistoryRef.current[symbol]) {
        priceHistoryRef.current[symbol] = [];
      }
      const buf = priceHistoryRef.current[symbol];
      // Avoid duplicates: only push if price changed
      if (buf.length === 0 || buf[buf.length - 1] !== price) {
        buf.push(price);
        if (buf.length > MAX_SPARKLINE_BUFFER) {
          buf.shift();
        }
      }
    });
  }, [quotesBySymbol]);

  // ── Realtime symbols list (feed subscription) ─────────────────────────────
  const allRealtimeSymbols = useMemo(() => {
    const tracked = trackedSymbols.map((item) => item.symbol).filter(Boolean);
    const alertSymbols = priceAlerts.map((rule) => rule.symbol).filter(Boolean);
    const activeGroupSymbols = (() => {
      if (view === 'tracked') return [];
      const group = groups.find((g) => g.id === view);
      return (group?.items || []).map((item) => item.symbol).filter(Boolean);
    })();
    return [
      ...new Set([...tracked, ...alertSymbols, ...activeGroupSymbols]),
    ].slice(0, MAX_RT_SYMBOLS);
  }, [groups, trackedSymbols, priceAlerts, view, MAX_RT_SYMBOLS]);

  // ── Merge realtime data ───────────────────────────────────────────────────
  const trackedSymbolsWithRealtime = useMemo(
    () => trackedSymbols.map((item) =>
      mergeTickerIntoItem(item, quotesBySymbol[item.symbol] || {}),
    ),
    [trackedSymbols, quotesBySymbol],
  );

  const groupsWithRealtime = useMemo(
    () => groups.map((group) => ({
      ...group,
      items: group.items.map((item) =>
        mergeTickerIntoItem(item, quotesBySymbol[item.symbol] || {}),
      ),
    })),
    [groups, quotesBySymbol],
  );

  const priceAlertsWithRealtime = useMemo(
    () => priceAlerts.map((rule) => ({
      ...rule,
      current_price: quotesBySymbol[rule.symbol]?.current_price ?? rule.current_price,
      stale: quotesBySymbol[rule.symbol]?.stale ?? false,
    })),
    [priceAlerts, quotesBySymbol],
  );

  // ── Derived sets/maps ─────────────────────────────────────────────────────
  const trackedSymbolMap = useMemo(
    () => new Map(trackedSymbolsWithRealtime.map((item) => [item.symbol, item])),
    [trackedSymbolsWithRealtime],
  );
  const trackedSymbolSet = useMemo(
    () => new Set(trackedSymbolsWithRealtime.map((item) => item.symbol)),
    [trackedSymbolsWithRealtime],
  );

  // ── Active group ──────────────────────────────────────────────────────────
  const activeGroup = useMemo(
    () => view !== 'tracked' ? groupsWithRealtime.find((g) => g.id === view) || null : null,
    [view, groupsWithRealtime],
  );

  // ── Stats ─────────────────────────────────────────────────────────────────
  const trackedStats = useMemo(() => ({
    up: trackedSymbolsWithRealtime.filter((t) => t.change_pct > 0).length,
    down: trackedSymbolsWithRealtime.filter((t) => t.change_pct < 0).length,
  }), [trackedSymbolsWithRealtime]);

  const trackedWithOverrideCount = useMemo(
    () => trackedSymbolsWithRealtime.filter((item) => item.whale_alert_threshold_million != null).length,
    [trackedSymbolsWithRealtime],
  );
  const trackedWithUserDefaultCount = trackedSymbolsWithRealtime.length - trackedWithOverrideCount;

  const groupStats = useMemo(
    () => activeGroup
      ? activeGroup.items.reduce(
          (acc, item) => {
            if (item.change_pct > 0) acc.up++;
            else if (item.change_pct < 0) acc.down++;
            else acc.flat++;
            return acc;
          },
          { up: 0, down: 0, flat: 0 },
        )
      : null,
    [activeGroup],
  );

  // ── Tracked: filter pipeline ──────────────────────────────────────────────
  const filteredTracked = useMemo(() => {
    let rows = trackedSymbolsWithRealtime;

    // Threshold filter
    if (trackedThresholdFilter === 'symbol') {
      rows = rows.filter((item) => item.whale_alert_threshold_million != null);
    } else if (trackedThresholdFilter === 'user') {
      rows = rows.filter((item) => item.whale_alert_threshold_million == null);
    }

    // Symbol search
    const keyword = String(trackedSymbolSearch || '').trim().toUpperCase();
    if (keyword) {
      rows = rows.filter((item) => String(item.symbol || '').toUpperCase().includes(keyword));
    }

    // Data filter
    if (trackedDataFilter === 'synced') {
      rows = rows.filter((item) => !item.stale && item.current_price != null);
    } else if (trackedDataFilter === 'stale') {
      rows = rows.filter((item) => item.stale || item.current_price == null);
    } else if (trackedDataFilter === 'gainers') {
      rows = rows.filter((item) => Number(item.change_pct) > 0);
    } else if (trackedDataFilter === 'losers') {
      rows = rows.filter((item) => Number(item.change_pct) < 0);
    } else if (trackedDataFilter === 'flat') {
      rows = rows.filter((item) => Number(item.change_pct) === 0);
    }

    // Strategy filter (Phase B) — only applies when we have indicator data
    rows = applyStrategyFilter(rows, strategyFilter);

    return rows;
  }, [trackedSymbolsWithRealtime, trackedThresholdFilter, trackedSymbolSearch, trackedDataFilter, strategyFilter]);

  const sortedTracked = useMemo(
    () => sortTrackedRows(filteredTracked, trackedSortBy),
    [filteredTracked, trackedSortBy],
  );

  const trackedTotalPages = Math.max(1, Math.ceil(sortedTracked.length / trackedPageSize));
  const trackedCurrentPage = Math.min(trackedPage, trackedTotalPages);

  const pagedTracked = useMemo(() => {
    const start = (trackedCurrentPage - 1) * trackedPageSize;
    return sortedTracked.slice(start, start + trackedPageSize);
  }, [sortedTracked, trackedCurrentPage, trackedPageSize]);

  // ── Group: filter pipeline ────────────────────────────────────────────────
  const activeGroupItems = activeGroup?.items || [];
  const activeGroupTrackedCount = useMemo(
    () => activeGroupItems.filter((item) => trackedSymbolSet.has(item.symbol)).length,
    [activeGroupItems, trackedSymbolSet],
  );
  const activeGroupUntrackedCount = activeGroupItems.length - activeGroupTrackedCount;
  const activeGroupTrackedItems = useMemo(
    () => activeGroupItems.map((item) => trackedSymbolMap.get(item.symbol)).filter(Boolean),
    [activeGroupItems, trackedSymbolMap],
  );

  const filteredGroupItems = useMemo(() => {
    let rows = activeGroupItems;

    if (groupTrackedFilter === 'tracked') {
      rows = rows.filter((item) => trackedSymbolSet.has(item.symbol));
    } else if (groupTrackedFilter === 'untracked') {
      rows = rows.filter((item) => !trackedSymbolSet.has(item.symbol));
    }

    const keyword = String(groupSymbolSearch || '').trim().toUpperCase();
    if (keyword) {
      rows = rows.filter((item) => String(item.symbol || '').toUpperCase().includes(keyword));
    }

    if (groupDataFilter === 'synced') {
      rows = rows.filter((item) => !item.stale && item.current_price != null);
    } else if (groupDataFilter === 'stale') {
      rows = rows.filter((item) => item.stale || item.current_price == null);
    } else if (groupDataFilter === 'gainers') {
      rows = rows.filter((item) => Number(item.change_pct) > 0);
    } else if (groupDataFilter === 'losers') {
      rows = rows.filter((item) => Number(item.change_pct) < 0);
    } else if (groupDataFilter === 'flat') {
      rows = rows.filter((item) => Number(item.change_pct) === 0);
    }

    return rows;
  }, [activeGroupItems, groupTrackedFilter, trackedSymbolSet, groupSymbolSearch, groupDataFilter]);

  const sortedGroupItems = useMemo(
    () => sortGroupRows(filteredGroupItems, groupSort),
    [filteredGroupItems, groupSort],
  );

  const groupTotalPages = Math.max(1, Math.ceil(sortedGroupItems.length / groupPageSize));
  const groupCurrentPage = Math.min(groupPage, groupTotalPages);

  const pagedGroupItems = useMemo(() => {
    const start = (groupCurrentPage - 1) * groupPageSize;
    return sortedGroupItems.slice(start, start + groupPageSize);
  }, [sortedGroupItems, groupCurrentPage, groupPageSize]);

  // ── Sort indicator helpers ────────────────────────────────────────────────
  const toggleTrackedSort = useCallback((key) => {
    setTrackedSortBy((prev) => {
      const normalized = String(prev || 'symbol_asc');
      const splitIndex = normalized.lastIndexOf('_');
      const prevKey = splitIndex > 0 ? normalized.slice(0, splitIndex) : 'symbol';
      const prevDir = splitIndex > 0 ? normalized.slice(splitIndex + 1) : 'asc';
      if (prevKey === key) return `${key}_${prevDir === 'asc' ? 'desc' : 'asc'}`;
      return `${key}_asc`;
    });
  }, []);

  const getTrackedSortIndicator = useCallback((key) => {
    const normalized = String(trackedSortBy || 'symbol_asc');
    const splitIndex = normalized.lastIndexOf('_');
    const activeKey = splitIndex > 0 ? normalized.slice(0, splitIndex) : 'symbol';
    const activeDir = splitIndex > 0 ? normalized.slice(splitIndex + 1) : 'asc';
    if (activeKey !== key) return '↕';
    return activeDir === 'asc' ? '↑' : '↓';
  }, [trackedSortBy]);

  const toggleGroupSort = useCallback((key) => {
    setGroupSort((prev) => {
      if (prev.key === key) return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      return { key, direction: 'asc' };
    });
  }, []);

  const getGroupSortIndicator = useCallback((key) => {
    if (groupSort.key !== key) return '↕';
    return groupSort.direction === 'asc' ? '↑' : '↓';
  }, [groupSort]);

  // ── Sparkline getter ──────────────────────────────────────────────────────
  const getSparklinePrices = useCallback((symbol) => {
    return priceHistoryRef.current[symbol] || [];
  }, []);

  return {
    // Realtime symbols
    allRealtimeSymbols,

    // Merged data
    trackedSymbolsWithRealtime,
    groupsWithRealtime,
    priceAlertsWithRealtime,

    // Maps/sets
    trackedSymbolMap,
    trackedSymbolSet,
    activeGroup,
    activeGroupItems,
    activeGroupTrackedCount,
    activeGroupUntrackedCount,
    activeGroupTrackedItems,

    // Stats
    trackedStats,
    trackedWithOverrideCount,
    trackedWithUserDefaultCount,
    groupStats,

    // Tracked processed data
    pagedTracked,
    sortedTracked,
    trackedTotalPages,
    trackedCurrentPage,

    // Group processed data
    pagedGroupItems,
    sortedGroupItems,
    groupTotalPages,
    groupCurrentPage,

    // Tracked filter state + setters
    trackedThresholdFilter, setTrackedThresholdFilter,
    trackedSortBy, setTrackedSortBy,
    trackedDataFilter, setTrackedDataFilter,
    trackedSymbolSearch, setTrackedSymbolSearch,
    trackedPageSize, setTrackedPageSize,
    trackedPage: trackedCurrentPage, setTrackedPage,

    // Group filter state + setters
    groupTrackedFilter, setGroupTrackedFilter,
    groupDataFilter, setGroupDataFilter,
    groupSymbolSearch, setGroupSymbolSearch,
    groupSort, setGroupSort,
    groupPageSize, setGroupPageSize,
    groupPage: groupCurrentPage, setGroupPage,

    // Strategy filter (Phase B)
    strategyFilter, setStrategyFilter,

    // Sort helpers
    toggleTrackedSort, getTrackedSortIndicator,
    toggleGroupSort, getGroupSortIndicator,

    // Phase A: sparklines
    getSparklinePrices,
  };
}
