import { useEffect, useState } from "react";
import { ShellPageChrome, ShellPanel, renderShellMetric } from "../../components/ShellPageTemplate.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { PolicyCheckboxes, policyIdsToScopeCodes } from "../../components/PolicyCheckboxes.js";

interface Token {
  pat_id?: string;
  id?: string;
  label?: string;
  token_prefix?: string;
  status: string;
  revoked?: boolean;
  service_account_id: string;
  scope_codes?: string[];
  scopes?: string[];
  created_at?: string;
  expires_at?: string;
  last_used_at?: string;
}

interface ServiceAccount {
  service_account_id?: string;
  id?: string;
  name: string;
  metadata?: {
    environment?: string;
  };
  environment?: string;
}

interface CreateForm {
  service_account_id: string;
  display_name: string;
  expires_at: string;
  policy_ids: string[];
}

interface SecretReveal {
  secret: string;
  token_prefix: string;
}

interface TenantAdminPATsPageProps {
  env?: Record<string, unknown>;
  fetchImpl?: unknown;
  bootstrapLoader?: unknown;
  autoLoad?: boolean;
  initialSnapshot?: Record<string, unknown> | null;
}

export function TenantAdminPATsPage({
  env: _env = {},
  fetchImpl: _fetchImpl,
  bootstrapLoader: _bootstrapLoader,
  autoLoad: _autoLoad = true,
  initialSnapshot: _initialSnapshot = null,
}: TenantAdminPATsPageProps) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [serviceAccounts, setServiceAccounts] = useState<ServiceAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [secretReveal, setSecretReveal] = useState<SecretReveal | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [activeTokenId, setActiveTokenId] = useState("");
  const [hideRevoked, setHideRevoked] = useState(true);

  const [createForm, setCreateForm] = useState<CreateForm>({
    service_account_id: "",
    display_name: "",
    expires_at: "",
    policy_ids: ["pol_market_read", "pol_signals_read"],
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [tokensRes, saRes] = await Promise.all([
        defaultCoreApiAdapter.coreGet("/partner/pats/"),
        defaultCoreApiAdapter.coreGet("/partner/service-accounts/"),
      ]);

      const tokenData = tokensRes.ok ? (await tokensRes.json()).results || [] : [];
      const saData = saRes.ok ? (await saRes.json()).results || [] : [];

      setTokens(tokenData);
      setServiceAccounts(saData);

      if (saData.length > 0) {
        setCreateForm(prev => ({
          ...prev,
          service_account_id: prev.service_account_id || saData[0].service_account_id || saData[0].id,
        }));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Lỗi khi tải dữ liệu API Tokens");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.service_account_id) {
      alert("Vui lòng chọn Service Account");
      return;
    }

    setSubmitting(true);
    try {
      const scopeCodes = policyIdsToScopeCodes(createForm.policy_ids);
      const response = await defaultCoreApiAdapter.corePost("/partner/pats/issue/", {
        service_account_id: createForm.service_account_id,
        display_name: createForm.display_name,
        expires_at: createForm.expires_at ? new Date(createForm.expires_at).toISOString() : null,
        scope_codes: scopeCodes,
        audit_reason: "Issued via Tenant Admin Console",
      });

      const responseData = response.ok ? await response.json() : null;
      if (response.ok && responseData && (responseData.secret || responseData.token || responseData.access)) {
        const secretVal = responseData.secret || responseData.token || responseData.access;
        const prefixVal = responseData.token_prefix || "";
        setSecretReveal({ secret: secretVal, token_prefix: prefixVal });
        setShowCreateModal(false);
        setCreateForm({
          service_account_id: serviceAccounts[0]?.service_account_id || serviceAccounts[0]?.id || "",
          display_name: "",
          expires_at: "",
          policy_ids: ["pol_market_read", "pol_signals_read"],
        });
        await loadData();
      } else {
        alert("Không nhận được token từ server");
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Lỗi khi tạo API Token");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRotateToken = async (tokenId: string) => {
    if (!confirm("Bạn có chắc chắn muốn xoay (rotate) token này? Token cũ sẽ có thời gian ân hạn 1 giờ trước khi bị hủy.")) return;
    setActiveTokenId(tokenId);
    try {
      const response = await defaultCoreApiAdapter.corePost(`/partner/pats/${tokenId}/rotate/`, {
        grace_period_seconds: 3600,
        audit_reason: "Rotated via Tenant Admin Console",
      });

      const responseData = response.ok ? await response.json() : null;
      const nextToken = responseData;
      if (nextToken && (nextToken.secret || nextToken.token || nextToken.access)) {
        const secretVal = nextToken.secret || nextToken.token || nextToken.access;
        const prefixVal = nextToken.token_prefix || "";
        setSecretReveal({ secret: secretVal, token_prefix: prefixVal });
        await loadData();
      } else {
        alert("Không nhận được token mới từ server");
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Lỗi khi xoay token");
    } finally {
      setActiveTokenId("");
    }
  };

  const handleRevokeToken = async (tokenId: string) => {
    if (!confirm("Bạn có chắc chắn muốn thu hồi (revoke) token này lập tức? Hành động này không thể hoàn tác.")) return;
    setActiveTokenId(tokenId);
    try {
      await defaultCoreApiAdapter.corePost(`/partner/pats/${tokenId}/revoke/`, {
        reason: "Tenant admin manually revoked",
      });
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Lỗi khi thu hồi token");
    } finally {
      setActiveTokenId("");
    }
  };

  const handleCopyToken = (tokenStr: string) => {
    if (!tokenStr) return;
    navigator.clipboard.writeText(tokenStr).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  if (loading && tokens.length === 0) {
    return (
      <ShellPageChrome
        eyebrow="Tenant Admin"
        title="API Tokens (PATs)"
        description="Đang tải danh sách API Tokens..."
      >
        <div className="shellPage__panel">Đang tải...</div>
      </ShellPageChrome>
    );
  }

  if (error && tokens.length === 0) {
    return (
      <ShellPageChrome
        eyebrow="Tenant Admin"
        title="API Tokens (PATs)"
        description="Không thể tải danh sách API Tokens"
        error={error}
      >
        <div className="shellPage__panel">{error}</div>
      </ShellPageChrome>
    );
  }

  const activeCount = tokens.filter(t => t.status === "active" || t.status === "rotating" || !t.revoked).length;
  const metrics = [
    renderShellMetric("Tổng Tokens", String(tokens.length)),
    renderShellMetric("Đang hoạt động", String(activeCount)),
    renderShellMetric("Đã thu hồi", String(tokens.filter(t => t.status === "revoked" || t.revoked).length)),
  ];

  const visibleTokens = hideRevoked ? tokens.filter(t => t.status !== "revoked" && !t.revoked) : tokens;
  const serviceAccountMap = new Map(serviceAccounts.map(sa => [sa.service_account_id || sa.id, sa]));

  return (
    <ShellPageChrome
      eyebrow="Tenant Admin"
      title="API Tokens (PATs)"
      description="Quản lý mã truy cập cá nhân (Personal Access Tokens - PAT) của các Service Accounts"
      metrics={metrics}
    >
      <section className="shellPage__bodyGrid">
        <div className="shellPage__stack">
          {secretReveal && (
            <div
              style={{
                padding: "20px",
                background: "rgba(34,197,94,0.1)",
                border: "1px solid rgba(34,197,94,0.3)",
                borderRadius: "12px",
                marginBottom: "20px",
              }}
            >
              <h4 style={{ margin: "0 0 10px", color: "#22c55e", fontSize: "16px" }}>Khởi tạo API Token thành công!</h4>
              <p style={{ margin: "0 0 16px", color: "#94a3b8", fontSize: "13px" }}>
                LƯU Ý: Đây là lần DUY NHẤT mã khóa này được hiển thị. Vui lòng sao chép và cất giữ cẩn thận.
              </p>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  background: "rgba(15,23,42,0.6)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  padding: "12px",
                  borderRadius: "8px",
                }}
              >
                <code style={{ flex: 1, color: "#f1f5f9", fontSize: "14px", wordBreak: "break-all", fontFamily: "monospace" }}>
                  {secretReveal.secret}
                </code>
                <button
                  onClick={() => handleCopyToken(secretReveal.secret)}
                  style={{
                    padding: "6px 16px",
                    background: copySuccess ? "rgba(34,197,94,0.2)" : "rgba(0,180,216,0.2)",
                    border: copySuccess ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(0,180,216,0.3)",
                    borderRadius: "6px",
                    color: copySuccess ? "#22c55e" : "#00b4d8",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "12px",
                  }}
                >
                  {copySuccess ? "Đã sao chép!" : "Sao chép"}
                </button>
              </div>
              <button
                onClick={() => setSecretReveal(null)}
                style={{
                  marginTop: "12px",
                  padding: "6px 12px",
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  fontSize: "12px",
                  textDecoration: "underline",
                }}
              >
                Đóng thông báo
              </button>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: "20px" }}>Danh sách API Tokens</h2>
              {tokens.some(t => t.status === "revoked" || t.revoked) && (
                <button
                  onClick={() => setHideRevoked(!hideRevoked)}
                  style={{
                    padding: "4px 10px",
                    background: "rgba(148,163,184,0.1)",
                    border: "1px solid rgba(148,163,184,0.2)",
                    borderRadius: "6px",
                    color: "#94a3b8",
                    cursor: "pointer",
                    fontSize: "11px",
                  }}
                >
                  {hideRevoked ? "Hiện token đã thu hồi" : "Ẩn token đã thu hồi"}
                </button>
              )}
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              disabled={serviceAccounts.length === 0}
              style={{
                padding: "10px 20px",
                background: "rgba(0,180,216,0.2)",
                border: "1px solid rgba(0,180,216,0.3)",
                borderRadius: "8px",
                color: "#00b4d8",
                cursor: serviceAccounts.length === 0 ? "not-allowed" : "pointer",
                opacity: serviceAccounts.length === 0 ? 0.6 : 1,
                fontWeight: 600,
              }}
            >
              + Cấp API Token mới
            </button>
          </div>

          {serviceAccounts.length === 0 && (
            <div
              style={{
                padding: "16px",
                background: "rgba(255,127,80,0.1)",
                border: "1px solid rgba(255,127,80,0.3)",
                borderRadius: "10px",
                marginBottom: "20px",
                color: "#ff7f50",
                fontSize: "14px",
              }}
            >
              Bạn cần tạo ít nhất một Service Account trước khi cấp API Token (PAT).
            </div>
          )}

          <ShellPanel
            title="API Tokens"
            subtitle={`${visibleTokens.length} token(s) đang hiển thị`}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {visibleTokens.length === 0 ? (
                <div style={{ padding: "24px", textAlign: "center", color: "#64748b" }}>Không có API Token nào.</div>
              ) : (
                visibleTokens.map(token => {
                  const sa = serviceAccountMap.get(token.service_account_id);
                  const isTokenRotating = activeTokenId === (token.pat_id || token.id);
                  const isRevoked = token.status === "revoked" || token.revoked;
                  const tokenId = token.pat_id || token.id;

                  return (
                    <div
                      key={tokenId}
                      style={{
                        border: "1px solid rgba(255,255,255,0.06)",
                        background: "rgba(15,23,42,0.3)",
                        borderRadius: "12px",
                        padding: "16px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", marginBottom: "12px" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontWeight: 600, fontSize: "15px", color: "#f1f5f9" }}>{token.label || "API Token"}</span>
                            <code style={{ padding: "2px 6px", background: "rgba(255,255,255,0.06)", borderRadius: "4px", fontSize: "11px", color: "#94a3b8", fontFamily: "monospace" }}>
                              {token.token_prefix}
                            </code>
                          </div>
                          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                            Service Account: {sa?.name || token.service_account_id}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span
                            style={{
                              padding: "4px 10px",
                              borderRadius: "999px",
                              fontSize: "11px",
                              fontWeight: 600,
                              background: isRevoked ? "rgba(239,68,68,0.2)" : (token.status === "rotating" ? "rgba(234,179,8,0.2)" : "rgba(34,197,94,0.2)"),
                              color: isRevoked ? "#ef4444" : (token.status === "rotating" ? "#eab308" : "#22c55e"),
                            }}
                          >
                            {isRevoked ? "Đã thu hồi" : (token.status === "rotating" ? "Đang xoay" : "Hoạt động")}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", fontSize: "13px", borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: "12px" }}>
                        <div style={{ flex: "1 1 200px" }}>
                          <span style={{ color: "#64748b", display: "block", fontSize: "11px", textTransform: "uppercase" }}>Hạn mức Scopes</span>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px" }}>
                            {(token.scope_codes || token.scopes || []).map((sc: string) => (
                              <span key={sc} style={{ padding: "2px 6px", background: "rgba(0,180,216,0.1)", borderRadius: "4px", color: "#00b4d8", fontSize: "11px" }}>
                                {sc}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div style={{ flex: "1 1 120px" }}>
                          <span style={{ color: "#64748b", display: "block", fontSize: "11px", textTransform: "uppercase" }}>Ngày tạo</span>
                          <span style={{ color: "#cbd5e1" }}>{token.created_at ? new Date(token.created_at).toLocaleDateString("vi-VN") : "N/A"}</span>
                        </div>
                        <div style={{ flex: "1 1 120px" }}>
                          <span style={{ color: "#64748b", display: "block", fontSize: "11px", textTransform: "uppercase" }}>Hết hạn</span>
                          <span style={{ color: token.expires_at && new Date(token.expires_at) < new Date() ? "#ef4444" : "#cbd5e1" }}>
                            {token.expires_at ? new Date(token.expires_at).toLocaleString("vi-VN") : "Vô thời hạn"}
                          </span>
                        </div>
                        <div style={{ flex: "1 1 120px" }}>
                          <span style={{ color: "#64748b", display: "block", fontSize: "11px", textTransform: "uppercase" }}>Dùng cuối</span>
                          <span style={{ color: "#cbd5e1" }}>
                            {token.last_used_at ? new Date(token.last_used_at).toLocaleString("vi-VN") : "Chưa từng dùng"}
                          </span>
                        </div>
                      </div>

                      {!isRevoked && (
                        <div style={{ display: "flex", gap: "8px", marginTop: "14px", borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: "12px" }}>
                          <button
                            onClick={() => handleRotateToken(tokenId!)}
                            disabled={isTokenRotating}
                            style={{
                              padding: "6px 12px",
                              background: "rgba(0,180,216,0.15)",
                              border: "1px solid rgba(0,180,216,0.3)",
                              borderRadius: "6px",
                              color: "#00b4d8",
                              cursor: "pointer",
                              fontSize: "12px",
                            }}
                          >
                            {isTokenRotating ? "Đang xoay..." : "Xoay Token"}
                          </button>
                          <button
                            onClick={() => handleRevokeToken(tokenId!)}
                            disabled={isTokenRotating}
                            style={{
                              padding: "6px 12px",
                              background: "rgba(239,68,68,0.15)",
                              border: "1px solid rgba(239,68,68,0.3)",
                              borderRadius: "6px",
                              color: "#ef4444",
                              cursor: "pointer",
                              fontSize: "12px",
                            }}
                          >
                            Thu hồi
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </ShellPanel>

          {showCreateModal && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(0,0,0,0.7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
              }}
              onClick={() => setShowCreateModal(false)}
            >
              <div
                style={{
                  background: "#0b0f19",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "16px",
                  padding: "24px",
                  width: "100%",
                  maxWidth: "550px",
                  maxHeight: "95vh",
                  overflow: "auto",
                }}
                onClick={e => e.stopPropagation()}
              >
                <h3 style={{ margin: "0 0 20px", fontSize: "18px" }}>Cấp API Token mới</h3>
                <form onSubmit={handleCreateSubmit}>
                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", marginBottom: "6px", fontWeight: 500 }}>Tên hiển thị (Mô tả)</label>
                    <input
                      type="text"
                      value={createForm.display_name}
                      onChange={e => setCreateForm(prev => ({ ...prev, display_name: e.target.value }))}
                      placeholder="Ví dụ: Token cho Jenkins, Token cho Python App"
                      required
                      style={{ width: "100%", padding: "10px 12px", background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#f1f5f9", fontSize: "14px" }}
                    />
                  </div>
                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", marginBottom: "6px", fontWeight: 500 }}>Chọn Service Account</label>
                    <select
                      value={createForm.service_account_id}
                      onChange={e => setCreateForm(prev => ({ ...prev, service_account_id: e.target.value }))}
                      style={{ width: "100%", padding: "10px 12px", background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#f1f5f9", fontSize: "14px" }}
                    >
                      {serviceAccounts.map(sa => (
                        <option key={sa.service_account_id || sa.id} value={sa.service_account_id || sa.id}>
                          {sa.name} ({(sa.metadata?.environment || sa.environment || "prod").toUpperCase()})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", marginBottom: "6px", fontWeight: 500 }}>Ngày hết hạn (Để trống nếu vô thời hạn)</label>
                    <input
                      type="datetime-local"
                      value={createForm.expires_at}
                      onChange={e => setCreateForm(prev => ({ ...prev, expires_at: e.target.value }))}
                      style={{ width: "100%", padding: "10px 12px", background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#f1f5f9", fontSize: "14px" }}
                    />
                  </div>
                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", marginBottom: "6px", fontWeight: 500 }}>Quyền hạn (Policies)</label>
                    <PolicyCheckboxes
                      selectedPolicies={createForm.policy_ids}
                      onChange={(policies: string[]) => setCreateForm(prev => ({ ...prev, policy_ids: policies }))}
                    />
                  </div>
                  <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "24px" }}>
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      style={{ padding: "10px 20px", background: "rgba(148,163,184,0.15)", border: "1px solid rgba(148,163,184,0.3)", borderRadius: "8px", color: "#94a3b8", cursor: "pointer" }}
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      style={{ padding: "10px 20px", background: "rgba(0,180,216,0.2)", border: "1px solid rgba(0,180,216,0.3)", borderRadius: "8px", color: "#00b4d8", fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer" }}
                    >
                      {submitting ? "Đang cấp..." : "Cấp Token"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </section>
    </ShellPageChrome>
  );
}
