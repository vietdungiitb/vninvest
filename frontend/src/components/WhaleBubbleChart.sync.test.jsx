import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor, within } from '@testing-library/react';

import WhaleBubbleChart from './WhaleBubbleChart';
import { getWhaleAnalyticsSnapshot } from '../api/client';
import { useI18n } from '../context/LangContext';

const mockReactEChartsCore = jest.fn();

jest.mock('echarts/core', () => ({
  use: jest.fn(),
}));

jest.mock('echarts/charts', () => ({
  LineChart: {},
  ScatterChart: {},
}));

jest.mock('echarts/components', () => ({
  AxisPointerComponent: {},
  DataZoomComponent: {},
  GraphicComponent: {},
  GridComponent: {},
  MarkLineComponent: {},
  TooltipComponent: {},
}));

jest.mock('echarts/renderers', () => ({
  CanvasRenderer: {},
}));

jest.mock('echarts-for-react/lib/core', () => {
  const ReactLocal = require('react');

  return ReactLocal.forwardRef((props, ref) => {
    mockReactEChartsCore(props);
    return ReactLocal.createElement('div', { 'data-testid': 'mock-echarts', ref });
  });
});

jest.mock('../api/client', () => ({
  getWhaleAnalyticsSnapshot: jest.fn(),
}));

jest.mock('../context/LangContext', () => ({
  useI18n: jest.fn(),
}));

jest.mock('../hooks/useOrderBubbleCoordinates', () => ({
  useOrderBubbleCoordinates: jest.fn(() => ({ buy: [], sell: [], internal: [] })),
}));

jest.mock('../utils/whaleAnalyticsSnapshotAdapter', () => ({
  normalizeWhaleAnalyticsSnapshot: jest.fn((...args) => {
    const actual = jest.requireActual('../utils/whaleAnalyticsSnapshotAdapter');
    return actual.normalizeWhaleAnalyticsSnapshot(...args);
  }),
}));

const routerFuture = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};

function buildWhaleSnapshot(totalOrders, tradeDate) {
  const startIso = `${tradeDate}T09:00:00Z`;
  return {
    symbol: 'HPG',
    timeframe: 'session',
    axis: {
      window_start: startIso,
      window_end: `${tradeDate}T15:00:00Z`,
    },
    summary: {
      whale_order_count: totalOrders,
      extreme_order_count: 1,
    },
    bubble_series: [
      {
        ts: startIso,
        bucket_ts: startIso,
        price: 25000,
        volume: 50000,
        matched_value: 250000000,
        side: 'buy',
        is_extreme: false,
        is_whale: true,
        delta_pct: 0,
        event_score: 80,
      },
      {
        ts: `${tradeDate}T10:00:00Z`,
        bucket_ts: `${tradeDate}T10:00:00Z`,
        price: 25010,
        volume: 51000,
        matched_value: 350000000,
        side: 'sell',
        is_extreme: false,
        is_whale: true,
        delta_pct: 0.2,
        event_score: 81,
      },
      {
        ts: `${tradeDate}T11:00:00Z`,
        bucket_ts: `${tradeDate}T11:00:00Z`,
        price: 25020,
        volume: 52000,
        matched_value: 450000000,
        side: 'internal',
        is_extreme: true,
        is_whale: true,
        delta_pct: 0.4,
        event_score: 82,
      },
    ],
    price_series: [
      {
        bucket_ts: startIso,
        price: 25000,
        reference_price: 25000,
        delta_pct: 0,
      },
      {
        bucket_ts: `${tradeDate}T10:00:00Z`,
        price: 25010,
        reference_price: 25000,
        delta_pct: 0.2,
      },
    ],
    flow_series: {
      cvd: [
        { bucket_ts: startIso, value: 12 },
        { bucket_ts: `${tradeDate}T10:00:00Z`, value: 21 },
        { bucket_ts: `${tradeDate}T11:00:00Z`, value: -8 },
      ],
      buy_strength: [
        { bucket_ts: startIso, value: 45 },
        { bucket_ts: `${tradeDate}T10:00:00Z`, value: 61 },
        { bucket_ts: `${tradeDate}T11:00:00Z`, value: 55 },
      ],
      institutional_strength: [
        { bucket_ts: startIso, value: 52 },
        { bucket_ts: `${tradeDate}T10:00:00Z`, value: 74 },
        { bucket_ts: `${tradeDate}T11:00:00Z`, value: 68 },
      ],
      speed: [
        { bucket_ts: startIso, value: 0.1 },
        { bucket_ts: `${tradeDate}T10:00:00Z`, value: 0.15 },
        { bucket_ts: `${tradeDate}T11:00:00Z`, value: 0.2 },
      ],
    },
    session_levels: {
      reference_price: 25000,
      high_price: 26000,
      low_price: 24000,
      ceiling_price: 27000,
      floor_price: 23000,
    },
    meta: {
      degraded_mode: false,
      stale_reason: null,
      data_state: 'snapshot',
    },
  };
}

