import {
  normalizePollSymbolCandidates,
  resolveRealtimePollIntervalMs,
} from './useRealtimeFeedLegacy';

describe('useRealtimeFeedLegacy helpers', () => {
  test('flags stale_over_threshold candidates for prioritized retry', () => {
    const result = normalizePollSymbolCandidates(
      ['MWG', 'VCB'],
      {
        MWG: {
          symbol: 'MWG',
          current_price: 65.1,
          stale: false,
          stale_over_threshold: false,
          market_phase: 'am',
        },
        VCB: {
          symbol: 'VCB',
          current_price: 92.5,
          stale: true,
          stale_over_threshold: true,
          stale_threshold_seconds: 10,
          age_seconds: 14,
          market_phase: 'am',
        },
      },
      true,
    );

    expect(result.hasOverThreshold).toBe(true);
    expect(result.symbols).toEqual(['VCB']);
  });

  test('uses 3-second retry interval when over-threshold stale is present', () => {
    const intervalMs = resolveRealtimePollIntervalMs({
      wsHealthy: true,
      hasRecoveryCandidates: false,
      pollInterval: 30000,
      hasOverThresholdCandidates: true,
      staleResyncRetryMs: 3000,
      wsHealthyRecoveryPollIntervalMs: 8000,
      wsHealthyMinPollIntervalMs: 30000,
    });

    expect(intervalMs).toBe(3000);
  });
});
