import styles from "../../components/ShellPageTemplate.module.css";
import ta from "./TenantAdmin.module.css";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ShellPageChrome, ShellPanel } from "../../components/ShellPageTemplate.js";
import { ShellEmptyState } from "../../components/ShellEmptyState.js";
import { useI18n } from "../../context/LangContext.js";
import { usePortfolio } from "../../context/PortfolioContext.js";
import { useToast } from "../../components/ShellToast.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { useQueryClient } from "@tanstack/react-query";
import { useTenantAdminQuery, invalidateTenantAdminQueries } from "./useTenantAdminQuery.js";
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

interface SSOTestResult {
  success: boolean;
  checks?: string[];
  errors?: string[];
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
    <div className={`${styles.field}`}>
      <span className={`${styles.fieldLabel}`}>{label}</span>
      {children}
      {help ? <span className={`${styles.itemMeta}`}>{help}</span> : null}
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
  const toast = useToast();
  const queryClient = useQueryClient();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<SSOTestResult | null>(null);
  const [testingLogin, setTestingLogin] = useState(false);
  const [testLoginResult, setTestLoginResult] = useState<{ redirect_url?: string; sso_url?: string; error?: string } | null>(null);

  const [formData, setFormData] = useState({
    is_enabled: false,
    idp_entity_id: "",
    idp_sso_url: "",
    idp_x509_cert: "",
    domain_hint: "",
    sp_entity_id: "",
    sp_acs_url: "",
  });

  const { data: configData, isLoading: loading, error: configError } = useTenantAdminQuery<SSOConfig>(
    ["tenant-sso", "config"],
    "/partner/sso/",
  );

