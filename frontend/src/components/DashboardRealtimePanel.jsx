import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAggregateWhaleFeed, getRealtimeHealth, getUnifiedAlerts } from '../api/client';
import RealtimeDebugPanel from './RealtimeDebugPanel';
import AllocationPieChart from './AllocationPieChart';
import { useI18n } from '../context/LangContext';

function formatNumberSafe(value, formatNumberFn) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  return formatNumberFn(Number(value));
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveQuoteScale(rawPrice, references = []) {
  const price = toFiniteNumber(rawPrice);
  if (!price || price <= 0) {
    return 1;
  }

  const validRefs = references.filter((item) => Number.isFinite(item) && item > 0);
  const candidates = [1, 0.001, 1000];

  if (!validRefs.length) {
    // Dashboard quy ước hiển thị đơn vị nghìn VNĐ; giá lớn bất thường thường là VND.
    return price >= 2000 ? 0.001 : 1;
  }

  const score = (factor) => {
    const normalized = price * factor;
    return validRefs.reduce((sum, ref) => sum + Math.abs(Math.log(normalized / ref)), 0);
  };

  let bestFactor = 1;
  let bestScore = score(bestFactor);
  for (let index = 1; index < candidates.length; index += 1) {
    const factor = candidates[index];
    const nextScore = score(factor);
    if (nextScore < bestScore) {
      bestScore = nextScore;
      bestFactor = factor;
    }
  }
  return bestFactor;
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

function unifiedSeverityTone(severity) {
  if (severity === 'critical') return 'border-rose-600/70 bg-rose-950/45 text-rose-200';
  if (severity === 'high') return 'border-amber-600/70 bg-amber-950/35 text-amber-200';
  if (severity === 'medium') return 'border-yellow-700/70 bg-yellow-950/25 text-yellow-200';
  return 'border-slate-700 bg-slate-950 text-slate-300';
}

function sourceTone(source) {
  if (source === 'dark_flow') return 'border-violet-800/80 bg-violet-950/35 text-violet-200';
  if (source === 'price_shock') return 'border-cyan-800/80 bg-cyan-950/35 text-cyan-200';
  if (source === 'stale_quote') return 'border-amber-800/80 bg-amber-950/35 text-amber-200';
  return 'border-emerald-800/80 bg-emerald-950/35 text-emerald-200';
}

function sourceLabel(source, t) {
  if (source === 'dark_flow') return t('dashboardRealtime.sourceDarkFlow');
  if (source === 'price_shock') return t('dashboardRealtime.sourcePriceShock');
  if (source === 'stale_quote') return t('dashboardRealtime.sourceStaleQuote');
  return t('dashboardRealtime.sourceWhale');
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

export default function DashboardRealtimePanel({
  holdings,
  trackedSymbolNames = [],
  quotesBySymbol = {},
  realtimeStatus = 'idle',
  lastEventAt = null,
  alerts = [],
  darkFlowAlerts = [],
  metrics = null,
  monitoredSymbols = [],
  enableSnapshot = true,
  onSyncRequest = null,
  showSummaryMetrics = true,
  portfolioId = null,
}) {
  const { t, formatNumber, formatTime, formatQuotePrice, formatQuoteInteger } = useI18n();
  const [realtimeHealth, setRealtimeHealth] = useState(null);
  const [snapshotAlerts, setSnapshotAlerts] = useState([]);
  const [backendUnifiedSnapshot, setBackendUnifiedSnapshot] = useState([]);
  const [backendUnifiedNextCursor, setBackendUnifiedNextCursor] = useState(null);
  const [backendUnifiedHasMore, setBackendUnifiedHasMore] = useState(false);
  const [loadingMoreUnified, setLoadingMoreUnified] = useState(false);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState('alerts');
  const [compact, setCompact] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [sourceFilter, setSourceFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [audienceFilter, setAudienceFilter] = useState('all');
  const [readAlertIds, setReadAlertIds] = useState(() => new Set());
  const [mutedSymbols, setMutedSymbols] = useState({});
  const [criticalToasts, setCriticalToasts] = useState([]);
  const [criticalSoundEnabled, setCriticalSoundEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    const raw = window.localStorage.getItem('dashboard_critical_sound_enabled');
    if (raw === null) return true;
    return raw === 'true';
  });
  const criticalToastCooldownRef = useRef({});

  const holdingSymbolSet = useMemo(
    () => new Set((holdings || []).map((h) => String(h.symbol || '').toUpperCase()).filter(Boolean)),
    [holdings],
  );

  const playCriticalTone = () => {
    if (!criticalSoundEnabled) return;
    if (typeof window === 'undefined' || !window.AudioContext) return;
    try {
      const ctx = new window.AudioContext();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.18);
      oscillator.onended = () => {
        ctx.close();
      };
    } catch (_err) {
      // Silent fail to avoid blocking alert UX when browser audio is restricted.
    }
  };

  const realtimeLabels = useMemo(() => ({
    idle: t('dashboardRealtime.statusIdle'),
    connecting: t('dashboardRealtime.statusConnecting'),
    live: t('dashboardRealtime.statusLive'),
    polling: t('dashboardRealtime.statusPolling'),
  }), [t]);

  const monitoredKey = useMemo(
    () => monitoredSymbols.slice().sort().join('|'),
    [monitoredSymbols],
  );

  // Tick every 15s so event-age badges stay current
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, []);

  const eventAgeSeconds = lastEventAt
    ? Math.max(0, Math.floor((now - new Date(lastEventAt).getTime()) / 1000))
    : null;

  const isEventStale = eventAgeSeconds !== null && eventAgeSeconds > 120;

  useEffect(() => {
    getRealtimeHealth()
      .then((res) => setRealtimeHealth(res.data))
      .catch(() => setRealtimeHealth(null));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadSnapshotAlerts = async () => {
      if (!enableSnapshot) {
        if (!cancelled) {
          setSnapshotAlerts([]);
        }
        return;
      }

      if (!monitoredSymbols.length) {
        if (!cancelled) {
          setSnapshotAlerts([]);
        }
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
        if (!cancelled) {
          setSnapshotAlerts([]);
        }
      }
    };

    loadSnapshotAlerts();
    const intervalId = window.setInterval(loadSnapshotAlerts, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [monitoredKey, monitoredSymbols, enableSnapshot]);

  useEffect(() => {
    let cancelled = false;

    const loadUnifiedSnapshot = async () => {
      if (!enableSnapshot || !monitoredSymbols.length) {
        if (!cancelled) {
          setBackendUnifiedSnapshot([]);
          setBackendUnifiedNextCursor(null);
          setBackendUnifiedHasMore(false);
        }
        return;
      }

      try {
        const response = await getUnifiedAlerts({
          symbols: monitoredSymbols,
          window: 'session',
          limit: 20,
          severityMin: 'low',
        });
        if (!cancelled) {
          setBackendUnifiedSnapshot(response.data?.results || []);
          setBackendUnifiedNextCursor(response.data?.next_cursor || null);
          setBackendUnifiedHasMore(Boolean(response.data?.has_more));
        }
      } catch (_err) {
        if (!cancelled) {
          setBackendUnifiedSnapshot([]);
          setBackendUnifiedNextCursor(null);
          setBackendUnifiedHasMore(false);
        }
      }
    };

    loadUnifiedSnapshot();
    const intervalId = window.setInterval(loadUnifiedSnapshot, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [enableSnapshot, monitoredKey, monitoredSymbols]);

  const loadMoreUnifiedSnapshot = async () => {
    if (!backendUnifiedHasMore || !backendUnifiedNextCursor || loadingMoreUnified) {
      return;
    }
    setLoadingMoreUnified(true);
    try {
      const response = await getUnifiedAlerts({
        symbols: monitoredSymbols,
        window: 'session',
        limit: 20,
        severityMin: 'low',
        cursor: backendUnifiedNextCursor,
      });
      const incoming = response.data?.results || [];
      setBackendUnifiedSnapshot((prev) => {
        const seen = new Set(prev.map((item) => item.event_id || `${item.source}-${item.symbol}-${item.ts}`));
        const merged = [...prev];
        incoming.forEach((item) => {
          const key = item.event_id || `${item.source}-${item.symbol}-${item.ts}`;
          if (!seen.has(key)) {
            seen.add(key);
            merged.push(item);
          }
        });
        return merged;
      });
      setBackendUnifiedNextCursor(response.data?.next_cursor || null);
      setBackendUnifiedHasMore(Boolean(response.data?.has_more));
    } catch (_err) {
      // Keep current snapshot as-is on load more failure.
    } finally {
      setLoadingMoreUnified(false);
    }
  };

  const mergedAlerts = useMemo(() => {
    const combined = [];
    const seen = new Set();

    [...alerts, ...snapshotAlerts].forEach((item, index) => {
      const key = item.event_id || `${item.symbol || 'NA'}-${item.ts || 'NA'}-${item.side || 'NA'}-${index}`;
      if (seen.has(key)) {
        return;
      }
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
    const holdingsBySymbol = new Map(
      (holdings || []).map((item) => [
        String(item?.symbol || '').toUpperCase(),
        item,
      ]),
    );

    return monitoredSymbols.map((symbol) => {
      const rawQuote = quotesBySymbol[symbol] || { symbol };
      const holding = holdingsBySymbol.get(String(symbol || '').toUpperCase());

      const avgCostRef = toFiniteNumber(holding?.avg_cost);
      const holdingCurrentRef = toFiniteNumber(holding?.current_price);
      const factor = resolveQuoteScale(rawQuote.current_price, [avgCostRef, holdingCurrentRef]);

      const currentPrice = toFiniteNumber(rawQuote.current_price);
      const prevPriceRaw = toFiniteNumber(rawQuote.prev_price);
      const normalizedCurrent = currentPrice === null ? null : currentPrice * factor;
      const normalizedPrev = prevPriceRaw === null ? null : prevPriceRaw * factor;

      const normalizedChangeValue = (
        normalizedCurrent !== null
        && normalizedPrev !== null
        && normalizedPrev > 0
      )
        ? normalizedCurrent - normalizedPrev
        : toFiniteNumber(rawQuote.change_value);

      const normalizedChangePct = (
        normalizedCurrent !== null
        && normalizedPrev !== null
        && normalizedPrev > 0
      )
        ? ((normalizedCurrent - normalizedPrev) / normalizedPrev) * 100
        : toFiniteNumber(rawQuote.change_pct);

      return {
        ...rawQuote,
        current_price: normalizedCurrent,
        prev_price: normalizedPrev,
        change_value: normalizedChangeValue,
        change_pct: normalizedChangePct,
      };
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
        return {
          id: `price-${item.symbol}-${item.last_date || item.freshness_seconds || 'now'}`,
          symbol: item.symbol,
          ts: item.last_date || new Date().toISOString(),
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
      .map((item) => ({
        id: `stale-${item.symbol}-${item.freshness_seconds || 'na'}`,
        symbol: item.symbol,
        ts: new Date().toISOString(),
        source: 'stale_quote',
        severity: 'low',
        headline: t('dashboardRealtime.unifiedHeadlineStaleQuote'),
        detail: t('dashboardRealtime.unifiedDetailStaleQuote', { seconds: formatNumber(item.freshness_seconds ?? 0) }),
        confidence: null,
        to: `/stocks/${item.symbol}`,
      }));

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
      const key = `${item.source}-${item.symbol}-${item.headline}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    deduped.sort((a, b) => {
      const aScore = severityWeight(a.severity);
      const bScore = severityWeight(b.severity);
      if (aScore !== bScore) return bScore - aScore;
      return new Date(b.ts || 0).getTime() - new Date(a.ts || 0).getTime();
    });

    return deduped.slice(0, 50);
  }, [backendUnifiedSnapshot, darkFlowAlerts, formatNumber, mergedAlerts, quoteList, t]);

  const alertSummary = useMemo(() => {
    return unifiedAlerts.reduce((acc, item) => {
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
  }, [unifiedAlerts]);

  const isMutedSymbol = (symbol) => {
    if (!symbol) return false;
    const mutedUntil = mutedSymbols[symbol];
    if (!mutedUntil) return false;
    return Date.now() < mutedUntil;
  };

  const filteredUnifiedAlerts = useMemo(() => {
    const severityRank = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4,
    };

    const passesSeverity = (severity) => {
      if (severityFilter === 'all') return true;
      const value = severityRank[normalizeUnifiedSeverity(severity, 'medium')];
      if (severityFilter === 'critical') return value >= 4;
      if (severityFilter === 'high_plus') return value >= 3;
      if (severityFilter === 'medium_plus') return value >= 2;
      return true;
    };

    return unifiedAlerts.filter((item) => {
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
      if (isMutedSymbol(item.symbol)) {
        return false;
      }
      return true;
    });
  }, [unifiedAlerts, sourceFilter, severityFilter, audienceFilter, mutedSymbols, holdings, trackedSymbolNames]);

  const unreadCount = useMemo(() => {
    return filteredUnifiedAlerts.filter((item) => !readAlertIds.has(item.id)).length;
  }, [filteredUnifiedAlerts, readAlertIds]);

  const markAlertAsRead = (alertId) => {
    setReadAlertIds((prev) => {
      const next = new Set(prev);
      next.add(alertId);
      return next;
    });
  };

  const muteSymbolFor30m = (symbol) => {
    if (!symbol) return;
    setMutedSymbols((prev) => ({
      ...prev,
      [symbol]: Date.now() + (30 * 60 * 1000),
    }));
  };

  const toggleCriticalSound = () => {
    setCriticalSoundEnabled((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('dashboard_critical_sound_enabled', String(next));
      }
      return next;
    });
  };

  useEffect(() => {
    const criticalAlerts = filteredUnifiedAlerts.filter((item) => normalizeUnifiedSeverity(item.severity, 'medium') === 'critical');
    if (!criticalAlerts.length) {
      return;
    }

    const prioritizedCriticalAlerts = [...criticalAlerts].sort((a, b) => {
      const aHolding = holdingSymbolSet.has(String(a.symbol || '').toUpperCase()) ? 1 : 0;
      const bHolding = holdingSymbolSet.has(String(b.symbol || '').toUpperCase()) ? 1 : 0;
      if (aHolding !== bHolding) return bHolding - aHolding;
      return new Date(b.ts || 0).getTime() - new Date(a.ts || 0).getTime();
    });

    const nowTs = Date.now();
    const toastTtlMs = 6000;
    const cooldownMs = 120000;
    const candidate = prioritizedCriticalAlerts.find((item) => {
      const cooldownUntil = criticalToastCooldownRef.current[item.id] || 0;
      return nowTs >= cooldownUntil;
    });

    if (!candidate) {
      return;
    }

    const cooldownUntil = criticalToastCooldownRef.current[candidate.id] || 0;
    if (nowTs < cooldownUntil) {
      return;
    }

    criticalToastCooldownRef.current[candidate.id] = nowTs + cooldownMs;
    const toastId = `${candidate.id}-${nowTs}`;

    setCriticalToasts((prev) => {
      const hasSameAlert = prev.some((item) => item.alert?.id === candidate.id);
      if (hasSameAlert) {
        return prev;
      }
      const next = [
        {
          id: toastId,
          alert: candidate,
        },
        ...prev,
      ];
      return next.slice(0, 2);
    });

    playCriticalTone();

    const timeoutId = window.setTimeout(() => {
      setCriticalToasts((prev) => prev.filter((item) => item.id !== toastId));
    }, toastTtlMs);

    return () => window.clearTimeout(timeoutId);
  }, [filteredUnifiedAlerts, criticalSoundEnabled, holdingSymbolSet]);

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
        return b.total - a.total;
      })
      .slice(0, 5);
  }, [unifiedAlerts]);

  const realtimePortfolioStats = useMemo(() => {
    const stats = (holdings || []).reduce((acc, holding) => {
      const quantity = toNumber(holding.quantity);
      const avgCost = toNumber(holding.avg_cost);
      const costBasis = toNumber(holding.cost_basis) || (avgCost * quantity);
      const snapshotMarketValue = toNumber(holding.market_value);
      const snapshotUnrealizedPL = toNumber(holding.unrealized_pl);
      const liveQuote = quotesBySymbol[holding.symbol] || {};
      const livePrice = liveQuote.current_price ?? holding.current_price;
      const computedLiveMarketValue = livePrice !== null && livePrice !== undefined
        ? toNumber(livePrice) * quantity
        : snapshotMarketValue;
      const liveMarketValue = toNumber(holding.live_market_value ?? computedLiveMarketValue);
      const fallbackUnrealizedPL = liveMarketValue - costBasis;
      const unrealizedPL = toNumber(
        holding.live_unrealized_pl
        ?? (holding.unrealized_pl !== null && holding.unrealized_pl !== undefined ? snapshotUnrealizedPL : fallbackUnrealizedPL)
      );

      acc.totalMarketValue += liveMarketValue;
      acc.totalUnrealizedPL += unrealizedPL;
      acc.snapshotMarketValue += snapshotMarketValue;

      if (holding.live_is_stale || liveQuote.stale) {
        acc.stalePositions += 1;
      }

      return acc;
    }, {
      totalMarketValue: 0,
      totalUnrealizedPL: 0,
      snapshotMarketValue: 0,
      stalePositions: 0,
    });

    const impliedCostBasis = stats.totalMarketValue - stats.totalUnrealizedPL;
    return {
      ...stats,
      totalUnrealizedPLPct: impliedCostBasis > 0
        ? (stats.totalUnrealizedPL / impliedCostBasis) * 100
        : 0,
    };
  }, [holdings, quotesBySymbol]);

  const liveVsSnapshotDelta = realtimePortfolioStats.totalMarketValue - realtimePortfolioStats.snapshotMarketValue;

  const marketStats = useMemo(() => {
    return quoteList.reduce((acc, item) => {
      if (item.stale) {
        acc.stale += 1;
      }
      if ((item.change_pct ?? 0) > 0) {
        acc.up += 1;
      } else if ((item.change_pct ?? 0) < 0) {
        acc.down += 1;
      } else {
        acc.flat += 1;
      }
      return acc;
    }, { up: 0, down: 0, flat: 0, stale: 0 });
  }, [quoteList]);

  const statusClasses = realtimeStatus === 'live'
    ? 'border-emerald-700 bg-emerald-950/30 text-emerald-300'
    : realtimeStatus === 'connecting'
      ? 'border-amber-700 bg-amber-950/30 text-amber-300'
      : 'border-gray-700 bg-gray-950 text-gray-400';

  const alertWorkspaceTabs = [
    {
      key: 'alerts',
      label: t('dashboardRealtime.workspaceTabAlerts'),
      description: t('dashboardRealtime.workspaceTabAlertsHint'),
    },
    {
      key: 'settings',
      label: t('dashboardRealtime.workspaceTabSettings'),
      description: t('dashboardRealtime.workspaceTabSettingsHint'),
    },
  ];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-5">
      {criticalToasts.length > 0 && (
        <div className="space-y-2">
          {criticalToasts.map((toast) => (
            <div key={toast.id} className="flex items-center justify-between gap-3 rounded-lg border border-rose-700/70 bg-rose-950/40 px-4 py-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-rose-200">{t('dashboardRealtime.criticalToastTitle')}</p>
                <p className="text-xs text-rose-100 mt-0.5">
                  {toast.alert.symbol}: {toast.alert.headline}
                </p>
              </div>
              <button
                onClick={() => setCriticalToasts((prev) => prev.filter((item) => item.id !== toast.id))}
                className="rounded border border-rose-700/70 bg-rose-900/30 px-2 py-1 text-[11px] font-semibold text-rose-200 hover:bg-rose-900/50"
              >
                {t('dashboardRealtime.dismiss')}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
            {t('dashboardRealtime.title')}
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {t('dashboardRealtime.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`px-2.5 py-1 rounded-full border ${statusClasses}`}>
            {realtimeLabels[realtimeStatus]}
          </span>
          <span className="px-2.5 py-1 rounded-full border border-gray-800 bg-gray-950 text-gray-400">
            {t('dashboardRealtime.lastEvent', { time: formatTime(lastEventAt) })}
          </span>
          {isEventStale && (
            <span className="px-2.5 py-1 rounded-full border border-amber-700 bg-amber-950/30 text-amber-300 font-semibold animate-pulse">
              ⚠ {t('dashboardRealtime.eventStaleWarning', { seconds: eventAgeSeconds })}
            </span>
          )}
          <button
            onClick={() => setCompact((v) => !v)}
            className="px-2.5 py-1 rounded-full border border-gray-700 bg-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-colors"
            title={compact ? t('dashboardRealtime.expandPanel') : t('dashboardRealtime.collapsePanel')}
          >
            {compact ? '▼ ' : '▲ '}{compact ? t('dashboardRealtime.expandPanel') : t('dashboardRealtime.collapsePanel')}
          </button>
        </div>
        <div className="flex items-center gap-1.5 text-xs mt-2 w-full overflow-x-auto whitespace-nowrap">
          <span className="text-gray-600 mr-0.5">{t('dashboardRealtime.observability')}</span>
          <span className="shrink-0 px-2 py-0.5 rounded border border-gray-800 bg-gray-950 text-gray-500">
            📈 {t('dashboardRealtime.eventTickers', { count: formatNumber(metrics?.eventCounts?.ticker_update ?? 0) })}
          </span>
          <span className="shrink-0 px-2 py-0.5 rounded border border-gray-800 bg-gray-950 text-gray-500">
            🐋 {t('dashboardRealtime.eventWhale', { count: formatNumber(metrics?.eventCounts?.whale_alert ?? 0) })}
          </span>
          {(metrics?.eventCounts?.dark_flow_alert ?? 0) > 0 && (
            <span className="shrink-0 px-2 py-0.5 rounded border border-violet-800 bg-violet-950/20 text-violet-400">
              🌊 {t('dashboardRealtime.eventDarkFlow', { count: formatNumber(metrics.eventCounts.dark_flow_alert) })}
            </span>
          )}
          <span className="shrink-0 px-2 py-0.5 rounded border border-gray-800 bg-gray-950 text-gray-500">
            💓 {t('dashboardRealtime.eventHeartbeat', { count: formatNumber(metrics?.eventCounts?.heartbeat ?? 0) })}
          </span>
          {(metrics?.eventCounts?.reconnect_attempts ?? 0) > 0 && (
            <span className="shrink-0 px-2 py-0.5 rounded border border-amber-800 bg-amber-950/20 text-amber-400">
              ↺ {t('dashboardRealtime.eventReconnect', { count: formatNumber(metrics.eventCounts.reconnect_attempts) })}
            </span>
          )}
          {metrics?.lastLatencyMs !== null && metrics?.lastLatencyMs !== undefined && (
            <span className={`shrink-0 px-2 py-0.5 rounded border bg-gray-950 ${metrics.lastLatencyMs > 1500 ? 'border-red-800 text-red-400' : 'border-gray-800 text-gray-500'}`}>
              ⚡ {metrics.lastLatencyMs}ms
            </span>
          )}
          {metrics?.uiRefreshP95Ms !== null && metrics?.uiRefreshP95Ms !== undefined && (
            <span className={`shrink-0 px-2 py-0.5 rounded border bg-gray-950 ${metrics.uiRefreshP95Ms > 1500 ? 'border-red-800 text-red-400' : metrics.uiRefreshP95Ms > 800 ? 'border-amber-800 text-amber-400' : 'border-emerald-900 text-emerald-500'}`}>
              p95 {Number(metrics.uiRefreshP95Ms).toFixed(0)}ms
            </span>
          )}
          {metrics?.staleRatioPct !== null && metrics?.staleRatioPct !== undefined && (
            <span className={`shrink-0 px-2 py-0.5 rounded border bg-gray-950 ${metrics.staleRatioPct > 20 ? 'border-red-800 text-red-400' : metrics.staleRatioPct > 5 ? 'border-amber-800 text-amber-400' : 'border-gray-800 text-gray-500'}`}>
              stale {Number(metrics.staleRatioPct).toFixed(2)}%
            </span>
          )}
          {metrics?.fallbackRatioPct !== null && metrics?.fallbackRatioPct !== undefined && (
            <span className={`shrink-0 px-2 py-0.5 rounded border bg-gray-950 ${metrics.fallbackRatioPct > 20 ? 'border-red-800 text-red-400' : metrics.fallbackRatioPct > 5 ? 'border-amber-800 text-amber-400' : 'border-gray-800 text-gray-500'}`}>
              fallback {Number(metrics.fallbackRatioPct).toFixed(2)}%
            </span>
          )}
          {realtimeHealth && (
            <span className={`shrink-0 px-2 py-0.5 rounded border bg-gray-950 ${realtimeHealth.channel_layer_type === 'inmemory'
                ? 'border-yellow-800 text-yellow-500'
                : realtimeHealth.redis_ok === false
                  ? 'border-red-800 text-red-400'
                  : 'border-emerald-900 text-emerald-500'
              }`}>
              {realtimeHealth.channel_layer_type === 'inmemory'
                ? t('dashboardRealtime.channelInmemory')
                : realtimeHealth.redis_ok === false
                  ? t('dashboardRealtime.channelRedisDown')
                  : t('dashboardRealtime.channelRedisUp')}
            </span>
          )}
          <div className="ml-auto flex items-center gap-1.5 pl-2 shrink-0">
            {alertWorkspaceTabs.map((tab) => {
              const isActive = activeWorkspaceTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveWorkspaceTab(tab.key)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${isActive
                    ? 'border border-brand-600 bg-brand-900/30 text-brand-200'
                    : 'border border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {showSummaryMetrics && compact && (
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 py-1">
          <span>{formatNumber(monitoredSymbols.length)} {t('dashboardRealtime.monitoredSymbols')}</span>
          {realtimePortfolioStats.stalePositions > 0 && (
            <span className="text-amber-300">{formatNumber(realtimePortfolioStats.stalePositions)} stale</span>
          )}
          {mergedAlerts.length > 0 && (
            <span className="text-violet-300">⚠ {alertSummary.total} alerts</span>
          )}
        </div>
      )}

      {showSummaryMetrics && !compact && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-gray-800 bg-gray-950 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-gray-500">{t('dashboardRealtime.monitoredSymbols')}</p>
            <p className="text-2xl font-bold text-gray-100 mt-1">{formatNumber(monitoredSymbols.length)}</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-950 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-gray-500">{t('dashboardRealtime.deltaVsSnapshot')}</p>
            <p className={`text-2xl font-bold mt-1 ${liveVsSnapshotDelta > 0 ? 'text-emerald-300' : liveVsSnapshotDelta < 0 ? 'text-red-300' : 'text-gray-100'}`}>
              {formatQuoteInteger(liveVsSnapshotDelta)}
            </p>
            <p className="text-xs text-gray-500 mt-1">{t('dashboardRealtime.deltaVsSnapshotHint')}</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-950 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-gray-500">{t('dashboardRealtime.stale')}</p>
            <p className={`text-2xl font-bold mt-1 ${realtimePortfolioStats.stalePositions > 0 ? 'text-amber-300' : 'text-gray-100'}`}>
              {formatNumber(realtimePortfolioStats.stalePositions)}
            </p>
            <p className="text-xs text-gray-500 mt-1">{t('dashboardRealtime.staleHint')}</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-950 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-gray-500">{t('dashboardRealtime.upDownFlat')}</p>
            <p className="text-2xl font-bold text-gray-100 mt-1">{formatNumber(marketStats.up)} / {formatNumber(marketStats.down)} / {formatNumber(marketStats.flat)}</p>
          </div>
        </div>
      )}

      {/* Context-aware sync CTA: hiện khi có stale positions */}
      {realtimePortfolioStats.stalePositions > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-800/60 bg-amber-950/20 px-4 py-2.5">
          <p className="text-xs text-amber-300">
            ⚠ {t('dashboardRealtime.stalePositionsCTA', { count: realtimePortfolioStats.stalePositions })}
          </p>
          {onSyncRequest && (
            <button
              onClick={onSyncRequest}
              className="shrink-0 text-xs font-semibold px-3 py-1 rounded border border-amber-700 bg-amber-900/40 text-amber-200 hover:bg-amber-800/60 transition-colors"
            >
              {t('dashboardRealtime.syncNow')}
            </button>
          )}
        </div>
      )}

      {activeWorkspaceTab === 'alerts' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-stretch">
            <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4 space-y-4 h-[460px] flex flex-col overflow-hidden">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-100">{t('dashboardRealtime.unifiedAlertStripTitle')}</h3>
                  <p className="mt-1 text-xs text-gray-500">{t('dashboardRealtime.unifiedAlertStripHint')}</p>
                </div>
                <span className="rounded-full border border-gray-700 bg-gray-900 px-2.5 py-1 text-xs text-gray-300">
                  {t('dashboardRealtime.unifiedTotal', { count: filteredUnifiedAlerts.length })}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-rose-700/60 bg-rose-950/35 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wider text-rose-300">{t('dashboardRealtime.severityCritical')}</p>
                  <p className="text-lg font-bold text-rose-100 mt-1">{formatNumber(alertSummary.critical)}</p>
                </div>
                <div className="rounded-lg border border-amber-700/60 bg-amber-950/35 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wider text-amber-300">{t('dashboardRealtime.severityHigh')}</p>
                  <p className="text-lg font-bold text-amber-100 mt-1">{formatNumber(alertSummary.high)}</p>
                </div>
                <div className="rounded-lg border border-yellow-700/60 bg-yellow-950/25 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wider text-yellow-300">{t('dashboardRealtime.severityMedium')}</p>
                  <p className="text-lg font-bold text-yellow-100 mt-1">{formatNumber(alertSummary.medium)}</p>
                </div>
                <div className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wider text-slate-300">{t('dashboardRealtime.severityLow')}</p>
                  <p className="text-lg font-bold text-slate-100 mt-1">{formatNumber(alertSummary.low)}</p>
                </div>
              </div>
              <div className="rounded-xl border border-amber-700/30 bg-gradient-to-br from-amber-950/45 via-rose-950/20 to-gray-950/90 p-4 flex-1 min-h-0 overflow-y-auto">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">{t('dashboardRealtime.hotSymbols')}</span>
                    <p className="mt-1 text-[11px] text-amber-100/70">{t('dashboardRealtime.hotSymbolsHint')}</p>
                  </div>
                  <span className="text-xs text-amber-300">{t('dashboardRealtime.unreadAlerts', { count: unreadCount })}</span>
                </div>
                {hotSymbols.length > 0 ? (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {hotSymbols.map((item) => (
                      <Link
                        key={item.symbol}
                        to={`/stocks/${item.symbol}`}
                        className={`group rounded-2xl border px-4 py-3 transition-all hover:-translate-y-0.5 hover:shadow-lg ${item.critical > 0
                          ? 'border-rose-500/60 bg-gradient-to-br from-rose-950/80 to-amber-950/40 text-rose-50 shadow-rose-950/30'
                          : item.high > 0
                            ? 'border-amber-500/60 bg-gradient-to-br from-amber-950/80 to-gray-950 text-amber-50 shadow-amber-950/30'
                            : 'border-cyan-700/40 bg-gradient-to-br from-cyan-950/40 to-gray-950 text-cyan-50 shadow-cyan-950/20'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-lg font-black tracking-wide group-hover:text-white">{item.symbol}</div>
                            <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/60">
                              {t('dashboardRealtime.hotSymbolsTotalAlerts', { count: item.total })}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 text-[11px] font-bold uppercase">
                            {item.critical > 0 && (
                              <span className="rounded-full border border-rose-300/30 bg-rose-200/10 px-2 py-0.5 text-rose-100">C{item.critical}</span>
                            )}
                            {item.high > 0 && (
                              <span className="rounded-full border border-amber-300/30 bg-amber-200/10 px-2 py-0.5 text-amber-100">H{item.high}</span>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-gray-500">{t('dashboardRealtime.noHotSymbols')}</p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-gray-800 overflow-hidden h-[460px] flex flex-col">
              <div className="px-4 py-3 border-b border-gray-800 bg-gray-950/70 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-200">{t('dashboardRealtime.unifiedCenterTitle')}</h3>
                  <p className="mt-1 text-[11px] text-gray-500">{t('dashboardRealtime.unifiedCenterHint')}</p>
                </div>
                <Link
                  to="/whale-alerts"
                  className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
                >
                  {t('dashboardRealtime.viewAll')}
                </Link>
              </div>
              {filteredUnifiedAlerts.length === 0 ? (
                <div className="px-4 py-8 text-sm text-gray-500 text-center flex-1 flex items-center justify-center">
                  {t('dashboardRealtime.noUnifiedAlerts')}
                </div>
              ) : (
                <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-2">
                  {filteredUnifiedAlerts.map((alert, index) => {
                    const severity = normalizeUnifiedSeverity(alert.severity, 'medium');
                    const isUnread = !readAlertIds.has(alert.id);
                    return (
                      <Link
                        key={alert.id || `${alert.symbol}-${alert.ts}-${index}`}
                        to={alert.to || `/stocks/${alert.symbol}`}
                        className="block"
                      >
                        <div className={`relative overflow-hidden rounded-xl border px-3 py-2.5 text-[12px] transition-colors hover:brightness-110 ${unifiedSeverityTone(severity)} ${index === 0 ? 'animate-pulse-once' : ''}`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-white text-[13px]">{alert.symbol || 'N/A'}</span>
                            <div className="flex items-center gap-2">
                              {isUnread && (
                                <span className="rounded-full border border-cyan-700/70 bg-cyan-950/35 px-2 py-0.5 text-[10px] font-bold uppercase text-cyan-200">
                                  {t('dashboardRealtime.badgeNew')}
                                </span>
                              )}
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${sourceTone(alert.source)}`}>
                                {sourceLabel(alert.source, t)}
                              </span>
                              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase bg-slate-900/60 text-slate-200 border border-slate-700">
                                {t(`dashboardRealtime.severity${severity.charAt(0).toUpperCase()}${severity.slice(1)}`)}
                              </span>
                            </div>
                          </div>
                          <div className="mt-1 flex items-baseline justify-between gap-2">
                            <span className="text-sm font-bold text-white">{alert.headline}</span>
                            <span className="text-[11px] text-slate-500">{formatTime(alert.ts)}</span>
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-500">
                            {alert.detail}
                          </div>
                          {alert.confidence != null && (
                            <div className="mt-0.5 text-[11px] text-slate-500">
                              {t('dashboardRealtime.confidence')}: {formatNumber(Number(alert.confidence) || 0)}
                            </div>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <button
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                markAlertAsRead(alert.id);
                              }}
                              className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-[10px] font-semibold text-gray-300 hover:border-gray-600 hover:text-gray-100"
                            >
                              {t('dashboardRealtime.markRead')}
                            </button>
                            <button
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                muteSymbolFor30m(alert.symbol);
                              }}
                              className="rounded border border-amber-700/70 bg-amber-950/25 px-2 py-1 text-[10px] font-semibold text-amber-200 hover:bg-amber-900/35"
                            >
                              {t('dashboardRealtime.mute30m')}
                            </button>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                  {backendUnifiedHasMore && (
                    <div className="pt-1">
                      <button
                        onClick={loadMoreUnifiedSnapshot}
                        disabled={loadingMoreUnified}
                        className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs font-semibold text-gray-300 hover:border-gray-600 hover:text-gray-100 disabled:opacity-60"
                      >
                        {loadingMoreUnified ? t('dashboardRealtime.loadingMore') : t('dashboardRealtime.loadMore')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
            <div className="rounded-xl border border-gray-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 bg-gray-950/70">
                <h3 className="text-sm font-semibold text-gray-200">{t('dashboardRealtime.marketStatusBySymbol')}</h3>
                <p className="mt-1 text-[11px] text-gray-500">{t('dashboardRealtime.priceUnitHint')}</p>
              </div>
              {quoteList.length === 0 ? (
                <div className="px-4 py-8 text-sm text-gray-500 text-center">
                  {t('dashboardRealtime.noSymbols')}
                </div>
              ) : (
                <div className="max-h-[308px] overflow-y-auto overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium">{t('dashboardRealtime.tableSymbol')}</th>
                        <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium">{t('dashboardRealtime.tablePrice')}</th>
                        <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium">{t('dashboardRealtime.tablePctChange')}</th>
                        <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium">{t('dashboardRealtime.tableFreshness')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60">
                      {quoteList.map((item) => {
                        const isUp = (item.change_pct ?? 0) > 0;
                        const isDown = (item.change_pct ?? 0) < 0;
                        return (
                          <tr key={item.symbol} className="hover:bg-gray-800/30 transition-colors">
                            <td className="px-4 py-3 font-bold text-brand-300">
                              <Link
                                to={`/stocks/${item.symbol}`}
                                className="inline-flex items-center hover:text-cyan-300 transition-colors"
                              >
                                {item.symbol}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-gray-200 tabular-nums">{formatQuotePrice(item.current_price)}</td>
                            <td className={`px-4 py-3 font-semibold ${isUp ? 'text-emerald-300' : isDown ? 'text-red-300' : 'text-gray-400'}`}>
                              {item.change_pct === null || item.change_pct === undefined
                                ? '—'
                                : `${isUp ? '+' : ''}${Number(item.change_pct).toFixed(2)}%`}
                            </td>
                            <td className="px-4 py-3 text-xs">
                              {item.stale ? (
                                <span className="text-amber-300">{t('dashboardRealtime.stale')}</span>
                              ) : (
                                <span className="text-gray-500">{t('dashboardRealtime.secondsShort', { value: formatNumber(item.freshness_seconds ?? 0) })}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <AllocationPieChart portfolioId={portfolioId} />
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-100">{t('dashboardRealtime.settingsPanelTitle')}</h3>
              <p className="mt-1 text-xs text-gray-500">{t('dashboardRealtime.settingsPanelHint')}</p>
            </div>
            <span className="text-xs text-amber-300">{t('dashboardRealtime.unreadAlerts', { count: unreadCount })}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">{t('dashboardRealtime.filterBySource')}</span>
            {['all', 'whale', 'dark_flow', 'price_shock', 'stale_quote'].map((source) => (
              <button
                key={source}
                onClick={() => setSourceFilter(source)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${sourceFilter === source
                  ? 'border-brand-600 bg-brand-900/30 text-brand-300'
                  : 'border-gray-700 bg-gray-900 text-gray-400 hover:text-gray-200 hover:border-gray-600'
                }`}
              >
                {source === 'all' ? t('dashboardRealtime.filterAll') : sourceLabel(source, t)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">{t('dashboardRealtime.filterByAudience')}</span>
            {[
              { value: 'all', label: t('dashboardRealtime.filterAll') },
              { value: 'holdings', label: t('dashboardRealtime.filterHoldingsOnly') },
              { value: 'watchlist', label: t('dashboardRealtime.filterWatchlistOnly') },
            ].map((item) => (
              <button
                key={item.value}
                onClick={() => setAudienceFilter(item.value)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${audienceFilter === item.value
                  ? 'border-brand-600 bg-brand-900/30 text-brand-300'
                  : 'border-gray-700 bg-gray-900 text-gray-400 hover:text-gray-200 hover:border-gray-600'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">{t('dashboardRealtime.filterBySeverity')}</span>
            {[
              { value: 'all', label: t('dashboardRealtime.filterAll') },
              { value: 'critical', label: t('dashboardRealtime.filterCriticalOnly') },
              { value: 'high_plus', label: t('dashboardRealtime.filterHighPlus') },
              { value: 'medium_plus', label: t('dashboardRealtime.filterMediumPlus') },
            ].map((item) => (
              <button
                key={item.value}
                onClick={() => setSeverityFilter(item.value)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${severityFilter === item.value
                  ? 'border-brand-600 bg-brand-900/30 text-brand-300'
                  : 'border-gray-700 bg-gray-900 text-gray-400 hover:text-gray-200 hover:border-gray-600'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">{t('dashboardRealtime.criticalToastPolicy')}</span>
            <span className="text-xs rounded-full border border-gray-700 bg-gray-900 px-2 py-1 text-gray-300">
              {t('dashboardRealtime.toastQueuePolicy')}
            </span>
            <button
              onClick={toggleCriticalSound}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${criticalSoundEnabled
                ? 'border-emerald-700 bg-emerald-950/30 text-emerald-300'
                : 'border-gray-700 bg-gray-900 text-gray-400 hover:text-gray-200 hover:border-gray-600'
              }`}
            >
              {criticalSoundEnabled ? t('dashboardRealtime.soundOn') : t('dashboardRealtime.soundOff')}
            </button>
          </div>
        </div>
      )}

      <div className="hidden">
        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 bg-gray-950/70">
            <h3 className="text-sm font-semibold text-gray-200">{t('dashboardRealtime.marketStatusBySymbol')}</h3>
            <p className="mt-1 text-[11px] text-gray-500">{t('dashboardRealtime.priceUnitHint')}</p>
          </div>
          {quoteList.length === 0 ? (
            <div className="px-4 py-8 text-sm text-gray-500 text-center">
              {t('dashboardRealtime.noSymbols')}
            </div>
          ) : (
            <div className="max-h-[420px] overflow-y-auto overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium">{t('dashboardRealtime.tableSymbol')}</th>
                    <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium">{t('dashboardRealtime.tablePrice')}</th>
                    <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium">{t('dashboardRealtime.tablePctChange')}</th>
                    <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium">{t('dashboardRealtime.tableFreshness')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {quoteList.map((item) => {
                    const isUp = (item.change_pct ?? 0) > 0;
                    const isDown = (item.change_pct ?? 0) < 0;
                    return (
                      <tr key={item.symbol} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 font-bold text-brand-300">
                          <Link
                            to={`/stocks/${item.symbol}`}
                            className="inline-flex items-center hover:text-cyan-300 transition-colors"
                          >
                            {item.symbol}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-gray-200 tabular-nums">{formatQuotePrice(item.current_price)}</td>
                        <td className={`px-4 py-3 font-semibold ${isUp ? 'text-emerald-300' : isDown ? 'text-red-300' : 'text-gray-400'}`}>
                          {item.change_pct === null || item.change_pct === undefined
                            ? '—'
                            : `${isUp ? '+' : ''}${Number(item.change_pct).toFixed(2)}%`}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {item.stale ? (
                            <span className="text-amber-300">{t('dashboardRealtime.stale')}</span>
                          ) : (
                            <span className="text-gray-500">{t('dashboardRealtime.secondsShort', { value: formatNumber(item.freshness_seconds ?? 0) })}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <RealtimeDebugPanel />
      </div>
    </div>
  );
}
