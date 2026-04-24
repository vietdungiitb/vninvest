import { buildLiveHoldingsOverlay } from './dashboardRealtimeSelectors';

describe('buildLiveHoldingsOverlay', () => {
  it('propagates quote change_pct into live holdings', () => {
    const result = buildLiveHoldingsOverlay(
      [{ symbol: 'HPG', quantity: 100, avg_cost: 20, cost_basis: 2000, market_value: 2500, current_price: 25 }],
      { HPG: { current_price: 25.5, prev_price: 24.5, change_pct: 4.08 } },
    );

    expect(result[0].live_change_pct).toBeCloseTo(4.08, 2);
  });

  it('derives live change_pct from live and previous price when quote omits change_pct', () => {
    const result = buildLiveHoldingsOverlay(
      [{ symbol: 'HPG', quantity: 100, avg_cost: 20, cost_basis: 2000, market_value: 2500, current_price: 25, prev_close: 24 }],
      { HPG: { current_price: 25.2, prev_price: 24 } },
    );

    expect(result[0].live_change_pct).toBeCloseTo(5, 4);
  });
});