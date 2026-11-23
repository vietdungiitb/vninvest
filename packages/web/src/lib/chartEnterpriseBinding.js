/**
 * Enterprise dock binding for the chart widget (D2b build @ ddc947dd).
 *
 * The widget owns the six enterprise dock panels; we only supply a host adapter
 * backed by the existing core API adapter. Rule 15: a missing/failed source
 * becomes `{snapshot:null, note}` — never invented data.
 */
import { coreApiAdapter } from '../adapters/coreApiAdapter.js';
import { mapNewsListToNewsItems } from '../utils/corporateEventMapper.js';

const empty = (note) => ({ snapshot: null, note });

async function withNote(call, note, map) {
  try {
    const raw = await call();
    const snapshot = map ? map(raw) : raw;
    return snapshot ? { snapshot, note: null } : empty(note);
  } catch {
    return empty(note);
  }
}

const asRows = (raw) => (Array.isArray(raw) ? raw : (raw?.results ?? raw?.items ?? []));

/**
 * @param {object} baseAdapter chart adapter (StockDataAdapter) to extend
 * @returns {object} EnterprisePanelAdapter-shaped object
 */
export function createChartEnterpriseAdapter(baseAdapter = {}) {
  return {
    ...baseAdapter,
    getOrderbookDepthWithNote: (symbol) =>
      withNote(
        () => coreApiAdapter.getRealtimeDepthChart(symbol),
        'orderbook_not_available',
        (raw) => (raw && {
          symbol: raw.symbol ?? symbol,
          bids: raw.bids ?? [],
          asks: raw.asks ?? [],
          spread: raw.spread ?? null,
          timestamp: raw.timestamp ?? null,
        })
      ),
    getFundamentalsWithNote: (symbol) =>
      withNote(
        () => coreApiAdapter.getStockFinancials(symbol),
        'fundamentals_unavailable',
        (raw) => raw ?? null
      ),
    fetchCloudAlertsWithNote: () =>
      withNote(
        () => coreApiAdapter.getPriceAlerts(),
        'cloud_alert_unavailable',
        (raw) => ({ records: asRows(raw), note: null })
      ),
    /**
     * Enterprise presence `fetchSymbolNews` (Task 3) — tra NewsItem[]|null
     * (khong WithNote: widget can gia tri that, khong can snapshot/note).
     * Hien chua co consumer UI trong bundle 0.4.7-ent (xem REQ_WIDGET_* RQ-1).
     */
    fetchSymbolNews: async (symbol, limit = 20) => {
      try {
        if (!symbol) return null;
        const payload = await coreApiAdapter.getStockNews(symbol, { page_size: limit });
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
    fetchWorkspaceSnapshotWithNote: () =>
      withNote(
        () => coreApiAdapter.getWatchlists(),
        'workspace_unavailable',
        (raw) => ({ watchlists: asRows(raw) })
      ),
    fetchPortfolioAnalyticsWithNote: async (symbols) => {
      const base = {
        symbols: [...(symbols ?? [])],
        // PortfolioPanelLike requires `holdings` — widget reads `.length`.
        holdings: [],
        reasons: { nav: null, bySymbol: {} },
      };
      try {
        const raw = await coreApiAdapter.getPortfolios();
        return { ...base, portfolios: asRows(raw), note: null };
      } catch {
        return { ...base, portfolios: [], note: 'portfolio_analytics_unavailable' };
      }
    },
    // Backend has no public constituents endpoint in the demo reference set;
    // an honest note is better than an empty array presented as real data.
    fetchIndexPanelDataWithNote: (index) =>
      Promise.resolve(empty('index_constituents_unavailable')).then((value) => ({
        ...value,
        index,
        // IndexPanelLike requires `count` and `snapshot` (widget reads `.length`).
        count: 0,
        snapshot: null,
      })),
  };
}

/** @returns {import('@vninvestcharts/widget').EnterpriseDockBinding} */
export function createChartEnterpriseBinding(symbol, options = {}) {
  const { baseAdapter, index = 'VN30', onSymbolSelect } = options;
  const adapter = createChartEnterpriseAdapter(baseAdapter);
  return {
    adapter,
    presence: { kind: 'host', adapter },
    symbol,
    index,
    ...(onSymbolSelect ? { onSymbolSelect } : {}),
  };
}
