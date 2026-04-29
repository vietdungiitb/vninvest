import { toCanonicalMinute } from './whaleTimeAdapter';

function toFiniteNumber(value, fallback = null) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function clamp(value, lower, upper) {
  return Math.max(lower, Math.min(upper, Number(value)));
}

function percentileValue(values, quantile = 0.95) {
  const numericValues = values
    .map((value) => toFiniteNumber(value, null))
    .filter((value) => value != null)
    .sort((left, right) => left - right);

  if (!numericValues.length) {
    return 0;
  }

  const safeQuantile = clamp(quantile, 0, 1);
  const index = Math.max(0, Math.min(numericValues.length - 1, Math.ceil(safeQuantile * numericValues.length) - 1));
  return numericValues[index];
}

function percentileRank(values, target) {
  const numericTarget = toFiniteNumber(target, null);
  const numericValues = values
    .map((value) => toFiniteNumber(value, null))
    .filter((value) => value != null)
    .sort((left, right) => left - right);

  if (numericTarget == null || !numericValues.length) {
    return 0;
  }

  const lastIndex = numericValues.reduce((accumulator, value, index) => {
    if (value <= numericTarget) {
      return index;
    }
    return accumulator;
  }, -1);

  if (lastIndex < 0) {
    return 0;
  }

  if (numericValues.length === 1) {
    return 1;
  }

  return lastIndex / (numericValues.length - 1);
}

function resolveMinuteKey(item) {
  const minute = toCanonicalMinute(item?.ts ?? item?.bucket_ts ?? item?.timestamp ?? item?.time ?? item?.date);
  return minute == null ? null : String(minute);
}

function resolveBucketTimestamp(item) {
  return item?.bucket_ts ?? item?.ts ?? item?.timestamp ?? item?.time ?? item?.date ?? null;
}

function buildLookup(series, serializer) {
  const lookup = new Map();
  (Array.isArray(series) ? series : []).forEach((item) => {
    const minuteKey = resolveMinuteKey(item);
    if (minuteKey == null) {
      return;
    }
    lookup.set(minuteKey, serializer(item, Number(minuteKey)));
  });
  return lookup;
}

function buildFallbackFlowCompareSeries({ flowCompareSeries, cvdSeries, strengthSeries, institutionalStrengthSeries }) {
  if (Array.isArray(flowCompareSeries) && flowCompareSeries.length) {
    return flowCompareSeries;
  }

  const cvdLookup = new Map();
  const strengthLookup = new Map();
  const institutionalLookup = new Map();

  (Array.isArray(cvdSeries) ? cvdSeries : []).forEach((item) => {
    const minuteKey = resolveMinuteKey(item);
    if (minuteKey == null) {
      return;
    }
    cvdLookup.set(minuteKey, {
      ts: Number(minuteKey),
      bucket_ts: resolveBucketTimestamp(item),
      cvd_raw: toFiniteNumber(item?.cvd ?? item?.cumulative_cvd ?? item?.value, 0),
    });
  });

  (Array.isArray(strengthSeries) ? strengthSeries : []).forEach((item) => {
    const minuteKey = resolveMinuteKey(item);
    if (minuteKey == null) {
      return;
    }
    strengthLookup.set(minuteKey, toFiniteNumber(item?.strength ?? item?.value, 0));
  });

  (Array.isArray(institutionalStrengthSeries) ? institutionalStrengthSeries : []).forEach((item) => {
    const minuteKey = resolveMinuteKey(item);
    if (minuteKey == null) {
      return;
    }
    institutionalLookup.set(minuteKey, toFiniteNumber(item?.strength ?? item?.value, 0));
  });

  const bucketKeys = Array.from(new Set([
    ...cvdLookup.keys(),
    ...strengthLookup.keys(),
    ...institutionalLookup.keys(),
  ])).sort((left, right) => Number(left) - Number(right));

  const cvdScale = Math.max(
    percentileValue(Array.from(cvdLookup.values()).map((item) => Math.abs(item.cvd_raw)), 0.95),
    1,
  );

  return bucketKeys.map((bucketKey) => {
    const cvdPoint = cvdLookup.get(bucketKey) || {};
    const cvdRaw = toFiniteNumber(cvdPoint.cvd_raw, 0);
    return {
      ts: cvdPoint.ts ?? Number(bucketKey),
      bucket_ts: cvdPoint.bucket_ts ?? null,
      cvd_raw: cvdRaw,
      cvd_normalized_0_100: clamp(50 + 50 * (cvdRaw / cvdScale), 0, 100),
      buy_strength: strengthLookup.get(bucketKey) ?? null,
      institutional_strength: institutionalLookup.get(bucketKey) ?? null,
      baseline: 50,
    };
  });
}

