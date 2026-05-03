import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import AdminCoreTenants from './AdminCoreTenants';
import { getCoreOperatorTenantDetail, getCoreOperatorTenants } from '../api/client';
import { useI18n } from '../context/LangContext';

jest.mock('../api/client', () => ({
  getCoreOperatorTenantDetail: jest.fn(),
  getCoreOperatorTenants: jest.fn(),
}));

jest.mock('../context/LangContext', () => ({
  useI18n: jest.fn(),
}));

const mockGetCoreOperatorTenants = jest.requireMock('../api/client').getCoreOperatorTenants;
const mockGetCoreOperatorTenantDetail = jest.requireMock('../api/client').getCoreOperatorTenantDetail;

describe('AdminCoreTenants', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(window, 'setInterval').mockImplementation(() => 1);
    jest.spyOn(window, 'clearInterval').mockImplementation(() => {});
    useI18n.mockReturnValue({
      t: (key, params) => params?.defaultValue || key,
      formatDateTime: () => '03/05/2026 09:00:00',
    });

    mockGetCoreOperatorTenants.mockResolvedValue({
      data: {
        object: 'list',
        summary_cards: [
          { key: 'tenant_total', label: 'Tổng tenant', value: 1, detail: 'Matching current filters' },
        ],
        data: [
          {
            object: 'tenant_summary',
            id: 'ten_123',
            tenant_code: 'alpha-desk',
            display_name: 'Alpha Desk',
            status: 'active',
            plan_code: 'pro',
            suspension_state: 'none',
            current_usage_risk: 'warning',
            invoice_state: 'current',
            active_service_account_count: 1,
            active_pat_count: 2,
            updated_at: '2026-05-03T09:00:00Z',
          },
        ],
        has_more: false,
      },
    });

    mockGetCoreOperatorTenantDetail.mockResolvedValue({
      data: {
        object: 'operator_tenant_detail',
        tenant: {
          object: 'tenant_summary',
          id: 'ten_123',
          tenant_code: 'alpha-desk',
          display_name: 'Alpha Desk',
          status: 'active',
          plan_code: 'pro',
          suspension_state: 'none',
          current_usage_risk: 'warning',
          invoice_state: 'current',
        },
        commercial_summary: {
          plan_code: 'pro',
          billing_cycle: 'monthly',
          next_invoice_date: '2026-05-20',
        },
        security_summary: {
          service_account_count: 1,
          active_pat_count: 2,
          rotations_due_count: 0,
          anomaly_state: 'normal',
          latest_pat_last_used_at: '2026-05-03T09:00:00Z',
        },
        recent_operator_actions: [
          { action: 'service_account_created', summary: 'Tạo service account alpha-main', at: '2026-05-03T08:40:00Z' },
        ],
      },
    });
  });

  afterEach(() => {
    window.history.pushState({}, '', '/');
    jest.restoreAllMocks();
  });

  it('renders the tenant registry list with filters and summary cards', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/core/tenants']}>
        <Routes>
          <Route path="/admin/core/tenants" element={<AdminCoreTenants />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Danh sách tenant')).toBeInTheDocument();
    expect(await screen.findByText('Tổng tenant')).toBeInTheDocument();
    expect(await screen.findByText('Alpha Desk')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xem chi tiết' })).toHaveAttribute('href', '/admin/core/tenants/ten_123');
    expect(mockGetCoreOperatorTenants).toHaveBeenCalledTimes(1);
  });

  it('renders the tenant detail view for the selected registry item', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/core/tenants/ten_123']}>
        <Routes>
          <Route path="/admin/core/tenants/:tenantId" element={<AdminCoreTenants />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Chi tiết tenant')).toBeInTheDocument();
    expect(await screen.findByText('Thông tin thương mại')).toBeInTheDocument();
    expect(await screen.findByText('Thông tin bảo mật')).toBeInTheDocument();
    expect(await screen.findByText('Tạo service account alpha-main')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xem service accounts' })).toHaveAttribute('href', '/admin/core/tenants/ten_123/service-accounts');
    expect(mockGetCoreOperatorTenantDetail).toHaveBeenCalledWith('ten_123');
  });
});