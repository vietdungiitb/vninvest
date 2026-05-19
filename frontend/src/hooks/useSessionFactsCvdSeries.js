import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSessionFactsCvd } from '../api/client';
import { isRequestCanceled } from '../utils/requestCancellation';
import { mapSessionFactsWindowFromAnalyticsTimeframe } from '../utils/sessionFactsFlowAdapter';

function normalizeTradeDate(value) {
  const normalizedValue = String(value || '').trim();
  return normalizedValue || null;
}

function getHttpStatus(errorLike) {
  const status = Number(errorLike?.response?.status);
  return Number.isFinite(status) ? status : null;
}

function buildMissingCacheKey(symbol, window, tradeDate) {
  return [String(symbol || '').trim().toUpperCase(), String(window || '').trim().toLowerCase(), normalizeTradeDate(tradeDate) || 'latest'].join('|');
}

export default function useSessionFactsCvdSeries(symbol, flowTimeframe, {
  selectedTradeDate = null,
  tradeDates = [],
} = {}) {
  const requestIdRef = useRef(0);
  const missingKeyCacheRef = useRef(new Set());
  const [payloads, setPayloads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const normalizedSymbol = String(symbol || '').trim().toUpperCase();
  const sessionFactsWindow = useMemo(
    () => mapSessionFactsWindowFromAnalyticsTimeframe(flowTimeframe),
    [flowTimeframe],
  );
  const normalizedSelectedTradeDate = useMemo(
    () => normalizeTradeDate(selectedTradeDate),
    [selectedTradeDate],
  );
  const normalizedInputTradeDatesKey = useMemo(() => {
    const normalizedValues = (Array.isArray(tradeDates) ? tradeDates : [])
      .map((value) => normalizeTradeDate(value))
      .filter(Boolean)
      .sort();

    return normalizedValues.join('|');
  }, [tradeDates]);
  const normalizedTradeDates = useMemo(() => {
    const uniqueTradeDates = new Set(
      normalizedInputTradeDatesKey ? normalizedInputTradeDatesKey.split('|') : [],
    );

    if (normalizedSelectedTradeDate) {
      uniqueTradeDates.add(normalizedSelectedTradeDate);
    }

    return Array.from(uniqueTradeDates).sort();
  }, [normalizedInputTradeDatesKey, normalizedSelectedTradeDate]);

  const fetchPayloads = useCallback(async () => {
    if (!normalizedSymbol) {
      setPayloads([]);
      setError(null);
      setLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const requestedTradeDates = normalizedTradeDates.length ? normalizedTradeDates : [normalizedSelectedTradeDate || null];
      const pendingTradeDates = requestedTradeDates.filter((tradeDate) => !missingKeyCacheRef.current.has(buildMissingCacheKey(normalizedSymbol, sessionFactsWindow, tradeDate)));
      if (!pendingTradeDates.length) {
        setPayloads([]);
        setLoading(false);
        return;
      }

      const responses = await Promise.allSettled(
        pendingTradeDates.map((tradeDate) => getSessionFactsCvd(normalizedSymbol, sessionFactsWindow, tradeDate)),
      );

      if (requestId !== requestIdRef.current) {
        return;
      }

      const successfulPayloads = responses
        .filter((response) => response.status === 'fulfilled')
        .map((response) => response.value?.data || null)
        .filter((payload) => Array.isArray(payload?.cvd_series));
      const rejectedResponses = responses.filter((response) => response.status === 'rejected');

      rejectedResponses.forEach((response, index) => {
        const status = getHttpStatus(response?.reason);
        if (status === 404) {
          missingKeyCacheRef.current.add(buildMissingCacheKey(normalizedSymbol, sessionFactsWindow, pendingTradeDates[index] || null));
        }
      });

      const rejectedResponse = rejectedResponses.find((response) => getHttpStatus(response?.reason) !== 404);

      setPayloads(successfulPayloads);
      if (!successfulPayloads.length && rejectedResponse?.reason) {
        setError(rejectedResponse.reason);
      }
    } catch (err) {
      if (requestId !== requestIdRef.current || isRequestCanceled(err)) {
        return;
      }
      setPayloads([]);
      setError(err);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [normalizedSelectedTradeDate, normalizedSymbol, normalizedTradeDates, sessionFactsWindow]);

  useEffect(() => {
    fetchPayloads();
  }, [fetchPayloads]);

  return {
    payloads,
    loading,
    error,
    sessionFactsWindow,
    refetch: fetchPayloads,
  };
}