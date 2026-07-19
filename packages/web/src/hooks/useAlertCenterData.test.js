/**
 * useAlertCenterData.test.js
 * Verifies severity / alert_family filters are forwarded into the query string.
 */
import { jest } from '@jest/globals';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockGetAlertCenterFeed = jest.fn().mockResolvedValue({ results: [], next: null, previous: null });
const mockGetAlertCenterSummary = jest.fn().mockResolvedValue({ total: 0, unseen: 0, by_severity: {} });
const mockGetAlertCenterSymbolStats = jest.fn().mockResolvedValue({ symbols: [], total_alerts_in_scope: 0, pagination: {} });
const mockGetAIAlertsFeed = jest.fn().mockResolvedValue({ results: [], next: null, previous: null });
const mockGetAIAlertsSummary = jest.fn().mockResolvedValue({ total: 0, unseen: 0, by_severity: {} });
const mockGetAIAlertsSymbolStats = jest.fn().mockResolvedValue({ symbols: [], total_alerts_in_scope: 0, pagination: {} });

jest.mock('../adapters/coreApiAdapter.js', () => ({
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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('forwards severity and alert_family as comma-joined query params', async () => {
    renderHook(() =>
      useAlertCenterData({ lane: 'main', severity: ['critical', 'high'], alertFamily: ['whale', 'dark_flow'] })
    );

    await waitFor(() => expect(mockGetAlertCenterFeed).toHaveBeenCalled());
    const [query] = mockGetAlertCenterFeed.mock.calls[0];
    expect(query.severity).toBe('critical,high');
    expect(query.alert_family).toBe('whale,dark_flow');
  });

  test('omits filter params when empty', async () => {
    renderHook(() => useAlertCenterData({ lane: 'main', severity: [], alertFamily: [] }));

    await waitFor(() => expect(mockGetAlertCenterFeed).toHaveBeenCalled());
    const [query] = mockGetAlertCenterFeed.mock.calls[0];
    expect(query.severity).toBeUndefined();
    expect(query.alert_family).toBeUndefined();
  });

  test('uses AI adapter for ai lane', async () => {
    renderHook(() => useAlertCenterData({ lane: 'ai', severity: ['low'], alertFamily: [] }));

    await waitFor(() => expect(mockGetAIAlertsFeed).toHaveBeenCalled());
    const [query] = mockGetAIAlertsFeed.mock.calls[0];
    expect(query.severity).toBe('low');
  });
});
