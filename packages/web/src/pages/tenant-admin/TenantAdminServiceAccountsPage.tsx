import styles from "../../components/ShellPageTemplate.module.css";
import ta from "./TenantAdmin.module.css";
import { useState } from "react";
import { ShellPageChrome, ShellPanel, renderShellMetric, ShellField, ShellSelectField } from "../../components/ShellPageTemplate.js";
import { ShellEmptyState } from "../../components/ShellEmptyState.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { useI18n } from "../../context/LangContext.js";
import { usePortfolio } from "../../context/PortfolioContext.js";
import { PolicyCheckboxes } from "../../components/PolicyCheckboxes.js";
import { useToast } from "../../components/ShellToast.js";
import { useConfirm } from "../../components/ConfirmModal.js";
import { useTenantAdminQuery, useTenantAdminMutation } from "./useTenantAdminQuery.js";
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

interface ServiceAccountsResponse {
  results?: ServiceAccount[];
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

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>({ name: "", environment: "prod", policy_ids: [] });

  const canRead = ability?.can?.("read", "TenantServiceAccountAdmin") ?? false;

  const { data: saResponse, isLoading, error } = useTenantAdminQuery<ServiceAccountsResponse>(
    ["tenant-admin", "service-accounts"],
    "/partner/service-accounts/",
    { enabled: canRead },
  );

  const serviceAccounts: ServiceAccount[] = saResponse?.results || (saResponse as unknown as ServiceAccount[]) || [];

