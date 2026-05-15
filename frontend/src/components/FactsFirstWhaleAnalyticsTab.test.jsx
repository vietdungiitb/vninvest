import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import FactsFirstWhaleAnalyticsTab from './FactsFirstWhaleAnalyticsTab';
import FactsFirstWhaleBubbleChart from './FactsFirstWhaleBubbleChart';
import useWhaleAnalyticsData from '../hooks/useWhaleAnalyticsData';
import { useI18n } from '../context/LangContext';

jest.mock('../context/LangContext', () => ({
  useI18n: jest.fn(),
}));

jest.mock('../hooks/useWhaleAnalyticsData', () => jest.fn());

jest.mock('./FactsFirstWhaleBubbleChart', () => jest.fn(() => <div data-testid="facts-first-whale-bubble-chart" />));

jest.mock('./WhaleAnalyticsAdvisoryModal', () => jest.fn(() => null));

describe('FactsFirstWhaleAnalyticsTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useI18n.mockReturnValue({
      t: (_key, options) => options?.defaultValue,
    });
  });

  it('passes prefetched analytics into the facts-first bubble chart and keeps degraded badges', () => {
    const analyticsData = {
      bubbles: {
        orders: { buy: [], sell: [], internal: [] },
      },
      flow: {
        smfi: 1.25,
        dark_flow: { strength: 63.4 },
      },
      meta: {
        degraded_mode: true,
        stale_reason: 'missing_intraday_ticks',
        is_stale: false,
      },
    };

    useWhaleAnalyticsData.mockReturnValue({
      data: analyticsData,
      loading: false,
      error: null,
    });

    render(
      <FactsFirstWhaleAnalyticsTab
        selectedSymbol="HPG"
        holdings={[{ symbol: 'HPG' }]}
        symbolOptions={['HPG']}
      />,
    );

    expect(screen.getByText('Thiếu tick intraday')).toBeInTheDocument();
    expect(FactsFirstWhaleBubbleChart).toHaveBeenCalled();
    expect(FactsFirstWhaleBubbleChart.mock.calls[0][0]).toEqual(expect.objectContaining({
      symbol: 'HPG',
      timeframe: 'session',
      analyticsData,
      analyticsLoading: false,
      analyticsError: null,
    }));
  });
});