import styles from "../../components/ShellPageTemplate.module.css";
import ta from "./TenantAdmin.module.css";
import { useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ShellPageChrome, ShellPanel } from "../../components/ShellPageTemplate.js";
import { ShellEmptyState } from "../../components/ShellEmptyState.js";
import { ShellSkeleton } from "../../components/ShellSkeleton.js";
import { renderSummaryCard } from "../coreShellPageHelpers.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { useI18n } from "../../context/LangContext.js";
import { usePortfolio } from "../../context/PortfolioContext.js";
import { useTenantAdminQuery } from "./useTenantAdminQuery.js";
interface DashboardSummary {
  health_score: number;
  health_breakdown?: { quota: number; activity: number; base: number };
  members_active_today: number;
  members_total: number;
  api_calls_today: number;
  api_calls_limit: number;
  quota_headroom_pct: number;
  api_calls_yesterday?: number;
  members_active_yesterday?: number;
  plan: string;
  plan_status: string;
  trial_remaining_days: number | null;
  service_accounts: { active: number; disabled: number };
  pats_expiring_soon: number;
  pats_total?: number;
  sso_configured?: boolean;
  webhook_count?: number;
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
  const rawId = useId();
  const glowFilterId = useMemo(() => `gaugeGlow-${rawId.replace(/:/g, "")}`, [rawId]);
  return (
    <div className={ta.home_1}>
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
          className={ta.home_2}
        />
      </svg>
      <span className={ta.home_3} style={{ color }}>
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

  const [trendDays, setTrendDays] = useState(7);
  const [showDeprovision, setShowDeprovision] = useState(false);
  const [deprovisionDone, setDeprovisionDone] = useState(false);
  const [deprovisionError, setDeprovisionError] = useState("");
  const [deprovisioning, setDeprovisioning] = useState(false);
  const [deprovisionConfirm, setDeprovisionConfirm] = useState("");

  const canReadHome = (ability as unknown as { can: (a: string, s: string) => boolean })?.can?.("read", "TenantAdminHome") ?? true;

  const {
    data: summaryData,
    isLoading: summaryLoading,
    isFetching: summaryFetching,
    error: summaryError,
    refetch: refetchSummary,
  } = useTenantAdminQuery<DashboardSummary>(
    ["tenant-home", "summary"],
    "/partner/dashboard/summary/",
    {
      enabled: canReadHome,
      queryFn: async () => {
        const adapter = defaultCoreApiAdapter as unknown as { getDashboardSummary: () => Promise<DashboardSummary> };
        return adapter.getDashboardSummary();
      },
    },
  );

  const {
    data: trendData,
    isFetching: trendFetching,
    error: trendError,
    refetch: refetchTrend,
  } = useTenantAdminQuery<{ daily: DailyPoint[]; days: number }>(
    ["tenant-home", "trend", String(trendDays)],
    `/partner/dashboard/usage-trend/?days=${trendDays}`,
    {
      enabled: canReadHome,
      queryFn: async () => {
        const adapter = defaultCoreApiAdapter as unknown as { getUsageTrend: (d: number) => Promise<{ daily: DailyPoint[]; days: number }> };
        const res = await adapter.getUsageTrend(trendDays) as unknown as { daily: DailyPoint[]; days: number };
        return res;
      },
    },
  );

  const summary = summaryData ?? null;
  const trend = useMemo(() => trendData?.daily ?? [], [trendData]);
  const loading = summaryLoading;
  const error = summaryError ? ((summaryError as Error).message || t("common.loadError")) : trendError ? ((trendError as Error).message || t("tenantHome.trendLoadError")) : null;

  const handleTrendDaysChange = (days: number) => {
    setTrendDays(days);
  };

  const handleRefresh = () => {
    void refetchSummary();
    void refetchTrend();
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
      setDeprovisionConfirm("");
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
    { labelKey: "tenantHome.auditLogsRoute", to: "/tenant-admin/audit-logs",       subject: "TenantAuditAdmin", icon: "\uD83D\uDCC4" },
    { labelKey: "tenantHome.ssoRoute", to: "/tenant-admin/sso", subject: "TenantSSOAdmin", icon: "\uD83D\uDD10" },
    { labelKey: "tenantHome.reportsRoute", to: "/tenant-admin/reports", subject: "TenantReportsView", icon: "\uD83D\uDCCB" },
    { labelKey: "tenantHome.securityRoute", to: "/tenant-admin/security", subject: "TenantSecurityView", icon: "\uD83D\uDEE1\uFE0F" },
  ];
  const allowedLinks = navEntries.filter((entry) => (ability as unknown as { can: (a: string, s: string) => boolean })?.can?.("read", entry.subject) ?? false);

  if (loading && !summary) {
    return (
      <ShellPageChrome
        eyebrow={t("tenantHome.eyebrow")}
        title={t("tenantHome.title")}
        description={t("common.loading")}
      >
        <ShellSkeleton variant="metric" count={4} />
        <div style={{ height: 16 }} />
        <ShellSkeleton variant="chart" count={7} />
        <div style={{ height: 16 }} />
        <ShellSkeleton variant="table-row" count={3} />
      </ShellPageChrome>
    );
  }

  if (summaryError && !summary) {
    return (
      <ShellPageChrome
        eyebrow={t("tenantHome.eyebrow")}
        title={t("tenantHome.title")}
        description={t("common.loadError")}
        error={(summaryError as Error)?.message || t("common.loadError")}
      >
        <div className={`${styles.panel}`}>
          <ShellEmptyState description={(summaryError as Error)?.message || t("common.loadError")} />
          <button onClick={handleRefresh} className={`${styles.button} ${styles.buttonSecondary}`} style={{ marginTop: 12 }}>
            {t("common.refresh")}
          </button>
        </div>
      </ShellPageChrome>
    );
  }

  function KpiCard({
    label, value, sub, color, gauge,
  }: {
    label: string; value: string; sub?: string; color?: string; gauge?: number;
  }) {
    return (
      <div className={[`${styles.metric}`, ta.home_4].filter(Boolean).join(" ")} >
        {gauge != null && <HealthGauge score={gauge} />}
        <div className={ta.home_5}>
          <span className={`${styles.metricLabel}`}>{label}</span>
          <div className={`${styles.metricValue}`} style={{ color: color || "var(--text-primary)" }}>{value}</div>
          {sub && <div className={ta.home_6}>{sub}</div>}
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

  const formatDelta = (today: number | undefined, yesterday: number | undefined): string | null => {
    if (today == null || yesterday == null) return null;
    const diff = today - yesterday;
    if (yesterday === 0) return diff === 0 ? "—" : `↑${formatNumber(diff)}`;
    const pct = Math.round((diff / Math.max(1, yesterday)) * 100);
    const arrow = diff > 0 ? "↑" : diff < 0 ? "↓" : "→";
    const sign = diff > 0 ? "+" : "";
    return `${arrow} ${sign}${formatNumber(diff)} (${sign}${pct}%) vs hôm qua`;
  };

  const showTrialBanner = summary?.plan_status === "trial" && summary?.trial_remaining_days != null;
  const isUrgent = showTrialBanner && summary!.trial_remaining_days! <= 3;
  const trialBannerText = showTrialBanner && summary?.trial_remaining_days !== null
    ? (isUrgent
      ? t("tenantHome.trialUrgentBanner", { days: summary.trial_remaining_days })
      : t("tenantHome.trialBanner", { days: summary.trial_remaining_days }))
    : "";

  const refreshAction = (
    <button onClick={handleRefresh} disabled={summaryFetching || trendFetching} className={`${styles.button} ${styles.buttonSecondary}`}>
      {summaryFetching || trendFetching ? t("common.loading") : t("common.refresh")}
    </button>
  );

  const trendActions = (
    <div className={`${styles.actions}`}>
      {[7, 14, 30].map((d) => (
        <button
          key={d}
          onClick={() => handleTrendDaysChange(d)}
          className={`${styles.button}`}
          style={{
            background: trendDays === d ? "rgba(0,180,216,0.2)" : "rgba(255,255,255,0.06)",
            color: trendDays === d ? "var(--accent-shell)" : "var(--text-primary)",
            border: trendDays === d ? "1px solid rgba(0,180,216,0.3)" : "1px solid var(--border-shell)",
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
      // REV2 F04b: done = pats_total>0 (optional FE, fallback 0 -> not done until BE deploy)
      done: (summary?.pats_total ?? 0) > 0,
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
      // REV2: Phase0 giữ ability.can fallback; Phase1 sẽ dùng summary.sso_configured
      done: summary?.sso_configured != null ? !!summary.sso_configured : (ability as unknown as { can: (a: string, s: string) => boolean })?.can?.("read", "TenantSSOAdmin") ?? false,
      route: "/tenant-admin/sso",
    },
    {
      key: "webhooks",
      labelKey: "tenantHome.checklistWebhooks",
      done: summary?.webhook_count != null ? (summary.webhook_count ?? 0) > 0 : (ability as unknown as { can: (a: string, s: string) => boolean })?.can?.("read", "TenantWebhookView") ?? false,
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
      <section className={`${styles.stack}`}>
          {/* Trial upgrade prompt */}
          {showTrialBanner && (
            <div className={ta.home_7}>
              <Link to="/tenant-admin/billing" className={[`${styles.button} ${styles.buttonPrimary}`, ta.home_8].filter(Boolean).join(" ")} style={{ fontSize: 12, fontWeight: 700 }}>
                {t("tenantHome.upgradePrompt")}
              </Link>
              <button onClick={() => { setDeprovisionConfirm(""); setShowDeprovision(true); }} className={[`${styles.button}`, ta.home_9].filter(Boolean).join(" ")} style={{ fontSize: 12 }}>
                {t("tenantHome.deprovisionAction")}
              </button>
            </div>
          )}

          {/* Deprovision alert */}
          {deprovisionDone && (
            <div className={ta.home_10}>
              {t("tenantHome.deprovisionDone")}
            </div>
          )}
          {deprovisionError && (
            <div className={ta.home_11}>
              {deprovisionError}
            </div>
          )}

          {/* Deprovision confirmation modal — guard: type DEPROVISION */}
          {showDeprovision && (
            <div className={ta.home_12}>
              <div className={ta.home_13}>
                <h3 className={ta.home_14}>{t("tenantHome.deprovisionConfirmTitle")}</h3>
                <p className={ta.home_15}>{t("tenantHome.deprovisionConfirmBody")}</p>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 6 }}>
                    Nhập <strong>DEPROVISION</strong> để xác nhận
                  </label>
                  <input
                    className={`${styles.input}`}
                    value={deprovisionConfirm}
                    onChange={(e) => setDeprovisionConfirm(e.target.value)}
                    placeholder="DEPROVISION"
                    autoComplete="off"
                  />
                </div>
                <div className={ta.home_16}>
                  <button onClick={() => { setShowDeprovision(false); setDeprovisionConfirm(""); }} className={`${styles.button} ${styles.buttonSecondary}`} style={{ fontSize: 13 }}>
                    {t("tenantHome.deprovisionCancel")}
                  </button>
                  <button onClick={handleDeprovision} disabled={deprovisioning || deprovisionConfirm !== "DEPROVISION"} className={[`${styles.button}`, ta.home_17].filter(Boolean).join(" ")} style={{ fontSize: 13, fontWeight: 700 }}>
                    {deprovisioning ? t("common.saving") : t("tenantHome.deprovisionAction")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* KPI Hero Row */}
          <div className={ta.home_18}>
            <KpiCard
              label={t("tenantHome.healthLabel")}
              value={summary ? `${summary.health_score}%` : "\u2014"}
              sub={summary?.health_breakdown ? `${planStatusLabel} · quota ${summary.health_breakdown.quota}% · activity ${summary.health_breakdown.activity}%` : planStatusLabel}
              gauge={summary?.health_score}
            />
            <KpiCard
              label={t("tenantHome.activeMembersLabel")}
              value={summary ? `${summary.members_active_today}/${summary.members_total}` : "\u2014"}
              sub={summary ? `${Math.round((summary.members_active_today / Math.max(summary.members_total, 1)) * 100)}% ${t("tenantHome.todayLabel")} · ${formatDelta(summary.members_active_today, summary.members_active_yesterday) ?? ""}` : ""}
            />
            <KpiCard
              label={t("tenantHome.apiCallsLabel")}
              value={formatApiCalls(summary?.api_calls_today)}
              sub={summary ? `${summary?.api_calls_limit && summary.api_calls_limit > 0 ? `${t("tenantHome.limitLabel")}: ${formatLimit(summary.api_calls_limit)}` : t("tenantHome.unlimited")} · ${formatDelta(summary.api_calls_today, summary.api_calls_yesterday) ?? ""}` : ""}
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
            <div className={ta.home_19}>
              <div className="capProgress">
                <div className={["capProgress__bar", ta.home_20].filter(Boolean).join(" ")} style={{ width: `${checklistPct}%` }} />
              </div>
            </div>
            <div className={ta.home_21}>
              {checklistItems.map(item => (
                <div key={item.key} className={ta.home_22}>
                  <span className={ta.home_23} style={{ background: item.done ? "rgba(34,197,94,0.2)" : "rgba(148,163,184,0.15)", color: item.done ? "#22c55e" : "#64748b" }}>
                    {item.done ? "✓" : "·"}
                  </span>
                  <span className={ta.home_24} style={{ color: item.done ? "var(--text-primary)" : "var(--text-secondary)" }}>
                    {t(item.labelKey)}
                  </span>
                  {item.route && !item.done && (
                    <Link to={item.route} className={[`${styles.button}`, ta.home_25].filter(Boolean).join(" ")} style={{ fontSize: 11, padding: "4px 10px" }}>
                      {t("tenantHome.checklistSetup")}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </ShellPanel>

          {/* Usage Trend Chart + Quick Actions */}
          <div className={ta.home_26} style={{ gridTemplateColumns: summary ? "1.5fr 1fr" : "1fr" }}>
            <ShellPanel title={t("tenantHome.usageTrendTitle")} actions={trendDays !== 7 ? undefined : trendActions}>
              {trendDays !== 7 && (
                <div className={ta.home_27}>{trendActions}</div>
              )}
              {trendFetching && trend.length === 0 ? (
                <ShellSkeleton variant="chart" count={trendDays} />
              ) : usageChartData.length > 0 ? (
                <div className={ta.home_28}>
                  <ResponsiveContainer>
                    <AreaChart data={usageChartData} margin={{ top: 10, right: 12, bottom: 4, left: 0 }}>
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
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" vertical={false} />
                      <XAxis
                        dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }}
                        axisLine={false} tickLine={false}
                      />
                      <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={36} />
                      <Tooltip
                        contentStyle={{
                          background: "rgba(15,23,42,0.96)", border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: 12, fontSize: 12, color: "#f1f5f9",
                          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)"
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8", paddingTop: 8 }} />
                      <Area
                        type="monotone" dataKey="api_calls" stroke="#00b4d8"
                        fill="url(#apiGrad)" strokeWidth={2.5} dot={false}
                        name={t("tenantHome.apiCallsLabel")}
                        className={ta.home_29}
                      />
                      <Area
                        type="monotone" dataKey="active_members" stroke="#10b981"
                        fill="url(#memberGrad)" strokeWidth={2.5} dot={false}
                        name={t("tenantHome.activeMembersLabel")}
                        className={ta.home_30}
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
                <div className={ta.home_31}>
                  {allowedLinks.map((entry) => (
                    <Link
                      key={entry.to}
                      to={entry.to}
                      className={[`${styles.listItem}`, ta.home_32].filter(Boolean).join(" ")}
                      style={{ transition: "transform 0.2s ease, border-color 0.2s ease" }}
                    >
                      <span className={ta.home_33}>{entry.icon}</span>
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
              <div className={`${styles.list}`}>
                {summary.recent_events.map((ev, i) => (
                  <div key={`${ev.event_type}-${i}`} className={[`${styles.listItem}`, ta.home_34].filter(Boolean).join(" ")} >
                    <span className={ta.home_35}>{eventIcon(ev.event_type)}</span>
                    <div className={ta.home_36}>
                      <div className={ta.home_37}>
                        {eventLabel(ev.event_type, t)}
                      </div>
                      {ev.description && (
                        <div className={`${styles.itemMeta}`} style={{ marginTop: 2, fontSize: 12 }}>
                          {ev.description}
                        </div>
                      )}
                      <div className={ta.home_38}>
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
            <div className={ta.home_39}>
              <div className={[`${styles.listItem}`, ta.home_40].filter(Boolean).join(" ")} >
                <span className={ta.home_41}>🔧</span>
                <div className={ta.home_42}>
                  <div className={ta.home_43}>
                    {t("tenantHome.serviceAccountsLabel")}
                    {summary.service_accounts.active > 0 && (
                      <span className={ta.home_44}>
                        <span className={ta.home_45} />
                        {t("tenantHome.active")}
                      </span>
                    )}
                  </div>
                  <div className={ta.home_46}>
                    {summary.service_accounts.active} {t("tenantHome.active")}
                    {summary.service_accounts.disabled > 0 && `, ${summary.service_accounts.disabled} ${t("tenantHome.disabled")}`}
                  </div>
                </div>
              </div>
              <div className={[`${styles.listItem}`, ta.home_47].filter(Boolean).join(" ")} >
                <span className={ta.home_48}>⏳</span>
                <div className={ta.home_49}>
                  <div className={ta.home_50}>
                    {t("tenantHome.patsExpiringLabel")}
                    {summary.pats_expiring_soon > 0 && (
                      <span className={ta.home_51}>
                        <span className={ta.home_52} />
                        {t("tenantUsage.warningLabel") || "WARNING"}
                      </span>
                    )}
                  </div>
                  <div className={ta.home_53} style={{ color: summary.pats_expiring_soon > 0 ? "#f59e0b" : "var(--text-secondary)" }}>
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
              <section className={`${styles.summaryGrid}`}>
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
