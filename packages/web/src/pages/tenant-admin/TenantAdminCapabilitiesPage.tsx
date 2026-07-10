import { Link } from "react-router-dom";
import { ShellPageChrome, ShellPanel, renderShellMetric } from "../../components/ShellPageTemplate.js";
import { ShellEmptyState } from "../../components/ShellEmptyState.js";
import { useI18n } from "../../context/LangContext.js";
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

function formatQuotaValue(value: number, formatNumber: (n: number, opts?: object) => string, tt: (key: string, opts?: object) => string): string {
  if (value === null || value === undefined || value < 0) {
    return tt("tenantHome.unlimited");
  }
  return formatNumber(value);
}

const CAP_CSS = `
.capGrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; }
.capCard { background: var(--shell-surface); border: 1px solid var(--shell-border); border-radius: 12px; padding: 16px; }
.capCard__header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
.capCard__title { font-size: 13px; font-weight: 700; color: var(--shell-ink); }
.capCard__value { font-size: 22px; font-weight: 800; color: var(--shell-accent); }
.capCard__sub { font-size: 11px; color: var(--shell-muted); margin-top: 2px; }
.capProgress { height: 6px; background: rgba(255,255,255,0.06); border-radius: 999px; overflow: hidden; margin-top: 8px; }
.capProgress__bar { height: 100%; border-radius: 999px; transition: width 0.6s ease; }
.capAbilityGroup { margin-bottom: 16px; }
.capAbilityGroup__header { font-size: 12px; font-weight: 700; color: var(--shell-muted); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em; }
`;

interface TenantAdminCapabilitiesPageProps {
  env?: Record<string, unknown>;
  fetchImpl?: unknown;
  bootstrapLoader?: unknown;
  autoLoad?: boolean;
  initialSnapshot?: Record<string, unknown> | null;
}

export function TenantAdminCapabilitiesPage({}: TenantAdminCapabilitiesPageProps) {
  const { t, formatNumber } = useI18n();
  const { ability, userPlan, userEntitlements } = usePortfolio();

  const entitlements = userEntitlements || {};
  const abilities = Array.isArray(entitlements.abilities) ? entitlements.abilities as Array<{ action: string; subject: string }> : [];
  const quotaCaps = entitlements.quota_caps || {};

  const abilityItems: AbilityItem[] = abilities.map(item => ({
    key: `${item.action}:${item.subject}`,
    action: item.action,
    subject: item.subject,
  }));

  const quotaItems: QuotaItem[] = Object.entries(quotaCaps).map(([key, value]) => ({ key, value: value as number }));

  const planLabel = t(`plans.${userPlan}`, { defaultValue: userPlan });

  const metrics = [
    renderShellMetric(t("tenantCapabilities.metricPlan"), planLabel),
    renderShellMetric(t("tenantCapabilities.metricAbilityCount"), String(abilities.length)),
    renderShellMetric(t("tenantCapabilities.metricQuotaCount"), String(quotaItems.length)),
  ];

  const canRead = ability?.can?.("read", "TenantCapabilityView") ?? false;

  if (!canRead) {
    return (
      <ShellPageChrome
        eyebrow={t("tenantCapabilities.eyebrow")}
        title={t("tenantCapabilities.title")}
        description={t("tenantCapabilities.description")}
        notice={t("common.noPermission")}
        metrics={metrics}
      >
        <div className="shellPage__panel">
          <ShellEmptyState description={t("tenantCapabilities.noAbilities")} />
        </div>
      </ShellPageChrome>
    );
  }

  const iconMap: Record<string, string> = {
    api_calls_monthly: "📡",
    active_members: "👥",
    service_accounts: "🔧",
    webhooks: "🔗",
    reports: "📊",
    storage_gb: "💾",
  };

  return (
    <ShellPageChrome
      eyebrow={t("tenantCapabilities.eyebrow")}
      title={t("tenantCapabilities.title")}
      description={t("tenantCapabilities.description")}
      metrics={metrics}
    >
      <style>{CAP_CSS}</style>
      <section className="shellPage__stack">
          <ShellPanel title={t("tenantCapabilities.planOverview")}>
            <div className="capGrid">
              <div className="capCard">
                <div className="capCard__header">
                  <div className="capCard__title">{t("tenantCapabilities.currentPlan")}</div>
                  <span className="shellPage__pill" style={{ background: "rgba(0,180,216,0.15)", color: "#00b4d8" }}>
                    {planLabel}
                  </span>
                </div>
                <div className="capCard__value">{planLabel}</div>
                <div className="capCard__sub">{t("tenantCapabilities.metricAbilityCount")}: {abilities.length}</div>
                {userPlan !== "enterprise" && (
                  <div style={{ marginTop: 12 }}>
                    <Link to="/tenant-admin/billing" className="shellPage__button shellPage__button--primary" style={{ textDecoration: "none", fontWeight: 700, fontSize: 12 }}>
                      {t("tenantCapabilities.upgradeAction")}
                    </Link>
                  </div>
                )}
              </div>
              <div className="capCard">
                <div className="capCard__header">
                  <div className="capCard__title">{t("tenantCapabilities.metricQuotaCount")}</div>
                </div>
                <div className="capCard__value">{quotaItems.length}</div>
                <div className="capCard__sub">{t("tenantCapabilities.quotaTitle")}</div>
              </div>
            </div>
          </ShellPanel>

          <ShellPanel title={t("tenantCapabilities.quotaTitle")}>
            {quotaItems.length === 0 ? (
              <ShellEmptyState description={t("tenantCapabilities.noQuota")} />
            ) : (
              <div className="capGrid">
                {quotaItems.map(item => {
                  const fillColor = item.value > 0 ? "#00b4d8" : "#94a3b8";
                  const pct = item.value > 0 ? 100 : 0;
                  return (
                    <div key={item.key} className="capCard">
                      <div className="capCard__header">
                        <div className="capCard__title">
                          {iconMap[item.key] || "📋"} {item.key.replace(/_/g, " ")}
                        </div>
                        <div className="capCard__value" style={{ fontSize: 16 }}>
                          {formatQuotaValue(item.value, formatNumber, t)}
                        </div>
                      </div>
                      <div className="capProgress">
                        <div className="capProgress__bar" style={{ width: `${pct}%`, background: fillColor }} />
                      </div>
                      <div className="capCard__sub">{t("tenantCapabilities.limitLabel")}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </ShellPanel>

          <ShellPanel title={t("tenantCapabilities.abilityTitle")} subtitle={`${abilities.length}`}>
            {abilityItems.length === 0 ? (
              <ShellEmptyState description={t("tenantCapabilities.noAbilities")} />
            ) : (
              <div>
                {["read", "write", "admin"].map(action => {
                  const actionAbilities = abilityItems.filter(a => a.action === action);
                  if (actionAbilities.length === 0) return null;
                  return (
                    <div key={action} className="capAbilityGroup">
                      <div className="capAbilityGroup__header">{action}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
                        {actionAbilities.map(a => (
                          <span key={a.key} className="shellPage__pill" style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa", fontSize: 11 }}>
                            {a.subject}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ShellPanel>
      </section>
    </ShellPageChrome>
  );
}
