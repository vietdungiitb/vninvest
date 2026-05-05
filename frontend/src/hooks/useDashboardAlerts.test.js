import { renderHook } from '@testing-library/react';
import useDashboardAlerts, { buildRecentWhaleAlertMap } from './useDashboardAlerts';

describe('useDashboardAlerts', () => {
  it('prioritizes the newest in-window whale alert per symbol', () => {
    const now = new Date('2026-05-03T09:05:00Z').getTime();

    const alerts = [
      { symbol: 'FPT', ts: '2026-05-03T09:00:00Z', severity: 'medium', side: 'buy', size_class: 'whale', matched_value: 100 },
      { symbol: 'FPT', ts: '2026-05-03T09:03:00Z', severity: 'high', side: 'sell', size_class: 'shark', matched_value: 200 },
      { symbol: 'VNM', ts: '2026-05-03T09:02:00Z', severity: 'critical', side: 'buy', size_class: 'whale', matched_value: 300 },
      { symbol: 'VCB', ts: '2026-05-03T08:50:00Z', severity: 'high', side: 'buy', size_class: 'whale', matched_value: 400 },
    ];

    const result = buildRecentWhaleAlertMap(alerts, { now });
    expect(result.FPT.ts).toBe(new Date('2026-05-03T09:03:00Z').getTime());
    expect(result.VNM.severity).toBe('critical');
    expect(result.VCB).toBeUndefined();
  });

  it('returns priority alerts ordered by severity then time', () => {
    const now = new Date('2026-05-03T09:05:00Z').getTime();

    const { result } = renderHook(() => useDashboardAlerts({
      alerts: [
        { symbol: 'FPT', ts: '2026-05-03T09:03:00Z', severity: 'high', side: 'buy', size_class: 'whale', matched_value: 200 },
        { symbol: 'VNM', ts: '2026-05-03T09:02:00Z', severity: 'critical', side: 'sell', size_class: 'shark', matched_value: 300 },
        { symbol: 'MBB', ts: '2026-05-03T09:04:00Z', severity: 'medium', side: 'buy', size_class: 'whale', matched_value: 150 },
      ],
      now,
    }));

    expect(result.current.priorityAlerts.map((item) => item.symbol)).toEqual(['VNM', 'FPT', 'MBB']);
    expect(result.current.whaleAlertsBySymbol.FPT.severity).toBe('high');
  });
});