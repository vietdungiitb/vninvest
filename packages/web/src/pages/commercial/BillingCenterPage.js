import React, { useEffect, useState } from "react";
import { coreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { ShellPageChrome, ShellPanel, ShellField } from "../../components/ShellPageTemplate.js";

const e = React.createElement;

function useI18n() {
  return {
    t: (key, options) => {
      const map = {
        'commercial.billingCenter.title': 'Trung tâm Thanh toán (Billing Center)',
        'commercial.billingCenter.titleShort': 'Trung tâm Thanh toán',
        'commercial.billingCenter.loading': 'Đang tải dữ liệu thanh toán...',
        'commercial.billingCenter.errorFetch': 'Không thể tải một số dữ liệu thanh toán. Vui lòng thử lại sau.',
        'commercial.billingCenter.errorGeneric': 'Đã xảy ra lỗi khi tải dữ liệu thanh toán.',
        'commercial.billingCenter.errorTitle': 'Lỗi',
        'commercial.billingCenter.upgradeTitle': 'Nâng cấp gói thành viên VIP',
        'commercial.billingCenter.currentPlanTitle': 'Gói dịch vụ hiện tại',
        'commercial.billingCenter.planLabel': 'Gói dịch vụ: ',
        'commercial.billingCenter.planDefault': 'Mặc định (Miễn phí)',
        'commercial.billingCenter.statusLabel': 'Trạng thái: ',
        'commercial.billingCenter.statusActive': 'Đang hoạt động',
        'commercial.billingCenter.renewalDateLabel': 'Ngày gia hạn: ',
        'commercial.billingCenter.noPlan': 'Bạn chưa đăng ký gói cước VIP nào. Hãy chọn gói bên dưới để nâng cấp trải nghiệm.',
        'commercial.billingCenter.quotaTitle': 'Hạn mức tài nguyên & Tính năng (Quota)',
        'commercial.billingCenter.quotaUnlimited': 'Không giới hạn',
        'commercial.billingCenter.noQuota': 'Không có thông tin hạn mức tài nguyên.',
        'commercial.billingCenter.invoiceTitle': 'Lịch sử giao dịch & Hóa đơn',
        'commercial.billingCenter.invoiceId': 'Mã Hóa đơn',
        'commercial.billingCenter.invoiceDate': 'Ngày tạo',
        'commercial.billingCenter.invoiceAmount': 'Số tiền',
        'commercial.billingCenter.invoiceStatus': 'Trạng thái',
        'commercial.billingCenter.noInvoices': 'Chưa có lịch sử giao dịch nào được ghi nhận.',
        'commercial.billingCenter.form.planLabel': 'Chọn gói cước VIP:',
        'commercial.billingCenter.form.amountLabel': 'Số tiền thanh toán (VND): ',
        'commercial.billingCenter.form.submitProcessing': 'Đang kết nối cổng thanh toán...',
        'commercial.billingCenter.form.submitButton': 'Thanh toán an toàn ngay',
        'commercial.billingCenter.form.errorNoUrl': 'Không nhận được URL thanh toán từ máy chủ.',
        'commercial.billingCenter.form.errorInit': 'Lỗi khi khởi tạo thanh toán.',
      };
      return map[key] || options?.defaultValue || key;
    },
    language: 'vi',
  };
}

const BILLING_CUSTOM_STYLES = `
.billing-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
  gap: 24px;
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
  gap: 16px;
  margin-bottom: 24px;
}

@media (max-width: 640px) {
  .plan-card-container {
    grid-template-columns: 1fr;
  }
}

.plan-card {
  border: 1.5px solid var(--shell-border);
  background: rgba(15, 23, 42, 0.45);
  border-radius: 20px;
  padding: 22px 18px;
  cursor: pointer;
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.plan-card:hover {
  transform: translateY(-3px);
  border-color: var(--shell-accent);
  background: rgba(15, 23, 42, 0.7);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.4);
}

.plan-card.active {
  border-color: var(--shell-accent);
  background: linear-gradient(145deg, rgba(0, 180, 216, 0.15) 0%, rgba(15, 23, 42, 0.8) 100%);
  box-shadow: 0 16px 32px rgba(0, 180, 216, 0.15);
}

.plan-card.active::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #00b4d8, #0077b6);
}

.plan-card__badge {
  position: absolute;
  top: 12px;
  right: 12px;
  background: linear-gradient(135deg, #ff7f50 0%, #ffb347 100%);
  color: white;
  font-size: 9px;
  font-weight: 800;
  padding: 4px 8px;
  border-radius: 99px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  box-shadow: 0 4px 10px rgba(255, 127, 80, 0.2);
}

.plan-card__title {
  font-size: 15px;
  font-weight: 800;
  color: var(--shell-ink);
  margin: 0 0 6px 0;
}

.plan-card__desc {
  font-size: 12px;
  color: var(--shell-muted);
  margin: 0 0 16px 0;
  line-height: 1.4;
}

.plan-card__price-box {
  margin-top: auto;
}

.plan-card__price {
  font-size: 24px;
  font-weight: 900;
  color: var(--shell-accent);
  line-height: 1;
}

.plan-card__period {
  font-size: 11px;
  color: var(--shell-muted);
  font-weight: 600;
  margin-left: 2px;
}

.plan-card__savings {
  font-size: 11px;
  color: var(--shell-signal);
  font-weight: 700;
  margin-top: 6px;
  display: block;
}

.quota-bar-container {
  display: grid;
  gap: 18px;
}

.quota-item {
  background: rgba(15, 23, 42, 0.35);
  border: 1px solid var(--shell-border);
  border-radius: 16px;
  padding: 14px 16px;
}

.quota-item__info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--shell-ink);
}

.quota-item__name {
  color: var(--shell-ink);
}

.quota-item__stat {
  color: var(--shell-muted);
}

.quota-item__bar-bg {
  height: 8px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 99px;
  overflow: hidden;
  position: relative;
}

.quota-item__bar-fill {
  height: 100%;
  border-radius: 99px;
  transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

.current-plan-banner {
  background: linear-gradient(135deg, rgba(0, 180, 216, 0.12) 0%, rgba(10, 147, 150, 0.06) 100%);
  border: 1.5px dashed var(--shell-accent);
  border-radius: 20px;
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.current-plan-banner__info {
  display: grid;
  gap: 6px;
}

.current-plan-banner__plan {
  font-size: 18px;
  font-weight: 800;
  color: var(--shell-accent);
}

.current-plan-banner__status {
  font-size: 12px;
  color: var(--shell-muted);
}

.invoice-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  text-align: left;
}

.invoice-table th {
  padding: 12px 16px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--shell-muted);
  border-bottom: 1px solid var(--shell-border);
  font-weight: 700;
}

.invoice-table td {
  padding: 14px 16px;
  font-size: 13.5px;
  border-bottom: 1px solid var(--shell-border);
  color: var(--shell-ink);
}

.invoice-table tr:last-child td {
  border-bottom: 0;
}

.invoice-status-pill {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
}

.invoice-status-pill--completed {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
}

.invoice-status-pill--pending {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
}

.invoice-status-pill--failed {
  background: rgba(239, 68, 68, 0.15);
  color: #fb7185;
}

.billing-submit-btn {
  margin-top: 14px;
  width: 100%;
  padding: 14px;
  border-radius: 16px;
  font-size: 15px;
  font-weight: 800;
  color: white;
  border: none;
  cursor: pointer;
  background: linear-gradient(135deg, #00b4d8 0%, #0077b6 100%);
  box-shadow: 0 8px 24px rgba(0, 180, 216, 0.25);
  transition: all 0.3s ease;
  display: flex;
  justify-content: center;
  align-items: center;
}

.billing-submit-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 28px rgba(0, 180, 216, 0.35);
}

.billing-submit-btn:disabled {
  opacity: 0.75;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}
`;

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

        const [subResult, quotaResult, invoiceResult] = await Promise.allSettled([
          coreApiAdapter.getBillingSubscription(),
          coreApiAdapter.getBillingQuota(),
          coreApiAdapter.getBillingInvoices({ page: 1, page_size: 10 }),
        ]);

        const hasSubscription = subResult.status === 'fulfilled';
        const hasQuota = quotaResult.status === 'fulfilled';
        const hasInvoices = invoiceResult.status === 'fulfilled';

        setSubscription(hasSubscription ? subResult.value : null);
        setQuota(hasQuota ? (quotaResult.value.results || quotaResult.value || []) : []);
        setInvoices(hasInvoices ? (invoiceResult.value.results || []) : []);

        if (!hasSubscription && !hasQuota && !hasInvoices) {
          throw new Error(t('commercial.billingCenter.errorFetch'));
        }
      } catch (err) {
        setError(err.message || t('commercial.billingCenter.errorGeneric'));
      } finally {
        setLoading(false);
      }
    }

    loadBillingData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return e(ShellPageChrome, {
      title: t('commercial.billingCenter.titleShort'),
      description: t('commercial.billingCenter.loading'),
    }, e("div", { style: { padding: "40px", textAlign: "center", color: "#486581" } }, t('commercial.billingCenter.loading')));
  }

  return e(ShellPageChrome, {
    eyebrow: "SaaS Commerce System",
    title: t('commercial.billingCenter.titleShort'),
    description: "Nâng cấp tài khoản lên gói VIP hội viên để mở khóa toàn bộ tính năng phân tích cá mập, dòng tiền chìm nâng cao và chatbot AI bám sát dữ liệu thị trường.",
    error: error,
  },
    e("style", null, BILLING_CUSTOM_STYLES),
    e("div", { className: "billing-grid" },

      // Cột trái: Form chọn gói & Nâng cấp
      e("div", { className: "shellPage__stack" },
        e(ShellPanel, {
          title: t('commercial.billingCenter.upgradeTitle'),
          subtitle: "Chọn gói thành viên phù hợp nhất với tần suất giao dịch và nhu cầu phân tích của bạn.",
        },
          e(PaymentCreateForm, { t })
        ),

        e(ShellPanel, {
          title: t('commercial.billingCenter.invoiceTitle'),
          subtitle: "Danh sách 10 hóa đơn giao dịch gần đây nhất trên hệ thống.",
        },
          (invoices && invoices.length > 0) ? e("div", { style: { overflowX: "auto" } },
            e("table", { className: "invoice-table" },
              e("thead", null,
                e("tr", null,
                  e("th", null, t('commercial.billingCenter.invoiceId')),
                  e("th", null, t('commercial.billingCenter.invoiceDate')),
                  e("th", null, t('commercial.billingCenter.invoiceAmount')),
                  e("th", null, t('commercial.billingCenter.invoiceStatus'))
                )
              ),
              e("tbody", null,
                invoices.map((inv, idx) => {
                  const isCompleted = String(inv.status).toLowerCase() === 'completed';
                  const isPending = String(inv.status).toLowerCase() === 'pending';
                  const statusClass = isCompleted
                    ? "invoice-status-pill--completed"
                    : isPending ? "invoice-status-pill--pending" : "invoice-status-pill--failed";
                  const statusLabel = isCompleted
                    ? "Thành công"
                    : isPending ? "Chờ xử lý" : "Thất bại";

                  return e("tr", { key: idx },
                    e("td", null, e("code", null, inv.invoice_id)),
                    e("td", null, inv.created_at ? new Date(inv.created_at).toLocaleDateString('vi-VN') : '-'),
                    e("td", { style: { fontWeight: "700" } }, `${Number(inv.amount || 0).toLocaleString('vi-VN')} đ`),
                    e("td", null, e("span", { className: `invoice-status-pill ${statusClass}` }, statusLabel))
                  );
                })
              )
            )
          ) : e("div", { className: "shellPage__empty" }, t('commercial.billingCenter.noInvoices'))
        )
      ),

      // Cột phải: Thông tin gói hiện tại & Quota
      e("div", { className: "shellPage__stack" },
        e(ShellPanel, {
          title: t('commercial.billingCenter.currentPlanTitle'),
        },
          subscription ? e("div", { className: "current-plan-banner" },
            e("div", { className: "current-plan-banner__info" },
              e("span", { className: "current-plan-banner__plan" }, subscription.plan_name || t('commercial.billingCenter.planDefault')),
              e("span", { className: "current-plan-banner__status" }, `${t('commercial.billingCenter.statusLabel')} ${subscription.status || t('commercial.billingCenter.statusActive')}`)
            ),
            subscription.next_billing_date ? e("div", { className: "shellPage__pill" },
              `${t('commercial.billingCenter.renewalDateLabel')} ${subscription.next_billing_date}`
            ) : null
          ) : e("div", { className: "current-plan-banner" },
            e("div", { className: "current-plan-banner__info" },
              e("span", { className: "current-plan-banner__plan", style: { color: "#486581" } }, t('commercial.billingCenter.planDefault')),
              e("span", { className: "current-plan-banner__status" }, t('commercial.billingCenter.noPlan'))
            )
          )
        ),

        e(ShellPanel, {
          title: t('commercial.billingCenter.quotaTitle'),
          subtitle: "Giám sát mức độ tiêu hao tài nguyên định ngạch trong chu kỳ thanh toán hiện tại.",
        },
          (quota && quota.length > 0) ? e("div", { className: "quota-bar-container" },
            quota.map((q, idx) => {
              const used = Number(q.used || 0);
              const limit = Number(q.limit || 0);
              const isUnlimited = limit <= 0;
              const percent = isUnlimited ? 0 : Math.min((used / limit) * 100, 100);

              // Đổi màu thanh dựa trên tỉ lệ sử dụng
              let barColor = "linear-gradient(90deg, #22c55e, #4ade80)"; // xanh lá
              if (percent >= 90) {
                barColor = "linear-gradient(90deg, #ef4444, #f87171)"; // đỏ
              } else if (percent >= 70) {
                barColor = "linear-gradient(90deg, #f59e0b, #fbbf24)"; // cam/vàng
              }

              return e("div", { className: "quota-item", key: idx },
                e("div", { className: "quota-item__info" },
                  e("span", { className: "quota-item__name" }, q.feature_name),
                  e("span", { className: "quota-item__stat" },
                    isUnlimited
                      ? `${used} / ${t('commercial.billingCenter.quotaUnlimited')}`
                      : `${used} / ${limit} (${percent.toFixed(0)}%)`
                  )
                ),
                !isUnlimited ? e("div", { className: "quota-item__bar-bg" },
                  e("div", {
                    className: "quota-item__bar-fill",
                    style: { width: `${percent}%`, background: barColor }
                  })
                ) : null
              );
            })
          ) : e("div", { className: "shellPage__empty" }, t('commercial.billingCenter.noQuota'))
        )
      )

    )
  );
}

