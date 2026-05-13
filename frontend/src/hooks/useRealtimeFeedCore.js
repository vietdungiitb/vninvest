import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getRealtimeTicker, getRealtimeTickers, getRealtimeWebSocketUrl, refreshAccessToken } from '../api/client';
import { isRequestCanceled } from '../utils/requestCancellation';

function nowIso() {
  return new Date().toISOString();
}

function readEventField(payload, key) {
  return payload?.[key] ?? payload?.data?.[key];
}

function normalizeSymbol(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeEventTimestamp(value) {
  if (!value) return new Date().toISOString();
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts) || ts <= 0) {
    return new Date().toISOString();
  }
  return new Date(ts).toISOString();
}

function getQuoteBySymbol(quotesBySymbol, symbol) {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) return {};
  return (
    quotesBySymbol?.[normalized]
    || quotesBySymbol?.[symbol]
    || quotesBySymbol?.[String(symbol || '').trim().toLowerCase()]
    || {}
  );
}

function isValidQuotePrice(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0;
}

function toFiniteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function resolveImpliedChangePct({ currentPrice, prevPrice, changeValue }) {
  const normalizedCurrent = toFiniteNumber(currentPrice);
  const normalizedPrev = toFiniteNumber(prevPrice);
  const normalizedChange = toFiniteNumber(changeValue);

  if (Number.isFinite(normalizedCurrent) && Number.isFinite(normalizedPrev) && normalizedPrev > 0) {
    return ((normalizedCurrent - normalizedPrev) / normalizedPrev) * 100;
  }

  if (Number.isFinite(normalizedCurrent) && normalizedCurrent > 0 && Number.isFinite(normalizedChange)) {
    return (normalizedChange / normalizedCurrent) * 100;
  }

  return null;
}

function normalizeChangePct(rawChangePct, { currentPrice, prevPrice, changeValue }) {
  const normalizedRaw = toFiniteNumber(rawChangePct);
  if (!Number.isFinite(normalizedRaw)) {
    return null;
  }

  const impliedPct = resolveImpliedChangePct({
    currentPrice,
    prevPrice,
    changeValue,
  });

  if (!Number.isFinite(impliedPct)) {
    return normalizedRaw;
  }

  // Some feeds publish fraction units (0.01 => 1.00%) while others publish percent directly.
  // For small-magnitude values, choose the unit that best matches the implied pct from prices.
  if (Math.abs(normalizedRaw) <= 1) {
    const asPercent = normalizedRaw;
    const asFraction = normalizedRaw * 100;
    const distancePercent = Math.abs(asPercent - impliedPct);
    const distanceFraction = Math.abs(asFraction - impliedPct);

    if (distanceFraction + 0.05 < distancePercent) {
      return asFraction;
    }
  }

  return normalizedRaw;
}

function mergeQuote(prev, update) {
  const eventTimestamp = update.last_date ?? update.ts;
  const eventAgeSeconds = eventTimestamp
    ? Math.max(0, Math.floor((Date.now() - new Date(eventTimestamp).getTime()) / 1000))
    : null;
  const inferredFreshness = Number.isFinite(eventAgeSeconds) ? eventAgeSeconds : null;
  const nextAgeSeconds = Number.isFinite(Number(update.age_seconds))
    ? Number(update.age_seconds)
    : inferredFreshness;

  const nextCurrentPrice = isValidQuotePrice(update.current_price)
    ? Number(update.current_price)
    : (isValidQuotePrice(update.price) ? Number(update.price) : prev.current_price);

  const nextPrevPrice = update.prev_price ?? prev.prev_price;
  const nextChangeValue = update.change_value ?? prev.change_value;
  const nextChangePct = normalizeChangePct(update.change_pct ?? prev.change_pct, {
    currentPrice: nextCurrentPrice,
    prevPrice: nextPrevPrice,
    changeValue: nextChangeValue,
  });

  return {
    ...prev,
    symbol: normalizeSymbol(update.symbol ?? prev.symbol),
    current_price: nextCurrentPrice,
    prev_price: nextPrevPrice,
    change_value: nextChangeValue,
    change_pct: nextChangePct,
    open_price: update.open_price ?? prev.open_price,
    high_price: update.high_price ?? prev.high_price,
    low_price: update.low_price ?? prev.low_price,
    volume: update.volume ?? prev.volume,
    freshness_seconds: update.freshness_seconds ?? nextAgeSeconds ?? prev.freshness_seconds,
    age_seconds: update.age_seconds ?? nextAgeSeconds ?? prev.age_seconds,
    stale: update.stale ?? (nextAgeSeconds !== null ? nextAgeSeconds > 30 : prev.stale),
    stale_over_threshold: update.stale_over_threshold ?? prev.stale_over_threshold ?? false,
    stale_threshold_seconds: update.stale_threshold_seconds ?? prev.stale_threshold_seconds ?? null,
    last_date: eventTimestamp ?? prev.last_date,
    source_event_at: update.source_event_at ?? prev.source_event_at,
    served_at: update.served_at ?? prev.served_at,
    market_phase: update.market_phase ?? prev.market_phase,
    market_code: update.market_code ?? prev.market_code,
    data_semantic: update.data_semantic ?? prev.data_semantic,
    source: update.source ?? prev.source,
    // market_cap_bn là dữ liệu tĩnh từ StockProfile, không có trong WS tick → giữ nguyên từ initial load
    market_cap_bn: prev.market_cap_bn ?? null,
  };
}

