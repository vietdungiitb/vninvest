import { useEffect, useState } from "react";
import { AlertCircle, UserCircle } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ShellPageChrome, ShellPanel, renderShellMetric } from "../../components/ShellPageTemplate.js";
import { ShellEmptyState } from "../../components/ShellEmptyState.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { useI18n } from "../../context/LangContext.js";
import { usePortfolio } from "../../context/PortfolioContext.js";
import { useToast } from "../../components/ShellToast.js";
import { useConfirm } from "../../components/ConfirmModal.js";

interface DailyPoint {
  date: string;
  success: number;
  failed: number;
}

interface RecentFailure {
  username: string;
  ip: string;
  attempts: number;
  last_at: string;
}

interface Summary {
  total_logins: number;
  total_failed: number;
  success_rate_pct: number;
  unique_ips: number;
  unique_users: number;
  most_active_day: string | null;
  recent_failures: RecentFailure[];
}

interface LoginActivity {
  daily: DailyPoint[];
  summary: Summary;
}

interface SessionInfo {
  session_id: number;
  user_id: number;
  username: string;
  ip_address: string;
  user_agent: string;
  login_at: string;
  last_active_at: string;
  token_prefix: string;
  is_current: boolean;
}

interface SessionsResponse {
  sessions: SessionInfo[];
  total_active: number;
}

