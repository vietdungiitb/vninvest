import { resolveWhaleTimeframeWindow, toCanonicalMinute } from './whaleTimeAdapter';
import { buildWhaleFlowViewModel } from './whaleFlowViewModel';

function toFiniteNumber(value, fallback = null) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function resolveSeriesMinute(item) {
  return toCanonicalMinute(item?.ts ?? item?.bucket_ts ?? item?.timestamp ?? item?.time ?? item?.date);
}

function sortSeriesByTime(series) {
  return [...series].sort((left, right) => {
    const leftTs = resolveSeriesMinute(left) ?? 0;
    const rightTs = resolveSeriesMinute(right) ?? 0;
    return leftTs - rightTs;
  });
}

function mergeSeriesByKey(seriesList, keyResolver) {
  const lookup = new Map();
  (Array.isArray(seriesList) ? seriesList : []).flat().forEach((item) => {
    const key = keyResolver(item);
    if (!key) {
      return;
    }
    lookup.set(key, item);
  });
  return sortSeriesByTime(Array.from(lookup.values()));
}

function filterSeriesByTimeframeWindow(series, timeframeWindow) {
  const startMs = Number(timeframeWindow?.startMs);
  const endMs = Number(timeframeWindow?.endMs);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return Array.isArray(series) ? [...series] : [];
  }

  const lowerBound = Math.min(startMs, endMs);
  const upperBound = Math.max(startMs, endMs);

  return (Array.isArray(series) ? series : []).filter((item) => {
    const minute = resolveSeriesMinute(item);
    if (minute == null) {
      return false;
    }
    const timestampMs = minute * 1000;
    return timestampMs >= lowerBound && timestampMs <= upperBound;
  });
}

function normalizeSessionFactsSeriesItem(item) {
  const minute = resolveSeriesMinute(item);
  const cumulativeCvd = toFiniteNumber(item?.cumulative_cvd ?? item?.cvd ?? item?.value, null);
  if (minute == null || cumulativeCvd == null) {
    return null;
  }

  return {
    ts: minute,
    bucket_ts: item?.bucket_ts ?? item?.ts ?? null,
    cvd_raw: cumulativeCvd,
    buy_strength: toFiniteNumber(item?.buy_strength, null),
    institutional_strength: toFiniteNumber(item?.institutional_strength, null),
    baseline: 50,
  };
}

function normalizeTimeframeWindow(series, timeframe, explicitWindow = null) {
  const fallbackWindow = explicitWindow
    ? {
      ...explicitWindow,
      timeframe: explicitWindow?.timeframe || timeframe,
    }
    : null;

  const timestampsMs = (Array.isArray(series) ? series : [])
    .map((item) => resolveSeriesMinute(item))
    .filter((minute) => minute != null)
    .map((minute) => minute * 1000);

  if (!timestampsMs.length) {
    if (fallbackWindow) {
      return fallbackWindow;
    }

    return resolveWhaleTimeframeWindow(timeframe);
  }

  const referenceDate = new Date(timestampsMs[timestampsMs.length - 1]);
  const derivedWindow = resolveWhaleTimeframeWindow(timeframe, referenceDate);
  const explicitStartMs = Number(fallbackWindow?.startMs);
  const explicitEndMs = Number(fallbackWindow?.endMs);
  const startMs = Number.isFinite(explicitStartMs) ? explicitStartMs : Math.min(...timestampsMs);
  const endMs = Number.isFinite(explicitEndMs) ? explicitEndMs : Math.max(...timestampsMs);

  return {
    ...(fallbackWindow || derivedWindow),
    timeframe,
    startMs,
    endMs,
    startEpochSec: Math.floor(startMs / 1000),
    endEpochSec: Math.floor(endMs / 1000),
  };
}

export function flattenBubbleOrders(orders) {
  return orders
    ? [
      ...(Array.isArray(orders.buy) ? orders.buy : []),
      ...(Array.isArray(orders.sell) ? orders.sell : []),
      ...(Array.isArray(orders.internal) ? orders.internal : []),
    ]
    : [];
}

