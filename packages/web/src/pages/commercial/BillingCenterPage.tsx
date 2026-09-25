import styles from "../../components/ShellPageTemplate.module.css";
import { useEffect, useState } from "react";
import { coreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { ShellPageChrome, ShellPanel, ShellField } from "../../components/ShellPageTemplate.js";
import { useI18n } from "../../context/LangContext.js";
import { PLAN_OPTIONS, VIP_TO_CANONICAL, type VipPlan } from "../../constants/planCatalog.js";
const BILLING_CUSTOM_STYLES = `
.billing-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
  gap: var(--sp-6);
  margin-top: 12px;
}

@media (max-width: 1024px) {
  .billing-grid {
    grid-template-columns: 1fr;
  }
}

.plan-card-container {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--sp-4);
  margin-bottom: 24px;
}

@media (max-width: 640px) {
  .plan-card-container {
    grid-template-columns: 1fr;
  }
}

.plan-card {
  border: 1.5px solid var(--border-shell);
  background: rgba(var(--sh-rgb-0f172a) / 0.45);
  border-radius: var(--r-lg, 12px);
  padding: var(--sp-6) var(--sp-4);
  cursor: pointer;
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-shadow: 0 4px 12px rgba(var(--sh-rgb-000000) / 0.2);
}

.plan-card:hover {
  transform: translateY(-3px);
  border-color: var(--accent-shell);
  background: rgba(var(--sh-rgb-0f172a) / 0.7);
  box-shadow: 0 12px 28px rgba(var(--sh-rgb-000000) / 0.4);
}

.plan-card.active {
  border-color: var(--accent-shell);
  background: linear-gradient(145deg, rgba(var(--sh-rgb-00b4d8) / 0.15) 0%, rgba(var(--sh-rgb-0f172a) / / 0.8) 100%);
  box-shadow: 0 16px 32px rgba(var(--sh-rgb-00b4d8) / 0.15);
}

.plan-card.active::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, var(--accent-shell), var(--sh-c-0077b6));
}

.plan-card__badge {
  position: absolute;
  top: 12px;
  right: 12px;
  background: linear-gradient(135deg, var(--accent-signal) 0%, var(--sh-c-ffb347) 100%);
  color: white;
  font-size: var(--fs-2xs);
  font-weight: 800;
  padding: var(--sp-1) var(--sp-2);
  border-radius: var(--r-pill);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  box-shadow: 0 4px 10px rgba(var(--sh-rgb-ff7f50) / 0.2);
}

.plan-card__title {
  font-size: var(--fs-md);
  font-weight: 800;
  color: var(--text-primary);
  margin: 0 0 var(--sp-2) 0;
}

.plan-card__desc {
  font-size: var(--fs-xs);
  color: var(--text-secondary);
  margin: 0 0 var(--sp-4) 0;
  line-height: 1.4;
}

.plan-card__price-box {
  margin-top: auto;
}

.plan-card__price {
  font-size: var(--fs-2xl);
  font-weight: 900;
  color: var(--accent-shell);
  line-height: 1;
}

.plan-card__period {
  font-size: var(--fs-2xs);
  color: var(--text-secondary);
  font-weight: 600;
  margin-left: 2px;
}

.plan-card__savings {
  font-size: var(--fs-2xs);
  color: var(--accent-signal);
  font-weight: 700;
  margin-top: 6px;
  display: block;
}

.quota-bar-container {
  display: grid;
  gap: var(--sp-4);
}

.quota-item {
  background: rgba(var(--sh-rgb-0f172a) / 0.35);
  border: 1px solid var(--border-shell);
  border-radius: var(--r-lg, 12px);
  padding: var(--sp-3) var(--sp-4);
}

.quota-item__info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--text-primary);
}

.quota-item__name {
  color: var(--text-primary);
}

.quota-item__stat {
  color: var(--text-secondary);
}

.quota-item__bar-bg {
  height: 8px;
  background: rgba(var(--sh-rgb-ffffff) / 0.08);
  border-radius: var(--r-pill);
  overflow: hidden;
  position: relative;
}

.quota-item__bar-fill {
  height: 100%;
  border-radius: var(--r-pill);
  transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

.current-plan-banner {
  background: linear-gradient(135deg, rgba(var(--sh-rgb-00b4d8) / 0.12) 0%, rgba(var(--sh-rgb-00b4d8) / 0.06) 100%);
  border: 1.5px dashed var(--accent-shell);
  border-radius: var(--r-lg, 12px);
  padding: var(--sp-5);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--sp-4);
}

.current-plan-banner__info {
  display: grid;
  gap: var(--sp-2);
}

.current-plan-banner__plan {
  font-size: var(--fs-xl);
  font-weight: 800;
  color: var(--accent-shell);
}

.current-plan-banner__status {
  font-size: var(--fs-xs);
  color: var(--text-secondary);
}

.invoice-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  text-align: left;
}

.invoice-table th {
  padding: var(--sp-3) var(--sp-4);
  font-size: var(--fs-xs);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-shell);
  font-weight: 700;
}

.invoice-table td {
  padding: var(--sp-3) var(--sp-4);
  font-size: var(--fs-sm);
  border-bottom: 1px solid var(--border-shell);
  color: var(--text-primary);
}

.invoice-table tr:last-child td {
  border-bottom: 0;
}

.invoice-status-pill {
  display: inline-flex;
  align-items: center;
  padding: var(--sp-1) var(--sp-2);
  border-radius: var(--r-pill);
  font-size: var(--fs-2xs);
  font-weight: 700;
  text-transform: uppercase;
}

  .invoice-status-pill--completed {
  background: color-mix(in srgb, var(--accent-emerald) 15%, transparent);
  color: var(--accent-emerald);
  }

  .invoice-status-pill--pending {
  background: color-mix(in srgb, var(--accent-amber) 15%, transparent);
  color: var(--accent-amber);
  }

  .invoice-status-pill--failed {
  background: color-mix(in srgb, var(--accent-rose) 15%, transparent);
  color: var(--accent-rose);
  }

.billing-submit-btn {
  margin-top: 14px;
  width: 100%;
  padding: var(--sp-3);
  border-radius: var(--r-lg, 12px);
  font-size: var(--fs-md);
  font-weight: 800;
  color: white;
  border: none;
  cursor: pointer;
  background: linear-gradient(135deg, var(--accent-shell) 0%, var(--sh-c-0077b6) 100%);
  box-shadow: 0 8px 24px rgba(var(--sh-rgb-00b4d8) / 0.25);
  transition: all 0.3s ease;
  display: flex;
  justify-content: center;
  align-items: center;
}

.billing-submit-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 28px rgba(var(--sh-rgb-00b4d8) / 0.35);
}

.billing-submit-btn:disabled {
  opacity: 0.75;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}
`;

interface SubscriptionData {
  plan_name?: string;
  status?: string;
  next_billing_date?: string;
  [key: string]: unknown;
}

interface QuotaItem {
  used?: number;
  limit?: number;
  feature_name?: string;
  [key: string]: unknown;
}

interface InvoiceItem {
  invoice_id?: string;
  created_at?: string;
  amount?: number;
  status?: string;
  [key: string]: unknown;
}

interface PlanOption {
  id: string;
  title: string;
  desc: string;
  price: number;
  period: string;
  savings: string | null;
  badge: string | null;
}

const billingApi = coreApiAdapter as unknown as {
  getBillingSubscription: () => Promise<SubscriptionData>;
  getBillingQuota: () => Promise<{ results?: QuotaItem[] } | QuotaItem[]>;
  getBillingInvoices: (params: { page: number; page_size: number }) => Promise<{ results?: InvoiceItem[] }>;
  createPayment: (data: { amount: number; plan: string }) => Promise<{ pay_url?: string }>;
};

export function BillingCenterPage() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [quota, setQuota] = useState<QuotaItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);

  useEffect(() => {
    async function loadBillingData() {
      try {
        setLoading(true);
        setError(null);

        const [subResult, quotaResult, invoiceResult] = await Promise.allSettled([
          billingApi.getBillingSubscription(),
          billingApi.getBillingQuota(),
          billingApi.getBillingInvoices({ page: 1, page_size: 10 }),
        ]);

        const hasSubscription = subResult.status === 'fulfilled';
        const hasQuota = quotaResult.status === 'fulfilled';
        const hasInvoices = invoiceResult.status === 'fulfilled';

        setSubscription(hasSubscription ? (subResult as PromiseFulfilledResult<SubscriptionData>).value : null);
        setQuota(hasQuota ? ((quotaResult as PromiseFulfilledResult<{ results?: QuotaItem[] }>).value.results || (quotaResult as PromiseFulfilledResult<QuotaItem[]>).value || []) : []);
        setInvoices(hasInvoices ? ((invoiceResult as PromiseFulfilledResult<{ results?: InvoiceItem[] }>).value.results || []) : []);

        if (!hasSubscription && !hasQuota && !hasInvoices) {
          throw new Error(t('commercial.billingCenter.errorFetch'));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t('commercial.billingCenter.errorGeneric'));
      } finally {
        setLoading(false);
      }
    }

    loadBillingData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <ShellPageChrome
        title={t('commercial.billingCenter.titleShort')}
        description={t('commercial.billingCenter.loading')}
      >
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>
          {t('commercial.billingCenter.loading')}
        </div>
      </ShellPageChrome>
    );
  }

  return (
    <ShellPageChrome
      eyebrow="SaaS Commerce System"
      title={t('commercial.billingCenter.titleShort')}
      description={t('commercial.billingCenter.description')}
      error={error || undefined}
    >
      <style>{BILLING_CUSTOM_STYLES}</style>
      <div className="billing-grid">
        {/* Cột trái: Form chọn gói & Nâng cấp */}
        <div className={`${styles.stack}`}>
          <ShellPanel
            title={t('commercial.billingCenter.upgradeTitle')}
            subtitle={t('commercial.billingCenter.upgradeSubtitle')}
          >
            <PaymentCreateForm t={t} />
          </ShellPanel>

          <ShellPanel
            title={t('commercial.billingCenter.invoiceTitle')}
            subtitle={t('commercial.billingCenter.invoiceSubtitle')}
          >
            {invoices && invoices.length > 0 ? (
              <div style={{ overflowX: "auto" }}>
                <table className="invoice-table">
                  <thead>
                    <tr>
                      <th>{t('commercial.billingCenter.invoiceId')}</th>
                      <th>{t('commercial.billingCenter.invoiceDate')}</th>
                      <th>{t('commercial.billingCenter.invoiceAmount')}</th>
                      <th>{t('commercial.billingCenter.invoiceStatus')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv, idx) => {
                      const isCompleted = String(inv.status).toLowerCase() === 'completed';
                      const isPending = String(inv.status).toLowerCase() === 'pending';
                      const statusClass = isCompleted
                        ? "invoice-status-pill--completed"
                        : isPending ? "invoice-status-pill--pending" : "invoice-status-pill--failed";
                      const statusLabel = isCompleted
                        ? t('commercial.billingCenter.invoiceStatusSuccess')
                        : isPending ? t('commercial.billingCenter.invoiceStatusPending') : t('commercial.billingCenter.invoiceStatusFailed');

                      return (
                        <tr key={idx}>
                          <td><code>{inv.invoice_id}</code></td>
                          <td>{inv.created_at ? new Date(inv.created_at).toLocaleDateString('vi-VN') : '-'}</td>
                          <td style={{ fontWeight: "700" }}>{`${Number(inv.amount || 0).toLocaleString('vi-VN')} đ`}</td>
                          <td>
                            <span className={`invoice-status-pill ${statusClass}`}>{statusLabel}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className={`${styles.empty}`}>{t('commercial.billingCenter.noInvoices')}</div>
            )}
          </ShellPanel>
        </div>

        {/* Cột phải: Thông tin gói hiện tại & Quota */}
        <div className={`${styles.stack}`}>
          <ShellPanel title={t('commercial.billingCenter.currentPlanTitle')}>
            {subscription ? (
              <div className="current-plan-banner">
                <div className="current-plan-banner__info">
                  <span className="current-plan-banner__plan">{subscription.plan_name || t('commercial.billingCenter.planDefault')}</span>
                  <span className="current-plan-banner__status">{`${t('commercial.billingCenter.statusLabel')} ${subscription.status || t('commercial.billingCenter.statusActive')}`}</span>
                </div>
                {subscription.next_billing_date ? (
                  <div className={`${styles.pill}`}>
                    {`${t('commercial.billingCenter.renewalDateLabel')} ${subscription.next_billing_date}`}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="current-plan-banner">
                <div className="current-plan-banner__info">
                  <span className="current-plan-banner__plan" style={{ color: "var(--text-secondary)" }}>{t('commercial.billingCenter.planDefault')}</span>
                  <span className="current-plan-banner__status">{t('commercial.billingCenter.noPlan')}</span>
                </div>
              </div>
            )}
          </ShellPanel>

          <ShellPanel
            title={t('commercial.billingCenter.quotaTitle')}
            subtitle={t('commercial.billingCenter.quotaSubtitle')}
          >
            {quota && quota.length > 0 ? (
              <div className="quota-bar-container">
                {quota.map((q, idx) => {
                  const used = Number(q.used || 0);
                  const limit = Number(q.limit || 0);
                  const isUnlimited = limit <= 0;
                  const percent = isUnlimited ? 0 : Math.min((used / limit) * 100, 100);

                  let barColor = "linear-gradient(90deg, var(--accent-emerald), color-mix(in srgb, var(--accent-emerald) 55%, white))";
                  if (percent >= 90) {
                    barColor = "linear-gradient(90deg, var(--accent-rose), color-mix(in srgb, var(--accent-rose) 55%, white))";
                  } else if (percent >= 70) {
                    barColor = "linear-gradient(90deg, var(--accent-amber), color-mix(in srgb, var(--accent-amber) 55%, white))";
                  }

                  return (
                    <div className="quota-item" key={idx}>
                      <div className="quota-item__info">
                        <span className="quota-item__name">{q.feature_name}</span>
                        <span className="quota-item__stat">
                          {isUnlimited
                            ? `${used} / ${t('commercial.billingCenter.quotaUnlimited')}`
                            : `${used} / ${limit} (${percent.toFixed(0)}%)`}
                        </span>
                      </div>
                      {!isUnlimited ? (
                        <div className="quota-item__bar-bg">
                          <div className="quota-item__bar-fill" style={{ width: `${percent}%`, background: barColor }} />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={`${styles.empty}`}>{t('commercial.billingCenter.noQuota')}</div>
            )}
          </ShellPanel>
        </div>
      </div>
    </ShellPageChrome>
  );
}

function PaymentCreateForm({ t }: { t: (key: string, options?: { defaultValue?: string }) => string }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [amount, setAmount] = useState(100000);
  const [activePlan, setActivePlan] = useState<VipPlan>("VIP_1M");

  const plans: PlanOption[] = PLAN_OPTIONS;

  const handlePlanSelect = (planId: string, price: number) => {
    if (submitting) return;
    setActivePlan(planId as VipPlan);
    setAmount(price);
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (submitting) return;

    try {
      setSubmitting(true);
      setError(null);

      const payload = { amount, plan: VIP_TO_CANONICAL[activePlan] ?? activePlan };
      const response = await billingApi.createPayment(payload);

      if (response && response.pay_url) {
        window.location.href = response.pay_url;
      } else {
        throw new Error(t('commercial.billingCenter.form.errorNoUrl'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('commercial.billingCenter.form.errorInit'));
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`${styles.form}`}>
      {error ? (
        <div className={`${styles.banner} ${styles.bannerError}`} style={{ margin: 0 }}>{error}</div>
      ) : null}

      <span className={`${styles.fieldLabel}`}>{t('commercial.billingCenter.form.planLabel')}</span>

      {/* Giao diện chọn Gói bằng Thẻ (Plan Cards Selector) */}
      <div className="plan-card-container">
        {plans.map((p) => {
          const isActive = activePlan === p.id;
          return (
            <div
              key={p.id}
              className={`plan-card ${isActive ? "active" : ""}`}
              onClick={() => handlePlanSelect(p.id, p.price)}
            >
              {p.badge ? <span className="plan-card__badge">{p.badge}</span> : null}
              <div>
                <h3 className="plan-card__title">{p.title}</h3>
                <p className="plan-card__desc">{p.desc}</p>
              </div>
              <div className="plan-card__price-box">
                <span className="plan-card__price">{`${Number(p.price).toLocaleString('vi-VN')}đ`}</span>
                <span className="plan-card__period">{` / ${p.period}`}</span>
                {p.savings ? <span className="plan-card__savings">{p.savings}</span> : null}
              </div>
            </div>
          );
        })}
      </div>

      <ShellField
        label={t('commercial.billingCenter.form.amountLabel')}
        name="amount"
        fieldKey=""
        type="number"
        value={amount}
        onChange={(ev: React.ChangeEvent<HTMLInputElement>) => {
          if (!submitting) setAmount(Number(ev.target.value));
        }}
        disabled={true}
      />

      <button
        type="submit"
        disabled={submitting}
        className="billing-submit-btn"
      >
        {submitting ? t('commercial.billingCenter.form.submitProcessing') : t('commercial.billingCenter.form.submitButton')}
      </button>
    </form>
  );
}
