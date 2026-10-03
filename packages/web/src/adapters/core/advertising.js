/**
 * advertising.js
 * Adapter for advertising & trademark domains in core API.
 */

export function createAdvertisingClient({ coreGet, corePost, corePatch, coreDelete }) {
  return {
    // -----------------------------------------------------
    // Campaign CRUD
    // -----------------------------------------------------

    getAdvertisingCampaigns: async (params = {}) => {
      const searchParams = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      );
      const query = searchParams.toString();
      return coreGet(`/operator/ads/campaigns/${query ? `?${query}` : ""}`);
    },

    getAdvertisingCampaign: async (id) => {
      if (!id) throw new Error("id is required");
      return coreGet(`/operator/ads/campaigns/${encodeURIComponent(id)}/`);
    },

    createAdvertisingCampaign: async (payload) => {
      return corePost("/operator/ads/campaigns/", payload);
    },

    updateAdvertisingCampaign: async (id, payload) => {
      if (!id) throw new Error("id is required");
      return corePatch(`/operator/ads/campaigns/${encodeURIComponent(id)}/`, payload);
    },

    deleteAdvertisingCampaign: async (id) => {
      if (!id) throw new Error("id is required");
      return coreDelete(`/operator/ads/campaigns/${encodeURIComponent(id)}/`);
    },

    // -----------------------------------------------------
    // Analytics (read-only)
    // -----------------------------------------------------

    getCampaignAnalytics: async (params = {}) => {
      const searchParams = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      );
      const query = searchParams.toString();
      return coreGet(`/operator/ads/analytics/${query ? `?${query}` : ""}`);
    },

    // -----------------------------------------------------
    // Trademark Config (widget-facing, read-only)
    // -----------------------------------------------------

    getTrademarkConfig: async () => {
      return coreGet("/widget/config");
    },

    // -----------------------------------------------------
    // Trademark Config (admin, write)
    // -----------------------------------------------------

    updateTrademarkConfig: async (payload) => {
      return corePatch("/widget/config", payload);
    },
  };
}
