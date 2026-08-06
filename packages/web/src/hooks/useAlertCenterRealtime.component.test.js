/**
 * useAlertCenterRealtime.component.test.js
 * Unit tests for the AlertCenter realtime feed wrapper.
 * Mocks useRealtimeFeedCore (the heavy WS client) and asserts merge/dedupe/status.
 * Migrated to vitest (component test convention) — jest 29 ESM (VM modules)
 * cannot hoist jest.mock (require is not defined), vitest handles vi.mock natively.
 */
import { describe, test, expect, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useRealtimeFeedCore from './useRealtimeFeedCore.js';
import { useAlertCenterRealtime } from './useAlertCenterRealtime.js';

vi.mock('./useRealtimeFeedCore.js', () => ({
  __esModule: true,
  default: vi.fn(),
}));

function buildFeed({ alerts = [], darkFlowAlerts = [], realtimeStatus = 'live', lastEventAt = null, connectionState = {} } = {}) {
  return {
    alerts,
    darkFlowAlerts,
    realtimeStatus,
    lastEventAt,
    metrics: { connectionState, eventCounts: {} },
  };
}

describe('useAlertCenterRealtime', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test('subscribes to market_discovery group via core hook', () => {
    useRealtimeFeedCore.mockReturnValue(buildFeed());
    renderHook(() => useAlertCenterRealtime({ enabled: true }));
    expect(useRealtimeFeedCore).toHaveBeenCalledWith(
      expect.objectContaining({
        symbols: ['market_discovery'],
        enabled: true,
        pollInterval: 30000,
      })
    );
  });

  test('merges whale alerts and dark-flow alerts, newest first', () => {
    useRealtimeFeedCore.mockReturnValue(
      buildFeed({
        alerts: [{ event_id: 'w1', symbol: 'HPG', ts: '2026-07-18T09:00:00Z' }],
        darkFlowAlerts: [{ event_id: 'd1', symbol: 'FPT', ts: '2026-07-18T10:00:00Z' }],
      })
    );
    const { result } = renderHook(() => useAlertCenterRealtime());
    expect(result.current.realtimeAlerts).toHaveLength(2);
    // Newest (FPT 10:00) first.
    expect(result.current.realtimeAlerts[0].symbol).toBe('FPT');
  });

  test('dedupes by event_id across whale and dark-flow streams', () => {
    useRealtimeFeedCore.mockReturnValue(
      buildFeed({
        alerts: [{ event_id: 'dup', symbol: 'HPG', ts: '2026-07-18T09:00:00Z' }],
        darkFlowAlerts: [{ event_id: 'dup', symbol: 'HPG', ts: '2026-07-18T09:05:00Z' }],
      })
    );
    const { result } = renderHook(() => useAlertCenterRealtime());
    expect(result.current.realtimeAlerts).toHaveLength(1);
  });

  test('exposes realtimeStatus from core hook', () => {
    useRealtimeFeedCore.mockReturnValue(buildFeed({ realtimeStatus: 'polling' }));
    const { result } = renderHook(() => useAlertCenterRealtime());
    expect(result.current.realtimeStatus).toBe('polling');
  });

  test('does not open WS when enabled is false', () => {
    useRealtimeFeedCore.mockReturnValue(buildFeed());
    renderHook(() => useAlertCenterRealtime({ enabled: false }));
    expect(useRealtimeFeedCore).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false })
    );
  });

  test('updates merged alerts when underlying feed changes', () => {
    useRealtimeFeedCore.mockReturnValue(buildFeed({ alerts: [] }));
    const { result, rerender } = renderHook(
      ({ feed }) => {
        useRealtimeFeedCore.mockReturnValue(feed);
        return useAlertCenterRealtime();
      },
      { initialProps: { feed: buildFeed({ alerts: [] }) } }
    );
    expect(result.current.realtimeAlerts).toHaveLength(0);

    const nextFeed = buildFeed({ alerts: [{ event_id: 'w2', symbol: 'SSI', ts: '2026-07-18T11:00:00Z' }] });
    act(() => {
      rerender({ feed: nextFeed });
    });
    expect(result.current.realtimeAlerts).toHaveLength(1);
    expect(result.current.realtimeAlerts[0].symbol).toBe('SSI');
  });
});
