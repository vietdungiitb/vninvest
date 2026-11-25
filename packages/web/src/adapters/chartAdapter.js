import { createCoreApiAdapter } from './coreApiAdapter.js';
import { authTokenStorage } from './core/transport.js';
import {
  mapCorporateActionToCorporateEvent,
  mapNewsListToNewsItems,
} from '../utils/corporateEventMapper.js';

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

function mapToBar(p, i, adjusted = false) {
  const date = new Date(p.timestamp ?? p.time ?? p.date);
  // M5c: BE trả close thô + adj_close/adj_factor. Widget OHLCVBar chỉ có
  // 6 field và không tự render adjusted ⇒ host scale CẢ O/H/L/C trước khi
  // truyền widget. Chỉ scale khi đủ điều kiện (cafef + có factor + adj_close).
  const useAdjusted = adjusted
    && p.price_source === 'cafef'
    && p.adj_factor != null
    && p.adj_close != null;
  const factor = useAdjusted ? Number(p.adj_factor) : 1;
  const close = useAdjusted ? Number(p.adj_close) : Number(p.close ?? 0);
  return {
    date,
    open: Number(p.open ?? p.close ?? 0) * factor,
    high: Number(p.high ?? p.close ?? 0) * factor,
    low: Number(p.low ?? p.close ?? 0) * factor,
    close,
    volume: Number(p.volume ?? 0),
    index: i,
    dataIndex: i,
  };
}

export function parseBars(payload, state) {
  const adjusted = payload?.adjusted_display === true;
  const points = extractPoints(payload).filter(
    (p) => !adjusted || p.price_source !== 'unmapped_cafef'
  );
  const sorted = points.sort((a, b) =>
    new Date(a.timestamp ?? a.time ?? a.date).getTime()
    - new Date(b.timestamp ?? b.time ?? b.date).getTime());
  // R-A: basis phải derive từ dữ liệu thực của CHÍNH MÃ này, không phải flag
  // global — nếu không, mã legacy (~98%) cũng bị bỏ nến realtime.
  const newest = sorted[sorted.length - 1];
  const basisAdjusted = Boolean(adjusted && newest
    && newest.price_source === 'cafef'
    && newest.adj_factor != null && newest.adj_close != null);
  if (state) state.priceBasis = basisAdjusted ? 'adjusted' : 'raw';
  return sorted
    .map((p, i) => mapToBar(p, i, adjusted))
    .filter((b) => !isNaN(b.date.getTime()));
}

