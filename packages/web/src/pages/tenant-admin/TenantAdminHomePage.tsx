import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { ShellPageChrome, ShellPanel } from "../../components/ShellPageTemplate.js";
import { ShellEmptyState } from "../../components/ShellEmptyState.js";
import { renderSummaryCard } from "../coreShellPageHelpers.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { useI18n } from "../../context/LangContext.js";
import { usePortfolio } from "../../context/PortfolioContext.js";

interface DashboardSummary {
  health_score: number;
  members_active_today: number;
  members_total: number;
  api_calls_today: number;
  api_calls_limit: number;
  quota_headroom_pct: number;
  plan: string;
  plan_status: string;
  trial_remaining_days: number | null;
  service_accounts: { active: number; disabled: number };
  pats_expiring_soon: number;
  recent_events: Array<{
    event_type: string;
    created_at: string;
    actor: string | null;
    description: string;
  }>;
}

interface DailyPoint {
  date: string;
  api_calls: number;
  active_members: number;
}

interface ChecklistItem {
  key: string;
  labelKey: string;
  done: boolean;
  route?: string;
}

interface TenantAdminHomePageProps {
  env?: Record<string, unknown>;
  fetchImpl?: unknown;
  bootstrapLoader?: unknown;
  autoLoad?: boolean;
  initialSnapshot?: Record<string, unknown> | null;
}

