/**
 * pages/Watchlist.jsx
 * Radar thị trường — tách rõ 2 lớp dùng dữ liệu:
 * 1) Nhóm thị trường để quét rộng theo ngành/vốn hóa/chủ đề.
 * 2) Danh sách theo dõi để bám sát realtime.
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

function severityTone(severity) {
  if (severity === 'extreme') return 'bg-rose-500 text-white border-rose-400/40';
  if (severity === 'high') return 'bg-amber-400 text-slate-950 border-amber-300/40';
  if (severity === 'medium') return 'bg-cyan-400 text-slate-950 border-cyan-300/40';
  return 'bg-slate-800 text-slate-200 border-slate-600/40';
}

function severityLabel(severity, t) {
  const normalizedSeverity = String(severity || '').toLowerCase();
  if (normalizedSeverity === 'extreme') return t('whaleHub.severityExtreme');
  if (normalizedSeverity === 'high') return t('whaleHub.severityHigh');
  if (normalizedSeverity === 'medium') return t('whaleHub.severityMedium');
  return t('whaleHub.severityLow');
}

function mergeTickerIntoItem(item, update) {
  if (item.symbol !== update.symbol) {
    return item;
  }

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
  };
}

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveWatchlistPriceScale(currentPrice, prevPrice) {
  const current = toFiniteNumber(currentPrice);
  const prev = toFiniteNumber(prevPrice);

  if (current === null || current <= 0) {
    return 1;
  }

  // Dashboard/Watchlist quy ước hiển thị nghìn VNĐ.
  // Nếu giá snapshot ở mức VNĐ tuyệt đối (>= 2000), scale về nghìn VNĐ.
  if (current >= 2000) {
    return 0.001;
  }

  if (prev !== null && prev > 0 && prev >= 2000) {
    return 0.001;
  }

  return 1;
}

function normalizeWatchlistQuoteUnit(item) {
  // Detect price unit: realtime API returns absolute VND (>=2000), DB may store thousands VND (<2000).
  // Only scale based on current_price magnitude; do NOT recalculate change from prices
  // because current_price and prev_price may be in different units (mixed DB + realtime sources).
  const current = toFiniteNumber(item?.current_price);
  if (current === null || current <= 0 || current < 2000) {
    return item;
  }

  // current_price is in absolute VND → scale to thousands VND for display
  const factor = 0.001;
  const prev = toFiniteNumber(item?.prev_price);
  const normalizedCurrent = current * factor;
  const normalizedPrev = prev !== null && prev >= 2000 ? prev * factor : item?.prev_price;

  // Trust change_value from API, but guard against mixed-unit payloads
  // (e.g. current_price in nghin VND while change_value is still absolute VND).
  const changeValue = toFiniteNumber(item?.change_value);
  const normalizedChangeValue = (() => {
    if (changeValue === null) return null;

    const scaledByPriceFactor = changeValue * factor;
    const pct = toFiniteNumber(item?.change_pct);
    const expectedAbsChange = Math.abs(normalizedCurrent * (pct ?? 0) / 100);

    if (!Number.isFinite(expectedAbsChange) || expectedAbsChange <= 1e-6) {
      return scaledByPriceFactor;
    }

    const ratio = Math.abs(scaledByPriceFactor) / expectedAbsChange;

    // If ratio is ~1000x too large/small, auto-correct the unit drift.
    if (ratio > 200 && ratio < 200000) {
      return scaledByPriceFactor * 0.001;
    }
    if (ratio < 0.005) {
      return scaledByPriceFactor * 1000;
    }

    return scaledByPriceFactor;
  })();

  // change_pct is a dimensionless ratio — no scaling needed.
  const normalizedChangePct = toFiniteNumber(item?.change_pct);

  return {
    ...item,
    current_price: normalizedCurrent,
    prev_price: normalizedPrev,
    change_value: normalizedChangeValue,
    change_pct: normalizedChangePct,
  };
}

function ChangeCell({ value }) {
  if (value === null || value === undefined) {
    return <span className="text-gray-600 text-xs">—</span>;
  }
  const isUp = value > 0;
  const isDown = value < 0;
  const color = isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-gray-400';
  return (
    <span className={`${color} font-medium tabular-nums`}>
      {isUp ? '+' : ''}{typeof value === 'number' ? value.toFixed(2) : value}
    </span>
  );
}

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
  if (val === null || val === undefined) return <span className="text-gray-600">—</span>;
  return <span className="text-gray-200 tabular-nums">{formatNumberFn(val)}</span>;
}

function isPriceAlertMatched(rule, currentPrice) {
  const targetPrice = Number(rule?.target_price);
  const normalizedCurrentPrice = Number(currentPrice);
  if (!Number.isFinite(targetPrice) || !Number.isFinite(normalizedCurrentPrice)) {
    return false;
  }

  return rule.condition === 'ABOVE'
    ? normalizedCurrentPrice >= targetPrice
    : normalizedCurrentPrice <= targetPrice;
}

function extractApiErrorMessage(error, fallbackMessage) {
  const payload = error?.response?.data;

  if (!payload) {
    return fallbackMessage;
  }
  if (typeof payload === 'string') {
    return payload;
  }
  if (typeof payload.detail === 'string' && payload.detail.trim()) {
    return payload.detail;
  }

  const firstField = Object.values(payload).find((value) => value != null);
  if (typeof firstField === 'string') {
    return firstField;
  }
  if (Array.isArray(firstField) && firstField.length > 0) {
    return String(firstField[0]);
  }

  return fallbackMessage;
}

export default function WatchlistPage() {
  const MAX_WATCHLIST_RT_SYMBOLS = 120;
  const navigate = useNavigate();
  const { userConfig } = usePortfolio();
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

  // Mã Theo dõi state
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

  // Form thêm Mã Theo dõi
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
    setLoading(true);
    try {
      const res = await getSecuritiesGroups();
      setGroups(res.data);
    } catch (err) {
      console.error('loadGroups:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTracked = useCallback(async () => {
    setTrackedLoading(true);
    try {
      const res = await getTrackedSymbols();
      setTrackedSymbols(res.data);
    } catch (err) {
      console.error('fetchTracked:', err);
    } finally {
      setTrackedLoading(false);
    }
  }, []);

  const fetchPriceAlerts = useCallback(async () => {
    setPriceAlertsLoading(true);
    try {
      const res = await getPriceAlerts();
      setPriceAlerts(res.data || []);
    } catch (err) {
      console.error('fetchPriceAlerts:', err);
    } finally {
      setPriceAlertsLoading(false);
    }
  }, []);

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

  const groupsWithRealtime = useMemo(
    () => groups.map((group) => ({
      ...group,
      items: group.items.map((item) => normalizeWatchlistQuoteUnit(
        mergeTickerIntoItem(item, quotesBySymbol[item.symbol] || {}),
      )),
    })),
    [groups, quotesBySymbol],
  );

  const trackedSymbolsWithRealtime = useMemo(
    () => trackedSymbols.map((item) => normalizeWatchlistQuoteUnit(
      mergeTickerIntoItem(item, quotesBySymbol[item.symbol] || {}),
    )),
    [trackedSymbols, quotesBySymbol],
  );

  const priceAlertsWithRealtime = useMemo(
    () => priceAlerts.map((rule) => normalizeWatchlistQuoteUnit({
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
  const sortedTrackedSymbolsWithRealtime = useMemo(() => {
    const rows = [...filteredByDataTrackedSymbolsWithRealtime];
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
  }, [filteredByDataTrackedSymbolsWithRealtime, trackedSortBy]);
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
      return '↕';
    }
    return activeDirection === 'asc' ? '↑' : '↓';
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
      return '↕';
    }
    return groupSort.direction === 'asc' ? '↑' : '↓';
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
      setPriceAlertError(t('watchlist.symbolRequired', { defaultValue: 'Vui lòng nhập mã chứng khoán.' }));
      return;
    }

    const targetPrice = Number(priceAlertForm.targetPrice);
    if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
      setPriceAlertError(t('watchlist.targetPriceValidation', { defaultValue: 'Giá mục tiêu phải là số > 0.' }));
      return;
    }

    const cooldownSeconds = Number(priceAlertForm.cooldownSeconds || 0);
    if (!Number.isFinite(cooldownSeconds) || cooldownSeconds < 0) {
      setPriceAlertError(t('watchlist.cooldownValidation', { defaultValue: 'Cooldown phải là số >= 0.' }));
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
            {formatNumber(latestWhaleAlert.matched_value || 0)} VNĐ
          </span>
          {(latestWhaleAlert.display_score != null || latestWhaleAlert.event_score != null) && (
            <span className="text-xs text-gray-400">
              Score {latestWhaleAlert.display_score ?? '—'} / Event {latestWhaleAlert.event_score ?? '—'}
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
            {/* Danh sách theo dõi cá nhân */}
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

            {/* Divider + Nhóm thị trường label */}
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

                <form onSubmit={handleAddTracked} className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px_180px_120px] gap-3">
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">
                        {t('watchlist.stockSymbol')}
                      </label>
                      <input
                        value={addSymbol}
                        onChange={(e) => setAddSymbol(e.target.value.toUpperCase())}
                        placeholder={t('watchlist.symbolExample')}
                        className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-brand-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">
                        {t('watchlist.sourceGroup')}
                      </label>
                      <select
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
                      <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">
                        {t('watchlist.whaleThresholdOverride')}
                      </label>
                      <input
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

                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-100 uppercase tracking-wider">{t('watchlist.personalPriceAlerts')}</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {t('watchlist.personalPriceAlertsDesc')}
                      </p>
                    </div>
                    {priceAlertMsg && <span className="text-xs text-blue-300">{priceAlertMsg}</span>}
                  </div>

                  <form onSubmit={handleCreatePriceAlert} className="grid grid-cols-1 lg:grid-cols-[1fr_180px_1fr_180px_140px] gap-3">
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">{t('watchlist.stockSymbol')}</label>
                      <input
                        value={priceAlertForm.symbol}
                        onChange={(e) => setPriceAlertForm((prev) => ({ ...prev, symbol: e.target.value.toUpperCase() }))}
                        placeholder={t('watchlist.symbolExample')}
                        className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-brand-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">{t('watchlist.condition')}</label>
                      <select
                        value={priceAlertForm.condition}
                        onChange={(e) => setPriceAlertForm((prev) => ({ ...prev, condition: e.target.value }))}
                        className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-brand-600"
                      >
                        <option value="ABOVE">{t('watchlist.above')}</option>
                        <option value="BELOW">{t('watchlist.below')}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">{t('watchlist.targetPrice')}</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={priceAlertForm.targetPrice}
                        onChange={(e) => setPriceAlertForm((prev) => ({ ...prev, targetPrice: e.target.value }))}
                        placeholder="120000"
                        className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-brand-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">{t('watchlist.cooldownSeconds')}</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={priceAlertForm.cooldownSeconds}
                        onChange={(e) => setPriceAlertForm((prev) => ({ ...prev, cooldownSeconds: e.target.value }))}
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

                  {triggeredPriceAlerts.length > 0 && (
                    <div className="rounded-xl border border-blue-900/50 bg-blue-950/20 px-4 py-3">
                      <p className="text-xs uppercase tracking-wider text-blue-300 mb-2">{t('watchlist.recentTriggers')}</p>
                      <div className="space-y-2 text-sm">
                        {triggeredPriceAlerts.map((alert) => (
                          <div key={`${alert.id}-${alert.triggered_at}`} className="flex flex-wrap items-center gap-3 text-gray-300">
                            <span className="font-semibold text-gray-100">{alert.symbol}</span>
                            <span>{alert.condition === 'ABOVE' ? t('watchlist.above') : t('watchlist.below')}</span>
                            <span className="tabular-nums">{formatNumber(alert.target_price)} VNĐ</span>
                            <span className="text-xs text-gray-500">{formatDateTime(alert.triggered_at)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden">
                    {priceAlertsLoading ? (
                      <div className="py-8 text-center text-gray-500 text-sm">{t('watchlist.loadingPriceAlerts')}</div>
                    ) : priceAlertsWithRealtime.length === 0 ? (
                      <div className="py-8 text-center text-gray-500 text-sm">{t('watchlist.emptyPriceAlerts')}</div>
                    ) : (
                      <>
                        <p className="px-4 pt-3 text-[11px] text-gray-500">{t('watchlist.priceUnitHint')}</p>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-800">
                              <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">{t('watchlist.tableSymbol')}</th>
                              <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">{t('watchlist.tableCondition')}</th>
                              <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">{t('watchlist.tableTarget')}</th>
                              <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">{t('watchlist.tableCurrentPrice')}</th>
                              <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">{t('watchlist.tableStatus')}</th>
                              <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">{t('watchlist.tableCooldown')}</th>
                              <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">{t('watchlist.tableLastTrigger')}</th>
                              <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">{t('watchlist.tableActions')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-800/60">
                            {priceAlertsWithRealtime.map((rule) => (
                              <tr key={rule.id} className="hover:bg-gray-900/40 transition-colors">
                                <td className="px-4 py-3 font-bold text-blue-300">{rule.symbol}</td>
                                <td className="px-4 py-3 text-gray-300">{priceAlertConditionLabels[rule.condition]}</td>
                                <td className="px-4 py-3 text-gray-300 tabular-nums">{formatQuotePrice(rule.target_price)}</td>
                                <td className="px-4 py-3 text-gray-300 tabular-nums">
                                  {(rule.current_price !== null && rule.current_price !== undefined)
                                    ? formatQuotePrice(rule.current_price)
                                    : '—'}
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                                    !rule.is_active
                                      ? 'bg-gray-800 text-gray-400'
                                      : isPriceAlertMatched(rule, rule.current_price) && !rule.stale
                                        ? 'bg-blue-900/40 text-blue-300'
                                        : 'bg-emerald-900/30 text-emerald-300'
                                  }`}>
                                    {!rule.is_active ? t('watchlist.paused') : isPriceAlertMatched(rule, rule.current_price) && !rule.stale ? t('watchlist.hitThreshold') : t('watchlist.tracking')}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-gray-400">{rule.cooldown_seconds}s</td>
                                <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDateTime(rule.last_triggered_at)}</td>
                                <td className="px-4 py-3 text-right">
                                  <div className="flex items-center justify-end gap-3">
                                    <button
                                      onClick={() => handleTogglePriceAlert(rule)}
                                      className="text-xs text-gray-300 hover:text-gray-100 font-semibold"
                                    >
                                      {rule.is_active ? t('watchlist.pause') : t('watchlist.activate')}
                                    </button>
                                    <button
                                      onClick={() => handleDeletePriceAlert(rule)}
                                      className="text-xs text-red-400 hover:text-red-300 font-semibold"
                                    >
                                      {t('watchlist.delete')}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}
                  </div>
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  {trackedLoading ? (
                    <div className="py-10 text-center text-gray-500 text-sm">{t('watchlist.loadingTracked')}</div>
                  ) : trackedSymbolsWithRealtime.length === 0 ? (
                    <div className="py-10 text-center text-gray-500 text-sm">{t('watchlist.emptyTracked')}</div>
                  ) : (
                    <div>
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
                              type="text"
                              value={trackedSymbolSearch}
                              onChange={(e) => setTrackedSymbolSearch(e.target.value.toUpperCase())}
                              placeholder={t('watchlist.searchSymbolPlaceholder')}
                              className="w-52 bg-gray-950 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-100 outline-none focus:border-brand-600"
                            />
                            <select
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

                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={bulkThresholdMillion}
                            onChange={(e) => setBulkThresholdMillion(e.target.value)}
                            placeholder={t('watchlist.bulkThresholdPlaceholder')}
                            className="w-44 bg-gray-950 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-100 outline-none focus:border-brand-600"
                          />
                          <button
                            onClick={handleBulkSetTrackedThreshold}
                            disabled={trackedBulkAction != null}
                            className="text-xs font-semibold px-3 py-1.5 rounded-md bg-emerald-700/80 hover:bg-emerald-700 text-white disabled:opacity-50"
                          >
                            {trackedBulkAction === 'set' ? t('watchlist.saving') : t('watchlist.bulkSetThreshold')}
                          </button>
                          <button
                            onClick={handleBulkClearTrackedThreshold}
                            disabled={trackedBulkAction != null}
                            className="text-xs font-semibold px-3 py-1.5 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-200 disabled:opacity-50"
                          >
                            {trackedBulkAction === 'clear' ? t('watchlist.saving') : t('watchlist.bulkClearThreshold')}
                          </button>
                        </div>
                      </div>

                      {sortedTrackedSymbolsWithRealtime.length === 0 ? (
                        <div className="py-10 text-center text-gray-500 text-sm">{t('watchlist.noMatchFilter')}</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <p className="px-4 py-2 text-[11px] text-gray-500">{t('watchlist.priceUnitHint')}</p>
                        <table className="w-full min-w-[1020px] text-sm">
                      <thead>
                        <tr className="border-b border-gray-800">
                          <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">
                            <button onClick={() => toggleTrackedSort('symbol')} className="inline-flex items-center gap-1 hover:text-gray-200">
                              {t('watchlist.tableSymbol')}
                              <span className="text-[10px] text-gray-600">{getTrackedSortIndicator('symbol')}</span>
                            </button>
                          </th>
                          <th className="w-[180px] px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">{t('watchlist.sourceGroup')}</th>
                          <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">
                            <button onClick={() => toggleTrackedSort('current_price')} className="inline-flex items-center gap-1 hover:text-gray-200">
                              {t('watchlist.tableCurrentPrice')}
                              <span className="text-[10px] text-gray-600">{getTrackedSortIndicator('current_price')}</span>
                            </button>
                          </th>
                          <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">
                            <button onClick={() => toggleTrackedSort('change_value')} className="inline-flex items-center gap-1 hover:text-gray-200">
                              {t('watchlist.tableChange')}
                              <span className="text-[10px] text-gray-600">{getTrackedSortIndicator('change_value')}</span>
                            </button>
                          </th>
                          <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">
                            <button onClick={() => toggleTrackedSort('change_pct')} className="inline-flex items-center gap-1 hover:text-gray-200">
                              {t('watchlist.tablePctChange')}
                              <span className="text-[10px] text-gray-600">{getTrackedSortIndicator('change_pct')}</span>
                            </button>
                          </th>
                          <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">{t('watchlist.whaleThresholdColumn')}</th>
                          <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">
                            <button onClick={() => toggleTrackedSort('updated_at')} className="inline-flex items-center gap-1 hover:text-gray-200">
                              {t('watchlist.tableUpdatedAt')}
                              <span className="text-[10px] text-gray-600">{getTrackedSortIndicator('updated_at')}</span>
                            </button>
                          </th>
                          <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">{t('watchlist.tableActions')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/60">
                        {pagedTrackedSymbolsWithRealtime.map((item) => (
                          <tr key={item.id} className="hover:bg-gray-800/50 transition-colors">
                            <td className="px-4 py-3">
                              <button
                                onClick={() => openStockWorkspace(item.symbol)}
                                className="font-bold text-sm px-2 py-0.5 rounded bg-brand-900/40 text-brand-300 hover:text-brand-200 transition-colors"
                              >
                                {item.symbol}
                              </button>
                            </td>
                            <td
                              className="w-[180px] max-w-[180px] px-4 py-3 text-gray-400 text-xs truncate"
                              title={item.source_group_name || t('watchlist.manualAdded')}
                            >
                              {item.source_group_name || t('watchlist.manualAdded')}
                            </td>
                            <td className="px-4 py-3">{formatPrice(item.current_price, formatQuotePrice)}</td>
                            <td className="px-4 py-3"><ChangeCell value={item.change_value} /></td>
                            <td className="px-4 py-3"><PctCell pct={item.change_pct} emptyLabel={t('watchlist.notSynced')} /></td>
                            <td className="px-4 py-3 text-xs">
                              {editingTrackedId === item.id ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={editingTrackedThresholdValue}
                                    onChange={(e) => setEditingTrackedThresholdValue(e.target.value)}
                                    placeholder={t('watchlist.useGlobalThreshold')}
                                    className="w-24 bg-gray-950 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 outline-none focus:border-brand-600"
                                  />
                                  <button
                                    onClick={() => handleSaveTrackedThreshold(item)}
                                    disabled={updatingTrackedId === item.id}
                                    className="text-xs text-emerald-300 hover:text-emerald-200 font-semibold disabled:opacity-50"
                                  >
                                    {updatingTrackedId === item.id ? t('watchlist.saving') : t('watchlist.save')}
                                  </button>
                                  <button
                                    onClick={handleCancelTrackedThresholdEdit}
                                    disabled={updatingTrackedId === item.id}
                                    className="text-xs text-gray-300 hover:text-gray-100 font-semibold disabled:opacity-50"
                                  >
                                    {t('watchlist.cancel')}
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleStartTrackedThresholdEdit(item)}
                                  className="text-gray-300 tabular-nums whitespace-nowrap hover:text-blue-200"
                                  title={t('watchlist.editThreshold')}
                                >
                                  {item.whale_alert_threshold_million == null ? '—' : `${formatNumber(item.whale_alert_threshold_million)}M`}
                                </button>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                              {item.updated_at ? formatDateTime(item.updated_at) : '—'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-3">
                                <button
                                  onClick={() => handleDeleteTracked(item.id, item.symbol)}
                                  className="text-xs text-red-400 hover:text-red-300 font-semibold"
                                >
                                  {t('watchlist.delete')}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                        </table>
                        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-gray-800 bg-gray-950/50 text-xs text-gray-400">
                          <span>
                            {t('watchlist.paginationSummary', {
                              from: formatNumber((trackedCurrentPage - 1) * trackedPageSize + 1),
                              to: formatNumber(Math.min(trackedCurrentPage * trackedPageSize, sortedTrackedSymbolsWithRealtime.length)),
                              total: formatNumber(sortedTrackedSymbolsWithRealtime.length),
                            })}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setTrackedPage((prev) => Math.max(1, prev - 1))}
                              disabled={trackedCurrentPage <= 1}
                              className="px-2.5 py-1 rounded border border-gray-700 text-gray-300 disabled:opacity-40"
                            >
                              {t('watchlist.prevPage')}
                            </button>
                            <span>{t('watchlist.pageLabel', { page: formatNumber(trackedCurrentPage), total: formatNumber(trackedTotalPages) })}</span>
                            <button
                              onClick={() => setTrackedPage((prev) => Math.min(trackedTotalPages, prev + 1))}
                              disabled={trackedCurrentPage >= trackedTotalPages}
                              className="px-2.5 py-1 rounded border border-gray-700 text-gray-300 disabled:opacity-40"
                            >
                              {t('watchlist.nextPage')}
                            </button>
                          </div>
                        </div>
                        </div>
                      )}
                    </div>
                  )}
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
                    <span className="text-gray-500">— {t('watchlist.flatCount', { count: formatNumber(groupStats.flat) })}</span>
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
                          type="text"
                          value={groupSymbolSearch}
                          onChange={(e) => setGroupSymbolSearch(e.target.value.toUpperCase())}
                          placeholder={t('watchlist.searchSymbolPlaceholder')}
                          className="w-52 bg-gray-950 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-100 outline-none focus:border-brand-600"
                        />
                        <select
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
                    <div className="overflow-x-auto">
                      <p className="px-4 py-2 text-[11px] text-gray-500">{t('watchlist.priceUnitHint')}</p>
                      <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-800">
                          <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">
                            <button onClick={() => toggleGroupSort('symbol')} className="inline-flex items-center gap-1 hover:text-gray-200">
                              {t('watchlist.stockSymbol')}
                              <span className="text-[10px] text-gray-600">{getGroupSortIndicator('symbol')}</span>
                            </button>
                          </th>
                          <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">
                            <button onClick={() => toggleGroupSort('current_price')} className="inline-flex items-center gap-1 hover:text-gray-200">
                              {t('watchlist.closePrice')}
                              <span className="text-[10px] text-gray-600">{getGroupSortIndicator('current_price')}</span>
                            </button>
                          </th>
                          <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">
                            <button onClick={() => toggleGroupSort('change_value')} className="inline-flex items-center gap-1 hover:text-gray-200">
                              {t('watchlist.tableChange')}
                              <span className="text-[10px] text-gray-600">{getGroupSortIndicator('change_value')}</span>
                            </button>
                          </th>
                          <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">
                            <button onClick={() => toggleGroupSort('change_pct')} className="inline-flex items-center gap-1 hover:text-gray-200">
                              {t('watchlist.tablePctChange')}
                              <span className="text-[10px] text-gray-600">{getGroupSortIndicator('change_pct')}</span>
                            </button>
                          </th>
                          <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">
                            <button onClick={() => toggleGroupSort('last_date')} className="inline-flex items-center gap-1 hover:text-gray-200">
                              {t('watchlist.date')}
                              <span className="text-[10px] text-gray-600">{getGroupSortIndicator('last_date')}</span>
                            </button>
                          </th>
                          <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">
                            {t('watchlist.tableActions')}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/60">
                        {pagedActiveGroupItems.map((item) => (
                          <tr 
                            key={item.id} 
                            className="hover:bg-gray-800/50 cursor-pointer transition-colors"
                            onClick={() => openStockWorkspace(item.symbol)}
                          >
                            <td className="px-4 py-3">
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
                            <td className="px-4 py-3">{formatPrice(item.current_price, formatQuotePrice)}</td>
                            <td className="px-4 py-3"><ChangeCell value={item.change_value} /></td>
                            <td className="px-4 py-3"><PctCell pct={item.change_pct} emptyLabel={t('watchlist.notSynced')} /></td>
                            <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                              {item.last_date || '—'}
                            </td>
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
                          </tr>
                        ))}
                      </tbody>
                    </table>
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

