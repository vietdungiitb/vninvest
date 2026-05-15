import { buildFactsFirstFlowData } from './sessionFactsFlowAdapter';
import { toCanonicalMinute } from './whaleTimeAdapter';

describe('sessionFactsFlowAdapter', () => {
  test('builds merged facts-first flow data from SessionFacts payloads', () => {
    const sessionFactPayloads = [
      {
        session_date: '2026-05-14',
        cvd_series: [
          {
            bucket_ts: '2026-05-14T09:15:00+07:00',
            cumulative_cvd: 120000000,
            buy_strength: 68,
            institutional_strength: 62,
          },
        ],
      },
      {
        session_date: '2026-05-15',
        cvd_series: [
          {
            bucket_ts: '2026-05-15T09:30:00+07:00',
            cumulative_cvd: 240000000,
            buy_strength: 74,
            institutional_strength: 69,
          },
        ],
      },
    ];
    const baseFlowData = {
      heatmap_series: [
        {
          bucket_ts: '2026-05-15T09:30:00+07:00',
          buy_heat: 80,
          sell_heat: 22,
          net_heat: 58,
        },
      ],
      marker_series: [
        {
          bucket_ts: '2026-05-15T09:30:00+07:00',
          side: 'buy',
          score: 92,
        },
      ],
      quality_flags: {
        has_heatmap_data: true,
        contract_version: 'kline-intelligence-v1',
      },
      session_context: {
        quality_state: 'READY',
      },
    };

    const result = buildFactsFirstFlowData({
      baseFlowData,
      sessionFactPayloads,
      selectedTradeDate: '2026-05-15',
      flowTimeframe: 'session',
    });

    expect(result.flow_compare_series).toHaveLength(2);
    expect(result.cvd_series[0].ts).toBe(toCanonicalMinute('2026-05-14T09:15:00+07:00'));
    expect(result.cvd_series[1].ts).toBe(toCanonicalMinute('2026-05-15T09:30:00+07:00'));
    expect(result.session_context.selected_trade_date).toBe('2026-05-15');
    expect(result.quality_flags.has_flow_data).toBe(true);
    expect(result.heatmap_series).toHaveLength(1);
    expect(result.view_model.buckets).toHaveLength(2);
    expect(result.view_model.sessionContext.selectedTradeDate).toBe('2026-05-15');
  });

  test('filters facts-first series to the requested timeframe window', () => {
    const timeframeWindow = {
      timeframe: '15m',
      startMs: new Date('2026-05-15T09:00:00+07:00').getTime(),
      endMs: new Date('2026-05-15T09:20:00+07:00').getTime(),
    };
    const result = buildFactsFirstFlowData({
      sessionFactPayloads: [
        {
          session_date: '2026-05-15',
          cvd_series: [
            {
              bucket_ts: '2026-05-15T09:15:00+07:00',
              cumulative_cvd: 80000000,
              buy_strength: 61,
              institutional_strength: 55,
            },
            {
              bucket_ts: '2026-05-15T09:45:00+07:00',
              cumulative_cvd: 160000000,
              buy_strength: 72,
              institutional_strength: 67,
            },
          ],
        },
      ],
      flowTimeframe: '15m',
      timeframeWindow,
    });

    expect(result.flow_compare_series).toHaveLength(1);
    expect(result.flow_compare_series[0].ts).toBe(toCanonicalMinute('2026-05-15T09:15:00+07:00'));
    expect(result.timeframe_window.startMs).toBe(timeframeWindow.startMs);
    expect(result.timeframe_window.endMs).toBe(timeframeWindow.endMs);
  });
});