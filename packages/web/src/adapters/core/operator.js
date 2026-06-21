export function createOperatorClient({ coreGet, corePost }) {
  return {
    getAdminAuditLog(params = {}) {
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      ).toString();
      return coreGet(`/audit-log${query ? `?${query}` : ""}`);
    },

    getAICCAuditLogs(params = {}) {
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      ).toString();
      return coreGet(`/ai-command-center/audit-logs/${query ? `?${query}` : ""}`);
    },

    getCoreOperatorOverview() {
      return coreGet("/operator/overview/");
    },

    getCoreOperatorHealth() {
      return coreGet("/operator/health/");
    },

    getCoreOperatorTenants(params = {}) {
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      ).toString();
      return coreGet(`/operator/tenants/${query ? `?${query}` : ""}`);
    },

    getCoreOperatorTenantDetail(tenantId) {
      if (!tenantId) throw new Error("tenantId is required for getCoreOperatorTenantDetail");
      return coreGet(`/operator/tenants/${encodeURIComponent(tenantId)}/`);
    },

    getCoreOperatorTenantServiceAccounts(tenantId, params = {}) {
      if (!tenantId) throw new Error("tenantId is required for getCoreOperatorTenantServiceAccounts");
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      ).toString();
      return coreGet(
        `/operator/tenants/${encodeURIComponent(tenantId)}/service-accounts/${query ? `?${query}` : ""}`
      );
    },

    getCoreOperatorTenantPATs(tenantId, params = {}) {
      if (!tenantId) throw new Error("tenantId is required for getCoreOperatorTenantPATs");
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      ).toString();
      return coreGet(
        `/operator/tenants/${encodeURIComponent(tenantId)}/pats/${query ? `?${query}` : ""}`
      );
    },

    getCoreOperatorJobs(params = {}) {
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      ).toString();
      return coreGet(`/operator/jobs/${query ? `?${query}` : ""}`);
    },

    getCoreOperatorAuditRequests(params = {}) {
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      ).toString();
      return coreGet(`/operator/audit/requests/${query ? `?${query}` : ""}`);
    },

    getCoreOperatorAuditRequestDetail(requestId) {
      if (!requestId) throw new Error("requestId is required for getCoreOperatorAuditRequestDetail");
      return coreGet(`/operator/audit/requests/${encodeURIComponent(requestId)}/`);
    },
  };
}