export function mapSessionFactsWindowFromAnalyticsTimeframe(timeframe) {
  const normalizedTimeframe = String(timeframe || 'session').trim().toLowerCase();
  if (normalizedTimeframe === '5m' || normalizedTimeframe === '15m' || normalizedTimeframe === '30m' || normalizedTimeframe === '1h') {
    return normalizedTimeframe;
  }
  return '15m';
}

export function buildFactsFirstFlowData({
  baseFlowData = null,
  sessionFactPayloads = [],
  bubbleOrders = [],
  selectedTradeDate = null,
  flowTimeframe = 'session',
  timeframeWindow = null,
} = {}) {
  const factsFirstFlowCompareSeries = mergeSeriesByKey(
    (Array.isArray(sessionFactPayloads) ? sessionFactPayloads : []).map((payload) => (
      Array.isArray(payload?.cvd_series)
        ? payload.cvd_series.map((item) => normalizeSessionFactsSeriesItem(item)).filter(Boolean)
        : []
    )),
    (item) => {
      const minute = resolveSeriesMinute(item);
      return minute == null ? null : String(minute);
    },
  );

  const filteredFlowCompareSeries = filterSeriesByTimeframeWindow(factsFirstFlowCompareSeries, timeframeWindow);
  if (!filteredFlowCompareSeries.length) {
    return baseFlowData || null;
  }

  const filteredHeatmapSeries = filterSeriesByTimeframeWindow(baseFlowData?.heatmap_series || [], timeframeWindow);
  const filteredMarkerSeries = filterSeriesByTimeframeWindow(baseFlowData?.marker_series || [], timeframeWindow);
  const filteredSpeedSeries = filterSeriesByTimeframeWindow(baseFlowData?.speed_series || [], timeframeWindow);
  const sessionDates = (Array.isArray(sessionFactPayloads) ? sessionFactPayloads : [])
    .map((payload) => String(payload?.session_date || '').trim())
    .filter(Boolean)
    .sort();
  const latestSessionDate = sessionDates[sessionDates.length - 1]
    || selectedTradeDate
    || baseFlowData?.session_context?.default_trade_date
    || null;
  const sessionContext = {
    ...(baseFlowData?.session_context || {}),
    default_trade_date: latestSessionDate,
    selected_trade_date: selectedTradeDate || latestSessionDate,
    latest_valid_trade_date: latestSessionDate,
    quality_state: baseFlowData?.session_context?.quality_state || 'READY',
  };
  const qualityFlags = {
    ...(baseFlowData?.quality_flags || {}),
    has_flow_data: true,
  };
  const normalizedTimeframeWindow = normalizeTimeframeWindow(
    filteredFlowCompareSeries,
    flowTimeframe,
    timeframeWindow || baseFlowData?.timeframe_window || null,
  );
  const cvdSeries = filteredFlowCompareSeries.map((item) => ({
    ts: item.ts,
    bucket_ts: item.bucket_ts,
    cvd: item.cvd_raw,
    cumulative_cvd: item.cvd_raw,
  }));
  const strengthSeries = filteredFlowCompareSeries.map((item) => ({
    ts: item.ts,
    bucket_ts: item.bucket_ts,
    strength: item.buy_strength,
  }));
  const institutionalStrengthSeries = filteredFlowCompareSeries.map((item) => ({
    ts: item.ts,
    bucket_ts: item.bucket_ts,
    strength: item.institutional_strength,
  }));
  const flowViewModel = buildWhaleFlowViewModel({
    flowCompareSeries: filteredFlowCompareSeries,
    heatmapSeries: filteredHeatmapSeries,
    markerSeries: filteredMarkerSeries,
    bubbleOrders,
    sessionContext,
    qualityFlags,
    tradeDate: sessionContext.selected_trade_date || sessionContext.default_trade_date || latestSessionDate,
  });

  return {
    ...(baseFlowData || {}),
    timeframe: flowTimeframe,
    timeframe_window: normalizedTimeframeWindow,
    cvd_series: cvdSeries,
    strength_series: strengthSeries,
    institutional_strength_series: institutionalStrengthSeries,
    speed_series: filteredSpeedSeries,
    flow_compare_series: filteredFlowCompareSeries,
    heatmap_series: filteredHeatmapSeries,
    marker_series: filteredMarkerSeries,
    session_context: sessionContext,
    quality_flags: qualityFlags,
    view_model: flowViewModel,
  };
}