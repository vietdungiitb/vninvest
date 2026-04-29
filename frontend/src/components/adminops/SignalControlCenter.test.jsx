import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SignalControlCenter from './SignalControlCenter';
import {
  applyAdminSignalsUniverse,
  getAdminSignalJobs,
  getAdminSignalRecentEvents,
  getAdminSignalsConfig,
  getAdminSignalsSummary,
  previewAdminSignalRetention,
  previewAdminSignalsConfig,
  previewAdminSignalsUniverse,
  retryAdminSignalJob,
  runAdminSignalJob,
  updateAdminSignalsConfig,
} from '../../api/client';
import { useI18n } from '../../context/LangContext';

jest.mock('../../api/client', () => ({
  applyAdminSignalsUniverse: jest.fn(),
  getAdminSignalJobs: jest.fn(),
  getAdminSignalRecentEvents: jest.fn(),
  getAdminSignalsConfig: jest.fn(),
  getAdminSignalsSummary: jest.fn(),
  previewAdminSignalRetention: jest.fn(),
  previewAdminSignalsConfig: jest.fn(),
  previewAdminSignalsUniverse: jest.fn(),
  retryAdminSignalJob: jest.fn(),
  runAdminSignalJob: jest.fn(),
  updateAdminSignalsConfig: jest.fn(),
}));

jest.mock('../../context/LangContext', () => ({
  useI18n: jest.fn(),
}));

function buildSummaryPayload() {
  return {
    ok: true,
    services: {
      enabled: true,
      whale: {
        enabled: true,
        recent_event_count_24h: 3,
        total_event_count: 8,
        latest_event: { symbol: 'FPT' },
        cache_freshness: { cached_at: '2026-04-28T10:00:00Z' },
      },
      dark_flow: {
        enabled: true,
        recent_event_count_24h: 2,
        total_event_count: 5,
        latest_event: { symbol: 'VCB' },
        cache_freshness: { cached_at: '2026-04-28T10:01:00Z' },
      },
    },
    universe: {
      generated_at: '2026-04-28T10:05:00Z',
      counts: { effective: 12 },
      sources: {},
    },
    celery: { alive: true },
  };
}

function buildConfigPayload() {
  return {
    ok: true,
    services_config: {
      enabled: true,
      whale_service: {
        enabled: true,
        default_threshold_vnd: 500000000,
        cooldown_seconds: 120,
      },
      dark_flow_service: {
        enabled: true,
        window_seconds: 300,
        warning_strength: 40,
        urgent_strength: 70,
        cooldown_seconds: 300,
      },
      distribution: {
        websocket_enabled: true,
        history_enabled: true,
        fanout_batch_size: 200,
      },
    },
    universe_policy: {
      include_tracked_symbols: true,
      include_watchlist_symbols: true,
      include_alert_symbols: true,
      include_portfolio_symbols: true,
      include_group_symbols: false,
      admin_symbols: ['FPT'],
    },
    retention_policy: {
      raw_intraday_keep_days: 7,
      whale_event_keep_days: 90,
      dark_flow_keep_days: 90,
    },
  };
}

describe('SignalControlCenter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useI18n.mockReturnValue({
      t: (key, params) => params?.defaultValue || key,
    });
    getAdminSignalsSummary.mockResolvedValue({ data: buildSummaryPayload() });
    getAdminSignalsConfig.mockResolvedValue({ data: buildConfigPayload() });
    getAdminSignalJobs.mockResolvedValue({
      data: {
        ok: true,
        results: [
          {
            id: 7,
            service_domain: 'whale',
            service_domain_display: 'whale',
            run_type: 'manual',
            run_type_display: 'manual',
            status: 'COMPLETED',
            status_display: 'completed',
            stored_items: 2,
            created_at: '2026-04-28T09:59:00Z',
          },
        ],
      },
    });
    getAdminSignalRecentEvents.mockResolvedValue({
      data: {
        ok: true,
        results: [
          {
            domain: 'whale',
            event_id: 'whale:FPT:1',
            symbol: 'FPT',
            severity: 'urgent',
            ts: '2026-04-28T09:58:00Z',
            summary_value: 900000000,
          },
        ],
      },
    });
    previewAdminSignalRetention.mockResolvedValue({
      data: {
        ok: true,
        preview: {
          raw_intraday: { rows_total: 10, purge_before: '2026-04-21T00:00:00Z' },
          whale_events: { rows_total: 5, purge_before: '2026-01-28T00:00:00Z' },
          dark_flow_events: { rows_total: 6, purge_before: '2026-01-28T00:00:00Z' },
        },
      },
    });
    previewAdminSignalsConfig.mockResolvedValue({
      data: {
        ok: true,
        changes: {
          services_config: {},
        },
      },
    });
    previewAdminSignalsUniverse.mockResolvedValue({ data: { ok: true, preview: { counts: { effective: 12 } } } });
    applyAdminSignalsUniverse.mockResolvedValue({ data: { ok: true, preview: { counts: { effective: 12 } } } });
    retryAdminSignalJob.mockResolvedValue({ data: { ok: true } });
    runAdminSignalJob.mockResolvedValue({ data: { ok: true } });
    updateAdminSignalsConfig.mockResolvedValue({ data: { ok: true } });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads operator data and previews config changes', async () => {
    render(<SignalControlCenter />);

    expect(await screen.findByText('Điều phối global whale và dark flow')).toBeInTheDocument();
    expect(getAdminSignalsSummary).toHaveBeenCalledTimes(1);
    expect(getAdminSignalsConfig).toHaveBeenCalledTimes(1);
    expect(getAdminSignalJobs).toHaveBeenCalledWith({ limit: 10 });
    expect(getAdminSignalRecentEvents).toHaveBeenCalledWith({ domain: 'all', limit: 10 });

    fireEvent.click(screen.getByRole('button', { name: 'Xem trước config' }));

    await waitFor(() => {
      expect(previewAdminSignalsConfig).toHaveBeenCalledTimes(1);
    });

    expect(previewAdminSignalsConfig.mock.calls[0][0]).toMatchObject({
      services_config: {
        whale_service: {
          enabled: true,
          default_threshold_vnd: 500000000,
          cooldown_seconds: 120,
        },
        dark_flow_service: {
          enabled: true,
          window_seconds: 300,
          warning_strength: 40,
          urgent_strength: 70,
          cooldown_seconds: 300,
        },
        distribution: {
          websocket_enabled: true,
          history_enabled: true,
          fanout_batch_size: 200,
        },
      },
    });
  });

  it('does not apply universe policy when confirmation is rejected', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(false);

    render(<SignalControlCenter />);

    expect(await screen.findByText('Điều phối global whale và dark flow')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng universe' }));

    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(applyAdminSignalsUniverse).not.toHaveBeenCalled();
  });
});