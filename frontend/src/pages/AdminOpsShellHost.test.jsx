import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import AdminOpsShellHost from './AdminOpsShellHost';

const mockUsePortfolio = jest.fn();
const mockShellAdminOpsPage = jest.fn(() => <div data-testid="shell-admin-ops-page">Shell Admin Ops Page</div>);

jest.mock('../context/PortfolioContext', () => ({
  usePortfolio: () => mockUsePortfolio(),
}));

jest.mock('@vninvest/web', () => ({
  ShellAdminOpsPage: (props) => mockShellAdminOpsPage(props),
}));

describe('AdminOpsShellHost', () => {
  beforeEach(() => {
    mockUsePortfolio.mockReturnValue({
      ability: { can: jest.fn() },
      authStateReady: true,
      userIdentity: {
        id: 1,
        username: 'package-admin',
      },
      userPlan: 'pro',
    });
    mockShellAdminOpsPage.mockClear();
  });

  it('mounts the shared admin ops shell page with package shell runtime props', () => {
    render(
      <MemoryRouter initialEntries={['/admin-ops?lane=ops']}>
        <AdminOpsShellHost />
      </MemoryRouter>,
    );

    expect(screen.getByText('Vận hành admin shell chạy trong frontend thật')).toBeTruthy();
    expect(mockShellAdminOpsPage).toHaveBeenCalledTimes(1);

    const props = mockShellAdminOpsPage.mock.calls[0][0];
    expect(props.autoLoad).toBe(true);
    expect(typeof props.bootstrapLoader).toBe('function');
    expect(props.env).toBeDefined();
    expect(typeof props.fetchImpl).toBe('function');
  });
});