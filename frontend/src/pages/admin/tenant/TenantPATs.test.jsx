import React from 'react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import TenantPATs from './TenantPATs';
import {
  getTenantPATs,
  getTenantServiceAccounts,
  issueTenantPAT,
  rotateTenantPAT,
  revokeTenantPAT,
} from '../../../api/client';
import { useI18n } from '../../../context/LangContext';
import { usePortfolio } from '../../../context/PortfolioContext';

jest.mock('../../../api/client', () => ({
  getTenantPATs: jest.fn(),
  getTenantServiceAccounts: jest.fn(),
  issueTenantPAT: jest.fn(),
  rotateTenantPAT: jest.fn(),
  revokeTenantPAT: jest.fn(),
}));

jest.mock('../../../context/LangContext', () => ({
  useI18n: jest.fn(),
}));

jest.mock('../../../context/PortfolioContext', () => ({
  usePortfolio: jest.fn(),
}));

const mockGetTenantPATs = jest.requireMock('../../../api/client').getTenantPATs;
const mockGetTenantServiceAccounts = jest.requireMock('../../../api/client').getTenantServiceAccounts;
const mockIssueTenantPAT = jest.requireMock('../../../api/client').issueTenantPAT;
const mockRotateTenantPAT = jest.requireMock('../../../api/client').rotateTenantPAT;

function mockTranslations() {
  const labels = {
    'tenantPats.title': 'PAT khách thuê',
    'tenantPats.description': 'Issue, rotate và revoke PAT cho service account trong tenant hiện tại. Secret chỉ hiển thị đúng một lần sau khi tạo hoặc rotate.',
    'tenantPats.refreshAction': 'Tải lại danh sách',
    'tenantPats.backToServiceAccounts': 'Về service account',
    'tenantPats.metricTotal': 'Tổng PAT',
    'tenantPats.metricActive': 'PAT active',
    'tenantPats.metricRotating': 'PAT rotating',
    'tenantPats.metricIssue': 'Quyền issue',
    'tenantPats.issueEnabled': 'Được phép issue',
    'tenantPats.secretHint': 'Lưu secret này ngay. Hệ thống sẽ không hiển thị lại ở các lần tải sau.',
    'tenantPats.secretTitle': 'Secret PAT',
    'tenantPats.closeAction': 'Đóng',
    'tenantPats.copyTokenAction': 'Copy secret',
    'tenantPats.copySuccess': 'Đã copy',
    'tenantPats.issueTitle': 'Issue PAT mới',
    'tenantPats.noServiceAccounts': 'Chưa có service account',
    'tenantPats.serviceAccountLabel': 'Service account',
    'tenantPats.scopesLabel': 'Scope codes',
    'tenantPats.scopesPlaceholder': 'market:read, signals:read, ai:invoke',
    'tenantPats.scopesHelp': 'Nhập scope hiệu lực tối thiểu, phân tách bằng dấu phẩy.',
    'tenantPats.displayNameLabel': 'Tên hiển thị nội bộ',
    'tenantPats.displayNamePlaceholder': 'prod-main-token',
    'tenantPats.expiresAtLabel': 'Hết hạn lúc',
    'tenantPats.submitting': 'Đang gửi…',
    'tenantPats.issueAction': 'Issue PAT',
    'tenantPats.listTitle': 'Danh sách PAT',
    'tenantPats.selectAllLabel': 'Chọn tất cả',
    'tenantPats.bulkRevokeAction': 'Thu hồi PAT đã chọn',
    'tenantPats.itemsPerPageLabel': 'Số mục trên trang',
    'tenantPats.pageSize5': '5 mục',
    'tenantPats.pageSize10': '10 mục',
    'tenantPats.pageSize15': '15 mục',
    'tenantPats.pageSize20': '20 mục',
    'tenantPats.showing': 'Hiển thị',
    'tenantPats.of': 'của',
    'tenantPats.emptyState': 'Không có PAT',
    'tenantPats.previousPage': 'Trang trước',
    'tenantPats.nextPage': 'Trang sau',
    'tenantPats.rotateAction': 'Rotate',
    'tenantPats.revokeAction': 'Revoke',
    'tenantPats.loadError': 'Không tải được dữ liệu',
    'tenantPats.issueError': 'Không cấp PAT được',
    'tenantPats.rotateError': 'Không xoay PAT được',
    'tenantPats.revokeError': 'Không thu hồi PAT được',
    'tenantPats.bulkRevokeWarning': 'Bạn chắc chứ?',
    'tenantPats.bulkRevokeError': 'Không thu hồi PAT hàng loạt được',
    'tenantPats.noTokensSelected': 'Chưa chọn PAT nào',
  };

  useI18n.mockReturnValue({
    locale: 'vi',
    t: (key, params) => labels[key] || params?.defaultValue || key,
  });
}

describe('TenantPATs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTranslations();
    usePortfolio.mockReturnValue({
      ability: {
        can: jest.fn(() => true),
      },
    });

    mockGetTenantServiceAccounts.mockResolvedValue({
      data: {
        data: [
          {
            id: 'svc_001',
            name: 'alpha-main',
            environment: 'prod',
            status: 'active',
            policy_ids: ['pol_market_read'],
          },
        ],
      },
    });

    mockGetTenantPATs.mockResolvedValue({
      data: {
        data: [
          {
            id: 'pat_001',
            service_account_id: 'svc_001',
            token_prefix: 'vni_abc12345',
            scope_codes: ['market:read'],
            status: 'active',
            expires_at: null,
            last_used_at: null,
            created_at: '2026-05-16T00:00:00Z',
            revoked_at: null,
          },
        ],
      },
    });

    mockIssueTenantPAT.mockResolvedValue({
      data: {
        object: 'pat_credential',
        id: 'pat_new_001',
        token_prefix: 'vni_new12345',
        secret: 'vni_secret_issued',
        scope_codes: ['market:read', 'signals:read'],
        status: 'active',
      },
    });

    mockRotateTenantPAT.mockResolvedValue({
      data: {
        object: 'pat_rotation',
        new_token: {
          object: 'pat_credential',
          id: 'pat_new_002',
          token_prefix: 'vni_new54321',
          secret: 'vni_secret_rotated',
          scope_codes: ['market:read'],
          status: 'active',
        },
        old_token_grace_until: '2026-05-17T00:00:00Z',
      },
    });
  });

  afterEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('shows the issued PAT secret exactly once', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/tenant-admin/pats']}>
        <Routes>
          <Route path="/tenant-admin/pats" element={<TenantPATs />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText('PAT khách thuê');
    await screen.findByRole('button', { name: 'Issue PAT' });

    await user.click(screen.getByRole('button', { name: 'Issue PAT' }));

    await waitFor(() => expect(mockIssueTenantPAT).toHaveBeenCalled());
    expect(await screen.findByText('vni_secret_issued')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy secret' })).toBeInTheDocument();
  });

  it('shows rotated PAT secret from nested new_token payload', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/tenant-admin/pats']}>
        <Routes>
          <Route path="/tenant-admin/pats" element={<TenantPATs />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText('PAT khách thuê');
    await screen.findByRole('button', { name: 'Rotate' });

    await user.click(screen.getByRole('button', { name: 'Rotate' }));

    await waitFor(() => expect(mockRotateTenantPAT).toHaveBeenCalledWith('pat_001', { grace_period_seconds: 3600 }));
    expect(await screen.findByText('vni_secret_rotated')).toBeInTheDocument();
  });
});