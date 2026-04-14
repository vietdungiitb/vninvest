import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WhaleAlertsHub from './WhaleAlertsHub';
import {
  getAggregateWhaleFeed,
  getSymbolInvestigation,
  getTrackedSymbols,
  getWatchlistGroups,
  getWhaleCampaigns,
} from '../api/client';
import { usePortfolio } from '../context/PortfolioContext';
import { useI18n } from '../context/LangContext';

jest.mock('../api/client', () => ({
  getAggregateWhaleFeed: jest.fn(),
  getSymbolInvestigation: jest.fn(),
  getTrackedSymbols: jest.fn(),
  getWatchlistGroups: jest.fn(),
  getWhaleAdvisories: jest.fn(),
  getWhaleCampaigns: jest.fn(),
}));

jest.mock('../context/PortfolioContext', () => ({
  usePortfolio: jest.fn(),
}));

jest.mock('../context/LangContext', () => ({
  useI18n: jest.fn(),
}));

const campaignA = {
  campaign_id: 'cmp-a',
  symbol: 'HPG',
  side_bias: 'buy',
  campaign_type: 'accumulation',
  campaign_strength: 78,
  event_count: 2,
  duration_seconds: 600,
  total_matched_value: 1250000000,
  avg_event_score: 82,
  source_mix: { redis_stream: 2 },
  last_event_at: '2026-04-10T10:00:00Z',
  events: [
    {
      event_id: 'evt-1',
      symbol: 'HPG',
      side: 'buy',
      matched_value: 800000000,
      display_score: 80,
      source: 'redis_stream',
      ts: '2026-04-10T09:58:00Z',
    },
  ],
};

const campaignB = {
  campaign_id: 'cmp-b',
  symbol: 'FPT',
  side_bias: 'sell',
  campaign_type: 'distribution',
  campaign_strength: 65,
  event_count: 1,
  duration_seconds: 300,
  total_matched_value: 700000000,
  avg_event_score: 61,
  source_mix: { intraday_tick_db: 1 },
  last_event_at: '2026-04-10T10:05:00Z',
  events: [
    {
      event_id: 'evt-2',
      symbol: 'FPT',
      side: 'sell',
      matched_value: 700000000,
      display_score: 61,
      source: 'intraday_tick_db',
      ts: '2026-04-10T10:04:00Z',
    },
  ],
};

function setupCommonMocks() {
  usePortfolio.mockReturnValue({
    ability: { can: jest.fn(() => false) },
    userPlan: 'pro',
  });

  useI18n.mockReturnValue({
    t: (key, params) => {
      if (params && typeof params.count !== 'undefined') {
        return `${key}:${params.count}`;
      }
      if (params && typeof params.value !== 'undefined') {
        return `${key}:${params.value}`;
      }
      if (params && typeof params.plan !== 'undefined') {
        return `${key}:${params.plan}`;
      }
      if (params && typeof params.source !== 'undefined') {
        return `${key}:${params.source}`;
      }
      return key;
    },
    localeTag: 'en-US',
    formatDateTime: (value) => new Date(value).toISOString(),
  });

  getTrackedSymbols.mockResolvedValue({
    data: [{ symbol: 'HPG' }, { symbol: 'FPT' }],
  });

  getWatchlistGroups.mockResolvedValue({
    data: [{ id: 1, name: 'Core' }],
  });

  getAggregateWhaleFeed.mockResolvedValue({
    data: {
      results: [],
      next_cursor: null,
      has_more: false,
      entitlements: {
        can_read_whale_advisory: false,
        can_read_whale_advisory_detail: false,
      },
      filters: { scope: 'tracked' },
      source: 'redis_stream',
      server_time: '2026-04-10T10:06:00Z',
    },
  });
}

function renderPage() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <WhaleAlertsHub />
    </MemoryRouter>
  );
}

