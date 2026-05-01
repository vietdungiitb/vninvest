import { toCanonicalMinute } from './whaleTimeAdapter';

const ANALYTICS_TIMEFRAME_BY_CHART_TIMEFRAME = {
  '1m': 'session',
  '5m': 'session',
  '15m': 'session',
  '1h': 'session',
  '2h': 'session',
  '4h': 'session',
  d: 'session',
  w: 'session',
  m: 'session',
  y: 'session',
};

const CHART_TIMEFRAME_MINUTES = {
  '1m': 1,
  '5m': 5,
  '15m': 15,
  '30m': 30,
  '1h': 60,
  '2h': 120,
  '4h': 240,
  d: 1440,
  w: 10080,
  m: 43200,
  y: 525600,
};

export function normalizeTradeDateKey(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const numericValue = Number(value);
  const parsed = new Date(
    Number.isFinite(numericValue)
      ? (numericValue < 1e11 ? numericValue * 1000 : numericValue)
      : value,
  );
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

export function mapChartTimeframeToWhaleAnalyticsTimeframe(timeframe) {
  const normalized = String(timeframe || '1H').trim().toLowerCase();
  return ANALYTICS_TIMEFRAME_BY_CHART_TIMEFRAME[normalized] || 'session';
}

export function resolveWhaleAnalyticsBucketMinutes(timeframe) {
  const normalized = String(timeframe || 'session').trim().toLowerCase();
  if (normalized === '30m') {
    return 30;
  }
  if (normalized === '1h') {
    return 60;
  }
  return 15;
}

export function resolveChartTimeframeMinutes(timeframe) {
  const normalized = String(timeframe || '1H').trim().toLowerCase();
  return CHART_TIMEFRAME_MINUTES[normalized] || 60;
}

export function buildWhaleAnalyticsBucketMinuteKeys(bucketMinuteKey, timeframe) {
  if (bucketMinuteKey === null || bucketMinuteKey === undefined) {
    return [];
  }

  const startMinute = Number(bucketMinuteKey);
  if (!Number.isFinite(startMinute)) {
    return [];
  }

  const bucketMinutes = resolveWhaleAnalyticsBucketMinutes(timeframe);
  return Array.from({ length: bucketMinutes }, (_, index) => String(startMinute + (index * 60)));
}

export function resolveMatchingWhaleCandleMinuteKey(bucketMinuteKey, candleMinuteKeys, timeframe) {
  if (!(candleMinuteKeys instanceof Set) || !candleMinuteKeys.size) {
    return null;
  }

  const candidateKeys = buildWhaleAnalyticsBucketMinuteKeys(bucketMinuteKey, timeframe);
  return candidateKeys.find((candidateKey) => candleMinuteKeys.has(candidateKey)) || null;
}

export function resolveFlowBucketForCandle(candleTimestamp, buckets, chartTimeframe, flowTimeframe) {
  const candleMinuteKey = toCanonicalMinute(candleTimestamp);
  if (candleMinuteKey == null || !Array.isArray(buckets) || !buckets.length) {
    return null;
  }

  const chartMinutes = resolveChartTimeframeMinutes(chartTimeframe);
  const flowBucketMinutes = resolveWhaleAnalyticsBucketMinutes(flowTimeframe);

  if (chartMinutes <= flowBucketMinutes) {
    return buckets.find((bucket) => {
      const bucketMinuteKey = toCanonicalMinute(bucket?.ts ?? bucket?.bucket_ts ?? bucket?.timestamp ?? bucket?.time ?? bucket?.date);
      return bucketMinuteKey != null
        && candleMinuteKey >= bucketMinuteKey
        && candleMinuteKey < bucketMinuteKey + (flowBucketMinutes * 60);
    }) || null;
  }

  const candleEndExclusive = candleMinuteKey + (chartMinutes * 60);
  let matchedBucket = null;
  let matchedBucketMinuteKey = null;

  buckets.forEach((bucket) => {
    const bucketMinuteKey = toCanonicalMinute(bucket?.ts ?? bucket?.bucket_ts ?? bucket?.timestamp ?? bucket?.time ?? bucket?.date);
    if (bucketMinuteKey == null || bucketMinuteKey < candleMinuteKey || bucketMinuteKey >= candleEndExclusive) {
      return;
    }

    if (matchedBucket == null || bucketMinuteKey >= matchedBucketMinuteKey) {
      matchedBucket = bucket;
      matchedBucketMinuteKey = bucketMinuteKey;
    }
  });

  return matchedBucket;
}

export function resolveTradeDateIndexRange(candles, tradeDate) {
  const normalizedTradeDate = normalizeTradeDateKey(tradeDate);
  if (!normalizedTradeDate || !Array.isArray(candles) || !candles.length) {
    return null;
  }

  let firstIndex = null;
  let lastIndex = null;

  candles.forEach((candle, index) => {
    const candleTradeDate = normalizeTradeDateKey(candle?.tradeDate ?? candle?.date ?? candle?.timestamp);
    if (candleTradeDate !== normalizedTradeDate) {
      return;
    }

    if (firstIndex == null) {
      firstIndex = index;
    }
    lastIndex = index;
  });

  if (firstIndex == null || lastIndex == null) {
    return null;
  }

  const count = lastIndex - firstIndex + 1;
  return {
    tradeDate: normalizedTradeDate,
    firstIndex,
    lastIndex,
    centerIndex: firstIndex + Math.floor((count - 1) / 2),
    count,
  };
}

export function resolveChartHistoryTradeDates(chartData, visibleRange = null, minimumTradeDates = 2, maxTradeDates = 8) {
  if (!Array.isArray(chartData) || !chartData.length) {
    return [];
  }

  const normalizedMinimum = Math.max(1, Number(minimumTradeDates) || 0);
  const normalizedMaximum = Math.max(normalizedMinimum, Number(maxTradeDates) || normalizedMinimum);
  const visibleFrom = Number(visibleRange?.from_ts);
  const visibleTo = Number(visibleRange?.to_ts);
  const hasVisibleRange = Number.isFinite(visibleFrom) && Number.isFinite(visibleTo);
  const minVisibleTs = hasVisibleRange ? Math.min(visibleFrom, visibleTo) : null;
  const maxVisibleTs = hasVisibleRange ? Math.max(visibleFrom, visibleTo) : null;

  const allTradeDates = [];
  const visibleTradeDates = [];

  chartData.forEach((point) => {
    const pointTimestamp = Number(point?.timestamp ?? (point?.date ? new Date(point.date).getTime() : NaN));
    const pointTradeDate = normalizeTradeDateKey(point?.tradeDate ?? point?.date ?? pointTimestamp);
    if (!pointTradeDate) {
      return;
    }

    allTradeDates.push(pointTradeDate);
    if (minVisibleTs != null && maxVisibleTs != null && Number.isFinite(pointTimestamp) && pointTimestamp >= minVisibleTs && pointTimestamp <= maxVisibleTs) {
      visibleTradeDates.push(pointTradeDate);
    }
  });

  const recentTradeDates = Array.from(new Set(allTradeDates)).slice(-normalizedMinimum);
  const effectiveVisibleTradeDates = Array.from(new Set(visibleTradeDates));
  const mergedTradeDates = Array.from(new Set([...effectiveVisibleTradeDates, ...recentTradeDates]));

  return mergedTradeDates.slice(-normalizedMaximum);
}

export function buildAutoFocusZoomScales(visibleBarCount, targetVisibleBarCount, maxSteps = 6) {
  const normalizedVisibleBarCount = Math.max(1, Number(visibleBarCount) || 0);
  const normalizedTargetVisibleBarCount = Math.max(1, Number(targetVisibleBarCount) || 0);
  if (!Number.isFinite(normalizedVisibleBarCount) || !Number.isFinite(normalizedTargetVisibleBarCount)) {
    return [];
  }

  const scales = [];
  let estimatedVisibleBarCount = normalizedVisibleBarCount;
  let step = 0;

  while (estimatedVisibleBarCount > normalizedTargetVisibleBarCount * 1.15 && step < maxSteps) {
    const nextScale = Math.min(2, Math.max(1.1, estimatedVisibleBarCount / normalizedTargetVisibleBarCount));
    scales.push(Number(nextScale.toFixed(2)));
    estimatedVisibleBarCount = Math.max(
      normalizedTargetVisibleBarCount,
      Math.floor(estimatedVisibleBarCount / nextScale),
    );
    step += 1;
  }

  return scales;
}