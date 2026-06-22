export function createScreenerClient({ coreGet, corePost, corePut, coreDelete }) {
  return {
    getAdminScreenerConfig() {
      return coreGet("/portfolio/admin/screener/config/");
    },

    updateAdminScreenerConfig(payload) {
      return corePut("/portfolio/admin/screener/config/", payload);
    },

    getAdminGlobalScreenerRules() {
      return coreGet("/portfolio/admin/screener/rules/");
    },

    createAdminGlobalScreenerRule(payload) {
      return corePost("/portfolio/admin/screener/rules/", payload);
    },

    updateAdminGlobalScreenerRule(id, payload) {
      if (!id) throw new Error("id is required for updateAdminGlobalScreenerRule");
      return corePut(`/portfolio/admin/screener/rules/${encodeURIComponent(id)}/`, payload);
    },

    deleteAdminGlobalScreenerRule(id) {
      if (!id) throw new Error("id is required for deleteAdminGlobalScreenerRule");
      return coreDelete(`/portfolio/admin/screener/rules/${encodeURIComponent(id)}/`);
    },

    runAdminGlobalScreenerManual() {
      return corePost("/portfolio/admin/screener/run-manual/");
    },

    runScreener(ruleId, params = {}) {
      if (!ruleId) throw new Error("ruleId is required for runScreener");
      return corePost(`/portfolio/screener/rules/${encodeURIComponent(ruleId)}/run/`, params);
    },

    getScreenerResults(ruleId, params = {}) {
      if (!ruleId) throw new Error("ruleId is required for getScreenerResults");
      const qs = new URLSearchParams(params).toString();
      return coreGet(`/portfolio/screener/rules/${encodeURIComponent(ruleId)}/results/${qs ? `?${qs}` : ""}`);
    },

    createAdminScreenerConfig(payload) {
      return corePost("/portfolio/admin/screener/config/", payload);
    },
  };
}
