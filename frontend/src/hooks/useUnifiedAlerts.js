import { useEffect, useMemo, useState } from 'react';
import { getAggregateWhaleFeed, getUnifiedAlerts } from '../api/client';
import { buildDashboardRealtimeQuoteList } from '../utils/dashboardRealtimeViewModel';

const DEFAULT_UNIFIED_ALERTS_PAGE_SIZE = 10;

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

function normalizeUnifiedSeverity(value, fallback = 'medium') {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'critical' || normalized === 'extreme') return 'critical';
  if (normalized === 'high') return 'high';
  if (normalized === 'medium') return 'medium';
  if (normalized === 'low') return 'low';
  return fallback;
}

function severityWeight(severity) {
  if (severity === 'critical') return 4;
  if (severity === 'high') return 3;
  if (severity === 'medium') return 2;
  return 1;
}

function localizeUnifiedHeadline(headline, t) {
  const normalized = String(headline || '').trim().toLowerCase();
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

  return headline;
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
  return normalizeUnifiedSeverity(value, fallback);
}

export default function useUnifiedAlerts({
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
  const [snapshotAlerts, setSnapshotAlerts] = useState([]);
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

  useEffect(() => {
    let cancelled = false;

    const loadSnapshotAlerts = async () => {
      if (!enableSnapshot || !monitoredSymbols.length) {
        if (!cancelled) setSnapshotAlerts([]);
        return;
      }

      try {
        const response = await getAggregateWhaleFeed({
          symbols: monitoredSymbols,
          sort: 'ts',
          limit: 8,
        });
        if (!cancelled) {
          setSnapshotAlerts(response.data?.results || []);
        }
      } catch (_err) {
        if (!cancelled) setSnapshotAlerts([]);
      }
    };

    loadSnapshotAlerts();
    const intervalId = window.setInterval(loadSnapshotAlerts, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [monitoredKey, monitoredSymbols, enableSnapshot]);

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
      const response = await getUnifiedAlerts({
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
    const resetStack = [null];
    setCursorStack(resetStack);
    setCurrentPageIndex(0);
    fetchUnifiedPage(0, resetStack);
  }, [sourceFilter, severityFilter, audienceFilter, pageSize]);

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

  const mergedAlerts = useMemo(() => {
    const combined = [];
    const seen = new Set();

    [...alerts, ...snapshotAlerts].forEach((item, index) => {
      const key = item.event_id || `${item.symbol || 'NA'}-${item.ts || 'NA'}-${item.side || 'NA'}-${index}`;
      if (seen.has(key)) return;
      seen.add(key);
      combined.push(item);
    });

    combined.sort((left, right) => {
      const leftTs = new Date(left.ts || left.created_at || 0).getTime();
      const rightTs = new Date(right.ts || right.created_at || 0).getTime();
      return rightTs - leftTs;
    });

    return combined.slice(0, 8);
  }, [alerts, snapshotAlerts]);

  const quoteList = useMemo(() => {
    return buildDashboardRealtimeQuoteList({
      monitoredSymbols,
      quotesBySymbol,
      holdings,
    });
  }, [holdings, monitoredSymbols, quotesBySymbol]);

  const unifiedAlerts = useMemo(() => {
    const whaleAlerts = mergedAlerts.map((alert) => {
      const side = String(alert.side || '').toLowerCase();
      const isBuy = side === 'buy';
      const severity = normalizeUnifiedSeverity(alert.severity, 'high');
      const valueText = fmtBil(alert.matched_value, formatNumber);
      return {
        id: `whale-${alert.event_id || `${alert.symbol}-${alert.ts}`}`,
        symbol: alert.symbol,
        ts: alert.ts,
        source: 'whale',
        severity,
        headline: isBuy ? t('dashboardRealtime.unifiedHeadlineWhaleBuy') : t('dashboardRealtime.unifiedHeadlineWhaleSell'),
        detail: t('dashboardRealtime.unifiedDetailWhaleValue', { value: valueText }),
        confidence: alert.display_score ?? alert.event_score ?? null,
        to: `/whale-alerts/${alert.symbol}`,
      };
    });

    const darkFlowUnified = (darkFlowAlerts || []).map((alert) => {
      const confidence = Number(alert.confidence ?? 0);
      const strength = Number(alert.strength ?? 0);
      const severity = confidence >= 80 || strength >= 80
        ? 'critical'
        : confidence >= 65 || strength >= 65
          ? 'high'
          : 'medium';

      return {
        id: `dark-${alert.event_id || `${alert.symbol}-${alert.ts}`}`,
        symbol: alert.symbol,
        ts: alert.ts,
        source: 'dark_flow',
        severity,
        headline: t('dashboardRealtime.unifiedHeadlineDarkFlow'),
        detail: alert.description || t('dashboardRealtime.unifiedDetailDarkFlowFallback'),
        confidence,
        to: `/stocks/${alert.symbol}`,
      };
    });

    const priceShockUnified = quoteList
      .filter((item) => item?.symbol && Math.abs(Number(item?.change_pct ?? 0)) >= 5)
      .map((item) => {
        const pct = Number(item.change_pct || 0);
        const absPct = Math.abs(pct);
        const severity = absPct >= 7 ? 'high' : 'medium';
        const stableTs = toStableAlertTimestamp(item.last_date, _lastEventAt);
        return {
          id: `price-${item.symbol}`,
          symbol: item.symbol,
          ts: stableTs,
          source: 'price_shock',
          severity,
          headline: pct >= 0
            ? t('dashboardRealtime.unifiedHeadlinePriceJump')
            : t('dashboardRealtime.unifiedHeadlinePriceDrop'),
          detail: t('dashboardRealtime.unifiedDetailPriceShock', { pct: absPct.toFixed(2) }),
          confidence: null,
          to: `/stocks/${item.symbol}`,
        };
      });

    const staleUnified = quoteList
      .filter((item) => item?.symbol && item?.stale)
      .slice(0, 3)
      .map((item) => {
        const stableTs = toStableAlertTimestamp(item.last_date, _lastEventAt);
        return {
          id: `stale-${item.symbol}`,
          symbol: item.symbol,
          ts: stableTs,
          source: 'stale_quote',
          severity: 'low',
          headline: t('dashboardRealtime.unifiedHeadlineStaleQuote'),
          detail: t('dashboardRealtime.unifiedDetailStaleQuote', { seconds: formatNumber(item.freshness_seconds ?? 0) }),
          confidence: null,
          to: `/stocks/${item.symbol}`,
        };
      });

    const combined = [...whaleAlerts, ...darkFlowUnified, ...priceShockUnified, ...staleUnified];
    const backendNormalized = (backendUnifiedSnapshot || []).map((item) => ({
      id: item.event_id || `${item.source}-${item.symbol}-${item.ts}`,
      symbol: item.symbol,
      ts: item.ts,
      source: item.source,
      severity: item.severity,
      headline: localizeUnifiedHeadline(item.headline, t),
      detail: item.detail,
      confidence: item.confidence ?? null,
      to: item.to || (item.source === 'whale' ? `/whale-alerts/${item.symbol}` : `/stocks/${item.symbol}`),
    }));

    const combinedWithBackend = [...backendNormalized, ...combined];
    const seen = new Set();
    const deduped = combinedWithBackend.filter((item) => {
      const normalizedTs = toStableAlertTimestamp(item.ts) || 'na';
      const fallbackId = `${item.source || 'unknown'}-${item.symbol || 'NA'}-${item.headline || 'no-headline'}-${normalizedTs}`;
      const key = String(item.id || fallbackId);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    deduped.sort((a, b) => {
      const aScore = severityWeight(a.severity);
      const bScore = severityWeight(b.severity);
      if (aScore !== bScore) return bScore - aScore;
      const timeDelta = new Date(b.ts || 0).getTime() - new Date(a.ts || 0).getTime();
      if (timeDelta !== 0) return timeDelta;
      return String(a.symbol || '').localeCompare(String(b.symbol || ''));
    });

    return deduped;
  }, [backendUnifiedSnapshot, darkFlowAlerts, formatNumber, _lastEventAt, mergedAlerts, quoteList, t]);

  const filteredUnifiedAlerts = useMemo(() => {
    const severityRank = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4,
    };

    const passesSeverity = (severity) => {
      if (severityFilter === 'all') return true;
      const normalizedSeverity = normalizeUnifiedSeverity(severity, 'medium');
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
      const normalized = normalizeUnifiedSeverity(item.severity, 'medium');
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
      const sev = normalizeUnifiedSeverity(item.severity, 'medium');
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
    hasLastUnifiedPage: cursorStack.length - 1 > currentPageIndex,
  };
}
