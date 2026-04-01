import { useCallback, useEffect, useMemo, useState } from 'react';
import { getRealtimeTicker, getRealtimeWebSocketUrl } from '../api/client';

function mergeQuote(prev, update) {
  return {
    ...prev,
    symbol: update.symbol ?? prev.symbol,
    current_price: update.current_price ?? update.price ?? prev.current_price,
    change_value: update.change_value ?? prev.change_value,
    change_pct: update.change_pct ?? prev.change_pct,
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

  const normalizedSymbols = useMemo(
    () => [...new Set((symbols || []).filter(Boolean))],
    [symbols],
  );

  const symbolsKey = useMemo(
    () => normalizedSymbols.slice().sort().join('|'),
    [normalizedSymbols],
  );

  useEffect(() => {
    setQuotesBySymbol((prev) => {
      const next = {};
      normalizedSymbols.forEach((symbol) => {
        next[symbol] = prev[symbol] || { symbol };
      });
      return next;
    });
  }, [symbolsKey, normalizedSymbols]);

  const applyTickerUpdate = useCallback((update) => {
    if (!update?.symbol) {
      return;
    }

    setQuotesBySymbol((prev) => ({
      ...prev,
      [update.symbol]: mergeQuote(prev[update.symbol] || { symbol: update.symbol }, update),
    }));
  }, []);

  const applyAlert = useCallback((payload) => {
    const nextAlert = normalizeAlert(payload);
    const nextKey = `${nextAlert.symbol || 'NA'}-${nextAlert.ts || 'NA'}-${nextAlert.side || 'NA'}`;

    setAlerts((prev) => {
      const filtered = prev.filter((item) => `${item.symbol || 'NA'}-${item.ts || 'NA'}-${item.side || 'NA'}` !== nextKey);
      return [nextAlert, ...filtered].slice(0, maxAlerts);
    });
  }, [maxAlerts]);

  const pollQuotes = useCallback(async () => {
    if (!normalizedSymbols.length) {
      return;
    }

    try {
      const responses = await Promise.all(normalizedSymbols.map((symbol) => getRealtimeTicker(symbol)));
      responses.forEach(({ data }) => {
        applyTickerUpdate({
          symbol: data.symbol,
          current_price: data.current_price,
          change_value: data.change_value,
          change_pct: data.change_pct,
          freshness_seconds: data.freshness_seconds,
          stale: data.stale,
          last_date: data.last_date,
        });
      });
      setLastEventAt(new Date().toISOString());
    } catch (err) {
      console.error('Realtime polling failed:', err);
    }
  }, [applyTickerUpdate, normalizedSymbols]);

  useEffect(() => {
    if (!normalizedSymbols.length || realtimeStatus === 'live') {
      return undefined;
    }

    pollQuotes();
    const intervalId = window.setInterval(pollQuotes, pollInterval);
    return () => window.clearInterval(intervalId);
  }, [symbolsKey, normalizedSymbols, pollInterval, pollQuotes, realtimeStatus]);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token || !normalizedSymbols.length) {
      setRealtimeStatus('idle');
      return undefined;
    }

    let socket = null;
    let reconnectTimer = null;
    let disposed = false;

    const connect = () => {
      setRealtimeStatus('connecting');
      socket = new WebSocket(getRealtimeWebSocketUrl(token));

      socket.onopen = () => {
        if (disposed) {
          return;
        }
        setRealtimeStatus('live');
        socket.send(JSON.stringify({ action: 'subscribe', symbols: normalizedSymbols }));
      };

      socket.onmessage = (event) => {
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
            return;
          }

          if (payload.event_type === 'whale_alert') {
            applyAlert(payload);
            setLastEventAt(payload.ts || new Date().toISOString());
            setRealtimeStatus('live');
            return;
          }

          if (payload.event_type === 'heartbeat') {
            setLastEventAt(payload.ts || new Date().toISOString());
            setRealtimeStatus('live');
          }
        } catch (err) {
          console.error('Realtime message parse failed:', err);
        }
      };

      socket.onerror = () => {
        setRealtimeStatus('polling');
      };

      socket.onclose = () => {
        if (disposed) {
          return;
        }
        setRealtimeStatus('polling');
        reconnectTimer = window.setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ action: 'unsubscribe', symbols: normalizedSymbols }));
      }
      if (socket) {
        socket.close();
      }
    };
  }, [symbolsKey, normalizedSymbols, applyAlert, applyTickerUpdate]);

  const latestWhaleAlert = alerts[0] || null;

  return {
    quotesBySymbol,
    realtimeStatus,
    lastEventAt,
    alerts,
    latestWhaleAlert,
  };
}