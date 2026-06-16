import { createElement, useEffect, useState } from "react";
import { renderShellPageChrome, renderShellPanel, renderShellMetric } from "../../components/ShellPageTemplate.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { PolicyCheckboxes, policyIdsToScopeCodes, scopeCodesToPolicyIds } from "../../components/PolicyCheckboxes.js";

export function TenantAdminPATsPage({ env = {}, fetchImpl, bootstrapLoader, autoLoad = true, initialSnapshot = null }) {
  const [tokens, setTokens] = useState([]);
  const [serviceAccounts, setServiceAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [secretReveal, setSecretReveal] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [activeTokenId, setActiveTokenId] = useState("");
  const [hideRevoked, setHideRevoked] = useState(true);

  const [createForm, setCreateForm] = useState({
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

      const tokenData = tokensRes.results || tokensRes || [];
      const saData = saRes.results || saRes || [];

      setTokens(tokenData);
      setServiceAccounts(saData);

      if (saData.length > 0) {
        setCreateForm(prev => ({
          ...prev,
          service_account_id: prev.service_account_id || saData[0].service_account_id || saData[0].id,
        }));
      }
    } catch (err) {
      setError(err.message || "Lỗi khi tải dữ liệu API Tokens");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateSubmit = async (e) => {
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

      // Response contains the secret key
      if (response && (response.secret || response.token || response.access)) {
        const secretVal = response.secret || response.token || response.access;
        const prefixVal = response.token_prefix || "";
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
    } catch (err) {
      alert(err.message || "Lỗi khi tạo API Token");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRotateToken = async (tokenId) => {
    if (!confirm("Bạn có chắc chắn muốn xoay (rotate) token này? Token cũ sẽ có thời gian ân hạn 1 giờ trước khi bị hủy.")) return;
    setActiveTokenId(tokenId);
    try {
      const response = await defaultCoreApiAdapter.corePost(`/partner/pats/${tokenId}/rotate/`, {
        grace_period_seconds: 3600,
        audit_reason: "Rotated via Tenant Admin Console",
      });

      const nextToken = response.new_token || response;
      if (nextToken && (nextToken.secret || nextToken.token || nextToken.access)) {
        const secretVal = nextToken.secret || nextToken.token || nextToken.access;
        const prefixVal = nextToken.token_prefix || "";
        setSecretReveal({ secret: secretVal, token_prefix: prefixVal });
        await loadData();
      } else {
        alert("Không nhận được token mới từ server");
      }
    } catch (err) {
      alert(err.message || "Lỗi khi xoay token");
    } finally {
      setActiveTokenId("");
    }
  };

  const handleRevokeToken = async (tokenId) => {
    if (!confirm("Bạn có chắc chắn muốn thu hồi (revoke) token này lập tức? Hành động này không thể hoàn tác.")) return;
    setActiveTokenId(tokenId);
    try {
      await defaultCoreApiAdapter.corePost(`/partner/pats/${tokenId}/revoke/`, {
        reason: "Tenant admin manually revoked",
      });
      await loadData();
    } catch (err) {
      alert(err.message || "Lỗi khi thu hồi token");
    } finally {
      setActiveTokenId("");
    }
  };

  const handleCopyToken = (tokenStr) => {
    if (!tokenStr) return;
    navigator.clipboard.writeText(tokenStr).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  if (loading && tokens.length === 0) {
    return renderShellPageChrome({
      eyebrow: "Tenant Admin",
      title: "API Tokens (PATs)",
      description: "Đang tải danh sách API Tokens...",
      children: createElement("div", { className: "shellPage__panel" }, "Đang tải..."),
    });
  }

  if (error && tokens.length === 0) {
    return renderShellPageChrome({
      eyebrow: "Tenant Admin",
      title: "API Tokens (PATs)",
      error: error,
      children: createElement("div", { className: "shellPage__panel" }, error),
    });
  }

  const activeCount = tokens.filter(t => t.status === "active" || t.status === "rotating" || !t.revoked).length;
  const metrics = [
    renderShellMetric("Tổng Tokens", String(tokens.length)),
    renderShellMetric("Đang hoạt động", String(activeCount)),
    renderShellMetric("Đã thu hồi", String(tokens.filter(t => t.status === "revoked" || t.revoked).length)),
  ];

  const visibleTokens = hideRevoked ? tokens.filter(t => t.status !== "revoked" && !t.revoked) : tokens;
  const serviceAccountMap = new Map(serviceAccounts.map(sa => [sa.service_account_id || sa.id, sa]));

  return renderShellPageChrome({
    eyebrow: "Tenant Admin",
    title: "API Tokens (PATs)",
    description: "Quản lý mã truy cập cá nhân (Personal Access Tokens - PAT) của các Service Accounts",
    metrics,
    children: createElement(
      "section",
      { className: "shellPage__bodyGrid" },
      createElement(
        "div",
        { className: "shellPage__stack" },

        // Success secret reveal box
        secretReveal && createElement(
          "div",
          {
            style: {
              padding: "20px",
              background: "rgba(34,197,94,0.1)",
              border: "1px solid rgba(34,197,94,0.3)",
              borderRadius: "12px",
              marginBottom: "20px",
            },
          },
          createElement("h4", { style: { margin: "0 0 10px", color: "#22c55e", fontSize: "16px" } }, "Khởi tạo API Token thành công!"),
          createElement("p", { style: { margin: "0 0 16px", color: "#94a3b8", fontSize: "13px" } }, "LƯU Ý: Đây là lần DUY NHẤT mã khóa này được hiển thị. Vui lòng sao chép và cất giữ cẩn thận."),
          createElement(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: "12px",
                background: "rgba(15,23,42,0.6)",
                border: "1px solid rgba(255,255,255,0.08)",
                padding: "12px",
                borderRadius: "8px",
              },
            },
            createElement("code", { style: { flex: 1, color: "#f1f5f9", fontSize: "14px", wordBreak: "break-all", fontFamily: "monospace" } }, secretReveal.secret),
            createElement("button", {
              onClick: () => handleCopyToken(secretReveal.secret),
              style: {
                padding: "6px 16px",
                background: copySuccess ? "rgba(34,197,94,0.2)" : "rgba(0,180,216,0.2)",
                border: copySuccess ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(0,180,216,0.3)",
                borderRadius: "6px",
                color: copySuccess ? "#22c55e" : "#00b4d8",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "12px",
              },
            }, copySuccess ? "Đã sao chép!" : "Sao chép")
          ),
          createElement("button", {
            onClick: () => setSecretReveal(null),
            style: {
              marginTop: "12px",
              padding: "6px 12px",
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              fontSize: "12px",
              textDecoration: "underline",
            },
          }, "Đóng thông báo")
        ),

        // List Header and Actions
        createElement(
          "div",
          { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" } },
          createElement("div", { style: { display: "flex", gap: "10px", alignItems: "center" } },
            createElement("h2", { style: { margin: 0, fontSize: "20px" } }, "Danh sách API Tokens"),
            tokens.some(t => t.status === "revoked" || t.revoked) && createElement("button", {
              onClick: () => setHideRevoked(!hideRevoked),
              style: {
                padding: "4px 10px",
                background: "rgba(148,163,184,0.1)",
                border: "1px solid rgba(148,163,184,0.2)",
                borderRadius: "6px",
                color: "#94a3b8",
                cursor: "pointer",
                fontSize: "11px",
              },
            }, hideRevoked ? "Hiện token đã thu hồi" : "Ẩn token đã thu hồi")
          ),
          createElement("button", {
            onClick: () => setShowCreateModal(true),
            disabled: serviceAccounts.length === 0,
            style: {
              padding: "10px 20px",
              background: "rgba(0,180,216,0.2)",
              border: "1px solid rgba(0,180,216,0.3)",
              borderRadius: "8px",
              color: "#00b4d8",
              cursor: serviceAccounts.length === 0 ? "not-allowed" : "pointer",
              opacity: serviceAccounts.length === 0 ? 0.6 : 1,
              fontWeight: 600,
            },
          }, "+ Cấp API Token mới")
        ),

        // Service Accounts list warning
        serviceAccounts.length === 0 && createElement(
          "div",
          {
            style: {
              padding: "16px",
              background: "rgba(255,127,80,0.1)",
              border: "1px solid rgba(255,127,80,0.3)",
              borderRadius: "10px",
              marginBottom: "20px",
              color: "#ff7f50",
              fontSize: "14px",
            },
          },
          "Bạn cần tạo ít nhất một Service Account trước khi cấp API Token (PAT)."
        ),

        // Tokens list view
        renderShellPanel({
          title: "API Tokens",
          subtitle: `${visibleTokens.length} token(s) đang hiển thị`,
          children: createElement(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "16px" } },
            visibleTokens.length === 0 ? createElement("div", { style: { padding: "24px", textAlign: "center", color: "#64748b" } }, "Không có API Token nào.") :
            visibleTokens.map(token => {
              const sa = serviceAccountMap.get(token.service_account_id);
              const isTokenRotating = activeTokenId === (token.pat_id || token.id);
              const isRevoked = token.status === "revoked" || token.revoked;

              return createElement(
                "div",
                {
                  key: token.pat_id || token.id,
                  style: {
                    border: "1px solid rgba(255,255,255,0.06)",
                    background: "rgba(15,23,42,0.3)",
                    borderRadius: "12px",
                    padding: "16px",
                  },
                },
                createElement(
                  "div",
                  { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", marginBottom: "12px" } },
                  createElement(
                    "div",
                    null,
                    createElement("div", { style: { display: "flex", alignItems: "center", gap: "8px" } },
                      createElement("span", { style: { fontWeight: 600, fontSize: "15px", color: "#f1f5f9" } }, token.label || "API Token"),
                      createElement("code", { style: { padding: "2px 6px", background: "rgba(255,255,255,0.06)", borderRadius: "4px", fontSize: "11px", color: "#94a3b8", fontFamily: "monospace" } }, token.token_prefix)
                    ),
                    createElement("div", { style: { fontSize: "12px", color: "#64748b", marginTop: "2px" } }, `Service Account: ${sa?.name || token.service_account_id}`)
                  ),
                  createElement(
                    "div",
                    { style: { display: "flex", alignItems: "center", gap: "10px" } },
                    createElement(
                      "span",
                      {
                        style: {
                          padding: "4px 10px",
                          borderRadius: "999px",
                          fontSize: "11px",
                          fontWeight: 600,
                          background: isRevoked ? "rgba(239,68,68,0.2)" : (token.status === "rotating" ? "rgba(234,179,8,0.2)" : "rgba(34,197,94,0.2)"),
                          color: isRevoked ? "#ef4444" : (token.status === "rotating" ? "#eab308" : "#22c55e"),
                        },
                      },
                      isRevoked ? "Đã thu hồi" : (token.status === "rotating" ? "Đang xoay" : "Hoạt động")
                    )
                  )
                ),
                createElement(
                  "div",
                  { style: { display: "flex", flexWrap: "wrap", gap: "16px", fontSize: "13px", borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: "12px" } },
                  createElement(
                    "div",
                    { style: { flex: "1 1 200px" } },
                    createElement("span", { style: { color: "#64748b", display: "block", fontSize: "11px", textTransform: "uppercase" } }, "Hạn mức Scopes"),
                    createElement(
                      "div",
                      { style: { display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px" } },
                      (token.scope_codes || token.scopes || []).map(sc =>
                        createElement("span", { key: sc, style: { padding: "2px 6px", background: "rgba(0,180,216,0.1)", borderRadius: "4px", color: "#00b4d8", fontSize: "11px" } }, sc)
                      )
                    )
                  ),
                  createElement(
                    "div",
                    { style: { flex: "1 1 120px" } },
                    createElement("span", { style: { color: "#64748b", display: "block", fontSize: "11px", textTransform: "uppercase" } }, "Ngày tạo"),
                    createElement("span", { style: { color: "#cbd5e1" } }, token.created_at ? new Date(token.created_at).toLocaleDateString("vi-VN") : "N/A")
                  ),
                  createElement(
                    "div",
                    { style: { flex: "1 1 120px" } },
                    createElement("span", { style: { color: "#64748b", display: "block", fontSize: "11px", textTransform: "uppercase" } }, "Hết hạn"),
                    createElement("span", { style: { color: token.expires_at && new Date(token.expires_at) < new Date() ? "#ef4444" : "#cbd5e1" } }, token.expires_at ? new Date(token.expires_at).toLocaleString("vi-VN") : "Vô thời hạn")
                  ),
                  createElement(
                    "div",
                    { style: { flex: "1 1 120px" } },
                    createElement("span", { style: { color: "#64748b", display: "block", fontSize: "11px", textTransform: "uppercase" } }, "Dùng cuối"),
                    createElement("span", { style: { color: "#cbd5e1" } }, token.last_used_at ? new Date(token.last_used_at).toLocaleString("vi-VN") : "Chưa từng dùng")
                  )
                ),
                !isRevoked && createElement(
                  "div",
                  { style: { display: "flex", gap: "8px", marginTop: "14px", borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: "12px" } },
                  createElement("button", {
                    onClick: () => handleRotateToken(token.pat_id || token.id),
                    disabled: isTokenRotating,
                    style: {
                      padding: "6px 12px",
                      background: "rgba(0,180,216,0.15)",
                      border: "1px solid rgba(0,180,216,0.3)",
                      borderRadius: "6px",
                      color: "#00b4d8",
                      cursor: "pointer",
                      fontSize: "12px",
                    },
                  }, isTokenRotating ? "Đang xoay..." : "Xoay Token"),
                  createElement("button", {
                    onClick: () => handleRevokeToken(token.pat_id || token.id),
                    disabled: isTokenRotating,
                    style: {
                      padding: "6px 12px",
                      background: "rgba(239,68,68,0.15)",
                      border: "1px solid rgba(239,68,68,0.3)",
                      borderRadius: "6px",
                      color: "#ef4444",
                      cursor: "pointer",
                      fontSize: "12px",
                    },
                  }, "Thu hồi")
                )
              );
            })
          ),
        }),

        // Create Modal
        showCreateModal && createElement(
          "div",
          {
            style: {
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
            },
            onClick: () => setShowCreateModal(false),
          },
          createElement(
            "div",
            {
              style: {
                background: "#0b0f19",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "16px",
                padding: "24px",
                width: "100%",
                maxWidth: "550px",
                maxHeight: "95vh",
                overflow: "auto",
              },
              onClick: e => e.stopPropagation(),
            },
            createElement("h3", { style: { margin: "0 0 20px", fontSize: "18px" } }, "Cấp API Token mới"),
            createElement(
              "form",
              { onSubmit: handleCreateSubmit },
              createElement("div", { style: { marginBottom: "16px" } },
                createElement("label", { style: { display: "block", marginBottom: "6px", fontWeight: 500 } }, "Tên hiển thị (Mô tả)"),
                createElement("input", {
                  type: "text",
                  value: createForm.display_name,
                  onChange: e => setCreateForm(prev => ({ ...prev, display_name: e.target.value })),
                  placeholder: "Ví dụ: Token cho Jenkins, Token cho Python App",
                  required: true,
                  style: { width: "100%", padding: "10px 12px", background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#f1f5f9", fontSize: "14px" },
                })
              ),
              createElement("div", { style: { marginBottom: "16px" } },
                createElement("label", { style: { display: "block", marginBottom: "6px", fontWeight: 500 } }, "Chọn Service Account"),
                createElement("select", {
                  value: createForm.service_account_id,
                  onChange: e => setCreateForm(prev => ({ ...prev, service_account_id: e.target.value })),
                  style: { width: "100%", padding: "10px 12px", background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#f1f5f9", fontSize: "14px" },
                },
                  serviceAccounts.map(sa =>
                    createElement("option", { key: sa.service_account_id || sa.id, value: sa.service_account_id || sa.id }, `${sa.name} (${(sa.metadata?.environment || sa.environment || "prod").toUpperCase()})`)
                  )
                )
              ),
              createElement("div", { style: { marginBottom: "16px" } },
                createElement("label", { style: { display: "block", marginBottom: "6px", fontWeight: 500 } }, "Ngày hết hạn (Để trống nếu vô thời hạn)"),
                createElement("input", {
                  type: "datetime-local",
                  value: createForm.expires_at,
                  onChange: e => setCreateForm(prev => ({ ...prev, expires_at: e.target.value })),
                  style: { width: "100%", padding: "10px 12px", background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#f1f5f9", fontSize: "14px" },
                })
              ),
              createElement("div", { style: { marginBottom: "16px" } },
                createElement("label", { style: { display: "block", marginBottom: "6px", fontWeight: 500 } }, "Quyền hạn (Policies)"),
                createElement(PolicyCheckboxes, {
                  selectedPolicies: createForm.policy_ids,
                  onChange: (policies) => setCreateForm(prev => ({ ...prev, policy_ids: policies })),
                })
              ),
              createElement("div", { style: { display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "24px" } },
                createElement("button", {
                  type: "button",
                  onClick: () => setShowCreateModal(false),
                  style: { padding: "10px 20px", background: "rgba(148,163,184,0.15)", border: "1px solid rgba(148,163,184,0.3)", borderRadius: "8px", color: "#94a3b8", cursor: "pointer" },
                }, "Hủy"),
                createElement("button", {
                  type: "submit",
                  disabled: submitting,
                  style: { padding: "10px 20px", background: "rgba(0,180,216,0.2)", border: "1px solid rgba(0,180,216,0.3)", borderRadius: "8px", color: "#00b4d8", fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer" },
                }, submitting ? "Đang cấp..." : "Cấp Token"),
              ),
            )
          )
        ),
      )
    ),
  });
}
