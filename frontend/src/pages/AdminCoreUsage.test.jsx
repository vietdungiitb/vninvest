import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import AdminCoreUsage from './AdminCoreUsage';
import { getCoreOperatorTenantDetail } from '../api/client';
import { useI18n } from '../context/LangContext';

jest.mock('../api/client', () => ({
  getCoreOperatorTenantDetail: jest.fn(),
}));

jest.mock('../context/LangContext', () => ({
  useI18n: jest.fn(),
}));

const mockGetCoreOperatorTenantDetail = jest.requireMock('../api/client').getCoreOperatorTenantDetail;

describe('AdminCoreUsage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useI18n.mockReturnValue({
      t: (key, params) => params?.defaultValue || key,
      formatDateTime: () => '03/05/2026 09:00:00',
      locale: 'vi',
    });

    mockGetCoreOperatorTenantDetail.mockResolvedValue({
      data: {
        tenant: {
          object: 'tenant_summary',
          id: 'ten_123',
          tenant_code: 'alpha-desk',
          display_name: 'Alpha Desk',
          status: 'active',
          plan_code: 'pro',
          current_usage_risk: 'warning',
        },
        commercial_summary: {
          plan_code: 'pro',
          billing_cycle: 'monthly',
        },
        security_summary: {
          anomaly_state: 'warning',
        },
        usage_meters: [
          {
            meter_code: 'api_calls_per_day',
            display_name: 'API calls per day',
            unit: 'request',
            aggregation_window: 'daily',
            entitled_amount: 1000,
            consumed_amount: 320,
            remaining_amount: 680,
            overage_amount: 0,
            hard_stop: false,
            warning_threshold_pct: 75,
            projected_exhaustion_at: null,
            risk_state: 'warning',
            reset_at: '2026-05-04T00:00:00Z',
            period_start: '2026-05-03T00:00:00Z',
            period_end: '2026-05-03T23:59:59Z',
          },
          {
            meter_code: 'exports_per_day',
            display_name: 'Exports per day',
            unit: 'file_unit',
            aggregation_window: 'daily',
            entitled_amount: 20,
            consumed_amount: 20,
            remaining_amount: 0,
            overage_amount: 0,
            hard_stop: true,
            warning_threshold_pct: 75,
            projected_exhaustion_at: null,
            risk_state: 'critical',
            reset_at: '2026-05-04T00:00:00Z',
            period_start: '2026-05-03T00:00:00Z',
            period_end: '2026-05-03T23:59:59Z',
          },
        ],
      },
    });
  });

  afterEach(() => {
    window.history.pushState({}, '', '/');
    jest.restoreAllMocks();
  });

  it('renders the usage and quota surfaces for a tenant', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/core/tenants/ten_123/usage']}>
        <Routes>
          <Route path="/admin/core/tenants/:tenantId/usage" element={<AdminCoreUsage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Sử dụng và quota theo tenant')).toBeInTheDocument();
    expect(await screen.findByText('Tổng meter')).toBeInTheDocument();
    expect(await screen.findAllByText('API calls per day')).toHaveLength(2);
    expect(await screen.findByText('Chi tiết meter')).toBeInTheDocument();
    expect(await screen.findByText('Meter usage')).toBeInTheDocument();
    expect(mockGetCoreOperatorTenantDetail).toHaveBeenCalledWith('ten_123');
  });
});