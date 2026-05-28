import React, { useEffect, useState } from "react";
import { coreApiAdapter } from "../../adapters/coreApiAdapter.js";

const e = React.createElement;

function useI18n() {
  return {
    t: (key, options) => {
      const map = {
        'commercial.billingCenter.title': 'Trung tâm Thanh toán (Billing Center)',
        'commercial.billingCenter.titleShort': 'Trung tâm Thanh toán',
        'commercial.billingCenter.loading': 'Đang tải dữ liệu...',
        'commercial.billingCenter.errorFetch': 'Không thể tải một số dữ liệu thanh toán. Vui lòng thử lại sau.',
        'commercial.billingCenter.errorGeneric': 'Đã xảy ra lỗi khi tải dữ liệu thanh toán.',
        'commercial.billingCenter.errorTitle': 'Lỗi',
        'commercial.billingCenter.upgradeTitle': 'Nâng cấp / Thanh toán',
        'commercial.billingCenter.currentPlanTitle': 'Gói cước hiện tại',
        'commercial.billingCenter.planLabel': 'Gói: ',
        'commercial.billingCenter.planDefault': 'Mặc định',
        'commercial.billingCenter.statusLabel': 'Trạng thái: ',
        'commercial.billingCenter.statusActive': 'Hoạt động',
        'commercial.billingCenter.renewalDateLabel': 'Ngày gia hạn: ',
        'commercial.billingCenter.noPlan': 'Bạn chưa đăng ký gói cước nào.',
        'commercial.billingCenter.quotaTitle': 'Hạn mức sử dụng (Quota)',
        'commercial.billingCenter.quotaUnlimited': 'Không giới hạn',
        'commercial.billingCenter.noQuota': 'Không có thông tin hạn mức.',
        'commercial.billingCenter.invoiceTitle': 'Lịch sử hóa đơn',
        'commercial.billingCenter.invoiceId': 'Mã HĐ',
        'commercial.billingCenter.invoiceDate': 'Ngày',
        'commercial.billingCenter.invoiceAmount': 'Số tiền',
        'commercial.billingCenter.invoiceStatus': 'Trạng thái',
        'commercial.billingCenter.noInvoices': 'Chưa có hóa đơn nào.',
        'commercial.billingCenter.form.planLabel': 'Gói cước: ',
        'commercial.billingCenter.form.amountLabel': 'Số tiền (VND): ',
        'commercial.billingCenter.form.submitProcessing': 'Đang xử lý...',
        'commercial.billingCenter.form.submitButton': 'Thanh toán ngay',
        'commercial.billingCenter.form.errorNoUrl': 'Không nhận được URL thanh toán từ máy chủ.',
        'commercial.billingCenter.form.errorInit': 'Lỗi khi khởi tạo thanh toán.',
      };
      return map[key] || options?.defaultValue || key;
    },
    language: 'vi',
  };
}

