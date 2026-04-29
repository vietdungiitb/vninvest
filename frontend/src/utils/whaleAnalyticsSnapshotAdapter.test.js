import { normalizeWhaleAnalyticsSnapshot } from './whaleAnalyticsSnapshotAdapter';

describe('whaleAnalyticsSnapshotAdapter', () => {
  test('normalizes additive KLine intelligence sections into a shared view model', () => {
    const snapshot = {
      symbol: 'HPG',
      trade_date: '2026-04-25',
      timeframe: 'session',
      axis: {
        window_start: '2026-04-25T09:00:00+07:00',
        window_end: '2026-04-25T15:00:00+07:00',
      },
      bubble_series: [
        {
          ts: '2026-04-25T09:15:10+07:00',
          price: 25.4,
          volume: 100000,
          matched_value: 500000000,
          side: 'BUY',
          bucket_ts: '2026-04-25T09:15:00+07:00',
          event_score: 88,
        },
      ],
      flow_series: {
        cvd: [{ bucket_ts: '2026-04-25T09:15:00+07:00', value: 200000000 }],
        buy_strength: [{ bucket_ts: '2026-04-25T09:15:00+07:00', value: 72, confidence: 'high' }],
        institutional_strength: [{ bucket_ts: '2026-04-25T09:15:00+07:00', value: 64, confidence: 'high' }],
        speed: [],
      },
      flow_compare_series: [{
        ts: '2026-04-25T09:15:00+07:00',
        bucket_ts: '2026-04-25T09:15:00+07:00',
        cvd_raw: 200000000,
        cvd_normalized_0_100: 80,
        buy_strength: 72,
        institutional_strength: 64,
        baseline: 50,
      }],
      heatmap_series: [{
        ts: '2026-04-25T09:15:00+07:00',
        bucket_ts: '2026-04-25T09:15:00+07:00',
        buy_heat: 70,
        sell_heat: 12,
        net_heat: 58,
        whale_score: 85,
        confidence: 85,
        confidence_label: 'high',
      }],
      marker_series: [{
        ts: '2026-04-25T09:15:00+07:00',
        bucket_ts: '2026-04-25T09:15:00+07:00',
        side: 'buy',
        score: 91,
        matched_value: 500000000,
        event_score: 88,
        confidence: 85,
      }],
      session_context: {
        default_trade_date: '2026-04-25',
        selected_trade_date: '2026-04-25',
        latest_valid_trade_date: '2026-04-25',
        quality_state: 'READY',
      },
      quality_flags: {
        has_flow_data: true,
        has_heatmap_data: true,
        contract_version: 'kline-intelligence-v1',
        cache_key_version: 'v4',
      },
      summary: {
        whale_order_count: 1,
      },
      meta: {
        data_state: 'snapshot',
      },
    };

    const normalized = normalizeWhaleAnalyticsSnapshot(snapshot, 'session');

    expect(normalized.flow.flow_compare_series).toHaveLength(1);
    expect(normalized.flow.heatmap_series).toHaveLength(1);
    expect(normalized.flow.marker_series).toHaveLength(1);
    expect(normalized.flow.view_model.buckets).toHaveLength(1);
    expect(normalized.flow.view_model.buckets[0]).toMatchObject({
      cvdNormalized: 80,
      buyStrength: 72,
      institutionalStrength: 64,
      buyHeat: 70,
      markerSide: 'buy',
      markerScore: 91,
    });
    expect(normalized.flow.view_model.sessionContext.qualityState).toBe('READY');
    expect(normalized.flow.view_model.qualityFlags.contractVersion).toBe('kline-intelligence-v1');
    expect(normalized.bubbles.quality_flags.contract_version).toBe('kline-intelligence-v1');
  });

  test('derives a fallback flow compare view model from legacy flow series when additive sections are absent', () => {
    const snapshot = {
      symbol: 'VCB',
      trade_date: '2026-04-25',
      timeframe: 'session',
      axis: {
        window_start: '2026-04-25T09:00:00+07:00',
        window_end: '2026-04-25T15:00:00+07:00',
      },
      bubble_series: [
        {
          ts: '2026-04-25T10:00:15+07:00',
          price: 90,
          volume: 50000,
          matched_value: 350000000,
          side: 'BUY',
          bucket_ts: '2026-04-25T10:00:00+07:00',
          event_score: 76,
        },
      ],
      flow_series: {
        cvd: [{ bucket_ts: '2026-04-25T10:00:00+07:00', value: 120000000 }],
        buy_strength: [{ bucket_ts: '2026-04-25T10:00:00+07:00', value: 66, confidence: 'medium' }],
        institutional_strength: [{ bucket_ts: '2026-04-25T10:00:00+07:00', value: 61, confidence: 'medium' }],
        speed: [],
      },
      summary: {
        whale_order_count: 1,
      },
      meta: {
        data_state: 'snapshot',
      },
    };

    const normalized = normalizeWhaleAnalyticsSnapshot(snapshot, 'session');

    expect(normalized.flow.flow_compare_series).toEqual([]);
    expect(normalized.flow.view_model.buckets).toHaveLength(1);
    expect(normalized.flow.view_model.buckets[0].cvdNormalized).toBeGreaterThan(50);
    expect(normalized.flow.view_model.buckets[0].markerSide).toBe('buy');
    expect(normalized.flow.view_model.sessionContext.qualityState).toBe('READY');
  });
});