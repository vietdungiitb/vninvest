import styles from "../../components/ShellPageTemplate.module.css";
import ta from "./TenantAdmin.module.css";
import { ReactNode, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ShellPageChrome, ShellPanel, renderShellMetric } from "../../components/ShellPageTemplate.js";
import { ShellEmptyState } from "../../components/ShellEmptyState.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { useI18n } from "../../context/LangContext.js";
import { usePortfolio } from "../../context/PortfolioContext.js";
import { useToast } from "../../components/ShellToast.js";
import { useConfirm } from "../../components/ConfirmModal.js";
import { useTenantAdminQuery } from "./useTenantAdminQuery.js";
interface Subscription {
  plan_code: string;
  status: string;
  billing_cycle?: string;
  credit_balance?: number;
  current_period_start?: string;
  current_period_end?: string;
  next_invoice_date?: string;
  auto_renew?: boolean;
  invoice_state?: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  issue_date: string;
  status: string;
  total_amount: number;
  payment_method?: string;
}

interface CostTrend {
  monthly: Array<{ month: string; total: number; items: Record<string, number>; count: number }>;
  total_6m: number;
  monthly_avg: number;
  projected_next: number | null;
  projected_change_pct: number | null;
  currency: string;
}

interface FieldCardProps {
  label: string;
  value: string;
}

function FieldCard({ label, value }: FieldCardProps): ReactNode {
  return (
    <div className={`${styles.listItem}`}>
      <p className={[`${styles.itemMeta}`, ta.bill_1].filter(Boolean).join(" ")} style={{ fontSize: "11px", color: "#94a3b8" }}>{label}</p>
      <p className={ta.bill_2}>{value}</p>
    </div>
  );
}

function formatCurrency(value: unknown, fmtCurrency: (n: number, c: string) => string, tt: (k: string, opts?: object) => string): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return tt("common.notAvailable");
  }
  return fmtCurrency(Number(value), "VND");
}

function formatDateField(value: string | null | undefined, fmtDate: (d: string) => string): string {
  if (!value) return "\u2014";
  return fmtDate(value);
}

function CostTrendChart({ data, currency, projectedNext, projectedChangePct, tt, formatNumber }: {
  data: CostTrend["monthly"];
  currency: string;
  projectedNext: number | null;
  projectedChangePct: number | null;
  tt: (k: string, opts?: object) => string;
  // FU-04: CostTrendChart là component RIÊNG (không gọi useI18n) nên phải nhận
  // formatter từ cha thay vì `.toLocaleString()` theo locale máy người dùng.
  formatNumber: (n: number, opts?: { minimumFractionDigits?: number; maximumFractionDigits?: number }) => string;
}): ReactNode {
  if (!data || data.length === 0) {
    return <ShellEmptyState description={tt("tenantBilling.costTrendEmpty")} />;
  }
  const total = data.reduce((s, m) => s + m.total, 0);
  const avg = data.length > 0 ? total / data.length : 0;
  return (
    <div>
      <div className={ta.bill_3}>
        <span className={ta.bill_4}>{tt("tenantBilling.costTotal")}: <strong className={ta.bill_5}>{formatNumber(total)} {currency}</strong></span>
        <span className={ta.bill_6}>{tt("tenantBilling.costAvg")}: <strong className={ta.bill_7}>{formatNumber(avg)} {currency}</strong></span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} />
          <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
          <Tooltip
            contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
            labelStyle={{ color: "#cbd5e1" }}
          />
          <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      {projectedNext != null && projectedChangePct != null && projectedChangePct > 20 && (
        <div className={ta.bill_8}>
          {tt("tenantBilling.costForecast", { projected: formatNumber(projectedNext as number), pct: projectedChangePct })}
        </div>
      )}
    </div>
  );
}

interface TenantAdminBillingPageProps {
  env?: Record<string, unknown>;
  fetchImpl?: unknown;
  bootstrapLoader?: unknown;
  autoLoad?: boolean;
  initialSnapshot?: Record<string, unknown> | null;
}

