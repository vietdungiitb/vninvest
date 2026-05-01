import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminOps from './AdminOps';
import {
  getAdminOpsStats,
  getAdminPrefetchTimePolicy,
  getAdminVnstockConfigChangelog,
  getAdminVnstockConfigCurrent,
  getSecuritiesGroups,
} from '../api/client';
import { useI18n } from '../context/LangContext';

jest.mock('../api/client', () => ({
  getAdminOpsStats: jest.fn(),
  getAdminPrefetchTimePolicy: jest.fn(),
  getAdminVnstockConfigChangelog: jest.fn(),
  getAdminVnstockConfigCurrent: jest.fn(),
  getSecuritiesGroups: jest.fn(),
}));

jest.mock('../context/LangContext', () => ({
  useI18n: jest.fn(),
}));

function buildStatsPayload(surfacePermissions) {
  return {
    user_count: 3,
    portfolio_count: 5,
    tracked_symbol_count: 7,
    watchlist_item_count: 9,
    channel_layer_type: 'redis',
    realtime_enabled: true,
    redis_ok: true,
    ticker_prefetch: {},
    last_market_group_sync: null,
    last_stock_profile_sync: null,
    whale_config_dashboard: {},
    whale_config_propagation: {},
    whale_config_anomaly: {},
    surface_permissions: surfacePermissions,
  };
}

describe('AdminOps legacy writer link-out', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(window, 'setInterval').mockImplementation(() => 1);
    jest.spyOn(window, 'clearInterval').mockImplementation(() => {});
    useI18n.mockReturnValue({
      t: (key, params) => (key === 'adminOps.title' ? 'Admin Ops' : params?.defaultValue || key),
    });
    getAdminPrefetchTimePolicy.mockResolvedValue({
      data: {
        settings: {
          governance_delta_thresholds: {},
          prefetch_runtime_settings: {},
          prefetch_time_policy: {},
        },
      },
    });
    getAdminVnstockConfigCurrent.mockResolvedValue({ data: { settings: {} } });
    getAdminVnstockConfigChangelog.mockResolvedValue({ data: { results: [] } });
    getSecuritiesGroups.mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('locks the legacy writer link-out when upstream permissions are missing', async () => {
    getAdminOpsStats.mockResolvedValue({ data: buildStatsPayload({ vnstock_config_write: false, intraday_side_backfill_apply: false }) });

    render(
      <MemoryRouter initialEntries={['/admin-ops']}>
        <AdminOps />
      </MemoryRouter>
    );

    expect(await screen.findByText('Admin Ops')).toBeInTheDocument();
    expect(screen.getByText('Nguồn ghi cũ và điều hướng')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mở surface chuyên trách' })).toBeDisabled();
    expect(screen.getByText('Cần quyền upstream để mở surface này.')).toBeInTheDocument();
  });

  it('opens the legacy writer link-out when upstream permissions are present', async () => {
    getAdminOpsStats.mockResolvedValue({ data: buildStatsPayload({ vnstock_config_write: true, intraday_side_backfill_apply: true }) });

    render(
      <MemoryRouter initialEntries={['/admin-ops']}>
        <AdminOps />
      </MemoryRouter>
    );

    expect(await screen.findByText('Admin Ops')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Mở surface chuyên trách' })).toHaveAttribute('href', '/admin-crawl-control');
    });
  });
});