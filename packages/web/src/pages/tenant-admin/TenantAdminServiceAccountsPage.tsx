import { useEffect, useState } from "react";
import { ShellPageChrome, ShellPanel, renderShellMetric, ShellField, ShellSelectField } from "../../components/ShellPageTemplate.js";
import { ShellEmptyState } from "../../components/ShellEmptyState.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { useI18n } from "../../context/LangContext.js";
import { usePortfolio } from "../../context/PortfolioContext.js";
import { PolicyCheckboxes } from "../../components/PolicyCheckboxes.js";
import { useToast } from "../../components/ShellToast.js";
import { useConfirm } from "../../components/ConfirmModal.js";

interface ServiceAccount {
  service_account_id?: string;
  id?: string;
  name: string;
  status: string;
  created_at?: string;
  metadata?: {
    environment?: string;
    policy_ids?: string[];
  };
  environment?: string;
  policy_ids?: string[];
}

interface CreateForm {
  name: string;
  environment: string;
  policy_ids: string[];
}

interface TenantAdminServiceAccountsPageProps {
  env?: Record<string, unknown>;
  fetchImpl?: unknown;
  bootstrapLoader?: unknown;
  autoLoad?: boolean;
  initialSnapshot?: Record<string, unknown> | null;
}

export function TenantAdminServiceAccountsPage({
  env: _env = {},
  fetchImpl: _fetchImpl,
  bootstrapLoader: _bootstrapLoader,
  autoLoad: _autoLoad = true,
  initialSnapshot: _initialSnapshot = null,
}: TenantAdminServiceAccountsPageProps) {
  const { t, formatDate: fmtDate } = useI18n();
  const { ability } = usePortfolio();
  const toast = useToast();
  const confirm = useConfirm();

  const [serviceAccounts, setServiceAccounts] = useState<ServiceAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>({ name: "", environment: "prod", policy_ids: [] });
  const [submitting, setSubmitting] = useState(false);

  const canRead = ability?.can?.("read", "TenantServiceAccountAdmin") ?? true;

  useEffect(() => {
    async function loadServiceAccounts() {
      if (!canRead) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const data = await defaultCoreApiAdapter.coreGet("/partner/service-accounts/");
        setServiceAccounts(data.results || data || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : t("tenantServiceAccounts.loadError"));
      } finally {
        setLoading(false);
      }
    }
    loadServiceAccounts();
  }, [canRead]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) return;

    setSubmitting(true);
    try {
      const data = await defaultCoreApiAdapter.corePost("/partner/service-accounts/", {
        name: createForm.name,
        environment: createForm.environment,
        policy_ids: createForm.policy_ids,
        audit_reason: "Created via tenant admin",
      });
      setServiceAccounts(prev => [data, ...prev]);
      setShowCreateModal(false);
      setCreateForm({ name: "", environment: "prod", policy_ids: [] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("tenantServiceAccounts.submitError"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSA = async (saId?: string) => {
    if (!saId) {
      toast.error("Invalid service account ID");
      return;
    }
    const ok = await confirm({ title: t("common.delete"), message: t("tenantServiceAccounts.confirmDelete") });
    if (!ok) return;

    try {
      await defaultCoreApiAdapter.coreDelete(`/partner/service-accounts/${saId}/`);
      setServiceAccounts(prev => prev.filter(sa => sa.service_account_id !== saId && sa.id !== saId));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("tenantServiceAccounts.deleteError"));
    }
  };

  const handleToggleStatus = async (sa: ServiceAccount) => {
    const newStatus = sa.status === "active" ? "disabled" : "active";
    try {
      const data = await defaultCoreApiAdapter.corePatch(`/partner/service-accounts/${sa.service_account_id || sa.id}/`, {
        status: newStatus,
        audit_reason: `Status changed to ${newStatus} via tenant admin`,
      });
      setServiceAccounts(prev => prev.map(sa => (sa.service_account_id === data.service_account_id || sa.id === data.id) ? data : sa));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("tenantServiceAccounts.toggleError"));
    }
  };

  if (loading) {
    return (
      <ShellPageChrome
        eyebrow={t("tenantServiceAccounts.eyebrow")}
        title={t("tenantServiceAccounts.title")}
        description={t("common.loading")}
      >
        <div className="shellPage__panel">{t("common.loading")}</div>
      </ShellPageChrome>
    );
  }

  if (error) {
    return (
      <ShellPageChrome
        eyebrow={t("tenantServiceAccounts.eyebrow")}
        title={t("tenantServiceAccounts.title")}
        description={t("tenantServiceAccounts.loadError")}
        error={error}
      >
        <div className="shellPage__panel">{error}</div>
      </ShellPageChrome>
    );
  }

  if (!canRead) {
    return (
      <ShellPageChrome
        eyebrow={t("tenantServiceAccounts.eyebrow")}
        title={t("tenantServiceAccounts.title")}
        description={t("tenantServiceAccounts.description")}
        notice={t("common.noPermission")}
      >
        <div className="shellPage__panel">
          <ShellEmptyState description={t("tenantServiceAccounts.emptyState")} />
        </div>
      </ShellPageChrome>
    );
  }

  const metrics = [
    renderShellMetric(t("tenantServiceAccounts.metricTotal"), String(serviceAccounts.length)),
    renderShellMetric(t("tenantServiceAccounts.metricActive"), String(serviceAccounts.filter(sa => sa.status === "active").length)),
    renderShellMetric(t("tenantServiceAccounts.metricDisabled"), String(serviceAccounts.filter(sa => sa.status === "disabled").length)),
    renderShellMetric(t("tenantServiceAccounts.metricEnvironment"), String(serviceAccounts.filter(sa => (sa.metadata?.environment || sa.environment) === "prod").length)),
  ];

  return (
    <ShellPageChrome
      eyebrow={t("tenantServiceAccounts.eyebrow")}
      title={t("tenantServiceAccounts.title")}
      description={t("tenantServiceAccounts.description")}
      metrics={metrics}
    >
      <section className="shellPage__stack">
          <ShellPanel
            title={t("tenantServiceAccounts.listTitle")}
            subtitle={`${serviceAccounts.length}`}
            actions={
              <button
                onClick={() => setShowCreateModal(true)}
                className="shellPage__button shellPage__button--primary"
              >
                + {t("tenantServiceAccounts.createTitle")}
              </button>
            }
          >
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    {[
                      t("tenantServiceAccounts.tableHeaderName"),
                      t("tenantServiceAccounts.tableHeaderEnvironment"),
                      t("tenantServiceAccounts.tableHeaderStatus"),
                      t("tenantServiceAccounts.tableHeaderPolicies"),
                      t("tenantServiceAccounts.tableHeaderCreatedAt"),
                      t("tenantServiceAccounts.tableHeaderActions"),
                    ].map(h => (
                      <th key={h} style={{ padding: "12px", textAlign: "left", color: "#94a3b8", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {serviceAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: "24px", textAlign: "center" }}>
                        <ShellEmptyState description={t("tenantServiceAccounts.emptyState")} ctaLabel={t("tenantServiceAccounts.createTitle")} ctaOnClick={() => setShowCreateModal(true)} />
                      </td>
                    </tr>
                  ) : (
                    serviceAccounts.map(sa => {
                      const environment = sa.metadata?.environment || sa.environment || "prod";
                      const envLabel = environment.toUpperCase();
                      const isProd = environment === "prod";
                      const saId = sa.service_account_id || sa.id;
                      return (
                        <tr key={saId} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td style={{ padding: "12px", fontWeight: 500 }}>{sa.name}</td>
                          <td style={{ padding: "12px" }}>
                            <span
                              className="shellPage__pill"
                              style={{
                                background: isProd ? "rgba(0,180,216,0.2)" : "rgba(148,163,184,0.2)",
                                color: isProd ? "#00b4d8" : "#94a3b8",
                              }}
                            >
                              {envLabel}
                            </span>
                          </td>
                          <td style={{ padding: "12px" }}>
                            <span
                              className="shellPage__pill"
                              style={{
                                background: sa.status === "active" ? "rgba(34,197,94,0.2)" : "rgba(255,127,80,0.2)",
                                color: sa.status === "active" ? "#22c55e" : "#ff7f50",
                              }}
                            >
                              {t(`tenantServiceAccounts.statuses.${sa.status}`, { defaultValue: sa.status })}
                            </span>
                          </td>
                          <td style={{ padding: "12px" }}>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                              {(sa.policy_ids || sa.metadata?.policy_ids || []).map((policy: string) => (
                                <span
                                  key={policy}
                                  className="shellPage__pill"
                                  style={{ background: "rgba(0,180,216,0.15)", color: "#00b4d8" }}
                                >
                                  {policy}
                                </span>
                              ))}
                              {(sa.policy_ids || sa.metadata?.policy_ids || []).length === 0 && (
                                <span style={{ color: "#94a3b8", fontSize: "12px" }}>{t("tenantServiceAccounts.noPolicies")}</span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: "12px" }}>{sa.created_at ? fmtDate(sa.created_at) : t("common.notAvailable")}</td>
                          <td style={{ padding: "12px" }}>
                            <div style={{ display: "flex", gap: "8px" }}>
                              <button
                                onClick={() => handleToggleStatus(sa)}
                                className="shellPage__button"
                                style={{
                                  padding: "6px 12px",
                                  background: sa.status === "active" ? "rgba(255,127,80,0.15)" : "rgba(34,197,94,0.15)",
                                  border: sa.status === "active" ? "1px solid rgba(255,127,80,0.3)" : "1px solid rgba(34,197,94,0.3)",
                                  borderRadius: "6px",
                                  color: sa.status === "active" ? "#ff7f50" : "#22c55e",
                                  cursor: "pointer",
                                  fontSize: "12px",
                                }}
                              >
                                {sa.status === "active" ? t("tenantServiceAccounts.toggleDisableAction") : t("tenantServiceAccounts.toggleEnableAction")}
                              </button>
                              <button
                                onClick={() => handleDeleteSA(saId!)}
                                className="shellPage__button"
                                style={{
                                  padding: "6px 12px",
                                  background: "rgba(255,127,80,0.15)",
                                  border: "1px solid rgba(255,127,80,0.3)",
                                  borderRadius: "6px",
                                  color: "#ff7f50",
                                  cursor: "pointer",
                                  fontSize: "12px",
                                }}
                              >
                                {t("tenantServiceAccounts.deleteAction")}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </ShellPanel>

          {showCreateModal && (
            <div
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
            >
              <div
                style={{
                  background: "#0b0f19",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "16px",
                  padding: "24px",
                  width: "100%",
                  maxWidth: "500px",
                  maxHeight: "90vh",
                  overflow: "auto",
                }}
                onClick={e => e.stopPropagation()}
              >
                <h3 style={{ margin: "0 0 20px", fontSize: "18px" }}>{t("tenantServiceAccounts.createTitle")}</h3>
                <form onSubmit={handleCreateSubmit}>
                  <ShellField
                    label={t("tenantServiceAccounts.nameLabel")}
                    name="sa_name"
                    value={createForm.name}
                    onChange={e => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={t("tenantServiceAccounts.namePlaceholderCreate")}
                  />
                  <ShellSelectField
                    label={t("tenantServiceAccounts.environmentLabel")}
                    name="environment"
                    value={createForm.environment}
                    onChange={e => setCreateForm(prev => ({ ...prev, environment: e.target.value }))}
                    options={[
                      { key: "prod", label: t("tenantServiceAccounts.environmentOptionProd") },
                      { key: "staging", label: t("tenantServiceAccounts.environmentOptionStaging") },
                      { key: "dev", label: t("tenantServiceAccounts.environmentOptionDev") },
                    ]}
                  />
                  <div style={{ marginBottom: "16px" }}>
                    <label className="shellPage__fieldLabel">{t("tenantServiceAccounts.policyHeader")}</label>
                    <PolicyCheckboxes
                      selectedPolicies={createForm.policy_ids}
                      onChange={(policies: string[]) => setCreateForm(prev => ({ ...prev, policy_ids: policies }))}
                    />
                  </div>
                  <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "24px" }}>
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="shellPage__button shellPage__button--secondary"
                    >
                      {t("tenantServiceAccounts.cancelAction")}
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="shellPage__button shellPage__button--primary"
                    >
                      {submitting ? t("tenantServiceAccounts.submitting") : t("tenantServiceAccounts.createAction")}
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