describe('WhaleAlertsHub Campaigns', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupCommonMocks();
  });

  it('renders campaigns tab and opens/closes campaign detail modal', async () => {
    getWhaleCampaigns.mockResolvedValue({
      data: {
        results: [campaignA],
        has_more: false,
        next_cursor: null,
      },
    });

    renderPage();

    await waitFor(() => {
      expect(getWhaleCampaigns).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'whaleHub.tabCampaigns' }));

    expect(await screen.findByText('HPG')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'whaleHub.viewCampaignDetail' }));
    expect(await screen.findByText('whaleHub.campaignDetailTitle')).toBeTruthy();
    expect(screen.getByText('whaleHub.eventTimeline')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'whaleHub.closeDetail' }));

    await waitFor(() => {
      expect(screen.queryByText('whaleHub.campaignDetailTitle')).toBeNull();
    });
  });

  it('filters campaigns by side', async () => {
    getWhaleCampaigns.mockResolvedValue({
      data: {
        results: [campaignA, campaignB],
        has_more: false,
        next_cursor: null,
      },
    });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'whaleHub.tabCampaigns' }));

    expect(await screen.findByText('HPG')).toBeTruthy();
    expect(screen.getByText('FPT')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('whaleHub.filterSide'), {
      target: { value: 'sell' },
    });

    await waitFor(() => {
      expect(screen.queryByText('HPG')).toBeNull();
      expect(screen.getByText('FPT')).toBeTruthy();
    });
  });

  it('loads more campaigns with cursor and appends new items', async () => {
    getWhaleCampaigns
      .mockResolvedValueOnce({
        data: {
          results: [campaignA],
          has_more: true,
          next_cursor: 'cursor-1',
        },
      })
      .mockResolvedValueOnce({
        data: {
          results: [campaignB],
          has_more: false,
          next_cursor: null,
        },
      });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'whaleHub.tabCampaigns' }));

    expect(await screen.findByText('HPG')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'whaleHub.loadMoreCampaigns' }));

    await waitFor(() => {
      expect(getWhaleCampaigns).toHaveBeenCalledTimes(2);
      expect(screen.getByText('FPT')).toBeTruthy();
    });

    const secondCall = getWhaleCampaigns.mock.calls[1][0];
    expect(secondCall.cursor).toBe('cursor-1');
  });

  it('loads symbol investigation timeline with co-observation badge', async () => {
    getWhaleCampaigns.mockResolvedValue({
      data: {
        results: [],
        has_more: false,
        next_cursor: null,
      },
    });

    getSymbolInvestigation.mockResolvedValue({
      data: {
        correlated_campaigns: [
          {
            event_id: 'cmp-evt-1',
            symbol: 'HPG',
            side: 'BUY',
            matched_value: 900000000,
            created_at: '2026-04-10T10:00:00Z',
          },
        ],
        correlated_signals: [
          {
            signal_id: 'sig-1',
            signal_type: 'dark_money_flow',
            strength: 86,
            confidence: 0.82,
            created_at: '2026-04-10T10:01:00Z',
          },
        ],
        grouped_timeline: [
          {
            bucket_start: '2026-04-10T10:00:00Z',
            whale_count: 2,
            signal_count: 1,
            has_co_observation: true,
          },
        ],
        co_observation_summary: {
          co_observation_count: 2,
        },
      },
    });

    renderPage();

    await waitFor(() => {
      expect(getWhaleCampaigns).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'whaleHub.tabSymbolInvestigation' }));

    fireEvent.click(await screen.findByRole('link', { name: 'HPG' }));

    await waitFor(() => {
      expect(getSymbolInvestigation).toHaveBeenCalledWith('HPG', {
        window: '5d',
        sort: 'created_at',
      });
    });

    expect(await screen.findByText('whaleHub.coObservationTimeline')).toBeTruthy();
    expect(screen.getByText('2 co-observed')).toBeTruthy();
    expect(screen.getByText('whaleHub.coObservationBucket')).toBeTruthy();
  });
});
