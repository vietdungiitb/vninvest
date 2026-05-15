import React from 'react';
import { render, screen } from '@testing-library/react';
import FactsFirstWhaleBubbleChart from './FactsFirstWhaleBubbleChart';
import useSessionFactsCvdSeries from '../hooks/useSessionFactsCvdSeries';
import useWhaleAnalyticsData from '../hooks/useWhaleAnalyticsData';

const mockWhaleBubbleChart = jest.fn();

jest.mock('../hooks/useWhaleAnalyticsData', () => jest.fn());
jest.mock('../hooks/useSessionFactsCvdSeries', () => jest.fn());
jest.mock('./WhaleBubbleChart', () => (props) => {
  mockWhaleBubbleChart(props);
  return <div data-testid="facts-first-whale-bubble-chart" />;
});

describe('FactsFirstWhaleBubbleChart', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('passes facts-first flow data into WhaleBubbleChart controlled mode', () => {
    useWhaleAnalyticsData.mockReturnValue({
      data: {
        bubbles: {
          orders: {
            buy: [{ bucket_ts: '2026-05-15T09:15:00+07:00', matched_value: 500000000, side: 'BUY' }],
            sell: [],
            internal: [],
          },
          timeframe_window: {
            timeframe: 'session',
            startMs: new Date('2026-05-15T09:00:00+07:00').getTime(),
            endMs: new Date('2026-05-15T15:00:00+07:00').getTime(),
          },
        },
        flow: {
          heatmap_series: [{ bucket_ts: '2026-05-15T09:15:00+07:00', buy_heat: 70, sell_heat: 15, net_heat: 55 }],
          marker_series: [{ bucket_ts: '2026-05-15T09:15:00+07:00', side: 'buy', score: 88 }],
        },
      },
      loading: false,
      error: null,
    });
    useSessionFactsCvdSeries.mockReturnValue({
      payloads: [{
        session_date: '2026-05-15',
        cvd_series: [{
          bucket_ts: '2026-05-15T09:15:00+07:00',
          cumulative_cvd: 150000000,
          buy_strength: 65,
          institutional_strength: 59,
        }],
      }],
      loading: false,
      error: null,
    });

    render(<FactsFirstWhaleBubbleChart symbol="HPG" isEmbedded={true} />);

    expect(screen.getByTestId('facts-first-whale-bubble-chart')).toBeTruthy();
    expect(mockWhaleBubbleChart).toHaveBeenCalledTimes(1);
    const props = mockWhaleBubbleChart.mock.calls[0][0];
    expect(props.isControlled).toBe(true);
    expect(props.externalSymbol).toBe('HPG');
    expect(props.externalFlowData.flow_compare_series).toHaveLength(1);
    expect(props.externalFlowData.heatmap_series).toHaveLength(1);
    expect(props.externalError).toBeNull();
  });

  test('does not surface SessionFacts errors when snapshot flow fallback still exists', () => {
    useWhaleAnalyticsData.mockReturnValue({
      data: {
        bubbles: {
          orders: {
            buy: [],
            sell: [],
            internal: [],
          },
        },
        flow: {
          cvd_series: [{ ts: 1778811300, cvd: 42 }],
          strength_series: [{ ts: 1778811300, strength: 61 }],
        },
      },
      loading: false,
      error: null,
    });
    useSessionFactsCvdSeries.mockReturnValue({
      payloads: [],
      loading: false,
      error: new Error('SessionFacts unavailable'),
    });

    render(<FactsFirstWhaleBubbleChart symbol="HPG" isEmbedded={true} />);

    const props = mockWhaleBubbleChart.mock.calls[0][0];
    expect(props.externalFlowData).toBeTruthy();
    expect(props.externalError).toBeNull();
  });
});