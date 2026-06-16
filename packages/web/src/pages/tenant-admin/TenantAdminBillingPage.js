import { createElement, useEffect, useState } from "react";
import { renderShellPageChrome, renderShellPanel, renderShellMetric } from "../../components/ShellPageTemplate.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";

function SummaryCard({ label, value, hint }) {
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
    hint && createElement("p", { style: { margin: "4px 0 0", fontSize: "12px", color: "#64748b" } }, hint)
  );
}

function FieldCard({ label, value }) {
  return createElement(
    "div",
    {
      style: {
        padding: "10px 12px",
        background: "rgba(15,23,42,0.4)",
        border: "1px solid rgba(255,255,255,0.04)",
        borderRadius: "12px",
      },
    },
    createElement("p", { style: { margin: 0, fontSize: "10px", fontWeight: "bold", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.18em" } }, label),
    createElement("p", { style: { margin: "4px 0 0", fontSize: "14px", fontWeight: 500, color: "#cbd5e1" } }, value)
  );
}

function formatCurrency(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(Number(value));
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("vi-VN");
}

export function TenantAdminBillingPage({ env = {}, fetchImpl, bootstrapLoader, autoLoad = true, initialSnapshot = null }) {
  const [subscription, setSubscription] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [subRes, invRes] = await Promise.all([
        defaultCoreApiAdapter.coreGet("/partner/billing/subscription/"),
        defaultCoreApiAdapter.coreGet("/partner/billing/invoices/"),
      ]);

      setSubscription(subRes);
      setInvoices(invRes.results || invRes.data || invRes || []);
    } catch (err) {
      setError(err.message || "Lỗi khi tải thông tin thanh toán");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading && !subscription) {
    return renderShellPageChrome({
      eyebrow: "Tenant Admin",
      title: "Thanh toán & Hóa đơn",
      description: "Đang tải thông tin thanh toán...",
      children: createElement("div", { className: "shellPage__panel" }, "Đang tải..."),
    });
  }

  if (error && !subscription) {
    return renderShellPageChrome({
      eyebrow: "Tenant Admin",
      title: "Thanh toán & Hóa đơn",
      error: error,
      children: createElement("div", { className: "shellPage__panel" }, error),
    });
  }

  const pastDueCount = invoices.filter(inv => inv.status === "overdue" || inv.status === "past_due").length;
  const statusLabels = {
    active: "Hoạt động",
    trialing: "Dùng thử",
    past_due: "Quá hạn thanh toán",
    canceled: "Đã hủy",
  };

  const metrics = [
    renderShellMetric("Gói cước hiện tại", subscription?.plan_code || "N/A"),
    renderShellMetric("Trạng thái", statusLabels[subscription?.status] || subscription?.status || "N/A"),
    renderShellMetric("Tổng số hóa đơn", String(invoices.length)),
  ];

  return renderShellPageChrome({
    eyebrow: "Tenant Admin",
    title: "Thanh toán & Hóa đơn",
    description: "Quản lý gói đăng ký dịch vụ SaaS, xem hóa đơn và thanh toán trực tuyến",
    metrics,
    children: createElement(
      "section",
      { className: "shellPage__bodyGrid" },
      createElement(
        "div",
        { className: "shellPage__stack" },

        createElement(
          "div",
          { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" } },
          createElement("h2", { style: { margin: 0, fontSize: "20px" } }, "Thông tin gói dịch vụ"),
          createElement("button", {
            onClick: loadData,
            style: {
              padding: "8px 16px",
              background: "rgba(148,163,184,0.1)",
              border: "1px solid rgba(148,163,184,0.2)",
              borderRadius: "8px",
              color: "#cbd5e1",
              cursor: "pointer",
              fontSize: "13px",
            },
          }, "Làm mới")
        ),

        createElement(
          "div",
          { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", marginBottom: "24px" } },
          
          // Subscription Details Panel
          renderShellPanel({
            title: "Đăng ký của tôi",
            subtitle: "Chi tiết gói cước và kỳ hạn thanh toán hiện tại",
            children: createElement(
              "div",
              { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" } },
              createElement(FieldCard, { label: "Tên gói cước", value: subscription?.plan_code || "N/A" }),
              createElement(FieldCard, { label: "Trạng thái", value: statusLabels[subscription?.status] || subscription?.status || "N/A" }),
              createElement(FieldCard, { label: "Chu kỳ thanh toán", value: subscription?.billing_cycle === "annual" ? "Hàng năm" : "Hàng tháng" }),
              createElement(FieldCard, { label: "Số dư tài khoản", value: formatCurrency(subscription?.credit_balance) }),
              createElement(FieldCard, {
                label: "Chu kỳ hiện tại",
                value: subscription?.current_period_end ? `${formatDate(subscription.current_period_start)} - ${formatDate(subscription.current_period_end)}` : "N/A"
              }),
              createElement(FieldCard, { label: "Gia hạn tiếp theo", value: formatDate(subscription?.next_invoice_date) }),
              createElement(FieldCard, { label: "Tự động gia hạn", value: subscription?.auto_renew ? "Đang bật" : "Đã tắt" }),
              createElement(FieldCard, { label: "Trạng thái hóa đơn", value: subscription?.invoice_state === "past_due" ? "Nợ cước" : "Bình thường" })
            ),
          }),

          // Invoices Panel
          renderShellPanel({
            title: "Lịch sử hóa đơn",
            subtitle: `${invoices.length} hóa đơn phát sinh`,
            children: createElement(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "12px", maxHeight: "400px", overflowY: "auto" } },
              invoices.length === 0 ? createElement("div", { style: { padding: "24px", textAlign: "center", color: "#64748b" } }, "Chưa phát sinh hóa đơn nào.") :
              invoices.map(invoice =>
                createElement(
                  "div",
                  {
                    key: invoice.id,
                    style: {
                      padding: "12px",
                      border: "1px solid rgba(255,255,255,0.04)",
                      background: "rgba(15,23,42,0.3)",
                      borderRadius: "10px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    },
                  },
                  createElement(
                    "div",
                    null,
                    createElement("div", { style: { fontWeight: 600, color: "#f1f5f9", fontSize: "14px" } }, invoice.invoice_number),
                    createElement("div", { style: { fontSize: "11px", color: "#64748b", marginTop: "2px" } }, `Ngày lập: ${formatDate(invoice.issue_date)}`),
                    createElement("div", {
                      style: {
                        fontSize: "11px",
                        fontWeight: 600,
                        color: invoice.status === "paid" ? "#22c55e" : "#ff7f50",
                        marginTop: "4px",
                      },
                    }, invoice.status === "paid" ? "Đã thanh toán" : "Chờ thanh toán")
                  ),
                  createElement(
                    "div",
                    { style: { display: "flex", flexDirection: "column", alignItems: "flex-end" } },
                    createElement("span", { style: { fontWeight: 600, color: "#cbd5e1", fontSize: "14px" } }, formatCurrency(invoice.total_amount)),
                    invoice.payment_method && createElement("span", { style: { fontSize: "11px", color: "#64748b", marginTop: "2px" } }, invoice.payment_method)
                  )
                )
              )
            ),
          })

        )

      )
    ),
  });
}
