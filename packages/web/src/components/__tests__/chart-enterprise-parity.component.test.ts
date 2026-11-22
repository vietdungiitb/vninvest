import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createChartEnterpriseBinding } from '../../lib/chartEnterpriseBinding.js';

describe('chart enterprise demo parity', () => {
  it('exposes a host adapter presence with all six enterprise dock tabs', () => {
    const binding = createChartEnterpriseBinding('VCB');

    expect(binding.symbol).toBe('VCB');
    expect(binding.presence.kind).toBe('host');
    for (const method of [
      'getOrderbookDepthWithNote',
      'getFundamentalsWithNote',
      'fetchCloudAlertsWithNote',
      'fetchWorkspaceSnapshotWithNote',
      'fetchPortfolioAnalyticsWithNote',
      'fetchIndexPanelDataWithNote',
    ]) {
      expect(typeof binding.adapter?.[method], method).toBe('function');
    }
  });

  it('returns every field the widget reads via .length (no undefined arrays)', async () => {
    const adapter = createChartEnterpriseBinding('VCB').adapter!;
    const portfolio = await adapter.fetchPortfolioAnalyticsWithNote!(['VCB']);
    expect(Array.isArray(portfolio.holdings), 'holdings').toBe(true);
    expect(Array.isArray(portfolio.portfolios), 'portfolios').toBe(true);
    const index = await adapter.fetchIndexPanelDataWithNote!('VN30');
    expect(index.count, 'count').toBe(0);
    expect(index.snapshot, 'snapshot').toBeNull();
  });

  it('resolves the preloaded entitlement tier before falling back to subscription', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/VNStockChartPanel.js'),
      'utf8'
    );

    expect(source).toContain('readPreloadedChartTier()');
    expect(source).toContain('enterpriseBinding');
    const preloadIndex = source.indexOf('readPreloadedChartTier()');
    const tierExprIndex = source.indexOf('const tier =');
    expect(tierExprIndex).toBeGreaterThan(preloadIndex);
  });
});
