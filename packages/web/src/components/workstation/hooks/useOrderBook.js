import { useCallback, useEffect, useState } from "react";
import { useRealtimePolling } from "./useRealtimePolling.js";
import { createCoreApiAdapter } from "../../../adapters/coreApiAdapter.js";

/**
 * useOrderBook - Hook for realtime order book (Market Depth) data
 * 
 * Polls /realtime/depth-chart/{symbol}/ endpoint
 * Returns bids/asks with price, volume, orders
 * 
 * @param {Object} options
 * @param {string} options.symbol - Stock symbol
 * @param {Object} options.env - Environment config
 * @param {Function} options.getToken - Auth token getter
 * @param {number} [options.intervalMs=5000] - Polling interval
 * @param {boolean} [options.enabled=true] - Enable polling
 * @returns {Object} { orderBook, loading, error, refresh }
 */
export function useOrderBook({ symbol, env, getToken, intervalMs = 5000, enabled = true } = {}) {
  const [orderBook, setOrderBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const adapter = createCoreApiAdapter({ env, getToken });

  const fetchOrderBook = useCallback(async (signal) => {
    if (!symbol) throw new Error("Symbol is required");
    const response = await adapter.getRealtimeDepthChart(symbol);
    return response.data ?? response;
  }, [symbol, adapter]);

  const handleData = useCallback((data) => {
    setOrderBook(data);
    setLoading(false);
    setError(null);
  }, []);

  const handleError = useCallback((err) => {
    setError(err.message || "Failed to load order book");
    setLoading(false);
  }, []);

  const { stop, start, isPolling } = useRealtimePolling({
    intervalMs,
    fetchFn: fetchOrderBook,
    onData: handleData,
    onError: handleError,
    enabled: enabled && !!symbol,
    dedupeKey: symbol,
  });

  // Initial load
  useEffect(() => {
    if (symbol && enabled) {
      setLoading(true);
      fetchOrderBook()
        .then(handleData)
        .catch(handleError);
    }
  }, [symbol, enabled, fetchOrderBook, handleData, handleError]);

  const refresh = useCallback(() => {
    if (symbol) {
      setLoading(true);
      fetchOrderBook()
        .then(handleData)
        .catch(handleError);
    }
  }, [symbol, fetchOrderBook, handleData, handleError]);

  return {
    orderBook,
    loading,
    error,
    isPolling,
    refresh,
    stopPolling: stop,
    startPolling: start,
  };
}