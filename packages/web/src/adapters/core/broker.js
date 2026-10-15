/**
 * broker.js — B1.3: adapter cấu hình broker đa-nhà (dnse/ssi/tcbs).
 *
 * Endpoints mới (store UserBrokerConfig, BE user_workspace/views_broker.py).
 * workspace.js giữ các method DNSE trading cũ (sync/order/OTP) — chỉ trỏ sang đây
 * cho phần config; dnse.js giữ backfill + identity credential lane.
 *
 * mbw2-data (Wave 2 B2.3/B2.4/B2.5, contract §2 đóng băng + QĐ PM follow-up):
 * - 9 endpoint hub: `urls.py:109-117` (accounts/detail/positions/balance/
 *   orders/sync/sync-runs/sync-issues) + PATCH broker-bindings.
 * - Quy tắc badge join (§2): provider lấy từ account detail trong URL, KHÔNG
 *   suy từ dòng — thực thi ở component, adapter chỉ map URL đúng.
 * - `getPortfolioBindings` ĐÃ XOÁ (QĐ PM BE-01): bindings BE là PATCH-only
 *   by design, không có GET — không gọi endpoint không tồn tại. Bindings UI
 *   đọc từ action-response + accounts list (KNOWN GAP: ticket BE-READ Wave 3).
 * - `savePortfolioBindings` dùng PATCH (giữ): `corePatch` đã được facade
 *   inject (WIRING-01). Giữ throw rõ ràng khi client dựng thiếu corePatch
 *   (fail-closed, không gọi POST giả).
 * - `getBrokerCapabilities` dùng endpoint có sẵn `GET /broker/capabilities/`
 *   (Wave 0 B0.6) — HUB refactor sang hàm này ở cross-review, không gọi
 *   coreGet trực tiếp.
 */
export function createBrokerClient({ coreGet, corePost, coreDelete, corePatch }) {
  const path = (provider) => `/broker/${encodeURIComponent(provider)}/config/`;
  const accountPath = (accountId) => `/broker/accounts/${encodeURIComponent(accountId)}/`;
  const bindingsPath = (portfolioId) =>
    `/workspace/portfolios/${encodeURIComponent(portfolioId)}/broker-bindings/`;
  const requireId = (value, name) => {
    if (value === null || value === undefined || value === "") {
      throw new Error(`${name} is required`);
    }
  };
  return {
    getBrokerProviders() {
      return coreGet("/broker/providers/");
    },

    /**
     * Capability matrix 3 lane (Wave 0 B0.6) — HUB tiles dùng hàm này,
     * không gọi coreGet trực tiếp (refactor ở cross-review B2.7).
     */
    getBrokerCapabilities() {
      return coreGet("/broker/capabilities/");
    },

    getBrokerSchema(provider) {
      return coreGet(`/broker/config-schema/${encodeURIComponent(provider)}/`);
    },

    getBrokerConfig(provider) {
      return coreGet(path(provider));
    },

    saveBrokerConfig(provider, data) {
      return corePost(path(provider), data);
    },

    deleteBrokerConfig(provider) {
      return coreDelete(path(provider));
    },

    testBrokerConnection(provider) {
      return corePost(`/broker/${encodeURIComponent(provider)}/test-connection/`, {});
    },

    getBrokerJob(jobId) {
      return coreGet(`/broker/jobs/${encodeURIComponent(jobId)}/`);
    },

    // ---- mbw2-data: hub đọc (B2.3/B2.4/B2.5) ----

    /** B2.3: danh sách tiểu khoản broker (scope user + tenant). */
    getBrokerAccounts() {
      return coreGet("/broker/accounts/");
    },

    /** B2.3: chi tiết 1 tiểu khoản — nguồn provider cho badge join §2. */
    getBrokerAccount(accountId) {
      requireId(accountId, "accountId");
      return coreGet(accountPath(accountId));
    },

    /** B2.3 tab Vị thế: vị thế trực tiếp từ broker (read-only). */
    getAccountPositions(accountId) {
      requireId(accountId, "accountId");
      return coreGet(`${accountPath(accountId)}positions/`);
    },

    /** B2.3 tab Số dư: số dư trực tiếp từ broker (read-only). */
    getAccountBalance(accountId) {
      requireId(accountId, "accountId");
      return coreGet(`${accountPath(accountId)}balance/`);
    },

    /** B2.3 tab Sổ lệnh/Khớp lệnh: sổ lệnh trực tiếp từ broker. */
    getAccountOrders(accountId) {
      requireId(accountId, "accountId");
      return coreGet(`${accountPath(accountId)}orders/`);
    },

    /**
     * B2.4: enqueue sync 1 tiểu khoản. BE trả 202 + `{job_id, state}` —
     * component poll `getBrokerJob(jobId)` tới trạng thái cuối.
     */
    syncBrokerAccount(accountId) {
      requireId(accountId, "accountId");
      return corePost(`${accountPath(accountId)}sync/`);
    },

    /** B2.4 Sync Center: lịch sử lần đồng bộ (mới nhất trước). */
    getBrokerSyncRuns({ limit = 20 } = {}) {
      const n = Math.max(1, Math.min(Number(limit) || 20, 100));
      return coreGet(`/broker/sync-runs/?limit=${n}`);
    },

    /**
     * B2.4 Sync Center: lệch chưa xử lý.
     * `resolved`: true/false/undefined · `severity`: info/warning/error/""
     */
    getBrokerSyncIssues({ resolved, severity } = {}) {
      const query = new URLSearchParams();
      if (resolved === true) query.set("resolved", "true");
      else if (resolved === false) query.set("resolved", "false");
      const sev = String(severity ?? "").trim().toLowerCase();
      if (sev === "info" || sev === "warning" || sev === "error") query.set("severity", sev);
      const suffix = query.toString();
      return coreGet(`/broker/sync-issues/${suffix ? `?${suffix}` : ""}`);
    },

    /**
     * B2.5: gộp/tách tiểu khoản khỏi danh mục (explicit, QĐ-C ADR-005).
     * `data`: `{action: 'add'|'remove', sub_account_id, role?, is_default?}`.
     * BE PATCH-only (QĐ PM BE-01) — không có helper GET tương ứng.
     */
    savePortfolioBindings(portfolioId, data) {
      requireId(portfolioId, "portfolioId");
      if (typeof corePatch !== "function") {
        throw new Error("savePortfolioBindings cần corePatch (createBrokerClient dựng thiếu corePatch).");
      }
      return corePatch(bindingsPath(portfolioId), data);
    },
  };
}
