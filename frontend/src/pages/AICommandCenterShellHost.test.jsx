import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import AICommandCenterShellHost from './AICommandCenterShellHost';

const mockUsePortfolio = jest.fn();
const mockShellAiCommandCenterPage = jest.fn(() => <div data-testid="shell-ai-command-center-page">Shell AI Command Center Page</div>);

jest.mock('../context/PortfolioContext', () => ({
  usePortfolio: () => mockUsePortfolio(),
}));

jest.mock('@vninvest/web', () => ({
  ShellAiCommandCenterPage: (props) => mockShellAiCommandCenterPage(props),
}));

describe('AICommandCenterShellHost', () => {
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
    mockShellAiCommandCenterPage.mockClear();
  });

  it('mounts the shared AI command center shell page with package shell runtime props', () => {
    render(
      <MemoryRouter initialEntries={['/settings/ai?section=runtime']}>
        <AICommandCenterShellHost />
      </MemoryRouter>,
    );

    expect(screen.getByText('Trung tâm điều hành AI shell chạy trong frontend thật')).toBeTruthy();
    expect(mockShellAiCommandCenterPage).toHaveBeenCalledTimes(1);

    const props = mockShellAiCommandCenterPage.mock.calls[0][0];
    expect(props.autoLoad).toBe(true);
    expect(typeof props.bootstrapLoader).toBe('function');
    expect(props.env).toBeDefined();
    expect(typeof props.fetchImpl).toBe('function');
  });
});