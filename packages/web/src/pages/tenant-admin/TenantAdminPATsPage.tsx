import styles from "../../components/ShellPageTemplate.module.css";
import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { ShellPageChrome, ShellPanel, renderShellMetric, ShellField, ShellSelectField } from "../../components/ShellPageTemplate.js";
import { ShellEmptyState } from "../../components/ShellEmptyState.js";
import { ShellSkeleton } from "../../components/ShellSkeleton.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { PolicyCheckboxes, policyIdsToScopeCodes, POLICIES } from "../../components/PolicyCheckboxes.js";
import { useI18n } from "../../context/LangContext.js";
import { usePortfolio } from "../../context/PortfolioContext.js";
import { useToast } from "../../components/ShellToast.js";
import { useConfirm } from "../../components/ConfirmModal.js";
interface Token {
  pat_id?: string;
  id?: string;
  label?: string;
  token_prefix?: string;
  status: string;
  revoked?: boolean;
  service_account_id: string;
  scope_codes?: string[];
  scopes?: string[];
  created_at?: string;
  expires_at?: string;
  last_used_at?: string;
}

interface ServiceAccount {
  service_account_id?: string;
  id?: string;
  name: string;
  metadata?: {
    environment?: string;
  };
  environment?: string;
  scopes?: string[];
}

interface CreateForm {
  service_account_id: string;
  display_name: string;
  expires_at: string;
  policy_ids: string[];
}

interface SecretReveal {
  secret: string;
  token_prefix: string;
}

interface PatUsage {
  pat_id: string;
  label: string;
  total_calls: number;
  unique_ips: number;
  top_endpoints: { endpoint: string; count: number }[];
  status_breakdown: { '2xx': number; '4xx': number; '5xx': number };
  timeline: { date: string; count: number }[];
  last_used_at: string | null;
  expires_at: string | null;
}

interface TenantAdminPATsPageProps {
  env?: Record<string, unknown>;
  fetchImpl?: unknown;
  bootstrapLoader?: unknown;
  autoLoad?: boolean;
  initialSnapshot?: Record<string, unknown> | null;
}

