import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import DashboardShellHost from './DashboardShellHost';

const mockUsePortfolio = jest.fn();
const mockShellDashboardPage = jest.fn(() => <div data-testid="shell-dashboard-page">Shell Dashboard Page</div>);

jest.mock('../context/PortfolioContext', () => ({
  usePortfolio: () => mockUsePortfolio(),
}));

jest.mock('@vninvest/web', () => ({
  ShellDashboardPage: (props) => mockShellDashboardPage(props),
}));

describe('DashboardShellHost', () => {
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
    mockShellDashboardPage.mockClear();
  });

  it('mounts the shared dashboard shell page with package shell runtime props', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/dashboard']}>
        <DashboardShellHost />
      </MemoryRouter>,
    );

    expect(screen.getByText('Dashboard shell chạy trong frontend thật')).toBeTruthy();
    expect(mockShellDashboardPage).toHaveBeenCalledTimes(1);

    const props = mockShellDashboardPage.mock.calls[0][0];
    expect(props.autoLoad).toBe(true);
    expect(typeof props.bootstrapLoader).toBe('function');
    expect(props.env).toBeDefined();
    expect(typeof props.fetchImpl).toBe('function');
  });
});