import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import WatchlistShellHost from './WatchlistShellHost';

const mockUsePortfolio = jest.fn();
const mockShellWatchlistPage = jest.fn(() => <div data-testid="shell-watchlist-page">Shell Watchlist Page</div>);

jest.mock('../context/PortfolioContext', () => ({
  usePortfolio: () => mockUsePortfolio(),
}));

jest.mock('@vninvest/web', () => ({
  ShellWatchlistPage: (props) => mockShellWatchlistPage(props),
}));

describe('WatchlistShellHost', () => {
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
    mockShellWatchlistPage.mockClear();
  });

  it('mounts the shared watchlist shell page with package shell runtime props', () => {
    render(
      <MemoryRouter initialEntries={['/watchlist?group=core']}>
        <WatchlistShellHost />
      </MemoryRouter>,
    );

    expect(screen.getByText('Danh sách theo dõi shell chạy trong frontend thật')).toBeTruthy();
    expect(mockShellWatchlistPage).toHaveBeenCalledTimes(1);

    const props = mockShellWatchlistPage.mock.calls[0][0];
    expect(props.autoLoad).toBe(true);
    expect(typeof props.bootstrapLoader).toBe('function');
    expect(props.env).toBeDefined();
    expect(typeof props.fetchImpl).toBe('function');
  });
});