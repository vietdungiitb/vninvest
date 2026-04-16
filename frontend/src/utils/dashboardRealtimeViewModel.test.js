import {
  buildDashboardRealtimeQuote,
  buildDashboardRealtimeQuoteList,
} from './dashboardRealtimeViewModel';

describe('dashboardRealtimeViewModel', () => {
  test('uses current_price first in realtime mode', () => {
    const record = buildDashboardRealtimeQuote({
      symbol: 'MBB',
      quote: {
        symbol: 'MBB',
        current_price: 26.6,
        prev_price: 26.2,
        change_pct: 1.53,
        stale: false,
        data_semantic: 'realtime',
        market_phase: 'am',
      },
      holding: { symbol: 'MBB', current_price: 26.1 },
    });

    expect(record.current_price).toBe(26.6);
    expect(record.display_price_source).toBe('current_price');
    expect(record.data_semantic).toBe('realtime');
    expect(record.change_pct).toBeCloseTo(1.53, 4);
  });

  test('falls back to prev_price in last_session_close', () => {
    const record = buildDashboardRealtimeQuote({
      symbol: 'MBS',
      quote: {
        symbol: 'MBS',
        current_price: null,
        prev_price: 20.7,
        change_pct: null,
        stale: false,
        data_semantic: 'last_session_close',
        market_phase: 'offhours',
      },
      holding: { symbol: 'MBS', current_price: 20.5 },
    });

    expect(record.current_price).toBe(20.7);
    expect(record.display_price_source).toBe('prev_price');
    expect(record.data_semantic).toBe('last_session_close');
    expect(record.stale).toBe(false);
  });

  test('falls back to holding snapshot when quote prices are missing', () => {
    const record = buildDashboardRealtimeQuote({
      symbol: 'TPB',
      quote: {
        symbol: 'TPB',
        current_price: null,
        prev_price: null,
        change_pct: null,
        stale: true,
        market_phase: 'am',
      },
      holding: { symbol: 'TPB', current_price: 16.4, live_current_price: null },
    });

    expect(record.current_price).toBe(16.4);
    expect(record.display_price_source).toBe('holding_snapshot_price');
    expect(record.data_semantic).toBe('stale_fallback');
    expect(record.stale).toBe(true);
  });

  test('normalizes symbol lookup for quote list', () => {
    const list = buildDashboardRealtimeQuoteList({
      monitoredSymbols: [' acb '],
      quotesBySymbol: {
        ACB: {
          symbol: 'acb',
          current_price: 23.8,
          prev_price: 23.5,
          stale: false,
          market_phase: 'am',
        },
      },
      holdings: [],
    });

    expect(list).toHaveLength(1);
    expect(list[0].symbol).toBe('ACB');
    expect(list[0].current_price).toBe(23.8);
  });
});
