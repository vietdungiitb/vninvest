/**
 * useAlertCenterData.component.test.js
 * Verifies severity / alert_family filters are forwarded into the query string.
 * Migrated to vitest (component test convention) — jest 29 ESM (VM modules)
 * cannot hoist jest.mock (require is not defined), vitest handles vi.mock natively.
 */
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockGetAlertCenterFeed = vi.fn().mockResolvedValue({ results: [], next: null, previous: null });
const mockGetAlertCenterSummary = vi.fn().mockResolvedValue({ total: 0, unseen: 0, by_severity: {} });
const mockGetAlertCenterSymbolStats = vi.fn().mockResolvedValue({ symbols: [], total_alerts_in_scope: 0, pagination: {} });
const mockGetAIAlertsFeed = vi.fn().mockResolvedValue({ results: [], next: null, previous: null });
const mockGetAIAlertsSummary = vi.fn().mockResolvedValue({ total: 0, unseen: 0, by_severity: {} });
const mockGetAIAlertsSymbolStats = vi.fn().mockResolvedValue({ symbols: [], total_alerts_in_scope: 0, pagination: {} });

vi.mock('../adapters/coreApiAdapter.js', () => ({
  __esModule: true,
  coreApiAdapter: {
    getAlertCenterFeed: (...args) => mockGetAlertCenterFeed(...args),
    getAlertCenterSummary: (...args) => mockGetAlertCenterSummary(...args),
    getAlertCenterSymbolStats: (...args) => mockGetAlertCenterSymbolStats(...args),
    getAIAlertsFeed: (...args) => mockGetAIAlertsFeed(...args),
    getAIAlertsSummary: (...args) => mockGetAIAlertsSummary(...args),
    getAIAlertsSymbolStats: (...args) => mockGetAIAlertsSymbolStats(...args),
  },
}));

import { useAlertCenterData } from './useAlertCenterData.js';

describe('useAlertCenterData', () => {
  let client;

  const wrapper = ({ children }) =>
    React.createElement(QueryClientProvider, { client }, children);

  beforeEach(() => {
    vi.clearAllMocks();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  test('forwards severity and alert_family as comma-joined query params', async () => {
    renderHook(
      () =>
        useAlertCenterData({ lane: 'main', severity: ['critical', 'high'], alertFamily: ['whale', 'dark_flow'] }),
      { wrapper }
    );

    await waitFor(() => expect(mockGetAlertCenterFeed).toHaveBeenCalled());
    const [query] = mockGetAlertCenterFeed.mock.calls[0];
    expect(query.severity).toBe('critical,high');
    expect(query.alert_family).toBe('whale,dark_flow');
  });

  test('omits filter params when empty', async () => {
    renderHook(() => useAlertCenterData({ lane: 'main', severity: [], alertFamily: [] }), { wrapper });

    await waitFor(() => expect(mockGetAlertCenterFeed).toHaveBeenCalled());
    const [query] = mockGetAlertCenterFeed.mock.calls[0];
    expect(query.severity).toBeUndefined();
    expect(query.alert_family).toBeUndefined();
  });

  test('uses AI adapter for ai lane', async () => {
    renderHook(() => useAlertCenterData({ lane: 'ai', severity: ['low'], alertFamily: [] }), { wrapper });

    await waitFor(() => expect(mockGetAIAlertsFeed).toHaveBeenCalled());
    const [query] = mockGetAIAlertsFeed.mock.calls[0];
    expect(query.severity).toBe('low');
  });
});
