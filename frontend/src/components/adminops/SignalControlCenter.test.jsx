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
  previewAdminSignalMaterialization,
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
  previewAdminSignalMaterialization: jest.fn(),
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
    ownership: buildOwnershipPayload(),
    lifecycle: {
      deprecation_warnings: ['Giá trị raw keep days trong signal retention chỉ là lớp tương thích.'],
    },
    whale_governance: buildWhaleGovernancePayload(),
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
        materialization: {
          freshness_state: 'fresh',
          lag_seconds: 0,
          session_summary_state: 'complete',
        },
        session_summary: {
          bucket_fact_count: 2,
          dominant_side: 'buy',
        },
        anomaly_markers: [{ kind: 'iceberg' }],
        pending_run_count: 1,
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

function buildOwnershipPayload() {
  return {
    version: '2026-05-01',
    domains: {
      services_config: {
        owner: 'portfolio.global_signal_policy_helpers',
        status: 'canonical',
      },
      universe_policy: {
        owner: 'portfolio.global_signal_policy_helpers',
        status: 'canonical',
      },
      retention_policy: {
        owner: 'portfolio.global_signal_policy_helpers',
        status: 'canonical',
      },
      jobs: {
        owner: 'portfolio.tasks',
        status: 'canonical',
      },
    },
    compatibility: {
      raw_intraday_keep_days: {
        owner: 'portfolio.runtime_policy_helpers',
        status: 'deprecated-alias',
      },
    },
    deprecation_notes: [
      'Giá trị raw_intraday_keep_days trong signal retention chỉ là lớp tương thích; runtime policy là nguồn canonical.',
    ],
  };
}

function buildWhaleGovernancePayload() {
  return {
    generated_at: '2026-04-28T10:07:00Z',
    active_version: {
      id: 11,
      version_code: 'WHALE-2026-05-01',
      status: 'active',
      created_at: '2026-04-28T09:00:00Z',
      approved_at: '2026-04-28T09:30:00Z',
      activated_at: '2026-04-28T09:45:00Z',
    },
    active_rollout: {
      rollout_id: 21,
      version_id: 11,
      version_code: 'WHALE-2026-05-01',
      mode: 'now',
      status: 'running',
      effective_from: null,
      started_at: '2026-04-28T09:46:00Z',
      finished_at: null,
      note: 'created_from_admin_apply',
    },
    propagation: {
      healthy: false,
      signal: 'red',
      expected_count: 0,
      acked_count: 0,
      missing_count: 0,
      stale_count: 0,
      expected_workers: [],
      acked_workers: [],
      missing_workers: [],
      stale_workers: [],
      summary: '0/0 worker ACK',
    },
    anomaly: null,
  };
}