export function TenantAdminBillingPage({}: TenantAdminBillingPageProps) {
  const { t, formatCurrency: fmtCurrency, formatDate: fmtDate, formatNumber } = useI18n();
  const { ability } = usePortfolio();
  const toast = useToast();
  const confirm = useConfirm();

  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentMethodLoading, setPaymentMethodLoading] = useState(false);

  const { data, isLoading, error, refetch } = useTenantAdminQuery<{
    subscription: Subscription | null;
    invoices: Invoice[];
    costTrend: CostTrend | null;
  }>(
    ["tenant-billing"],
    "/partner/billing/subscription/",
    {
      queryFn: async () => {
        const adapter = defaultCoreApiAdapter as unknown as {
          coreGet: (u: string) => Promise<any>;
          getCostTrend: (m: number) => Promise<any>;
        };
        const [subData, invData, costData] = await Promise.all([
          adapter.coreGet("/partner/billing/subscription/"),
          adapter.coreGet("/partner/billing/invoices/"),
          adapter.getCostTrend(6).catch(() => null),
        ]);
        const invList = invData?.results || invData?.data || [];
        return {
          subscription: subData,
          invoices: Array.isArray(invList) ? invList : [],
          costTrend: costData,
        };
      },
    },
  );

  const subscription = data?.subscription ?? null;
  const invoices = data?.invoices ?? [];
  const costTrend = data?.costTrend ?? null;

  const handleDownloadInvoice = async (invoiceId: string) => {
    try {
      const response = await defaultCoreApiAdapter.coreGet(`/partner/billing/invoices/${invoiceId}/pdf/`);
      if (response && response.url) {
        window.open(response.url, "_blank");
      } else {
        toast.info(t("tenantBilling.downloadPreparing"));
        window.open(`/partner/billing/invoices/${invoiceId}/pdf/`, "_blank");
      }
    } catch {
      toast.error(t("tenantBilling.downloadError"));
    }
  };

  const canRead = ability?.can?.("read", "TenantBillingView") ?? false;

  if (!canRead) {
    return (
      <ShellPageChrome
        eyebrow={t("tenantBilling.eyebrow")}
        title={t("tenantBilling.title")}
        description={t("tenantBilling.description")}
        notice={t("common.noPermission")}
      >
        <div className={`${styles.panel}`}>
          <ShellEmptyState description={t("tenantBilling.subscriptionEmpty")} />
        </div>
      </ShellPageChrome>
    );
  }

  if (isLoading && !subscription) {
    return (
      <ShellPageChrome
        eyebrow={t("tenantBilling.eyebrow")}
        title={t("tenantBilling.title")}
        description={t("common.loading")}
      >
        <div className={`${styles.panel}`}>{t("common.loading")}</div>
      </ShellPageChrome>
    );
  }

  if (error && !subscription) {
    return (
      <ShellPageChrome
        eyebrow={t("tenantBilling.eyebrow")}
        title={t("tenantBilling.title")}
        description={t("tenantBilling.loadError")}
        error={error?.message || t("tenantBilling.loadError")}
      >
        <div className={`${styles.panel}`}>{error?.message || t("tenantBilling.loadError")}</div>
      </ShellPageChrome>
    );
  }

  const metrics = [
    renderShellMetric(t("tenantBilling.metricPlan"), subscription?.plan_code || t("common.notAvailable")),
    renderShellMetric(t("tenantBilling.metricStatus"), t(`tenantBilling.status.${subscription?.status}`, { defaultValue: subscription?.status || t("common.notAvailable") })),
    renderShellMetric(t("tenantBilling.metricInvoices"), String(invoices.length)),
  ];

  const refreshAction = (
    <button onClick={() => refetch()} className={`${styles.button} ${styles.buttonSecondary}`}>
      {t("tenantBilling.refreshAction")}
    </button>
  );

  return (
    <ShellPageChrome
      eyebrow={t("tenantBilling.eyebrow")}
      title={t("tenantBilling.title")}
      description={t("tenantBilling.description")}
      metrics={metrics}
    >
      <section className={`${styles.stack}`}>
          <ShellPanel title={t("tenantBilling.costTrendTitle")} subtitle={t("tenantBilling.costTrendSubtitle")}>
            <CostTrendChart
              data={costTrend?.monthly || []}
              currency={costTrend?.currency || "VND"}
              projectedNext={costTrend?.projected_next ?? null}
          projectedChangePct={costTrend?.projected_change_pct ?? null}
          tt={t}
          formatNumber={formatNumber}
        />
          </ShellPanel>

          <ShellPanel title={t("tenantBilling.subscriptionTitle")} actions={refreshAction}>
            <div className={`${styles.summaryGrid}`}>
              <FieldCard label={t("tenantBilling.planLabel")} value={subscription?.plan_code || t("common.notAvailable")} />
              <FieldCard
                label={t("tenantBilling.statusLabel")}
                value={t(`tenantBilling.status.${subscription?.status}`, { defaultValue: subscription?.status || t("common.notAvailable") })}
              />
              <FieldCard
                label={t("tenantBilling.billingCycleLabel")}
                value={subscription?.billing_cycle ? t(`tenantBilling.billingCycle.${subscription.billing_cycle}`) : t("common.notAvailable")}
              />
              <FieldCard label={t("tenantBilling.creditBalanceLabel")} value={formatCurrency(subscription?.credit_balance, fmtCurrency, t)} />
              <FieldCard
                label={t("tenantBilling.currentPeriodLabel")}
                value={subscription?.current_period_end
                  ? `${formatDateField(subscription.current_period_start, fmtDate)} - ${formatDateField(subscription.current_period_end, fmtDate)}`
                  : t("common.notAvailable")}
              />
              <FieldCard label={t("tenantBilling.nextInvoiceDateLabel")} value={formatDateField(subscription?.next_invoice_date, fmtDate)} />
              <FieldCard
                label={t("tenantBilling.autoRenewLabel")}
                value={subscription?.auto_renew ? t("tenantBilling.autoRenew.enabled") : t("tenantBilling.autoRenew.disabled")}
              />
              <FieldCard
                label={t("tenantBilling.invoiceStateLabel")}
                value={subscription?.invoice_state === "past_due"
                  ? t("tenantBilling.invoiceState.past_due")
                  : t("tenantBilling.invoiceState.current")}
              />
            </div>
          </ShellPanel>

          <ShellPanel title={t("tenantBilling.paymentMethodTitle")}>
            <div className={`${styles.summaryGrid}`}>
              <FieldCard
                label={t("tenantBilling.currentMethod")}
                value={invoices.find(i => i.payment_method)?.payment_method || t("common.notAvailable")}
              />
              <div className={`${styles.listItem}`}>
                <p className={[`${styles.itemMeta}`, ta.bill_9].filter(Boolean).join(" ")} style={{ fontSize: "11px", color: "#94a3b8", marginBottom: 8 }}>
                  {t("tenantBilling.billingCycleLabel")}
                </p>
                <div className={ta.bill_10}>
                  {subscription?.auto_renew !== undefined && (
                    <span className={`${styles.pill}`} style={{
                      background: subscription.auto_renew ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                      color: subscription.auto_renew ? "#22c55e" : "#ef4444",
                      fontSize: 11,
                    }}>
                      {subscription.auto_renew ? t("tenantBilling.autoRenew.enabled") : t("tenantBilling.autoRenew.disabled")}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowPaymentForm(!showPaymentForm)}
                className={[`${styles.button}`, ta.bill_11].filter(Boolean).join(" ")}
                style={{ fontSize: 12, fontWeight: 600 }}
              >
                {showPaymentForm ? t("common.cancel") : t("tenantBilling.updatePaymentMethod")}
              </button>
            </div>
            {showPaymentForm && (
              <div className={ta.bill_12}>
                <p className={ta.bill_13}>
                  {t("tenantBilling.paymentFormInstruction")}
                </p>
                <button
                  onClick={async () => {
                    const ok = await confirm({
                      title: t("tenantBilling.updatePaymentMethod"),
                      message: t("tenantBilling.paymentFormInstruction"),
                    });
                    if (!ok) return;

                    setPaymentMethodLoading(true);
                    try {
                      const res = await defaultCoreApiAdapter.createStripePortalSession(window.location.href);
                      if (res.url) {
                        window.location.href = res.url;
                      } else {
                        toast.error(t("tenantBilling.paymentUpdateError"));
                      }
                    } catch (err) {
                      toast.error((err as Error).message || t("tenantBilling.paymentUpdateError"));
                    } finally {
                      setPaymentMethodLoading(false);
                    }
                  }}
                  disabled={paymentMethodLoading}
                  className={`${styles.button} ${styles.buttonPrimary}`}
                  style={{ fontWeight: 700 }}
                >
                  {paymentMethodLoading ? t("common.saving") : t("tenantBilling.requestUpdateAction")}
                </button>
              </div>
            )}
          </ShellPanel>

          <ShellPanel title={t("tenantBilling.invoiceTitle")} subtitle={`${invoices.length}`}>
            <div className={[`${styles.list}`, ta.bill_14].filter(Boolean).join(" ")} >
              {invoices.length === 0 ? (
                <ShellEmptyState description={t("tenantBilling.invoiceEmpty")} />
              ) : (
                invoices.map(invoice => (
                  <div
                    key={invoice.id}
                    className={[`${styles.listItem}`, ta.bill_15].filter(Boolean).join(" ")}
                    
                  >
                    <div>
                      <div className={`${styles.itemTitle}`} style={{ fontSize: "14px" }}>{invoice.invoice_number}</div>
                      <div className={`${styles.itemMeta}`} style={{ marginTop: "2px" }}>
                        {t("tenantBilling.issueDateLabel")}: {formatDateField(invoice.issue_date, fmtDate)}
                      </div>
                      <div
                        className={[`${styles.itemMeta}`, ta.bill_16].filter(Boolean).join(" ")}
                        style={{ color: invoice.status === "paid" ? "#22c55e" : "#ff7f50", marginTop: "4px" }}
                      >
                        {invoice.status === "paid" ? t("tenantBilling.paidLabel") : t("tenantBilling.pendingLabel")}
                      </div>
                    </div>
                    <div className={ta.bill_17}>
                      <div className={ta.bill_18}>
                        <span className={`${styles.itemTitle}`} style={{ fontSize: "14px" }}>{formatCurrency(invoice.total_amount, fmtCurrency, t)}</span>
                        <button
                          onClick={() => handleDownloadInvoice(invoice.id)}
                          className={[`${styles.button}`, ta.bill_19].filter(Boolean).join(" ")}
                          style={{ fontSize: 11, padding: "4px 8px", border: "1px solid rgba(0,180,216,0.2)" }}
                          title={t("tenantBilling.downloadInvoice")}
                        >
                          ↓
                        </button>
                      </div>
                      {invoice.payment_method && <span className={`${styles.itemMeta}`} style={{ marginTop: "2px" }}>{invoice.payment_method}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ShellPanel>

          {/* Phase 4 — Upgrade / Plan Comparison */}
          <ShellPanel title={t("tenantBilling.upgradePanelTitle")} subtitle={t("tenantBilling.upgradePanelDesc")}>
            <PlanComparisonTable planCode={subscription?.plan_code || "free"} t={t} />
          </ShellPanel>
          <ShellPanel title={t("tenantBilling.previewPlanTitle")}>
            <PreviewPlanChange planCode={subscription?.plan_code || "free"} t={t} operatorClient={defaultCoreApiAdapter} />
          </ShellPanel>
      </section>
    </ShellPageChrome>
  );
}

function PlanComparisonTable({ planCode, t }: { planCode: string; t: (k: string, o?: object) => string }) {
  const plans = ["free", "basic", "pro", "premium", "enterprise"];
  const rows = [
    { labelKey: "rowApiCalls", valueKey: "valueApiCalls" },
    { labelKey: "rowMembers", valueKey: "valueMembers" },
    { labelKey: "rowServiceAccounts", valueKey: "valueServiceAccounts" },
    { labelKey: "rowWebhooks", valueKey: "valueWebhooks" },
    { labelKey: "rowReports", valueKey: "valueReports" },
    { labelKey: "rowSecurityAudit", valueKey: "valueSecurityAudit" },
    { labelKey: "rowSupport", valueKey: "valueSupport" },
    { labelKey: "rowSLA", valueKey: "valueSLA" },
  ];

  return (
    <div className={ta.bill_20}>
      <table className={ta.bill_21}>
        <thead>
          <tr className={ta.bill_22}>
            <th className={ta.bill_23}>{t("tenantBilling.rowName")}</th>
            {plans.map(p => (
              <th key={p} className={ta.bill_24}>
                {t(`tenantBilling.column${p.charAt(0).toUpperCase() + p.slice(1)}`)}
                {p === planCode && (
                  <span className={ta.bill_25}>
                    {t("tenantBilling.currentPlanBadge")}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.labelKey} className={ta.bill_26}>
              <td className={ta.bill_27}>{t(`tenantBilling.${row.labelKey}`)}</td>
              {plans.map(p => (
                <td key={p} className={ta.bill_28}>
                  {resolvePlanValue(row.valueKey, p, planCode, t)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function resolvePlanValue(valueKey: string, plan: string, _currentPlanCode: string, t: (k: string, o?: object) => string): string {
  const planKey = plan as keyof typeof planValues;
  const values = planValues[planKey] || planValues.free;
  const raw = values[valueKey as keyof typeof values] || "";
  if (typeof raw === "function") return raw(plan, t);
  return raw;
}

const planValues: Record<string, Record<string, string | ((plan: string, t: (k: string, o?: object) => string) => string)>> = {
  free: {
    valueApiCalls: "1.000",
    valueMembers: "5",
    valueServiceAccounts: "1",
    valueWebhooks: "1",
    valueReports: "\u2014",
    valueSecurityAudit: "\u2014",
    valueSupport: "Email",
    valueSLA: "\u2014",
  },
  basic: {
    valueApiCalls: "10.000",
    valueMembers: "10",
    valueServiceAccounts: "3",
    valueWebhooks: "3",
    valueReports: "\u2014",
    valueSecurityAudit: "\u2014",
    valueSupport: "Email",
    valueSLA: "\u2014",
  },
  pro: {
    valueApiCalls: "50.000",
    valueMembers: "25",
    valueServiceAccounts: "10",
    valueWebhooks: "10",
    valueReports: "\u2713",
    valueSecurityAudit: "\u2713",
    valueSupport: "Email + Chat",
    valueSLA: "99.9%",
  },
  premium: {
    valueApiCalls: "100.000",
    valueMembers: "50",
    valueServiceAccounts: (_p: string, t: (k: string, o?: object) => string) => t("tenantHome.unlimited"),
    valueWebhooks: (_p: string, t: (k: string, o?: object) => string) => t("tenantHome.unlimited"),
    valueReports: "\u2713",
    valueSecurityAudit: "\u2713",
    valueSupport: "Email + Chat",
    valueSLA: "99.95%",
  },
  enterprise: {
    valueApiCalls: (_p: string, t: (k: string, o?: object) => string) => t("tenantHome.unlimited"),
    valueMembers: (_p: string, t: (k: string, o?: object) => string) => t("tenantHome.unlimited"),
    valueServiceAccounts: (_p: string, t: (k: string, o?: object) => string) => t("tenantHome.unlimited"),
    valueWebhooks: (_p: string, t: (k: string, o?: object) => string) => t("tenantHome.unlimited"),
    valueReports: "\u2713",
    valueSecurityAudit: "\u2713",
    valueSupport: "Priority 24/7",
    valueSLA: "99.99%",
  },
};

function PreviewPlanChange({ planCode, t, operatorClient }: { planCode: string; t: (k: string, o?: object) => string; operatorClient: { previewPlanChange: (code: string) => Promise<any>; createStripeCheckoutSession: (plan: string, success: string, cancel: string) => Promise<any> } }) {
  const confirm = useConfirm();
  const [targetPlan, setTargetPlan] = useState(planCode === "enterprise" ? "enterprise" : "pro");
  const [previewResult, setPreviewResult] = useState<Record<string, unknown> | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const handlePreview = async () => {
    if (targetPlan === planCode) return;
    try {
      setPreviewLoading(true);
      setPreviewError("");
      const result = await operatorClient.previewPlanChange(targetPlan);
      setPreviewResult(result);
    } catch {
      setPreviewError(t("tenantBilling.previewLoadError"));
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleUpgrade = async () => {
    const ok = await confirm({
      title: t("tenantBilling.upgradeAction"),
      message: `${t("tenantBilling.upgradePanelDesc")} (${t(`tenantBilling.column${targetPlan.charAt(0).toUpperCase() + targetPlan.slice(1)}`)})?`,
    });
    if (!ok) return;

    try {
      setPreviewLoading(true);
      const res = await operatorClient.createStripeCheckoutSession(
        targetPlan,
        window.location.origin + "/tenant-admin/billing?upgrade=success",
        window.location.origin + "/tenant-admin/billing?upgrade=cancel"
      );
      if (res.url) {
        window.location.href = res.url;
      } else {
        setPreviewError(t("tenantBilling.previewLoadError"));
      }
    } catch {
      setPreviewError(t("tenantBilling.previewLoadError"));
    } finally {
      setPreviewLoading(false);
    }
  };

  const plans = ["free", "basic", "pro", "premium", "enterprise"].filter(p => p !== planCode);

  return (
    <div>
      <div className={ta.bill_29}>
        <div className={["fieldGroup", ta.bill_30].filter(Boolean).join(" ")} >
          <label className="fieldLabel">{t("tenantBilling.previewTargetPlan")}</label>
          <select
            className={`${styles.input}`}
            value={targetPlan}
            onChange={e => { setTargetPlan(e.target.value); setPreviewResult(null); }}
          >
            {plans.map(p => (
              <option key={p} value={p}>
                {t(`tenantBilling.column${p.charAt(0).toUpperCase() + p.slice(1)}`)}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handlePreview}
          disabled={previewLoading}
          className={`${styles.button} ${styles.buttonPrimary}`}
          style={{ fontSize: 13, fontWeight: 700 }}
        >
          {t("tenantBilling.previewButton")}
        </button>
      </div>

      {previewError && <div className={ta.bill_31}>{previewError}</div>}

      {previewResult && (
        <div className={ta.bill_32}>
          <div className={ta.bill_33}>
            <div><strong className={ta.bill_34}>{t("tenantBilling.previewCurrentPlan")}:</strong> <span className={ta.bill_35}>{planCode}</span></div>
            <div><strong className={ta.bill_36}>{t("tenantBilling.previewTargetPlan")}:</strong> <span className={ta.bill_37}>{targetPlan}</span></div>
          </div>
          <div className={ta.bill_38}>
            <button
              onClick={handleUpgrade}
              className={`${styles.button} ${styles.buttonPrimary}`}
              style={{ fontSize: 13, fontWeight: 700 }}
            >
              {t("tenantBilling.upgradeAction")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
