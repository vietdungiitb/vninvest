import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';

import AiAdvisoryShellHost from './AiAdvisoryShellHost';
import WhaleAlertsShellHost from './WhaleAlertsShellHost';
import {
  createPackageShellBootstrapLoader,
  packageShellHostEnv,
  packageShellHostFetch,
} from './packageShellHostRuntime';

jest.mock('@vninvest/web', () => ({
  loadShellBootstrap: jest.fn(),
  ShellAiAdvisoryPage: jest.fn(() => require('react').createElement('div', { 'data-testid': 'ai-shell-proxy' })),
  ShellWhaleAlertsPage: jest.fn(() => require('react').createElement('div', { 'data-testid': 'whale-shell-proxy' })),
}));

jest.mock('../context/PortfolioContext', () => ({
  usePortfolio: jest.fn(),
}));

const {
  loadShellBootstrap: mockLoadShellBootstrap,
  ShellAiAdvisoryPage: mockShellAiAdvisoryPage,
  ShellWhaleAlertsPage: mockShellWhaleAlertsPage,
} = jest.requireMock('@vninvest/web');

const { usePortfolio: mockUsePortfolio } = jest.requireMock('../context/PortfolioContext');

function renderWithRouter(element, initialEntry) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      {element}
    </MemoryRouter>,
  );
}

function installShellRuntimeGlobals({ origin = 'http://localhost', token = 'shell-token-123' } = {}) {
  const previousFetch = globalThis.fetch;
  const previousLocation = globalThis.location;
  const previousLocalStorage = globalThis.localStorage;
  const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
  const localStorageMock = {
    getItem: jest.fn().mockReturnValue(token),
  };

  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: fetchMock,
  });
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: { origin },
  });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: localStorageMock,
  });

  return {
    fetchMock,
    restore() {
      Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        value: previousFetch,
      });
      Object.defineProperty(globalThis, 'location', {
        configurable: true,
        value: previousLocation,
      });
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: previousLocalStorage,
      });
    },
  };
}

