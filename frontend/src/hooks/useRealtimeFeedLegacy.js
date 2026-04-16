import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getRealtimeTicker, getRealtimeWebSocketUrl, refreshAccessToken } from '../api/client';

function nowIso() {
  return new Date().toISOString();
}

function readEventField(payload, key) {
  return payload?.[key] ?? payload?.data?.[key];
}

function normalizeSymbol(value) {
  return String(value || '').trim().toUpperCase();
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

function mergeQuote(prev, update) {
  const eventTimestamp = update.last_date ?? update.ts;
  const eventAgeSeconds = eventTimestamp
    ? Math.max(0, Math.floor((Date.now() - new Date(eventTimestamp).getTime()) / 1000))
    : null;
  const inferredFreshness = Number.isFinite(eventAgeSeconds) ? eventAgeSeconds : null;

  const nextCurrentPrice = isValidQuotePrice(update.current_price)
    ? Number(update.current_price)
    : (isValidQuotePrice(update.price) ? Number(update.price) : prev.current_price);

  return {
    ...prev,
    symbol: normalizeSymbol(update.symbol ?? prev.symbol),
    current_price: nextCurrentPrice,
    prev_price: update.prev_price ?? prev.prev_price,
    change_value: update.change_value ?? prev.change_value,
    change_pct: update.change_pct ?? prev.change_pct,
    open_price: update.open_price ?? prev.open_price,
    high_price: update.high_price ?? prev.high_price,
    low_price: update.low_price ?? prev.low_price,
    volume: update.volume ?? prev.volume,
    freshness_seconds: update.freshness_seconds ?? inferredFreshness ?? prev.freshness_seconds,
    stale: update.stale ?? (inferredFreshness !== null ? inferredFreshness > 30 : prev.stale),
    last_date: eventTimestamp ?? prev.last_date,
    market_phase: update.market_phase ?? prev.market_phase,
    market_code: update.market_code ?? prev.market_code,
    data_semantic: update.data_semantic ?? prev.data_semantic,
    source: update.source ?? prev.source,
  };
}

function normalizeAlert(payload) {
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
    ts: readEventField(payload, 'ts') || payload.ts || payload.created_at,
  };
}

