import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getRealtimeTicker, getRealtimeWebSocketUrl, refreshAccessToken } from '../api/client';

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
    symbol: payload.symbol,
    side: payload.data?.side,
    matched_value: payload.data?.matched_value,
    threshold: payload.data?.threshold,
    ts: payload.ts,
  };
}

export default function useRealtimeFeed({ symbols, pollInterval = 15000, maxAlerts = 5 }) {
  const [quotesBySymbol, setQuotesBySymbol] = useState({});
  const [realtimeStatus, setRealtimeStatus] = useState('idle');
  const [lastEventAt, setLastEventAt] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [eventCounts, setEventCounts] = useState({ ticker_update: 0, whale_alert: 0, heartbeat: 0, reconnect_attempts: 0 });
  const [lastLatencyMs, setLastLatencyMs] = useState(null);

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
    const nextKey = `${nextAlert.symbol || 'NA'}-${nextAlert.ts || 'NA'}-${nextAlert.side || 'NA'}`;
    setAlerts((prev) => {
      const filtered = prev.filter(
        (item) => `${item.symbol || 'NA'}-${item.ts || 'NA'}-${item.side || 'NA'}` !== nextKey
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
            console.warn(`Polling failed for ${syms[i]}:`, r.reason?.message);
          }
        });
        if (ok > 0) setLastEventAt(new Date().toISOString());
      } catch (err) {
        if (!destroyed) console.error('Polling error:', err);
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

    const cleanup = () => {
      destroyed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (ws) {
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
      const nextWs = new WebSocket(getRealtimeWebSocketUrl(freshToken));
      ws = nextWs;

      nextWs.onopen = () => {
        if (destroyed || nextWs !== ws) { nextWs.close(1000); return; }
        setRealtimeStatus('live');
        nextWs.send(JSON.stringify({ action: 'subscribe', symbols: symbolsRef.current }));
      };

      nextWs.onmessage = (event) => {
        if (destroyed || nextWs !== ws) return;
        try {
          const payload = JSON.parse(event.data);
          if (payload.event_type === 'ticker_update') {
            applyTickerUpdate({
              symbol: payload.symbol,
              price: payload.data?.price,
              change_value: payload.data?.change_value,
              change_pct: payload.data?.change_pct,
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
      };

      nextWs.onclose = (ev) => {
        if (destroyed || nextWs !== ws) return;
        // 4401: token expired on the server — refresh then reconnect
        if (ev.code === 4401) {
          refreshAccessToken().then((newToken) => {
            if (newToken && !destroyed) {
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
    metrics: { eventCounts, lastLatencyMs },
  };
}
