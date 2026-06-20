import { useCallback, useEffect, useState } from "react";
import { createCoreApiAdapter } from "../../../adapters/coreApiAdapter.js";

/**
 * useSessionFacts - Hook for SessionFacts data from Stock Overview
 * 
 * Fetches session-level aggregates: total buy/sell volume, 
 * institutional/retail strength, CVD, whale flow
 * 
 * @param {Object} options
 * @param {string} options.symbol - Stock symbol
 * @param {Object} options.env - Environment config
 * @param {Function} options.getToken - Auth token getter
 * @param {boolean} [options.enabled=true] - Enable fetching
 * @returns {Object} { sessionFacts, loading, error, refresh }
 */
export function useSessionFacts({ symbol, env, getToken, enabled = true } = {}) {
  const [sessionFacts, setSessionFacts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const adapter = createCoreApiAdapter({ env, getToken });

  const fetchSessionFacts = useCallback(async () => {
    if (!symbol) throw new Error("Symbol is required");
    // SessionFacts are now included in the overview response
    const response = await adapter.getStockOverview(symbol);
    return response.data ?? response;
  }, [symbol, adapter]);

  const handleData = useCallback((data) => {
    // Extract SessionFacts fields from overview response
    const facts = {
      total_buy_qty: data.total_buy_qty,
      total_sell_qty: data.total_sell_qty,
      institutional_buy: data.institutional_buy,
      retail_buy: data.retail_buy,
      cvd_normalized: data.cvd_normalized,
      whale_net_flow: data.whale_net_flow,
      dark_flow_score: data.dark_flow_score,
      session_facts_date: data.session_facts_date,
      session_facts_source: data.session_facts_source,
    };
    setSessionFacts(facts);
    setLoading(false);
    setError(null);
  }, []);

  const handleError = useCallback((err) => {
    setError(err.message || "Failed to load session facts");
    setLoading(false);
  }, []);

  const load = useCallback(async () => {
    if (!symbol || !enabled) return;
    setLoading(true);
    try {
      const data = await fetchSessionFacts();
      handleData(data);
    } catch (err) {
      handleError(err);
    }
  }, [symbol, enabled, fetchSessionFacts, handleData, handleError]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    sessionFacts,
    loading,
    error,
    refresh: load,
  };
}