  // Sync form state from fetched config
  useEffect(() => {
    if (configData) {
      setFormData({
        is_enabled: configData.is_enabled || false,
        idp_entity_id: configData.idp_entity_id || "",
        idp_sso_url: configData.idp_sso_url || "",
        idp_x509_cert: configData.idp_x509_cert || "",
        domain_hint: configData.domain_hint || "",
        sp_entity_id: configData.sp_entity_id || "",
        sp_acs_url: configData.sp_acs_url || "",
      });
    }
  }, [configData]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await defaultCoreApiAdapter.corePatch("/partner/sso/", formData);
      invalidateTenantAdminQueries(queryClient);
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

  const handleTestConnection = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    setError("");
    try {
      const result = await defaultCoreApiAdapter.corePost("/partner/sso/test/", {});
      setTestResult(result as SSOTestResult);
    } catch (err) {
      setTestResult({
        success: false,
        errors: [(err as Error).message || t("tenantSSO.testError")],
      });
    } finally {
      setTesting(false);
    }
  }, [t]);

  const handleTestLogin = useCallback(async () => {
    setTestingLogin(true);
    setTestLoginResult(null);
    setError("");
    try {
      const result = await defaultCoreApiAdapter.corePost("/partner/sso/test-login/", {});
      setTestLoginResult(result as { redirect_url?: string; sso_url?: string });
    } catch (err) {
      setTestLoginResult({ error: (err as Error).message || t("tenantSSO.testError") });
    } finally {
      setTestingLogin(false);
    }
  }, [t]);

  const isEnterprisePlan = configData?.tenant?.plan === "enterprise";
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
        <div className={`${styles.panel}`}>
          <ShellEmptyState description={t("common.noPermission")} />
        </div>
      </ShellPageChrome>
    );
  }

  if (loading && !configData) {
    return (
      <ShellPageChrome
        eyebrow={t("tenantSSO.eyebrow")}
        title={t("tenantSSO.title")}
        description={t("common.loading")}
      >
        <div className={`${styles.panel}`}>{t("common.loading")}</div>
      </ShellPageChrome>
    );
  }

  const enterpriseNotice = !isEnterprisePlan
    ? `${t("tenantSSO.enterpriseOnlyNotice")} ${configData?.tenant?.plan ? `${t("tenantSSO.currentPlanLabel")}: ${configData.tenant.plan}.` : ""} ${t("tenantSSO.upgradeRequired")}`
    : "";

  return (
    <ShellPageChrome
      eyebrow={t("tenantSSO.eyebrow")}
      title={t("tenantSSO.title")}
      description={t("tenantSSO.description")}
      notice={enterpriseNotice}
    >
      <section className={`${styles.stack}`}>
          {error || configError ? (
            <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
              {error || configError?.message || t("tenantSSO.loadError")}
            </div>
          ) : null}
          {success ? (
            <div
              className={[`${styles.banner}`, ta.sso_1].filter(Boolean).join(" ")}
              
              role="status"
              aria-live="polite"
            >
              {success}
            </div>
          ) : null}

          <div
            className={[`${styles.actions}`, ta.sso_2].filter(Boolean).join(" ")}
            
          >
            <button
              onClick={() => invalidateTenantAdminQueries(queryClient)}
              disabled={loading}
              className={`${styles.button} ${styles.buttonSecondary}`}
            >
              {t("tenantSSO.refreshAction")}
            </button>
            <Link
              to="/tenant-admin/home"
              className={[`${styles.button} ${styles.buttonSecondary}`, ta.sso_3].filter(Boolean).join(" ")}
              
            >
              {t("tenantSSO.backToHome")}
            </Link>
          </div>

          <form onSubmit={handleSave}>
            <ShellPanel title={t("tenantSSO.title")} subtitle="SAML 2.0">
              <div className={`${styles.form}`}>
                <div
                  className={[`${styles.field}`, ta.sso_4].filter(Boolean).join(" ")}
                  style={{ gap: "10px" }}
                >
                  <input aria-label={t("tenantSSO.isEnabledLabel")}
                    type="checkbox"
                    id="sso-enabled"
                    checked={formData.is_enabled}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleChange("is_enabled", e.target.checked)
                    }
                    disabled={!isEnterprisePlan || loading || saving}
                    className={ta.sso_5} style={{ cursor: isEnterprisePlan ? "pointer" : "not-allowed" }}
                  />
                  <span className={ta.sso_6}>
                    {t("tenantSSO.isEnabledLabel")}
                  </span>
                  <span className={ta.sso_7}>
                    {t("tenantSSO.isEnabledHelp")}
                  </span>
                </div>

                {!isEnterprisePlan ? (
                  <ShellEmptyState description={t("tenantSSO.enterpriseOnlyNotice")} />
                ) : (
                  <div className={`${styles.form}`}>
                    <Field label={t("tenantSSO.idpEntityIdLabel")} help={t("tenantSSO.idpEntityIdHelp")}>
                      <input aria-label={t("tenantSSO.idpEntityIdLabel")}
                        className={`${styles.input}`}
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
                      <input aria-label={t("tenantSSO.idpSsoUrlLabel")}
                        className={`${styles.input}`}
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
                      <textarea aria-label={t("tenantSSO.idpX509CertLabel")}
                        className={[`${styles.input}`, ta.sso_8].filter(Boolean).join(" ")}
                        value={formData.idp_x509_cert}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                          handleChange("idp_x509_cert", e.target.value)
                        }
                        placeholder={t("tenantSSO.idpX509CertPlaceholder")}
                        rows={6}
                        disabled={inputDisabled}
                        style={{ fontSize: "12px", opacity: inputDisabled ? 0.5 : 1 }}
                      />
                    </Field>

                    <Field label={t("tenantSSO.domainHintLabel")} help={t("tenantSSO.domainHintHelp")}>
                      <input aria-label={t("tenantSSO.domainHintLabel")}
                        className={`${styles.input}`}
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
                      <div className={ta.sso_9}>
                        <input aria-label={t("tenantSSO.spEntityIdLabel")}
                          className={[`${styles.input}`, ta.sso_10].filter(Boolean).join(" ")}
                          type="text"
                          value={formData.sp_entity_id}
                          readOnly
                          placeholder={t("tenantSSO.spEntityIdPlaceholder")}
                          
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(formData.sp_entity_id);
                            toast.success(t("tenantSSO.copySuccess"));
                          }}
                          className={[`${styles.button}`, ta.sso_11].filter(Boolean).join(" ")}
                          
                        >
                          {t("tenantSSO.copyAction")}
                        </button>
                      </div>
                    </Field>

                    <Field label={t("tenantSSO.spAcsUrlLabel")} help={t("tenantSSO.spAcsUrlHelp")}>
                      <div className={ta.sso_12}>
                        <input aria-label={t("tenantSSO.spAcsUrlLabel")}
                          className={[`${styles.input}`, ta.sso_13].filter(Boolean).join(" ")}
                          type="url"
                          value={formData.sp_acs_url}
                          readOnly
                          placeholder={t("tenantSSO.spAcsUrlPlaceholder")}
                          
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(formData.sp_acs_url);
                            toast.success(t("tenantSSO.copySuccess"));
                          }}
                          className={[`${styles.button}`, ta.sso_14].filter(Boolean).join(" ")}
                          
                        >
                          {t("tenantSSO.copyAction")}
                        </button>
                      </div>
                    </Field>

                    <button
                      type="submit"
                      disabled={saving || !isEnterprisePlan}
                      className={[`${styles.button} ${styles.buttonPrimary}`, ta.sso_15].filter(Boolean).join(" ")}
                      
                    >
                      {saving ? t("tenantSSO.saving") : t("tenantSSO.saveAction")}
                    </button>
                  </div>
                )}
              </div>
            </ShellPanel>
          </form>

          <ShellPanel title={t("tenantSSO.ssoTestPanelTitle")} subtitle={t("tenantSSO.ssoTestPanelDesc")}>
            <div className={`${styles.form}`}>
              <p className={`${styles.itemMeta}`} style={{ margin: 0 }}>
                {t("tenantSSO.ssoTestPanelDesc")}
              </p>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing || loading || saving}
                  className={[`${styles.button} ${styles.buttonSecondary}`, ta.sso_16].filter(Boolean).join(" ")}
                >
                  {testing ? t("tenantSSO.testingConnection") : t("tenantSSO.testConnectionAction")}
                </button>
                <button
                  type="button"
                  onClick={handleTestLogin}
                  disabled={testingLogin || !formData.is_enabled || loading || saving}
                  className={[`${styles.button} ${styles.buttonSecondary}`, ta.sso_16].filter(Boolean).join(" ")}
                >
                  {testingLogin ? t("tenantSSO.testingConnection") : t("tenantSSO.testLoginAction")}
                </button>
              </div>
              {testResult ? (
                <div className={`${styles.form}`} style={{ marginTop: "12px" }}>
                  <div
                    className={`${styles.banner} ${testResult.success ? styles.bannerSuccess : styles.bannerError}`}
                    role={testResult.success ? "status" : "alert"}
                  >
                    {testResult.success
                      ? t("tenantSSO.testSuccess")
                      : t("tenantSSO.testError")}
                  </div>
                  {testResult.checks && testResult.checks.length > 0 ? (
                    <ul style={{ margin: "8px 0 0 0", paddingLeft: "20px" }}>
                      {testResult.checks.map((check, i) => (
                        <li key={i} className={`${styles.itemMeta}`}>{check}</li>
                      ))}
                    </ul>
                  ) : null}
                  {testResult.errors && testResult.errors.length > 0 ? (
                    <ul style={{ margin: "8px 0 0 0", paddingLeft: "20px", color: "var(--color-error)" }}>
                      {testResult.errors.map((err, i) => (
                        <li key={i} className={`${styles.itemMeta}`}>{err}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
              {testLoginResult ? (
                <div className={`${styles.form}`} style={{ marginTop: "12px" }}>
                  <div
                    className={`${styles.banner} ${testLoginResult.error ? styles.bannerError : styles.bannerSuccess}`}
                    role={testLoginResult.error ? "alert" : "status"}
                  >
                    {testLoginResult.error
                      ? testLoginResult.error
                      : t("tenantSSO.testLoginSuccess")}
                  </div>
                  {testLoginResult.redirect_url ? (
                    <div style={{ marginTop: "8px" }}>
                      <p className={`${styles.itemMeta}`}>
                        {t("tenantSSO.testLoginRedirectUrl")}
                      </p>
                      <code style={{ fontSize: "12px", wordBreak: "break-all" }}>
                        {testLoginResult.redirect_url}
                      </code>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <p className={`${styles.itemMeta}`} style={{ margin: 0 }}>
                {t("tenantSSO.spAcsUrlDisplay")}{" "}
                <code className={ta.sso_17}>
                  {formData.sp_acs_url || t("tenantSSO.notConfigured")}
                </code>
              </p>
            </div>
          </ShellPanel>
      </section>
    </ShellPageChrome>
  );
}