function normalizeDarkFlowAlert(payload) {
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
    ts: readEventField(payload, 'ts') || payload.ts || payload.created_at,
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

function computeNextBackoffMs(currentBackoffMs) {
  if (!currentBackoffMs || currentBackoffMs <= 0) {
    return 5000;
  }
  return Math.min(currentBackoffMs * 2, 120000);
}

function normalizePollSymbolCandidates(symbols, quotesBySymbol, wsHealthy) {
  const normalizedQuotes = quotesBySymbol || {};
  const staleOrMissing = [];
  const fresh = [];

  (symbols || []).forEach((symbol) => {
    const normalizedSymbol = normalizeSymbol(symbol);
    const quote = getQuoteBySymbol(normalizedQuotes, normalizedSymbol);
    const isMissing = !isValidQuotePrice(quote.current_price);
    const isOffhoursSessionClose = quote.data_semantic === 'last_session_close'
      || ['offhours', 'post_close', 'pre_open'].includes(String(quote.market_phase || '').toLowerCase());
    const freshnessSeconds = Number(quote.freshness_seconds);
    const isStale = isOffhoursSessionClose
      ? false
      : (quote.stale || (Number.isFinite(freshnessSeconds) && freshnessSeconds > 20));

    if (isMissing || isStale) {
      staleOrMissing.push(normalizedSymbol);
    } else {
      fresh.push(normalizedSymbol);
    }
  });

  if (!wsHealthy) {
    return [...staleOrMissing, ...fresh];
  }

  return staleOrMissing;
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

export default function useRealtimeFeedLegacy({
  symbols,
  pollInterval = 15000,
  maxAlerts = 5,
  enabled = true,
}) {
  const POLL_BATCH_SIZE = 4;
  const WS_HEALTHY_POLL_BATCH_SIZE = 2;
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
  const [eventCounts, setEventCounts] = useState({
    ticker_update: 0,
    whale_alert: 0,
    dark_flow_alert: 0,
    heartbeat: 0,
    reconnect_attempts: 0,
    subscribed: 0,
    unsubscribed: 0,
    polling_successes: 0,
    polling_failures: 0,
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

  useEffect(() => {
    if (!enabled) return undefined;

    const token = localStorage.getItem('access_token');
    if (!token || !normalizedSymbols.length) {
      return undefined;
    }

    let cancelled = false;

    const hydrateQuotes = async () => {
      // Hydrate full quote set once on mount so hard refresh does not leave
      // a subset of symbols empty while waiting for polling cursor rotation.
      // Increased batch size from 10 -> 20 for faster sequential bootstrap without API surge
      const bootstrapBatchSize = 20;

      for (let i = 0; i < normalizedSymbols.length; i += bootstrapBatchSize) {
        const batch = normalizedSymbols.slice(i, i + bootstrapBatchSize);
        const results = await Promise.allSettled(batch.map((symbol) => getRealtimeTicker(symbol)));
        if (cancelled) return;

        let ok = 0;
        results.forEach((result, idx) => {
          if (result.status === 'fulfilled') {
            ok += 1;
            const { data } = result.value;
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
              stale: data.stale,
              last_date: data.last_date,
              market_phase: data.market_phase,
              market_code: data.market_code,
              data_semantic: data.data_semantic,
              source: data.source,
            });
          } else {
            const status = getHttpStatus(result.reason);
            setEventCounts((prev) => ({ ...prev, polling_failures: prev.polling_failures + 1 }));
            if (status !== 429) {
              console.warn(`Bootstrap quote fetch failed for ${batch[idx]}:`, result.reason?.message);
            }
          }
        });

        if (ok > 0) {
          setLastEventAt(nowIso());
          setEventCounts((prev) => ({ ...prev, polling_successes: prev.polling_successes + ok }));
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

  useEffect(() => {
    if (!enabled) return undefined;

    let intervalId = null;
    let destroyed = false;

    const poll = async () => {
      const token = localStorage.getItem('access_token');
      const syms = symbolsRef.current;
      if (!token || !syms.length) return;

      const wsHealthy = wsHealthyRef.current;
      const pollCandidates = normalizePollSymbolCandidates(
        syms,
        quotesBySymbolRef.current,
        wsHealthy,
      );

      if (!pollCandidates.length) {
        return;
      }

      // Only enter recovery mode if WS healthy AND >= 3 missing symbols (reduces unnecessary recovery polling)
      const hasRecoveryCandidates = wsHealthy && pollCandidates.length >= WS_HEALTHY_RECOVERY_MIN_CANDIDATES;
      const effectiveIntervalMs = hasRecoveryCandidates
        ? WS_HEALTHY_RECOVERY_POLL_INTERVAL_MS
        : (wsHealthy
          ? Math.max(pollIntervalRef.current, WS_HEALTHY_MIN_POLL_INTERVAL_MS)
          : Math.max(pollIntervalRef.current, 5000));

      if (lastPollAtRef.current && (Date.now() - lastPollAtRef.current) < effectiveIntervalMs) {
        return;
      }

      if (pollBackoffUntilRef.current && Date.now() < pollBackoffUntilRef.current) {
        return;
      }

      lastPollAtRef.current = Date.now();

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
        const results = await Promise.allSettled(pollBatch.map((s) => getRealtimeTicker(s)));
        if (destroyed) return;
        let ok = 0;
        let had429 = false;
        results.forEach((r, i) => {
          if (r.status === 'fulfilled') {
            ok += 1;
            const { data } = r.value;
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
              stale: data.stale,
              last_date: data.last_date,
              market_phase: data.market_phase,
              market_code: data.market_code,
              data_semantic: data.data_semantic,
              source: data.source,
            });
          } else {
            const status = getHttpStatus(r.reason);
            if (status === 429) {
              had429 = true;
            }
            setEventCounts((prev) => ({ ...prev, polling_failures: prev.polling_failures + 1 }));
            if (status !== 429) {
              console.warn(`Polling failed for ${pollBatch[i]}:`, r.reason?.message);
            }
          }
        });

        if (had429) {
          const nextBackoffMs = computeNextBackoffMs(pollBackoffMsRef.current);
          pollBackoffMsRef.current = nextBackoffMs;
          pollBackoffUntilRef.current = Date.now() + nextBackoffMs;
          console.warn(`Polling rate limited (429). Backing off for ${nextBackoffMs}ms.`);
          return;
        }

        pollBackoffMsRef.current = 0;
        pollBackoffUntilRef.current = null;
        pollCursorRef.current = nextCursor;

        if (ok > 0) {
          setLastEventAt(nowIso());
          setEventCounts((prev) => ({ ...prev, polling_successes: prev.polling_successes + ok }));
        }
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
          console.error('Polling error:', err);
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

    const connect = () => {
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

      const freshToken = localStorage.getItem('access_token');
      if (!freshToken) {
        setRealtimeStatus('idle');
        return;
      }

      setRealtimeStatus('connecting');
      setConnectionState((prev) => ({ ...prev, transport: 'connecting' }));
      const nextWs = new WebSocket(getRealtimeWebSocketUrl(freshToken));
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
        sendAction(nextWs, 'subscribe', symbolsForWs);
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
            applyTickerUpdate({
              symbol: payload.symbol,
              price: readEventField(payload, 'price'),
              change_value: readEventField(payload, 'change_value'),
              change_pct: readEventField(payload, 'change_pct'),
              volume: readEventField(payload, 'volume'),
              ts: payload.ts,
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
            applyAlert(payload);
            setLastEventAt(payload.ts || new Date().toISOString());
            setRealtimeStatus('live');
            setEventCounts((prev) => ({ ...prev, whale_alert: prev.whale_alert + 1 }));
          } else if (payload.event_type === 'dark_flow_alert') {
            applyDarkFlowAlert(payload);
            setLastEventAt(payload.ts || new Date().toISOString());
            setRealtimeStatus('live');
            setEventCounts((prev) => ({ ...prev, dark_flow_alert: prev.dark_flow_alert + 1 }));
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

        if (ev.code === 4401) {
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
  }, [normalizedSymbols.join(','), applyAlert, applyDarkFlowAlert, applyTickerUpdate, enabled]); // eslint-disable-line

  return {
    quotesBySymbol,
    realtimeStatus,
    lastEventAt,
    alerts,
    darkFlowAlerts,
    latestWhaleAlert: alerts[0] || null,
    latestDarkFlowAlert: darkFlowAlerts[0] || null,
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