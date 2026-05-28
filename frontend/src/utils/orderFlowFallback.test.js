import { buildEffectiveOrderFlowData, mergeOrderFlowDataWithWhaleAnalytics } from './orderFlowFallback';

describe('orderFlowFallback', () => {
  test('uses whale analytics CVD fallback when order flow data has no buckets', () => {
    const whaleAnalyticsData = {
      bubbles: {
        symbol: 'TPB',
      },
      flow: {
        timeframe: 'session',
        timeframe_window: {
          timeframe: 'session',
        },
        cvd_series: [
          {
            ts: 1748311800,
            bucket_ts: '2026-05-27T09:10:00+07:00',
            cvd: 1200000000,
            cumulative_cvd: 1200000000,
          },
        ],
        dark_flow: {
          strength: 75,
          confidence: 'medium',
          signal_type: 'institutional_strength',
        },
        session_context: {
          selected_trade_date: '2026-05-27',
        },
      },
      materialization: {
        read_path: 'canonical_fallback',
      },
    };

    const merged = mergeOrderFlowDataWithWhaleAnalytics({
      orderFlowData: {
        symbol: 'TPB',
        cvd_series: [],
        signals: [{ id: 'signal-1' }],
      },
      whaleAnalyticsData,
      symbol: 'TPB',
      fallbackWindow: '1h',
    });

    expect(merged).toMatchObject({
      symbol: 'TPB',
      session_date: '2026-05-27',
      window: 'session',
      _cvd_source: 'whale-analytics-fallback',
      _cvd_materialization: 'canonical_fallback',
      dark_flow: {
        strength: 75,
        confidence: 'medium',
        signal_type: 'institutional_strength',
      },
    });
    expect(merged.signals).toEqual([{ id: 'signal-1' }]);
    expect(merged.cvd_series).toHaveLength(1);
    expect(merged.cvd_series[0]).toMatchObject({
      bucket_ts: '2026-05-27T09:10:00+07:00',
      cumulative_cvd: 1200000000,
    });
  });

  test('keeps existing order flow CVD when buckets are already present', () => {
    const orderFlowData = {
      symbol: 'TPB',
      cvd_series: [{ bucket_ts: 'existing', cumulative_cvd: 5 }],
      _cvd_source: 'whale-ssot',
    };

    const merged = mergeOrderFlowDataWithWhaleAnalytics({
      orderFlowData,
      whaleAnalyticsData: {
        flow: {
          cvd_series: [{ bucket_ts: 'fallback', cumulative_cvd: 10 }],
        },
      },
    });

    expect(merged).toBe(orderFlowData);
  });

  test('builds order-flow state with whale fallback when session facts cvd is empty', () => {
    const merged = buildEffectiveOrderFlowData({
      symbol: 'TPB',
      fallbackWindow: '30m',
      orderFlowPayload: {
        symbol: 'TPB',
        window: '30m',
        signals: [{ id: 'signal-1' }],
      },
      cvdPayload: {
        symbol: 'TPB',
        session_date: '2026-05-27',
        window: '30m',
        cvd_series: [],
      },
      whaleAnalyticsData: {
        materialization: { read_path: 'canonical_fallback' },
        flow: {
          cvd_series: [{ bucket_ts: '2026-05-27T09:10:00+07:00', cumulative_cvd: 1200000000 }],
        },
      },
    });

    expect(merged).toMatchObject({
      symbol: 'TPB',
      session_date: '2026-05-27',
      window: '30m',
      _cvd_source: 'whale-analytics-fallback',
      _cvd_materialization: 'canonical_fallback',
    });
    expect(merged.cvd_series).toHaveLength(1);
  });

  test('keeps session-facts cvd when it already has buckets', () => {
    const merged = buildEffectiveOrderFlowData({
      symbol: 'TPB',
      fallbackWindow: '30m',
      orderFlowPayload: {
        symbol: 'TPB',
        signals: [{ id: 'signal-1' }],
      },
      cvdPayload: {
        symbol: 'TPB',
        session_date: '2026-05-27',
        window: '30m',
        cvd_series: [{ bucket_ts: '2026-05-27T09:30:00+07:00', cumulative_cvd: 42 }],
      },
      whaleAnalyticsData: {
        flow: {
          cvd_series: [{ bucket_ts: '2026-05-27T09:10:00+07:00', cumulative_cvd: 1200000000 }],
        },
      },
    });

    expect(merged._cvd_source).toBe('whale-ssot');
    expect(merged.cvd_series).toEqual([{ bucket_ts: '2026-05-27T09:30:00+07:00', cumulative_cvd: 42 }]);
  });
});