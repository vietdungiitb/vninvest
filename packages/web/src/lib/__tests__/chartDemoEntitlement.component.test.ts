import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchChartEntitlement,
  mapChartTier,
  preloadChartEntitlement,
  readPreloadedChartTier,
  resetChartEntitlementForTests,
} from '../chartDemoEntitlement.js';

describe('chartDemoEntitlement', () => {
  beforeEach(() => {
    resetChartEntitlementForTests();
  });

  it('maps SaaS tier codes the same way the demo blueprint does', () => {
    expect(mapChartTier('enterprise')).toBe('enterprise');
    expect(mapChartTier('internal')).toBe('enterprise');
    expect(mapChartTier('custom')).toBe('enterprise');
    expect(mapChartTier('pro')).toBe('pro');
    expect(mapChartTier('starter')).toBe('starter');
    expect(mapChartTier('FREE')).toBe('free');
    expect(mapChartTier(undefined)).toBe('free');
  });

  it('asserts the REAL enterprise tier from a fresh preload (positive test)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tier_code: 'enterprise', status: 'active' }),
    });

    const result = await preloadChartEntitlement(fetchImpl);

    expect(result).toEqual({ tier: 'enterprise', active: true });
    expect(readPreloadedChartTier()).toBe('enterprise');
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/v1/entitlement',
      expect.objectContaining({ cache: 'no-store' })
    );
  });

  it('fails closed to free when the server is unavailable (negative test)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false });

    const result = await preloadChartEntitlement(fetchImpl);

    expect(result.tier).toBe('free');
    // Blueprint mirror: free is represented as null on the synchronous read.
    expect(readPreloadedChartTier()).toBeNull();
  });

  it('accepts a flat plan field and rejects a non-active subscription', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ plan: 'pro', status: 'canceled' }),
    });

    const result = await fetchChartEntitlement(fetchImpl);

    expect(result).toEqual({ tier: 'pro', active: false });
  });

  it('starts entitlement preload before the first React render', () => {
    // Source-level guard: the demo fails visibly (FREE flash) if this order flips.
    const source = readFileSync(resolve(process.cwd(), 'src/main.tsx'), 'utf8');
    const preloadIndex = source.indexOf('preloadChartEntitlement()');
    const renderIndex = source.indexOf('root.render(');

    expect(preloadIndex).toBeGreaterThan(-1);
    expect(renderIndex).toBeGreaterThan(preloadIndex);
    expect(source).not.toContain('?enterprise=1');
  });

  it('shares one fetch between concurrent preload callers', async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    const fetchImpl = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
    );

    const first = preloadChartEntitlement(fetchImpl);
    const second = preloadChartEntitlement(fetchImpl);
    resolveFetch({ ok: true, json: async () => ({ tier_code: 'enterprise' }) });
    await Promise.all([first, second]);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
