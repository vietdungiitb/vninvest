import { useEffect, useMemo, useState } from 'react';
import { getAlertCenterFeed } from '../api/client';
import { buildDashboardRealtimeQuoteList } from '../utils/dashboardRealtimeViewModel';
import {
  normalizeAlertSeverity,
  normalizeAlertType,
  severityWeight,
} from '../utils/alertTaxonomy';

const DEFAULT_UNIFIED_ALERTS_PAGE_SIZE = 10;

export function normalizeAlertText(value, fallback = '') {
  if (value === null || value === undefined) {
    return fallback;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'object') {
    const messageCandidate = value.message || value.detail || value.description || value.headline || value.title;
    if (typeof messageCandidate === 'string' && messageCandidate.trim()) {
      return messageCandidate;
    }
    try {
      return JSON.stringify(value);
    } catch (_error) {
      return fallback;
    }
  }
  const text = String(value);
  return text || fallback;
}

function formatNumberSafe(value, formatNumberFn) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  return formatNumberFn(Number(value));
}

function fmtBil(value, formatNumberFn) {
  const v = Number(value) || 0;
  if (v >= 1_000_000_000_000) return `${(v / 1_000_000_000_000).toFixed(1)}N`;
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}T`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(0)}Tr`;
  return formatNumberSafe(v, formatNumberFn);
}

function localizeUnifiedDetail(detail, t, formatNumberFn) {
  const normalizedDetail = normalizeAlertText(detail, '');
  if (!normalizedDetail) return normalizedDetail;

  // Regex to detect "Matched value: 1234567.8" or "matched value: 1234567.8"
  const whaleValueMatch = normalizedDetail.match(/(matched value|giá trị khớp|gia tri khop):\s*([\d.]+)/i);
  if (whaleValueMatch) {
    const rawValue = whaleValueMatch[2];
    const formattedValue = fmtBil(rawValue, formatNumberFn);
    return t('dashboardRealtime.unifiedDetailWhaleValue', { value: formattedValue });
  }

  // Handle Price Shock detail: "Price changed 5.20% in short window"
  const priceShockMatch = normalizedDetail.match(/price changed ([\d.]+)%/i);
  if (priceShockMatch) {
    return t('dashboardRealtime.unifiedDetailPriceShock', { pct: priceShockMatch[1] });
  }

  // Handle Stale Quote: "Quote is stale 30s"
  const staleMatch = normalizedDetail.match(/quote is stale ([\d.]+)s/i);
  if (staleMatch) {
    return t('dashboardRealtime.unifiedDetailStaleQuote', { seconds: staleMatch[1] });
  }

  return normalizedDetail;
}

function localizeUnifiedHeadline(headline, t) {
  const normalizedHeadline = normalizeAlertText(headline, '');
  const normalized = normalizedHeadline.trim().toLowerCase();
  if (!normalized) return headline;

  const mappings = [
    {
      key: 'dashboardRealtime.unifiedHeadlineWhaleBuy',
      aliases: ['large buy flow detected', 'phat hien dong tien mua lon', 'phát hiện dòng tiền mua lớn'],
    },
    {
      key: 'dashboardRealtime.unifiedHeadlineWhaleSell',
      aliases: ['large sell flow detected', 'phat hien dong tien ban lon', 'phát hiện dòng tiền bán lớn'],
    },
    {
      key: 'dashboardRealtime.unifiedHeadlineDarkFlow',
      aliases: ['dark flow anomaly detected', 'phat hien bat thuong dong tien toi', 'phát hiện bất thường dòng tiền tối'],
    },
    {
      key: 'dashboardRealtime.unifiedHeadlinePriceJump',
      aliases: ['price jump detected', 'gia tang dot bien', 'giá tăng đột biến'],
    },
    {
      key: 'dashboardRealtime.unifiedHeadlinePriceDrop',
      aliases: ['price drop detected', 'gia giam dot bien', 'giá giảm đột biến'],
    },
    {
      key: 'dashboardRealtime.unifiedHeadlineStaleQuote',
      aliases: ['stale quote warning', 'bao gia cham cap nhat', 'báo giá chậm cập nhật'],
    },
  ];

  for (const item of mappings) {
    const translated = String(t(item.key) || '').trim().toLowerCase();
    if (translated && normalized === translated) {
      return t(item.key);
    }
    if (item.aliases.includes(normalized)) {
      return t(item.key);
    }
  }

  return normalizedHeadline;
}

