import { renderHook, waitFor } from '@testing-library/react';

import { useWhaleAdvisoryData } from './useWhaleAdvisoryData';
import {
  getCanonicalAIAdvisory,
  getHoldings,
  getTrackedSymbols,
  getWhaleAdvisories,
  getWhaleAdvisorySymbolStats,
} from '../api/client';

const mockTranslate = jest.fn((key, options) => options?.defaultValue || key);

jest.mock('../api/client', () => ({
  getCanonicalAIAdvisory: jest.fn(),
  getHoldings: jest.fn(),
  getTrackedSymbols: jest.fn(),
  getWhaleAdvisories: jest.fn(),
  getMarketDiscoveryHub: jest.fn(),
  getWhaleAdvisorySymbolStats: jest.fn(),
  getAdvisoryAutoRefreshInfo: jest.fn(),
  refreshWhaleAdvisory: jest.fn(),
  deleteCurrentWhaleAdvisory: jest.fn(),
}));

jest.mock('../context/LangContext', () => ({
  useI18n: () => ({
    t: mockTranslate,
  }),
}));

describe('useWhaleAdvisoryData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('falls back to holdings and canonical advisories when native list and stats endpoints are empty', async () => {
    getWhaleAdvisories.mockResolvedValue({ data: { items: [] } });
    getWhaleAdvisorySymbolStats.mockResolvedValue({ data: { stats: [] } });
    getHoldings.mockResolvedValue({ data: [{ symbol: 'HPG' }] });
    getTrackedSymbols.mockResolvedValue({ data: [] });
    getCanonicalAIAdvisory.mockResolvedValue({
      data: {
        id: 'adv-1',
        symbol: 'HPG',
        recommendation: 'BUY',
        summary_text: 'Dòng tiền tích cực.',
        created_at: '2026-05-15T09:00:00Z',
        matched_value: 1250000000,
        whale_intensity: 82,
      },
    });

    const { result } = renderHook(() => useWhaleAdvisoryData(false, false, { activePortfolioId: 1 }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.items).toEqual([
        expect.objectContaining({
          symbol: 'HPG',
          side: 'BUY',
          whale_intensity: 82,
        }),
      ]);
    });

    expect(result.current.symbolStats).toEqual([
      expect.objectContaining({
        symbol: 'HPG',
        whaleIntensity: 82,
        buyCount: 1,
        sellCount: 0,
        count: 1,
      }),
    ]);
    expect(getCanonicalAIAdvisory).toHaveBeenCalledWith('HPG');
  });
});