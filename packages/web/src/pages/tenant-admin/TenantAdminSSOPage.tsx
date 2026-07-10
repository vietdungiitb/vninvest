import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ShellPageChrome, ShellPanel } from "../../components/ShellPageTemplate.js";
import { ShellEmptyState } from "../../components/ShellEmptyState.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { useI18n } from "../../context/LangContext.js";
import { usePortfolio } from "../../context/PortfolioContext.js";
import { useConfirm } from "../../components/ConfirmModal.js";
import { useToast } from "../../components/ShellToast.js";

interface SSOConfig {
  is_enabled?: boolean;
  idp_entity_id?: string;
  idp_sso_url?: string;
  idp_x509_cert?: string;
  domain_hint?: string;
  sp_entity_id?: string;
  sp_acs_url?: string;
  tenant?: {
    plan?: string;
  };
}

interface TenantAdminSSOPageProps {
  env?: Record<string, unknown>;
  fetchImpl?: unknown;
  bootstrapLoader?: unknown;
  autoLoad?: boolean;
  initialSnapshot?: Record<string, unknown> | null;
}

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <div className="shellPage__field">
      <span className="shellPage__fieldLabel">{label}</span>
      {children}
      {help ? <span className="shellPage__itemMeta">{help}</span> : null}
    </div>
  );
}

