import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getRealtimeTicker, getRealtimeWebSocketUrl, refreshAccessToken } from '../api/client';

function nowIso() {
  return new Date().toISOString();
}

function readEventField(payload, key) {
  return payload?.[key] ?? payload?.data?.[key];
}

function mergeQuote(prev, update) {
  return {
    ...prev,
    symbol: update.symbol ?? prev.symbol,
    current_price: update.current_price ?? update.price ?? prev.current_price,
    change_value: update.change_value ?? prev.change_value,
    change_pct: update.change_pct ?? prev.change_pct,
    open_price: update.open_price ?? prev.open_price,
    high_price: update.high_price ?? prev.high_price,
    low_price: update.low_price ?? prev.low_price,
    volume: update.volume ?? prev.volume,
    freshness_seconds: update.freshness_seconds ?? prev.freshness_seconds,
    stale: update.stale ?? prev.stale,
    last_date: update.last_date ?? update.ts ?? prev.last_date,
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

export default function useRealtimeFeed({ symbols, pollInterval = 15000, maxAlerts = 5 }) {
  const [quotesBySymbol, setQuotesBySymbol] = useState({});
  const [realtimeStatus, setRealtimeStatus] = useState('idle');
  const [lastEventAt, setLastEventAt] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [eventCounts, setEventCounts] = useState({
    ticker_update: 0,
    whale_alert: 0,
    heartbeat: 0,
    reconnect_attempts: 0,
    subscribed: 0,
    unsubscribed: 0,
    polling_successes: 0,
    polling_failures: 0,
  });
  const [lastLatencyMs, setLastLatencyMs] = useState(null);
  const [connectionState, setConnectionState] = useState({
    transport: 'idle',
    subscribedSymbols: [],
    lastSubscribedAt: null,
    lastUnsubscribedAt: null,
    lastReconnectAt: null,
    lastErrorAt: null,
    lastCloseCode: null,
    lastCloseReason: null,
  });

  // Use string key to compare content, not reference — prevents infinite loop
  // when caller passes inline array (e.g. symbols={[symbol]}) every render
  const symbolsKey = (symbols || []).filter(Boolean).join(',');
  const normalizedSymbols = useMemo(
    () => [...new Set(symbolsKey.split(',').filter(Boolean))],
    [symbolsKey], // eslint-disable-line
  );

  const symbolsRef = useRef(normalizedSymbols);
  const realtimeStatusRef = useRef(realtimeStatus);
  const pollIntervalRef = useRef(pollInterval);

  useEffect(() => { symbolsRef.current = normalizedSymbols; }, [normalizedSymbols]);
  useEffect(() => { realtimeStatusRef.current = realtimeStatus; }, [realtimeStatus]);
  useEffect(() => { pollIntervalRef.current = pollInterval; }, [pollInterval]);

  useEffect(() => {
    setQuotesBySymbol((prev) => {
      const next = {};
      normalizedSymbols.forEach((symbol) => {
        next[symbol] = prev[symbol] || { symbol };
      });
      return next;
    });
  }, [normalizedSymbols]);

  const applyTickerUpdate = useCallback((update) => {
    if (!update?.symbol) return;
    setQuotesBySymbol((prev) => ({
      ...prev,
      [update.symbol]: mergeQuote(prev[update.symbol] || { symbol: update.symbol }, update),
    }));
  }, []);

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

  // POLLING - stable effect, uses refs for live values
  useEffect(() => {
    let intervalId = null;
    let destroyed = false;

    const poll = async () => {
      const token = localStorage.getItem('access_token');
      const syms = symbolsRef.current;
      if (!token || !syms.length || realtimeStatusRef.current === 'live') return;

      try {
        const results = await Promise.allSettled(syms.map((s) => getRealtimeTicker(s)));
        if (destroyed) return;
        let ok = 0;
        results.forEach((r, i) => {
          if (r.status === 'fulfilled') {
            ok++;
            const { data } = r.value;
            applyTickerUpdate({
              symbol: data.symbol,
              current_price: data.current_price,
              change_value: data.change_value,
              change_pct: data.change_pct,
              open_price: data.open_price,
              high_price: data.high_price,
              low_price: data.low_price,
              volume: data.volume,
              freshness_seconds: data.freshness_seconds,
              stale: data.stale,
              last_date: data.last_date,
            });
          } else {
            setEventCounts((prev) => ({ ...prev, polling_failures: prev.polling_failures + 1 }));
            console.warn(`Polling failed for ${syms[i]}:`, r.reason?.message);
          }
        });
        if (ok > 0) {
          setLastEventAt(nowIso());
          setEventCounts((prev) => ({ ...prev, polling_successes: prev.polling_successes + ok }));
        }
      } catch (err) {
        if (!destroyed) {
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
  }, [normalizedSymbols.join(','), applyTickerUpdate]); // eslint-disable-line

  // WEBSOCKET
  useEffect(() => {
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
        // Null all handlers first — prevents any event from firing after cleanup
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        // Only close if OPEN — calling close() on a CONNECTING socket causes
        // "WebSocket is closed before the connection is established" in Chrome.
        // A CONNECTING socket with nulled handlers becomes a harmless zombie
        // that the browser will GC once the handshake completes or times out.
        if (ws.readyState === WebSocket.OPEN) ws.close(1000);
        ws = null;
      }
    };

    const connect = () => {
      if (destroyed) return;
      // Always read fresh token at connect time — previous token may have expired
      const freshToken = localStorage.getItem('access_token');
      if (!freshToken) { setRealtimeStatus('idle'); return; }
      setRealtimeStatus('connecting');
      setConnectionState((prev) => ({
        ...prev,
        transport: 'connecting',
      }));
      const nextWs = new WebSocket(getRealtimeWebSocketUrl(freshToken));
      ws = nextWs;

      nextWs.onopen = () => {
        if (destroyed || nextWs !== ws) { nextWs.close(1000); return; }
        setRealtimeStatus('live');
        setConnectionState((prev) => ({
          ...prev,
          transport: 'ws',
          lastReconnectAt: prev.lastReconnectAt,
        }));
        sendAction(nextWs, 'subscribe', symbolsRef.current);
      };

      nextWs.onmessage = (event) => {
        if (destroyed || nextWs !== ws) return;
        try {
          const payload = JSON.parse(event.data);
          if (payload.event_type === 'subscribed') {
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
              setLastLatencyMs(Date.now() - new Date(payload.ts).getTime());
            }
          } else if (payload.event_type === 'whale_alert') {
            applyAlert(payload);
            setLastEventAt(payload.ts || new Date().toISOString());
            setRealtimeStatus('live');
            setEventCounts((prev) => ({ ...prev, whale_alert: prev.whale_alert + 1 }));
          } else if (payload.event_type === 'whale_advisory') {
            setLastEventAt(payload.ts || payload.created_at || new Date().toISOString());
            setRealtimeStatus('live');
          } else if (payload.event_type === 'heartbeat') {
            setLastEventAt(payload.ts || new Date().toISOString());
            setRealtimeStatus('live');
            setEventCounts((prev) => ({ ...prev, heartbeat: prev.heartbeat + 1 }));
            if (payload.ts) {
              setLastLatencyMs(Date.now() - new Date(payload.ts).getTime());
            }
          }
        } catch (err) {
          console.error('WS message error:', err);
        }
      };

      nextWs.onerror = () => {
        if (destroyed || nextWs !== ws) return;
        setRealtimeStatus('polling');
        setConnectionState((prev) => ({
          ...prev,
          transport: 'polling',
          lastErrorAt: nowIso(),
        }));
      };

      nextWs.onclose = (ev) => {
        if (destroyed || nextWs !== ws) return;
        setConnectionState((prev) => ({
          ...prev,
          transport: ev.code === 1000 ? 'idle' : 'polling',
          lastCloseCode: ev.code,
          lastCloseReason: ev.reason || null,
        }));
        // 4401: token expired on the server — refresh then reconnect
        if (ev.code === 4401) {
          refreshAccessToken().then((newToken) => {
            if (newToken && !destroyed) {
              setConnectionState((prev) => ({ ...prev, lastReconnectAt: nowIso() }));
              reconnectTimer = window.setTimeout(connect, 1000);
            } else {
              setRealtimeStatus('idle');
              window.location.href = '/login';
            }
          });
          return;
        }
        setRealtimeStatus('polling');
        if (ev.code !== 1000) {
          setEventCounts((prev) => ({ ...prev, reconnect_attempts: prev.reconnect_attempts + 1 }));
          setConnectionState((prev) => ({ ...prev, lastReconnectAt: nowIso() }));
          reconnectTimer = window.setTimeout(connect, 5000);
        }
      };
    };

    const initTimer = window.setTimeout(connect, 100);

    return () => {
      window.clearTimeout(initTimer);
      cleanup();
    };
  }, [normalizedSymbols.join(','), applyAlert, applyTickerUpdate]); // eslint-disable-line

  return {
    quotesBySymbol,
    realtimeStatus,
    lastEventAt,
    alerts,
    latestWhaleAlert: alerts[0] || null,
    metrics: { eventCounts, lastLatencyMs, connectionState },
  };
}
