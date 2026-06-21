export function createAdvisoryClient({ coreGet, corePost, coreDelete }) {
  return {
    getStockAIAdvisorySession(symbol, params = {}) {
      if (!symbol) throw new Error("symbol is required for getStockAIAdvisorySession");
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      ).toString();
      return coreGet(
        `/stock-management/stocks/${encodeURIComponent(symbol.toUpperCase())}/ai-advisory-session/${query ? `?${query}` : ""}`
      );
    },

    refreshStockAIAdvisorySession(symbol) {
      if (!symbol) throw new Error("symbol is required for refreshStockAIAdvisorySession");
      return corePost(`/stock-management/stocks/${encodeURIComponent(symbol.toUpperCase())}/ai-advisory-session/`);
    },

    getStockAIAdvisoryObservability(symbol, params = {}) {
      if (!symbol) throw new Error("symbol is required for getStockAIAdvisoryObservability");
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      ).toString();
      return coreGet(
        `/stock-management/stocks/${encodeURIComponent(symbol.toUpperCase())}/ai-advisory-observability/${query ? `?${query}` : ""}`
      );
    },

    postStockAIAdvisoryObservabilityEvent(symbol, payload = {}) {
      if (!symbol) throw new Error("symbol is required for postStockAIAdvisoryObservabilityEvent");
      return corePost(
        `/stock-management/stocks/${encodeURIComponent(symbol.toUpperCase())}/ai-advisory-observability/`,
        payload
      );
    },

    generateStockAIAdvisoryComponents(symbol, payload = {}) {
      if (!symbol) throw new Error("symbol is required for generateStockAIAdvisoryComponents");
      return corePost(
        `/stock-management/stocks/${encodeURIComponent(symbol.toUpperCase())}/ai-advisory-components/generate/`,
        payload
      );
    },

    toggleStockAIAdvisoryComponentInclude(componentId) {
      if (!componentId) throw new Error("componentId is required for toggleStockAIAdvisoryComponentInclude");
      return corePost(`/stock-management/ai-advisory-components/${encodeURIComponent(componentId)}/toggle-include/`);
    },

    refreshStockAIAdvisoryComponent(componentId) {
      if (!componentId) throw new Error("componentId is required for refreshStockAIAdvisoryComponent");
      return corePost(`/stock-management/ai-advisory-components/${encodeURIComponent(componentId)}/refresh/`);
    },

    restoreStockAIAdvisoryComponent(componentId) {
      if (!componentId) throw new Error("componentId is required for restoreStockAIAdvisoryComponent");
      return corePost(`/stock-management/ai-advisory-components/${encodeURIComponent(componentId)}/restore/`);
    },

    deleteStockAIAdvisoryComponent(componentId) {
      if (!componentId) throw new Error("componentId is required for deleteStockAIAdvisoryComponent");
      return coreDelete(`/stock-management/ai-advisory-components/${encodeURIComponent(componentId)}/`);
    },

    clearDeletedStockAIAdvisoryComponents(symbol) {
      if (!symbol) throw new Error("symbol is required for clearDeletedStockAIAdvisoryComponents");
      return coreDelete(`/stock-management/stocks/${encodeURIComponent(symbol.toUpperCase())}/ai-advisory-components/deleted/`);
    },

    regenerateStockAIExecutiveSummary(symbol, payload = {}) {
      if (!symbol) throw new Error("symbol is required for regenerateStockAIExecutiveSummary");
      return corePost(
        `/stock-management/stocks/${encodeURIComponent(symbol.toUpperCase())}/ai-advisory-summary/regenerate/`,
        payload
      );
    },

    deleteStockAIExecutiveSummary(symbol, summaryId) {
      if (!symbol) throw new Error("symbol is required for deleteStockAIExecutiveSummary");
      if (!summaryId) throw new Error("summaryId is required for deleteStockAIExecutiveSummary");
      return coreDelete(
        `/stock-management/stocks/${encodeURIComponent(symbol.toUpperCase())}/ai-advisory-summary/${encodeURIComponent(summaryId)}/`
      );
    },

    generateStockNewsAISummary(symbol, { force = false } = {}) {
      if (!symbol) throw new Error("symbol is required for generateStockNewsAISummary");
      return corePost(
        `/stock-management/stocks/${encodeURIComponent(symbol.toUpperCase())}/news/ai-summary/`,
        { force_refresh: Boolean(force) }
      );
    },

    getWhaleAdvisories(params = {}) {
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      ).toString();
      return coreGet(`/portfolio/ai-advisory/${query ? `?${query}` : ""}`);
    },

    getCanonicalAIAdvisory(symbol) {
      if (!symbol) throw new Error("symbol is required for getCanonicalAIAdvisory");
      return coreGet(`/portfolio/ai-advisory/${encodeURIComponent(symbol.toUpperCase())}/canonical/`);
    },

    refreshWhaleAdvisory(symbol) {
      if (!symbol) throw new Error("symbol is required for refreshWhaleAdvisory");
      return corePost(`/portfolio/ai-advisory/${encodeURIComponent(symbol.toUpperCase())}/refresh/`);
    },

    deleteCurrentWhaleAdvisory(symbol) {
      if (!symbol) throw new Error("symbol is required for deleteCurrentWhaleAdvisory");
      return coreDelete(`/portfolio/ai-advisory/${encodeURIComponent(symbol.toUpperCase())}/current/`);
    },

    getAdvisoryAutoRefreshInfo(symbol) {
      if (!symbol) throw new Error("symbol is required for getAdvisoryAutoRefreshInfo");
      return coreGet(`/portfolio/ai-advisory/${encodeURIComponent(symbol.toUpperCase())}/auto-refresh-info/`);
    },

    getWhaleAdvisorySymbolStats(params = {}) {
      const query = new URLSearchParams();
      if (params.symbols && Array.isArray(params.symbols)) {
        query.set("symbols", params.symbols.join(","));
      }
      if (params.window) {
        query.set("window", params.window);
      }
      const suffix = query.toString() ? `?${query.toString()}` : "";
      return coreGet(`/portfolio/ai-advisory-symbol-stats/${suffix}`);
    },
  };
}