function timeAgo(iso: string, t: (k: string, o?: Record<string, string | number>) => string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return vaint("common.justNow", t);
  if (mins < 60) return t("common.minutesAgo", { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("common.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  return t("common.daysAgo", { count: days });
}

function vaint(key: string, t: (k: string, o?: Record<string, string | number>) => string): string {
  return t(key, { defaultValue: "just now" });
}

interface TenantAdminSecurityPageProps {
  env?: Record<string, unknown>;
  fetchImpl?: unknown;
  bootstrapLoader?: unknown;
  autoLoad?: boolean;
  initialSnapshot?: Record<string, unknown> | null;
}

export function TenantAdminSecurityPage({
  env: _env = {},
  fetchImpl: _fetchImpl,
  bootstrapLoader: _bootstrapLoader,
  autoLoad: _autoLoad = true,
  initialSnapshot: _initialSnapshot = null,
}: TenantAdminSecurityPageProps) {
  const { t } = useI18n();
  const { ability } = usePortfolio();
  const toast = useToast();
  const confirm = useConfirm();

  const [loginActivity, setLoginActivity] = useState<LoginActivity | null>(null);
  const [sessions, setSessions] = useState<SessionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [days, setDays] = useState(30);
  const [revokingId, setRevokingId] = useState<number | null>(null);

  const canRead = ability?.can?.("read", "TenantSecurityView") ?? true;
  const canManage = ability?.can?.("manage", "TenantSecurityView") ?? false;

  const loadData = async (d = days) => {
    try {
      setLoading(true);
      setError(undefined);
      const [activity, sessionData] = await Promise.all([
        defaultCoreApiAdapter.coreGet(`/partner/security/login-activity/?days=${d}`),
        defaultCoreApiAdapter.coreGet("/partner/security/sessions/"),
      ]);
      setLoginActivity(activity as LoginActivity);
      setSessions(sessionData as SessionsResponse);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("tenantSecurity.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [days]);

  const handleDaysChange = (d: number) => {
    setDays(d);
  };

  const handleRevokeSession = async (sessionId: number) => {
    const ok = await confirm({ title: t("common.revoke"), message: t("tenantSecurity.confirmRevoke") });
    if (!ok) return;
    setRevokingId(sessionId);
    try {
      await defaultCoreApiAdapter.corePost("/partner/security/sessions/revoke/", {
        session_id: sessionId,
      });
      await loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("tenantSecurity.loadError"));
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAll = async () => {
    const ok = await confirm({ title: t("common.revokeAll"), message: t("tenantSecurity.confirmRevokeAll") });
    if (!ok) return;
    setRevokingId(-1);
    try {
      await defaultCoreApiAdapter.corePost("/partner/security/sessions/revoke/", {
        revoke_all_except_current: true,
      });
      await loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("tenantSecurity.loadError"));
    } finally {
      setRevokingId(null);
    }
  };

  if (!canRead) {
    return (
      <ShellPageChrome
        eyebrow={t("tenantSecurity.eyebrow")}
        title={t("tenantSecurity.title")}
        description={t("tenantSecurity.description")}
        notice={t("common.noPermission")}
      >
        <div className="shellPage__panel">
          <ShellEmptyState description={t("tenantSecurity.emptyState")} />
        </div>
      </ShellPageChrome>
    );
  }

  if (loading && !loginActivity) {
    return (
      <ShellPageChrome
        eyebrow={t("tenantSecurity.eyebrow")}
        title={t("tenantSecurity.title")}
        description={t("common.loading")}
      >
        <div className="shellPage__panel">{t("common.loading")}</div>
      </ShellPageChrome>
    );
  }

  const summary = loginActivity?.summary;
  const metrics = summary
    ? [
        renderShellMetric(t("tenantSecurity.metricLogins"), String(summary.total_logins)),
        renderShellMetric(t("tenantSecurity.metricFailed"), String(summary.total_failed)),
        renderShellMetric(t("tenantSecurity.metricRate"), `${summary.success_rate_pct}%`),
        renderShellMetric(t("tenantSecurity.metricSessions"), String(sessions?.total_active ?? 0)),
      ]
    : [];

  const dayActions = (
    <div className="shellPage__actions">
      {[7, 14, 30].map((d) => (
        <button
          key={d}
          onClick={() => handleDaysChange(d)}
          className="shellPage__button"
          style={{
            background: days === d ? "rgba(0,180,216,0.2)" : "rgba(255,255,255,0.06)",
            color: days === d ? "var(--shell-accent)" : "var(--shell-ink)",
            border: days === d ? "1px solid rgba(0,180,216,0.3)" : "1px solid var(--shell-border)",
            borderRadius: 14, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}
        >
          {d}d
        </button>
      ))}
    </div>
  );

  const chartData = (loginActivity?.daily ?? []).map((d) => ({
    date: d.date ? d.date.slice(5) : "",
    success: d.success,
    failed: d.failed,
  }));

  const recentFailures = summary?.recent_failures ?? [];
  const activeSessions = sessions?.sessions ?? [];

  return (
    <ShellPageChrome
      eyebrow={t("tenantSecurity.eyebrow")}
      title={t("tenantSecurity.title")}
      description={t("tenantSecurity.description")}
      metrics={metrics}
      error={error}
    >
      <section className="shellPage__stack">
        <ShellPanel title={t("tenantSecurity.loginActivityTitle")} actions={dayActions}>
          {chartData.length > 0 ? (
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: -8 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 12, fontSize: 12, color: "#f1f5f9",
                    }}
                  />
                  <Bar dataKey="success" fill="#22c55e" stackId="a" name={t("tenantSecurity.logins")} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="failed" fill="#ef4444" stackId="a" name={t("tenantSecurity.failed")} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ShellEmptyState description={t("tenantSecurity.noData")} />
          )}
        </ShellPanel>

        {recentFailures.length > 0 && (
          <ShellPanel title={t("tenantSecurity.recentFailuresTitle")}>
            <div className="shellPage__list">
              {recentFailures.map((f, i) => (
                <div key={`fail-${i}`} className="shellPage__listItem" style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <AlertCircle className="w-5 h-5" style={{ color: "#ef4444", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{f.username}</div>
                    <div className="shellPage__itemMeta" style={{ fontSize: 12 }}>
                      {f.ip} &middot; {f.attempts} {t("tenantSecurity.attempts")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ShellPanel>
        )}

        <ShellPanel
          title={t("tenantSecurity.activeSessionsTitle")}
          actions={
            activeSessions.length > 1 && canManage ? (
              <button
                onClick={handleRevokeAll}
                disabled={revokingId === -1}
                className="shellPage__button"
                style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontSize: "12px" }}
              >
                {t("tenantSecurity.revokeAllAction")}
              </button>
            ) : null
          }
        >
          {activeSessions.length === 0 ? (
            <ShellEmptyState description={t("tenantSecurity.noSessions")} />
          ) : (
            <div className="shellPage__list">
              {activeSessions.map((s) => (
                <div key={s.session_id} className="shellPage__listItem">
                  <div className="shellPage__listItemHeader" style={{ marginBottom: 8 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <UserCircle className="w-5 h-5" style={{ color: "#94a3b8", flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, fontSize: 14 }}>
                          {s.username}
                          {s.is_current && (
                            <span className="shellPage__pill" style={{ marginLeft: 8, background: "rgba(34,197,94,0.2)", color: "#22c55e", fontSize: 10 }}>
                              {t("tenantSecurity.currentSession")}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="shellPage__itemMeta" style={{ fontSize: 12, marginTop: 4 }}>
                        {s.ip_address}
                        {s.user_agent && ` · ${s.user_agent.slice(0, 80)}`}
                      </div>
                    </div>
                    {canManage && !s.is_current && (
                      <button
                        onClick={() => handleRevokeSession(s.session_id)}
                        disabled={revokingId === s.session_id}
                        className="shellPage__button"
                        style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontSize: "12px" }}
                      >
                        {revokingId === s.session_id ? t("common.loading") : t("tenantSecurity.revokeAction")}
                      </button>
                    )}
                  </div>
                  <div className="shellPage__summaryGrid" style={{ gap: 16, fontSize: 12, paddingTop: 8 }}>
                    <div>
                      <div className="shellPage__itemMeta" style={{ fontSize: 10 }}>{t("tenantSecurity.loginAtLabel")}</div>
                      <span style={{ fontSize: 12 }}>{timeAgo(s.login_at, t)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ShellPanel>
      </section>
    </ShellPageChrome>
  );
}
