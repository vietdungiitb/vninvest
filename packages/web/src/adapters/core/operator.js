export function createOperatorClient({ coreGet, corePost, corePut, corePatch, coreDelete }) {
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

    getDashboardSummary() {
      return coreGet("/partner/dashboard/summary/");
    },

    getUsageTrend(days = 7) {
      return coreGet(`/partner/dashboard/usage-trend/?days=${days}`);
    },

    // Phase 1: Alert Config
    getAlertConfigs() {
      return coreGet("/partner/usage/alert-config/");
    },

    updateAlertConfig(meterCode, data) {
      return corePost(`/partner/usage/alert-config/${encodeURIComponent(meterCode)}/`, data);
    },

    // Phase 1: Usage Forecast
    getUsageForecast(meterCode = null, lookback = 30) {
      const params = new URLSearchParams({ lookback: String(lookback) });
      if (meterCode) params.set('meter_code', meterCode);
      return coreGet(`/partner/usage/forecast/?${params.toString()}`);
    },

    // Phase 1: Per-Meter Usage Trend
    getUsageTrendMeter(meterCode, days = 30) {
      return coreGet(`/partner/usage/trend/${encodeURIComponent(meterCode)}/?days=${days}`);
    },

    getAllUsageTrends(days = 30) {
      return coreGet(`/partner/usage/trend/?days=${days}`);
    },

    // Phase 2: Cost Analytics
    getCostTrend(months = 6) {
      return coreGet(`/partner/billing/cost-trend/?months=${months}`);
    },

    // Phase 2: Scheduled Reports
    getScheduledReports() {
      return coreGet("/partner/reports/");
    },

    createScheduledReport(data) {
      return corePost("/partner/reports/", data);
    },

    updateScheduledReport(id, data) {
      return corePatch(`/partner/reports/${encodeURIComponent(id)}/`, data);
    },

    deleteScheduledReport(id) {
      return coreDelete(`/partner/reports/${encodeURIComponent(id)}/`);
    },

    testScheduledReport(id) {
      return corePost(`/partner/reports/${encodeURIComponent(id)}/test/`);
    },

    getReportDeliveryLog() {
      return coreGet("/partner/reports/delivery-log/");
    },

    // Phase 3: Security Dashboard
    getLoginActivity(days = 30) {
      return coreGet(`/partner/security/login-activity/?days=${days}`);
    },
    getActiveSessions() {
      return coreGet("/partner/security/sessions/");
    },
    revokeSession(sessionId) {
      return corePost("/partner/security/sessions/revoke/", { session_id: sessionId });
    },
    revokeAllSessions() {
      return corePost("/partner/security/sessions/revoke/", { revoke_all_except_current: true });
    },

    // Phase 4: Webhooks
    getWebhooks() {
      return coreGet("/partner/webhooks/");
    },
    createWebhook(data) {
      return corePost("/partner/webhooks/", data);
    },
    updateWebhook(id, data) {
      return corePatch(`/partner/webhooks/${encodeURIComponent(id)}/`, data);
    },
    deleteWebhook(id) {
      return coreDelete(`/partner/webhooks/${encodeURIComponent(id)}/`);
    },
    getWebhookDeliveries(id) {
      return coreGet(`/partner/webhooks/${encodeURIComponent(id)}/deliveries/`);
    },
    regenerateWebhookSecret(id) {
      return corePost(`/partner/webhooks/${encodeURIComponent(id)}/regenerate-secret/`);
    },
    testWebhook(id) {
      return corePost(`/partner/webhooks/${encodeURIComponent(id)}/test/`);
    },
    retryWebhookDelivery(configId, deliveryId) {
      return corePost(`/partner/webhooks/${encodeURIComponent(configId)}/deliveries/${encodeURIComponent(deliveryId)}/retry/`);
    },

    // Phase 4: Billing status + plan preview
    getBillingStatus() {
      return coreGet("/partner/billing/status/");
    },
    previewPlanChange(planCode) {
      return corePost("/partner/billing/preview-plan-change/", { target_plan: planCode });
    },
    createStripeCheckoutSession(planCode, successUrl, cancelUrl) {
      return corePost("/partner/billing/stripe/session/", { plan: planCode, success_url: successUrl, cancel_url: cancelUrl });
    },
    createStripePortalSession(returnUrl) {
      return corePost("/partner/billing/stripe/portal/", { return_url: returnUrl });
    },
  };
}