function PaymentCreateForm({ t }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [amount, setAmount] = useState(100000);
  const [activePlan, setActivePlan] = useState("VIP_1M");

  const plans = [
    {
      id: "VIP_1M",
      title: "VIP 1 Tháng",
      desc: "Trải nghiệm đầy đủ tính năng phân tích cơ bản và dòng tiền cá mập.",
      price: 100000,
      period: "Tháng",
      savings: null,
      badge: null,
    },
    {
      id: "VIP_6M",
      title: "VIP 6 Tháng",
      desc: "Giải pháp tối ưu cho nhà giao dịch năng động, tiết kiệm chi phí.",
      price: 500000,
      period: "6 Tháng",
      savings: "Tiết kiệm 100,000 đ",
      badge: "Phổ biến nhất",
    },
    {
      id: "VIP_12M",
      title: "VIP 12 Tháng",
      desc: "Đặc quyền VIP trọn vẹn, cập nhật tín hiệu sớm nhất và AI Advisor hỗ trợ 24/7.",
      price: 900000,
      period: "Năm",
      savings: "Tiết kiệm 300,000 đ",
      badge: "Giá trị nhất",
    }
  ];

  const handlePlanSelect = (planId, price) => {
    if (submitting) return;
    setActivePlan(planId);
    setAmount(price);
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (submitting) return;

    try {
      setSubmitting(true);
      setError(null);

      const payload = { amount, plan: activePlan };
      const response = await coreApiAdapter.createPayment(payload);

      if (response && response.pay_url) {
        window.location.href = response.pay_url;
      } else {
        throw new Error(t('commercial.billingCenter.form.errorNoUrl'));
      }
    } catch (err) {
      setError(err.message || t('commercial.billingCenter.form.errorInit'));
      setSubmitting(false); // Chỉ kích hoạt lại khi lỗi
    }
  };

  return e("form", { onSubmit: handleSubmit, className: "shellPage__form" },
    error ? e("div", { className: "shellPage__banner shellPage__banner--error", style: { margin: 0 } }, error) : null,

    e("span", { className: "shellPage__fieldLabel" }, t('commercial.billingCenter.form.planLabel')),

    // Giao diện chọn Gói bằng Thẻ (Plan Cards Selector)
    e("div", { className: "plan-card-container" },
      plans.map((p) => {
        const isActive = activePlan === p.id;
        return e("div", {
          key: p.id,
          className: `plan-card ${isActive ? "active" : ""}`,
          onClick: () => handlePlanSelect(p.id, p.price)
        },
          p.badge ? e("span", { className: "plan-card__badge" }, p.badge) : null,
          e("div", null,
            e("h3", { className: "plan-card__title" }, p.title),
            e("p", { className: "plan-card__desc" }, p.desc)
          ),
          e("div", { className: "plan-card__price-box" },
            e("span", { className: "plan-card__price" }, `${Number(p.price).toLocaleString('vi-VN')}đ`),
            e("span", { className: "plan-card__period" }, ` / ${p.period}`),
            p.savings ? e("span", { className: "plan-card__savings" }, p.savings) : null
          )
        );
      })
    ),

    e(ShellField, {
      label: t('commercial.billingCenter.form.amountLabel'),
      name: "amount",
      type: "number",
      value: amount,
      onChange: (ev) => {
        if (!submitting) setAmount(Number(ev.target.value));
      },
      disabled: true, // Khóa chỉnh sửa số tiền để tránh sai lệch với gói cước đã chọn
    }),

    e("button", {
      type: "submit",
      disabled: submitting,
      className: "billing-submit-btn"
    }, submitting ? t('commercial.billingCenter.form.submitProcessing') : t('commercial.billingCenter.form.submitButton'))
  );
}
