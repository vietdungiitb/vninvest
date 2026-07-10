import * as ReactModule from 'react';
const React = ReactModule.default || ReactModule;
import useRealtimeFeedCore from '../hooks/useRealtimeFeedCore.js';

const RealtimeContext = React.createContext(null);

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
  const [subscriptions, setSubscriptions] = React.useState({});

  const aggregatedSymbols = React.useMemo(() => {
    const union = new Set();
    Object.values(subscriptions).forEach((sub) => {
      (sub.symbols || []).forEach((symbol) => union.add(symbol));
    });
    return [...union];
  }, [subscriptions]);

  const maxAlerts = React.useMemo(() => {
    const values = Object.values(subscriptions).map((sub) => Number(sub.maxAlerts) || 5);
    return values.length ? Math.max(...values) : 5;
  }, [subscriptions]);

  const pollInterval = React.useMemo(() => {
    const values = Object.values(subscriptions).map((sub) => Number(sub.pollInterval) || 15000);
    return values.length ? Math.max(3000, Math.min(...values)) : 15000;
  }, [subscriptions]);

  const feed = useRealtimeFeedCore({
    symbols: aggregatedSymbols,
    maxAlerts,
    pollInterval,
    enabled: aggregatedSymbols.length > 0,
  });

  const register = React.useCallback((consumerId, nextConfig) => {
    setSubscriptions((prev) => ({
      ...prev,
      [consumerId]: {
        symbols: toUniqueSymbols(nextConfig?.symbols),
        maxAlerts: Number(nextConfig?.maxAlerts) || 5,
        pollInterval: Number(nextConfig?.pollInterval) || 15000,
      },
    }));
  }, []);

  const update = React.useCallback((consumerId, nextConfig) => {
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
  }, []);

  const unregister = React.useCallback((consumerId) => {
    setSubscriptions((prev) => {
      if (!prev[consumerId]) return prev;
      const next = { ...prev };
      delete next[consumerId];
      return next;
    });
  }, []);

  const value = React.useMemo(() => {
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
          ...(feed?.metrics || {}),
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

  return React.createElement(RealtimeContext.Provider, { value }, children);
}

export function useRealtimeFeedFromManager({ symbols, pollInterval = 15000, maxAlerts = 5 }) {
  const contextValue = React.useContext(RealtimeContext);
  const consumerIdRef = React.useRef(null);

  const symbolsKey = React.useMemo(() => toSymbolsKey(symbols), [symbols]);
  const normalizedSymbols = React.useMemo(() => toUniqueSymbols(symbols), [symbolsKey]); // eslint-disable-line

  const hasRegisteredRef = React.useRef(false);

  React.useEffect(() => {
    if (!contextValue?.enabled) return undefined;

    if (!consumerIdRef.current) {
      consumerIdRef.current = createConsumerId();
    }
    if (!hasRegisteredRef.current) {
      contextValue.register(consumerIdRef.current, { symbols: normalizedSymbols, pollInterval, maxAlerts });
      hasRegisteredRef.current = true;
    }

    return () => {
      if (consumerIdRef.current) {
        contextValue.unregister(consumerIdRef.current);
        hasRegisteredRef.current = false;
      }
    };
  }, [contextValue?.enabled, contextValue?.register, contextValue?.unregister]);

  React.useEffect(() => {
    if (!contextValue?.enabled || !consumerIdRef.current) return;
    contextValue.update(consumerIdRef.current, { symbols: normalizedSymbols, pollInterval, maxAlerts });
  }, [contextValue?.enabled, contextValue?.update, symbolsKey, pollInterval, maxAlerts, normalizedSymbols]);

  if (!contextValue?.enabled) return null;

  const baseFeed = contextValue.feed || {};

  const quotesKey = normalizedSymbols.map(sym => {
    const q = baseFeed.quotesBySymbol?.[sym];
    return `${sym}:${q?.current_price ?? q?.price ?? 0}:${q?.last_trade_time ?? q?.ts ?? 0}`;
  }).join(',');

  const memoizedResult = React.useMemo(() => {
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
      marketDiscoveryEvents: baseFeed.marketDiscoveryEvents || [],
      latestWhaleAlert: alerts[0] || null,
      latestDarkFlowAlert: darkFlowAlerts[0] || null,
      latestMarketDiscoveryEvent: baseFeed.latestMarketDiscoveryEvent || null,
      metrics: baseFeed.metrics || {
        eventCounts: {},
        lastLatencyMs: null,
        connectionState: { transport: 'idle' },
      },
    };
  }, [
    baseFeed.quotesBySymbol,
    baseFeed.alerts,
    baseFeed.darkFlowAlerts,
    baseFeed.realtimeStatus,
    baseFeed.lastEventAt,
    baseFeed.marketDiscoveryEvents,
    baseFeed.latestMarketDiscoveryEvent,
    baseFeed.metrics,
    normalizedSymbols,
    maxAlerts,
    quotesKey
  ]);

  return memoizedResult;
}
