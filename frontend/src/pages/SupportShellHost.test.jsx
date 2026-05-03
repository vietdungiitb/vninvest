import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import SupportShellHost from './SupportShellHost';

const mockUsePortfolio = jest.fn();
const mockShellSupportPage = jest.fn(() => <div data-testid="shell-support-page">Shell Support Page</div>);

jest.mock('../context/PortfolioContext', () => ({
  usePortfolio: () => mockUsePortfolio(),
}));

jest.mock('@vninvest/web', () => ({
  ShellSupportPage: (props) => mockShellSupportPage(props),
}));

describe('SupportShellHost', () => {
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
    mockShellSupportPage.mockClear();
  });

  it('mounts the shared support shell page with package shell runtime props', () => {
    render(
      <MemoryRouter initialEntries={['/support?ticketId=SUP-1']}>
        <SupportShellHost />
      </MemoryRouter>,
    );

    expect(screen.getByText('Support shell chạy trong frontend thật')).toBeTruthy();
    expect(mockShellSupportPage).toHaveBeenCalledTimes(1);

    const props = mockShellSupportPage.mock.calls[0][0];
    expect(props.autoLoad).toBe(true);
    expect(typeof props.bootstrapLoader).toBe('function');
    expect(props.env).toBeDefined();
    expect(typeof props.fetchImpl).toBe('function');
  });
});