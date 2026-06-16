import { createElement } from "react";
import { renderShellPageChrome, renderShellPanel, renderShellMetric } from "../../components/ShellPageTemplate.js";
import { usePortfolio } from "../../context/PortfolioContext.js";

function SummaryTile({ label, value, detail }) {
  return createElement(
    "div",
    {
      style: {
        padding: "16px",
        background: "rgba(15,23,42,0.6)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "16px",
      },
    },
    createElement("p", { style: { margin: 0, fontSize: "10px", fontWeight: "bold", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.18em" } }, label),
    createElement("p", { style: { margin: "8px 0 0", fontSize: "18px", fontWeight: "600", color: "#f1f5f9" } }, value),
    detail && createElement("p", { style: { margin: "4px 0 0", fontSize: "12px", color: "#64748b" } }, detail)
  );
}

function ListPanel({ title, emptyLabel, items, renderItem }) {
  return renderShellPanel({
    title,
    subtitle: `${items.length} mục`,
    children: createElement(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "10px" } },
      items.length === 0 ? createElement("div", { style: { padding: "16px", textAlign: "center", color: "#64748b" } }, emptyLabel) :
      items.map(item => renderItem(item))
    ),
  });
}

function formatQuotaValue(value) {
  if (value === null || value === undefined || value < 0) {
    // Treat negative or null as unlimited
    return "Không giới hạn";
  }
  return new Intl.NumberFormat("vi-VN").format(value);
}

export function TenantAdminCapabilitiesPage({ env = {}, fetchImpl, bootstrapLoader, autoLoad = true, initialSnapshot = null }) {
  const { ability, userIdentity, userPlan, userEntitlements } = usePortfolio();

  const entitlements = userEntitlements || {};
  const abilities = Array.isArray(entitlements.abilities) ? entitlements.abilities : [];
  const quotaCaps = entitlements.quota_caps || {};
  
  const abilityItems = abilities.map(item => ({
    key: `${item.action}:${item.subject}`,
    action: item.action,
    subject: item.subject,
  }));

  const quotaItems = Object.entries(quotaCaps).map(([key, value]) => ({ key, value }));

  const planLabels = {
    free: "Miễn phí",
    basic: "Cơ bản",
    starter: "Khởi động",
    pro: "Chuyên nghiệp",
    premium: "Cao cấp",
    enterprise: "Doanh nghiệp",
  };

  const metrics = [
    renderShellMetric("Gói dịch vụ", planLabels[userPlan] || userPlan || "N/A"),
    renderShellMetric("Số lượng quyền hạn", String(abilities.length)),
    renderShellMetric("Số lượng hạn ngạch", String(quotaItems.length)),
  ];

  return renderShellPageChrome({
    eyebrow: "Tenant Admin",
    title: "Quyền hạn & Hạn ngạch (Capabilities)",
    description: "Xem các tính năng được phân quyền và giới hạn sử dụng (Quota) của bạn trên hệ thống",
    metrics,
    children: createElement(
      "section",
      { className: "shellPage__bodyGrid" },
      createElement(
        "div",
        { className: "shellPage__stack" },

        createElement(
          "div",
          { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" } },

          // Abilities Panel
          createElement(ListPanel, {
            title: "Quyền hạn chức năng (Abilities)",
            emptyLabel: "Không có quyền hạn đặc biệt nào được cấu hình.",
            items: abilityItems,
            renderItem: (item) => createElement(
              "div",
              {
                key: item.key,
                style: {
                  padding: "10px 12px",
                  background: "rgba(15,23,42,0.3)",
                  border: "1px solid rgba(255,255,255,0.04)",
                  borderRadius: "10px",
                },
              },
              createElement("p", { style: { margin: 0, fontSize: "11px", fontWeight: 600, color: "#a78bfa", textTransform: "uppercase" } }, item.action),
              createElement("p", { style: { margin: "4px 0 0", fontSize: "14px", color: "#cbd5e1" } }, item.subject)
            )
          }),

          // Quotas Panel
          createElement(ListPanel, {
            title: "Hạn ngạch giới hạn (Quotas)",
            emptyLabel: "Không có hạn ngạch giới hạn được áp dụng.",
            items: quotaItems,
            renderItem: (item) => createElement(
              "div",
              {
                key: item.key,
                style: {
                  padding: "10px 12px",
                  background: "rgba(15,23,42,0.3)",
                  border: "1px solid rgba(255,255,255,0.04)",
                  borderRadius: "10px",
                },
              },
              createElement("p", { style: { margin: 0, fontSize: "11px", fontWeight: 600, color: "#34d399", textTransform: "uppercase" } }, item.key),
              createElement("p", { style: { margin: "4px 0 0", fontSize: "14px", color: "#cbd5e1" } }, formatQuotaValue(item.value))
            )
          })

        )

      )
    ),
  });
}
