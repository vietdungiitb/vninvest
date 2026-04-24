import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import WhaleAnalyticsTab from './WhaleAnalyticsTab';
import useWhaleAnalyticsData from '../hooks/useWhaleAnalyticsData';
import { useI18n } from '../context/LangContext';

jest.mock('echarts/core', () => ({
  use: jest.fn(),
}));

jest.mock('echarts/charts', () => ({
  LineChart: {},
  ScatterChart: {},
}));

jest.mock('echarts/components', () => ({
  AxisPointerComponent: {},
  GraphicComponent: {},
  GridComponent: {},
  MarkLineComponent: {},
  TooltipComponent: {},
}));

jest.mock('echarts/renderers', () => ({
  CanvasRenderer: {},
}));

jest.mock('echarts-for-react/lib/core', () => {
  return function MockReactECharts() {
    return <div data-testid="mock-echarts" />;
  };
});

jest.mock('../context/LangContext', () => ({
  useI18n: jest.fn(),
}));

jest.mock('../hooks/useOrderBubbleCoordinates', () => ({
  useOrderBubbleCoordinates: jest.fn(() => ({ buy: [], sell: [], internal: [] })),
}));

jest.mock('../hooks/useWhaleAnalyticsData', () => jest.fn());

jest.mock('./WhaleBubbleChart', () => {
  return jest.fn(() => <div data-testid="mock-whale-bubble-chart" />);
});

const ActualWhaleBubbleChart = jest.requireActual('./WhaleBubbleChart').default;

describe('Whale Analytics degraded rendering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useI18n.mockReturnValue({
      t: () => undefined,
    });
  });

  it('shows degraded notice in empty state when intraday ticks are missing', () => {
    render(
      <ActualWhaleBubbleChart
        isControlled={true}
        externalSymbol="HPG"
        externalTimeframe="session"
        externalLoading={false}
        externalError={null}
        externalData={{
          orders: { buy: [], sell: [], internal: [] },
          summary: { total_orders: 0 },
          degraded_mode: true,
          stale_reason: 'missing_intraday_ticks',
          quality_flags: { missing_reference_price: false, missing_intraday_ticks: true },
          timeframe_window: { startMs: 1, endMs: 2 },
          price_series: [],
        }}
        externalFlowData={{
          cvd_series: [],
          strength_series: [],
          institutional_strength_series: [],
          timeframe_window: { startMs: 1, endMs: 2 },
        }}
      />,
    );

    expect(screen.getByText('Dữ liệu đang ở chế độ degraded')).toBeInTheDocument();
    expect(screen.getByText('Phiên gần nhất chưa có đủ tick intraday hợp lệ, biểu đồ đang trả snapshot an toàn từ nguồn SSOT.')).toBeInTheDocument();
    expect(screen.getByText('Không có dữ liệu')).toBeInTheDocument();
  });

  it('shows missing intraday badge in tab footer when meta marks data gap', () => {
    useWhaleAnalyticsData.mockReturnValue({
      loading: false,
      error: null,
      data: {
        bubbles: {
          orders: { buy: [], sell: [], internal: [] },
          summary: { total_orders: 0 },
          degraded_mode: true,
          stale_reason: 'missing_intraday_ticks',
          quality_flags: { missing_reference_price: false, missing_intraday_ticks: true },
          timeframe_window: { startMs: 1, endMs: 2 },
          price_series: [],
        },
        flow: {
          cvd_series: [],
          strength_series: [],
          institutional_strength_series: [],
          dark_flow: { strength: 0 },
          timeframe_window: { startMs: 1, endMs: 2 },
          smfi: null,
        },
        meta: {
          degraded_mode: true,
          stale_reason: 'missing_intraday_ticks',
          is_stale: false,
        },
      },
    });

    render(<WhaleAnalyticsTab selectedSymbol="HPG" holdings={[{ symbol: 'HPG' }]} />);

    expect(screen.getByText('Thiếu tick intraday')).toBeInTheDocument();
  });
});