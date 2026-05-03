import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import PortfoliosShellHost from './PortfoliosShellHost';

const mockUsePortfolio = jest.fn();
const mockShellPortfoliosPage = jest.fn(() => <div data-testid="shell-portfolios-page">Shell Portfolios Page</div>);

jest.mock('../context/PortfolioContext', () => ({
  usePortfolio: () => mockUsePortfolio(),
}));

jest.mock('@vninvest/web', () => ({
  ShellPortfoliosPage: (props) => mockShellPortfoliosPage(props),
}));

describe('PortfoliosShellHost', () => {
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
    mockShellPortfoliosPage.mockClear();
  });

  it('mounts the shared portfolios shell page with package shell runtime props', () => {
    render(
      <MemoryRouter initialEntries={['/portfolios?view=workspace']}>
        <PortfoliosShellHost />
      </MemoryRouter>,
    );

    expect(screen.getByText('Danh mục shell chạy trong frontend thật')).toBeTruthy();
    expect(mockShellPortfoliosPage).toHaveBeenCalledTimes(1);

    const props = mockShellPortfoliosPage.mock.calls[0][0];
    expect(props.autoLoad).toBe(true);
    expect(typeof props.bootstrapLoader).toBe('function');
    expect(props.env).toBeDefined();
    expect(typeof props.fetchImpl).toBe('function');
  });
});