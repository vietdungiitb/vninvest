import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import AdminCoreServiceAccounts from './AdminCoreServiceAccounts';
import { getCoreOperatorTenantDetail, getCoreOperatorTenantServiceAccounts } from '../api/client';
import { useI18n } from '../context/LangContext';
import { usePortfolio } from '../context/PortfolioContext';

jest.mock('../api/client', () => ({
  getCoreOperatorTenantDetail: jest.fn(),
  getCoreOperatorTenantServiceAccounts: jest.fn(),
}));

jest.mock('../context/LangContext', () => ({
  useI18n: jest.fn(),
}));

jest.mock('../context/PortfolioContext', () => ({
  usePortfolio: jest.fn(),
}));

const mockGetCoreOperatorTenantDetail = jest.requireMock('../api/client').getCoreOperatorTenantDetail;
const mockGetCoreOperatorTenantServiceAccounts = jest.requireMock('../api/client').getCoreOperatorTenantServiceAccounts;

describe('AdminCoreServiceAccounts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useI18n.mockReturnValue({
      t: (key, params) => params?.defaultValue || key,
      formatDateTime: () => '03/05/2026 09:00:00',
    });
    usePortfolio.mockReturnValue({
      ability: {
        can: jest.fn((action, subject) => action === 'read' || subject === 'CoreServiceAccountAdmin'),
      },
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
        },
        commercial_summary: {
          plan_code: 'pro',
          billing_cycle: 'monthly',
        },
        security_summary: {
          anomaly_state: 'normal',
        },
      },
    });

    mockGetCoreOperatorTenantServiceAccounts.mockResolvedValue({
      data: {
        object: 'list',
        summary_cards: [
          { key: 'service_account_total', label: 'Tổng service account', value: 2, detail: 'Visible in current filter set' },
        ],
        data: [
          {
            object: 'service_account',
            id: 'svc_001',
            name: 'alpha-main',
            tenant_id: 'ten_123',
            environment: 'prod',
            status: 'active',
            policy_ids: ['pol_market_read', 'pol_signals_read'],
            pat_count: 3,
            active_pat_count: 2,
            latest_pat_last_used_at: '2026-05-03T08:52:00Z',
            rotation_risk: 'warning',
            last_operator_action_at: '2026-05-03T08:55:00Z',
            created_at: '2026-04-20T08:00:00Z',
            updated_at: '2026-05-03T08:55:00Z',
          },
          {
            object: 'service_account',
            id: 'svc_002',
            name: 'alpha-readonly',
            tenant_id: 'ten_123',
            environment: 'staging',
            status: 'pending_approval',
            policy_ids: [],
            pat_count: 0,
            active_pat_count: 0,
            latest_pat_last_used_at: null,
            rotation_risk: 'critical',
            last_operator_action_at: '2026-05-02T09:00:00Z',
            created_at: '2026-04-18T08:00:00Z',
            updated_at: '2026-05-02T09:00:00Z',
          },
        ],
        has_more: false,
      },
    });
  });

  afterEach(() => {
    window.history.pushState({}, '', '/');
    jest.restoreAllMocks();
  });

  it('renders the service-account registry and detail surface for a tenant', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/core/tenants/ten_123/service-accounts']}>
        <Routes>
          <Route path="/admin/core/tenants/:tenantId/service-accounts" element={<AdminCoreServiceAccounts />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Service account theo tenant')).toBeInTheDocument();
    expect(await screen.findByText('Tổng service account')).toBeInTheDocument();
    expect(await screen.findAllByText('alpha-main')).toHaveLength(2);
    expect(await screen.findByText('alpha-readonly')).toBeInTheDocument();
    expect(await screen.findByText('Chi tiết service account')).toBeInTheDocument();
    expect(await screen.findByText('Policy bundle')).toBeInTheDocument();
    expect(mockGetCoreOperatorTenantDetail).toHaveBeenCalledWith('ten_123');
    expect(mockGetCoreOperatorTenantServiceAccounts).toHaveBeenCalledWith('ten_123', {});
  });

  it('gates create and edit actions by ability', async () => {
    usePortfolio.mockReturnValue({
      ability: {
        can: jest.fn((action, subject) => action === 'read' && subject === 'AdminOps'),
      },
    });

    render(
      <MemoryRouter initialEntries={['/admin/core/tenants/ten_123/service-accounts']}>
        <Routes>
          <Route path="/admin/core/tenants/:tenantId/service-accounts" element={<AdminCoreServiceAccounts />} />
        </Routes>
      </MemoryRouter>,
    );

    const createButton = await screen.findByRole('button', { name: 'Tạo service account' });
    const editButton = await screen.findByRole('button', { name: 'Chỉnh sửa service account' });

    expect(createButton).toBeDisabled();
    expect(editButton).toBeDisabled();
  });
});