function createAbortableSnapshotQueue() {
  const requests = [];

  getWhaleAnalyticsSnapshot.mockImplementation((symbol, params, options = {}) => {
    let resolvePromise;
    let rejectPromise;

    const promise = new Promise((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });

    const request = {
      symbol,
      params,
      signal: options?.signal,
      resolve(snapshot) {
        resolvePromise({ data: snapshot });
      },
      reject(error) {
        rejectPromise(error);
      },
    };

    const abortSignal = options?.signal;
    if (abortSignal) {
      const handleAbort = () => {
        const abortError = new Error('Aborted');
        abortError.name = 'AbortError';
        rejectPromise(abortError);
      };

      if (abortSignal.aborted) {
        handleAbort();
      } else {
        abortSignal.addEventListener('abort', handleAbort, { once: true });
      }
    }

    requests.push(request);
    return promise;
  });

  return requests;
}

describe('WhaleBubbleChart sync and race guards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useI18n.mockReturnValue({
      t: (_key, options) => options?.defaultValue || _key,
    });
  });

  it('syncs a late embedded selectedSymbol prop before holdings are ready', async () => {
    const requests = createAbortableSnapshotQueue();

    const { rerender } = render(
      <MemoryRouter future={routerFuture}>
        <WhaleBubbleChart
          isEmbedded={true}
          selectedSymbol=""
          holdings={[]}
          symbolOptions={[]}
        />
      </MemoryRouter>,
    );

    rerender(
      <MemoryRouter future={routerFuture}>
        <WhaleBubbleChart
          isEmbedded={true}
          selectedSymbol="HPG"
          holdings={[]}
          symbolOptions={[]}
        />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(requests).toHaveLength(1);
    });

    expect(requests[0].symbol).toBe('HPG');
    requests[0].resolve(buildWhaleSnapshot(1, '2026-04-10'));

    expect(await screen.findByText('HPG · session')).toBeInTheDocument();
    expect(getWhaleAnalyticsSnapshot).toHaveBeenCalledTimes(1);
  });

  it('aborts stale drill-down fetches when tradeDate changes quickly', async () => {
    const requests = createAbortableSnapshotQueue();

    const { rerender } = render(
      <MemoryRouter future={routerFuture}>
        <WhaleBubbleChart
          selectedSymbol="HPG"
          holdings={[{ symbol: 'HPG' }]}
          tradeDate="2026-04-10"
        />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(requests).toHaveLength(1);
    });

    expect(requests[0].params.tradeDate).toBe('2026-04-10');

    rerender(
      <MemoryRouter future={routerFuture}>
        <WhaleBubbleChart
          selectedSymbol="HPG"
          holdings={[{ symbol: 'HPG' }]}
          tradeDate="2026-04-11"
        />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(requests).toHaveLength(2);
    });

    expect(requests[0].signal.aborted).toBe(true);
    expect(requests[1].params.tradeDate).toBe('2026-04-11');

    requests[1].resolve(buildWhaleSnapshot(9, '2026-04-11'));

    const totalOrdersLabel = await screen.findByText('Tổng lệnh');
    expect(within(totalOrdersLabel.parentElement).getByText('9')).toBeInTheDocument();
  });
});