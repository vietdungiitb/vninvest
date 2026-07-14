import styles from "../../components/ShellPageTemplate.module.css";
import ta from "./TenantAdmin.module.css";
import { useEffect, useState, useCallback } from "react";
import { ShellPageChrome, ShellPanel, renderShellMetric } from "../../components/ShellPageTemplate.js";
import { ShellEmptyState } from "../../components/ShellEmptyState.js";
import { ShellSkeleton } from "../../components/ShellSkeleton.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { useI18n } from "../../context/LangContext.js";
import { usePortfolio } from "../../context/PortfolioContext.js";
import { useToast } from "../../components/ShellToast.js";
import { useConfirm } from "../../components/ConfirmModal.js";
interface WebhookConfig {
  id: number;
  name: string;
  url: string;
  events: string[];
  is_active: boolean;
  headers: Record<string, string>;
  retry_count: number;
  timeout_seconds: number;
  created_at: string;
  updated_at: string;
}

interface WebhookDelivery {
  id: number;
  config: number;
  config_name: string;
  event_type: string;
  event_id: string;
  status: string;
  response_code: number | null;
  response_body: string;
  attempts: number;
  next_retry_at: string | null;
  duration_ms: number | null;
  created_at: string;
}

type EventCategory = "member" | "pat" | "sa" | "quota" | "billing" | "other";

const EVENT_CATEGORIES: Record<EventCategory, { label: string; events: string[] }> = {
  member: { label: "eventMember", events: ["member.joined", "member.removed", "member.updated"] },
  pat: { label: "eventPAT", events: ["pat.created", "pat.revoked", "pat.updated"] },
  sa: { label: "eventSA", events: ["sa.created", "sa.deleted"] },
  quota: { label: "eventQuota", events: ["quota.warning", "quota.critical"] },
  billing: { label: "eventBilling", events: ["billing.invoice.paid", "billing.subscription.changed"] },
  other: { label: "eventOther", events: ["webhook.test", "tenant.trial.ending", "tenant.deprovisioned"] },
};

interface TenantAdminWebhooksPageProps {
  env?: Record<string, unknown>;
  fetchImpl?: unknown;
  bootstrapLoader?: unknown;
  autoLoad?: boolean;
  initialSnapshot?: Record<string, unknown> | null;
}