function buildFallbackMarkerSeries({ markerSeries, bubbleOrders }) {
  if (Array.isArray(markerSeries) && markerSeries.length) {
    return markerSeries;
  }

  const groupedOrders = new Map();
  (Array.isArray(bubbleOrders) ? bubbleOrders : []).forEach((item) => {
    const minuteKey = resolveMinuteKey(item);
    if (minuteKey == null) {
      return;
    }

    const current = groupedOrders.get(minuteKey) || {
      ts: Number(minuteKey),
      bucket_ts: resolveBucketTimestamp(item),
      buyValue: 0,
      sellValue: 0,
      matchedValue: 0,
      eventScore: 0,
    };
    const matchedValue = Math.abs(toFiniteNumber(item?.matched_value, 0));
    const side = String(item?.side || '').trim().toLowerCase();

    current.matchedValue += matchedValue;
    current.eventScore = Math.max(current.eventScore, toFiniteNumber(item?.event_score, 0));
    if (side === 'buy') {
      current.buyValue += matchedValue;
    } else if (side === 'sell') {
      current.sellValue += matchedValue;
    }
    groupedOrders.set(minuteKey, current);
  });

  const totals = Array.from(groupedOrders.values()).map((item) => item.matchedValue);
  const eventScores = Array.from(groupedOrders.values()).map((item) => item.eventScore);

  return Array.from(groupedOrders.values())
    .sort((left, right) => left.ts - right.ts)
    .map((item) => ({
      ts: item.ts,
      bucket_ts: item.bucket_ts,
      side: item.buyValue >= item.sellValue ? 'buy' : 'sell',
      score: clamp((0.7 * percentileRank(totals, item.matchedValue) * 100) + (0.3 * percentileRank(eventScores, item.eventScore) * 100), 0, 100),
      matched_value: item.matchedValue,
      event_score: item.eventScore,
      confidence: null,
    }));
}