function normalizeAlert(payload) {
  const normalizedTs = normalizeEventTimestamp(readEventField(payload, 'ts') || payload.ts || payload.created_at);
  return {
    event_id: readEventField(payload, 'event_id'),
    contract_version: readEventField(payload, 'contract_version') ?? payload.contract_version,
    config_version: readEventField(payload, 'config_version'),
    source: readEventField(payload, 'source') ?? payload.source,
    symbol: readEventField(payload, 'symbol') ?? payload.symbol,
    side: readEventField(payload, 'side'),
    matched_value: readEventField(payload, 'matched_value'),
    threshold: readEventField(payload, 'threshold'),
    size_class: readEventField(payload, 'size_class'),
    severity: readEventField(payload, 'severity'),
    event_score: readEventField(payload, 'event_score'),
    display_score: readEventField(payload, 'display_score'),
    weights_version: readEventField(payload, 'weights_version'),
    ts: normalizedTs,
  };
}

function normalizeDarkFlowAlert(payload) {
  const normalizedTs = normalizeEventTimestamp(readEventField(payload, 'ts') || payload.ts || payload.created_at);
  return {
    event_id: readEventField(payload, 'event_id'),
    contract_version: readEventField(payload, 'contract_version') ?? payload.contract_version,
    symbol: readEventField(payload, 'symbol') ?? payload.symbol,
    signal_type: readEventField(payload, 'signal_type'),
    strength: readEventField(payload, 'strength'),
    confidence: readEventField(payload, 'confidence'),
    tick_rate: readEventField(payload, 'tick_rate'),
    small_order_ratio: readEventField(payload, 'small_order_ratio'),
    cvd_at_signal: readEventField(payload, 'cvd_at_signal'),
    description: readEventField(payload, 'description'),
    ts: normalizedTs,
  };
}

function computeReconnectDelayMs(attempt) {
  const normalizedAttempt = Math.max(1, Number(attempt) || 1);
  const base = Math.min(1000 * (2 ** (normalizedAttempt - 1)), 30000);
  const jitter = Math.floor(base * Math.random() * 0.4);
  return base + jitter;
}

function getHttpStatus(errorLike) {
  return errorLike?.response?.status ?? errorLike?.status ?? null;
}

function shouldSuppressPollingError(errorLike) {
  const status = getHttpStatus(errorLike);
  if ([404, 408, 429, 500, 502, 503, 504].includes(status)) {
    return true;
  }

  const message = String(errorLike?.message || '').toLowerCase();
  return message.includes('network error')
    || message.includes('err_empty_response')
    || message.includes('err_connection_reset')
    || message.includes('timeout');
}

function computeNextBackoffMs(currentBackoffMs) {
  if (!currentBackoffMs || currentBackoffMs <= 0) {
    return 5000;
  }
  return Math.min(currentBackoffMs * 2, 120000);
}

