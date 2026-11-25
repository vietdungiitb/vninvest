import { describe, expect, it } from 'vitest';
import { parseBars } from '../chartAdapter.js';

const rows = [
  {
    date: '2022-01-04', open: 43000, high: 43500, low: 42000, close: 42750,
    adj_close: 17940, adj_factor: 0.4196491228, price_source: 'cafef', volume: 1000,
  },
  {
    date: '2022-01-05', open: 42000, high: 42500, low: 41000, close: 42000,
    adj_close: null, adj_factor: null, price_source: 'unmapped_cafef', volume: 900,
  },
  {
    date: '2022-01-06', open: 100, high: 110, low: 90, close: 105,
    adj_close: null, adj_factor: null, price_source: 'vnbroker_legacy', volume: 800,
  },
];

describe('M5c chartAdapter adjusted basis', () => {
  it('flag off: giữ raw close, không lọc dòng nào', () => {
    const state = { priceBasis: 'init' };
    const bars = parseBars({ points: rows, adjusted_display: false }, state);
    expect(bars).toHaveLength(3);
    expect(bars[0].close).toBe(42750);
    expect(bars[0].open).toBe(43000);
    expect(state.priceBasis).toBe('raw');
  });

  it('flag on: scale O/H/L/C, bỏ dòng unmapped_cafef', () => {
    const state = { priceBasis: 'init' };
    const bars = parseBars({ points: rows, adjusted_display: true }, state);
    expect(bars).toHaveLength(2);
    expect(bars[0].close).toBeCloseTo(17940, 2);
    expect(bars[0].open).toBeCloseTo(43000 * 0.4196491228, 2);
    expect(bars[0].high).toBeCloseTo(43500 * 0.4196491228, 2);
    expect(bars[0].low).toBeCloseTo(42000 * 0.4196491228, 2);
    expect(bars[1].close).toBe(105); // legacy fallback raw
    expect(state.priceBasis).toBe('adjusted');
  });
});
