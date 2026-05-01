import {
  buildAutoFocusZoomScales,
  buildWhaleAnalyticsBucketMinuteKeys,
  mapChartTimeframeToWhaleAnalyticsTimeframe,
  normalizeTradeDateKey,
  resolveChartTimeframeMinutes,
  resolveChartHistoryTradeDates,
  resolveFlowBucketForCandle,
  resolveMatchingWhaleCandleMinuteKey,
  resolveTradeDateIndexRange,
  resolveWhaleAnalyticsBucketMinutes,
} from './whaleKlineAlignment';

describe('whaleKlineAlignment', () => {
  it('maps chart timeframes onto the full selected-session whale snapshot truth', () => {
    expect(mapChartTimeframeToWhaleAnalyticsTimeframe('1m')).toBe('session');
    expect(mapChartTimeframeToWhaleAnalyticsTimeframe('5m')).toBe('session');
    expect(mapChartTimeframeToWhaleAnalyticsTimeframe('15m')).toBe('session');
    expect(mapChartTimeframeToWhaleAnalyticsTimeframe('1H')).toBe('session');
    expect(mapChartTimeframeToWhaleAnalyticsTimeframe('2H')).toBe('session');
    expect(mapChartTimeframeToWhaleAnalyticsTimeframe('D')).toBe('session');
  });

  it('resolves the effective analytics bucket size used for KLine projection', () => {
    expect(resolveWhaleAnalyticsBucketMinutes('15m')).toBe(15);
    expect(resolveWhaleAnalyticsBucketMinutes('session')).toBe(15);
    expect(resolveWhaleAnalyticsBucketMinutes('30m')).toBe(30);
    expect(resolveWhaleAnalyticsBucketMinutes('1h')).toBe(60);
  });

  it('resolves chart timeframe sizes for bucket projection', () => {
    expect(resolveChartTimeframeMinutes('1m')).toBe(1);
    expect(resolveChartTimeframeMinutes('1H')).toBe(60);
    expect(resolveChartTimeframeMinutes('D')).toBe(1440);
  });

  it('expands bucket keys across the supported projection window', () => {
    expect(buildWhaleAnalyticsBucketMinuteKeys(1714381200, '15m')).toHaveLength(15);
    expect(buildWhaleAnalyticsBucketMinuteKeys(1714381200, '1h')).toHaveLength(60);
    expect(buildWhaleAnalyticsBucketMinuteKeys(null, '15m')).toEqual([]);
  });

  it('finds the representative candle minute inside a projected analytics bucket', () => {
    const candleMinuteKeys = new Set(['1714381800', '1714382100']);

    expect(resolveMatchingWhaleCandleMinuteKey(1714381200, candleMinuteKeys, '15m')).toBe('1714381800');
    expect(resolveMatchingWhaleCandleMinuteKey(1714381200, new Set(), '15m')).toBe(null);
  });

  it('projects flow buckets into larger chart candles using the latest bucket inside the candle window', () => {
    const buckets = [
      { bucket_ts: '2026-04-29T09:15:00+07:00', cvdNormalized: 46.49 },
      { bucket_ts: '2026-04-29T09:30:00+07:00', cvdNormalized: 41.06 },
      { bucket_ts: '2026-04-29T09:45:00+07:00', cvdNormalized: 46.44 },
      { bucket_ts: '2026-04-29T14:15:00+07:00', cvdNormalized: 0.99 },
      { bucket_ts: '2026-04-29T14:45:00+07:00', cvdNormalized: 33.93 },
    ];

    expect(resolveFlowBucketForCandle('2026-04-29T09:00:00', buckets, '1H', 'session')).toEqual(buckets[2]);
    expect(resolveFlowBucketForCandle('2026-04-29T14:00:00', buckets, '1H', 'session')).toEqual(buckets[4]);
    expect(resolveFlowBucketForCandle('2026-04-29T13:00:00', buckets, '1H', 'session')).toBe(null);
  });

  it('maps smaller candles back to the containing flow bucket window', () => {
    const buckets = [
      { bucket_ts: '2026-04-29T09:15:00+07:00', buyStrength: 50 },
      { bucket_ts: '2026-04-29T09:30:00+07:00', buyStrength: 51.87 },
    ];

    expect(resolveFlowBucketForCandle('2026-04-29T09:19:00', buckets, '5m', 'session')).toEqual(buckets[0]);
    expect(resolveFlowBucketForCandle('2026-04-29T09:34:00', buckets, '5m', 'session')).toEqual(buckets[1]);
  });

  it('normalizes trade dates into Vietnam session keys', () => {
    expect(normalizeTradeDateKey('2026-04-29T09:15:00+07:00')).toBe('2026-04-29');
    expect(normalizeTradeDateKey(1777428900)).toBe('2026-04-29');
    expect(normalizeTradeDateKey(null)).toBe(null);
  });

  it('resolves the candle index range for a selected trade date', () => {
    const candles = [
      { date: '2026-04-28T14:45:00' },
      { date: '2026-04-29T09:15:00' },
      { date: '2026-04-29T09:30:00' },
      { date: '2026-04-29T14:45:00' },
      { date: '2026-04-30T09:15:00' },
    ];

    expect(resolveTradeDateIndexRange(candles, '2026-04-29')).toEqual({
      tradeDate: '2026-04-29',
      firstIndex: 1,
      lastIndex: 3,
      centerIndex: 2,
      count: 3,
    });
    expect(resolveTradeDateIndexRange(candles, '2026-05-01')).toBe(null);
  });

  it('resolves chart history trade dates from the visible range while keeping a recent fallback', () => {
    const chartData = [
      { date: '2026-04-25T09:00:00' },
      { date: '2026-04-25T10:00:00' },
      { date: '2026-04-28T09:00:00' },
      { date: '2026-04-28T10:00:00' },
      { date: '2026-04-29T09:00:00' },
      { date: '2026-04-29T10:00:00' },
    ];

    expect(resolveChartHistoryTradeDates(chartData, {
      from_ts: new Date('2026-04-28T08:55:00').getTime(),
      to_ts: new Date('2026-04-29T10:05:00').getTime(),
    })).toEqual(['2026-04-28', '2026-04-29']);

    expect(resolveChartHistoryTradeDates(chartData, null, 2, 8)).toEqual(['2026-04-28', '2026-04-29']);
  });

  it('builds bounded zoom-in steps for session auto-focus', () => {
    expect(buildAutoFocusZoomScales(672, 22)).toEqual([2, 2, 2, 2, 1.91]);
    expect(buildAutoFocusZoomScales(18, 22)).toEqual([]);
  });
});