import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { WhaleFeedPanel } from './WhaleFeedPanel';
import { getSessionFacts } from '../api/client';

jest.mock('../context/LangContext', () => ({
  useI18n: () => ({
    t: (key, options) => options?.defaultValue || key,
    formatDateTime: (value) => value,
  }),
}));

jest.mock('../api/client', () => ({
  getSessionFacts: jest.fn(),
  getWhaleFeed: jest.fn(),
}));

describe('WhaleFeedPanel selected session truth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getSessionFacts.mockResolvedValue({
      data: {
        cvd_normalized: 63.5,
        buy_strength: 71.2,
        institutional_strength: 68.4,
        delta_strength_pct: 9.1,
        dark_flow_score: 14.6,
      },
    });
  });

  it('locks session facts and tape items to the selected trade date', async () => {
    render(
      <WhaleFeedPanel
        symbol="HPG"
        selectedTradeDate="2026-05-14"
        realtimeAlerts={[
          {
            event_id: 'rt-selected',
            ts: '2026-05-14T03:20:00Z',
            description: 'Selected session realtime',
            side: 'buy',
            matched_value: 4200000000,
            alert_kind: 'whale_alert',
          },
          {
            event_id: 'rt-latest',
            ts: '2026-05-15T03:20:00Z',
            description: 'Latest realtime',
            side: 'sell',
            matched_value: 5100000000,
            alert_kind: 'whale_alert',
          },
        ]}
        feedData={{
          source: 'intraday_tick_db',
          fetched_at: '2026-05-15T03:30:00Z',
          threshold: 3000000000,
          whale_orders: [
            {
              ts: '2026-05-15T03:15:00Z',
              time: '2026-05-15T03:15:00Z',
              description: 'Latest feed order',
              side: 'buy',
              matched_value: 3500000000,
              volume: 100000,
              price: 25.4,
            },
          ],
        }}
        ordersOverride={[
          {
            ts: '2026-05-14T03:10:00Z',
            time: '2026-05-14T03:10:00Z',
            description: 'Selected session order',
            side: 'buy',
            matched_value: 4600000000,
            volume: 120000,
            price: 24.9,
          },
        ]}
        loading={false}
      />,
    );

    await waitFor(() => {
      expect(getSessionFacts).toHaveBeenCalledWith('HPG', '2026-05-14');
    });

    expect(await screen.findByText('2026-05-14T03:20:00Z')).toBeInTheDocument();
    expect(screen.getByText('2026-05-14T03:10:00Z')).toBeInTheDocument();
    expect(screen.queryByText('2026-05-15T03:20:00Z')).not.toBeInTheDocument();
    expect(screen.queryByText('2026-05-15T03:15:00Z')).not.toBeInTheDocument();
  });
});