function toStableAlertTimestamp(...values) {
  for (const value of values) {
    if (!value) continue;
    const ts = new Date(value).getTime();
    if (Number.isFinite(ts) && ts > 0) {
      return new Date(ts).toISOString();
    }
  }
  return null;
}

export function normalizeSeverity(value, fallback = 'medium') {
  return normalizeAlertSeverity(value, fallback);
}

export default function useAlertCenterFeed({
  alerts = [],
  darkFlowAlerts = [],
  monitoredSymbols = [],
  quotesBySymbol = {},
  holdings = [],
  trackedSymbolNames = [],
  enableSnapshot = true,
  lastEventAt: _lastEventAt = null,
  sourceFilter = 'all',
  severityFilter = 'all',
  audienceFilter = 'all',
  pageSize = DEFAULT_UNIFIED_ALERTS_PAGE_SIZE,
  isMutedSymbol,
  formatNumber,
  t,
}) {
  const [backendUnifiedSnapshot, setBackendUnifiedSnapshot] = useState([]);
  const [backendUnifiedNextCursor, setBackendUnifiedNextCursor] = useState(null);
  const [backendUnifiedHasMore, setBackendUnifiedHasMore] = useState(false);
  const [loadingMoreUnified, setLoadingMoreUnified] = useState(false);
  const [cursorStack, setCursorStack] = useState([null]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  const monitoredKey = useMemo(
    () => monitoredSymbols.slice().sort().join('|'),
    [monitoredSymbols],
  );

  const fetchUnifiedPage = async (pageIndex, stackOverride = null) => {
    if (!enableSnapshot || !monitoredSymbols.length) {
      setBackendUnifiedSnapshot([]);
      setBackendUnifiedNextCursor(null);
      setBackendUnifiedHasMore(false);
      setCursorStack([null]);
      setCurrentPageIndex(0);
      return;
    }

    const activeStack = stackOverride || cursorStack;
    const cursor = activeStack[pageIndex] ?? null;
    if (pageIndex > 0 && !cursor) {
      return;
    }

    setLoadingMoreUnified(true);
    try {
      const response = await getAlertCenterFeed({
        symbols: monitoredSymbols,
        window: 'session',
        limit: pageSize,
        severityMin: 'low',
        cursor,
      });

      const incoming = response.data?.results || [];
      const nextCursor = response.data?.next_cursor || null;
      const hasMore = Boolean(response.data?.has_more);

      setBackendUnifiedSnapshot(incoming);
      setBackendUnifiedNextCursor(nextCursor);
      setBackendUnifiedHasMore(hasMore);
      setCurrentPageIndex(pageIndex);

      setCursorStack((prev) => {
        const base = stackOverride ? [...stackOverride] : [...prev];
        if (base.length < pageIndex + 1) {
          for (let i = base.length; i <= pageIndex; i += 1) {
            base[i] = null;
          }
        }
        if (nextCursor) {
          base[pageIndex + 1] = nextCursor;
        }
        return base;
      });
    } catch (_err) {
      setBackendUnifiedSnapshot([]);
      setBackendUnifiedNextCursor(null);
      setBackendUnifiedHasMore(false);
    } finally {
      setLoadingMoreUnified(false);
    }
  };

  useEffect(() => {
    const resetStack = [null];
    setCursorStack(resetStack);
    setCurrentPageIndex(0);
    fetchUnifiedPage(0, resetStack);
  }, [enableSnapshot, monitoredKey, pageSize]);

  useEffect(() => {
    if (!enableSnapshot || !monitoredSymbols.length) {
      return undefined;
    }
    const intervalId = window.setInterval(() => {
      fetchUnifiedPage(currentPageIndex);
    }, 30000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [enableSnapshot, monitoredKey, currentPageIndex, pageSize]);

  const goToFirstUnifiedPage = async () => {
    const resetStack = [null];
    setCursorStack(resetStack);
    await fetchUnifiedPage(0, resetStack);
  };

  const goToPreviousUnifiedPage = async () => {
    if (currentPageIndex <= 0 || loadingMoreUnified) return;
    await fetchUnifiedPage(currentPageIndex - 1);
  };

  const goToNextUnifiedPage = async () => {
    if (!backendUnifiedHasMore || !backendUnifiedNextCursor || loadingMoreUnified) return;
    await fetchUnifiedPage(currentPageIndex + 1);
  };

  const goToLastUnifiedPage = async () => {
    if (loadingMoreUnified) return;
    const lastKnownIndex = cursorStack.length - 1;
    if (lastKnownIndex > currentPageIndex) {
      await fetchUnifiedPage(lastKnownIndex);
    }
  };

  const quoteList = useMemo(() => {
    return buildDashboardRealtimeQuoteList({
      monitoredSymbols,
      quotesBySymbol,
      holdings,
    });
  }, [holdings, monitoredSymbols, quotesBySymbol]);

  const unifiedAlerts = useMemo(() => {
    const normalizedAlerts = (backendUnifiedSnapshot || []).map((item) => ({
      id: item.alert_id || item.event_id || `${item.alert_type || item.source || 'alert'}-${item.symbol || 'NA'}-${item.triggered_at || item.ts || 'na'}`,
      symbol: item.symbol,
      ts: item.triggered_at || item.ts,
      source: item.alert_type || item.source,
      severity: normalizeAlertSeverity(item.severity, 'medium'),
      type: normalizeAlertType(item.type || item.direction || item.alert_type, 'neutral'),
      headline: localizeUnifiedHeadline(item.title || item.headline, t),
      detail: localizeUnifiedDetail(item.body || item.detail, t, formatNumber),
      confidence: item.confidence ?? null,
      lane: item.lane || 'main',
      to: item.to || ((item.alert_type || item.source) === 'whale' ? `/whale-alerts/${item.symbol}` : `/stocks/${item.symbol}`),
    }));

    normalizedAlerts.sort((a, b) => {
      const aScore = severityWeight(a.severity);
      const bScore = severityWeight(b.severity);
      if (aScore !== bScore) return bScore - aScore;
      const timeDelta = new Date(b.ts || 0).getTime() - new Date(a.ts || 0).getTime();
      if (timeDelta !== 0) return timeDelta;
      return String(a.symbol || '').localeCompare(String(b.symbol || ''));
    });

    return normalizedAlerts;
  }, [backendUnifiedSnapshot, formatNumber, t]);

  const filteredUnifiedAlerts = useMemo(() => {
    const severityRank = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4,
    };

    const passesSeverity = (severity) => {
      if (severityFilter === 'all') return true;
      const normalizedSeverity = normalizeAlertSeverity(severity, 'medium');
      const value = severityRank[normalizedSeverity];
      if (severityFilter === 'critical_only') return normalizedSeverity === 'critical';
      if (severityFilter === 'high_only') return normalizedSeverity === 'high';
      if (severityFilter === 'medium_only') return normalizedSeverity === 'medium';
      if (severityFilter === 'low_only') return normalizedSeverity === 'low';
      if (severityFilter === 'critical') return value >= 4;
      if (severityFilter === 'high_plus') return value >= 3;
      if (severityFilter === 'medium_plus') return value >= 2;
      return true;
    };

    const filtered = unifiedAlerts.filter((item) => {
      if (sourceFilter !== 'all' && item.source !== sourceFilter) {
        return false;
      }
      if (!passesSeverity(item.severity)) {
        return false;
      }
      if (audienceFilter === 'holdings') {
        const holdingSet = new Set((holdings || []).map((h) => String(h.symbol || '').toUpperCase()).filter(Boolean));
        if (!holdingSet.has(String(item.symbol || '').toUpperCase())) {
          return false;
        }
      }
      if (audienceFilter === 'watchlist') {
        const watchlistSet = new Set((trackedSymbolNames || []).map((s) => String(s || '').toUpperCase()).filter(Boolean));
        if (!watchlistSet.has(String(item.symbol || '').toUpperCase())) {
          return false;
        }
      }
      if (isMutedSymbol && isMutedSymbol(item.symbol)) {
        return false;
      }
      return true;
    });

    return filtered;
  }, [unifiedAlerts, sourceFilter, severityFilter, audienceFilter, holdings, trackedSymbolNames, isMutedSymbol]);

  const scopedUnifiedAlerts = useMemo(() => {
    return unifiedAlerts.filter((item) => {
      if (sourceFilter !== 'all' && item.source !== sourceFilter) {
        return false;
      }
      if (audienceFilter === 'holdings') {
        const holdingSet = new Set((holdings || []).map((h) => String(h.symbol || '').toUpperCase()).filter(Boolean));
        if (!holdingSet.has(String(item.symbol || '').toUpperCase())) {
          return false;
        }
      }
      if (audienceFilter === 'watchlist') {
        const watchlistSet = new Set((trackedSymbolNames || []).map((s) => String(s || '').toUpperCase()).filter(Boolean));
        if (!watchlistSet.has(String(item.symbol || '').toUpperCase())) {
          return false;
        }
      }
      if (isMutedSymbol && isMutedSymbol(item.symbol)) {
        return false;
      }
      return true;
    });
  }, [unifiedAlerts, sourceFilter, audienceFilter, holdings, trackedSymbolNames, isMutedSymbol]);

  const alertSummary = useMemo(() => {
    return scopedUnifiedAlerts.reduce((acc, item) => {
      const normalized = normalizeAlertSeverity(item.severity, 'medium');
      acc[normalized] += 1;
      acc.total += 1;
      return acc;
    }, {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      total: 0,
    });
  }, [scopedUnifiedAlerts]);

  useEffect(() => {
    if (!enableSnapshot || currentPageIndex <= 0 || loadingMoreUnified) {
      return;
    }
    if (filteredUnifiedAlerts.length > 0) {
      return;
    }
    if (alertSummary.total <= 0) {
      return;
    }
    const resetStack = [null];
    setCursorStack(resetStack);
    setCurrentPageIndex(0);
    fetchUnifiedPage(0, resetStack);
  }, [
    enableSnapshot,
    currentPageIndex,
    loadingMoreUnified,
    filteredUnifiedAlerts.length,
    alertSummary.total,
  ]);

  const hotSymbols = useMemo(() => {
    const symbolMap = new Map();
    unifiedAlerts.forEach((item) => {
      if (!item.symbol) return;
      if (!symbolMap.has(item.symbol)) {
        symbolMap.set(item.symbol, {
          symbol: item.symbol,
          total: 0,
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
        });
      }
      const record = symbolMap.get(item.symbol);
      const sev = normalizeAlertSeverity(item.severity, 'medium');
      record.total += 1;
      record[sev] += 1;
    });

    return [...symbolMap.values()]
      .sort((a, b) => {
        if (b.critical !== a.critical) return b.critical - a.critical;
        if (b.high !== a.high) return b.high - a.high;
        if (b.total !== a.total) return b.total - a.total;
        return String(a.symbol || '').localeCompare(String(b.symbol || ''));
      })
      .slice(0, 5);
  }, [unifiedAlerts]);

  return {
    quoteList,
    unifiedAlerts,
    filteredUnifiedAlerts,
    alertSummary,
    hotSymbols,
    currentUnifiedPage: currentPageIndex + 1,
    hasPreviousUnifiedPage: currentPageIndex > 0,
    backendUnifiedHasMore,
    loadingMoreUnified,
    goToFirstUnifiedPage,
    goToPreviousUnifiedPage,
    goToNextUnifiedPage,
    goToLastUnifiedPage,
    loadMoreUnifiedSnapshot: goToNextUnifiedPage,
    hasLastUnifiedPage: cursorStack.length - 1 > currentPageIndex,
  };
}
