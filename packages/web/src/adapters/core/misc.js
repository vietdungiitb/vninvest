export function createMiscClient({ coreGet, corePost }) {
  return {
    getRealtimeHealth() {
      return coreGet("/health/realtime/");
    },

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

    getAIOptions() {
      return coreGet("/ai-options/");
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

    syncStockProfile() {
      return corePost("/admin-sync/stockprofile/");
    },

    getLegalPages() {
      return coreGet("/legal/");
    },

    getHealthChecks() {
      return coreGet("/health/");
    },
  };
}
