import React from 'react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import TenantMembers from './TenantMembers';
import {
  createTenantInvite,
  getTenantInvites,
  getTenantMembers,
  removeTenantMember,
} from '../../../api/client';
import { useI18n } from '../../../context/LangContext';
import { usePortfolio } from '../../../context/PortfolioContext';

jest.mock('../../../api/client', () => ({
  getTenantMembers: jest.fn(),
  getTenantInvites: jest.fn(),
  createTenantInvite: jest.fn(),
  removeTenantMember: jest.fn(),
}));

jest.mock('../../../context/LangContext', () => ({
  useI18n: jest.fn(),
}));

jest.mock('../../../context/PortfolioContext', () => ({
  usePortfolio: jest.fn(),
}));

const mockGetTenantMembers = jest.requireMock('../../../api/client').getTenantMembers;
const mockGetTenantInvites = jest.requireMock('../../../api/client').getTenantInvites;
const mockCreateTenantInvite = jest.requireMock('../../../api/client').createTenantInvite;
const mockRemoveTenantMember = jest.requireMock('../../../api/client').removeTenantMember;

function mockTranslations() {
  const labels = {
    'tenantMembers.title': 'Thành viên tenant',
    'tenantMembers.eyebrow': 'Membership tenant',
    'tenantMembers.description': 'Quản lý thành viên và lời mời trong tenant hiện tại.',
    'tenantMembers.refreshAction': 'Tải lại',
    'tenantMembers.backToHome': 'Về tenant home',
    'tenantMembers.metricMembers': 'Số thành viên',
    'tenantMembers.metricInvites': 'Số lời mời',
    'tenantMembers.metricRoles': 'Số vai trò',
    'tenantMembers.metricManage': 'Quyền quản trị',
    'tenantMembers.manageEnabled': 'Được phép quản lý',
    'tenantMembers.manageDisabled': 'Chỉ xem',
    'tenantMembers.rolesHint': 'owner/admin/viewer',
    'tenantMembers.inviteTitle': 'Mời thành viên',
    'tenantMembers.invitedEmailLabel': 'Email được mời',
    'tenantMembers.invitedEmailPlaceholder': 'user@company.com',
    'tenantMembers.roleLabel': 'Vai trò',
    'tenantMembers.inviteAction': 'Gửi lời mời',
    'tenantMembers.submitting': 'Đang gửi...',
    'tenantMembers.invitesListTitle': 'Lời mời đang chờ',
    'tenantMembers.invitesEmpty': 'Chưa có lời mời nào.',
    'tenantMembers.membersListTitle': 'Danh sách thành viên',
    'tenantMembers.membersEmpty': 'Chưa có thành viên nào.',
    'tenantMembers.inviterLabel': 'Người mời',
    'tenantMembers.expiresAtLabel': 'Hết hạn lúc',
    'tenantMembers.emailLabel': 'Email',
    'tenantMembers.joinedAtLabel': 'Tham gia lúc',
    'tenantMembers.removeAction': 'Gỡ thành viên',
    'tenantMembers.removing': 'Đang gỡ...',
    'tenantMembers.removeConfirm': 'Bạn có chắc muốn gỡ thành viên này không?',
    'tenantMembers.loadError': 'Không tải được dữ liệu tenant member.',
    'tenantMembers.inviteError': 'Không gửi được lời mời.',
    'tenantMembers.removeError': 'Không gỡ được thành viên.',
    'common.loading': 'Đang tải...',
  };

  useI18n.mockReturnValue({
    locale: 'vi',
    t: (key) => labels[key] || key,
  });
}

describe('TenantMembers', () => {
  function mockAbility(allowedActions = ['read', 'create', 'remove']) {
    usePortfolio.mockReturnValue({
      ability: {
        can: jest.fn((action, subject) => subject === 'TenantMemberAdmin' && allowedActions.includes(action)),
      },
      userIdentity: {
        email: 'owner@example.com',
      },
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockTranslations();

    mockAbility();

    mockGetTenantMembers.mockResolvedValue({
      data: {
        members: [
          {
            member_id: 'mem_1',
            username: 'owner',
            email: 'owner@example.com',
            role: 'owner',
            joined_at: '2026-05-01T00:00:00Z',
          },
          {
            member_id: 'mem_2',
            username: 'analyst',
            email: 'analyst@example.com',
            role: 'viewer',
            joined_at: '2026-05-02T00:00:00Z',
          },
        ],
      },
    });

    mockGetTenantInvites.mockResolvedValue({
      data: {
        invites: [
          {
            invite_id: 'inv_1',
            invited_email: 'new@example.com',
            inviter_username: 'owner',
            role: 'viewer',
            status: 'pending',
            expires_at: '2026-05-30T00:00:00Z',
          },
        ],
      },
    });

    mockCreateTenantInvite.mockResolvedValue({ data: { invite_id: 'inv_2' } });
    mockRemoveTenantMember.mockResolvedValue({ status: 204 });
  });

  it('loads tenant members and invites on mount', async () => {
    render(
      <MemoryRouter initialEntries={['/tenant-admin/members']}>
        <Routes>
          <Route path="/tenant-admin/members" element={<TenantMembers />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Thành viên tenant')).toBeInTheDocument();
    expect(await screen.findByText('analyst@example.com')).toBeInTheDocument();
    expect(await screen.findByText('new@example.com')).toBeInTheDocument();
  });

  it('creates tenant invite with openapi payload field names', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/tenant-admin/members']}>
        <Routes>
          <Route path="/tenant-admin/members" element={<TenantMembers />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText('Thành viên tenant');
    await user.clear(screen.getByLabelText('Email được mời'));
    await user.type(screen.getByLabelText('Email được mời'), 'invitee@example.com');
    await user.selectOptions(screen.getByLabelText('Vai trò'), 'admin');
    await user.click(screen.getByRole('button', { name: 'Gửi lời mời' }));

    await waitFor(() => {
      expect(mockCreateTenantInvite).toHaveBeenCalledWith({
        invited_email: 'invitee@example.com',
        role: 'admin',
      });
    });
  });

  it('disables invite and remove actions when action-level permissions are missing', async () => {
    mockAbility(['read']);
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/tenant-admin/members']}>
        <Routes>
          <Route path="/tenant-admin/members" element={<TenantMembers />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Thành viên tenant')).toBeInTheDocument();
    expect(await screen.findByText('analyst@example.com')).toBeInTheDocument();

    const inviteButton = screen.getByRole('button', { name: 'Gửi lời mời' });
    expect(inviteButton).toBeDisabled();

    const removeButtons = screen.getAllByRole('button', { name: 'Gỡ thành viên' });
    removeButtons.forEach((button) => {
      expect(button).toBeDisabled();
    });

    await user.click(inviteButton);
    expect(mockCreateTenantInvite).not.toHaveBeenCalled();
    expect(mockRemoveTenantMember).not.toHaveBeenCalled();
  });
});