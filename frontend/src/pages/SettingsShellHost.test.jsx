import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import SettingsShellHost from './SettingsShellHost';

const mockUsePortfolio = jest.fn();
const mockShellSettingsPage = jest.fn(() => <div data-testid="shell-settings-page">Shell Settings Page</div>);

jest.mock('../context/PortfolioContext', () => ({
  usePortfolio: () => mockUsePortfolio(),
}));

jest.mock('@vninvest/web', () => ({
  ShellSettingsPage: (props) => mockShellSettingsPage(props),
}));

describe('SettingsShellHost', () => {
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
    mockShellSettingsPage.mockClear();
  });

  it('mounts the shared settings shell page with package shell runtime props', () => {
    render(
      <MemoryRouter initialEntries={['/settings?theme=dark']}>
        <SettingsShellHost />
      </MemoryRouter>,
    );

    expect(screen.getByText('Cài đặt shell chạy trong frontend thật')).toBeTruthy();
    expect(mockShellSettingsPage).toHaveBeenCalledTimes(1);

    const props = mockShellSettingsPage.mock.calls[0][0];
    expect(props.autoLoad).toBe(true);
    expect(typeof props.bootstrapLoader).toBe('function');
    expect(props.env).toBeDefined();
    expect(typeof props.fetchImpl).toBe('function');
  });
});