function buildConfigPayload() {
  return {
    ok: true,
    ownership: buildOwnershipPayload(),
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
    previewAdminSignalMaterialization.mockResolvedValue({
      data: {
        ok: true,
        preview: {
          preview: {
            scope_rows: 18,
            changed_rows: 4,
            sample_rows: 2,
            transitions: 3,
          },
          effective_owner: {
            domains: {
              materialization: { owner: 'signal-admin' },
            },
          },
          effective_values: {
            symbols: ['FPT', 'VCB'],
            threshold: 1200000000,
          },
          impacted_counts: {
            scope_rows: 18,
            changed_rows: 4,
            sample_rows: 2,
            transitions: 3,
          },
          freshness: {
            state: 'recompute pending',
            source: 'intraday_side_backfill_preview',
            preview_rows_scanned: 18,
          },
          effective_value_warnings: [],
        },
      },
    });
    getAdminSignalJobs.mockResolvedValue({
      data: {
        ok: true,
        count: 12,
        page: 1,
        page_size: 10,
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
        count: 12,
        page: 1,
        page_size: 10,
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
          raw_intraday: { rows_total: 10, keep_days: 7, purge_before: '2026-04-21T00:00:00Z' },
          whale_events: { rows_total: 5, purge_before: '2026-01-28T00:00:00Z' },
          dark_flow_events: { rows_total: 6, purge_before: '2026-01-28T00:00:00Z' },
        },
      },
    });
    previewAdminSignalsConfig.mockResolvedValue({
      data: {
        ok: true,
        ownership: buildOwnershipPayload(),
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

    expect(await screen.findByText('Vận hành whale, dark flow và lifecycle')).toBeInTheDocument();
    expect(await screen.findByText('Quản trị whale hiện hành')).toBeInTheDocument();
    expect(await screen.findByText('Vòng đời dùng chung')).toBeInTheDocument();
    expect(await screen.findByText('Vật hoá dữ liệu')).toBeInTheDocument();
    expect(await screen.findByText('Lưu trữ và lưu giữ')).toBeInTheDocument();
    expect(await screen.findByText('Phân ranh whale governance')).toBeInTheDocument();
    expect(await screen.findByText('Phân ranh dark flow policy')).toBeInTheDocument();
    expect(await screen.findByText('Tác vụ và kiểm toán')).toBeInTheDocument();
    expect(screen.getByText('Cảnh báo ngưng dùng')).toBeInTheDocument();
    expect((await screen.findAllByText(/Giá trị raw keep days trong signal retention chỉ là lớp tương thích\./)).length).toBeGreaterThanOrEqual(2);
    expect((await screen.findAllByText(/WHALE-2026-05-01/)).length).toBeGreaterThan(0);
    expect(await screen.findByText('Chủ sở hữu hiệu lực')).toBeInTheDocument();
    expect(screen.getByText('Cảnh báo chủ sở hữu và ngưng dùng')).toBeInTheDocument();
    expect(screen.getByDisplayValue('7')).toHaveAttribute('readonly');
    expect(getAdminSignalsSummary).toHaveBeenCalledTimes(1);
    expect(getAdminSignalsConfig).toHaveBeenCalledTimes(1);
    expect(previewAdminSignalMaterialization).toHaveBeenCalledTimes(1);
    expect(getAdminSignalJobs).not.toHaveBeenCalled();
    expect(getAdminSignalRecentEvents).not.toHaveBeenCalled();
    expect(screen.getByText('Nhấn để tải lịch sử chạy.')).toBeInTheDocument();
    expect(screen.getByText('Nhấn để tải sự kiện gần đây.')).toBeInTheDocument();

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
      retention_policy: {
        whale_event_keep_days: 90,
        dark_flow_keep_days: 90,
      },
    });
    expect(previewAdminSignalsConfig.mock.calls[0][0].retention_policy).not.toHaveProperty('raw_intraday_keep_days');
  });

  it('renders object audit warnings as text without crashing', async () => {
    previewAdminSignalMaterialization.mockResolvedValueOnce({
      data: {
        ok: true,
        preview: {
          scope_rows: 18,
          changed_rows: 4,
          sample_rows: 2,
          transitions: 3,
        },
        effective_owner: {
          domains: {
            materialization: { owner: 'signal-admin' },
          },
        },
        effective_values: {
          symbols: ['FPT', 'VCB'],
          threshold: 1200000000,
        },
        impacted_counts: {
          scope_rows: 18,
          changed_rows: 4,
          sample_rows: 2,
          transitions: 3,
        },
        freshness: {
          state: 'recompute pending',
          source: 'intraday_side_backfill_preview',
          preview_rows_scanned: 18,
        },
        effective_value_warnings: [
          {
            field: 'whale_threshold',
            before: 500000000,
            after: 900000000,
            message: 'Ngưỡng whale thay đổi',
            severity: 'warning',
          },
        ],
      },
    });

    render(<SignalControlCenter />);

    const warningMatcher = (_content, node) => Boolean(node?.tagName === 'LI' && node.textContent?.includes('whale_threshold: Ngưỡng whale thay đổi'));
    expect(await screen.findByText(warningMatcher)).toBeInTheDocument();
    expect(screen.queryByText('[object Object]')).not.toBeInTheDocument();
  });

  it('does not apply universe policy when confirmation is rejected', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(false);

    render(<SignalControlCenter />);

    expect(await screen.findByText('Vận hành whale, dark flow và lifecycle')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng universe' }));

    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(applyAdminSignalsUniverse).not.toHaveBeenCalled();
  });

  it('disables unsupported signal write actions when ownership is read-only', async () => {
    const readOnlyOwnership = {
      ...buildOwnershipPayload(),
      domains: {
        ...buildOwnershipPayload().domains,
        services_config: {
          owner: 'legacy-global-signal-policy',
          status: 'read-preview',
        },
        universe_policy: {
          owner: 'legacy-global-signal-policy',
          status: 'read-preview',
        },
        retention_policy: {
          owner: 'data-ops-runtime-policy',
          status: 'read-preview',
        },
        jobs: {
          owner: 'legacy-detector-runtime',
          status: 'guarded-write',
        },
      },
    };

    getAdminSignalsSummary.mockResolvedValueOnce({
      data: {
        ...buildSummaryPayload(),
        ownership: readOnlyOwnership,
      },
    });
    getAdminSignalsConfig.mockResolvedValueOnce({
      data: {
        ...buildConfigPayload(),
        ownership: readOnlyOwnership,
      },
    });

    render(<SignalControlCenter />);

    expect(await screen.findByText('Signal write đang bị khóa có chủ đích')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Áp dụng config' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Áp dụng universe' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Chạy whale' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Chạy dark flow' })).toBeDisabled();
    expect(screen.getByText(/Áp dụng config đang bị khóa/)).toBeInTheDocument();
    expect(screen.getByText(/Áp dụng universe đang bị khóa/)).toBeInTheDocument();
    expect(screen.getByText(/Manual run và retry đang bị khóa/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng config' }));
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng universe' }));
    fireEvent.click(screen.getByRole('button', { name: 'Chạy whale' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tải lịch sử chạy' }));

    const retryButton = await screen.findByRole('button', { name: 'Retry' });
    expect(retryButton).toBeDisabled();
    fireEvent.click(retryButton);

    expect(updateAdminSignalsConfig).not.toHaveBeenCalled();
    expect(applyAdminSignalsUniverse).not.toHaveBeenCalled();
    expect(runAdminSignalJob).not.toHaveBeenCalled();
    expect(retryAdminSignalJob).not.toHaveBeenCalled();
  });

  it('requests paginated jobs and recent events with shared page sizes', async () => {
    render(<SignalControlCenter />);

    expect(await screen.findByText('Vận hành whale, dark flow và lifecycle')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tải lịch sử chạy' }));

    await waitFor(() => {
      expect(getAdminSignalJobs).toHaveBeenCalledWith({ page: 1, page_size: 10 });
    });

    const jobsPageSizeSelect = await screen.findByRole('combobox');
    fireEvent.change(jobsPageSizeSelect, { target: { value: '5' } });

    await waitFor(() => {
      expect(getAdminSignalJobs).toHaveBeenLastCalledWith({ page: 1, page_size: 5 });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Tải sự kiện gần đây' }));

    await waitFor(() => {
      expect(getAdminSignalRecentEvents).toHaveBeenCalledWith({ domain: 'all', page: 1, page_size: 10 });
    });

    fireEvent.click(screen.getAllByTitle('dashboardRealtime.paginationNext')[1]);

    await waitFor(() => {
      expect(getAdminSignalRecentEvents).toHaveBeenLastCalledWith({ domain: 'all', page: 2, page_size: 10 });
    });
  });
});