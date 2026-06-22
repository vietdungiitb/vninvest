import { ReactNode, useEffect, useState } from "react";
import { ShellPageChrome, ShellPanel, renderShellMetric } from "../../components/ShellPageTemplate.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";

interface Subscription {
  plan_code: string;
  status: string;
  billing_cycle?: string;
  credit_balance?: number;
  current_period_start?: string;
  current_period_end?: string;
  next_invoice_date?: string;
  auto_renew?: boolean;
  invoice_state?: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  issue_date: string;
  status: string;
  total_amount: number;
  payment_method?: string;
}

interface FieldCardProps {
  label: string;
  value: string;
}

function FieldCard({ label, value }: FieldCardProps): ReactNode {
  return (
    <div style={{ padding: "10px 12px", background: "rgba(15,23,42,0.4)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: "12px" }}>
      <p style={{ margin: 0, fontSize: "10px", fontWeight: "bold", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.18em" }}>{label}</p>
      <p style={{ margin: "4px 0 0", fontSize: "14px", fontWeight: 500, color: "#cbd5e1" }}>{value}</p>
    </div>
  );
}

function formatCurrency(value: unknown): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "\u2014";
  }
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(Number(value));
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "\u2014";
  return new Date(value).toLocaleDateString("vi-VN");
}

interface TenantAdminBillingPageProps {
  env?: Record<string, unknown>;
  fetchImpl?: unknown;
  bootstrapLoader?: unknown;
  autoLoad?: boolean;
  initialSnapshot?: Record<string, unknown> | null;
}

const STATUS_LABELS: Record<string, string> = {
  active: "Hoạt động",
  trialing: "Dùng thử",
  past_due: "Quá hạn thanh toán",
  canceled: "Đã hủy",
};

export function TenantAdminBillingPage({}: TenantAdminBillingPageProps) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [subRes, invRes] = await Promise.all([
        defaultCoreApiAdapter.coreGet("/partner/billing/subscription/"),
        defaultCoreApiAdapter.coreGet("/partner/billing/invoices/"),
      ]);

      if (subRes.ok) {
        const subData = await subRes.json();
        setSubscription(subData);
      }
      if (invRes.ok) {
        const invData = await invRes.json();
        setInvoices(invData.results || invData.data || invData || []);
      }
    } catch (err) {
      setError((err as Error).message || "Lỗi khi tải thông tin thanh toán");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading && !subscription) {
    return (
      <ShellPageChrome
        eyebrow="Tenant Admin"
        title="Thanh toán & Hóa đơn"
        description="Đang tải thông tin thanh toán..."
      >
        <div className="shellPage__panel">Đang tải...</div>
      </ShellPageChrome>
    );
  }

  if (error && !subscription) {

    return (
      <ShellPageChrome
        eyebrow="Tenant Admin"
        title="Thanh toán & Hóa đơn"
        description="Không thể tải thông tin thanh toán"
        error={error}
      >
        <div className="shellPage__panel">{error}</div>
      </ShellPageChrome>
    );
  }

  const metrics = [
    renderShellMetric("Gói cước hiện tại", subscription?.plan_code || "N/A"),
    renderShellMetric("Trạng thái", STATUS_LABELS[subscription?.status ?? ""] || subscription?.status || "N/A"),
    renderShellMetric("Tổng số hóa đơn", String(invoices.length)),
  ];

  return (
    <ShellPageChrome
      eyebrow="Tenant Admin"
      title="Thanh toán & Hóa đơn"
      description="Quản lý gói đăng ký dịch vụ SaaS, xem hóa đơn và thanh toán trực tuyến"
      metrics={metrics}
    >
      <section className="shellPage__bodyGrid">
        <div className="shellPage__stack">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h2 style={{ margin: 0, fontSize: "20px" }}>Thông tin gói dịch vụ</h2>
            <button
              onClick={loadData}
              style={{ padding: "8px 16px", background: "rgba(148,163,184,0.1)", border: "1px solid rgba(148,163,184,0.2)", borderRadius: "8px", color: "#cbd5e1", cursor: "pointer", fontSize: "13px" }}
            >
              Làm mới
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", marginBottom: "24px" }}>
            <ShellPanel
              title="Đăng ký của tôi"
              subtitle="Chi tiết gói cước và kỳ hạn thanh toán hiện tại"
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <FieldCard label="Tên gói cước" value={subscription?.plan_code || "N/A"} />
                <FieldCard label="Trạng thái" value={STATUS_LABELS[subscription?.status ?? ""] || subscription?.status || "N/A"} />
                <FieldCard label="Chu kỳ thanh toán" value={subscription?.billing_cycle === "annual" ? "Hàng năm" : "Hàng tháng"} />
                <FieldCard label="Số dư tài khoản" value={formatCurrency(subscription?.credit_balance)} />
                <FieldCard
                  label="Chu kỳ hiện tại"
                  value={subscription?.current_period_end ? `${formatDate(subscription.current_period_start)} - ${formatDate(subscription.current_period_end)}` : "N/A"}
                />
                <FieldCard label="Gia hạn tiếp theo" value={formatDate(subscription?.next_invoice_date)} />
                <FieldCard label="Tự động gia hạn" value={subscription?.auto_renew ? "Đang bật" : "Đã tắt"} />
                <FieldCard label="Trạng thái hóa đơn" value={subscription?.invoice_state === "past_due" ? "Nợ cước" : "Bình thường"} />
              </div>
            </ShellPanel>

            <ShellPanel
              title="Lịch sử hóa đơn"
              subtitle={`${invoices.length} hóa đơn phát sinh`}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "400px", overflowY: "auto" }}>
                {invoices.length === 0 ? (
                  <div style={{ padding: "24px", textAlign: "center", color: "#64748b" }}>Chưa phát sinh hóa đơn nào.</div>
                ) : (
                  invoices.map(invoice => (
                    <div
                      key={invoice.id}
                      style={{ padding: "12px", border: "1px solid rgba(255,255,255,0.04)", background: "rgba(15,23,42,0.3)", borderRadius: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, color: "#f1f5f9", fontSize: "14px" }}>{invoice.invoice_number}</div>
                        <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>{`Ngày lập: ${formatDate(invoice.issue_date)}`}</div>
                        <div style={{ fontSize: "11px", fontWeight: 600, color: invoice.status === "paid" ? "#22c55e" : "#ff7f50", marginTop: "4px" }}>
                          {invoice.status === "paid" ? "Đã thanh toán" : "Chờ thanh toán"}
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                        <span style={{ fontWeight: 600, color: "#cbd5e1", fontSize: "14px" }}>{formatCurrency(invoice.total_amount)}</span>
                        {invoice.payment_method && <span style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>{invoice.payment_method}</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ShellPanel>
          </div>
        </div>
      </section>
    </ShellPageChrome>
  );
}
