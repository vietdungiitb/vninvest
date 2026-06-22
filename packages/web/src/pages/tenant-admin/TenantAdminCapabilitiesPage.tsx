import { ReactNode } from "react";
import { ShellPageChrome, ShellPanel, renderShellMetric } from "../../components/ShellPageTemplate.js";
import { usePortfolio } from "../../context/PortfolioContext.js";

interface AbilityItem {
  key: string;
  action: string;
  subject: string;
}

interface QuotaItem {
  key: string;
  value: number;
}

interface ListPanelProps {
  title: string;
  emptyLabel: string;
  items: AbilityItem[] | QuotaItem[];
  renderItem: (item: AbilityItem | QuotaItem) => ReactNode;
}

function ListPanel({ title, emptyLabel, items, renderItem }: ListPanelProps): ReactNode {
  return (
    <ShellPanel title={title} subtitle={`${items.length} mục`}>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {items.length === 0 ? (
          <div style={{ padding: "16px", textAlign: "center", color: "#64748b" }}>{emptyLabel}</div>
        ) : (
          items.map(item => renderItem(item))
        )}
      </div>
    </ShellPanel>
  );
}

function formatQuotaValue(value: number): string {
  if (value === null || value === undefined || value < 0) {
    return "Không giới hạn";
  }
  return new Intl.NumberFormat("vi-VN").format(value);
}

interface TenantAdminCapabilitiesPageProps {
  env?: Record<string, unknown>;
  fetchImpl?: unknown;
  bootstrapLoader?: unknown;
  autoLoad?: boolean;
  initialSnapshot?: Record<string, unknown> | null;
}

const PLAN_LABELS: Record<string, string> = {
  free: "Miễn phí",
  basic: "Cơ bản",
  starter: "Khởi động",
  pro: "Chuyên nghiệp",
  premium: "Cao cấp",
  enterprise: "Doanh nghiệp",
};

export function TenantAdminCapabilitiesPage({}: TenantAdminCapabilitiesPageProps) {
  const { userPlan, userEntitlements } = usePortfolio();

  const entitlements = userEntitlements || {};
  const abilities = Array.isArray(entitlements.abilities) ? entitlements.abilities as Array<{ action: string; subject: string }> : [];
  const quotaCaps = entitlements.quota_caps || {};

  const abilityItems: AbilityItem[] = abilities.map(item => ({
    key: `${item.action}:${item.subject}`,
    action: item.action,
    subject: item.subject,
  }));

  const quotaItems: QuotaItem[] = Object.entries(quotaCaps).map(([key, value]) => ({ key, value: value as number }));

  const metrics = [
    renderShellMetric("Gói dịch vụ", PLAN_LABELS[userPlan as string] || userPlan || "N/A"),
    renderShellMetric("Số lượng quyền hạn", String(abilities.length)),
    renderShellMetric("Số lượng hạn ngạch", String(quotaItems.length)),
  ];

  return (
    <ShellPageChrome
      eyebrow="Tenant Admin"
      title="Quyền hạn & Hạn ngạch (Capabilities)"
      description="Xem các tính năng được phân quyền và giới hạn sử dụng (Quota) của bạn trên hệ thống"
      metrics={metrics}
    >
      <section className="shellPage__bodyGrid">
        <div className="shellPage__stack">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
            <ListPanel
              title="Quyền hạn chức năng (Abilities)"
              emptyLabel="Không có quyền hạn đặc biệt nào được cấu hình."
              items={abilityItems}
              renderItem={(item) => (
                <div
                  key={item.key}
                  style={{ padding: "10px 12px", background: "rgba(15,23,42,0.3)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: "10px" }}
                >
                  <p style={{ margin: 0, fontSize: "11px", fontWeight: 600, color: "#a78bfa", textTransform: "uppercase" }}>{(item as AbilityItem).action}</p>
                  <p style={{ margin: "4px 0 0", fontSize: "14px", color: "#cbd5e1" }}>{(item as AbilityItem).subject}</p>
                </div>
              )}
            />

            <ListPanel
              title="Hạn ngạch giới hạn (Quotas)"
              emptyLabel="Không có hạn ngạch giới hạn được áp dụng."
              items={quotaItems}
              renderItem={(item) => (
                <div
                  key={item.key}
                  style={{ padding: "10px 12px", background: "rgba(15,23,42,0.3)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: "10px" }}
                >
                  <p style={{ margin: 0, fontSize: "11px", fontWeight: 600, color: "#34d399", textTransform: "uppercase" }}>{item.key}</p>
                  <p style={{ margin: "4px 0 0", fontSize: "14px", color: "#cbd5e1" }}>{formatQuotaValue((item as QuotaItem).value)}</p>
                </div>
              )}
            />
          </div>
        </div>
      </section>
    </ShellPageChrome>
  );
}
