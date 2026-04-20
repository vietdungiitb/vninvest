/**
 * pages/Watchlist.jsx
 * Radar thá»‹ trÆ°á»ng â€” tÃ¡ch rÃµ 2 lá»›p dÃ¹ng dá»¯ liá»‡u:
 * 1) NhÃ³m thá»‹ trÆ°á»ng Ä‘á»ƒ quÃ©t rá»™ng theo ngÃ nh/vá»‘n hÃ³a/chá»§ Ä‘á».
 * 2) Danh sÃ¡ch theo dÃµi Ä‘á»ƒ bÃ¡m sÃ¡t realtime.
 */
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getSecuritiesGroups, seedSecurities, syncSecuritiesPrices,
  getTrackedSymbols, addTrackedSymbol, updateTrackedSymbol, bulkUpdateTrackedSymbolThreshold, deleteTrackedSymbol,
  syncStockProfile,
  getPriceAlerts, createPriceAlert, updatePriceAlert, deletePriceAlert, markPriceAlertTriggered,
} from '../api/client';
import { usePortfolio } from '../context/PortfolioContext';
import { useI18n } from '../context/LangContext';
import useRealtimeFeed from '../hooks/useRealtimeFeed';
import RealtimeDebugPanel from '../components/RealtimeDebugPanel';
import { RealtimeQuoteTable } from '../components/RealtimeQuoteTable';
import SmartRadarTable from '../components/watchlist/SmartRadarTable';
import PriceAlertModule from '../components/watchlist/PriceAlertModule';
import WatchlistManagementPanel from '../components/watchlist/WatchlistManagementPanel';
import { ChangeCell } from '../components/watchlist/WatchlistCells';
import {
  severityTone, severityLabel, mergeTickerIntoItem,
  isPriceAlertMatched, extractApiErrorMessage, applyStrategyFilter,
} from '../utils/watchlistHelpers';

function PctCell({ pct, emptyLabel }) {
  if (pct === null || pct === undefined) {
    return <span className="text-gray-600 text-xs">{emptyLabel}</span>;
  }
  const isUp = pct > 0;
  const isDown = pct < 0;
  return (
    <span className={`font-bold tabular-nums ${isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-gray-400'}`}>
      {isUp ? '+' : ''}{pct.toFixed(2)}%
    </span>
  );
}

function formatPrice(val, formatNumberFn) {
  if (val === null || val === undefined) return <span className="text-gray-600">â€”</span>;
  return <span className="text-gray-200 tabular-nums">{formatNumberFn(val)}</span>;
}

