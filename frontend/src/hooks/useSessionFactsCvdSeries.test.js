import { act, renderHook, waitFor } from '@testing-library/react';

import useSessionFactsCvdSeries from './useSessionFactsCvdSeries';
import { getSessionFactsCvd } from '../api/client';

jest.mock('../api/client', () => ({
  getSessionFactsCvd: jest.fn(),
}));

describe('useSessionFactsCvdSeries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not refetch when rerendered with a new tradeDates array containing the same values', async () => {
    getSessionFactsCvd.mockResolvedValue({
      data: {
        cvd_series: [],
      },
    });

    const { rerender } = renderHook(
      ({ tradeDates }) => useSessionFactsCvdSeries('HPG', '15m', {
        selectedTradeDate: '2026-05-15',
        tradeDates,
      }),
      { initialProps: { tradeDates: ['2026-05-15'] } },
    );

    await waitFor(() => {
      expect(getSessionFactsCvd).toHaveBeenCalledTimes(1);
    });

    rerender({ tradeDates: ['2026-05-15'] });

    await act(async () => {});

    expect(getSessionFactsCvd).toHaveBeenCalledTimes(1);
    expect(getSessionFactsCvd).toHaveBeenCalledWith('HPG', '15m', '2026-05-15');
  });
});