export function TenantAdminSSOPage({
  env: _env = {},
  fetchImpl: _fetchImpl,
  bootstrapLoader: _bootstrapLoader,
  autoLoad: _autoLoad = true,
  initialSnapshot: _initialSnapshot = null,
}: TenantAdminSSOPageProps) {
  const { t } = useI18n();
  const { ability } = usePortfolio();
  const confirm = useConfirm();
  const toast = useToast();

  const [config, setConfig] = useState<SSOConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
    is_enabled: false,
    idp_entity_id: "",
    idp_sso_url: "",
    idp_x509_cert: "",
    domain_hint: "",
    sp_entity_id: "",
    sp_acs_url: "",
  });

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await defaultCoreApiAdapter.coreGet("/partner/sso/");
      setConfig(data);
      setFormData({
        is_enabled: data.is_enabled || false,
        idp_entity_id: data.idp_entity_id || "",
        idp_sso_url: data.idp_sso_url || "",
        idp_x509_cert: data.idp_x509_cert || "",
        domain_hint: data.domain_hint || "",
        sp_entity_id: data.sp_entity_id || "",
        sp_acs_url: data.sp_acs_url || "",
      });
    } catch (err) {
      setError((err as Error).message || t("tenantSSO.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const data = await defaultCoreApiAdapter.corePatch("/partner/sso/", formData);
      setConfig(data);
      setSuccess(t("tenantSSO.savedSuccess"));
    } catch (err) {
      setError((err as Error).message || t("tenantSSO.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const isEnterprisePlan = config?.tenant?.plan === "enterprise";
  const inputDisabled = loading || saving || !isEnterprisePlan;
  const canRead = ability?.can?.("read", "TenantSSOAdmin") ?? false;

  if (!canRead) {
    return (
      <ShellPageChrome
        eyebrow={t("tenantSSO.eyebrow")}
        title={t("tenantSSO.title")}
        description={t("tenantSSO.description")}
        notice={t("common.noPermission")}
      >
        <div className="shellPage__panel">
          <ShellEmptyState description={t("common.noPermission")} />
        </div>
      </ShellPageChrome>
    );
  }

  if (loading && !config) {
    return (
      <ShellPageChrome
        eyebrow={t("tenantSSO.eyebrow")}
        title={t("tenantSSO.title")}
        description={t("common.loading")}
      >
        <div className="shellPage__panel">{t("common.loading")}</div>
      </ShellPageChrome>
    );
  }

  const enterpriseNotice = !isEnterprisePlan
    ? `${t("tenantSSO.enterpriseOnlyNotice")} ${config?.tenant?.plan ? `${t("tenantSSO.currentPlanLabel")}: ${config.tenant.plan}.` : ""} ${t("tenantSSO.upgradeRequired")}`
    : "";

  return (
    <ShellPageChrome
      eyebrow={t("tenantSSO.eyebrow")}
      title={t("tenantSSO.title")}
      description={t("tenantSSO.description")}
      notice={enterpriseNotice}
    >
      <section className="shellPage__stack">
          {error ? (
            <div className="shellPage__banner shellPage__banner--error" role="alert">
              {error}
            </div>
          ) : null}
          {success ? (
            <div
              className="shellPage__banner"
              style={{
                background: "rgba(34,197,94,0.1)",
                border: "1px solid rgba(34,197,94,0.3)",
                color: "#22c55e",
              }}
              role="status"
              aria-live="polite"
            >
              {success}
            </div>
          ) : null}

          <div
            className="shellPage__actions"
            style={{ justifyContent: "flex-end", marginBottom: "20px" }}
          >
            <button
              onClick={loadConfig}
              disabled={loading}
              className="shellPage__button shellPage__button--secondary"
            >
              {t("tenantSSO.refreshAction")}
            </button>
            <Link
              to="/tenant-admin/home"
              className="shellPage__button shellPage__button--secondary"
              style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}
            >
              {t("tenantSSO.backToHome")}
            </Link>
          </div>

          <form onSubmit={handleSave}>
            <ShellPanel title={t("tenantSSO.title")} subtitle="SAML 2.0">
              <div className="shellPage__form">
                <div
                  className="shellPage__field"
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <input
                    type="checkbox"
                    id="sso-enabled"
                    checked={formData.is_enabled}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleChange("is_enabled", e.target.checked)
                    }
                    disabled={!isEnterprisePlan || loading || saving}
                    style={{
                      width: "18px",
                      height: "18px",
                      cursor: isEnterprisePlan ? "pointer" : "not-allowed",
                    }}
                  />
                  <span style={{ fontWeight: 500, color: "#f1f5f9" }}>
                    {t("tenantSSO.isEnabledLabel")}
                  </span>
                  <span style={{ fontSize: "12px", color: "#94a3b8", marginLeft: "4px" }}>
                    {t("tenantSSO.isEnabledHelp")}
                  </span>
                </div>

                {!isEnterprisePlan ? (
                  <ShellEmptyState description={t("tenantSSO.enterpriseOnlyNotice")} />
                ) : (
                  <div className="shellPage__form">
                    <Field label={t("tenantSSO.idpEntityIdLabel")} help={t("tenantSSO.idpEntityIdHelp")}>
                      <input
                        className="shellPage__input"
                        type="text"
                        value={formData.idp_entity_id}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          handleChange("idp_entity_id", e.target.value)
                        }
                        placeholder={t("tenantSSO.idpEntityIdPlaceholder")}
                        disabled={inputDisabled}
                        style={{ opacity: inputDisabled ? 0.5 : 1 }}
                      />
                    </Field>

                    <Field label={t("tenantSSO.idpSsoUrlLabel")} help={t("tenantSSO.idpSsoUrlHelp")}>
                      <input
                        className="shellPage__input"
                        type="url"
                        value={formData.idp_sso_url}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          handleChange("idp_sso_url", e.target.value)
                        }
                        placeholder={t("tenantSSO.idpSsoUrlPlaceholder")}
                        disabled={inputDisabled}
                        style={{ opacity: inputDisabled ? 0.5 : 1 }}
                      />
                    </Field>

                    <Field label={t("tenantSSO.idpX509CertLabel")} help={t("tenantSSO.idpX509CertHelp")}>
                      <textarea
                        className="shellPage__input"
                        value={formData.idp_x509_cert}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                          handleChange("idp_x509_cert", e.target.value)
                        }
                        placeholder={t("tenantSSO.idpX509CertPlaceholder")}
                        rows={6}
                        disabled={inputDisabled}
                        style={{
                          fontFamily: "monospace",
                          fontSize: "12px",
                          resize: "vertical",
                          opacity: inputDisabled ? 0.5 : 1,
                        }}
                      />
                    </Field>

                    <Field label={t("tenantSSO.domainHintLabel")} help={t("tenantSSO.domainHintHelp")}>
                      <input
                        className="shellPage__input"
                        type="text"
                        value={formData.domain_hint}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          handleChange("domain_hint", e.target.value)
                        }
                        placeholder={t("tenantSSO.domainHintPlaceholder")}
                        disabled={inputDisabled}
                        style={{ opacity: inputDisabled ? 0.5 : 1 }}
                      />
                    </Field>

                    <Field label={t("tenantSSO.spEntityIdLabel")} help={t("tenantSSO.spEntityIdHelp")}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input
                          className="shellPage__input"
                          type="text"
                          value={formData.sp_entity_id}
                          readOnly
                          placeholder={t("tenantSSO.spEntityIdPlaceholder")}
                          style={{ opacity: 0.8, flex: 1 }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(formData.sp_entity_id);
                            toast.success(t("tenantPats.copySuccess") || "Đã sao chép!");
                          }}
                          className="shellPage__button"
                          style={{ whiteSpace: "nowrap" }}
                        >
                          {t("tenantPats.copyTokenAction") || "Sao chép"}
                        </button>
                      </div>
                    </Field>

                    <Field label={t("tenantSSO.spAcsUrlLabel")} help={t("tenantSSO.spAcsUrlHelp")}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input
                          className="shellPage__input"
                          type="url"
                          value={formData.sp_acs_url}
                          readOnly
                          placeholder={t("tenantSSO.spAcsUrlPlaceholder")}
                          style={{ opacity: 0.8, flex: 1 }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(formData.sp_acs_url);
                            toast.success(t("tenantPats.copySuccess") || "Đã sao chép!");
                          }}
                          className="shellPage__button"
                          style={{ whiteSpace: "nowrap" }}
                        >
                          {t("tenantPats.copyTokenAction") || "Sao chép"}
                        </button>
                      </div>
                    </Field>

                    <button
                      type="submit"
                      disabled={saving || !isEnterprisePlan}
                      className="shellPage__button shellPage__button--primary"
                      style={{ alignSelf: "flex-start" }}
                    >
                      {saving ? t("tenantSSO.saving") : t("tenantSSO.saveAction")}
                    </button>
                  </div>
                )}
              </div>
            </ShellPanel>
          </form>

          <ShellPanel title={t("tenantSSO.ssoTestPanelTitle")} subtitle={t("tenantSSO.ssoTestPanelDesc")}>
            <div className="shellPage__form">
              <p className="shellPage__itemMeta" style={{ margin: 0 }}>
                {t("tenantSSO.ssoTestPanelDesc")}
              </p>
              <button
                type="button"
                onClick={async () => {
                  const isDirty = config ? (
                    formData.is_enabled !== (config.is_enabled || false) ||
                    formData.idp_entity_id !== (config.idp_entity_id || "") ||
                    formData.idp_sso_url !== (config.idp_sso_url || "") ||
                    formData.idp_x509_cert !== (config.idp_x509_cert || "") ||
                    formData.domain_hint !== (config.domain_hint || "")
                  ) : false;

                  if (isDirty) {
                    const ok = await confirm({
                      title: t("common.warning") || "Cảnh báo",
                      message: t("tenantSSO.unsavedChangesWarning"),
                    });
                    if (!ok) return;
                  }

                  const baseUrl = window.location.origin;
                  window.location.href = `${baseUrl}/core/v1/auth/sso/login/?domain=${formData.domain_hint}`;
                }}
                disabled={!formData.domain_hint || !formData.is_enabled || loading || saving}
                className="shellPage__button shellPage__button--secondary"
                style={{ alignSelf: "flex-start" }}
              >
                {t("tenantSSO.testConnectionAction")}
              </button>
              <p className="shellPage__itemMeta" style={{ margin: 0 }}>
                {t("tenantSSO.spAcsUrlDisplay")}{" "}
                <code style={{ color: "#cbd5e1", fontFamily: "monospace" }}>
                  {formData.sp_acs_url || t("tenantSSO.notConfigured")}
                </code>
              </p>
            </div>
          </ShellPanel>
      </section>
    </ShellPageChrome>
  );
}
