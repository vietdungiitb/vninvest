import { createCoreApiAdapter } from './coreApiAdapter.js';

function normalizeTimeframe(tf) {
  const lower = (tf || '').toLowerCase();
  if (lower === 'd' || lower === '1d') return 'D';
  if (lower === '1h') return '1H';
  return tf;
}

function resolveDays(timeframe, before, limit) {
  const lower = (timeframe || '').toLowerCase();
  let intervalMs = 60 * 60 * 1000;
  if (lower.includes('m')) {
    const mins = parseInt(lower) || 15;
    intervalMs = mins * 60 * 1000;
  } else if (lower.includes('d')) {
    intervalMs = 24 * 60 * 60 * 1000;
  } else if (lower.includes('h')) {
    const hrs = parseInt(lower) || 1;
    intervalMs = hrs * 60 * 60 * 1000;
  }
  const requestedWindowMs = Math.max(1, limit) * intervalMs;
  const anchorWindowMs = Math.max(0, Date.now() - before.getTime());
  return Math.max(1, Math.min(3650, Math.ceil((anchorWindowMs + requestedWindowMs) / 86400000)));
}

function extractPoints(payload) {
  const points = payload.points
    ?? payload.results
    ?? payload.bars
    ?? payload.candles
    ?? payload.data?.points
    ?? (Array.isArray(payload) ? payload : null);
  return Array.isArray(points) ? points : [];
}

function mapToBar(p, i) {
  const date = new Date(p.timestamp ?? p.time ?? p.date);
  return {
    date,
    open: Number(p.open ?? p.close ?? 0),
    high: Number(p.high ?? p.close ?? 0),
    low: Number(p.low ?? p.close ?? 0),
    close: Number(p.close ?? 0),
    volume: Number(p.volume ?? 0),
    index: i,
    dataIndex: i,
  };
}

function parseBars(payload) {
  return extractPoints(payload)
    .map((p, i) => mapToBar(p, i))
    .filter((b) => !isNaN(b.date.getTime()))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function createChartStockDataAdapter({ env }) {
  const coreAdapter = createCoreApiAdapter({ env });

  const adapter = {
    label: 'core-api-adapter',

    getSourceSemantics() {
      return {
        sourceId: 'core-api-adapter',
        sourceContractVersion: 'vnstocks-window-v1',
        instrumentClass: 'equity',
        coverageMode: 'window-hint',
        sessionModel: 'exchange-calendar',
        timezone: 'Asia/Ho_Chi_Minh',
        sessionCalendarId: 'vn-exchange-calendar',
        supportsExactRangeFetch: false,
        supportsBackwardAnchor: true,
        supportsForwardAnchor: false,
        supportsLiveBars: true,
        maxBarsPerRequest: 3650,
        finalityMode: 'historically-correctable',
        expectedGapReasons: ['not-fetched', 'market-closed', 'source-no-data', 'rate-limited', 'boundary-exhausted'],
      };
    },

    async fetchBarsInRange(symbol, timeframe, from, to, chartId) {
      const days = Math.max(1, Math.min(3650, Math.ceil(Math.max(0, Date.now() - from.getTime()) / 86400000)));
      const payload = await coreAdapter.getStockChartHistory(symbol, {
        timeframe: normalizeTimeframe(timeframe),
        days,
      });
      const fromTs = from.getTime();
      const toTs = to.getTime();
      return parseBars(payload).filter((bar) => bar.date.getTime() >= fromTs && bar.date.getTime() <= toTs);
    },

    async fetchBarsBefore(symbol, timeframe, before, limit, chartId) {
      const safeLimit = limit ?? 300;
      const days = resolveDays(timeframe, before, safeLimit);
      const payload = await coreAdapter.getStockChartHistory(symbol, {
        timeframe: normalizeTimeframe(timeframe),
        days,
      });
      const beforeTs = before.getTime();
      return parseBars(payload)
        .filter((bar) => bar.date.getTime() < beforeTs)
        .slice(-safeLimit);
    },

    subscribeToBar(symbol, timeframe, onBar) {
      this._onBarCallback = onBar;
      return () => {
        this._onBarCallback = null;
      };
    },

    pushRealtimeBar(bar) {
      if (this._onBarCallback) {
        this._onBarCallback(bar);
        return true;
      }
      return false;
    },

    subscribeToTrades() {
      return () => {};
    },

    subscribeToOrderbook() {
      return () => {};
    },

    async searchSymbols(query) {
      return [{ symbol: query, name: query, exchange: 'VNINVEST' }];
    },
  };

  return adapter;
}
