import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import AdminCorePATs from './AdminCorePATs';
import { getCoreOperatorTenantDetail, getCoreOperatorTenantPATs, getCoreOperatorTenantServiceAccounts } from '../api/client';
import { useI18n } from '../context/LangContext';
import { usePortfolio } from '../context/PortfolioContext';

jest.mock('../api/client', () => ({
  getCoreOperatorTenantDetail: jest.fn(),
  getCoreOperatorTenantPATs: jest.fn(),
  getCoreOperatorTenantServiceAccounts: jest.fn(),
}));

jest.mock('../context/LangContext', () => ({
  useI18n: jest.fn(),
}));

jest.mock('../context/PortfolioContext', () => ({
  usePortfolio: jest.fn(),
}));

const mockGetCoreOperatorTenantDetail = jest.requireMock('../api/client').getCoreOperatorTenantDetail;
const mockGetCoreOperatorTenantPATs = jest.requireMock('../api/client').getCoreOperatorTenantPATs;
const mockGetCoreOperatorTenantServiceAccounts = jest.requireMock('../api/client').getCoreOperatorTenantServiceAccounts;

describe('AdminCorePATs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useI18n.mockReturnValue({
      t: (key, params) => params?.defaultValue || key,
      formatDateTime: () => '03/05/2026 09:00:00',
    });
    usePortfolio.mockReturnValue({
      ability: {
        can: jest.fn((action, subject) => action === 'read' || subject === 'CorePATAdmin'),
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
        data: [
          {
            object: 'service_account',
            id: 'svc_001',
            name: 'alpha-main',
            environment: 'prod',
            status: 'active',
            policy_ids: ['pol_market_read'],
          },
          {
            object: 'service_account',
            id: 'svc_002',
            name: 'alpha-readonly',
            environment: 'staging',
            status: 'pending_approval',
            policy_ids: [],
          },
        ],
      },
    });

    mockGetCoreOperatorTenantPATs.mockResolvedValue({
      data: {
        object: 'list',
        summary_cards: [
          { key: 'pat_total', label: 'Tổng PAT', value: 2, detail: 'Visible in current filter set' },
        ],
        data: [
          {
            object: 'pat_credential',
            id: 'pat_001',
            tenant_id: 'ten_123',
            service_account_id: 'svc_001',
            token_prefix: 'pat_live_001',
            scope_codes: ['market:read', 'signals:read'],
            status: 'active',
            expires_at: '2026-05-20T00:00:00Z',
            last_used_at: '2026-05-03T08:58:00Z',
            last_ip: '10.0.0.1',
            revoked_at: null,
            issuer_actor_type: 'operator_user',
            issuer_actor_id: 'usr_001',
            anomaly_state: 'normal',
            grace_period_active: false,
            last_used_ip_country: 'VN',
            last_audit_request_id: 'req_123',
            created_at: '2026-04-20T08:00:00Z',
            updated_at: '2026-05-03T08:58:00Z',
          },
          {
            object: 'pat_credential',
            id: 'pat_002',
            tenant_id: 'ten_123',
            service_account_id: 'svc_002',
            token_prefix: 'pat_live_002',
            scope_codes: ['billing:read'],
            status: 'rotating',
            expires_at: '2026-05-10T00:00:00Z',
            last_used_at: null,
            last_ip: null,
            revoked_at: null,
            issuer_actor_type: 'operator_user',
            issuer_actor_id: 'usr_002',
            anomaly_state: 'warning',
            grace_period_active: true,
            last_used_ip_country: null,
            last_audit_request_id: 'req_456',
            created_at: '2026-04-25T08:00:00Z',
            updated_at: '2026-05-03T08:45:00Z',
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

  it('renders the PAT registry and detail surface for a tenant', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/core/tenants/ten_123/pats']}>
        <Routes>
          <Route path="/admin/core/tenants/:tenantId/pats" element={<AdminCorePATs />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('PAT credentials theo tenant')).toBeInTheDocument();
    expect(await screen.findByText('Tổng PAT')).toBeInTheDocument();
    expect(await screen.findAllByText('pat_live_001')).toHaveLength(2);
    expect(await screen.findByText('pat_live_002')).toBeInTheDocument();
    expect(await screen.findByText('Chi tiết PAT')).toBeInTheDocument();
    expect(await screen.findByText('Scope bundle')).toBeInTheDocument();
    expect(mockGetCoreOperatorTenantDetail).toHaveBeenCalledWith('ten_123');
    expect(mockGetCoreOperatorTenantServiceAccounts).toHaveBeenCalledWith('ten_123');
    expect(mockGetCoreOperatorTenantPATs).toHaveBeenCalledWith('ten_123', {});
  });

  it('gates issue, rotate, and revoke actions by ability', async () => {
    usePortfolio.mockReturnValue({
      ability: {
        can: jest.fn((action, subject) => action === 'read' && subject === 'AdminOps'),
      },
    });

    render(
      <MemoryRouter initialEntries={['/admin/core/tenants/ten_123/pats']}>
        <Routes>
          <Route path="/admin/core/tenants/:tenantId/pats" element={<AdminCorePATs />} />
        </Routes>
      </MemoryRouter>,
    );

    const issueButton = await screen.findByRole('button', { name: 'Cấp PAT' });
    const rotateButtons = await screen.findAllByRole('button', { name: 'Xoay PAT đã chọn' });
    const revokeButton = await screen.findByRole('button', { name: 'Thu hồi PAT đã chọn' });

    expect(issueButton).toBeDisabled();
    expect(rotateButtons).toHaveLength(2);
    rotateButtons.forEach((button) => {
      expect(button).toBeDisabled();
    });
    expect(revokeButton).toBeDisabled();
  });
});