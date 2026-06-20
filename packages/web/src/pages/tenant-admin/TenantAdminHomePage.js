import { createElement, useEffect, useState } from "react";
import { renderShellPageChrome, renderShellPanel, renderShellMetric } from "../../components/ShellPageTemplate.js";
import { renderSummaryCard } from "../coreShellPageHelpers.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";

export function TenantAdminHomePage({ env = {}, fetchImpl, bootstrapLoader, autoLoad = true, initialSnapshot = null }) {
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadTenant() {
      try {
        setLoading(true);
        const response = await defaultCoreApiAdapter.coreGet("/partner/tenant/");
        if (response.ok) {
          const data = await response.json();
          setTenant(data);
        } else {
          setError("Không thể tải thông tin tenant");
        }
      } catch (err) {
        setError(err.message || "Lỗi khi tải tenant");
      } finally {
        setLoading(false);
      }
    }
    loadTenant();
  }, []);

  if (loading) {
    return renderShellPageChrome({
      eyebrow: "Tenant Admin",
      title: "Dashboard",
      description: "Đang tải thông tin tenant...",
      children: createElement("div", { className: "shellPage__panel" }, "Đang tải..."),
    });
  }

  if (error) {
    return renderShellPageChrome({
      eyebrow: "Tenant Admin",
      title: "Dashboard",
      description: "Không thể tải thông tin tenant",
      error: error,
      children: createElement("div", { className: "shellPage__panel" }, error),
    });
  }

  const metrics = [
    renderShellMetric("Tenant ID", tenant?.tenant_id || "N/A"),
    renderShellMetric("Plan", tenant?.plan || "N/A"),
    renderShellMetric("Status", tenant?.status || "N/A"),
    renderShellMetric("Tenant Code", tenant?.tenant_code || "N/A"),
  ];

  const summaryCards = [
    renderSummaryCard({
      key: "tenant-info",
      title: "Thông tin Tenant",
      rows: [
        { label: "Tên hiển thị", value: tenant?.display_name || "N/A" },
        { label: "Mã tenant", value: tenant?.tenant_code || "N/A" },
        { label: "Gói cước", value: tenant?.plan || "N/A" },
        { label: "Trạng thái", value: tenant?.status || "N/A" },
        { label: "Trial kết thúc", value: tenant?.trial_ends_at ? new Date(tenant.trial_ends_at).toLocaleDateString("vi-VN") : "N/A" },
        { label: "Kích hoạt lúc", value: tenant?.activated_at ? new Date(tenant.activated_at).toLocaleDateString("vi-VN") : "N/A" },
      ],
    }),
    renderSummaryCard({
      key: "billing-info",
      title: "Thông tin thanh toán",
      rows: [
        { label: "Kỳ thanh toán bắt đầu", value: tenant?.billing_period_start || "N/A" },
        { label: "Kỳ thanh toán kết thúc", value: tenant?.billing_period_end || "N/A" },
        { label: "Ngày tạo", value: tenant?.created_at ? new Date(tenant.created_at).toLocaleDateString("vi-VN") : "N/A" },
        { label: "Cập nhật lần cuối", value: tenant?.updated_at ? new Date(tenant.updated_at).toLocaleDateString("vi-VN") : "N/A" },
      ],
    }),
  ];

  return renderShellPageChrome({
    eyebrow: "Tenant Admin",
    title: "Dashboard",
    description: "Tổng quan thông tin tenant và các chỉ số chính",
    metrics,
    children: createElement(
      "section",
      { className: "shellPage__bodyGrid" },
      createElement(
        "div",
        { className: "shellPage__stack" },
        renderShellPanel({
          title: "Thông tin tenant",
          subtitle: "Chi tiết cấu hình và trạng thái tenant hiện tại",
          children: createElement("section", { className: "shellPage__summaryGrid" }, summaryCards),
        }),
        renderShellPanel({
          title: "Lối nhanh",
          subtitle: "Điều hướng đến các chức năng quản trị",
          children: createElement(
            "ul",
            { style: { listStyle: "none", padding: 0, margin: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" } },
            [
              createElement("li", { key: "members" }, createElement("a", { href: "/tenant-admin/members", style: { display: "block", padding: "16px", background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", textDecoration: "none", color: "#f1f5f9", fontWeight: 600 } }, "👥 Quản lý thành viên")),
              createElement("li", { key: "service-accounts" }, createElement("a", { href: "/tenant-admin/service-accounts", style: { display: "block", padding: "16px", background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", textDecoration: "none", color: "#f1f5f9", fontWeight: 600 } }, "🔧 Service Accounts")),
              createElement("li", { key: "pats" }, createElement("a", { href: "/tenant-admin/pats", style: { display: "block", padding: "16px", background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", textDecoration: "none", color: "#f1f5f9", fontWeight: 600 } }, "🔑 API Tokens (PATs)")),
              createElement("li", { key: "usage" }, createElement("a", { href: "/tenant-admin/usage", style: { display: "block", padding: "16px", background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", textDecoration: "none", color: "#f1f5f9", fontWeight: 600 } }, "📊 Hạn mức sử dụng")),
              createElement("li", { key: "billing" }, createElement("a", { href: "/tenant-admin/billing", style: { display: "block", padding: "16px", background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", textDecoration: "none", color: "#f1f5f9", fontWeight: 600 } }, "💳 Hóa đơn & Cước")),
              createElement("li", { key: "audit-logs" }, createElement("a", { href: "/tenant-admin/audit-logs", style: { display: "block", padding: "16px", background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", textDecoration: "none", color: "#f1f5f9", fontWeight: 600 } }, "📋 Nhật ký vận hành")),
            ]
          ),
        }),
      )
    ),
  });
}