export function buildWhaleFlowViewModel({
  flowCompareSeries = [],
  heatmapSeries = [],
  markerSeries = [],
  cvdSeries = [],
  strengthSeries = [],
  institutionalStrengthSeries = [],
  bubbleOrders = [],
  sessionContext = null,
  qualityFlags = null,
  tradeDate = null,
} = {}) {
  const effectiveFlowCompareSeries = buildFallbackFlowCompareSeries({
    flowCompareSeries,
    cvdSeries,
    strengthSeries,
    institutionalStrengthSeries,
  });
  const effectiveMarkerSeries = buildFallbackMarkerSeries({ markerSeries, bubbleOrders });

  const compareLookup = buildLookup(effectiveFlowCompareSeries, (item, ts) => ({
    ts,
    bucket_ts: resolveBucketTimestamp(item),
    cvdRaw: toFiniteNumber(item?.cvd_raw ?? item?.cvd ?? item?.value, null),
    cvdNormalized: toFiniteNumber(item?.cvd_normalized_0_100 ?? item?.cvd_normalized ?? item?.normalized_cvd, null),
    buyStrength: toFiniteNumber(item?.buy_strength ?? item?.strength, null),
    institutionalStrength: toFiniteNumber(item?.institutional_strength ?? item?.institutionalStrength, null),
    baseline: toFiniteNumber(item?.baseline, 50),
  }));
  const heatmapLookup = buildLookup(heatmapSeries, (item, ts) => ({
    ts,
    bucket_ts: resolveBucketTimestamp(item),
    buyHeat: toFiniteNumber(item?.buy_heat, null),
    sellHeat: toFiniteNumber(item?.sell_heat, null),
    netHeat: toFiniteNumber(item?.net_heat, null),
    whaleScore: toFiniteNumber(item?.whale_score, null),
    confidence: toFiniteNumber(item?.confidence, null),
    confidenceLabel: item?.confidence_label || null,
  }));
  const markerLookup = buildLookup(effectiveMarkerSeries, (item, ts) => ({
    ts,
    bucket_ts: resolveBucketTimestamp(item),
    markerSide: item?.side || null,
    markerScore: toFiniteNumber(item?.score, null),
    markerMatchedValue: toFiniteNumber(item?.matched_value, null),
    markerEventScore: toFiniteNumber(item?.event_score, null),
    confidence: toFiniteNumber(item?.confidence, null),
  }));

  const bucketKeys = Array.from(new Set([
    ...compareLookup.keys(),
    ...heatmapLookup.keys(),
    ...markerLookup.keys(),
  ])).sort((left, right) => Number(left) - Number(right));

  const buckets = bucketKeys.map((bucketKey) => {
    const comparePoint = compareLookup.get(bucketKey) || {};
    const heatmapPoint = heatmapLookup.get(bucketKey) || {};
    const markerPoint = markerLookup.get(bucketKey) || {};

    return {
      ts: Number(bucketKey),
      bucket_ts: comparePoint.bucket_ts || heatmapPoint.bucket_ts || markerPoint.bucket_ts || null,
      cvdRaw: comparePoint.cvdRaw ?? null,
      cvdNormalized: comparePoint.cvdNormalized ?? null,
      buyStrength: comparePoint.buyStrength ?? null,
      institutionalStrength: comparePoint.institutionalStrength ?? null,
      baseline: comparePoint.baseline ?? 50,
      buyHeat: heatmapPoint.buyHeat ?? null,
      sellHeat: heatmapPoint.sellHeat ?? null,
      netHeat: heatmapPoint.netHeat ?? null,
      whaleScore: heatmapPoint.whaleScore ?? null,
      markerSide: markerPoint.markerSide ?? null,
      markerScore: markerPoint.markerScore ?? null,
      markerMatchedValue: markerPoint.markerMatchedValue ?? null,
      markerEventScore: markerPoint.markerEventScore ?? null,
      confidence: heatmapPoint.confidence ?? markerPoint.confidence ?? null,
      confidenceLabel: heatmapPoint.confidenceLabel ?? null,
      hasFlow: compareLookup.has(bucketKey),
      hasHeatmap: heatmapLookup.has(bucketKey),
      hasMarker: markerLookup.has(bucketKey),
    };
  });

  const bucketLookup = Object.fromEntries(buckets.map((bucket) => [String(bucket.ts), bucket]));
  const hasFlowData = Boolean(qualityFlags?.has_flow_data ?? buckets.some((bucket) => bucket.hasFlow));
  const hasHeatmapData = Boolean(qualityFlags?.has_heatmap_data ?? buckets.some((bucket) => bucket.hasHeatmap));
  const resolvedTradeDate = sessionContext?.selected_trade_date || sessionContext?.default_trade_date || tradeDate || null;

  return {
    buckets,
    bucketLookup,
    sessionContext: {
      defaultTradeDate: sessionContext?.default_trade_date || tradeDate || null,
      selectedTradeDate: resolvedTradeDate,
      latestValidTradeDate: sessionContext?.latest_valid_trade_date || resolvedTradeDate,
      qualityState: sessionContext?.quality_state || (hasFlowData ? 'READY' : 'DEGRADED_FLOW_MISSING'),
    },
    qualityFlags: {
      hasFlowData,
      hasHeatmapData,
      degradedReason: qualityFlags?.degraded_reason || null,
      contractVersion: qualityFlags?.contract_version || null,
      cacheKeyVersion: qualityFlags?.cache_key_version || null,
    },
  };
}

export default buildWhaleFlowViewModel;