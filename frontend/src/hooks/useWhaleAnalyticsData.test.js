import { renderHook, act, waitFor } from '@testing-library/react';

import useWhaleAnalyticsData from './useWhaleAnalyticsData';
import { getWhaleAnalyticsSnapshot } from '../api/client';
import { resolveWhaleTimeframeWindow } from '../utils/whaleTimeAdapter';
import { mergeWhaleAnalyticsSnapshots, normalizeWhaleAnalyticsSnapshot } from '../utils/whaleAnalyticsSnapshotAdapter';

jest.mock('../api/client', () => ({
  getWhaleAnalyticsSnapshot: jest.fn(),
}));

jest.mock('../utils/whaleTimeAdapter', () => ({
  resolveWhaleTimeframeWindow: jest.fn(),
}));

jest.mock('../utils/whaleAnalyticsSnapshotAdapter', () => ({
  normalizeWhaleAnalyticsSnapshot: jest.fn(),
  mergeWhaleAnalyticsSnapshots: jest.fn(),
}));

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useWhaleAnalyticsData', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    resolveWhaleTimeframeWindow.mockReturnValue({ isLive: false });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('fetches and normalizes the snapshot on first load', async () => {
    const snapshot = { symbol: 'HPG' };
    const normalized = {
      bubbles: { symbol: 'HPG' },
      flow: { dark_flow: { strength: 42 } },
      meta: { data_state: 'snapshot' },
    };

    getWhaleAnalyticsSnapshot.mockResolvedValue({ data: snapshot });
    normalizeWhaleAnalyticsSnapshot.mockReturnValue(normalized);

    const { result } = renderHook(() => useWhaleAnalyticsData('HPG', 'session'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual(normalized);
    });

    expect(getWhaleAnalyticsSnapshot).toHaveBeenCalledWith('HPG', { timeframe: 'session', compact: 0, tradeDate: null, includeBaseline: undefined });
    expect(normalizeWhaleAnalyticsSnapshot).toHaveBeenCalledWith(snapshot, 'session');
    expect(result.current.error).toBe(null);
  });

  it('forwards includeBaseline when chart mode disables percentile work', async () => {
    const normalized = {
      bubbles: { symbol: 'HPG' },
      flow: { dark_flow: { strength: 14 } },
      meta: { data_state: 'snapshot' },
    };

    getWhaleAnalyticsSnapshot.mockResolvedValue({ data: { symbol: 'HPG' } });
    normalizeWhaleAnalyticsSnapshot.mockReturnValue(normalized);

    renderHook(() => useWhaleAnalyticsData('HPG', '1H', null, { includeBaseline: false }));

    await waitFor(() => {
      expect(getWhaleAnalyticsSnapshot).toHaveBeenCalledWith('HPG', {
        timeframe: '1H',
        compact: 0,
        tradeDate: null,
        includeBaseline: false,
      });
    });
  });

  it('forwards selected trade date for session-scoped chart requests', async () => {
    const normalized = {
      bubbles: { symbol: 'HPG' },
      flow: { dark_flow: { strength: 19 } },
      meta: { data_state: 'snapshot' },
    };

    getWhaleAnalyticsSnapshot.mockResolvedValue({ data: { symbol: 'HPG' } });
    normalizeWhaleAnalyticsSnapshot.mockReturnValue(normalized);

    renderHook(() => useWhaleAnalyticsData('HPG', '15m', '2026-04-28', { includeBaseline: false }));

    await waitFor(() => {
      expect(getWhaleAnalyticsSnapshot).toHaveBeenCalledWith('HPG', {
        timeframe: '15m',
        compact: 0,
        tradeDate: '2026-04-28',
        includeBaseline: false,
      });
    });
  });

  it('fetches and merges multiple trade-date snapshots for chart history', async () => {
    const merged = {
      bubbles: { symbol: 'HPG' },
      flow: { dark_flow: { strength: 21 } },
      meta: { merged_trade_dates: ['2026-04-28', '2026-04-29'] },
    };

    getWhaleAnalyticsSnapshot
      .mockResolvedValueOnce({ data: { symbol: 'HPG', trade_date: '2026-04-28' } })
      .mockResolvedValueOnce({ data: { symbol: 'HPG', trade_date: '2026-04-29' } });
    normalizeWhaleAnalyticsSnapshot
      .mockReturnValueOnce({ flow: { view_model: { sessionContext: { defaultTradeDate: '2026-04-28' } } } })
      .mockReturnValueOnce({ flow: { view_model: { sessionContext: { defaultTradeDate: '2026-04-29' } } } });
    mergeWhaleAnalyticsSnapshots.mockReturnValue(merged);

    const { result } = renderHook(() => useWhaleAnalyticsData('HPG', 'session', null, {
      includeBaseline: false,
      tradeDates: ['2026-04-28', '2026-04-29'],
      selectedTradeDate: '2026-04-29',
    }));

    await waitFor(() => {
      expect(getWhaleAnalyticsSnapshot).toHaveBeenNthCalledWith(1, 'HPG', {
        timeframe: 'session',
        compact: 0,
        tradeDate: '2026-04-28',
        includeBaseline: false,
      });
      expect(getWhaleAnalyticsSnapshot).toHaveBeenNthCalledWith(2, 'HPG', {
        timeframe: 'session',
        compact: 0,
        tradeDate: '2026-04-29',
        includeBaseline: false,
      });
      expect(mergeWhaleAnalyticsSnapshots).toHaveBeenCalledWith(expect.any(Array), 'session', '2026-04-29');
      expect(result.current.data).toEqual(merged);
    });
  });

  it('pauses background polling when hidden and refetches immediately when visible again', async () => {
    jest.useFakeTimers();
    resolveWhaleTimeframeWindow.mockReturnValue({ isLive: true });
    const normalized = {
      bubbles: { symbol: 'HPG' },
      flow: { dark_flow: { strength: 0 } },
      meta: { data_state: 'live' },
    };

    getWhaleAnalyticsSnapshot.mockResolvedValue({ data: { symbol: 'HPG' } });
    normalizeWhaleAnalyticsSnapshot.mockReturnValue(normalized);
    mergeWhaleAnalyticsSnapshots.mockImplementation((snapshots) => snapshots[0]);

    renderHook(() => useWhaleAnalyticsData('HPG', 'session'));

    await waitFor(() => {
      expect(getWhaleAnalyticsSnapshot).toHaveBeenCalledTimes(1);
    });

    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'hidden',
      });
      jest.advanceTimersByTime(30000);
    });

    expect(getWhaleAnalyticsSnapshot).toHaveBeenCalledTimes(1);

    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'visible',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => {
      expect(getWhaleAnalyticsSnapshot).toHaveBeenCalledTimes(2);
    });

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(getWhaleAnalyticsSnapshot).toHaveBeenCalledTimes(3);
    });
  });

  it('drops stale responses when symbol changes before the first request finishes', async () => {
    resolveWhaleTimeframeWindow.mockReturnValue({ isLive: false });
    const firstRequest = createDeferred();
    const secondRequest = createDeferred();
    const normalizedFirst = {
      bubbles: { symbol: 'HPG' },
      flow: { dark_flow: { strength: 11 } },
      meta: { data_state: 'snapshot' },
    };
    const normalizedSecond = {
      bubbles: { symbol: 'VCB' },
      flow: { dark_flow: { strength: 77 } },
      meta: { data_state: 'snapshot' },
    };

    getWhaleAnalyticsSnapshot
      .mockImplementationOnce(() => firstRequest.promise)
      .mockImplementationOnce(() => secondRequest.promise);
    normalizeWhaleAnalyticsSnapshot.mockImplementation((snapshot) => {
      if (snapshot?.symbol === 'VCB') {
        return normalizedSecond;
      }
      return normalizedFirst;
    });
    mergeWhaleAnalyticsSnapshots.mockImplementation((snapshots) => snapshots[snapshots.length - 1]);

    const { result, rerender } = renderHook(
      ({ symbol, timeframe }) => useWhaleAnalyticsData(symbol, timeframe),
      { initialProps: { symbol: 'HPG', timeframe: 'session' } },
    );

    rerender({ symbol: 'VCB', timeframe: 'session' });

    await act(async () => {
      secondRequest.resolve({ data: { symbol: 'VCB' } });
    });

    await waitFor(() => {
      expect(result.current.data).toEqual(normalizedSecond);
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      firstRequest.resolve({ data: { symbol: 'HPG' } });
    });

    expect(result.current.data).toEqual(normalizedSecond);
    expect(result.current.error).toBe(null);
  });
});