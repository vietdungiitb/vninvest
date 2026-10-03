/**
 * commercial.js
 * Adapter for commercial domains (Billing & Payments) in core API.
 */

export function createCommercialClient({ coreGet, corePost }) {
  return {
    // -----------------------------------------------------
    // Billing API
    // -----------------------------------------------------

    getBillingSubscription: async () => {
      return coreGet("/billing/subscription");
    },

    getBillingQuota: async () => {
      return coreGet("/billing/quota");
    },

    /**
     * @param {Object} params
     * @param {number} [params.page]
     * @param {number} [params.page_size]
     */
    getBillingInvoices: async (params = {}) => {
      let url = "/billing/invoices";
      const searchParams = new URLSearchParams();
      if (params.page) searchParams.append("page", params.page);
      if (params.page_size) searchParams.append("page_size", params.page_size);
      
      const query = searchParams.toString();
      if (query) {
        url += `?${query}`;
      }
      return coreGet(url);
    },

    // -----------------------------------------------------
    // Payments API
    // -----------------------------------------------------

    /**
     * @param {Object} payload
     * @param {number} payload.amount
     * @param {string} payload.plan
     */
    createPayment: async (payload) => {
      return corePost("/payments/create/", payload);
    },

    /**
     * @param {string} txn_ref 
     */
    getPaymentStatus: async (txn_ref) => {
      return coreGet(`/payments/status/${txn_ref}/`);
    },
  };
}
