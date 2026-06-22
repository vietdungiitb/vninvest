/**
 * useOrderBook.test.js
 * Unit tests for the order book hook
 */
import { jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react';

// Create mock adapter
const mockAdapter = {
  getRealtimeDepthChart: jest.fn(),
};

jest.unstable_mockModule('../../../adapters/coreApiAdapter.js', () => ({
  createCoreApiAdapter: jest.fn(() => mockAdapter),
}));

const { useOrderBook } = await import('./useOrderBook.js');

describe('useOrderBook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAdapter.getRealtimeDepthChart.mockReset();
  });

  test('fetches order book on mount', async () => {
    const mockData = {
      symbol: 'FPT',
      bids: [
        { price: 99999.95, volume: 6000, orders: 25 },
        { price: 99999.90, volume: 4500, orders: 18 },
        { price: 99999.85, volume: 3000, orders: 12 },
      ],
      asks: [
        { price: 100000.00, volume: 6000, orders: 30 },
        { price: 100000.05, volume: 4500, orders: 22 },
        { price: 100000.10, volume: 3000, orders: 15 },
      ],
      spread: 0.05,
      timestamp: new Date().toISOString(),
    };

    mockAdapter.getRealtimeDepthChart.mockResolvedValue({ data: mockData });

    const { result } = renderHook(() =>
      useOrderBook({
        symbol: 'FPT',
        env: { CORE_API_BASE_URL: '/core/v1' },
        getToken: () => 'test-token',
        enabled: true,
      })
    );

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.orderBook).toEqual(mockData);
    expect(result.current.error).toBeNull();
    expect(mockAdapter.getRealtimeDepthChart).toHaveBeenCalledWith('FPT');
  });

  test('handles fetch error', async () => {
    mockAdapter.getRealtimeDepthChart.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() =>
      useOrderBook({
        symbol: 'FPT',
        env: { CORE_API_BASE_URL: '/core/v1' },
        getToken: () => 'test-token',
        enabled: true,
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Network error');
    expect(result.current.orderBook).toBeNull();
  });

  test('does not fetch when symbol is not provided', async () => {
    const { result } = renderHook(() =>
      useOrderBook({
        symbol: '',
        env: { CORE_API_BASE_URL: '/core/v1' },
        getToken: () => 'test-token',
        enabled: true,
      })
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(mockAdapter.getRealtimeDepthChart).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  test('refresh triggers new fetch', async () => {
    const mockData = {
      symbol: 'FPT',
      bids: [],
      asks: [],
      spread: 0,
      timestamp: new Date().toISOString(),
    };

    mockAdapter.getRealtimeDepthChart.mockResolvedValue({ data: mockData });

    const { result } = renderHook(() =>
      useOrderBook({
        symbol: 'FPT',
        env: { CORE_API_BASE_URL: '/core/v1' },
        getToken: () => 'test-token',
        enabled: true,
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Clear mock to track new call
    mockAdapter.getRealtimeDepthChart.mockClear();

    // Trigger refresh
    act(() => {
      result.current.refresh();
    });

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockAdapter.getRealtimeDepthChart).toHaveBeenCalledWith('FPT');
  });

  test('stopPolling and startPolling control polling', async () => {
    mockAdapter.getRealtimeDepthChart.mockResolvedValue({ data: { bids: [], asks: [], spread: 0 } });

    const { result } = renderHook(() =>
      useOrderBook({
        symbol: 'FPT',
        env: { CORE_API_BASE_URL: '/core/v1' },
        getToken: () => 'test-token',
        enabled: true,
        intervalMs: 5000,
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Stop polling
    act(() => {
      result.current.stopPolling();
    });

    expect(result.current.isPolling).toBe(false);

    // Start polling
    act(() => {
      result.current.startPolling();
    });

    expect(result.current.isPolling).toBe(true);
  });

  test('respects enabled prop', async () => {
    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useOrderBook({
          symbol: 'FPT',
          env: { CORE_API_BASE_URL: '/core/v1' },
          getToken: () => 'test-token',
          enabled,
        }),
      { initialProps: { enabled: false } }
    );

    expect(result.current.loading).toBe(false);
    expect(mockAdapter.getRealtimeDepthChart).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockAdapter.getRealtimeDepthChart).toHaveBeenCalledWith('FPT');
  });
});