function decodeJwtPayload(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = `${base64}${'='.repeat((4 - (base64.length % 4)) % 4)}`;
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function isTokenExpiringSoon(token, skewMs = 60000) {
  if (!token) return true;
  const payload = decodeJwtPayload(token);
  const expSeconds = Number(payload?.exp);
  if (!Number.isFinite(expSeconds)) return false;
  return (Date.now() + Math.max(0, Number(skewMs) || 0)) >= (expSeconds * 1000);
}

export function normalizePollSymbolCandidates(symbols, quotesBySymbol, wsHealthy) {
  const normalizedQuotes = quotesBySymbol || {};
  const staleOrMissing = [];
  const fresh = [];
  let hasOverThreshold = false;

  (symbols || []).forEach((symbol) => {
    const normalizedSymbol = normalizeSymbol(symbol);
    const quote = getQuoteBySymbol(normalizedQuotes, normalizedSymbol);
    const isMissing = !isValidQuotePrice(quote.current_price);
    const isOffhoursSessionClose = quote.data_semantic === 'last_session_close'
      || ['offhours', 'post_close', 'pre_open'].includes(String(quote.market_phase || '').toLowerCase());
    const freshnessSeconds = Number(quote.freshness_seconds);
    const ageSeconds = Number(quote.age_seconds);
    const staleOverThreshold = Boolean(quote.stale_over_threshold);
    const isStale = isOffhoursSessionClose
      ? false
      : (staleOverThreshold || quote.stale || (Number.isFinite(freshnessSeconds) && freshnessSeconds > 20));

    if (staleOverThreshold || (Number.isFinite(ageSeconds) && Number.isFinite(quote.stale_threshold_seconds) && ageSeconds > Number(quote.stale_threshold_seconds))) {
      hasOverThreshold = true;
    }

    if (isMissing || isStale) {
      staleOrMissing.push(normalizedSymbol);
    } else {
      fresh.push(normalizedSymbol);
    }
  });

  if (!wsHealthy) {
    return {
      symbols: [...staleOrMissing, ...fresh],
      hasOverThreshold,
    };
  }

  return {
    symbols: staleOrMissing,
    hasOverThreshold,
  };
}

export function resolveRealtimePollIntervalMs({
  wsHealthy,
  hasRecoveryCandidates,
  pollInterval,
  hasOverThresholdCandidates,
  staleResyncRetryMs,
  wsHealthyRecoveryPollIntervalMs,
  wsHealthyMinPollIntervalMs,
}) {
  const effectiveIntervalMs = hasRecoveryCandidates
    ? wsHealthyRecoveryPollIntervalMs
    : (wsHealthy
      ? Math.max(pollInterval, wsHealthyMinPollIntervalMs)
      : Math.max(pollInterval, 5000));

  return hasOverThresholdCandidates
    ? Math.min(effectiveIntervalMs, staleResyncRetryMs)
    : effectiveIntervalMs;
}

function pickPollBatch(symbols, cursor, batchSize) {
  if (!symbols?.length) {
    return { batch: [], nextCursor: 0 };
  }

  const size = Math.max(1, Math.min(batchSize, symbols.length));
  const start = Math.max(0, Math.min(cursor, symbols.length - 1));
  const batch = [];

  for (let i = 0; i < size; i += 1) {
    batch.push(symbols[(start + i) % symbols.length]);
  }

  return {
    batch,
    nextCursor: (start + size) % symbols.length,
  };
}

export default function useRealtimeFeedCore({
  symbols,
  pollInterval = 15000,
  maxAlerts = 5,
  enabled = true,
}) {
  const STALE_RESYNC_RETRY_MS = 3000;
  const POLL_BATCH_SIZE = 16;
  const WS_HEALTHY_POLL_BATCH_SIZE = 8;
  const WS_HEALTHY_RECOVERY_BATCH_SIZE = 16; // Increased from 8 for faster recovery
  const WS_HEALTHY_MIN_POLL_INTERVAL_MS = 30000;
  const WS_HEALTHY_RECOVERY_POLL_INTERVAL_MS = 8000; // Increased from 5000 to reduce re-render frequency
  const WS_HEALTHY_RECOVERY_MIN_CANDIDATES = 3; // Only enter recovery if >= 3 missing symbols
  const MAX_WS_SUB_SYMBOLS = 50;
  const [quotesBySymbol, setQuotesBySymbol] = useState({});
  const [realtimeStatus, setRealtimeStatus] = useState('idle');
  const [lastEventAt, setLastEventAt] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [darkFlowAlerts, setDarkFlowAlerts] = useState([]);
  const [marketDiscoveryEvents, setMarketDiscoveryEvents] = useState([]);
  const [eventCounts, setEventCounts] = useState({
    ticker_update: 0,
    whale_alert: 0,
    dark_flow_alert: 0,
    market_discovery_event: 0,
    heartbeat: 0,
    reconnect_attempts: 0,
    subscribed: 0,
    unsubscribed: 0,
    polling_successes: 0,
    polling_failures: 0,
    intraday_retry_3s_total: 0,
    circuit_breaker_trips: 0,
  });
  const [lastLatencyMs, setLastLatencyMs] = useState(null);
  const [latencySamplesMs, setLatencySamplesMs] = useState([]);
  const [connectionState, setConnectionState] = useState({
    transport: 'idle',
    subscribedSymbols: [],
    lastSubscribedAt: null,
    lastUnsubscribedAt: null,
    lastReconnectAt: null,
    lastReconnectDelayMs: null,
    lastErrorAt: null,
    lastCloseCode: null,
    lastCloseReason: null,
    circuitOpenUntil: null,
    circuitOpen: false,
  });

  const symbolsKey = (symbols || []).filter(Boolean).join(',');
  const normalizedSymbols = useMemo(
    () => [...new Set(symbolsKey.split(',').filter(Boolean))],
    [symbolsKey], // eslint-disable-line
  );

  const symbolsRef = useRef(normalizedSymbols);
  const quotesBySymbolRef = useRef(quotesBySymbol);
  const realtimeStatusRef = useRef(realtimeStatus);
  const pollIntervalRef = useRef(pollInterval);
  const reconnectAttemptRef = useRef(0);
  const consecutiveFailuresRef = useRef(0);
  const circuitOpenUntilRef = useRef(null);
  const pollCursorRef = useRef(0);
  const pollBackoffMsRef = useRef(0);
  const pollBackoffUntilRef = useRef(null);
  const lastPollAtRef = useRef(0);
  const wsHealthyRef = useRef(false);
  const lastProcessedEventIdsRef = useRef(new Map());
  const pendingTickerUpdatesRef = useRef({});
  const tickerRafIdRef = useRef(null);

  useEffect(() => { symbolsRef.current = normalizedSymbols; }, [normalizedSymbols]);
  useEffect(() => { quotesBySymbolRef.current = quotesBySymbol; }, [quotesBySymbol]);
  useEffect(() => {
    pollCursorRef.current = 0;
    pollBackoffMsRef.current = 0;
    pollBackoffUntilRef.current = null;
    lastPollAtRef.current = 0;
  }, [normalizedSymbols]);
  useEffect(() => { realtimeStatusRef.current = realtimeStatus; }, [realtimeStatus]);
  useEffect(() => { pollIntervalRef.current = pollInterval; }, [pollInterval]);

  const staleRatioPct = useMemo(() => {
    const quotes = Object.values(quotesBySymbol || {});
    if (!quotes.length) return null;
    const staleCount = quotes.filter((item) => item?.stale).length;
    return Number(((staleCount / quotes.length) * 100).toFixed(2));
  }, [quotesBySymbol]);

  const pollingTotal = eventCounts.polling_successes + eventCounts.polling_failures;
  const fallbackRatioPct = pollingTotal > 0
    ? Number(((eventCounts.polling_failures / pollingTotal) * 100).toFixed(2))
    : null;

  const uiRefreshP95Ms = useMemo(() => {
    if (!latencySamplesMs.length) return null;
    const sorted = [...latencySamplesMs].sort((a, b) => a - b);
    const idx = Math.max(0, Math.floor((sorted.length - 1) * 0.95));
    return Number(sorted[idx].toFixed(2));
  }, [latencySamplesMs]);

  useEffect(() => {
    if (!enabled) {
      setRealtimeStatus('idle');
      setConnectionState((prev) => ({
        ...prev,
        transport: 'idle',
        subscribedSymbols: [],
      }));
      return;
    }

    setQuotesBySymbol((prev) => {
      const next = {};
      normalizedSymbols.forEach((symbol) => {
        const normalizedSymbol = normalizeSymbol(symbol);
        const existing = getQuoteBySymbol(prev, normalizedSymbol);
        next[normalizedSymbol] = existing?.symbol ? existing : { symbol: normalizedSymbol };
      });
      return next;
    });
  }, [normalizedSymbols, enabled]);

  const applyTickerUpdate = useCallback((update) => {
    const normalizedSymbol = normalizeSymbol(update?.symbol);
    if (!normalizedSymbol) return;

    setQuotesBySymbol((prev) => ({
      ...prev,
      [normalizedSymbol]: mergeQuote(
        getQuoteBySymbol(prev, normalizedSymbol) || { symbol: normalizedSymbol },
        { ...update, symbol: normalizedSymbol },
      ),
    }));
  }, []);

  const flushTickerUpdates = useCallback(() => {
    const updates = pendingTickerUpdatesRef.current;
    const symbols = Object.keys(updates);

    if (!symbols.length) {
      tickerRafIdRef.current = null;
      return;
    }

    pendingTickerUpdatesRef.current = {};

    setQuotesBySymbol((prev) => {
      const next = { ...prev };
      symbols.forEach((symbol) => {
        const update = updates[symbol];
        next[symbol] = mergeQuote(
          getQuoteBySymbol(prev, symbol) || { symbol },
          { ...update, symbol },
        );
      });
      return next;
    });

    tickerRafIdRef.current = null;
  }, []);

  const applyTickerUpdateThrottled = useCallback((update) => {
    const normalizedSymbol = normalizeSymbol(update?.symbol);
    if (!normalizedSymbol) return;

    pendingTickerUpdatesRef.current[normalizedSymbol] = {
      ...update,
      symbol: normalizedSymbol,
    };

    if (tickerRafIdRef.current === null) {
      tickerRafIdRef.current = requestAnimationFrame(flushTickerUpdates);
    }
  }, [flushTickerUpdates]);

  useEffect(() => {
    if (!enabled) return undefined;

    const token = localStorage.getItem('access_token');
    if (!token || !normalizedSymbols.length) {
      return undefined;
    }

    let cancelled = false;

    const hydrateQuotes = async () => {
      const bootstrapBatchSize = 25; // Slightly increased for batching

      for (let i = 0; i < normalizedSymbols.length; i += bootstrapBatchSize) {
        const batch = normalizedSymbols.slice(i, i + bootstrapBatchSize);
        try {
          const res = await getRealtimeTickers(batch);
          if (cancelled) return;

          const tickersMap = res.data || {};
          let ok = 0;

          Object.values(tickersMap).forEach((data) => {
            if (data && data.symbol) {
              ok += 1;
              applyTickerUpdate({
                symbol: data.symbol,
                current_price: data.current_price,
                prev_price: data.prev_price,
                change_value: data.change_value,
                change_pct: data.change_pct,
                open_price: data.open_price,
                high_price: data.high_price,
                low_price: data.low_price,
                volume: data.volume,
                freshness_seconds: data.freshness_seconds,
                age_seconds: data.age_seconds,
                stale: data.stale,
                stale_over_threshold: data.stale_over_threshold,
                stale_threshold_seconds: data.stale_threshold_seconds,
                last_date: data.last_date,
                source_event_at: data.source_event_at,
                served_at: data.served_at,
                market_phase: data.market_phase,
                market_code: data.market_code,
                data_semantic: data.data_semantic,
                source: data.source,
              });
            }
          });

          if (ok > 0) {
            setLastEventAt(nowIso());
            setEventCounts((prev) => ({ 
              ...prev, 
              polling_successes: prev.polling_successes + 1, // Count as 1 batch success
            }));
          }
        } catch (error) {
          if (cancelled) return;
            if (isRequestCanceled(error)) {
              return;
            }
          const status = getHttpStatus(error);
          setEventCounts((prev) => ({ ...prev, polling_failures: prev.polling_failures + 1 }));
          if (status !== 429) {
            console.warn('Bootstrap batch quote fetch failed:', error.message);
          }
        }
      }
    };

    hydrateQuotes();

    return () => {
      cancelled = true;
    };
  }, [enabled, normalizedSymbols, applyTickerUpdate]);

  const applyAlert = useCallback((payload) => {
    const nextAlert = normalizeAlert(payload);
    const nextKey = nextAlert.event_id || `${nextAlert.symbol || 'NA'}-${nextAlert.ts || 'NA'}-${nextAlert.side || 'NA'}`;
    setAlerts((prev) => {
      const filtered = prev.filter(
        (item) => (item.event_id || `${item.symbol || 'NA'}-${item.ts || 'NA'}-${item.side || 'NA'}`) !== nextKey
      );
      return [nextAlert, ...filtered].slice(0, maxAlerts);
    });
  }, [maxAlerts]);

  const applyDarkFlowAlert = useCallback((payload) => {
    const nextAlert = normalizeDarkFlowAlert(payload);
    const nextKey = nextAlert.event_id || `${nextAlert.symbol || 'NA'}-${nextAlert.ts || 'NA'}-${nextAlert.signal_type || 'NA'}`;
    setDarkFlowAlerts((prev) => {
      const filtered = prev.filter(
        (item) => (item.event_id || `${item.symbol || 'NA'}-${item.ts || 'NA'}-${item.signal_type || 'NA'}`) !== nextKey
      );
      return [nextAlert, ...filtered].slice(0, maxAlerts);
    });
  }, [maxAlerts]);

  const applyMarketDiscoveryEvent = useCallback((payload) => {
    const nextEvent = {
      ...payload,
      ts: normalizeEventTimestamp(payload.ts || payload.created_at)
    };
    setMarketDiscoveryEvents((prev) => {
      const filtered = prev.filter(item => item.id !== nextEvent.id);
      return [nextEvent, ...filtered].slice(0, maxAlerts);
    });
    // Global notification for page level listeners
    window.dispatchEvent(new CustomEvent('market_discovery_update', { detail: nextEvent }));
  }, [maxAlerts]);

  const shouldSkipDuplicateEvent = useCallback((payload, eventType) => {
    const now = Date.now();
    const dedupWindowMs = 1000;

    const cache = lastProcessedEventIdsRef.current;
    cache.forEach((expiresAt, key) => {
      if (expiresAt <= now) {
        cache.delete(key);
      }
    });

    const normalizedTs = normalizeEventTimestamp(readEventField(payload, 'ts') || payload.ts || payload.created_at);
    const symbol = normalizeSymbol(readEventField(payload, 'symbol') || payload.symbol);
    const side = String(readEventField(payload, 'side') || payload.side || readEventField(payload, 'signal_type') || payload.signal_type || '').toLowerCase();
    const eventId = String(readEventField(payload, 'event_id') || payload.event_id || '').trim();
    const dedupKey = eventId || `${eventType}:${symbol}:${normalizedTs}:${side}`;

    if (cache.has(dedupKey)) {
      return true;
    }

    cache.set(dedupKey, now + dedupWindowMs);
    return false;
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;

    let intervalId = null;
    let destroyed = false;

    const poll = async () => {
      const token = localStorage.getItem('access_token');
      const syms = symbolsRef.current;
      if (!token || !syms.length) return;

      const wsHealthy = wsHealthyRef.current;
      const candidateResult = normalizePollSymbolCandidates(
        syms,
        quotesBySymbolRef.current,
        wsHealthy,
      );
      const pollCandidates = candidateResult.symbols;
      const hasOverThresholdCandidates = candidateResult.hasOverThreshold;

      if (!pollCandidates.length) {
        return;
      }

      // Only enter recovery mode if WS healthy AND >= 3 missing symbols (reduces unnecessary recovery polling)
      const hasRecoveryCandidates = wsHealthy && pollCandidates.length >= WS_HEALTHY_RECOVERY_MIN_CANDIDATES;
      const targetIntervalMs = resolveRealtimePollIntervalMs({
        wsHealthy,
        hasRecoveryCandidates,
        pollInterval: pollIntervalRef.current,
        hasOverThresholdCandidates,
        staleResyncRetryMs: STALE_RESYNC_RETRY_MS,
        wsHealthyRecoveryPollIntervalMs: WS_HEALTHY_RECOVERY_POLL_INTERVAL_MS,
        wsHealthyMinPollIntervalMs: WS_HEALTHY_MIN_POLL_INTERVAL_MS,
      });

      if (lastPollAtRef.current && (Date.now() - lastPollAtRef.current) < targetIntervalMs) {
        return;
      }

      if (pollBackoffUntilRef.current && Date.now() < pollBackoffUntilRef.current) {
        return;
      }

      lastPollAtRef.current = Date.now();
      if (hasOverThresholdCandidates) {
        setEventCounts((prev) => ({
          ...prev,
          intraday_retry_3s_total: prev.intraday_retry_3s_total + 1,
        }));
      }

      const { batch: pollBatch, nextCursor } = pickPollBatch(
        pollCandidates,
        pollCursorRef.current,
        hasRecoveryCandidates
          ? WS_HEALTHY_RECOVERY_BATCH_SIZE
          : (wsHealthy ? WS_HEALTHY_POLL_BATCH_SIZE : POLL_BATCH_SIZE),
      );

      if (!pollBatch.length) {
        return;
      }

      try {
        const res = await getRealtimeTickers(pollBatch);
        if (destroyed) return;
        
        const tickersMap = res.data || {};
        let ok = 0;
        
        Object.values(tickersMap).forEach((data) => {
          if (data && data.symbol) {
            ok += 1;
            applyTickerUpdate({
              symbol: data.symbol,
              current_price: data.current_price,
              prev_price: data.prev_price,
              change_value: data.change_value,
              change_pct: data.change_pct,
              open_price: data.open_price,
              high_price: data.high_price,
              low_price: data.low_price,
              volume: data.volume,
              freshness_seconds: data.freshness_seconds,
              age_seconds: data.age_seconds,
              stale: data.stale,
              stale_over_threshold: data.stale_over_threshold,
              stale_threshold_seconds: data.stale_threshold_seconds,
              last_date: data.last_date,
              source_event_at: data.source_event_at,
              served_at: data.served_at,
              market_phase: data.market_phase,
              market_code: data.market_code,
              data_semantic: data.data_semantic,
              source: data.source,
            });
          }
        });

        if (ok > 0) {
          setLastEventAt(nowIso());
          setEventCounts((prev) => ({ ...prev, polling_successes: prev.polling_successes + 1 }));
          consecutiveFailuresRef.current = 0;
        }
        pollBackoffMsRef.current = 0;
        pollBackoffUntilRef.current = null;
        pollCursorRef.current = nextCursor;
      } catch (err) {
        if (!destroyed) {
          const status = getHttpStatus(err);
          if (status === 429) {
            const nextBackoffMs = computeNextBackoffMs(pollBackoffMsRef.current);
            pollBackoffMsRef.current = nextBackoffMs;
            pollBackoffUntilRef.current = Date.now() + nextBackoffMs;
            console.warn(`Polling rate limited (429). Backing off for ${nextBackoffMs}ms.`);
            return;
          }
          setEventCounts((prev) => ({ ...prev, polling_failures: prev.polling_failures + 1 }));
          if (!shouldSuppressPollingError(err)) {
            console.error('Polling error:', err);
          }
        }
      }
    };

    const start = () => {
      poll();
      intervalId = window.setInterval(poll, pollIntervalRef.current);
    };

    const startTimer = window.setTimeout(start, 100);

    return () => {
      destroyed = true;
      window.clearTimeout(startTimer);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [normalizedSymbols.join(','), applyTickerUpdate, enabled]); // eslint-disable-line

  useEffect(() => {
    if (!enabled) return undefined;

    const token = localStorage.getItem('access_token');
    if (!token || !normalizedSymbols.length) {
      setRealtimeStatus('idle');
      return undefined;
    }

    let ws = null;
    let reconnectTimer = null;
    let destroyed = false;

    const sendAction = (socket, action, nextSymbols) => {
      if (!socket || socket.readyState !== WebSocket.OPEN || !nextSymbols.length) return;
      socket.send(JSON.stringify({ action, symbols: nextSymbols }));
    };

    const cleanup = () => {
      destroyed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (ws) {
        if (ws.readyState === WebSocket.OPEN && symbolsRef.current.length) {
          sendAction(ws, 'unsubscribe', symbolsRef.current);
        }
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        if (ws.readyState === WebSocket.OPEN) ws.close(1000);
        ws = null;
      }
    };

    const scheduleReconnect = (delayMs) => {
      if (destroyed) return;
      setConnectionState((prev) => ({
        ...prev,
        lastReconnectAt: nowIso(),
        lastReconnectDelayMs: delayMs,
      }));
      reconnectTimer = window.setTimeout(connect, delayMs);
    };

    const connect = async () => {
      if (destroyed) return;

      if (circuitOpenUntilRef.current && Date.now() < circuitOpenUntilRef.current) {
        setRealtimeStatus('polling');
        setConnectionState((prev) => ({
          ...prev,
          transport: 'polling',
          circuitOpenUntil: new Date(circuitOpenUntilRef.current).toISOString(),
          circuitOpen: true,
        }));
        const remaining = Math.max(1000, circuitOpenUntilRef.current - Date.now());
        scheduleReconnect(remaining);
        return;
      }

      circuitOpenUntilRef.current = null;
      setConnectionState((prev) => ({ ...prev, circuitOpen: false, circuitOpenUntil: null }));

      let freshToken = localStorage.getItem('access_token');
      if (!freshToken) {
        setRealtimeStatus('idle');
        return;
      }

      if (isTokenExpiringSoon(freshToken, 90_000)) {
        const refreshedToken = await refreshAccessToken();
        if (refreshedToken) {
          freshToken = refreshedToken;
        }
      }

      if (!freshToken) {
        setRealtimeStatus('idle');
        return;
      }

      if (process.env.REACT_APP_DISABLE_REALTIME_WEBSOCKET === 'true') {
        wsHealthyRef.current = false;
        setRealtimeStatus('polling');
        setConnectionState((prev) => ({
          ...prev,
          transport: 'polling',
          circuitOpen: false,
          circuitOpenUntil: null,
          subscribedSymbols: [],
        }));
        return;
      }

      setRealtimeStatus('connecting');
      setConnectionState((prev) => ({ ...prev, transport: 'connecting' }));
      const wsUrl = getRealtimeWebSocketUrl(freshToken);
      if (!wsUrl) {
        wsHealthyRef.current = false;
        setRealtimeStatus('polling');
        setConnectionState((prev) => ({
          ...prev,
          transport: 'polling',
          circuitOpen: false,
          circuitOpenUntil: null,
          subscribedSymbols: [],
        }));
        return;
      }

      const nextWs = new WebSocket(wsUrl);
      ws = nextWs;

      nextWs.onopen = () => {
        if (destroyed || nextWs !== ws) {
          nextWs.close(1000);
          return;
        }
        wsHealthyRef.current = false;
        reconnectAttemptRef.current = 0;
        consecutiveFailuresRef.current = 0;
        setRealtimeStatus('live');
        setConnectionState((prev) => ({
          ...prev,
          transport: 'ws',
          circuitOpen: false,
          circuitOpenUntil: null,
        }));
        const symbolsForWs = symbolsRef.current.slice(0, MAX_WS_SUB_SYMBOLS);
        // Phase 4: Always subscribe to market_discovery in this feed
        sendAction(nextWs, 'subscribe', [...symbolsForWs, 'market_discovery']);
      };

      nextWs.onmessage = (event) => {
        if (destroyed || nextWs !== ws) return;
        try {
          const payload = JSON.parse(event.data);
          if (payload.event_type === 'subscribed') {
            wsHealthyRef.current = Array.isArray(payload.symbols) && payload.symbols.length > 0;
            setConnectionState((prev) => ({
              ...prev,
              subscribedSymbols: payload.symbols || [],
              lastSubscribedAt: nowIso(),
              transport: 'ws',
            }));
            setEventCounts((prev) => ({ ...prev, subscribed: prev.subscribed + 1 }));
          } else if (payload.event_type === 'unsubscribed') {
            setConnectionState((prev) => ({
              ...prev,
              subscribedSymbols: payload.symbols || [],
              lastUnsubscribedAt: nowIso(),
            }));
            setEventCounts((prev) => ({ ...prev, unsubscribed: prev.unsubscribed + 1 }));
          } else if (payload.event_type === 'error') {
            wsHealthyRef.current = false;
            setRealtimeStatus('polling');
            setConnectionState((prev) => ({
              ...prev,
              transport: 'polling',
              lastErrorAt: nowIso(),
              subscribedSymbols: [],
            }));
          } else if (payload.event_type === 'ticker_update') {
            applyTickerUpdateThrottled({
              symbol: payload.symbol,
              current_price: readEventField(payload, 'price') ?? readEventField(payload, 'current_price'),
              price: readEventField(payload, 'price'),
              prev_price: readEventField(payload, 'prev_price'),
              change_value: readEventField(payload, 'change_value'),
              change_pct: readEventField(payload, 'change_pct'),
              open_price: readEventField(payload, 'open_price'),
              high_price: readEventField(payload, 'high_price'),
              low_price: readEventField(payload, 'low_price'),
              volume: readEventField(payload, 'volume'),
              ts: payload.ts,
              freshness_seconds: readEventField(payload, 'freshness_seconds'),
              age_seconds: readEventField(payload, 'age_seconds'),
              stale: readEventField(payload, 'stale'),
              stale_over_threshold: readEventField(payload, 'stale_over_threshold'),
              stale_threshold_seconds: readEventField(payload, 'stale_threshold_seconds'),
              last_date: readEventField(payload, 'last_date'),
              source_event_at: readEventField(payload, 'source_event_at'),
              served_at: readEventField(payload, 'served_at'),
              market_phase: readEventField(payload, 'market_phase'),
              market_code: readEventField(payload, 'market_code'),
              data_semantic: readEventField(payload, 'data_semantic'),
              source: readEventField(payload, 'source'),
            });
            setLastEventAt(payload.ts || new Date().toISOString());
            setRealtimeStatus('live');
            setEventCounts((prev) => ({ ...prev, ticker_update: prev.ticker_update + 1 }));
            if (payload.ts) {
              const latency = Date.now() - new Date(payload.ts).getTime();
              setLastLatencyMs(latency);
              setLatencySamplesMs((prev) => [...prev.slice(-199), latency]);
            }
          } else if (payload.event_type === 'whale_alert') {
            const normalizedPayload = {
              ...payload,
              ts: normalizeEventTimestamp(payload.ts || payload.created_at),
            };
            if (shouldSkipDuplicateEvent(normalizedPayload, 'whale_alert')) {
              return;
            }
            applyAlert(normalizedPayload);
            setLastEventAt(normalizedPayload.ts);
            setRealtimeStatus('live');
            setEventCounts((prev) => ({ ...prev, whale_alert: prev.whale_alert + 1 }));
          } else if (payload.event_type === 'dark_flow_alert') {
            const normalizedPayload = {
              ...payload,
              ts: normalizeEventTimestamp(payload.ts || payload.created_at),
            };
            if (shouldSkipDuplicateEvent(normalizedPayload, 'dark_flow_alert')) {
              return;
            }
            applyDarkFlowAlert(normalizedPayload);
            setLastEventAt(normalizedPayload.ts);
            setRealtimeStatus('live');
            setEventCounts((prev) => ({ ...prev, dark_flow_alert: prev.dark_flow_alert + 1 }));
          } else if (payload.event_type === 'market_discovery_event') {
            applyMarketDiscoveryEvent(payload);
            setLastEventAt(payload.ts || payload.created_at || new Date().toISOString());
            setRealtimeStatus('live');
            setEventCounts((prev) => ({ ...prev, market_discovery_event: prev.market_discovery_event + 1 }));
          } else if (payload.event_type === 'whale_advisory') {
            setLastEventAt(payload.ts || payload.created_at || new Date().toISOString());
            setRealtimeStatus('live');
          } else if (payload.event_type === 'news_digest') {
            setLastEventAt(payload.created_at || new Date().toISOString());
            setRealtimeStatus('live');
          } else if (payload.event_type === 'heartbeat') {
            setLastEventAt(payload.ts || new Date().toISOString());
            setRealtimeStatus('live');
            setEventCounts((prev) => ({ ...prev, heartbeat: prev.heartbeat + 1 }));
            if (payload.ts) {
              const latency = Date.now() - new Date(payload.ts).getTime();
              setLastLatencyMs(latency);
              setLatencySamplesMs((prev) => [...prev.slice(-199), latency]);
            }
          }
        } catch (err) {
          console.error('WS message error:', err);
        }
      };

      nextWs.onerror = () => {
        if (destroyed || nextWs !== ws) return;
        wsHealthyRef.current = false;
        setRealtimeStatus('polling');
        setConnectionState((prev) => ({
          ...prev,
          transport: 'polling',
          lastErrorAt: nowIso(),
        }));
      };

      nextWs.onclose = (ev) => {
        if (destroyed || nextWs !== ws) return;
        wsHealthyRef.current = false;
        setConnectionState((prev) => ({
          ...prev,
          transport: ev.code === 1000 ? 'idle' : 'polling',
          lastCloseCode: ev.code,
          lastCloseReason: ev.reason || null,
        }));

        if (ev.code === 1000) return;

        const currentAccessToken = localStorage.getItem('access_token');
        const shouldTryAuthRefresh = ev.code === 4401
          || (
            [1006, 1008, 1011].includes(ev.code)
            && isTokenExpiringSoon(currentAccessToken, 0)
          );

        if (shouldTryAuthRefresh) {
          refreshAccessToken().then((newToken) => {
            if (newToken && !destroyed) {
              reconnectAttemptRef.current += 1;
              setEventCounts((prev) => ({ ...prev, reconnect_attempts: prev.reconnect_attempts + 1 }));
              scheduleReconnect(1000);
            } else {
              setRealtimeStatus('idle');
              window.location.href = '/login';
            }
          });
          return;
        }

        reconnectAttemptRef.current += 1;
        consecutiveFailuresRef.current += 1;
        setEventCounts((prev) => ({ ...prev, reconnect_attempts: prev.reconnect_attempts + 1 }));
        setRealtimeStatus('polling');

        if (consecutiveFailuresRef.current >= 5) {
          const openUntilTs = Date.now() + 30000;
          circuitOpenUntilRef.current = openUntilTs;
          setEventCounts((prev) => ({ ...prev, circuit_breaker_trips: prev.circuit_breaker_trips + 1 }));
          setConnectionState((prev) => ({
            ...prev,
            circuitOpen: true,
            circuitOpenUntil: new Date(openUntilTs).toISOString(),
            transport: 'polling',
          }));
          scheduleReconnect(30000);
          return;
        }

        const delayMs = computeReconnectDelayMs(reconnectAttemptRef.current);
        scheduleReconnect(delayMs);
      };
    };

    const initTimer = window.setTimeout(connect, 100);

    return () => {
      window.clearTimeout(initTimer);
      cleanup();
    };
  }, [normalizedSymbols.join(','), applyAlert, applyDarkFlowAlert, applyMarketDiscoveryEvent, applyTickerUpdateThrottled, enabled, shouldSkipDuplicateEvent]); // eslint-disable-line

  useEffect(() => () => {
    if (tickerRafIdRef.current !== null) {
      cancelAnimationFrame(tickerRafIdRef.current);
      tickerRafIdRef.current = null;
    }
  }, []);

  return {
    quotesBySymbol,
    realtimeStatus,
    lastEventAt,
    alerts,
    darkFlowAlerts,
    marketDiscoveryEvents,
    latestWhaleAlert: alerts[0] || null,
    latestDarkFlowAlert: darkFlowAlerts[0] || null,
    latestMarketDiscoveryEvent: marketDiscoveryEvents[0] || null,
    metrics: {
      eventCounts,
      lastLatencyMs,
      uiRefreshP95Ms,
      staleRatioPct,
      fallbackRatioPct,
      latencySampleSize: latencySamplesMs.length,
      connectionState,
    },
  };
}