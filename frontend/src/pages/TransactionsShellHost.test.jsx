import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import TransactionsShellHost from './TransactionsShellHost';

const mockUsePortfolio = jest.fn();
const mockUseI18n = jest.fn();
const mockShellTransactionsPage = jest.fn(() => <div data-testid="shell-transactions-page">Shell Transactions Page</div>);

jest.mock('../context/PortfolioContext', () => ({
  usePortfolio: () => mockUsePortfolio(),
}));

jest.mock('../context/LangContext', () => ({
  useI18n: () => mockUseI18n(),
}));

jest.mock('@vninvest/web', () => ({
  ShellTransactionsPage: (props) => mockShellTransactionsPage(props),
}));

describe('TransactionsShellHost', () => {
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
    mockUseI18n.mockReturnValue({
      t: (key, params) => params?.defaultValue || key,
    });
    mockShellTransactionsPage.mockClear();
  });

  it('mounts the shared transactions shell page with package shell runtime props', () => {
    render(
      <MemoryRouter initialEntries={['/transactions?tab=all']}>
        <TransactionsShellHost />
      </MemoryRouter>,
    );

    expect(screen.getByText('Giao dịch shell chạy trong frontend thật')).toBeTruthy();
    expect(mockShellTransactionsPage).toHaveBeenCalledTimes(1);

    const props = mockShellTransactionsPage.mock.calls[0][0];
    expect(props.autoLoad).toBe(true);
    expect(typeof props.bootstrapLoader).toBe('function');
    expect(props.env).toBeDefined();
    expect(typeof props.fetchImpl).toBe('function');
  });
});