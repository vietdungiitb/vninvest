import { useEffect, useState } from "react";
import { ShellPageChrome, ShellPanel, renderShellMetric } from "../../components/ShellPageTemplate.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";

interface Meter {
  meter_code: string;
  display_name: string;
  consumed_amount: number;
  remaining_amount: number;
  reset_at?: string;
  risk_state: string;
}

interface Quota {
  meter_code: string;
  display_name: string;
  unit: string;
  entitled_amount: number;
  consumed_amount: number;
  remaining_amount: number;
  hard_stop: boolean;
}

interface UsageBarProps {
  consumedAmount: number;
  entitledAmount: number;
  riskState: string;
}

interface TenantAdminUsagePageProps {
  env?: Record<string, unknown>;
  fetchImpl?: unknown;
  bootstrapLoader?: unknown;
  autoLoad?: boolean;
  initialSnapshot?: Record<string, unknown> | null;
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (value < 0) {
    return "∞";
  }
  return new Intl.NumberFormat("vi-VN").format(value);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("vi-VN");
}

function resolveToneColor(riskState: string): string {
  if (riskState === "critical") return "#ef4444";
  if (riskState === "warning") return "#f59e0b";
  return "#10b981";
}

function UsageBar({ consumedAmount, entitledAmount, riskState }: UsageBarProps) {
  const ratio = entitledAmount > 0 ? Math.min((consumedAmount / entitledAmount) * 100, 100) : 0;
  const toneColor = resolveToneColor(riskState);

  return (
    <div style={{ marginTop: "12px", marginBottom: "12px" }}>
      <div style={{ height: "8px", overflow: "hidden", borderRadius: "999px", background: "rgba(255,255,255,0.06)" }}>
        <div style={{ height: "100%", borderRadius: "999px", width: `${ratio}%`, background: toneColor, transition: "width 0.3s ease" }} />
      </div>
    </div>
  );
}

const riskLabels: Record<string, string> = {
  normal: "Bình thường",
  warning: "Cảnh báo",
  critical: "Nghiêm trọng",
};

