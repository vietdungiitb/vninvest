import { createElement, useEffect, useState } from "react";
import { renderShellPageChrome, renderShellPanel, renderShellMetric } from "../../components/ShellPageTemplate.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { PolicyCheckboxes } from "../../components/PolicyCheckboxes.js";

export function TenantAdminServiceAccountsPage({ env = {}, fetchImpl, bootstrapLoader, autoLoad = true, initialSnapshot = null }) {
  const [serviceAccounts, setServiceAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", environment: "prod", policy_ids: [] });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadServiceAccounts() {
      try {
        setLoading(true);
        const response = await defaultCoreApiAdapter.coreGet("/partner/service-accounts/");
        if (response.ok) {
          const data = await response.json();
          setServiceAccounts(data.results || data || []);
        }
      } catch (err) {
        setError(err.message || "Lỗi khi tải service accounts");
      } finally {
        setLoading(false);
      }
    }
    loadServiceAccounts();
  }, []);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.name.trim()) return;
    
    setSubmitting(true);
    try {
      const response = await defaultCoreApiAdapter.corePost("/partner/service-accounts/", {
        name: createForm.name,
        environment: createForm.environment,
        policy_ids: createForm.policy_ids,
        audit_reason: "Created via tenant admin",
      });
      if (response.ok) {
        const data = await response.json();
        setServiceAccounts(prev => [data, ...prev]);
        setShowCreateModal(false);
        setCreateForm({ name: "", environment: "prod", policy_ids: [] });
      } else {
        const errorData = await response.json();
        alert(errorData.error || "Không thể tạo service account");
      }
    } catch (err) {
      alert(err.message || "Lỗi khi tạo service account");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSA = async (saId) => {
    if (!confirm("Bạn có chắc chắn muốn xóa service account này?")) return;
    
    try {
      const response = await defaultCoreApiAdapter.coreDelete(`/partner/service-accounts/${saId}/`);
      if (response.ok) {
        setServiceAccounts(prev => prev.filter(sa => sa.service_account_id !== saId && sa.id !== saId));
      } else {
        const errorData = await response.json();
        alert(errorData.error || "Không thể xóa service account");
      }
    } catch (err) {
      alert(err.message || "Lỗi khi xóa service account");
    }
  };

  const handleToggleStatus = async (sa) => {
    const newStatus = sa.status === "active" ? "disabled" : "active";
    try {
      const response = await defaultCoreApiAdapter.corePatch(`/partner/service-accounts/${sa.service_account_id || sa.id}/`, {
        status: newStatus,
        audit_reason: `Status changed to ${newStatus} via tenant admin`,
      });
      if (response.ok) {
        const data = await response.json();
        setServiceAccounts(prev => prev.map(sa => (sa.service_account_id === data.service_account_id || sa.id === data.id) ? data : sa));
      } else {
        const errorData = await response.json();
        alert(errorData.error || "Không thể thay đổi trạng thái");
      }
    } catch (err) {
      alert(err.message || "Lỗi khi thay đổi trạng thái");
    }
  };

  if (loading) {
    return renderShellPageChrome({
      eyebrow: "Tenant Admin",
      title: "Service Accounts",
      description: "Đang tải danh sách service accounts...",
      children: createElement("div", { className: "shellPage__panel" }, "Đang tải..."),
    });
  }

  if (error) {
    return renderShellPageChrome({
      eyebrow: "Tenant Admin",
      title: "Service Accounts",
      error: error,
      children: createElement("div", { className: "shellPage__panel" }, error),
    });
  }

  const metrics = [
    renderShellMetric("Tổng Service Accounts", String(serviceAccounts.length)),
    renderShellMetric("Đang hoạt động", String(serviceAccounts.filter(sa => sa.status === "active").length)),
    renderShellMetric("Đã vô hiệu", String(serviceAccounts.filter(sa => sa.status === "disabled").length)),
    renderShellMetric("Môi trường Prod", String(serviceAccounts.filter(sa => (sa.metadata?.environment || sa.environment) === "prod").length)),
  ];

  const statusLabels = {
    active: "Hoạt động",
    disabled: "Vô hiệu",
  };

  return renderShellPageChrome({
    eyebrow: "Tenant Admin",
    title: "Service Accounts",
    description: "Quản lý tài khoản máy (Service Accounts) để tích hợp API",
    metrics,
    children: createElement(
      "section",
      { className: "shellPage__bodyGrid" },
      createElement(
        "div",
        { className: "shellPage__stack" },
        // Header with create button
        createElement(
          "div",
          { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" } },
          createElement("h2", { style: { margin: 0, fontSize: "20px" } }, "Danh sách Service Accounts"),
          createElement("button", {
            onClick: () => setShowCreateModal(true),
            style: {
              padding: "10px 20px",
              background: "rgba(0,180,216,0.2)",
              border: "1px solid rgba(0,180,216,0.3)",
              borderRadius: "8px",
              color: "#00b4d8",
              cursor: "pointer",
              fontWeight: 600,
            },
          }, "+ Tạo Service Account mới"),
        ),

        // Service Accounts table
        renderShellPanel({
          title: "Service Accounts",
          subtitle: `${serviceAccounts.length} service account(s)`,
          children: createElement(
            "div",
            { style: { overflowX: "auto" } },
            createElement(
              "table",
              { style: { width: "100%", borderCollapse: "collapse" } },
              createElement(
                "thead",
                null,
                createElement(
                  "tr",
                  { style: { borderBottom: "1px solid rgba(255,255,255,0.08)" } },
                  ["Tên", "Môi trường", "Trạng thái", "Policies", "Tạo lúc", "Thao tác"].map(h =>
                    createElement("th", { key: h, style: { padding: "12px", textAlign: "left", color: "#94a3b8", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em" } }, h)
                  )
                )
              )),
              createElement(
                "tbody",
                null,
                serviceAccounts.map(sa =>
                  createElement(
                    "tr",
                    { key: sa.service_account_id || sa.id, style: { borderBottom: "1px solid rgba(255,255,255,0.04)" } },
                    createElement("td", { style: { padding: "12px", fontWeight: 500 } }, sa.name),
                    createElement("td", { style: { padding: "12px" } },
                      createElement("span", {
                        style: {
                          padding: "4px 10px",
                          borderRadius: "999px",
                          fontSize: "11px",
                          fontWeight: 600,
                          background: (sa.metadata?.environment || sa.environment) === "prod" ? "rgba(0,180,216,0.2)" : "rgba(148,163,184,0.2)",
                          color: (sa.metadata?.environment || sa.environment) === "prod" ? "#00b4d8" : "#94a3b8",
                        },
                      }, (sa.metadata?.environment || sa.environment || "prod").toUpperCase())
                    ),
                    createElement("td", { style: { padding: "12px" } },
                      createElement("span", {
                        style: {
                          padding: "4px 10px",
                          borderRadius: "999px",
                          fontSize: "11px",
                          fontWeight: 600,
                          background: sa.status === "active" ? "rgba(34,197,94,0.2)" : "rgba(255,127,80,0.2)",
                          color: sa.status === "active" ? "#22c55e" : "#ff7f50",
                        },
                      }, statusLabels[sa.status] || sa.status)
                    ),
                    createElement("td", { style: { padding: "12px" } },
                      createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "4px" } },
                        (sa.policy_ids || sa.metadata?.policy_ids || []).map(policy =>
                          createElement("span", {
                            key: policy,
                            style: {
                              padding: "2px 8px",
                              borderRadius: "4px",
                              fontSize: "10px",
                              fontWeight: 500,
                              background: "rgba(0,180,216,0.15)",
                              color: "#00b4d8",
                            },
                          }, policy)
                        )
                      )
                    ),
                    createElement("td", { style: { padding: "12px" } }, sa.created_at ? new Date(sa.created_at).toLocaleDateString("vi-VN") : "N/A"),
                    createElement("td", { style: { padding: "12px" } },
                      createElement("div", { style: { display: "flex", gap: "8px" } },
                        createElement("button", {
                          onClick: () => handleToggleStatus(sa),
                          style: {
                            padding: "6px 12px",
                            background: sa.status === "active" ? "rgba(255,127,80,0.15)" : "rgba(34,197,94,0.15)",
                            border: sa.status === "active" ? "1px solid rgba(255,127,80,0.3)" : "1px solid rgba(34,197,94,0.3)",
                            borderRadius: "6px",
                            color: sa.status === "active" ? "#ff7f50" : "#22c55e",
                            cursor: "pointer",
                            fontSize: "12px",
                          },
                        }, sa.status === "active" ? "Vô hiệu" : "Kích hoạt"),
                        createElement("button", {
                          onClick: () => handleDeleteSA(sa.service_account_id || sa.id),
                          style: {
                            padding: "6px 12px",
                            background: "rgba(255,127,80,0.15)",
                            border: "1px solid rgba(255,127,80,0.3)",
                            borderRadius: "6px",
                            color: "#ff7f50",
                            cursor: "pointer",
                            fontSize: "12px",
                          },
                        }, "Xóa"),
                      )
                    )
                  )
                )
              )
            )
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
                maxWidth: "500px",
                maxHeight: "90vh",
                overflow: "auto",
              },
              onClick: e => e.stopPropagation(),
            },
            createElement("h3", { style: { margin: "0 0 20px", fontSize: "18px" } }, "Tạo Service Account mới"),
            createElement(
              "form",
              { onSubmit: handleCreateSubmit },
              createElement("div", { style: { marginBottom: "16px" } },
                createElement("label", { style: { display: "block", marginBottom: "6px", fontWeight: 500 } }, "Tên Service Account"),
                createElement("input", {
                  type: "text",
                  value: createForm.name,
                  onChange: e => setCreateForm(prev => ({ ...prev, name: e.target.value })),
                  placeholder: "Ví dụ: production-api, data-pipeline",
                  required: true,
                  style: { width: "100%", padding: "10px 12px", background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#f1f5f9", fontSize: "14px" },
                })
              ),
              createElement("div", { style: { marginBottom: "16px" } },
                createElement("label", { style: { display: "block", marginBottom: "6px", fontWeight: 500 } }, "Môi trường"),
                createElement("select", {
                  value: createForm.environment,
                  onChange: e => setCreateForm(prev => ({ ...prev, environment: e.target.value })),
                  style: { width: "100%", padding: "10px 12px", background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#f1f5f9", fontSize: "14px" },
                },
                  createElement("option", { value: "prod" }, "Production"),
                  createElement("option", { value: "staging" }, "Staging"),
                  createElement("option", { value: "dev" }, "Development"),
                )
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
                }, submitting ? "Đang tạo..." : "Tạo Service Account"),
              ),
            )
          )
        ),
      )
    ),
  });
}