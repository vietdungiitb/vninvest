import React, { useMemo, useState } from 'react';
import useSessionFactsCvdSeries from '../hooks/useSessionFactsCvdSeries';
import useWhaleAnalyticsData from '../hooks/useWhaleAnalyticsData';
import { buildFactsFirstFlowData, flattenBubbleOrders } from '../utils/sessionFactsFlowAdapter';
import WhaleBubbleChart from './WhaleBubbleChart';

function toErrorMessage(errorLike) {
  if (!errorLike) {
    return null;
  }

  if (typeof errorLike === 'string') {
    return errorLike;
  }

  return errorLike?.response?.data?.error || errorLike?.message || 'Unknown error';
}

export default function FactsFirstWhaleBubbleChart({
  symbol,
  tradeDate = null,
  timeframe: controlledTimeframe = null,
  defaultTimeframe = 'session',
  onTimeframeChange,
  onSymbolChange,
  holdings = [],
  quotesBySymbol = {},
  symbolOptions = [],
  isEmbedded = false,
  selectedSymbol = '',
  syncTimestamp = null,
  onSyncHover,
  analyticsData,
  analyticsLoading,
  analyticsError,
}) {
  const resolvedSymbol = String(symbol || selectedSymbol || '').trim().toUpperCase();
  const [internalTimeframe, setInternalTimeframe] = useState(defaultTimeframe);
  const timeframe = controlledTimeframe || internalTimeframe;
  const normalizedTradeDate = tradeDate ? String(tradeDate).slice(0, 10) : null;
  const hasPrefetchedAnalyticsState = analyticsData !== undefined
    || analyticsLoading !== undefined
    || analyticsError !== undefined;
  const {
    data: fetchedAnalyticsData,
    loading: fetchedAnalyticsLoading,
    error: fetchedAnalyticsError,
  } = useWhaleAnalyticsData(resolvedSymbol, timeframe, normalizedTradeDate, {
    includeBaseline: false,
    skip: hasPrefetchedAnalyticsState,
  });
  const resolvedAnalyticsData = hasPrefetchedAnalyticsState ? analyticsData : fetchedAnalyticsData;
  const resolvedAnalyticsLoading = hasPrefetchedAnalyticsState ? analyticsLoading : fetchedAnalyticsLoading;
  const resolvedAnalyticsError = hasPrefetchedAnalyticsState ? analyticsError : fetchedAnalyticsError;
  const {
    payloads,
    loading: sessionFactsLoading,
    error: sessionFactsError,
  } = useSessionFactsCvdSeries(resolvedSymbol, timeframe, {
    selectedTradeDate: normalizedTradeDate,
    tradeDates: normalizedTradeDate ? [normalizedTradeDate] : [],
  });

  const bubbleOrdersForFlow = useMemo(
    () => flattenBubbleOrders(resolvedAnalyticsData?.bubbles?.orders),
    [resolvedAnalyticsData?.bubbles?.orders],
  );
  const factsFirstFlowData = useMemo(() => buildFactsFirstFlowData({
    baseFlowData: resolvedAnalyticsData?.flow || null,
    sessionFactPayloads: payloads,
    bubbleOrders: bubbleOrdersForFlow,
    selectedTradeDate: normalizedTradeDate,
    flowTimeframe: timeframe,
    timeframeWindow: resolvedAnalyticsData?.bubbles?.timeframe_window || resolvedAnalyticsData?.flow?.timeframe_window || null,
  }), [bubbleOrdersForFlow, normalizedTradeDate, payloads, resolvedAnalyticsData?.bubbles?.timeframe_window, resolvedAnalyticsData?.flow, timeframe]);
  const combinedError = useMemo(() => {
    if (resolvedAnalyticsError) {
      return toErrorMessage(resolvedAnalyticsError);
    }

    if (!factsFirstFlowData) {
      return toErrorMessage(sessionFactsError);
    }

    return null;
  }, [factsFirstFlowData, resolvedAnalyticsError, sessionFactsError]);
  const combinedLoading = Boolean(resolvedAnalyticsLoading) || (!factsFirstFlowData && sessionFactsLoading);

  const handleTimeframeChange = (nextTimeframe) => {
    if (!controlledTimeframe) {
      setInternalTimeframe(nextTimeframe);
    }

    if (typeof onTimeframeChange === 'function') {
      onTimeframeChange(nextTimeframe);
    }
  };

  return (
    <WhaleBubbleChart
      isControlled={true}
      externalSymbol={resolvedSymbol}
      externalTimeframe={timeframe}
      externalData={resolvedAnalyticsData?.bubbles || null}
      externalFlowData={factsFirstFlowData}
      externalLoading={combinedLoading}
      externalError={combinedError}
      onTimeframeChange={handleTimeframeChange}
      onSymbolChange={onSymbolChange || (() => {})}
      isEmbedded={isEmbedded}
      selectedSymbol={resolvedSymbol}
      quotesBySymbol={quotesBySymbol}
      holdings={holdings}
      symbolOptions={symbolOptions}
      syncTimestamp={syncTimestamp}
      onSyncHover={onSyncHover}
    />
  );
}