function HealthGauge({ score }: { score: number }) {
  const color = score >= 80 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  const glowFilterId = useMemo(() => `gaugeGlow-${Math.floor(Math.random() * 1000000)}`, []);
  return (
    <div style={{ position: "relative", width: 56, height: 56, flexShrink: 0 }}>
      <svg width="56" height="56" viewBox="0 0 56 56">
        <defs>
          <filter id={glowFilterId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
        <circle
          cx="28" cy="28" r="24" fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={`${(score / 100) * 150.8} 150.8`}
          strokeLinecap="round" transform="rotate(-90 28 28)"
          filter={`url(#${glowFilterId})`}
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <span style={{
        position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, fontWeight: 700, color,
      }}>
        {score}
      </span>
    </div>
  );
}

function eventIcon(type: string): string {
  if (type.includes("pat")) return "\uD83D\uDD11";
  if (type.includes("member")) return "\uD83D\uDC64";
  if (type.includes("quota")) return "\u26A0\uFE0F";
  if (type.includes("plan") || type.includes("status")) return "\uD83D\uDCC8";
  if (type.includes("invoice")) return "\uD83D\uDCB5";
  if (type.includes("trial")) return "\u23F3";
  if (type.includes("deprov")) return "\u274C";
  return "\uD83D\uDD04";
}

function eventLabel(type: string, t: (k: string, o?: object) => string): string {
  const key = `tenantHome.event.${type}`;
  const label = t(key, { defaultValue: "" });
  if (label) return label;
  return type.replace(/_/g, " ");
}

function timeAgo(iso: string, t: (k: string, o?: object) => string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("tenantHome.justNow");
  if (mins < 60) return t("tenantHome.minutesAgo", { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("tenantHome.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  return t("tenantHome.daysAgo", { count: days });
}

export function TenantAdminHomePage({}: TenantAdminHomePageProps) {
  const { t, formatNumber } = useI18n();
  const { ability, userIdentity, userPlan } = usePortfolio();

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [trend, setTrend] = useState<DailyPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trendDays, setTrendDays] = useState(7);
  const [showDeprovision, setShowDeprovision] = useState(false);
  const [deprovisionDone, setDeprovisionDone] = useState(false);
  const [deprovisionError, setDeprovisionError] = useState("");
  const [deprovisioning, setDeprovisioning] = useState(false);

  const loadData = async (days = trendDays) => {
    try {
      setLoading(true);
      setError(null);
      const [summaryData, trendData] = await Promise.all([
        defaultCoreApiAdapter.getDashboardSummary(),
        defaultCoreApiAdapter.getUsageTrend(days),
      ]);
      setSummary(summaryData as DashboardSummary);
      setTrend((trendData as { daily: DailyPoint[] }).daily || []);
    } catch (err) {
      setError((err as Error).message || t("common.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTrendDaysChange = (days: number) => {
    setTrendDays(days);
    defaultCoreApiAdapter.getUsageTrend(days).then((data) => {
      setTrend((data as { daily: DailyPoint[] }).daily || []);
    }).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : t("tenantHome.trendLoadError"));
    });
  };

  const planLabel = t(`plans.${userPlan}`, { defaultValue: userPlan });
  const planStatusLabel = summary
    ? t(`tenantHome.status.${summary.plan_status}`, { defaultValue: summary.plan_status })
    : "";

  const usageChartData = useMemo(() => trend.map((d) => ({
    date: d.date.slice(5),
    api_calls: d.api_calls,
    active_members: d.active_members,
  })), [trend]);

  const handleDeprovision = async () => {
    try {
      setDeprovisioning(true);
      setDeprovisionError("");
      await defaultCoreApiAdapter.corePost("/partner/billing/deprovision/");
      setDeprovisionDone(true);
      setShowDeprovision(false);
    } catch {
      setDeprovisionError(t("tenantHome.deprovisionError"));
    } finally {
      setDeprovisioning(false);
    }
  };

  const navEntries = [
    { labelKey: "tenantHome.membersRoute", to: "/tenant-admin/members", subject: "TenantMemberAdmin", icon: "\uD83D\uDC65" },
    { labelKey: "tenantHome.serviceAccountsRoute", to: "/tenant-admin/service-accounts", subject: "TenantServiceAccountAdmin", icon: "\uD83D\uDD27" },
    { labelKey: "tenantHome.patsRoute", to: "/tenant-admin/pats", subject: "TenantPATAdmin", icon: "\uD83D\uDD11" },
    { labelKey: "tenantHome.webhooksRoute", to: "/tenant-admin/webhooks", subject: "TenantWebhookView", icon: "\uD83D\uDD17" },
    { labelKey: "tenantHome.usageRoute", to: "/tenant-admin/usage", subject: "TenantUsageView", icon: "\uD83D\uDCCA" },
    { labelKey: "tenantHome.usageHistoryRoute", to: "/tenant-admin/usage-history", subject: "TenantUsageView", icon: "\uD83D\uDCC8" },
    { labelKey: "tenantHome.billingRoute", to: "/tenant-admin/billing", subject: "TenantBillingView", icon: "\uD83D\uDCB3" },
    { labelKey: "tenantHome.capabilitiesRoute", to: "/tenant-admin/capabilities", subject: "TenantCapabilityView", icon: "\u2699\uFE0F" },
    { labelKey: "tenantHome.auditLogsRoute", to: "/tenant-admin/audit-logs", subject: "TenantAuditLogView", icon: "\uD83D\uDCC4" },
    { labelKey: "tenantHome.ssoRoute", to: "/tenant-admin/sso", subject: "TenantSSOView", icon: "\uD83D\uDD10" },
    { labelKey: "tenantHome.reportsRoute", to: "/tenant-admin/reports", subject: "TenantReportsView", icon: "\uD83D\uDCCB" },
    { labelKey: "tenantHome.securityRoute", to: "/tenant-admin/security", subject: "TenantSecurityView", icon: "\uD83D\uDEE1\uFE0F" },
  ];
  const allowedLinks = navEntries.filter((entry) => ability.can("read", entry.subject));

  if (loading && !summary) {
    return (
      <ShellPageChrome
        eyebrow={t("tenantHome.eyebrow")}
        title={t("tenantHome.title")}
        description={t("common.loading")}
      >
        <div className="shellPage__panel">{t("common.loading")}</div>
      </ShellPageChrome>
    );
  }

  function KpiCard({
    label, value, sub, color, gauge,
  }: {
    label: string; value: string; sub?: string; color?: string; gauge?: number;
  }) {
    return (
      <div className="shellPage__metric" style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {gauge != null && <HealthGauge score={gauge} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <span className="shellPage__metricLabel">{label}</span>
          <div className="shellPage__metricValue" style={{ color: color || "var(--shell-ink)" }}>{value}</div>
          {sub && <div style={{ fontSize: 12, color: "var(--shell-muted)", marginTop: 2 }}>{sub}</div>}
        </div>
      </div>
    );
  }

  const formatApiCalls = (val: number | undefined | null): string => {
    if (val == null) return "\u2014";
    if (val < 0) return t("tenantHome.unlimited");
    return formatNumber(val);
  };

  const formatLimit = (val: number): string => {
    if (val <= 0) return t("tenantHome.unlimited");
    return formatNumber(val);
  };

  const showTrialBanner = summary?.plan_status === "trial" && summary?.trial_remaining_days != null;
  const isUrgent = showTrialBanner && summary!.trial_remaining_days! <= 3;
  const trialBannerText = showTrialBanner && summary?.trial_remaining_days !== null
    ? (isUrgent
      ? t("tenantHome.trialUrgentBanner", { days: summary.trial_remaining_days })
      : t("tenantHome.trialBanner", { days: summary.trial_remaining_days }))
    : "";

  const refreshAction = (
    <button onClick={() => loadData()} className="shellPage__button shellPage__button--secondary">
      {t("common.refresh")}
    </button>
  );

  const trendActions = (
    <div className="shellPage__actions">
      {[7, 14, 30].map((d) => (
        <button
          key={d}
          onClick={() => handleTrendDaysChange(d)}
          className="shellPage__button"
          style={{
            background: trendDays === d ? "rgba(0,180,216,0.2)" : "rgba(255,255,255,0.06)",
            color: trendDays === d ? "var(--shell-accent)" : "var(--shell-ink)",
            border: trendDays === d ? "1px solid rgba(0,180,216,0.3)" : "1px solid var(--shell-border)",
            borderRadius: 14, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}
        >
          {d}d
        </button>
      ))}
    </div>
  );

  const checklistItems: ChecklistItem[] = [
    {
      key: "service_accounts",
      labelKey: "tenantHome.checklistSA",
      done: ((summary?.service_accounts.active || 0) + (summary?.service_accounts.disabled || 0)) > 0,
      route: "/tenant-admin/service-accounts",
    },
    {
      key: "pat",
      labelKey: "tenantHome.checklistPAT",
      done: (summary?.pats_expiring_soon ?? 0) > 0,
      route: "/tenant-admin/pats",
    },
    {
      key: "members",
      labelKey: "tenantHome.checklistMembers",
      done: (summary?.members_total || 0) > 1,
      route: "/tenant-admin/members",
    },
    {
      key: "sso",
      labelKey: "tenantHome.checklistSSO",
      done: ability.can("read", "TenantSSOView"),
      route: "/tenant-admin/sso",
    },
    {
      key: "webhooks",
      labelKey: "tenantHome.checklistWebhooks",
      done: ability.can("read", "TenantWebhookView"),
      route: "/tenant-admin/webhooks",
    },
  ];
  const completedItems = checklistItems.filter(i => i.done).length;
  const checklistPct = Math.round((completedItems / checklistItems.length) * 100);
  const capProgressStyle = `
.capProgress { height: 6px; background: rgba(255,255,255,0.06); border-radius: 999px; overflow: hidden; }
.capProgress__bar { height: 100%; border-radius: 999px; transition: width 0.6s ease; }
`;

  return (
    <ShellPageChrome
      eyebrow={t("tenantHome.eyebrow")}
      title={t("tenantHome.title")}
      description={t("tenantHome.description")}
      metrics={undefined}
      notice={showTrialBanner ? trialBannerText : undefined}
      error={error || undefined}
    >
      <section className="shellPage__stack">
          {/* Trial upgrade prompt */}
          {showTrialBanner && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 0" }}>
              <Link to="/tenant-admin/billing" className="shellPage__button shellPage__button--primary" style={{ fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
                {t("tenantHome.upgradePrompt")}
              </Link>
              <button onClick={() => setShowDeprovision(true)} className="shellPage__button" style={{ fontSize: 12, color: "#ef4444" }}>
                {t("tenantHome.deprovisionAction")}
              </button>
            </div>
          )}

          {/* Deprovision alert */}
          {deprovisionDone && (
            <div style={{ background: "#22c55e", color: "#fff", padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
              {t("tenantHome.deprovisionDone")}
            </div>
          )}
          {deprovisionError && (
            <div style={{ background: "#ef4444", color: "#fff", padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
              {deprovisionError}
            </div>
          )}

          {/* Deprovision confirmation modal */}
          {showDeprovision && (
            <div style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex",
              alignItems: "center", justifyContent: "center", zIndex: 1000,
            }}>
              <div style={{ background: "#1e293b", borderRadius: 12, padding: 24, width: "90%", maxWidth: 460 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#ef4444" }}>{t("tenantHome.deprovisionConfirmTitle")}</h3>
                <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 16, lineHeight: 1.5 }}>{t("tenantHome.deprovisionConfirmBody")}</p>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button onClick={() => setShowDeprovision(false)} className="shellPage__button shellPage__button--secondary" style={{ fontSize: 13 }}>
                    {t("tenantHome.deprovisionCancel")}
                  </button>
                  <button onClick={handleDeprovision} disabled={deprovisioning} className="shellPage__button" style={{ fontSize: 13, fontWeight: 700, color: "#ef4444" }}>
                    {deprovisioning ? t("common.saving") : t("tenantHome.deprovisionAction")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* KPI Hero Row */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 14,
          }}>
            <KpiCard
              label={t("tenantHome.healthLabel")}
              value={summary ? `${summary.health_score}%` : "\u2014"}
              sub={planStatusLabel}
              gauge={summary?.health_score}
            />
            <KpiCard
              label={t("tenantHome.activeMembersLabel")}
              value={summary ? `${summary.members_active_today}/${summary.members_total}` : "\u2014"}
              sub={summary ? `${Math.round((summary.members_active_today / Math.max(summary.members_total, 1)) * 100)}% ${t("tenantHome.todayLabel")}` : ""}
            />
            <KpiCard
              label={t("tenantHome.apiCallsLabel")}
              value={formatApiCalls(summary?.api_calls_today)}
              sub={summary?.api_calls_limit && summary.api_calls_limit > 0
                ? `${t("tenantHome.limitLabel")}: ${formatLimit(summary.api_calls_limit)}`
                : t("tenantHome.unlimited")}
              color={summary && summary.api_calls_limit > 0 && summary.api_calls_today > summary.api_calls_limit * 0.8
                ? "#f59e0b" : undefined}
            />
            <KpiCard
              label={t("tenantHome.quotaHeadroomLabel")}
              value={summary ? `${summary.quota_headroom_pct}%` : "\u2014"}
              color={summary && summary.quota_headroom_pct < 30 ? "#ef4444" : summary && summary.quota_headroom_pct < 60 ? "#f59e0b" : undefined}
            />
          </div>

          {/* Onboarding Checklist */}
          <style>{capProgressStyle}</style>
          <ShellPanel
            title={t("tenantHome.checklistTitle")}
            subtitle={`${completedItems}/${checklistItems.length} ${t("tenantHome.checklistDone")}`}
          >
            <div style={{ marginBottom: 12 }}>
              <div className="capProgress">
                <div className="capProgress__bar" style={{ width: `${checklistPct}%`, background: "var(--shell-accent)" }} />
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {checklistItems.map(item => (
                <div key={item.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.02)" }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 700,
                    background: item.done ? "rgba(34,197,94,0.2)" : "rgba(148,163,184,0.15)",
                    color: item.done ? "#22c55e" : "#64748b",
                  }}>
                    {item.done ? "✓" : "·"}
                  </span>
                  <span style={{ flex: 1, fontSize: 13, color: item.done ? "var(--shell-ink)" : "var(--shell-muted)" }}>
                    {t(item.labelKey)}
                  </span>
                  {item.route && !item.done && (
                    <Link to={item.route} className="shellPage__button" style={{ fontSize: 11, padding: "4px 10px", textDecoration: "none" }}>
                      {t("tenantHome.checklistSetup")}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </ShellPanel>

          {/* Usage Trend Chart + Quick Actions */}
          <div style={{
            display: "grid",
            gridTemplateColumns: summary ? "1.5fr 1fr" : "1fr",
            gap: 18,
          }}>
            <ShellPanel title={t("tenantHome.usageTrendTitle")} actions={trendDays !== 7 ? undefined : trendActions}>
              {trendDays !== 7 && (
                <div style={{ marginBottom: 12 }}>{trendActions}</div>
              )}
              {usageChartData.length > 0 ? (
                <div style={{ width: "100%", height: 200 }}>
                  <ResponsiveContainer>
                    <AreaChart data={usageChartData} margin={{ top: 10, right: 6, bottom: 4, left: -16 }}>
                      <defs>
                        <linearGradient id="apiGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00b4d8" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#00b4d8" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="memberGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <filter id="apiGlow" x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur stdDeviation="3" result="blur" />
                          <feComponentTransfer in="blur" result="glow">
                            <feFuncA type="linear" slope="0.5"/>
                          </feComponentTransfer>
                          <feMerge>
                            <feMergeNode in="glow" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                        <filter id="memberGlow" x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur stdDeviation="3" result="blur" />
                          <feComponentTransfer in="blur" result="glow">
                            <feFuncA type="linear" slope="0.5"/>
                          </feComponentTransfer>
                          <feMerge>
                            <feMergeNode in="glow" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>
                      <XAxis
                        dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }}
                        axisLine={false} tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "rgba(15,23,42,0.96)", border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: 12, fontSize: 12, color: "#f1f5f9",
                          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)"
                        }}
                      />
                      <Area
                        type="monotone" dataKey="api_calls" stroke="#00b4d8"
                        fill="url(#apiGrad)" strokeWidth={2.5} dot={false}
                        name={t("tenantHome.apiCallsLabel")}
                        style={{ filter: "url(#apiGlow)" }}
                      />
                      <Area
                        type="monotone" dataKey="active_members" stroke="#10b981"
                        fill="url(#memberGrad)" strokeWidth={2.5} dot={false}
                        name={t("tenantHome.activeMembersLabel")}
                        style={{ filter: "url(#memberGlow)" }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <ShellEmptyState description={t("tenantHome.noTrendData")} />
              )}
            </ShellPanel>

            {allowedLinks.length > 0 && (
              <ShellPanel title={t("tenantHome.quickActionsTitle")}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {allowedLinks.map((entry) => (
                    <Link
                      key={entry.to}
                      to={entry.to}
                      className="shellPage__listItem"
                      style={{
                        textDecoration: "none", color: "var(--shell-ink)", fontWeight: 600,
                        display: "flex", alignItems: "center", gap: 10,
                        transition: "transform 0.2s ease, border-color 0.2s ease",
                      }}
                    >
                      <span style={{ fontSize: 18 }}>{entry.icon}</span>
                      <span>{t(entry.labelKey)}</span>
                    </Link>
                  ))}
                </div>
              </ShellPanel>
            )}
          </div>

          {/* Recent Activity */}
          <ShellPanel title={t("tenantHome.activityTitle")} actions={refreshAction}>
            {summary?.recent_events && summary.recent_events.length > 0 ? (
              <div className="shellPage__list">
                {summary.recent_events.map((ev, i) => (
                  <div key={`${ev.event_type}-${i}`} className="shellPage__listItem" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 16, marginTop: 1 }}>{eventIcon(ev.event_type)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--shell-ink)" }}>
                        {eventLabel(ev.event_type, t)}
                      </div>
                      {ev.description && (
                        <div className="shellPage__itemMeta" style={{ marginTop: 2, fontSize: 12 }}>
                          {ev.description}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 11, color: "#94a3b8" }}>
                        {ev.actor && <span>{ev.actor}</span>}
                        <span>{timeAgo(ev.created_at, t)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <ShellEmptyState description={t("tenantHome.noActivity")} />
            )}
          </ShellPanel>

          {/* Status Summary */}
          {summary && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
              <div className="shellPage__listItem" style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontSize: 22, background: "rgba(255,255,255,0.04)", width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.06)" }}>🔧</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, color: "var(--shell-ink)" }}>
                    {t("tenantHome.serviceAccountsLabel")}
                    {summary.service_accounts.active > 0 && (
                      <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 9,
                        fontWeight: 800,
                        color: "#10b981",
                        background: "rgba(16, 185, 129, 0.12)",
                        padding: "2px 6px",
                        borderRadius: 999,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }} />
                        {t("tenantHome.active")}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--shell-muted)", marginTop: 2 }}>
                    {summary.service_accounts.active} {t("tenantHome.active")}
                    {summary.service_accounts.disabled > 0 && `, ${summary.service_accounts.disabled} ${t("tenantHome.disabled")}`}
                  </div>
                </div>
              </div>
              <div className="shellPage__listItem" style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontSize: 22, background: "rgba(255,255,255,0.04)", width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.06)" }}>⏳</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, color: "var(--shell-ink)" }}>
                    {t("tenantHome.patsExpiringLabel")}
                    {summary.pats_expiring_soon > 0 && (
                      <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 9,
                        fontWeight: 800,
                        color: "#f59e0b",
                        background: "rgba(245, 158, 11, 0.12)",
                        padding: "2px 6px",
                        borderRadius: 999,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#f59e0b", boxShadow: "0 0 6px #f59e0b" }} />
                        {t("tenantUsage.warningLabel") || "WARNING"}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: summary.pats_expiring_soon > 0 ? "#f59e0b" : "var(--shell-muted)", marginTop: 2 }}>
                    {summary.pats_expiring_soon > 0
                      ? `${summary.pats_expiring_soon} ${t("tenantHome.expiringWithin7Days")}`
                      : t("tenantHome.noneExpiring")}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Identity Card */}
          {userIdentity.username && (
            <ShellPanel title={t("tenantHome.identityTitle")}>
              <section className="shellPage__summaryGrid">
                {renderSummaryCard({
                  key: "identity",
                  title: t("tenantHome.identityTitle"),
                  rows: [
                    { label: t("tenantHome.usernameLabel"), value: userIdentity.username || "\u2014" },
                    { label: t("tenantHome.emailLabel"), value: userIdentity.email || "\u2014" },
                    { label: t("tenantHome.metricPlan"), value: planLabel },
                  ],
                })}
              </section>
            </ShellPanel>
          )}
      </section>
    </ShellPageChrome>
  );
}