  const createMutation = useTenantAdminMutation<ServiceAccount>(
    "post", "/partner/service-accounts/",
    [["tenant-admin", "service-accounts"]],
    {
      onSuccess: () => {
        setShowCreateModal(false);
        setCreateForm({ name: "", environment: "prod", policy_ids: [] });
      },
      onError: (err) => {
        toast.error(err?.message || t("tenantServiceAccounts.submitError"));
      },
    },
  );

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) return;
    createMutation.mutate({
      name: createForm.name,
      environment: createForm.environment,
      policy_ids: createForm.policy_ids,
      audit_reason: "Created via tenant admin",
    });
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
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("tenantServiceAccounts.deleteError"));
    }
  };

  const handleToggleStatus = async (sa: ServiceAccount) => {
    const newStatus = sa.status === "active" ? "disabled" : "active";
    try {
      await defaultCoreApiAdapter.corePatch(`/partner/service-accounts/${sa.service_account_id || sa.id}/`, {
        status: newStatus,
        audit_reason: `Status changed to ${newStatus} via tenant admin`,
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("tenantServiceAccounts.toggleError"));
    }
  };

  if (isLoading) {
    return (
      <ShellPageChrome
        eyebrow={t("tenantServiceAccounts.eyebrow")}
        title={t("tenantServiceAccounts.title")}
        description={t("common.loading")}
      >
        <div className={`${styles.panel}`}>{t("common.loading")}</div>
      </ShellPageChrome>
    );
  }

  if (error) {
    return (
      <ShellPageChrome
        eyebrow={t("tenantServiceAccounts.eyebrow")}
        title={t("tenantServiceAccounts.title")}
        description={t("tenantServiceAccounts.loadError")}
        error={error?.message || t("tenantServiceAccounts.loadError")}
      >
        <div className={`${styles.panel}`}>{error?.message || t("tenantServiceAccounts.loadError")}</div>
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
        <div className={`${styles.panel}`}>
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
      <section className={`${styles.stack}`}>
          <ShellPanel
            title={t("tenantServiceAccounts.listTitle")}
            subtitle={`${serviceAccounts.length}`}
            actions={
              <button
                onClick={() => setShowCreateModal(true)}
                className={`${styles.button} ${styles.buttonPrimary}`}
              >
                + {t("tenantServiceAccounts.createTitle")}
              </button>
            }
          >
            <div className={ta.sa_1}>
              <table className={ta.sa_2}>
                <thead>
                  <tr className={ta.sa_3}>
                    {[
                      t("tenantServiceAccounts.tableHeaderName"),
                      t("tenantServiceAccounts.tableHeaderEnvironment"),
                      t("tenantServiceAccounts.tableHeaderStatus"),
                      t("tenantServiceAccounts.tableHeaderPolicies"),
                      t("tenantServiceAccounts.tableHeaderCreatedAt"),
                      t("tenantServiceAccounts.tableHeaderActions"),
                    ].map(h => (
                      <th key={h} className={ta.sa_4}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {serviceAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className={ta.sa_5}>
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
                        <tr key={saId} className={ta.sa_6}>
                          <td className={ta.sa_7}>{sa.name}</td>
                          <td className={ta.sa_8}>
                            <span
                              className={`${styles.pill}`}
                              style={{
                                background: isProd ? "rgba(0,180,216,0.2)" : "rgba(148,163,184,0.2)",
                                color: isProd ? "#00b4d8" : "#94a3b8",
                              }}
                            >
                              {envLabel}
                            </span>
                          </td>
                          <td className={ta.sa_9}>
                            <span
                              className={`${styles.pill}`}
                              style={{
                                background: sa.status === "active" ? "rgba(34,197,94,0.2)" : "rgba(255,127,80,0.2)",
                                color: sa.status === "active" ? "#22c55e" : "#ff7f50",
                              }}
                            >
                              {t(`tenantServiceAccounts.statuses.${sa.status}`, { defaultValue: sa.status })}
                            </span>
                          </td>
                          <td className={ta.sa_10}>
                            <div className={ta.sa_11}>
                              {(sa.policy_ids || sa.metadata?.policy_ids || []).map((policy: string) => (
                                <span
                                  key={policy}
                                  className={`${styles.pill}`}
                                  style={{ background: "rgba(0,180,216,0.15)", color: "#00b4d8" }}
                                >
                                  {policy}
                                </span>
                              ))}
                              {(sa.policy_ids || sa.metadata?.policy_ids || []).length === 0 && (
                                <span className={ta.sa_12}>{t("tenantServiceAccounts.noPolicies")}</span>
                              )}
                            </div>
                          </td>
                          <td className={ta.sa_13}>{sa.created_at ? fmtDate(sa.created_at) : t("common.notAvailable")}</td>
                          <td className={ta.sa_14}>
                            <div className={ta.sa_15}>
                              <button
                                onClick={() => handleToggleStatus(sa)}
                                className={`${styles.button}`}
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
                                className={[`${styles.button}`, ta.sa_16].filter(Boolean).join(" ")}
                                style={{ padding: "6px 12px", border: "1px solid rgba(255,127,80,0.3)", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}
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
              className={ta.sa_17}
              onClick={() => setShowCreateModal(false)}
            >
              <div
                className={ta.sa_18}
                onClick={e => e.stopPropagation()}
              >
                <h3 className={ta.sa_19}>{t("tenantServiceAccounts.createTitle")}</h3>
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
                  <div className={ta.sa_20}>
                    <label className={`${styles.fieldLabel}`}>{t("tenantServiceAccounts.policyHeader")}</label>
                    <PolicyCheckboxes
                      selectedPolicies={createForm.policy_ids}
                      onChange={(policies: string[]) => setCreateForm(prev => ({ ...prev, policy_ids: policies }))}
                    />
                  </div>
                  <div className={ta.sa_21}>
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className={`${styles.button} ${styles.buttonSecondary}`}
                    >
                      {t("tenantServiceAccounts.cancelAction")}
                    </button>
                    <button
                      type="submit"
                      disabled={createMutation.isPending}
                      className={`${styles.button} ${styles.buttonPrimary}`}
                    >
                      {createMutation.isPending ? t("tenantServiceAccounts.submitting") : t("tenantServiceAccounts.createAction")}
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