export function BillingCenterPage() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [quota, setQuota] = useState([]);
  const [invoices, setInvoices] = useState([]);

  useEffect(() => {
    async function loadBillingData() {
      try {
        setLoading(true);
        setError(null);
        
        const [subRes, quotaRes, invRes] = await Promise.all([
          coreApiAdapter.getBillingSubscription().catch(err => ({ error: err })),
          coreApiAdapter.getBillingQuota().catch(err => ({ error: err })),
          coreApiAdapter.getBillingInvoices({ page: 1, page_size: 10 }).catch(err => ({ error: err }))
        ]);

        if (subRes.error || quotaRes.error || invRes.error) {
          throw new Error(t('commercial.billingCenter.errorFetch'));
        }

        setSubscription(subRes);
        setQuota(quotaRes.results || quotaRes);
        setInvoices(invRes.results || []);
      } catch (err) {
        setError(err.message || t('commercial.billingCenter.errorGeneric'));
      } finally {
        setLoading(false);
      }
    }

    loadBillingData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return e("div", { className: "shellPage" },
      e("header", { className: "shellPage__header" },
        e("h1", { className: "shellPage__title" }, t('commercial.billingCenter.title'))
      ),
      e("main", { className: "shellPage__content" },
        e("p", { "aria-live": "polite" }, t('commercial.billingCenter.loading'))
      )
    );
  }

  if (error) {
    return e("div", { className: "shellPage" },
      e("header", { className: "shellPage__header" },
        e("h1", { className: "shellPage__title" }, t('commercial.billingCenter.titleShort'))
      ),
      e("main", { className: "shellPage__content" },
        e("div", { className: "shellPage__panel", role: "alert" },
          e("h2", { className: "shellPage__panelTitle" }, t('commercial.billingCenter.errorTitle')),
          e("p", { className: "shellPage__panelSubtitle" }, error)
        )
      )
    );
  }

  return e("div", { className: "shellPage" },
    e("header", { className: "shellPage__header" },
      e("h1", { className: "shellPage__title" }, t('commercial.billingCenter.titleShort'))
    ),
    e("main", { className: "shellPage__content" },
      e("section", { className: "shellPage__panel" },
        e("h2", { className: "shellPage__panelTitle" }, t('commercial.billingCenter.upgradeTitle')),
        e(PaymentCreateForm, { t })
      ),
      e("section", { className: "shellPage__panel" },
        e("h2", { className: "shellPage__panelTitle" }, t('commercial.billingCenter.currentPlanTitle')),
        subscription ? e("div", null,
          e("p", null, e("strong", null, t('commercial.billingCenter.planLabel')), subscription.plan_name || t('commercial.billingCenter.planDefault')),
          e("p", null, e("strong", null, t('commercial.billingCenter.statusLabel')), subscription.status || t('commercial.billingCenter.statusActive')),
          subscription.next_billing_date ? e("p", null, e("strong", null, t('commercial.billingCenter.renewalDateLabel')), subscription.next_billing_date) : null
        ) : e("p", null, t('commercial.billingCenter.noPlan'))
      ),
      e("section", { className: "shellPage__panel" },
        e("h2", { className: "shellPage__panelTitle" }, t('commercial.billingCenter.quotaTitle')),
        (quota && quota.length > 0) ? e("ul", null,
          quota.map((q, idx) => e("li", { key: idx }, `${q.feature_name}: ${q.used} / ${q.limit || t('commercial.billingCenter.quotaUnlimited')}`))
        ) : e("p", null, t('commercial.billingCenter.noQuota'))
      ),
      e("section", { className: "shellPage__panel" },
        e("h2", { className: "shellPage__panelTitle" }, t('commercial.billingCenter.invoiceTitle')),
        (invoices && invoices.length > 0) ? e("table", { style: { width: "100%", textAlign: "left" } },
          e("thead", null,
            e("tr", null,
              e("th", null, t('commercial.billingCenter.invoiceId')),
              e("th", null, t('commercial.billingCenter.invoiceDate')),
              e("th", null, t('commercial.billingCenter.invoiceAmount')),
              e("th", null, t('commercial.billingCenter.invoiceStatus'))
            )
          ),
          e("tbody", null,
            invoices.map((inv, idx) => e("tr", { key: idx },
              e("td", null, inv.invoice_id),
              e("td", null, inv.created_at),
              e("td", null, inv.amount),
              e("td", null, inv.status)
            ))
          )
        ) : e("p", null, t('commercial.billingCenter.noInvoices'))
      )
    )
  );
}

function PaymentCreateForm({ t }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  
  const [amount, setAmount] = useState(100000);
  const [plan, setPlan] = useState("VIP_1M");

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (submitting) return;

    try {
      setSubmitting(true);
      setError(null);
      
      const payload = { amount, plan };
      const response = await coreApiAdapter.createPayment(payload);
      
      if (response && response.pay_url) {
        window.location.href = response.pay_url;
      } else {
        throw new Error(t('commercial.billingCenter.form.errorNoUrl'));
      }
    } catch (err) {
      setError(err.message || t('commercial.billingCenter.form.errorInit'));
      setSubmitting(false); // Only re-enable on error, if success it redirects
    }
  };

  return e("form", { onSubmit: handleSubmit, style: { display: "flex", flexDirection: "column", gap: "1rem", maxWidth: "400px" } },
    error ? e("div", { style: { color: "red" } }, error) : null,
    e("div", null,
      e("label", null, t('commercial.billingCenter.form.planLabel')),
      e("select", { value: plan, onChange: (ev) => setPlan(ev.target.value), disabled: submitting },
        e("option", { value: "VIP_1M" }, "VIP 1 Tháng"),
        e("option", { value: "VIP_6M" }, "VIP 6 Tháng"),
        e("option", { value: "VIP_12M" }, "VIP 12 Tháng")
      )
    ),
    e("div", null,
      e("label", null, t('commercial.billingCenter.form.amountLabel')),
      e("input", { 
        type: "number", 
        value: amount, 
        onChange: (ev) => setAmount(Number(ev.target.value)),
        disabled: submitting 
      })
    ),
    e("button", { 
      type: "submit", 
      disabled: submitting,
      style: { padding: "0.5rem", backgroundColor: "#007BFF", color: "white", border: "none", cursor: submitting ? "not-allowed" : "pointer" }
    }, submitting ? t('commercial.billingCenter.form.submitProcessing') : t('commercial.billingCenter.form.submitButton'))
  );
}
