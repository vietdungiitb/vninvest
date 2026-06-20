import { useCallback, useEffect, useRef, useState } from "react";
import { useRealtimePolling } from "./useRealtimePolling.js";
import { createCoreApiAdapter } from "../../../adapters/coreApiAdapter.js";

/**
 * useTradeLog - Hook for realtime trade log (Execution Log) data
 * 
 * Polls /realtime/intraday/{symbol}/ endpoint
 * Prepends new trades to maintain chronological order (newest first)
 * Deduplicates by time+price+volume
 * 
 * @param {Object} options
 * @param {string} options.symbol - Stock symbol
 * @param {Object} options.env - Environment config
 * @param {Function} options.getToken - Auth token getter
 * @param {number} [options.intervalMs=5000] - Polling interval
 * @param {number} [options.maxItems=100] - Max trades to keep in memory
 * @param {boolean} [options.enabled=true] - Enable polling
 * @returns {Object} { trades, loading, error, refresh }
 */
export function useTradeLog({ symbol, env, getToken, intervalMs = 5000, maxItems = 100, enabled = true } = {}) {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const seenKeysRef = useRef(new Set());

  const adapter = createCoreApiAdapter({ env, getToken });

  const fetchTrades = useCallback(async (signal) => {
    if (!symbol) throw new Error("Symbol is required");
    const response = await adapter.getRealtimeIntraday(symbol, { page_size: 50 });
    return response.data ?? response;
  }, [symbol, adapter]);

  const makeTradeKey = useCallback((trade) => {
    return `${trade.time}|${trade.price}|${trade.volume}|${trade.side}`;
  }, []);

  const handleData = useCallback((data) => {
    const newTrades = data.trades ?? data.bars ?? data.results ?? [];
    
    if (!Array.isArray(newTrades) || newTrades.length === 0) {
      setLoading(false);
      return;
    }

    setTrades((prev) => {
      // Filter out duplicates
      const uniqueNewTrades = newTrades.filter((trade) => {
        const key = makeTradeKey(trade);
        if (seenKeysRef.current.has(key)) return false;
        seenKeysRef.current.add(key);
        return true;
      });

      if (uniqueNewTrades.length === 0) return prev;

      // Prepend new trades (newest first)
      const combined = [...uniqueNewTrades, ...prev];
      
      // Trim to maxItems
      if (combined.length > maxItems) {
        // Remove old keys from seen set
        const removed = combined.slice(maxItems);
        removed.forEach((trade) => {
          seenKeysRef.current.delete(makeTradeKey(trade));
        });
        return combined.slice(0, maxItems);
      }
      
      return combined;
    });
    
    setLoading(false);
    setError(null);
  }, [makeTradeKey, maxItems]);

  const handleError = useCallback((err) => {
    setError(err.message || "Failed to load trade log");
    setLoading(false);
  }, []);

  const { stop, start, isPolling } = useRealtimePolling({
    intervalMs,
    fetchFn: fetchTrades,
    onData: handleData,
    onError: handleError,
    enabled: enabled && !!symbol,
    dedupeKey: symbol,
  });

  // Initial load
  useEffect(() => {
    if (symbol && enabled) {
      setLoading(true);
      setTrades([]);
      seenKeysRef.current.clear();
      fetchTrades()
        .then(handleData)
        .catch(handleError);
    }
  }, [symbol, enabled, fetchTrades, handleData, handleError]);

  const refresh = useCallback(() => {
    if (symbol) {
      setLoading(true);
      seenKeysRef.current.clear();
      fetchTrades()
        .then(handleData)
        .catch(handleError);
    }
  }, [symbol, fetchTrades, handleData, handleError]);

  return {
    trades,
    loading,
    error,
    isPolling,
    refresh,
    stopPolling: stop,
    startPolling: start,
  };
}