export function createChartStockDataAdapter({ env = {} }) {
  const coreAdapter = createCoreApiAdapter({
    env,
    getToken: () => authTokenStorage.getAccessToken(),
    getRefreshToken: () => authTokenStorage.getRefreshToken(),
    setTokens: (tokens) => authTokenStorage.setTokens(tokens),
    clearTokens: () => authTokenStorage.clearTokens(),
  });

  // M5c: trạng thái basis của payload gần nhất; đọc qua getPriceBasis().
  const priceBasisState = { priceBasis: 'raw' };

  const adapter = {
    label: 'core-api-adapter',

    getPriceBasis() {
      return priceBasisState.priceBasis;
    },

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
      return parseBars(payload, priceBasisState).filter((bar) => bar.date.getTime() >= fromTs && bar.date.getTime() <= toTs);
    },

    async fetchBarsBefore(symbol, timeframe, before, limit, chartId) {
      const safeLimit = limit ?? 300;
      const days = resolveDays(timeframe, before, safeLimit);
      const payload = await coreAdapter.getStockChartHistory(symbol, {
        timeframe: normalizeTimeframe(timeframe),
        days,
      });
      const beforeTs = before.getTime();
      return parseBars(payload, priceBasisState)
        .filter((bar) => bar.date.getTime() < beforeTs)
        .slice(-safeLimit);
    },

    subscribeToBar(symbol, timeframe, onBar) {
      if (!symbol || typeof onBar !== 'function') return () => {};
      if (!this._barCallbacks) this._barCallbacks = new Map();
      this._barCallbacks.set(symbol, onBar);
      // backward compat: keep single callback for code that reads _onBarCallback
      this._onBarCallback = onBar;
      return () => {
        this._barCallbacks.delete(symbol);
        if (this._barCallbacks.size === 0) this._onBarCallback = null;
        else this._onBarCallback = [...this._barCallbacks.values()].pop();
      };
    },

    pushRealtimeBar(arg1, arg2) {
      let symbol = null;
      let bar = arg1;
      if (typeof arg1 === 'string') {
        symbol = arg1;
        bar = arg2;
      }
      if (!this._barCallbacks || this._barCallbacks.size === 0) {
        // backward compat: single callback
        if (this._onBarCallback) {
          this._onBarCallback(bar);
          return true;
        }
        return false;
      }
      if (symbol) {
        const cb = this._barCallbacks.get(symbol);
        if (cb) { cb(bar); return true; }
        return false;
      }
      // broadcast (single chart or no symbol specified)
      let called = false;
      for (const cb of this._barCallbacks.values()) { cb(bar); called = true; }
      return called;
    },

    subscribeToTrades(symbol, onTrades) {
      if (!symbol || typeof onTrades !== "function") return () => {};
      let active = true;
      let timer = null;
      const poll = () => {
        coreAdapter
          .getRealtimeIntraday(symbol, { page_size: 50 })
          .then((res) => {
            if (!active) return;
            const data = res?.data ?? res;
            const trades = data?.trades ?? data?.results ?? data ?? [];
            if (Array.isArray(trades) && trades.length) onTrades(trades);
          })
          .catch(() => {})
          .finally(() => {
            if (active) timer = setTimeout(poll, 5000);
          });
      };
      poll();
      return () => {
        active = false;
        if (timer) clearTimeout(timer);
      };
    },

    subscribeToOrderbook(symbol, onOrderbook) {
      if (!symbol || typeof onOrderbook !== "function") return () => {};
      let active = true;
      let timer = null;
      const poll = () => {
        coreAdapter
          .getRealtimeDepthChart(symbol)
          .then((res) => {
            if (!active) return;
            const data = res?.data ?? res;
            if (data && (data.bids || data.asks)) onOrderbook(data);
          })
          .catch(() => {})
          .finally(() => {
            if (active) timer = setTimeout(poll, 5000);
          });
      };
      poll();
      return () => {
        active = false;
        if (timer) clearTimeout(timer);
      };
    },

    async searchSymbols(query) {
      try {
        const payload = await coreAdapter.getSymbolList({ q: query, limit: 20 });
        const results = payload?.results ?? payload ?? [];
        if (!Array.isArray(results) || results.length === 0) {
          return [{ symbol: query, name: 'Không tìm thấy', exchange: '' }];
        }
        return results.map((s) => ({
          symbol: s.symbol ?? s.code ?? '',
          name: s.name ?? s.company_name ?? '',
          exchange: s.exchange ?? s.market ?? '',
        }));
      } catch {
        return [{ symbol: query, name: 'Không tìm thấy', exchange: '' }];
      }
    },

    /**
     * Widget goi theo visible range (fromMs/toMs) — tra CorporateEvent[].
     * Widget tu dien timeIndex tu timestamp; fail -> [] (live trung thuc).
     */
    async fetchCorporateEvents(symbol, fromMs, toMs) {
      try {
        if (!symbol || !Number.isFinite(fromMs) || !Number.isFinite(toMs)) return [];
        const from = new Date(fromMs).toISOString().slice(0, 10);
        const to = new Date(toMs).toISOString().slice(0, 10);
        const payload = await coreAdapter.getCorporateActions(symbol, { from, to, limit: 1000 });
        const actions = payload?.actions ?? payload?.data?.actions ?? [];
        if (!Array.isArray(actions)) return [];
        return actions.map(mapCorporateActionToCorporateEvent).filter(Boolean);
      } catch {
        return [];
      }
    },

    /**
     * Widget enterprise presence — tra NewsItem[] hoac null khi khong co tin.
     */
    async fetchSymbolNews(symbol, limit = 20) {
      try {
        if (!symbol) return null;
        const payload = await coreAdapter.getStockNews(symbol, { page_size: limit });
        const news = payload?.news ?? payload?.data?.news ?? [];
        const items = mapNewsListToNewsItems(news, limit).map((item) => ({
          ...item,
          symbol: String(symbol).toUpperCase(),
        }));
        return items.length ? items : null;
      } catch {
        return null;
      }
    },
  };

  return adapter;
}