export default function WatchlistPage() {
  const MAX_WATCHLIST_RT_SYMBOLS = 120;
  const navigate = useNavigate();
  const { userConfig, isAuthenticated } = usePortfolio();
  const { t, formatNumber, formatTime, formatDateTime, formatQuotePrice } = useI18n();
  const realtimeLabels = useMemo(() => ({
    idle: t('watchlist.statusIdle'),
    connecting: t('watchlist.statusConnecting'),
    live: t('watchlist.statusLive'),
    polling: t('watchlist.statusPolling'),
  }), [t]);
  const priceAlertConditionLabels = useMemo(() => ({
    ABOVE: t('watchlist.above'),
    BELOW: t('watchlist.below'),
  }), [t]);
  const typeLabels = useMemo(() => ({
    SECTOR: t('watchlist.groupTypeSector'),
    MARKET_CAP: t('watchlist.groupTypeMarketCap'),
    CUSTOM: t('watchlist.groupTypeCustom'),
  }), [t]);
  const [groups, setGroups] = useState([]);
  const [view, setView] = useState('tracked'); // 'tracked' | number (groupId)
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [syncCooldownSeconds, setSyncCooldownSeconds] = useState(0);
  const [syncingStockProfile, setSyncingStockProfile] = useState(false);

  // MÃ£ Theo dÃµi state
  const [trackedSymbols, setTrackedSymbols] = useState([]);
  const [trackedLoading, setTrackedLoading] = useState(false);
  const [priceAlerts, setPriceAlerts] = useState([]);
  const [priceAlertsLoading, setPriceAlertsLoading] = useState(false);
  const [priceAlertForm, setPriceAlertForm] = useState({
    symbol: '',
    condition: 'ABOVE',
    targetPrice: '',
    cooldownSeconds: '300',
  });
  const [priceAlertSaving, setPriceAlertSaving] = useState(false);
  const [priceAlertError, setPriceAlertError] = useState('');
  const [priceAlertMsg, setPriceAlertMsg] = useState('');
  const [triggeredPriceAlerts, setTriggeredPriceAlerts] = useState([]);
  const [addingFromGroup, setAddingFromGroup] = useState({});
  const [bulkGroupAction, setBulkGroupAction] = useState(null);
  const [trackedBulkAction, setTrackedBulkAction] = useState(null);
  const [groupTrackedFilter, setGroupTrackedFilter] = useState('all');
  const [groupDataFilter, setGroupDataFilter] = useState('all');
  const [groupSymbolSearch, setGroupSymbolSearch] = useState('');
  const [groupSort, setGroupSort] = useState({ key: 'symbol', direction: 'asc' });
  const [groupPageSize, setGroupPageSize] = useState(20);
  const [groupPage, setGroupPage] = useState(1);
  const [trackedThresholdFilter, setTrackedThresholdFilter] = useState('all');
  const [trackedSortBy, setTrackedSortBy] = useState('symbol_asc');
  const [trackedDataFilter, setTrackedDataFilter] = useState('all');
  const [trackedSymbolSearch, setTrackedSymbolSearch] = useState('');
  const [trackedPageSize, setTrackedPageSize] = useState(20);
  const [trackedPage, setTrackedPage] = useState(1);
  // Phase B: strategy filter
  const [strategyFilter, setStrategyFilter] = useState('all');
  // Phase A: sparkline price history (ring buffer per symbol, max 30 ticks)
  const priceHistoryRef = useRef({});
  const getSparklinePrices = useCallback((symbol) => priceHistoryRef.current[symbol] || [], []);
  const triggeringAlertIdsRef = useRef(new Set());
  const syncCooldownIntervalRef = useRef(null);

  const clearSyncCooldownTimer = useCallback(() => {
    if (syncCooldownIntervalRef.current) {
      window.clearInterval(syncCooldownIntervalRef.current);
      syncCooldownIntervalRef.current = null;
    }
  }, []);

  const startSyncCooldown = useCallback((seconds) => {
    clearSyncCooldownTimer();
    const initial = Math.max(Math.ceil(Number(seconds) || 0), 1);
    setSyncCooldownSeconds(initial);
    setSyncMsg(t('watchlist.syncRetryIn', { seconds: initial }));

    syncCooldownIntervalRef.current = window.setInterval(() => {
      setSyncCooldownSeconds((prev) => {
        if (prev <= 1) {
          clearSyncCooldownTimer();
          return 0;
        }
        const next = prev - 1;
        setSyncMsg(t('watchlist.syncRetryIn', { seconds: next }));
        return next;
      });
    }, 1000);
  }, [clearSyncCooldownTimer, t]);

  useEffect(() => () => {
    clearSyncCooldownTimer();
  }, [clearSyncCooldownTimer]);

  const handleSyncStockProfile = async () => {
    setSyncingStockProfile(true);
    setSyncMsg('');
    try {
      await syncStockProfile();
      setSyncMsg(t('watchlist.stockProfileSyncSuccess'));
    } catch {
      setSyncMsg(t('watchlist.stockProfileSyncFailed'));
    } finally {
      setSyncingStockProfile(false);
      setTimeout(() => setSyncMsg(''), 5000);
    }
  };

  // Form thÃªm MÃ£ Theo dÃµi
  const [srcGroupId, setSrcGroupId] = useState('');
  const [addSymbol, setAddSymbol] = useState('');
  const [addThresholdMillion, setAddThresholdMillion] = useState('');
  const [bulkThresholdMillion, setBulkThresholdMillion] = useState('');
  const [addingSymbol, setAddingSymbol] = useState(false);
  const [updatingTrackedId, setUpdatingTrackedId] = useState(null);
  const [editingTrackedId, setEditingTrackedId] = useState(null);
  const [editingTrackedThresholdValue, setEditingTrackedThresholdValue] = useState('');
  const [symbolError, setSymbolError] = useState('');

  const loadGroups = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const res = await getSecuritiesGroups();
      setGroups(res.data);
    } catch (err) {
      console.error('loadGroups:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const fetchTracked = useCallback(async () => {
    if (!isAuthenticated) return;
    setTrackedLoading(true);
    try {
      const res = await getTrackedSymbols();
      setTrackedSymbols(res.data);
    } catch (err) {
      console.error('fetchTracked:', err);
    } finally {
      setTrackedLoading(false);
    }
  }, [isAuthenticated]);

  const fetchPriceAlerts = useCallback(async () => {
    if (!isAuthenticated) return;
    setPriceAlertsLoading(true);
    try {
      const res = await getPriceAlerts();
      setPriceAlerts(res.data || []);
    } catch (err) {
      console.error('fetchPriceAlerts:', err);
    } finally {
      setPriceAlertsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadGroups();
    fetchTracked();
    fetchPriceAlerts();
  }, [loadGroups, fetchTracked, fetchPriceAlerts]);

  const allRealtimeSymbols = useMemo(() => {
    const tracked = trackedSymbols.map((item) => item.symbol).filter(Boolean);
    const alertSymbols = priceAlerts.map((rule) => rule.symbol).filter(Boolean);

    const activeGroupSymbols = (() => {
      if (view === 'tracked') return [];
      const group = groups.find((g) => g.id === view);
      return (group?.items || []).map((item) => item.symbol).filter(Boolean);
    })();

    return [
      ...new Set([
        ...tracked,
        ...alertSymbols,
        ...activeGroupSymbols,
      ]),
    ].slice(0, MAX_WATCHLIST_RT_SYMBOLS);
  }, [groups, trackedSymbols, priceAlerts, view]);

  const {
    quotesBySymbol,
    realtimeStatus,
    lastEventAt: lastRealtimeAt,
    latestWhaleAlert,
  } = useRealtimeFeed({ symbols: allRealtimeSymbols, pollInterval: 5000 });

  // Phase A: accumulate sparkline price history per symbol (max 30 ticks)
  useEffect(() => {
    if (!quotesBySymbol) return;
    Object.entries(quotesBySymbol).forEach(([symbol, quote]) => {
      const price = Number(quote?.current_price ?? quote?.price);
      if (!Number.isFinite(price) || price <= 0) return;
      if (!priceHistoryRef.current[symbol]) priceHistoryRef.current[symbol] = [];
      const buf = priceHistoryRef.current[symbol];
      if (buf.length === 0 || buf[buf.length - 1] !== price) {
        buf.push(price);
        if (buf.length > 30) buf.shift();
      }
    });
  }, [quotesBySymbol]);

  const groupsWithRealtime = useMemo(
    () => groups.map((group) => ({
      ...group,
      items: group.items.map((item) =>
        mergeTickerIntoItem(item, quotesBySymbol[item.symbol] || {}),
      ),
    })),
    [groups, quotesBySymbol],
  );

  const trackedSymbolsWithRealtime = useMemo(
    () => trackedSymbols.map((item) =>
      mergeTickerIntoItem(item, quotesBySymbol[item.symbol] || {}),
    ),
    [trackedSymbols, quotesBySymbol],
  );

  const priceAlertsWithRealtime = useMemo(
    () => priceAlerts.map((rule) => ({
      ...rule,
      current_price: quotesBySymbol[rule.symbol]?.current_price ?? rule.current_price,
      stale: quotesBySymbol[rule.symbol]?.stale ?? false,
    })),
    [priceAlerts, quotesBySymbol],
  );

  const latestTriggeredPriceAlert = triggeredPriceAlerts[0] || null;

  const activeGroup = view !== 'tracked' ? groupsWithRealtime.find((g) => g.id === view) || null : null;

  const groupStats = activeGroup
    ? activeGroup.items.reduce(
        (acc, item) => {
          if (item.change_pct > 0) acc.up++;
          else if (item.change_pct < 0) acc.down++;
          else acc.flat++;
          return acc;
        },
        { up: 0, down: 0, flat: 0 },
      )
    : null;

  const trackedStats = {
    up: trackedSymbolsWithRealtime.filter((t) => t.change_pct > 0).length,
    down: trackedSymbolsWithRealtime.filter((t) => t.change_pct < 0).length,
  };
  const trackedWithOverrideCount = trackedSymbolsWithRealtime.filter((item) => item.whale_alert_threshold_million != null).length;
  const trackedWithUserDefaultCount = trackedSymbolsWithRealtime.length - trackedWithOverrideCount;
  const filteredTrackedSymbolsWithRealtime = trackedSymbolsWithRealtime.filter((item) => {
    if (trackedThresholdFilter === 'symbol') {
      return item.whale_alert_threshold_million != null;
    }
    if (trackedThresholdFilter === 'user') {
      return item.whale_alert_threshold_million == null;
    }
    return true;
  });
  const searchedTrackedSymbolsWithRealtime = filteredTrackedSymbolsWithRealtime.filter((item) => {
    const keyword = String(trackedSymbolSearch || '').trim().toUpperCase();
    if (!keyword) {
      return true;
    }
    return String(item.symbol || '').toUpperCase().includes(keyword);
  });
  const filteredByDataTrackedSymbolsWithRealtime = searchedTrackedSymbolsWithRealtime.filter((item) => {
    if (trackedDataFilter === 'synced') {
      return !item.stale && item.current_price !== null && item.current_price !== undefined;
    }
    if (trackedDataFilter === 'stale') {
      return item.stale || item.current_price === null || item.current_price === undefined;
    }
    if (trackedDataFilter === 'gainers') {
      return Number(item.change_pct) > 0;
    }
    if (trackedDataFilter === 'losers') {
      return Number(item.change_pct) < 0;
    }
    if (trackedDataFilter === 'flat') {
      return Number(item.change_pct) === 0;
    }
    return true;
  });
  // Phase B: apply strategy filter (RSI/RVOL/MA20/Whale) on top of data filter
  const strategyFilteredTracked = useMemo(
    () => applyStrategyFilter(filteredByDataTrackedSymbolsWithRealtime, strategyFilter),
    [filteredByDataTrackedSymbolsWithRealtime, strategyFilter],
  );
  const sortedTrackedSymbolsWithRealtime = useMemo(() => {
    const rows = [...strategyFilteredTracked];
    const scoreThreshold = (item) => (item.whale_alert_threshold_million == null ? -1 : Number(item.whale_alert_threshold_million));
    const scoreNumber = (value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : -Infinity;
    };
    const scoreDate = (value) => {
      if (!value) return 0;
      const parsed = new Date(value).getTime();
      return Number.isFinite(parsed) ? parsed : 0;
    };

    if (trackedSortBy === 'threshold_desc') {
      rows.sort((a, b) => scoreThreshold(b) - scoreThreshold(a));
      return rows;
    }
    if (trackedSortBy === 'threshold_asc') {
      rows.sort((a, b) => scoreThreshold(a) - scoreThreshold(b));
      return rows;
    }
    if (trackedSortBy === 'symbol_desc') {
      rows.sort((a, b) => String(b.symbol || '').localeCompare(String(a.symbol || '')));
      return rows;
    }
    if (trackedSortBy === 'current_price_asc') {
      rows.sort((a, b) => scoreNumber(a.current_price) - scoreNumber(b.current_price));
      return rows;
    }
    if (trackedSortBy === 'current_price_desc') {
      rows.sort((a, b) => scoreNumber(b.current_price) - scoreNumber(a.current_price));
      return rows;
    }
    if (trackedSortBy === 'change_value_asc') {
      rows.sort((a, b) => scoreNumber(a.change_value) - scoreNumber(b.change_value));
      return rows;
    }
    if (trackedSortBy === 'change_value_desc') {
      rows.sort((a, b) => scoreNumber(b.change_value) - scoreNumber(a.change_value));
      return rows;
    }
    if (trackedSortBy === 'change_pct_asc') {
      rows.sort((a, b) => scoreNumber(a.change_pct) - scoreNumber(b.change_pct));
      return rows;
    }
    if (trackedSortBy === 'change_pct_desc') {
      rows.sort((a, b) => scoreNumber(b.change_pct) - scoreNumber(a.change_pct));
      return rows;
    }
    if (trackedSortBy === 'updated_at_asc') {
      rows.sort((a, b) => scoreDate(a.updated_at) - scoreDate(b.updated_at));
      return rows;
    }
    if (trackedSortBy === 'updated_at_desc') {
      rows.sort((a, b) => scoreDate(b.updated_at) - scoreDate(a.updated_at));
      return rows;
    }
    rows.sort((a, b) => String(a.symbol || '').localeCompare(String(b.symbol || '')));
    return rows;
  }, [strategyFilteredTracked, trackedSortBy]);
  const trackedTotalPages = Math.max(1, Math.ceil(sortedTrackedSymbolsWithRealtime.length / trackedPageSize));
  const trackedCurrentPage = Math.min(trackedPage, trackedTotalPages);
  const pagedTrackedSymbolsWithRealtime = useMemo(() => {
    const start = (trackedCurrentPage - 1) * trackedPageSize;
    return sortedTrackedSymbolsWithRealtime.slice(start, start + trackedPageSize);
  }, [sortedTrackedSymbolsWithRealtime, trackedCurrentPage, trackedPageSize]);

  const toggleTrackedSort = useCallback((key) => {
    setTrackedSortBy((prev) => {
      const normalizedPrev = String(prev || 'symbol_asc');
      const splitIndex = normalizedPrev.lastIndexOf('_');
      const prevKey = splitIndex > 0 ? normalizedPrev.slice(0, splitIndex) : 'symbol';
      const prevDir = splitIndex > 0 ? normalizedPrev.slice(splitIndex + 1) : 'asc';
      if (prevKey === key) {
        return `${key}_${prevDir === 'asc' ? 'desc' : 'asc'}`;
      }
      return `${key}_asc`;
    });
  }, []);

  const getTrackedSortIndicator = useCallback((key) => {
    const normalized = String(trackedSortBy || 'symbol_asc');
    const splitIndex = normalized.lastIndexOf('_');
    const activeKey = splitIndex > 0 ? normalized.slice(0, splitIndex) : 'symbol';
    const activeDirection = splitIndex > 0 ? normalized.slice(splitIndex + 1) : 'asc';
    if (activeKey !== key) {
      return 'â†•';
    }
    return activeDirection === 'asc' ? 'â†‘' : 'â†“';
  }, [trackedSortBy]);
  const trackedSymbolMap = new Map(trackedSymbolsWithRealtime.map((item) => [item.symbol, item]));
  const trackedSymbolSet = new Set(trackedSymbolsWithRealtime.map((item) => item.symbol));
  const activeGroupItems = activeGroup?.items || [];
  const activeGroupTrackedCount = activeGroupItems.filter((item) => trackedSymbolSet.has(item.symbol)).length;
  const activeGroupTrackedItems = activeGroupItems
    .map((item) => trackedSymbolMap.get(item.symbol))
    .filter(Boolean);
  const filteredActiveGroupItems = activeGroupItems.filter((item) => {
    if (groupTrackedFilter === 'tracked') {
      return trackedSymbolSet.has(item.symbol);
    }
    if (groupTrackedFilter === 'untracked') {
      return !trackedSymbolSet.has(item.symbol);
    }
    return true;
  });
  const searchedActiveGroupItems = filteredActiveGroupItems.filter((item) => {
    const keyword = String(groupSymbolSearch || '').trim().toUpperCase();
    if (!keyword) {
      return true;
    }
    return String(item.symbol || '').toUpperCase().includes(keyword);
  });
  const filteredByDataActiveGroupItems = searchedActiveGroupItems.filter((item) => {
    if (groupDataFilter === 'synced') {
      return !item.stale && item.current_price !== null && item.current_price !== undefined;
    }
    if (groupDataFilter === 'stale') {
      return item.stale || item.current_price === null || item.current_price === undefined;
    }
    if (groupDataFilter === 'gainers') {
      return Number(item.change_pct) > 0;
    }
    if (groupDataFilter === 'losers') {
      return Number(item.change_pct) < 0;
    }
    if (groupDataFilter === 'flat') {
      return Number(item.change_pct) === 0;
    }
    return true;
  });
  const sortedActiveGroupItems = useMemo(() => {
    const rows = [...filteredByDataActiveGroupItems];
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

    rows.sort((left, right) => {
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

      if (compare === 0) {
        compare = safeString(left.symbol).localeCompare(safeString(right.symbol));
      }
      return groupSort.direction === 'asc' ? compare : -compare;
    });

    return rows;
  }, [filteredByDataActiveGroupItems, groupSort]);
  const groupTotalPages = Math.max(1, Math.ceil(sortedActiveGroupItems.length / groupPageSize));
  const groupCurrentPage = Math.min(groupPage, groupTotalPages);
  const pagedActiveGroupItems = useMemo(() => {
    const start = (groupCurrentPage - 1) * groupPageSize;
    return sortedActiveGroupItems.slice(start, start + groupPageSize);
  }, [sortedActiveGroupItems, groupCurrentPage, groupPageSize]);

  const toggleGroupSort = useCallback((key) => {
    setGroupSort((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        };
      }
      return { key, direction: 'asc' };
    });
  }, []);

  const getGroupSortIndicator = useCallback((key) => {
    if (groupSort.key !== key) {
      return 'â†•';
    }
    return groupSort.direction === 'asc' ? 'â†‘' : 'â†“';
  }, [groupSort]);
  const activeGroupUntrackedCount = activeGroupItems.filter((item) => !trackedSymbolSet.has(item.symbol)).length;

  const openStockWorkspace = useCallback((symbol) => {
    if (!symbol) {
      return;
    }
    navigate(`/stocks/${symbol}`);
  }, [navigate]);

  const handleMarkPriceAlertTriggered = useCallback(async (rule, currentPrice) => {
    if (!rule?.id || triggeringAlertIdsRef.current.has(rule.id)) {
      return;
    }

    triggeringAlertIdsRef.current.add(rule.id);
    setTriggeredPriceAlerts((prev) => [
      {
        id: rule.id,
        symbol: rule.symbol,
        condition: rule.condition,
        target_price: rule.target_price,
        current_price: currentPrice,
        triggered_at: new Date().toISOString(),
      },
      ...prev.filter((item) => item.id !== rule.id),
    ].slice(0, 5));
    setPriceAlertMsg(t('watchlist.priceAlertTriggered', {
      symbol: rule.symbol,
      direction: rule.condition === 'ABOVE' ? t('watchlist.above') : t('watchlist.below'),
      target: formatNumber(rule.target_price),
    }));

    try {
      const res = await markPriceAlertTriggered(rule.id);
      setPriceAlerts((prev) => prev.map((item) => (item.id === rule.id ? res.data : item)));
    } catch (err) {
      console.error('markPriceAlertTriggered:', err);
    } finally {
      triggeringAlertIdsRef.current.delete(rule.id);
      setTimeout(() => setPriceAlertMsg(''), 5000);
    }
  }, [formatNumber, t]);

  useEffect(() => {
    const now = Date.now();

    priceAlertsWithRealtime.forEach((rule) => {
      if (!rule.is_active || rule.stale) {
        return;
      }

      const currentPrice = Number(rule.current_price);
      if (!Number.isFinite(currentPrice) || !isPriceAlertMatched(rule, currentPrice)) {
        return;
      }

      const lastTriggeredAt = rule.last_triggered_at ? new Date(rule.last_triggered_at).getTime() : null;
      const cooldownMs = Number(rule.cooldown_seconds || 0) * 1000;
      const inCooldown = lastTriggeredAt && now - lastTriggeredAt < cooldownMs;
      if (inCooldown) {
        return;
      }

      handleMarkPriceAlertTriggered(rule, currentPrice);
    });
  }, [priceAlertsWithRealtime, handleMarkPriceAlertTriggered]);

  useEffect(() => {
    setGroupPage(1);
  }, [view, groupTrackedFilter, groupDataFilter, groupSymbolSearch, groupPageSize]);

  useEffect(() => {
    setTrackedPage(1);
  }, [trackedThresholdFilter, trackedDataFilter, trackedSymbolSearch, trackedPageSize]);

  const handleSeed = async () => {
    setSeeding(true);
    setSyncMsg('');
    try {
      const res = await seedSecurities();
      setSyncMsg(res.data.message || t('watchlist.seedSuccess'));
      await loadGroups();
    } catch {
      setSyncMsg(t('watchlist.seedFailed'));
    } finally {
      setSeeding(false);
      setTimeout(() => setSyncMsg(''), 5000);
    }
  };

  const handleSync = useCallback(async () => {
    if (syncCooldownSeconds > 0) {
      setSyncMsg(t('watchlist.syncRetryIn', { seconds: syncCooldownSeconds }));
      return;
    }

    setSyncing(true);
    setSyncMsg('');
    let shouldAutoClearMessage = true;
    try {
      const res = await syncSecuritiesPrices(5);
      setSyncMsg(t('watchlist.syncCount', { count: formatNumber(res.data.total_symbols || res.data.total_created || 0) }));
      await loadGroups();
      await fetchTracked();
    } catch (err) {
      const retryAfter = Number(err?.response?.data?.retry_after_seconds);
      if (Number.isFinite(retryAfter) && retryAfter > 0) {
        shouldAutoClearMessage = false;
        startSyncCooldown(retryAfter);
      } else {
        setSyncMsg(t('watchlist.syncFailed'));
      }
    } finally {
      setSyncing(false);
      if (shouldAutoClearMessage) {
        setTimeout(() => setSyncMsg(''), 5000);
      }
    }
  }, [loadGroups, fetchTracked, formatNumber, startSyncCooldown, syncCooldownSeconds, t]);

  const handleAddTracked = async (e) => {
    e.preventDefault();
    if (!addSymbol) return;
    setAddingSymbol(true);
    setSymbolError('');
    try {
      const normalizedThreshold = String(addThresholdMillion || '').trim();
      let thresholdValue = null;
      if (normalizedThreshold !== '') {
        const parsedThreshold = Number(normalizedThreshold);
        if (!Number.isFinite(parsedThreshold) || parsedThreshold < 1) {
          setSymbolError(t('watchlist.thresholdValidation'));
          setAddingSymbol(false);
          return;
        }
        thresholdValue = parsedThreshold;
      }

      await addTrackedSymbol(addSymbol, srcGroupId ? Number(srcGroupId) : null, thresholdValue);
      setAddSymbol('');
      setAddThresholdMillion('');
      await fetchTracked();
    } catch (err) {
      setSymbolError(err.response?.data?.detail || t('watchlist.addSymbolFailed', { symbol: addSymbol }));
    } finally {
      setAddingSymbol(false);
    }
  };

  const handleDeleteTracked = async (id, symbol) => {
    if (!window.confirm(t('watchlist.deleteTrackedConfirm', { symbol }))) return;
    try {
      await deleteTrackedSymbol(id);
      setTrackedSymbols((prev) => prev.filter((t) => t.id !== id));
      setSyncMsg(t('watchlist.removedTrackedSuccess', { symbol }));
      setTimeout(() => setSyncMsg(''), 4000);
    } catch {
      alert(t('watchlist.deleteFailed'));
    }
  };

  const handleStartTrackedThresholdEdit = (item) => {
    setEditingTrackedId(item.id);
    setEditingTrackedThresholdValue(
      item.whale_alert_threshold_million == null ? '' : String(item.whale_alert_threshold_million),
    );
  };

  const handleCancelTrackedThresholdEdit = () => {
    setEditingTrackedId(null);
    setEditingTrackedThresholdValue('');
  };

  const handleSaveTrackedThreshold = async (item) => {
    const trimmed = String(editingTrackedThresholdValue || '').trim();
    let nextValue = null;
    if (trimmed !== '') {
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed) || parsed < 1) {
        setSymbolError(t('watchlist.thresholdValidation'));
        return;
      }
      nextValue = parsed;
    }

    setUpdatingTrackedId(item.id);
    setSymbolError('');
    try {
      const res = await updateTrackedSymbol(item.id, { whale_alert_threshold_million: nextValue });
      setTrackedSymbols((prev) => prev.map((row) => (row.id === item.id ? { ...row, ...res.data } : row)));
      setSyncMsg(t('watchlist.thresholdUpdated', { symbol: item.symbol }));
      setTimeout(() => setSyncMsg(''), 4000);
      setEditingTrackedId(null);
      setEditingTrackedThresholdValue('');
    } catch (err) {
      setSymbolError(err.response?.data?.detail || t('watchlist.thresholdUpdateFailed', { symbol: item.symbol }));
    } finally {
      setUpdatingTrackedId(null);
    }
  };

  const handleBulkSetTrackedThreshold = async () => {
    const normalizedThreshold = String(bulkThresholdMillion || '').trim();
    const parsedThreshold = Number(normalizedThreshold);
    if (!Number.isFinite(parsedThreshold) || parsedThreshold < 1) {
      setSymbolError(t('watchlist.thresholdValidation'));
      return;
    }

    const targets = sortedTrackedSymbolsWithRealtime.filter((item) => item.whale_alert_threshold_million == null);
    if (targets.length === 0) {
      setSyncMsg(t('watchlist.bulkNoTargets'));
      setTimeout(() => setSyncMsg(''), 3500);
      return;
    }

    setTrackedBulkAction('set');
    setSymbolError('');
    try {
      const res = await bulkUpdateTrackedSymbolThreshold(
        targets.map((item) => item.id),
        parsedThreshold,
      );
      const updatedRows = res?.data?.rows || [];
      if (updatedRows.length > 0) {
        const updatedMap = new Map(updatedRows.map((row) => [row.id, row]));
        setTrackedSymbols((prev) => prev.map((row) => (updatedMap.has(row.id) ? { ...row, ...updatedMap.get(row.id) } : row)));
      } else {
        await fetchTracked();
      }
      setSyncMsg(t('watchlist.bulkSetThresholdSuccess', { count: formatNumber(targets.length) }));
      setTimeout(() => setSyncMsg(''), 4000);
    } catch (err) {
      setSymbolError(err.response?.data?.detail || t('watchlist.bulkSetThresholdFailed'));
    } finally {
      setTrackedBulkAction(null);
    }
  };

  const handleBulkClearTrackedThreshold = async () => {
    const targets = sortedTrackedSymbolsWithRealtime.filter((item) => item.whale_alert_threshold_million != null);
    if (targets.length === 0) {
      setSyncMsg(t('watchlist.bulkNoTargets'));
      setTimeout(() => setSyncMsg(''), 3500);
      return;
    }

    setTrackedBulkAction('clear');
    setSymbolError('');
    try {
      const res = await bulkUpdateTrackedSymbolThreshold(
        targets.map((item) => item.id),
        null,
      );
      const updatedRows = res?.data?.rows || [];
      if (updatedRows.length > 0) {
        const updatedMap = new Map(updatedRows.map((row) => [row.id, row]));
        setTrackedSymbols((prev) => prev.map((row) => (updatedMap.has(row.id) ? { ...row, ...updatedMap.get(row.id) } : row)));
      } else {
        await fetchTracked();
      }
      setSyncMsg(t('watchlist.bulkClearThresholdSuccess', { count: formatNumber(targets.length) }));
      setTimeout(() => setSyncMsg(''), 4000);
    } catch (err) {
      setSymbolError(err.response?.data?.detail || t('watchlist.bulkClearThresholdFailed'));
    } finally {
      setTrackedBulkAction(null);
    }
  };

  const handleAddTrackedFromGroup = async (symbol, groupId) => {
    if (trackedSymbolSet.has(symbol) || addingFromGroup[symbol]) {
      return;
    }

    setAddingFromGroup((prev) => ({ ...prev, [symbol]: true }));
    setSymbolError('');
    try {
      await addTrackedSymbol(symbol, groupId);
      await fetchTracked();
      setSyncMsg(t('watchlist.addedTrackedSuccess', { symbol }));
    } catch (err) {
      setSymbolError(err.response?.data?.detail || t('watchlist.addFromGroupFailed', { symbol }));
    } finally {
      setAddingFromGroup((prev) => {
        const next = { ...prev };
        delete next[symbol];
        return next;
      });
      setTimeout(() => setSyncMsg(''), 5000);
    }
  };

  const handleAddAllTrackedFromGroup = async () => {
    if (!activeGroup || bulkGroupAction) {
      return;
    }

    const symbolsToAdd = activeGroup.items
      .map((item) => item.symbol)
      .filter((symbol) => !trackedSymbolSet.has(symbol));

    if (symbolsToAdd.length === 0) {
      setSyncMsg(t('watchlist.allSymbolsTracked'));
      setTimeout(() => setSyncMsg(''), 4000);
      return;
    }

    setBulkGroupAction('add');
    setSymbolError('');
    try {
      await Promise.all(symbolsToAdd.map((symbol) => addTrackedSymbol(symbol, activeGroup.id)));
      await fetchTracked();
      setSyncMsg(t('watchlist.addedManyFromGroup', { count: formatNumber(symbolsToAdd.length), group: activeGroup.name }));
    } catch (err) {
      setSymbolError(err.response?.data?.detail || t('watchlist.addAllFromGroupFailed'));
    } finally {
      setBulkGroupAction(null);
      setTimeout(() => setSyncMsg(''), 5000);
    }
  };

  const handleRemoveAllTrackedFromGroup = async () => {
    if (!activeGroup || bulkGroupAction || activeGroupTrackedItems.length === 0) {
      return;
    }

    if (!window.confirm(t('watchlist.removeGroupTrackedConfirm', {
      count: formatNumber(activeGroupTrackedItems.length),
      group: activeGroup.name,
    }))) {
      return;
    }

    setBulkGroupAction('remove');
    setSymbolError('');
    try {
      await Promise.all(activeGroupTrackedItems.map((trackedItem) => deleteTrackedSymbol(trackedItem.id)));
      await fetchTracked();
      setSyncMsg(t('watchlist.removedManyFromGroup', {
        count: formatNumber(activeGroupTrackedItems.length),
        group: activeGroup.name,
      }));
    } catch {
      setSymbolError(t('watchlist.removeAllFromGroupFailed'));
    } finally {
      setBulkGroupAction(null);
      setTimeout(() => setSyncMsg(''), 5000);
    }
  };

  const handleCreatePriceAlert = async (e) => {
    e.preventDefault();
    setPriceAlertError('');
    setPriceAlertMsg('');

    const normalizedSymbol = String(priceAlertForm.symbol || '').toUpperCase().trim();
    if (!normalizedSymbol) {
      setPriceAlertError(t('watchlist.symbolRequired', { defaultValue: 'Vui lÃ²ng nháº­p mÃ£ chá»©ng khoÃ¡n.' }));
      return;
    }

    const targetPrice = Number(priceAlertForm.targetPrice);
    if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
      setPriceAlertError(t('watchlist.targetPriceValidation', { defaultValue: 'GiÃ¡ má»¥c tiÃªu pháº£i lÃ  sá»‘ > 0.' }));
      return;
    }

    const cooldownSeconds = Number(priceAlertForm.cooldownSeconds || 0);
    if (!Number.isFinite(cooldownSeconds) || cooldownSeconds < 0) {
      setPriceAlertError(t('watchlist.cooldownValidation', { defaultValue: 'Cooldown pháº£i lÃ  sá»‘ >= 0.' }));
      return;
    }

    setPriceAlertSaving(true);
    try {
      const payload = {
        symbol: normalizedSymbol,
        condition: priceAlertForm.condition,
        target_price: targetPrice,
        cooldown_seconds: Math.trunc(cooldownSeconds),
        is_active: true,
      };
      await createPriceAlert(payload);
      setPriceAlertForm({ symbol: '', condition: 'ABOVE', targetPrice: '', cooldownSeconds: '300' });
      setPriceAlertMsg(t('watchlist.createdPriceAlert'));
      await fetchPriceAlerts();
    } catch (err) {
      setPriceAlertError(extractApiErrorMessage(err, t('watchlist.createPriceAlertFailed')));
    } finally {
      setPriceAlertSaving(false);
      setTimeout(() => setPriceAlertMsg(''), 4000);
    }
  };

  const handleTogglePriceAlert = async (rule) => {
    try {
      const res = await updatePriceAlert(rule.id, { is_active: !rule.is_active });
      setPriceAlerts((prev) => prev.map((item) => (item.id === rule.id ? res.data : item)));
      setPriceAlertMsg(rule.is_active
        ? t('watchlist.pausedAlert', { symbol: rule.symbol })
        : t('watchlist.activatedAlert', { symbol: rule.symbol }));
      setTimeout(() => setPriceAlertMsg(''), 4000);
    } catch (err) {
      setPriceAlertError(extractApiErrorMessage(err, t('watchlist.updateAlertFailed')));
    }
  };

  const handleDeletePriceAlert = async (rule) => {
    if (!window.confirm(t('watchlist.deletePriceAlertConfirm', { symbol: rule.symbol }))) {
      return;
    }

    try {
      await deletePriceAlert(rule.id);
      setPriceAlerts((prev) => prev.filter((item) => item.id !== rule.id));
      setPriceAlertMsg(t('watchlist.deletedPriceAlert', { symbol: rule.symbol }));
      setTimeout(() => setPriceAlertMsg(''), 4000);
    } catch (err) {
      setPriceAlertError(extractApiErrorMessage(err, t('watchlist.deletePriceAlertFailed')));
    }
  };

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-100">{t('watchlist.title')}</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-2.5 py-1 rounded-full border ${
            realtimeStatus === 'live'
              ? 'border-emerald-700 bg-emerald-900/30 text-emerald-300'
              : realtimeStatus === 'connecting'
                ? 'border-amber-700 bg-amber-900/30 text-amber-300'
                : 'border-gray-700 bg-gray-900 text-gray-400'
          }`}>
            {realtimeLabels[realtimeStatus]}
          </span>
          {lastRealtimeAt && (
            <span className="text-xs text-gray-500">
              {t('watchlist.lastEvent', { time: formatTime(lastRealtimeAt) })}
            </span>
          )}
          <button
            onClick={handleSyncStockProfile}
            disabled={syncingStockProfile}
            className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {syncingStockProfile ? t('watchlist.syncing') : t('watchlist.syncStockProfile')}
          </button>
          {syncMsg && <span className="text-xs text-brand-500">{syncMsg}</span>}

          {groupsWithRealtime.length === 0 && !loading && (
            <button
              onClick={handleSeed} disabled={seeding}
              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              {seeding ? t('watchlist.seeding') : t('watchlist.seedDefaults')}
            </button>
          )}

          <button
            onClick={handleSync} disabled={syncing || syncCooldownSeconds > 0 || groupsWithRealtime.length === 0}
            className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 border border-gray-700 text-sm text-gray-300 px-4 py-2 rounded-lg transition-colors"
          >
            {syncing ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-gray-500 border-t-brand-500 rounded-full animate-spin inline-block" />
                {t('watchlist.syncingShort')}
              </>
            ) : syncCooldownSeconds > 0 ? t('watchlist.syncRetryInShort', { seconds: syncCooldownSeconds }) : t('watchlist.syncPrices')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs uppercase tracking-wider text-blue-300 mb-2">{t('watchlist.layer1')}</p>
          <h2 className="text-base font-semibold text-gray-100">{t('watchlist.layer1Title')}</h2>
          <p className="text-sm text-gray-400 mt-2">
            {t('watchlist.layer1Desc')}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs uppercase tracking-wider text-brand-300 mb-2">{t('watchlist.layer2')}</p>
          <h2 className="text-base font-semibold text-gray-100">{t('watchlist.layer2Title')}</h2>
          <p className="text-sm text-gray-400 mt-2">
            {t('watchlist.layer2Desc')}
          </p>
        </div>
      </div>

      {latestWhaleAlert && (
        <div className="bg-amber-950/40 border border-amber-800 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
          <span className="text-amber-300 font-semibold">{t('watchlist.whaleAlert')}</span>
          <span className="text-gray-200 font-bold">{latestWhaleAlert.symbol}</span>
          <span className="text-gray-400">{latestWhaleAlert.side || 'N/A'}</span>
          {typeof latestWhaleAlert.severity === 'string' && (
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${severityTone(latestWhaleAlert.severity.toLowerCase())}`}>
              {severityLabel(latestWhaleAlert.severity, t)}
            </span>
          )}
          <span className="text-gray-300 tabular-nums">
            {formatNumber(latestWhaleAlert.matched_value || 0)} VNÄ
          </span>
          {(latestWhaleAlert.display_score != null || latestWhaleAlert.event_score != null) && (
            <span className="text-xs text-gray-400">
              Score {latestWhaleAlert.display_score ?? 'â€”'} / Event {latestWhaleAlert.event_score ?? 'â€”'}
            </span>
          )}
          {(() => {
            const userThresholdMillion = Number(userConfig?.whale_alert_threshold);
            const eventThresholdVnd = Number(latestWhaleAlert.threshold);
            const eventThresholdMillion = Number.isFinite(eventThresholdVnd) ? (eventThresholdVnd / 1_000_000) : NaN;
            const thresholdInUseMillion = Number.isFinite(eventThresholdMillion)
              ? eventThresholdMillion
              : (Number.isFinite(userThresholdMillion) ? userThresholdMillion : 0);
            const useSymbolOverride = Number.isFinite(eventThresholdMillion)
              && Number.isFinite(userThresholdMillion)
              && Math.abs(eventThresholdMillion - userThresholdMillion) > 0.0001;

            return (
              <span className="text-xs text-gray-500">
                {t('watchlist.thresholdInUse', {
                  value: formatNumber(thresholdInUseMillion),
                  source: useSymbolOverride
                    ? t('watchlist.thresholdSourceSymbol')
                    : t('watchlist.thresholdSourceUser'),
                })}
              </span>
            );
          })()}
        </div>
      )}

      {latestTriggeredPriceAlert && (
        <div className="bg-blue-950/40 border border-blue-800 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
          <span className="text-blue-300 font-semibold">{t('watchlist.priceAlert')}</span>
          <span className="text-gray-100 font-bold">{latestTriggeredPriceAlert.symbol}</span>
          <span className="text-gray-400">
            {latestTriggeredPriceAlert.condition === 'ABOVE' ? t('watchlist.above') : t('watchlist.below')}
          </span>
          <span className="text-gray-300 tabular-nums">
            {t('watchlist.target', { value: formatNumber(latestTriggeredPriceAlert.target_price || 0) })}
          </span>
          <span className="text-xs text-gray-500">
            {t('watchlist.currentPrice', { value: formatNumber(latestTriggeredPriceAlert.current_price || 0) })}
          </span>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : groupsWithRealtime.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-gray-300 font-semibold">{t('watchlist.noGroupsTitle')}</p>
          <p className="text-gray-500 text-sm mt-1">
            {t('watchlist.noGroupsDesc')}
          </p>
          <button
            onClick={handleSeed} disabled={seeding}
            className="mt-4 bg-brand-600 hover:bg-brand-700 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {seeding ? t('watchlist.seeding') : t('watchlist.seedDefaults')}
          </button>
        </div>
      ) : (
        <>
        <div className="flex gap-5">
          {/* Sidebar */}
          <aside className="w-52 flex-shrink-0 space-y-0.5">
            {/* Danh sÃ¡ch theo dÃµi cÃ¡ nhÃ¢n */}
            <button
              onClick={() => setView('tracked')}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors border ${
                view === 'tracked'
                  ? 'bg-brand-900/40 border-brand-700'
                  : 'border-transparent hover:bg-gray-900/70'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-brand-500" />
                <span className={`text-sm font-semibold truncate ${
                  view === 'tracked' ? 'text-brand-300' : 'text-gray-300'
                }`}>
                  {t('watchlist.personalTrackedList')}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 pl-[18px] text-xs">
                <span className="text-gray-600">{t('watchlist.stocksCount', { count: formatNumber(trackedSymbols.length) })}</span>
                {trackedStats.up > 0 && <span className="text-green-500">▲{trackedStats.up}</span>}
                {trackedStats.down > 0 && <span className="text-red-500">▼{trackedStats.down}</span>}
              </div>
            </button>

            {/* Divider + NhÃ³m thá»‹ trÆ°á»ng label */}
            <div className="pt-3 pb-1 px-1">
              <p className="text-xs text-gray-600 uppercase tracking-wider font-semibold">{t('watchlist.marketGroups')}</p>
            </div>

            {/* Group list */}
            {groupsWithRealtime.map((g) => {
              const isActive = g.id === view;
              const upCount = g.items.filter((i) => i.change_pct > 0).length;
              const downCount = g.items.filter((i) => i.change_pct < 0).length;
              return (
                <button
                  key={g.id}
                  onClick={() => setView(g.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors border ${
                    isActive ? 'bg-gray-800 border-gray-600' : 'border-transparent hover:bg-gray-900/70'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: g.color }}
                    />
                    <span className={`text-sm font-medium truncate ${
                      isActive ? 'text-gray-100' : 'text-gray-400'
                    }`}>
                      {g.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 pl-[18px] text-xs">
                    <span className="text-gray-600">{t('watchlist.stocksCount', { count: formatNumber(g.items.length) })}</span>
                    {upCount > 0 && <span className="text-green-500">▲{upCount}</span>}
                    {downCount > 0 && <span className="text-red-500">▼{downCount}</span>}
                  </div>
                </button>
              );
            })}
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {view === 'tracked' ? (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-4 h-4 rounded-full bg-brand-500 flex-shrink-0" />
                  <h2 className="text-base font-bold text-gray-100">{t('watchlist.personalTrackedList')}</h2>
                  <span className="text-xs text-gray-500">{t('watchlist.trackedRealtimeDesc')}</span>
                  <span
                    className="text-[11px] text-amber-300/90 border border-amber-700/40 bg-amber-900/20 rounded-full px-2 py-0.5"
                    title={t('watchlist.thresholdPrecedenceTooltip')}
                  >
                    {t('watchlist.thresholdPrecedenceLabel')}
                  </span>
                </div>

                <WatchlistManagementPanel
                  t={t}
                  formatNumber={formatNumber}
                  groupsWithRealtime={groupsWithRealtime}
                  srcGroupId={srcGroupId}
                  setSrcGroupId={setSrcGroupId}
                  addSymbol={addSymbol}
                  setAddSymbol={setAddSymbol}
                  addThresholdMillion={addThresholdMillion}
                  setAddThresholdMillion={setAddThresholdMillion}
                  addingSymbol={addingSymbol}
                  symbolError={symbolError}
                  onAddTracked={handleAddTracked}
                  bulkThresholdMillion={bulkThresholdMillion}
                  setBulkThresholdMillion={setBulkThresholdMillion}
                  trackedBulkAction={trackedBulkAction}
                  onBulkSetThreshold={handleBulkSetTrackedThreshold}
                  onBulkClearThreshold={handleBulkClearTrackedThreshold}
                />

                <PriceAlertModule
                  t={t}
                  formatNumber={formatNumber}
                  formatQuotePrice={formatQuotePrice}
                  formatDateTime={formatDateTime}
                  priceAlerts={priceAlerts}
                  priceAlertsWithRealtime={priceAlertsWithRealtime}
                  priceAlertsLoading={priceAlertsLoading}
                  priceAlertForm={priceAlertForm}
                  setPriceAlertForm={setPriceAlertForm}
                  priceAlertSaving={priceAlertSaving}
                  priceAlertError={priceAlertError}
                  priceAlertMsg={priceAlertMsg}
                  triggeredPriceAlerts={triggeredPriceAlerts}
                  priceAlertConditionLabels={priceAlertConditionLabels}
                  onCreatePriceAlert={handleCreatePriceAlert}
                  onTogglePriceAlert={handleTogglePriceAlert}
                  onDeletePriceAlert={handleDeletePriceAlert}
                />

                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  <div className="px-4 pt-4 pb-3 border-b border-gray-800/70 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex flex-wrap items-center gap-2 bg-gray-900/70 border border-gray-800 rounded-lg p-1 w-fit">
                        {[
                          { key: 'all', label: t('watchlist.thresholdFilterAll', { count: formatNumber(trackedSymbolsWithRealtime.length) }) },
                          { key: 'symbol', label: t('watchlist.thresholdFilterSymbol', { count: formatNumber(trackedWithOverrideCount) }) },
                          { key: 'user', label: t('watchlist.thresholdFilterUser', { count: formatNumber(trackedWithUserDefaultCount) }) },
                        ].map((option) => (
                          <button
                            key={option.key}
                            onClick={() => setTrackedThresholdFilter(option.key)}
                            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                              trackedThresholdFilter === option.key
                                ? 'bg-blue-700 text-white'
                                : 'text-gray-400 hover:text-gray-100'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <select
                        id="tracked-sort-by"
                        name="tracked_sort_by"
                        aria-label={t('watchlist.sortSymbolAsc')}
                        value={trackedSortBy}
                        onChange={(e) => setTrackedSortBy(e.target.value)}
                        className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-100 outline-none focus:border-brand-600"
                      >
                        <option value="symbol_asc">{t('watchlist.sortSymbolAsc')}</option>
                        <option value="symbol_desc">{t('watchlist.sortSymbolDesc')}</option>
                        <option value="threshold_desc">{t('watchlist.sortThresholdDesc')}</option>
                        <option value="threshold_asc">{t('watchlist.sortThresholdAsc')}</option>
                        <option value="current_price_desc">{t('watchlist.sortPriceDesc')}</option>
                        <option value="current_price_asc">{t('watchlist.sortPriceAsc')}</option>
                        <option value="change_pct_desc">{t('watchlist.sortPctDesc')}</option>
                        <option value="change_pct_asc">{t('watchlist.sortPctAsc')}</option>
                        <option value="updated_at_desc">{t('watchlist.sortUpdatedDesc')}</option>
                        <option value="updated_at_asc">{t('watchlist.sortUpdatedAsc')}</option>
                      </select>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          id="tracked-symbol-search"
                          name="tracked_symbol_search"
                          aria-label={t('watchlist.searchSymbolPlaceholder')}
                          type="text"
                          value={trackedSymbolSearch}
                          onChange={(e) => setTrackedSymbolSearch(e.target.value.toUpperCase())}
                          placeholder={t('watchlist.searchSymbolPlaceholder')}
                          className="w-52 bg-gray-950 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-100 outline-none focus:border-brand-600"
                        />
                        <select
                          id="tracked-data-filter"
                          name="tracked_data_filter"
                          aria-label={t('watchlist.dataFilterAll')}
                          value={trackedDataFilter}
                          onChange={(e) => setTrackedDataFilter(e.target.value)}
                          className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-100 outline-none focus:border-brand-600"
                        >
                          <option value="all">{t('watchlist.dataFilterAll')}</option>
                          <option value="synced">{t('watchlist.dataFilterSynced')}</option>
                          <option value="stale">{t('watchlist.dataFilterStale')}</option>
                          <option value="gainers">{t('watchlist.dataFilterGainers')}</option>
                          <option value="losers">{t('watchlist.dataFilterLosers')}</option>
                          <option value="flat">{t('watchlist.dataFilterFlat')}</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>{t('watchlist.pageSize')}</span>
                        <select
                          id="tracked-page-size"
                          name="tracked_page_size"
                          aria-label={t('watchlist.pageSize')}
                          value={trackedPageSize}
                          onChange={(e) => setTrackedPageSize(Number(e.target.value) || 20)}
                          className="bg-gray-950 border border-gray-800 rounded-lg px-2 py-1.5 text-xs text-gray-100 outline-none focus:border-brand-600"
                        >
                          {[10, 15, 20, 50, 100].map((size) => (
                            <option key={size} value={size}>{size}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  <SmartRadarTable
                    t={t}
                    formatNumber={formatNumber}
                    formatQuotePrice={formatQuotePrice}
                    formatDateTime={formatDateTime}
                    pagedTracked={pagedTrackedSymbolsWithRealtime}
                    sortedTracked={sortedTrackedSymbolsWithRealtime}
                    trackedTotalPages={trackedTotalPages}
                    trackedCurrentPage={trackedCurrentPage}
                    trackedPageSize={trackedPageSize}
                    setTrackedPage={setTrackedPage}
                    strategyFilter={strategyFilter}
                    setStrategyFilter={setStrategyFilter}
                    trackedSymbolsWithRealtime={trackedSymbolsWithRealtime}
                    trackedSortBy={trackedSortBy}
                    toggleTrackedSort={(key) => {
                      setTrackedSortBy((prev) => {
                        const splitIndex = String(prev || 'symbol_asc').lastIndexOf('_');
                        const prevKey = splitIndex > 0 ? prev.slice(0, splitIndex) : 'symbol';
                        const prevDir = splitIndex > 0 ? prev.slice(splitIndex + 1) : 'asc';
                        return prevKey === key ? `${key}_${prevDir === 'asc' ? 'desc' : 'asc'}` : `${key}_asc`;
                      });
                    }}
                    getTrackedSortIndicator={(key) => {
                      const s = String(trackedSortBy || 'symbol_asc');
                      const si = s.lastIndexOf('_');
                      const ak = si > 0 ? s.slice(0, si) : 'symbol';
                      const ad = si > 0 ? s.slice(si + 1) : 'asc';
                      return ak !== key ? 'â†•' : ad === 'asc' ? 'â†‘' : 'â†“';
                    }}
                    editingTrackedId={editingTrackedId}
                    editingTrackedThresholdValue={editingTrackedThresholdValue}
                    setEditingTrackedThresholdValue={setEditingTrackedThresholdValue}
                    updatingTrackedId={updatingTrackedId}
                    onStartEdit={handleStartTrackedThresholdEdit}
                    onSaveThreshold={handleSaveTrackedThreshold}
                    onCancelEdit={handleCancelTrackedThresholdEdit}
                    onOpenStock={openStockWorkspace}
                    onDelete={(id, symbol) => handleDeleteTracked(id, symbol)}
                    getSparklinePrices={getSparklinePrices}
                    trackedLoading={trackedLoading}
                  />
                </div>
              </div>
            ) : activeGroup ? (
              // Group detail table
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: activeGroup.color }}
                  />
                  <div>
                    <h2 className="text-base font-bold text-gray-100">{activeGroup.name}</h2>
                    {activeGroup.description && (
                      <p className="text-xs text-gray-500">{activeGroup.description}</p>
                    )}
                  </div>
                  <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
                    {t('watchlist.groupTag', { type: typeLabels[activeGroup.group_type] || activeGroup.group_type })}
                  </span>
                </div>

                {groupStats && activeGroup.items.length > 0 && (
                  <div className="flex flex-wrap items-center gap-4 mb-3 text-xs">
                    <span className="text-gray-500">{t('watchlist.stocksCount', { count: formatNumber(activeGroup.items.length) })}</span>
                    <span className="text-green-400">▲ {t('watchlist.upCount', { count: formatNumber(groupStats.up) })}</span>
                    <span className="text-red-400">▼ {t('watchlist.downCount', { count: formatNumber(groupStats.down) })}</span>
                    <span className="text-gray-500">â€” {t('watchlist.flatCount', { count: formatNumber(groupStats.flat) })}</span>
                    <span className="text-brand-300">{t('watchlist.untrackedCount', { count: formatNumber(activeGroupUntrackedCount) })}</span>
                  </div>
                )}

                {activeGroup.items.length > 0 && (
                  <div className="space-y-3 mb-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2 bg-gray-900/70 border border-gray-800 rounded-lg p-1">
                        {[
                          { key: 'all', label: t('watchlist.filterAll', { count: formatNumber(activeGroupItems.length) }) },
                          { key: 'untracked', label: t('watchlist.filterUntracked', { count: formatNumber(activeGroupUntrackedCount) }) },
                          { key: 'tracked', label: t('watchlist.filterTracked', { count: formatNumber(activeGroupTrackedCount) }) },
                        ].map((option) => (
                          <button
                            key={option.key}
                            onClick={() => setGroupTrackedFilter(option.key)}
                            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                              groupTrackedFilter === option.key
                                ? 'bg-blue-700 text-white'
                                : 'text-gray-400 hover:text-gray-100'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={handleRemoveAllTrackedFromGroup}
                          disabled={!!bulkGroupAction || activeGroupTrackedCount === 0}
                          className="text-sm font-semibold px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-100 transition-colors"
                        >
                          {bulkGroupAction === 'remove' ? t('watchlist.removingGroup') : t('watchlist.removeTrackedInGroup')}
                        </button>
                        <button
                          onClick={handleAddAllTrackedFromGroup}
                          disabled={!!bulkGroupAction || activeGroupUntrackedCount === 0}
                          className="text-sm font-semibold px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white transition-colors"
                        >
                          {bulkGroupAction === 'add' ? t('watchlist.addingGroup') : t('watchlist.addAllToTracked')}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          id="group-symbol-search"
                          name="group_symbol_search"
                          aria-label={t('watchlist.searchSymbolPlaceholder')}
                          type="text"
                          value={groupSymbolSearch}
                          onChange={(e) => setGroupSymbolSearch(e.target.value.toUpperCase())}
                          placeholder={t('watchlist.searchSymbolPlaceholder')}
                          className="w-52 bg-gray-950 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-100 outline-none focus:border-brand-600"
                        />
                        <select
                          id="group-data-filter"
                          name="group_data_filter"
                          aria-label={t('watchlist.dataFilterAll')}
                          value={groupDataFilter}
                          onChange={(e) => setGroupDataFilter(e.target.value)}
                          className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-100 outline-none focus:border-brand-600"
                        >
                          <option value="all">{t('watchlist.dataFilterAll')}</option>
                          <option value="synced">{t('watchlist.dataFilterSynced')}</option>
                          <option value="stale">{t('watchlist.dataFilterStale')}</option>
                          <option value="gainers">{t('watchlist.dataFilterGainers')}</option>
                          <option value="losers">{t('watchlist.dataFilterLosers')}</option>
                          <option value="flat">{t('watchlist.dataFilterFlat')}</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>{t('watchlist.pageSize')}</span>
                        <select
                          id="group-page-size"
                          name="group_page_size"
                          aria-label={t('watchlist.pageSize')}
                          value={groupPageSize}
                          onChange={(e) => setGroupPageSize(Number(e.target.value) || 20)}
                          className="bg-gray-950 border border-gray-800 rounded-lg px-2 py-1.5 text-xs text-gray-100 outline-none focus:border-brand-600"
                        >
                          {[10, 15, 20, 50, 100].map((size) => (
                            <option key={size} value={size}>{size}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  {sortedActiveGroupItems.length === 0 ? (
                    <div className="py-10 text-center text-gray-500 text-sm">
                      {t('watchlist.noMatchFilter')}
                    </div>
                  ) : (
                    <div>
                      <RealtimeQuoteTable
                        quotes={pagedActiveGroupItems}
                        columns={[
                          {
                            key: 'symbol',
                            label: t('watchlist.stockSymbol'),
                            sortable: true,
                            width: '100px',
                            render: (item) => (
                              <td
                                className="px-4 py-3 cursor-pointer"
                                onClick={() => openStockWorkspace(item.symbol)}
                              >
                                <span
                                  className="font-bold text-sm px-2 py-0.5 rounded"
                                  style={{
                                    backgroundColor: activeGroup.color + '22',
                                    color: activeGroup.color,
                                  }}
                                >
                                  {item.symbol}
                                </span>
                              </td>
                            ),
                          },
                          {
                            key: 'current_price',
                            label: t('watchlist.closePrice'),
                            sortable: true,
                            width: '120px',
                          },
                          {
                            key: 'change_value',
                            label: t('watchlist.tableChange'),
                            sortable: true,
                            width: '100px',
                            render: (item) => (
                              <td className="px-4 py-3"><ChangeCell value={item.change_value} /></td>
                            ),
                          },
                          {
                            key: 'change_pct',
                            label: t('watchlist.tablePctChange'),
                            sortable: true,
                            width: '120px',
                          },
                          {
                            key: 'last_date',
                            label: t('watchlist.date'),
                            sortable: true,
                            width: '120px',
                            render: (item) => (
                              <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                                {item.last_date || 'â€”'}
                              </td>
                            ),
                          },
                          {
                            key: 'actions',
                            label: t('watchlist.tableActions'),
                            sortable: false,
                            width: '280px',
                            render: (item) => (
                              <td className="px-4 py-3 text-right">
                                {trackedSymbolSet.has(item.symbol) ? (
                                  <div className="flex items-center justify-end gap-2">
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-900/30 text-brand-300">
                                      {t('watchlist.tracked')}
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const trackedItem = trackedSymbolMap.get(item.symbol);
                                        if (trackedItem) {
                                          handleDeleteTracked(trackedItem.id, item.symbol);
                                        }
                                      }}
                                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 transition-colors"
                                    >
                                      {t('watchlist.removeFromTracked')}
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAddTrackedFromGroup(item.symbol, activeGroup.id);
                                    }}
                                    disabled={!!addingFromGroup[item.symbol]}
                                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white transition-colors"
                                  >
                                    {addingFromGroup[item.symbol] ? t('watchlist.addingSymbol') : t('watchlist.addToTracked')}
                                  </button>
                                )}
                              </td>
                            ),
                          },
                        ]}
                        maxHeight="600px"
                        showHint={true}
                        emptyMessage={t('watchlist.noMatchFilter')}
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-gray-800 bg-gray-950/50 text-xs text-gray-400">
                        <span>
                          {t('watchlist.paginationSummary', {
                            from: formatNumber((groupCurrentPage - 1) * groupPageSize + 1),
                            to: formatNumber(Math.min(groupCurrentPage * groupPageSize, sortedActiveGroupItems.length)),
                            total: formatNumber(sortedActiveGroupItems.length),
                          })}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setGroupPage((prev) => Math.max(1, prev - 1))}
                            disabled={groupCurrentPage <= 1}
                            className="px-2.5 py-1 rounded border border-gray-700 text-gray-300 disabled:opacity-40"
                          >
                            {t('watchlist.prevPage')}
                          </button>
                          <span>{t('watchlist.pageLabel', { page: formatNumber(groupCurrentPage), total: formatNumber(groupTotalPages) })}</span>
                          <button
                            onClick={() => setGroupPage((prev) => Math.min(groupTotalPages, prev + 1))}
                            disabled={groupCurrentPage >= groupTotalPages}
                            className="px-2.5 py-1 rounded border border-gray-700 text-gray-300 disabled:opacity-40"
                          >
                            {t('watchlist.nextPage')}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <RealtimeDebugPanel />
        </>
      )}
    </div>
  );
}