export function TenantAdminWebhooksPage({}: TenantAdminWebhooksPageProps) {
  const { t, formatDateTime: fmtDateTime } = useI18n();
  const { ability } = usePortfolio();
  const toast = useToast();
  const confirm = useConfirm();

  const canRead = ability?.can?.("read", "TenantWebhookView") ?? false;
  const canManage = ability?.can?.("manage", "TenantWebhookView") ?? false;

  const [configs, setConfigs] = useState<WebhookConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<WebhookConfig | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: "",
    url: "",
    events: [] as string[],
    retry_count: 3,
    timeout_seconds: 10,
    is_active: true,
  });

  const [showDeliveryLog, setShowDeliveryLog] = useState<number | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);

  const [secretReveal, setSecretReveal] = useState<string | null>(null);

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    member: true, pat: true, sa: true, quota: true, billing: true, other: true,
  });
  const toggleCategory = (cat: string) => setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));

  const loadData = useCallback(async () => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await defaultCoreApiAdapter.coreGet("/partner/webhooks/");
      setConfigs(data.results || data || []);
    } catch (err: unknown) {
      setError((err as Error).message || t("tenantWebhooks.loadError"));
    } finally {
      setLoading(false);
    }
  }, [canRead, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreate = () => {
    setEditingConfig(null);
    setForm({ name: "", url: "", events: [], retry_count: 3, timeout_seconds: 10, is_active: true });
    setSecretReveal(null);
    setShowModal(true);
  };

  const openEdit = (config: WebhookConfig) => {
    setEditingConfig(config);
    setForm({
      name: config.name,
      url: config.url,
      events: [...config.events],
      retry_count: config.retry_count,
      timeout_seconds: config.timeout_seconds,
      is_active: config.is_active,
    });
    setSecretReveal(null);
    setShowModal(true);
  };

  const toggleEvent = (event: string) => {
    setForm(prev => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter(e => e !== event)
        : [...prev.events, event],
    }));
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      const payload = {
        name: form.name,
        url: form.url,
        events: form.events,
        retry_count: form.retry_count,
        timeout_seconds: form.timeout_seconds,
        is_active: form.is_active,
      };

      let newSecret = null;
      if (editingConfig) {
        await defaultCoreApiAdapter.corePatch(`/partner/webhooks/${editingConfig.id}/`, payload);
      } else {
        const result = await defaultCoreApiAdapter.corePost("/partner/webhooks/", payload);
        if (result.raw_secret) {
          newSecret = result.raw_secret;
          setSecretReveal(result.raw_secret);
        }
      }

      await loadData();
      if (!newSecret) {
        setShowModal(false);
      }
    } catch (err: unknown) {
      setError((err as Error).message || t("tenantWebhooks.saveError"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (config: WebhookConfig) => {
    const ok = await confirm({ title: t("common.delete"), message: `${t("tenantWebhooks.deleteConfirmMessage")} "${config.name}"?` });
    if (!ok) return;
    try {
      await defaultCoreApiAdapter.coreDelete(`/partner/webhooks/${config.id}/`);
      await loadData();
    } catch (err: unknown) {
      setError((err as Error).message || t("tenantWebhooks.deleteError"));
    }
  };

  const handleRegenerate = async (configId: number) => {
    try {
      const result = await defaultCoreApiAdapter.corePost(`/partner/webhooks/${configId}/regenerate-secret/`);
      setSecretReveal(result.raw_secret);
    } catch (err: unknown) {
      setError((err as Error).message || t("tenantWebhooks.regenerateError"));
    }
  };

  const handleTest = async (configId: number) => {
    try {
      await defaultCoreApiAdapter.corePost(`/partner/webhooks/${configId}/test/`);
      toast.success(t("tenantWebhooks.testSent"));
    } catch (err: unknown) {
      setError((err as Error).message || t("tenantWebhooks.saveError"));
    }
  };

  const loadDeliveries = async (configId: number) => {
    setShowDeliveryLog(configId);
    setDeliveriesLoading(true);
    try {
      const data = await defaultCoreApiAdapter.coreGet(`/partner/webhooks/${configId}/deliveries/`);
      setDeliveries(data.results || data || []);
    } catch {
      setDeliveries([]);
    } finally {
      setDeliveriesLoading(false);
    }
  };

  const handleRetry = async (configId: number, deliveryId: number) => {
    try {
      await defaultCoreApiAdapter.corePost(`/partner/webhooks/${configId}/deliveries/${deliveryId}/retry/`);
      await loadDeliveries(configId);
    } catch {
      // ignore
    }
  };

  const totalDeliveries = deliveries.length;
  const successDeliveries = deliveries.filter(d => d.status === "success" || (d.response_code != null && d.response_code >= 200 && d.response_code < 300)).length;
  const successRate = totalDeliveries > 0 ? Math.round((successDeliveries / totalDeliveries) * 100) : 0;

  const metrics = [
    renderShellMetric(t("tenantWebhooks.metricTotal"), String(configs.length)),
    renderShellMetric(t("tenantWebhooks.metricActive"), String(configs.filter(c => c.is_active).length)),
    renderShellMetric(t("tenantWebhooks.metricDeliverySuccessRate"), `${successRate}%`),
  ];

  if (!canRead) {
    return (
      <ShellPageChrome
        eyebrow={t("tenantWebhooks.eyebrow")}
        title={t("tenantWebhooks.title")}
        description={t("tenantWebhooks.description")}
        notice={t("common.noPermission")}
      >
        <div className={`${styles.panel}`}>
          <ShellEmptyState description={t("tenantWebhooks.empty")} />
        </div>
      </ShellPageChrome>
    );
  }

  if (loading && configs.length === 0) {
    return (
      <ShellPageChrome eyebrow={t("tenantWebhooks.eyebrow")} title={t("tenantWebhooks.title")} description={t("common.loading")}>
        <ShellSkeleton variant="metric" count={2} />
        <div className={ta.whk_1} />
        <ShellSkeleton variant="table-row" count={5} />
      </ShellPageChrome>
    );
  }

  const WEBHOOK_CSS = `
.wbCategoryGroup { margin-bottom: 12px; border: 1px solid var(--border-shell); border-radius: 10px; overflow: hidden; }
.wbCategoryHeader { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; cursor: pointer; background: rgba(255,255,255,0.03); font-size: 13px; font-weight: 700; }
.wbCategoryHeader:hover { background: rgba(255,255,255,0.06); }
.wbCategoryHeader:focus-visible { outline: 2px solid #3b82f6; outline-offset: -2px; }
.wbCategoryBody { padding: 8px 14px 12px; display: flex; flex-direction: column; gap: 6px; }
.wbEventCheck { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-primary); cursor: pointer; }
.wbEventCheck input { accent-color: var(--accent-shell); }
.wbMetricSuccess { color: #22c55e; }
.wbMetricFail { color: #ef4444; }
`;

  return (
    <ShellPageChrome
      eyebrow={t("tenantWebhooks.eyebrow")}
      title={t("tenantWebhooks.title")}
      description={t("tenantWebhooks.description")}
      metrics={metrics}
      error={error || undefined}
    >
      <section className={`${styles.stack}`}>
        <style>{WEBHOOK_CSS}</style>
        {canManage && (
          <div className={ta.whk_2}>
            <button onClick={openCreate} className={`${styles.button} ${styles.buttonPrimary}`} style={{ fontWeight: 700 }}>
              + {t("tenantWebhooks.createAction")}
            </button>
          </div>
        )}

        {configs.length === 0 ? (
          <ShellPanel title={t("tenantWebhooks.listTitle")}>
            <ShellEmptyState
              description={t("tenantWebhooks.empty")}
              ctaLabel={canManage ? t("tenantWebhooks.createAction") : undefined}
              ctaOnClick={canManage ? () => openCreate() : undefined}
            />
          </ShellPanel>
        ) : (
          configs.map(config => {
            return (
              <ShellPanel key={config.id} title={config.name} actions={
                <span className={ta.whk_3} style={{ color: config.is_active ? "#22c55e" : "#ef4444" }}>
                  {config.is_active ? t("tenantWebhooks.activeLabel") : t("tenantWebhooks.inactiveLabel")}
                </span>
              }>
                <div className={ta.whk_4}>{config.url}</div>
                <div className={ta.whk_5}>
                  {(config.events || []).slice(0, 5).map(ev => (
                    <span key={ev} className={ta.whk_6}>{ev}</span>
                  ))}
                  {(config.events || []).length > 5 && (
                    <span className={ta.whk_7}>+{config.events.length - 5}</span>
                  )}
                </div>
                <div className={ta.whk_8}>
                  {canManage && (
                    <button onClick={() => openEdit(config)} className={`${styles.button} ${styles.buttonSecondary}`} style={{ fontSize: 12 }}>{t("common.edit")}</button>
                  )}
                  <button onClick={() => { loadDeliveries(config.id); }} className={`${styles.button} ${styles.buttonSecondary}`} style={{ fontSize: 12 }}>{t("tenantWebhooks.deliveryLog")}</button>
                  {canManage && (
                    <>
                      <button onClick={() => handleTest(config.id)} className={`${styles.button} ${styles.buttonSecondary}`} style={{ fontSize: 12 }}>{t("tenantWebhooks.testAction")}</button>
                      <button onClick={() => handleRegenerate(config.id)} className={`${styles.button} ${styles.buttonSecondary}`} style={{ fontSize: 12 }}>{t("tenantWebhooks.regenerateAction")}</button>
                      <button onClick={() => handleDelete(config)} className={[`${styles.button}`, ta.whk_9].filter(Boolean).join(" ")} style={{ fontSize: 12 }}>{t("common.delete")}</button>
                    </>
                  )}
                </div>

                {showDeliveryLog === config.id && (
                  <div className={ta.whk_10}>
                    <h4 className={ta.whk_11}>{t("tenantWebhooks.deliveryLog")}</h4>
                    {deliveriesLoading ? (
                      <div className={ta.whk_12}>{t("common.loading")}</div>
                    ) : deliveries.length === 0 ? (
                      <div className={ta.whk_13}>{t("tenantWebhooks.deliveryLogEmpty")}</div>
                    ) : (
                      <div className={ta.whk_14}>
                        <table className={ta.whk_15}>
                          <thead>
                            <tr className={ta.whk_16}>
                              <th className={ta.whk_17}>{t("tenantWebhooks.thTime")}</th>
                              <th className={ta.whk_18}>{t("tenantWebhooks.thEvent")}</th>
                              <th className={ta.whk_19}>{t("tenantWebhooks.thStatus")}</th>
                              <th className={ta.whk_20}>HTTP</th>
                              <th className={ta.whk_21}>{t("tenantWebhooks.thAttempts")}</th>
                              <th className={ta.whk_22}>{t("tenantWebhooks.thDuration")}</th>
                              <th className={ta.whk_23}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {deliveries.map(d => (
                              <tr key={d.id} className={ta.whk_24}>
                                <td className={ta.whk_25}>{fmtDateTime(d.created_at)}</td>
                                <td className={ta.whk_26}>{d.event_type}</td>
                                <td className={ta.whk_27}>
                                  <span className={ta.whk_28} style={{ color: d.status === "success" ? "#22c55e" : d.status === "retrying" ? "#f59e0b" : "#ef4444" }}>
                                    {d.status === "success" ? t("tenantWebhooks.statusSuccess") : d.status === "failed" ? t("tenantWebhooks.statusFailed") : t("tenantWebhooks.statusRetrying")}
                                  </span>
                                </td>
                                <td className={ta.whk_29}>{d.response_code ?? "\u2014"}</td>
                                <td className={ta.whk_30}>{d.attempts}</td>
                                <td className={ta.whk_31}>{d.duration_ms != null ? `${d.duration_ms}ms` : "\u2014"}</td>
                                <td className={ta.whk_32}>
                                  {d.status === "failed" && (
                                    <button
                                      onClick={() => handleRetry(config.id, d.id)}
                                      className={`${styles.button}`}
                                      style={{ fontSize: 11, padding: "2px 8px" }}
                                    >
                                      {t("tenantWebhooks.retryAction")}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <button
                      onClick={() => setShowDeliveryLog(null)}
                      className={[`${styles.button} ${styles.buttonSecondary}`, ta.whk_33].filter(Boolean).join(" ")}
                      style={{ fontSize: 11 }}
                    >
                      {t("tenantWebhooks.closeLogAction")}
                    </button>
                  </div>
                )}
              </ShellPanel>
            );
          })
        )}

        {secretReveal && (
          <ShellPanel title={t("tenantWebhooks.secretTitle")}>
            <div className={ta.whk_34}>
              <p className={ta.whk_35}>{t("tenantWebhooks.secretWarning")}</p>
              <code className={ta.whk_36}>{secretReveal}</code>
              <div className={ta.whk_37}>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(secretReveal).then(() => {
                      setSecretReveal(null);
                      setShowModal(false);
                    });
                  }}
                  className={`${styles.button}`}
                  style={{ fontSize: 12 }}
                >
                  {t("tenantWebhooks.copyAndCloseAction")}
                </button>
              </div>
            </div>
          </ShellPanel>
        )}

        {showModal && !secretReveal && (
          <div className={ta.whk_38}>
            <div className={ta.whk_39}>
              <h3 className={ta.whk_40}>
                {editingConfig ? t("tenantWebhooks.editTitle") : t("tenantWebhooks.createTitle")}
              </h3>

              <div className={["fieldGroup", ta.whk_41].filter(Boolean).join(" ")} >
                <label className="fieldLabel">{t("tenantWebhooks.nameLabel")}</label>
                <input
                  className={`${styles.input}`}
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder={t("tenantWebhooks.namePlaceholder")}
                />
              </div>

              <div className={["fieldGroup", ta.whk_42].filter(Boolean).join(" ")} >
                <label className="fieldLabel">{t("tenantWebhooks.urlLabel")}</label>
                <input
                  className={`${styles.input}`}
                  value={form.url}
                  onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
                  placeholder="https://hooks.example.com/events"
                />
              </div>

              <div className={["fieldGroup", ta.whk_43].filter(Boolean).join(" ")} >
                <label className="fieldLabel">{t("tenantWebhooks.eventsLabel")}</label>
                {Object.entries(EVENT_CATEGORIES).map(([cat, catInfo]) => {
                  const catEvents = catInfo.events;
                  const selectedInCat = form.events.filter(e => catEvents.includes(e));
                  const allSelectedInCat = selectedInCat.length === catEvents.length;
                  return (
                    <div key={cat} className="wbCategoryGroup">
                      <div className="wbCategoryHeader" role="button" tabIndex={0} onClick={() => toggleCategory(cat)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCategory(cat); } }}>
                        <span>{t(`tenantWebhooks.${catInfo.label}`)} ({catEvents.length})</span>
                        <span>{expandedCategories[cat] ? '\u2212' : '+'} {selectedInCat.length > 0 && <span>({selectedInCat.length})</span>}</span>
                      </div>
                      {expandedCategories[cat] && (
                        <div className="wbCategoryBody">
                          <label className={["wbEventCheck", ta.whk_44].filter(Boolean).join(" ")} >
                            <input
                              type="checkbox"
                              checked={allSelectedInCat}
                              onChange={() => {
                                if (allSelectedInCat) {
                                  setForm(prev => ({ ...prev, events: prev.events.filter(e => !catEvents.includes(e)) }));
                                } else {
                                  setForm(prev => ({ ...prev, events: [...new Set([...prev.events, ...catEvents])] }));
                                }
                              }}
                            />
                            {t("common.selectAll")}
                          </label>
                          {catInfo.events.map(eventType => (
                            <label key={eventType} className={["wbEventCheck", ta.whk_45].filter(Boolean).join(" ")} >
                              <input
                                type="checkbox"
                                checked={form.events.includes(eventType)}
                                onChange={() => toggleEvent(eventType)}
                              />
                              {eventType}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className={ta.whk_46}>
                <div className="fieldGroup">
                  <label className="fieldLabel">{t("tenantWebhooks.retryLabel")}</label>
                  <input className={`${styles.input}`} type="number" min={0} max={10}
                    value={form.retry_count}
                    onChange={e => setForm(p => ({ ...p, retry_count: Math.max(0, Math.min(10, Number(e.target.value) || 0)) }))}
                  />
                </div>
                <div className="fieldGroup">
                  <label className="fieldLabel">{t("tenantWebhooks.timeoutLabel")}</label>
                  <input className={`${styles.input}`} type="number" min={1} max={120}
                    value={form.timeout_seconds}
                    onChange={e => setForm(p => ({ ...p, timeout_seconds: Math.max(1, Math.min(120, Number(e.target.value) || 10)) }))}
                  />
                </div>
              </div>

              <div className={["fieldGroup", ta.whk_47].filter(Boolean).join(" ")} >
                <label className={ta.whk_48}>
                  <input type="checkbox" checked={form.is_active}
                    onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
                  />
                  {t("tenantWebhooks.activeCheckbox")}
                </label>
              </div>

              <div className={ta.whk_49}>
                <button onClick={() => { setShowModal(false); setSecretReveal(null); }}
                  className={`${styles.button} ${styles.buttonSecondary}`} style={{ fontSize: 13 }}>
                  {t("common.cancel")}
                </button>
                <button onClick={handleSubmit} disabled={submitting || !form.url}
                  className={`${styles.button} ${styles.buttonPrimary}`} style={{ fontSize: 13, fontWeight: 700 }}>
                  {submitting ? t("common.saving") : (editingConfig ? t("common.save") : t("tenantWebhooks.createAction"))}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </ShellPageChrome>
  );
}
