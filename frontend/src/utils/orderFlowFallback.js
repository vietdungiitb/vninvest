function hasSeriesData(series) {
  return Array.isArray(series) && series.length > 0;
}

function hasObjectContent(value) {
  return Boolean(value) && typeof value === 'object' && Object.keys(value).length > 0;
}

function resolveFallbackTradeDate(whaleAnalyticsData, fallbackFlow) {
  const sessionContext = fallbackFlow?.session_context || fallbackFlow?.view_model?.sessionContext || null;

  return sessionContext?.selected_trade_date
    || sessionContext?.default_trade_date
    || sessionContext?.selectedTradeDate
    || sessionContext?.defaultTradeDate
    || whaleAnalyticsData?.session_summary?.selected_trade_date
    || null;
}

function buildBaseOrderFlowData({
  orderFlowPayload = null,
  cvdPayload = null,
  symbol = null,
  fallbackWindow = null,
} = {}) {
  if (!orderFlowPayload && !cvdPayload) {
    return null;
  }

  return {
    ...(orderFlowPayload || {}),
    symbol: symbol || orderFlowPayload?.symbol || cvdPayload?.symbol || null,
    session_date: cvdPayload?.session_date ?? orderFlowPayload?.session_date ?? null,
    window: cvdPayload?.window ?? orderFlowPayload?.window ?? fallbackWindow,
    bucket_minutes: cvdPayload?.bucket_minutes ?? orderFlowPayload?.bucket_minutes ?? null,
    cvd_normalized: cvdPayload?.cvd_normalized ?? orderFlowPayload?.cvd_normalized ?? null,
    delta_strength_pct: cvdPayload?.delta_strength_pct ?? orderFlowPayload?.delta_strength_pct ?? null,
    whale_net_flow: cvdPayload?.whale_net_flow ?? orderFlowPayload?.whale_net_flow ?? null,
    cvd_series: cvdPayload?.cvd_series ?? orderFlowPayload?.cvd_series ?? [],
    _cvd_source: cvdPayload ? 'whale-ssot' : 'intraday-tick',
  };
}

export function mergeOrderFlowDataWithWhaleAnalytics({
  orderFlowData = null,
  whaleAnalyticsData = null,
  symbol = null,
  fallbackWindow = null,
} = {}) {
  const fallbackFlow = whaleAnalyticsData?.flow || null;
  const fallbackCvdSeries = Array.isArray(fallbackFlow?.cvd_series) ? fallbackFlow.cvd_series : [];

  if (hasSeriesData(orderFlowData?.cvd_series) || !hasSeriesData(fallbackCvdSeries)) {
    return orderFlowData;
  }

  const fallbackTradeDate = resolveFallbackTradeDate(whaleAnalyticsData, fallbackFlow);
  const fallbackDarkFlow = hasObjectContent(orderFlowData?.dark_flow)
    ? orderFlowData.dark_flow
    : (fallbackFlow?.dark_flow || null);

  return {
    ...(orderFlowData || {}),
    symbol: orderFlowData?.symbol || symbol || whaleAnalyticsData?.bubbles?.symbol || null,
    session_date: orderFlowData?.session_date ?? fallbackTradeDate,
    window: orderFlowData?.window ?? fallbackFlow?.timeframe_window?.timeframe ?? fallbackFlow?.timeframe ?? fallbackWindow,
    cvd_series: fallbackCvdSeries,
    dark_flow: fallbackDarkFlow,
    _cvd_source: 'whale-analytics-fallback',
    _cvd_materialization: whaleAnalyticsData?.materialization?.read_path || null,
  };
}

export function buildEffectiveOrderFlowData({
  orderFlowPayload = null,
  cvdPayload = null,
  whaleAnalyticsData = null,
  symbol = null,
  fallbackWindow = null,
} = {}) {
  const orderFlowData = buildBaseOrderFlowData({
    orderFlowPayload,
    cvdPayload,
    symbol,
    fallbackWindow,
  });

  return mergeOrderFlowDataWithWhaleAnalytics({
    orderFlowData,
    whaleAnalyticsData,
    symbol,
    fallbackWindow,
  });
}

export default mergeOrderFlowDataWithWhaleAnalytics;