export function TenantAdminPATsPage({
  env: _env = {},
  fetchImpl: _fetchImpl,
  bootstrapLoader: _bootstrapLoader,
  autoLoad: _autoLoad = true,
  initialSnapshot: _initialSnapshot = null,
}: TenantAdminPATsPageProps) {
  const { t, formatDate: fmtDate, formatDateTime: fmtDateTime } = useI18n();
  const { ability } = usePortfolio();
  const toast = useToast();
  const confirm = useConfirm();

  const [tokens, setTokens] = useState<Token[]>([]);
  const [serviceAccounts, setServiceAccounts] = useState<ServiceAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [secretReveal, setSecretReveal] = useState<SecretReveal | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [activeTokenId, setActiveTokenId] = useState("");
  const [hideRevoked, setHideRevoked] = useState(true);
  const [hideUnused, setHideUnused] = useState(false);
  const [usagePat, setUsagePat] = useState<Token | null>(null);
  const [usageData, setUsageData] = useState<PatUsage | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState<CreateForm>({
    service_account_id: "",
    display_name: "",
    expires_at: "",
    policy_ids: ["pol_market_read", "pol_signals_read"],
  });

  const SCOPE_CATEGORIES = [
    { key: "market_data", label: "tenantPats.scopeMarketData", icon: "📊" },
    { key: "signals", label: "tenantPats.scopeSignals", icon: "🔔" },
    { key: "admin", label: "tenantPats.scopeAdmin", icon: "⚙️" },
  ];

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [tokenData, saData] = await Promise.all([
        defaultCoreApiAdapter.coreGet("/partner/pats/"),
        defaultCoreApiAdapter.coreGet("/partner/service-accounts/"),
      ]);

      const saList = saData.results || [];
      setTokens(tokenData.results || []);
      setServiceAccounts(saList);

      if (saList.length > 0) {
        setCreateForm(prev => ({
          ...prev,
          service_account_id: prev.service_account_id || saList[0].service_account_id || saList[0].id || "",
        }));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("tenantPats.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedSA = serviceAccounts.find(sa => (sa.service_account_id || sa.id) === createForm.service_account_id);

  useEffect(() => {
    if (!selectedSA) return;
    const saScopes = new Set(selectedSA.scopes || []);
    const newPolicies = createForm.policy_ids.filter(policyId => {
      const policy = POLICIES.find(p => p.id === policyId);
      return policy ? policy.scopes.every(scope => saScopes.has(scope)) : false;
    });
    const defaultPolicies = POLICIES.filter(p => p.scopes.every(s => saScopes.has(s))).map(p => p.id);
    setCreateForm(prev => ({
      ...prev,
      policy_ids: newPolicies.length > 0 ? newPolicies : defaultPolicies,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createForm.service_account_id, serviceAccounts]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.service_account_id) {
      toast.error(t("tenantPats.noServiceAccountSelected"));
      return;
    }

    setSubmitting(true);
    try {
      const scopeCodes = policyIdsToScopeCodes(createForm.policy_ids);
      const responseData = await defaultCoreApiAdapter.corePost("/partner/pats/issue/", {
        service_account_id: createForm.service_account_id,
        display_name: createForm.display_name,
        expires_at: createForm.expires_at ? new Date(createForm.expires_at).toISOString() : null,
        scope_codes: scopeCodes,
        audit_reason: "Issued via Tenant Admin Console",
      });

      if (responseData && (responseData.secret || responseData.token || responseData.access)) {
        const secretVal = responseData.secret || responseData.token || responseData.access;
        const prefixVal = responseData.token_prefix || "";
        setSecretReveal({ secret: secretVal, token_prefix: prefixVal });
        setShowCreateModal(false);
        setCreateForm({
          service_account_id: serviceAccounts[0]?.service_account_id || serviceAccounts[0]?.id || "",
          display_name: "",
          expires_at: "",
          policy_ids: ["pol_market_read", "pol_signals_read"],
        });
        await loadData();
      } else {
        toast.error(t("tenantPats.issueError"));
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("tenantPats.issueError"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRotateToken = async (tokenId: string) => {
    const ok = await confirm({ title: t("common.rotate"), message: t("tenantPats.rotateConfirm") });
    if (!ok) return;
    setActiveTokenId(tokenId);
    try {
      const nextToken = await defaultCoreApiAdapter.corePost(`/partner/pats/${tokenId}/rotate/`, {
        grace_period_seconds: 3600,
        audit_reason: "Rotated via Tenant Admin Console",
      });

      if (nextToken && (nextToken.secret || nextToken.token || nextToken.access)) {
        const secretVal = nextToken.secret || nextToken.token || nextToken.access;
        const prefixVal = nextToken.token_prefix || "";
        setSecretReveal({ secret: secretVal, token_prefix: prefixVal });
        await loadData();
      } else {
        toast.error(t("tenantPats.rotateError"));
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("tenantPats.rotateError"));
    } finally {
      setActiveTokenId("");
    }
  };

  const handleRevokeToken = async (tokenId: string) => {
    const ok = await confirm({ title: t("common.revoke"), message: t("tenantPats.revokeConfirm") });
    if (!ok) return;
    setActiveTokenId(tokenId);
    try {
      await defaultCoreApiAdapter.corePost(`/partner/pats/${tokenId}/revoke/`, {
        reason: "Tenant admin manually revoked",
      });
      await loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("tenantPats.revokeError"));
    } finally {
      setActiveTokenId("");
    }
  };

  const handleCopyToken = (tokenStr: string) => {
    if (!tokenStr) return;
    navigator.clipboard.writeText(tokenStr).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const handleOpenUsage = (token: Token) => {
    const patId = token.pat_id || token.id || "";
    if (!patId) return;
    setUsagePat(token);
    setUsageData(null);
    setUsageError(null);
    setUsageLoading(true);
    defaultCoreApiAdapter
      .coreGet(`/partner/pats/${patId}/usage/?days=30`)
      .then(data => setUsageData(data as PatUsage))
      .catch(err => setUsageError(err instanceof Error ? err.message : t("tenantPats.loadError")))
      .finally(() => setUsageLoading(false));
  };

  const canRead = ability?.can?.("read", "TenantPATAdmin") ?? false;

  if (!canRead) {
    return (
      <ShellPageChrome
        eyebrow={t("tenantPats.eyebrow")}
        title={t("tenantPats.title")}
        description={t("tenantPats.description")}
        notice={t("common.noPermission")}
      >
        <div className={`${styles.panel}`}>
          <ShellEmptyState description={t("tenantPats.emptyState")} />
        </div>
      </ShellPageChrome>
    );
  }

  if (loading && tokens.length === 0) {
    return (
      <ShellPageChrome
        eyebrow={t("tenantPats.eyebrow")}
        title={t("tenantPats.title")}
        description={t("common.loading")}
      >
        <ShellSkeleton variant="metric" count={2} />
        <div style={{ height: 16 }} />
        <ShellSkeleton variant="table-row" count={5} />
      </ShellPageChrome>
    );
  }

  if (error && tokens.length === 0) {
    return (
      <ShellPageChrome
        eyebrow={t("tenantPats.eyebrow")}
        title={t("tenantPats.title")}
        description={t("tenantPats.loadError")}
        error={error}
      >
        <div className={`${styles.panel}`}>{error}</div>
      </ShellPageChrome>
    );
  }

  const activeCount = tokens.filter(t => t.status === "active" || t.status === "rotating" || !t.revoked).length;
  const revokedCount = tokens.filter(t => t.status === "revoked" || t.revoked).length;
  const metrics = [
    renderShellMetric(t("tenantPats.metricTotal"), String(tokens.length)),
    renderShellMetric(t("tenantPats.metricActive"), String(activeCount)),
    renderShellMetric(t("tenantPats.metricRevoked"), String(revokedCount)),
  ];

  const visibleTokens = hideRevoked
    ? tokens.filter(t => t.status !== "revoked" && !t.revoked)
    : tokens;

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const filteredTokens = hideUnused
    ? visibleTokens.filter(t => {
        if (!t.last_used_at) return false;
        return new Date(t.last_used_at) >= ninetyDaysAgo;
      })
    : visibleTokens;

  const isUnusedOver90 = (token: Token): boolean => {
    if (!token.last_used_at) return true;
    return new Date(token.last_used_at) < ninetyDaysAgo;
  };

  const isExpiringSoon = (token: Token): boolean => {
    if (!token.expires_at) return false;
    const sevenDays = new Date();
    sevenDays.setDate(sevenDays.getDate() + 7);
    return new Date(token.expires_at) <= sevenDays && new Date(token.expires_at) > new Date();
  };
  const serviceAccountMap = new Map(serviceAccounts.map(sa => [sa.service_account_id || sa.id, sa]));

  const tokenStatusKey = (token: Token): string => {
    if (token.status === "revoked" || token.revoked) return "revoked";
    if (token.status === "rotating") return "rotating";
    return "active";
  };

  return (
    <ShellPageChrome
      eyebrow={t("tenantPats.eyebrow")}
      title={t("tenantPats.title")}
      description={t("tenantPats.description")}
      metrics={metrics}
    >
      <section className={`${styles.stack}`}>
          {secretReveal && (
            <div
              role="presentation"
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(0,0,0,0.8)",
                backdropFilter: "blur(8px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1100,
              }}
            >
              <div
                className={`${styles.surfaceCard}`}
                style={{
                  border: "1px solid rgba(34,197,94,0.3)",
                  padding: "28px",
                  width: "100%",
                  maxWidth: "550px",
                  background: "rgba(15,23,42,0.95)",
                  boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                  <span style={{ fontSize: "24px" }}>🔑</span>
                  <h3 className={`${styles.itemTitle}`} style={{ color: "#22c55e", fontSize: "20px", margin: 0 }}>
                    {t("tenantPats.secretTitle")}
                  </h3>
                </div>
                <p className={`${styles.itemMeta}`} style={{ margin: "0 0 20px", color: "#94a3b8", lineHeight: "1.6" }}>
                  {t("tenantPats.secretHint")}
                </p>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    background: "rgba(0,0,0,0.4)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "10px",
                    padding: "12px 16px",
                    marginBottom: "24px",
                  }}
                >
                  <code style={{ flex: 1, color: "#38bdf8", fontSize: "14px", wordBreak: "break-all", fontFamily: "monospace", fontWeight: "600" }}>
                    {secretReveal.secret}
                  </code>
                  <button
                    onClick={() => handleCopyToken(secretReveal.secret)}
                    className={`${styles.button}`}
                    style={{
                      background: copySuccess ? "rgba(34,197,94,0.2)" : "rgba(0,180,216,0.2)",
                      border: copySuccess ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(0,180,216,0.3)",
                      color: copySuccess ? "#22c55e" : "#00b4d8",
                      fontWeight: 600,
                      fontSize: "12px",
                      padding: "8px 16px",
                      borderRadius: "6px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {copySuccess ? t("tenantPats.copySuccess") : t("tenantPats.copyTokenAction")}
                  </button>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    onClick={() => setSecretReveal(null)}
                    className={`${styles.button} ${styles.buttonPrimary}`}
                    style={{
                      background: "#22c55e",
                      border: "none",
                      color: "#ffffff",
                      fontWeight: 600,
                      padding: "10px 24px",
                    }}
                  >
                    {t("tenantPats.closeAction")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {usagePat && (
            <div
              role="presentation"
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(0,0,0,0.7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
              }}
              onClick={() => setUsagePat(null)}
              onKeyDown={(e) => { if (e.key === 'Escape') setUsagePat(null); }}
            >
              <div
                className={`${styles.surfaceCard}`}
                style={{
                  border: "1px solid rgba(168,85,247,0.3)",
                  padding: "24px",
                  width: "100%",
                  maxWidth: "640px",
                  maxHeight: "90vh",
                  overflow: "auto",
                }}
                onClick={e => e.stopPropagation()}
              >
                <div className={`${styles.listItemHeader}`} style={{ marginBottom: "16px" }}>
                  <h3 className={`${styles.itemTitle}`} style={{ margin: 0, fontSize: "18px", color: "#a855f7" }}>
                    {t("tenantPats.usageTitle", { defaultValue: "PAT Usage" })}
                  </h3>
                  <button
                    onClick={() => setUsagePat(null)}
                    className={`${styles.button}`}
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border-shell)", fontSize: "12px" }}
                  >
                    {t("tenantPats.closeAction")}
                  </button>
                </div>

                {usageLoading && (
                  <div style={{ padding: 24, textAlign: "center", color: "var(--text-secondary)" }}>{t("common.loading")}</div>
                )}
                {usageError && (
                  <div style={{ padding: 16, color: "#ef4444", fontSize: 13 }}>{usageError}</div>
                )}
                {usageData && !usageLoading && (
                  <div style={{ display: "grid", gap: 16 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", fontSize: "13px" }}>
                      <div>
                        <div className={`${styles.itemMeta}`} style={{ fontSize: 11 }}>{t("tenantPats.totalCalls", { defaultValue: "Total calls (30d)" })}</div>
                        <span style={{ color: "#cbd5e1", fontWeight: 600 }}>{usageData.total_calls}</span>
                      </div>
                      <div>
                        <div className={`${styles.itemMeta}`} style={{ fontSize: 11 }}>{t("tenantPats.uniqueIps", { defaultValue: "Unique IPs" })}</div>
                        <span style={{ color: "#cbd5e1", fontWeight: 600 }}>{usageData.unique_ips}</span>
                      </div>
                      <div>
                        <div className={`${styles.itemMeta}`} style={{ fontSize: 11 }}>{t("tenantPats.lastUsedLabel", { defaultValue: "Last used" })}</div>
                        <span style={{ color: "#cbd5e1", fontSize: 12 }}>{usageData.last_used_at ? fmtDateTime(usageData.last_used_at) : t("tenantPats.neverUsed", { defaultValue: "Never" })}</span>
                      </div>
                    </div>

                    <div>
                      <div className={`${styles.itemMeta}`} style={{ fontSize: 12, marginBottom: 6 }}>{t("tenantPats.statusBreakdown", { defaultValue: "Status breakdown" })}</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        {(['2xx', '4xx', '5xx'] as const).map(k => (
                          <span key={k} className={`${styles.pill}`} style={{
                            background: k === '2xx' ? 'rgba(34,197,94,0.2)' : k === '4xx' ? 'rgba(234,179,8,0.2)' : 'rgba(239,68,68,0.2)',
                            color: k === '2xx' ? '#22c55e' : k === '4xx' ? '#eab308' : '#ef4444',
                            fontSize: 12,
                          }}>
                            {k}: {usageData.status_breakdown[k]}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className={`${styles.itemMeta}`} style={{ fontSize: 12, marginBottom: 6 }}>{t("tenantPats.timeline", { defaultValue: "Timeline (30d)" })}</div>
                      <div style={{ display: "grid", gap: 3, maxHeight: 160, overflow: "auto" }}>
                        {usageData.timeline.length === 0 ? (
                          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t("tenantPats.noUsageData", { defaultValue: "No usage data" })}</span>
                        ) : (
                          usageData.timeline.map(p => {
                            const max = Math.max(1, ...usageData.timeline.map(x => x.count));
                            return (
                              <div key={p.date} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                                <span style={{ width: 70, color: "#94a3b8" }}>{p.date.slice(5)}</span>
                                <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 999, overflow: "hidden" }}>
                                  <div style={{ width: `${(p.count / max) * 100}%`, height: "100%", background: "#a855f7", borderRadius: 999 }} />
                                </div>
                                <span style={{ width: 36, textAlign: "right", color: "#cbd5e1" }}>{p.count}</span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div>
                      <div className={`${styles.itemMeta}`} style={{ fontSize: 12, marginBottom: 6 }}>{t("tenantPats.topEndpoints", { defaultValue: "Top endpoints" })}</div>
                      <div className={`${styles.list}`} style={{ maxHeight: 200, overflow: "auto" }}>
                        {usageData.top_endpoints.length === 0 ? (
                          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t("tenantPats.noUsageData", { defaultValue: "No usage data" })}</span>
                        ) : (
                          usageData.top_endpoints.map(ep => (
                            <div key={ep.endpoint} className={`${styles.listItem}`} style={{ padding: "8px 0" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12 }}>
                                <code style={{ color: "#cbd5e1", fontSize: 11, wordBreak: "break-all" }}>{ep.endpoint}</code>
                                <span style={{ color: "#a855f7", fontWeight: 600, whiteSpace: "nowrap" }}>{ep.count}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className={`${styles.listItemHeader}`}>
            <h2 className={`${styles.itemTitle}`} style={{ fontSize: "20px", margin: 0 }}>
              {t("tenantPats.listTitle")}
            </h2>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              {tokens.some(t => t.status === "revoked" || t.revoked) && (
                <button
                  onClick={() => setHideRevoked(!hideRevoked)}
                  className={`${styles.button}`}
                  style={{ fontSize: "11px" }}
                >
                  {hideRevoked ? t("tenantPats.showRevokedAction") : t("tenantPats.hideRevokedAction")}
                </button>
              )}
              {tokens.some(t => !t.last_used_at || isUnusedOver90(t)) && (
                <button
                  onClick={() => setHideUnused(!hideUnused)}
                  className={`${styles.button}`}
                  style={{
                    fontSize: "11px",
                    background: hideUnused ? "rgba(234,179,8,0.2)" : "rgba(255,255,255,0.06)",
                    color: hideUnused ? "#eab308" : "var(--text-primary)",
                    border: hideUnused ? "1px solid rgba(234,179,8,0.3)" : "1px solid var(--border-shell)",
                  }}
                >
                  {hideUnused ? t("tenantPats.showAllAction") : t("tenantPats.filterUnused")}
                </button>
              )}
              <button
                onClick={() => setShowCreateModal(true)}
                disabled={serviceAccounts.length === 0}
                className={`${styles.button} ${styles.buttonPrimary}`}
              >
                + {t("tenantPats.issueAction")}
              </button>
            </div>
          </div>

          {serviceAccounts.length === 0 && (
            <div className={`${styles.surfaceCard}`} style={{ border: "1px solid rgba(255,127,80,0.3)", padding: "18px 24px", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
              <p className={`${styles.itemMeta}`} style={{ color: "#ff7f50", margin: 0, fontSize: "14px", fontWeight: 500 }}>
                {t("tenantPats.noServiceAccounts")}
              </p>
              <Link to="/tenant-admin/service-accounts" className={`${styles.button}`} style={{ background: "rgba(255,127,80,0.15)", border: "1px solid rgba(255,127,80,0.3)", color: "#ff7f50", textDecoration: "none", fontSize: "12px", fontWeight: "600", whiteSpace: "nowrap" }}>
                + Tạo Service Account
              </Link>
            </div>
          )}

          <ShellPanel
            title={t("tenantPats.listTitle")}
            subtitle={t("tenantPats.showingCount", { count: String(filteredTokens.length) })}
          >
            <div className={`${styles.list}`}>
              {filteredTokens.length === 0 ? (
                <ShellEmptyState description={t("tenantPats.emptyState")} ctaLabel={t("tenantPats.issueAction")} ctaOnClick={() => setShowCreateModal(true)} />
              ) : (
                filteredTokens.map(token => {
                  const sa = serviceAccountMap.get(token.service_account_id);
                  const isTokenRotating = activeTokenId === (token.pat_id || token.id);
                  const isRevoked = token.status === "revoked" || token.revoked;
                  const tokenId = token.pat_id || token.id;
                  const stKey = tokenStatusKey(token);

                  return (
                    <div key={tokenId} className={`${styles.listItem}`}>
                      <div className={`${styles.listItemHeader}`} style={{ marginBottom: "12px" }}>
                        <div>
                          <div className={`${styles.itemTitle}`} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontWeight: 600, fontSize: "15px" }}>
                              {token.label || "API Token"}
                            </span>
                            <code className={`${styles.pill}`} style={{ fontFamily: "monospace" }}>
                              {token.token_prefix}
                            </code>
                          </div>
                          <div className={`${styles.itemMeta}`} style={{ marginTop: "2px" }}>
                            {t("tenantPats.serviceAccountFor", { name: sa?.name || token.service_account_id })}
                          </div>
                        </div>
                        <span
                          className={`${styles.pill}`}
                          style={{
                            background: stKey === "revoked" ? "rgba(239,68,68,0.2)" : (stKey === "rotating" ? "rgba(234,179,8,0.2)" : "rgba(34,197,94,0.2)"),
                            color: stKey === "revoked" ? "#ef4444" : (stKey === "rotating" ? "#eab308" : "#22c55e"),
                          }}
                        >
                          {t(`tenantPats.statuses.${stKey}`)}
                        </span>
                      </div>

                      <div className={`${styles.summaryGrid}`} style={{ gap: "16px", fontSize: "13px", paddingTop: "12px" }}>
                        <div>
                          <div className={`${styles.itemMeta}`} style={{ fontSize: "11px" }}>{t("tenantPats.scopesLabel")}</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px" }}>
                            {(token.scope_codes || token.scopes || []).map((sc: string) => (
                              <span key={sc} className={`${styles.pill}`} style={{ background: "rgba(0,180,216,0.1)", color: "#00b4d8" }}>
                                {sc}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className={`${styles.itemMeta}`} style={{ fontSize: "11px" }}>{t("tenantPats.createdAtLabel")}</div>
                          <span className={`${styles.itemTitle}`} style={{ fontSize: "13px" }}>
                            {token.created_at ? fmtDate(token.created_at) : t("common.notAvailable")}
                          </span>
                        </div>
                        <div>
                          <div className={`${styles.itemMeta}`} style={{ fontSize: "11px" }}>{t("tenantPats.lastUsed")}</div>
                          <span className={`${styles.itemTitle}`} style={{
                            fontSize: "13px",
                            color: isUnusedOver90(token) ? "#eab308" : undefined,
                          }}>
                            {token.last_used_at ? fmtDateTime(token.last_used_at) : (
                              <span style={{ color: "#eab308" }}>{t("tenantPats.neverUsed")} {"⚠️"}</span>
                            )}
                          </span>
                        </div>
                        <div>
                          <div className={`${styles.itemMeta}`} style={{ fontSize: "11px" }}>{t("tenantPats.expiresAtLabel")}</div>
                          <span className={`${styles.itemTitle}`} style={{
                            fontSize: "13px",
                            color: isExpiringSoon(token) ? "#eab308" : (token.expires_at && new Date(token.expires_at) < new Date() ? "#ef4444" : undefined),
                          }}>
                            {token.expires_at ? fmtDateTime(token.expires_at) : t("tenantPats.neverExpire")}
                            {isExpiringSoon(token) && <span style={{ marginLeft: 4, fontSize: 11 }}>{"⚠️"}</span>}
                          </span>
                        </div>
                      </div>

                      {!isRevoked && (
                        <div className={`${styles.listItemHeader}`} style={{ gap: "8px", marginTop: "14px", paddingTop: "12px" }}>
                          <button
                            onClick={() => handleOpenUsage(token)}
                            className={`${styles.button}`}
                            style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)", color: "#a855f7", fontSize: "12px" }}
                          >
                            {t("tenantPats.usageAction", { defaultValue: "Usage" })}
                          </button>
                          <button
                            onClick={() => handleRotateToken(tokenId!)}
                            disabled={isTokenRotating}
                            className={`${styles.button}`}
                            style={{ background: "rgba(0,180,216,0.15)", border: "1px solid rgba(0,180,216,0.3)", color: "#00b4d8", fontSize: "12px" }}
                          >
                            {isTokenRotating ? t("tenantPats.rotatingAction") : t("tenantPats.rotateAction")}
                          </button>
                          <button
                            onClick={() => handleRevokeToken(tokenId!)}
                            disabled={isTokenRotating}
                            className={`${styles.button}`}
                            style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontSize: "12px" }}
                          >
                            {t("tenantPats.revokeAction")}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </ShellPanel>

          {showCreateModal && (
            <div
              role="presentation"
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(0,0,0,0.7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
              }}
              onClick={() => setShowCreateModal(false)}
              onKeyDown={(e) => { if (e.key === 'Escape') setShowCreateModal(false); }}
            >
              <div
                className={`${styles.surfaceCard}`}
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  padding: "24px",
                  width: "100%",
                  maxWidth: "550px",
                  maxHeight: "95vh",
                  overflow: "auto",
                }}
                onClick={e => e.stopPropagation()}
              >
                <h3 className={`${styles.itemTitle}`} style={{ margin: "0 0 20px", fontSize: "18px" }}>
                  {t("tenantPats.issueTitle")}
                </h3>
                <form onSubmit={handleCreateSubmit}>
                  <ShellField
                    label={t("tenantPats.displayNameLabel")}
                    name="display_name"
                    type="text"
                    value={createForm.display_name}
                    onChange={e => setCreateForm(prev => ({ ...prev, display_name: e.target.value }))}
                    placeholder={t("tenantPats.displayNamePlaceholder")}
                  />
                  <ShellSelectField
                    label={t("tenantPats.serviceAccountLabel")}
                    name="service_account_id"
                    value={createForm.service_account_id}
                    onChange={e => setCreateForm(prev => ({ ...prev, service_account_id: e.target.value }))}
                    options={serviceAccounts.map(sa => ({
                      key: sa.service_account_id || sa.id || "",
                      label: `${sa.name} (${(sa.metadata?.environment || sa.environment || "prod").toUpperCase()})`,
                    }))}
                  />
                  {selectedSA && (
                    <div style={{ marginTop: "-12px", marginBottom: "20px", paddingLeft: "4px" }}>
                      <span style={{ fontSize: "11px", color: "#94a3b8", display: "block", marginBottom: "6px" }}>
                        Quyền hạn của Service Account:
                      </span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        {selectedSA.scopes && selectedSA.scopes.length > 0 ? (
                          selectedSA.scopes.map(s => (
                            <span key={s} className={`${styles.pill}`} style={{ fontSize: "10px", padding: "2px 6px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", color: "#f1f5f9" }}>
                              {s}
                            </span>
                          ))
                        ) : (
                          <span style={{ fontSize: "11px", color: "#64748b", fontStyle: "italic" }}>Không có quyền hạn</span>
                        )}
                      </div>
                    </div>
                  )}
                  <ShellField
                    label={t("tenantPats.expiresAtLabel")}
                    name="expires_at"
                    type="datetime-local"
                    value={createForm.expires_at}
                    onChange={e => setCreateForm(prev => ({ ...prev, expires_at: e.target.value }))}
                  />
                  <div style={{ display: "flex", gap: 6, marginTop: -6, marginBottom: 12 }}>
                    {[
                      { label: "30 ngày", offset: 30 },
                      { label: "90 ngày", offset: 90 },
                      { label: "1 năm", offset: 365 },
                      { label: t("tenantPats.neverExpire"), offset: 0 },
                    ].map(preset => {
                      // Determine if this preset matches current selection
                      let isActive = false;
                      if (preset.offset === 0 && !createForm.expires_at) {
                        isActive = true;
                      } else if (createForm.expires_at) {
                        const d = new Date();
                        d.setDate(d.getDate() + preset.offset);
                        const expectedDateStr = d.toISOString().slice(0, 10);
                        const currentDateStr = new Date(createForm.expires_at).toISOString().slice(0, 10);
                        isActive = expectedDateStr === currentDateStr;
                      }

                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            if (preset.offset === 0) {
                              setCreateForm(prev => ({ ...prev, expires_at: "" }));
                            } else {
                              const d = new Date();
                              d.setDate(d.getDate() + preset.offset);
                              const tzOffset = d.getTimezoneOffset() * 60000;
                              const local = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
                              setCreateForm(prev => ({ ...prev, expires_at: local }));
                            }
                          }}
                          className={`${styles.button}`}
                          style={{
                            flex: 1,
                            fontSize: "11px",
                            padding: "8px 6px",
                            background: isActive ? "rgba(0,180,216,0.15)" : "rgba(255,255,255,0.04)",
                            border: isActive ? "1px solid rgba(0,180,216,0.3)" : "1px solid rgba(255,255,255,0.08)",
                            color: isActive ? "#00b4d8" : "#94a3b8",
                            fontWeight: isActive ? 600 : 400,
                            borderRadius: "6px",
                          }}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: "-6px", marginBottom: "20px", paddingLeft: "4px" }}>
                    {createForm.expires_at ? (
                      <div style={{ fontSize: "11px", color: "#22c55e" }}>
                        ✓ Hết hạn vào: <strong>{new Date(createForm.expires_at).toLocaleString("vi-VN")}</strong>
                      </div>
                    ) : (
                      <div style={{ fontSize: "11px", color: "#eab308" }}>
                        ⚠ Hoạt động vô thời hạn (Không khuyến nghị về bảo mật).
                      </div>
                    )}
                  </div>
                  <div className={`${styles.field}`}>
                    <span className={`${styles.fieldLabel}`}>{t("tenantPats.policiesLabel")}</span>
                    <div style={{ marginBottom: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {SCOPE_CATEGORIES.map(cat => (
                        <span key={cat.key} className={`${styles.pill}`} style={{ background: "rgba(0,180,216,0.1)", color: "#00b4d8", fontSize: 11 }}>
                          {cat.icon} {t(cat.label)}
                        </span>
                      ))}
                    </div>
                    <PolicyCheckboxes
                      selectedPolicies={createForm.policy_ids}
                      onChange={(policies: string[]) => setCreateForm(prev => ({ ...prev, policy_ids: policies }))}
                      allowedScopes={selectedSA?.scopes}
                    />
                  </div>
                  <div className={`${styles.listItemHeader}`} style={{ gap: "12px", marginTop: "24px" }}>
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className={`${styles.button} ${styles.buttonSecondary}`}
                    >
                      {t("tenantPats.cancelAction")}
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className={`${styles.button} ${styles.buttonPrimary}`}
                    >
                      {submitting ? t("tenantPats.submitting") : t("tenantPats.issueAction")}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
      </section>
    </ShellPageChrome>
  );
}
