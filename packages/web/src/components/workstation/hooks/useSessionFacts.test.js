/**
 * useSessionFacts.test.js
 * Unit tests for the session facts hook
 */
import { jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react';

// Create mock adapter
const mockAdapter = {
  getStockOverview: jest.fn(),
};

// Mock the coreApiAdapter module
// `jest.mock` chứ KHÔNG `jest.unstable_mockModule`: babel ép hook về CommonJS,
// còn `unstable_mockModule` chỉ chặn ESM `import()` ⇒ mock im lặng không ăn.
// `unstable_mockModule`, not `jest.mock`: package.json has `"type": "module"`,
// so `.js` is native ESM and `jest.mock` becomes a `require` call that throws
// `ReferenceError: require is not defined`. See useOrderBook.test.js.
jest.unstable_mockModule('../../../adapters/coreApiAdapter.js', () => ({
  createCoreApiAdapter: jest.fn(() => mockAdapter),
}));

// Top-level `await` không transform được trong CJS của Jest ⇒ suite chết.
// Gộp vào `beforeAll` để giữ thứ tự "đăng ký mock → import module".
let useSessionFacts;

beforeAll(async () => {
  ({ useSessionFacts } = await import('./useSessionFacts.js'));
});

describe('useSessionFacts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAdapter.getStockOverview.mockReset();
  });

  test('fetches session facts from overview on mount', async () => {
    const mockOverview = {
      symbol: 'FPT',
      current_price: 100000,
      total_buy_qty: 800000,
      total_sell_qty: 700000,
      institutional_buy: 0.55,
      retail_buy: 0.68,
      cvd_normalized: 0.42,
      whale_net_flow: 5000000000,
      dark_flow_score: 0.12,
      session_facts_date: '2026-06-19',
      session_facts_source: 'computed',
    };

    mockAdapter.getStockOverview.mockResolvedValue({ data: mockOverview });

    const { result } = renderHook(() =>
      useSessionFacts({
        symbol: 'FPT',
        env: { CORE_API_BASE_URL: '/core/v1' },
        getToken: () => 'test-token',
        enabled: true,
      })
    );

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.sessionFacts).toEqual({
      total_buy_qty: 800000,
      total_sell_qty: 700000,
      institutional_buy: 0.55,
      retail_buy: 0.68,
      cvd_normalized: 0.42,
      whale_net_flow: 5000000000,
      dark_flow_score: 0.12,
      session_facts_date: '2026-06-19',
      session_facts_source: 'computed',
    });
    expect(result.current.error).toBeNull();
    expect(mockAdapter.getStockOverview).toHaveBeenCalledWith('FPT');
  });

  test('handles missing session facts fields gracefully', async () => {
    const mockOverview = {
      symbol: 'FPT',
      current_price: 100000,
      // No session facts fields
    };

    mockAdapter.getStockOverview.mockResolvedValue({ data: mockOverview });

    const { result } = renderHook(() =>
      useSessionFacts({
        symbol: 'FPT',
        env: { CORE_API_BASE_URL: '/core/v1' },
        getToken: () => 'test-token',
        enabled: true,
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.sessionFacts).toEqual({
      total_buy_qty: undefined,
      total_sell_qty: undefined,
      institutional_buy: undefined,
      retail_buy: undefined,
      cvd_normalized: undefined,
      whale_net_flow: undefined,
      dark_flow_score: undefined,
      session_facts_date: undefined,
      session_facts_source: undefined,
    });
    expect(result.current.error).toBeNull();
  });

  test('handles fetch error', async () => {
    mockAdapter.getStockOverview.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() =>
      useSessionFacts({
        symbol: 'FPT',
        env: { CORE_API_BASE_URL: '/core/v1' },
        getToken: () => 'test-token',
        enabled: true,
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Network error');
    expect(result.current.sessionFacts).toBeNull();
  });

  test('does not fetch when symbol is not provided', async () => {
    const { result } = renderHook(() =>
      useSessionFacts({
        symbol: '',
        env: { CORE_API_BASE_URL: '/core/v1' },
        getToken: () => 'test-token',
        enabled: true,
      })
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(mockAdapter.getStockOverview).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  test('refresh triggers new fetch', async () => {
    const mockOverview = {
      symbol: 'FPT',
      total_buy_qty: 800000,
      total_sell_qty: 700000,
    };

    mockAdapter.getStockOverview.mockResolvedValue({ data: mockOverview });

    const { result } = renderHook(() =>
      useSessionFacts({
        symbol: 'FPT',
        env: { CORE_API_BASE_URL: '/core/v1' },
        getToken: () => 'test-token',
        enabled: true,
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    mockAdapter.getStockOverview.mockClear();

    act(() => {
      result.current.refresh();
    });

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockAdapter.getStockOverview).toHaveBeenCalledWith('FPT');
  });

  test('respects enabled prop', async () => {
    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useSessionFacts({
          symbol: 'FPT',
          env: { CORE_API_BASE_URL: '/core/v1' },
          getToken: () => 'test-token',
          enabled,
        }),
      { initialProps: { enabled: false } }
    );

    expect(result.current.loading).toBe(false);
    expect(mockAdapter.getStockOverview).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockAdapter.getStockOverview).toHaveBeenCalledWith('FPT');
  });
});