export function TenantAdminUsagePage({
  env: _env = {},
  fetchImpl: _fetchImpl,
  bootstrapLoader: _bootstrapLoader,
  autoLoad: _autoLoad = true,
  initialSnapshot: _initialSnapshot = null,
}: TenantAdminUsagePageProps) {
  const [meters, setMeters] = useState<Meter[]>([]);
  const [quotas, setQuotas] = useState<Quota[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [metersRes, quotasRes] = await Promise.all([
        defaultCoreApiAdapter.coreGet("/partner/usage/meters/"),
        defaultCoreApiAdapter.coreGet("/partner/usage/quotas/"),
      ]);

      setMeters(metersRes.ok ? (await metersRes.json()).results || [] : []);
      setQuotas(quotasRes.ok ? (await quotasRes.json()).results || [] : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Lỗi khi tải thông tin hạn ngạch sử dụng");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading && meters.length === 0) {
    return (
      <ShellPageChrome
        eyebrow="Tenant Admin"
        title="Hạn mức sử dụng"
        description="Đang tải thông tin hạn mức sử dụng..."
      >
        <div className="shellPage__panel">Đang tải...</div>
      </ShellPageChrome>
    );
  }

  if (error && meters.length === 0) {
    return (
      <ShellPageChrome
        eyebrow="Tenant Admin"
        title="Hạn mức sử dụng"
        description="Không thể tải thông tin hạn mức sử dụng"
        error={error}
      >
        <div className="shellPage__panel">{error}</div>
      </ShellPageChrome>
    );
  }

  const warningCount = meters.filter(m => m.risk_state === "warning").length;
  const criticalCount = meters.filter(m => m.risk_state === "critical").length;
  const quotaByMeterCode = new Map(quotas.map(q => [q.meter_code, q]));

  const metrics = [
    renderShellMetric("Chỉ số đo lường", String(meters.length)),
    renderShellMetric("Mức cảnh báo", String(warningCount)),
    renderShellMetric("Mức nghiêm trọng", String(criticalCount)),
  ];

  return (
    <ShellPageChrome
      eyebrow="Tenant Admin"
      title="Hạn mức sử dụng"
      description="Giám sát tài nguyên, số lượng lệnh gọi API và hạn mức hoạt động của Tenant"
      metrics={metrics}
    >
      <section className="shellPage__bodyGrid">
        <div className="shellPage__stack">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h2 style={{ margin: 0, fontSize: "20px" }}>Chỉ số tài nguyên sử dụng</h2>
            <button
              onClick={loadData}
              style={{
                padding: "8px 16px",
                background: "rgba(148,163,184,0.1)",
                border: "1px solid rgba(148,163,184,0.2)",
                borderRadius: "8px",
                color: "#cbd5e1",
                cursor: "pointer",
                fontSize: "13px",
              }}
            >
              Làm mới
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
            <ShellPanel
              title="Tài nguyên đã tiêu thụ"
              subtitle="Giám sát mức độ sử dụng tài nguyên trong chu kỳ"
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {meters.length === 0 ? (
                  <div style={{ padding: "24px", textAlign: "center", color: "#64748b" }}>Chưa đo lường tài nguyên nào.</div>
                ) : (
                  meters.map(meter => {
                    const quota = quotaByMeterCode.get(meter.meter_code);
                    const entitledAmount = quota?.entitled_amount ?? -1;

                    return (
                      <div
                        key={meter.meter_code}
                        style={{
                          padding: "16px",
                          border: "1px solid rgba(255,255,255,0.04)",
                          background: "rgba(15,23,42,0.3)",
                          borderRadius: "12px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div style={{ fontWeight: 600, color: "#f1f5f9", fontSize: "15px" }}>{meter.display_name}</div>
                            <code style={{ fontSize: "11px", color: "#64748b", display: "block", marginTop: "2px", fontFamily: "monospace" }}>{meter.meter_code}</code>
                          </div>
                          <span
                            style={{
                              padding: "4px 8px",
                              borderRadius: "4px",
                              fontSize: "11px",
                              fontWeight: 600,
                              background: meter.risk_state === "critical" ? "rgba(239,68,68,0.2)" : (meter.risk_state === "warning" ? "rgba(245,158,11,0.2)" : "rgba(16,185,129,0.2)"),
                              color: meter.risk_state === "critical" ? "#ef4444" : (meter.risk_state === "warning" ? "#f59e0b" : "#10b981"),
                            }}
                          >
                            {riskLabels[meter.risk_state] || meter.risk_state}
                          </span>
                        </div>
                        <UsageBar consumedAmount={meter.consumed_amount} entitledAmount={entitledAmount} riskState={meter.risk_state} />
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr", gap: "10px", marginTop: "12px", fontSize: "13px" }}>
                          <div>
                            <span style={{ color: "#64748b", display: "block", fontSize: "11px" }}>Đã dùng</span>
                            <span style={{ color: "#cbd5e1" }}>{formatNumber(meter.consumed_amount)}</span>
                          </div>
                          <div>
                            <span style={{ color: "#64748b", display: "block", fontSize: "11px" }}>Còn lại</span>
                            <span style={{ color: "#cbd5e1" }}>{formatNumber(meter.remaining_amount)}</span>
                          </div>
                          <div>
                            <span style={{ color: "#64748b", display: "block", fontSize: "11px" }}>Ngày đặt lại</span>
                            <span style={{ color: "#cbd5e1" }}>{formatDate(meter.reset_at)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ShellPanel>

            <ShellPanel
              title="Hạn ngạch gói cước"
              subtitle="Hạn mức tài nguyên được cấp theo gói đăng ký"
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {quotas.length === 0 ? (
                  <div style={{ padding: "24px", textAlign: "center", color: "#64748b" }}>Chưa định nghĩa hạn ngạch nào.</div>
                ) : (
                  quotas.map(quota => (
                    <div
                      key={quota.meter_code}
                      style={{
                        padding: "12px",
                        border: "1px solid rgba(255,255,255,0.04)",
                        background: "rgba(15,23,42,0.3)",
                        borderRadius: "10px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <span style={{ fontWeight: 600, color: "#f1f5f9", fontSize: "14px" }}>{quota.display_name}</span>
                          <span style={{ fontSize: "11px", color: "#64748b", display: "block", marginTop: "2px" }}>Đơn vị: {quota.unit}</span>
                        </div>
                        <span
                          style={{
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: 600,
                            background: quota.hard_stop ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)",
                            color: quota.hard_stop ? "#ef4444" : "#10b981",
                          }}
                        >
                          {quota.hard_stop ? "Chặn cứng khi hết" : "Vượt mức có phí"}
                        </span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginTop: "10px", fontSize: "12px" }}>
                        <div>
                          <span style={{ color: "#64748b", display: "block", fontSize: "10px" }}>Hạn mức</span>
                          <span style={{ color: "#cbd5e1" }}>{formatNumber(quota.entitled_amount)}</span>
                        </div>
                        <div>
                          <span style={{ color: "#64748b", display: "block", fontSize: "10px" }}>Đã dùng</span>
                          <span style={{ color: "#cbd5e1" }}>{formatNumber(quota.consumed_amount)}</span>
                        </div>
                        <div>
                          <span style={{ color: "#64748b", display: "block", fontSize: "10px" }}>Còn lại</span>
                          <span style={{ color: "#cbd5e1" }}>{formatNumber(quota.remaining_amount)}</span>
                        </div>
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
