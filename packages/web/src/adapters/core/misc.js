export function createMiscClient({ coreGet, corePost }) {
  return {
    // Called from useWhaleAdvisoryData.js:267 in discovery mode. The
    // `portfolio/market-discovery-hub/` route was missing on the backend, so this
    // call always 404ed. The route now resolves to a stub view that returns an
    // empty hub, so discovery mode degrades instead of throwing.
    getMarketDiscoveryHub() {
      return coreGet("/portfolio/market-discovery-hub/");
    },

    getSectorBreadth(symbol) {
      if (!symbol) throw new Error("symbol is required for getSectorBreadth");
      return coreGet(`/realtime/breadth/${encodeURIComponent(symbol.toUpperCase())}/`);
    },

    getPriceBoard(symbol) {
      if (!symbol) throw new Error("symbol is required for getPriceBoard");
      return coreGet(`/realtime/price-board/${encodeURIComponent(symbol.toUpperCase())}/`);
    },

    getRVOL(symbol) {
      if (!symbol) throw new Error("symbol is required for getRVOL");
      return coreGet(`/realtime/rvol/${encodeURIComponent(symbol.toUpperCase())}/`);
    },

    getSymbolInvestigation(symbol, { window: w = "5d", sort = "created_at", includeCampaigns = true, includeSignals = true } = {}) {
      if (!symbol) throw new Error("symbol is required for getSymbolInvestigation");
      const params = new URLSearchParams();
      if (w) params.set("window", w);
      if (sort) params.set("sort", sort);
      params.set("include_campaigns", String(includeCampaigns));
      params.set("include_signals", String(includeSignals));
      const qs = params.toString();
      return coreGet(`/realtime/symbol-investigation/${encodeURIComponent(symbol.toUpperCase())}/${qs ? `?${qs}` : ""}`);
    },

    getSecuritiesGroups() {
      return coreGet("/stock-management/groups/");
    },

    seedSystemSecurities() {
      return corePost("/stock-management/seed/", {});
    },

    syncSecuritiesPrices(days = 5) {
      return corePost("/stock-management/sync/", { days });
    },

    getHealthChecks() {
      return coreGet("/health/");
    },
  };
}

// Removed: every method below pointed at a route that does not exist in the
// backend and had no call site, so each one could only ever 404.
//   getRealtimeHealth()   -> /core/v1/health/realtime/          (no route)
//   getAIOptions()        -> /core/v1/ai-options/               (no route)
//   syncStockProfile()    -> /core/v1/admin-sync/stockprofile/  (no route)
//   getLegalPages()       -> /core/v1/legal/                    (no route; the real
//     endpoint is the PUBLIC `/api/public/legal-pages/`, which no transport helper
//     reaches because every helper prefixes `/core/v1`).