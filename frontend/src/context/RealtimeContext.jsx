import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import useRealtimeFeedCore from '../hooks/useRealtimeFeedCore';

const RealtimeContext = createContext(null);

function toUniqueSymbols(symbols) {
  return [...new Set((symbols || []).filter(Boolean).map((s) => String(s).trim().toUpperCase()))];
}

function toSymbolsKey(symbols) {
  return toUniqueSymbols(symbols).join(',');
}

function createConsumerId() {
  return `rt-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export function RealtimeProvider({ children }) {
  const [subscriptions, setSubscriptions] = useState({});

  const aggregatedSymbols = useMemo(() => {
    const union = new Set();
    Object.values(subscriptions).forEach((sub) => {
      (sub.symbols || []).forEach((symbol) => union.add(symbol));
    });
    return [...union];
  }, [subscriptions]);

  const maxAlerts = useMemo(() => {
    const values = Object.values(subscriptions).map((sub) => Number(sub.maxAlerts) || 5);
    return values.length ? Math.max(...values) : 5;
  }, [subscriptions]);

  const pollInterval = useMemo(() => {
    const values = Object.values(subscriptions).map((sub) => Number(sub.pollInterval) || 15000);
    return values.length ? Math.max(3000, Math.min(...values)) : 15000;
  }, [subscriptions]);

  const feed = useRealtimeFeedCore({
    symbols: aggregatedSymbols,
    maxAlerts,
    pollInterval,
    enabled: aggregatedSymbols.length > 0,
  });

  const register = (consumerId, nextConfig) => {
    setSubscriptions((prev) => ({
      ...prev,
      [consumerId]: {
        symbols: toUniqueSymbols(nextConfig?.symbols),
        maxAlerts: Number(nextConfig?.maxAlerts) || 5,
        pollInterval: Number(nextConfig?.pollInterval) || 15000,
      },
    }));
  };

  const update = (consumerId, nextConfig) => {
    setSubscriptions((prev) => {
      if (!prev[consumerId]) return prev;
      return {
        ...prev,
        [consumerId]: {
          symbols: toUniqueSymbols(nextConfig?.symbols),
          maxAlerts: Number(nextConfig?.maxAlerts) || 5,
          pollInterval: Number(nextConfig?.pollInterval) || 15000,
        },
      };
    });
  };

  const unregister = (consumerId) => {
    setSubscriptions((prev) => {
      if (!prev[consumerId]) return prev;
      const next = { ...prev };
      delete next[consumerId];
      return next;
    });
  };

  const value = useMemo(() => {
    const consumerCount = Object.keys(subscriptions).length;
    const requestedSymbolCount = Object.values(subscriptions).reduce((acc, sub) => acc + (sub.symbols?.length || 0), 0);
    const dedupSavedSymbols = Math.max(0, requestedSymbolCount - aggregatedSymbols.length);
    return {
      enabled: true,
      register,
      update,
      unregister,
      feed: {
        ...feed,
        metrics: {
          ...(feed.metrics || {}),
          manager: {
            singletonSocket: true,
            consumerCount,
            symbolUnionCount: aggregatedSymbols.length,
            dedupSavedSymbols,
          },
        },
      },
    };
  }, [feed, subscriptions, aggregatedSymbols]);

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtimeFeedFromManager({ symbols, pollInterval = 15000, maxAlerts = 5 }) {
  const contextValue = useContext(RealtimeContext);
  const consumerIdRef = useRef(null);

  const symbolsKey = useMemo(() => toSymbolsKey(symbols), [symbols]);
  const normalizedSymbols = useMemo(() => toUniqueSymbols(symbols), [symbolsKey]); // eslint-disable-line

  useEffect(() => {
    if (!contextValue?.enabled) return undefined;

    if (!consumerIdRef.current) {
      consumerIdRef.current = createConsumerId();
    }
    contextValue.register(consumerIdRef.current, { symbols: normalizedSymbols, pollInterval, maxAlerts });

    return () => {
      if (consumerIdRef.current) {
        contextValue.unregister(consumerIdRef.current);
      }
    };
  }, [contextValue]);

  useEffect(() => {
    if (!contextValue?.enabled || !consumerIdRef.current) return;
    contextValue.update(consumerIdRef.current, { symbols: normalizedSymbols, pollInterval, maxAlerts });
  }, [contextValue, symbolsKey, pollInterval, maxAlerts, normalizedSymbols]);

  if (!contextValue?.enabled) return null;

  const baseFeed = contextValue.feed || {};
  const quotesBySymbol = {};
  normalizedSymbols.forEach((symbol) => {
    if (baseFeed.quotesBySymbol?.[symbol]) {
      quotesBySymbol[symbol] = baseFeed.quotesBySymbol[symbol];
    }
  });

  const alerts = (baseFeed.alerts || []).filter((item) => {
    if (!item?.symbol) return true;
    return normalizedSymbols.includes(String(item.symbol).toUpperCase());
  }).slice(0, maxAlerts);

  const darkFlowAlerts = (baseFeed.darkFlowAlerts || []).filter((item) => {
    if (!item?.symbol) return true;
    return normalizedSymbols.includes(String(item.symbol).toUpperCase());
  }).slice(0, maxAlerts);

  return {
    quotesBySymbol,
    realtimeStatus: baseFeed.realtimeStatus || 'idle',
    lastEventAt: baseFeed.lastEventAt || null,
    alerts,
    darkFlowAlerts,
    latestWhaleAlert: alerts[0] || null,
    latestDarkFlowAlert: darkFlowAlerts[0] || null,
    metrics: baseFeed.metrics || {
      eventCounts: {},
      lastLatencyMs: null,
      connectionState: { transport: 'idle' },
    },
  };
}
