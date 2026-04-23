import { useState, useEffect, useCallback } from 'react';
import { getDarkMoneyHistory, getWhaleOrdersBySymbol } from '../api/client';
import { isWithinMarketSession, resolveWhaleTimeframeWindow, toCanonicalMinute } from '../utils/whaleTimeAdapter';

const DARK_MONEY_INTERVAL_BY_TIMEFRAME = {
  '15m': '15m',
  '30m': '30m',
  '1h': '1h',
  morning: '15m',
  afternoon: '15m',
  session: '15m',
};

function resolveDarkMoneyRequest(timeframe) {
  const normalized = String(timeframe || 'session').trim().toLowerCase();
  return {
    period: '1M',
    interval: DARK_MONEY_INTERVAL_BY_TIMEFRAME[normalized] || '15m',
  };
}

function normalizeDarkMoneyFlow(rawFlow, timeframe) {
  const timeframeWindow = resolveWhaleTimeframeWindow(timeframe);
  const sourceSeries = Array.isArray(rawFlow?.dark_flow_series) ? rawFlow.dark_flow_series : [];
  const normalizedSeries = sourceSeries
    .map((item) => {
      const ts = toCanonicalMinute(item?.time ?? item?.ts ?? item?.bucket_ts ?? item?.date);
      if (ts == null) {
        return null;
      }

      return {
        ts,
        cvd: Number(item?.cvd ?? item?.cumulative_cvd ?? 0),
        strength: Number(item?.strength ?? 0),
        signal_type: item?.signal_type || null,
        confidence: item?.confidence || null,
      };
    })
    .filter(Boolean)
    .filter((item) => isWithinMarketSession(item.ts))
    .sort((left, right) => left.ts - right.ts);

  if (!normalizedSeries.length) {
    return {
      ...rawFlow,
      cvd_series: [],
      strength_series: [],
      dark_flow: rawFlow?.dark_flow || { strength: 0, confidence: 'low', signal_type: 'none' },
      smfi: rawFlow?.smfi ?? rawFlow?.smart_money_flow_index ?? null,
    };
  }

  let filteredSeries = normalizedSeries.filter((item) => (
    item.ts >= timeframeWindow.startEpochSec && item.ts <= timeframeWindow.endEpochSec
  ));
  // Nếu today's window rỗng nhưng có data từ phiên khác → dùng toàn bộ normalizedSeries
  if (filteredSeries.length === 0 && normalizedSeries.length > 0) {
    filteredSeries = normalizedSeries;
  }

  const latestPoint = filteredSeries[filteredSeries.length - 1] || normalizedSeries[normalizedSeries.length - 1];

  return {
    ...rawFlow,
    cvd_series: filteredSeries.map((item) => ({
      ts: item.ts,
      cvd: item.cvd,
      cumulative_cvd: item.cvd,
    })),
    strength_series: filteredSeries.map((item) => ({
      ts: item.ts,
      strength: item.strength,
    })),
    dark_flow: {
      ...(rawFlow?.dark_flow || {}),
      strength: Number(rawFlow?.dark_flow?.strength ?? latestPoint?.strength ?? 0),
      confidence: rawFlow?.dark_flow?.confidence || latestPoint?.confidence || 'low',
      signal_type: rawFlow?.dark_flow?.signal_type || latestPoint?.signal_type || 'none',
    },
    smfi: rawFlow?.smfi ?? rawFlow?.smart_money_flow_index ?? null,
    timeframe_window: timeframeWindow,
  };
}

function buildBubbleSummary(orders) {
  const buyOrders = orders.buy.length;
  const sellOrders = orders.sell.length;
  const internalOrders = orders.internal.length;
  const allOrders = [...orders.buy, ...orders.sell, ...orders.internal];
  const matchedValues = allOrders.map((item) => Number(item?.matched_value || 0)).filter((value) => Number.isFinite(value));
  const avgMatchedValue = matchedValues.length
    ? matchedValues.reduce((sum, value) => sum + value, 0) / matchedValues.length
    : 0;

  return {
    total_orders: allOrders.length,
    buy_orders: buyOrders,
    sell_orders: sellOrders,
    internal_orders: internalOrders,
    avg_matched_value: avgMatchedValue,
  };
}

function normalizeBubbleOrders(rawBubbleData, timeframe) {
  const timeframeWindow = resolveWhaleTimeframeWindow(timeframe);
  const orderGroups = rawBubbleData?.orders || {};
  const filterOrders = (items = []) => items.filter((item) => {
    const minuteTs = toCanonicalMinute(item?.ts);
    if (minuteTs == null || !isWithinMarketSession(minuteTs)) {
      return false;
    }

    return minuteTs >= timeframeWindow.startEpochSec && minuteTs <= timeframeWindow.endEpochSec;
  });

  const filteredOrders = {
    buy: filterOrders(orderGroups.buy),
    sell: filterOrders(orderGroups.sell),
    internal: filterOrders(orderGroups.internal),
  };

  return {
    ...rawBubbleData,
    orders: filteredOrders,
    summary: buildBubbleSummary(filteredOrders),
    timeframe_window: timeframeWindow,
  };
}

/**
 * useWhaleAnalyticsData Hook
 * 
 * Single source of truth for fetching Whale Bubbles and Dark Money Flow data.
 * Ensures synchronized parallel loading for both sub-charts.
 */
export default function useWhaleAnalyticsData(symbol, timeframe) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState({
    bubbles: null,
    flow: null,
  });

  const fetchData = useCallback(async ({ silent = false } = {}) => {
    if (!symbol) {
      setData({ bubbles: null, flow: null });
      return;
    }

    if (!silent) {
      setLoading(true);
      setError(null);
    }

    try {
      const darkMoneyRequest = resolveDarkMoneyRequest(timeframe);
      const [bubblesRes, flowRes] = await Promise.all([
        getWhaleOrdersBySymbol(symbol, { timeframe: 'session' }),
        getDarkMoneyHistory(symbol, darkMoneyRequest),
      ]);

      const bubblesData = bubblesRes?.data;
      const flowData = flowRes?.data;

      if (bubblesData?.ok && flowData) {
        setData({
          bubbles: normalizeBubbleOrders(bubblesData, timeframe),
          flow: normalizeDarkMoneyFlow(flowData, timeframe),
        });
      } else {
        throw new Error(bubblesData?.error || 'Failed to fetch valid analytics data');
      }
    } catch (err) {
      console.error('[useWhaleAnalyticsData] Error:', err);
      if (!silent) {
        setError(err.response?.data?.error || err.message || 'Unknown error fetching analytics');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [symbol, timeframe]);

  useEffect(() => {
    fetchData({ silent: false });
  }, [fetchData]);

  useEffect(() => {
    const timeframeWindow = resolveWhaleTimeframeWindow(timeframe);
    if (!timeframeWindow.isLive) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      fetchData({ silent: true });
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [fetchData, timeframe]);

  return { 
    loading, 
    error, 
    data, 
    refetch: fetchData 
  };
}