describe('package shell host runtime parity proofs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePortfolio.mockReturnValue({
      ability: {
        rules: [
          { action: 'read', subject: 'WhaleAdvisory' },
        ],
      },
      authStateReady: true,
      userIdentity: {
        id: 42,
        username: 'shell-user',
        email: 'shell-user@example.com',
        is_staff: false,
        is_superuser: false,
      },
      userPlan: 'starter',
    });
  });

  it('overlays frontend identity while preserving the shared bootstrap shape', async () => {
    mockLoadShellBootstrap.mockResolvedValueOnce({
      buildMeta: {
        adapterId: 'core',
        displayName: 'Core API',
        target: 'saas',
        baseUrl: '/core/v1',
      },
      health: { ok: true, service: 'core-api', environment: 'foundation' },
      capabilities: {
        principal: {
          identity: {
            user_id: 1,
            username: 'package-admin',
            email: 'package-admin@vninvest.local',
            is_staff: true,
            is_superuser: true,
          },
        },
        build: {
          target: 'saas',
          plan: 'pro',
        },
        abilities: [
          { action: 'read', subject: 'Dashboard' },
          { action: 'read', subject: 'admin.operator.read' },
        ],
        navigation: {
          visible_groups: ['workspace', 'admin'],
          visible_routes: ['dashboard', 'admin-ops'],
        },
        surfaces: {
          show_admin_ops: true,
          show_ai_command_center: true,
          show_vip_shell: false,
        },
      },
      session: {
        session_id: 'core-session-foundation',
        principal: {
          user_id: 1,
          username: 'package-admin',
        },
      },
    });

    const loader = createPackageShellBootstrapLoader({
      userIdentity: {
        id: 42,
        username: 'shell-user',
        email: 'shell-user@example.com',
        is_staff: false,
        is_superuser: false,
      },
      userPlan: 'starter',
      ability: {
        rules: [
          { action: 'read', subject: 'WhaleAdvisory' },
        ],
      },
    });

    const bootstrap = await loader({
      env: packageShellHostEnv,
      fetchImpl: packageShellHostFetch,
    });

    expect(mockLoadShellBootstrap).toHaveBeenCalledTimes(1);
    expect(mockLoadShellBootstrap).toHaveBeenCalledWith({
      env: packageShellHostEnv,
      fetchImpl: packageShellHostFetch,
    });
    expect(bootstrap.capabilities.principal.identity).toEqual({
      user_id: 42,
      username: 'shell-user',
      email: 'shell-user@example.com',
      is_staff: false,
      is_superuser: false,
    });
    expect(bootstrap.capabilities.build.plan).toBe('starter');
    expect(bootstrap.capabilities.abilities).toEqual([
      { action: 'read', subject: 'WhaleAdvisory' },
    ]);
    expect(bootstrap.capabilities.navigation.visible_groups).toEqual(['workspace']);
    expect(bootstrap.capabilities.navigation.visible_routes).toEqual(['dashboard']);
    expect(bootstrap.capabilities.surfaces.show_admin_ops).toBe(false);
    expect(bootstrap.session.session_id).toBe('frontend-auth:shell-user');
    expect(bootstrap.session.principal.user_id).toBe(42);
    expect(bootstrap.session.principal.username).toBe('shell-user');
  });

  it('keeps advisory shell host query context and shared loader wiring', () => {
    renderWithRouter(
      <AiAdvisoryShellHost />,
      '/ai-advisory/shell?symbol=BCM&trade_date=2026-04-15',
    );

    expect(screen.getByText('AI advisory shell chạy trong frontend thật')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Quay lại AI advisory' })).toHaveAttribute(
      'href',
      '/ai-advisory?symbol=BCM&trade_date=2026-04-15',
    );
    expect(mockShellAiAdvisoryPage).toHaveBeenCalledTimes(1);
    expect(mockShellAiAdvisoryPage.mock.calls[0][0]).toEqual(expect.objectContaining({
      autoLoad: true,
      advisorySearch: '?symbol=BCM&trade_date=2026-04-15',
      env: packageShellHostEnv,
      fetchImpl: packageShellHostFetch,
    }));
    expect(typeof mockShellAiAdvisoryPage.mock.calls[0][0].bootstrapLoader).toBe('function');
  });

  it('keeps whale shell host query context and shared loader wiring', () => {
    renderWithRouter(
      <WhaleAlertsShellHost />,
      '/whale-alerts/shell?symbol=HPG&trade_date=2026-04-18',
    );

    expect(screen.getByText('Whale alerts shell chạy trong frontend thật')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Quay lại trung tâm whale' })).toHaveAttribute(
      'href',
      '/whale-alerts?symbol=HPG&trade_date=2026-04-18',
    );
    expect(mockShellWhaleAlertsPage).toHaveBeenCalledTimes(1);
    expect(mockShellWhaleAlertsPage.mock.calls[0][0]).toEqual(expect.objectContaining({
      autoLoad: true,
      whaleSearch: '?symbol=HPG&trade_date=2026-04-18',
      env: packageShellHostEnv,
      fetchImpl: packageShellHostFetch,
    }));
    expect(typeof mockShellWhaleAlertsPage.mock.calls[0][0].bootstrapLoader).toBe('function');
  });

  it('attaches the browser bearer token to same-origin api requests', async () => {
    const runtime = installShellRuntimeGlobals();

    try {
      await packageShellHostFetch('/api/health/', {
        headers: {
          'X-Request-Id': 'shell-check-1',
        },
      });

      expect(runtime.fetchMock).toHaveBeenCalledTimes(1);
      expect(runtime.fetchMock.mock.calls[0][0]).toBe('/api/health/');
      expect(runtime.fetchMock.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer shell-token-123');
      expect(runtime.fetchMock.mock.calls[0][1].headers.get('X-Request-Id')).toBe('shell-check-1');
    } finally {
      runtime.restore();
    }
  });

  it('leaves non-api requests without an attached bearer token', async () => {
    const runtime = installShellRuntimeGlobals({ token: 'shell-token-456' });

    try {
      await packageShellHostFetch('/core/v1/bootstrap', {
        headers: {
          'X-Request-Id': 'shell-check-2',
        },
      });

      expect(runtime.fetchMock).toHaveBeenCalledTimes(1);
      expect(runtime.fetchMock.mock.calls[0][0]).toBe('/core/v1/bootstrap');
      expect(runtime.fetchMock.mock.calls[0][1].headers.has('Authorization')).toBe(false);
      expect(runtime.fetchMock.mock.calls[0][1].headers.get('X-Request-Id')).toBe('shell-check-2');
    } finally {
      runtime.restore();
    }
  });
});