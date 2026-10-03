# Kế Hoạch Hoàn Thiện Phase 2 — Scheduled Reports & Cost Analytics

> **Ngày:** 2026-06-24
> **Phiên bản:** 1.1 (Revised after audit)
> **Trạng thái:** Đã audit — chờ phê duyệt
> **Audit phản biện:** `TENANT_ADMIN_UPGRADE_PLANS_AUDIT_REPORT.md` §1
> **Phụ thuộc:** Audit doc `TENANT_ADMIN_UPGRADE_AUDIT_20260624.md` — Phase 2 hiện tại ~80%

---

## 1. Tổng Quan

Phase 2 (Analytics & Forecasting) đã hoàn thành core: usage trend charts, forecasting exhaust date, meter selector. Còn **2 gaps** cần triển khai:

| Gap | Backend | Frontend | Ưu tiên |
|-----|---------|----------|---------|
| **Scheduled Reports** | Chưa có views/endpoints | Chưa có UI | Trung bình |
| **Cost Analytics** | Chưa có `views_analytics.py` + endpoint cost-trend | Chưa có biểu đồ chi phí trên Billing page | Cao |

---

## 2. Gap 1 — Cost Analytics

### 2.1 Mục tiêu

Hiển thị biểu đồ chi phí hàng tháng (6 tháng gần nhất) trên trang Billing, kèm banner forecasting nếu chi phí có xu hướng tăng.

```
┌─────────────────────────────────────────────────────────┐
│  💳 Hóa đơn & Cước                                      │
│  ┌─────────────────────────────────────────────────────┐│
│  │  Monthly Cost (6 months)                       7d 30d││
│  │  ┌─────────────────────────────────────────────────┐││
│  │  │  ██                                               ││
│  │  │  ██ ██                                            ││
│  │  │  ██ ██ ██                                         ││
│  │  │  ██ ██ ██ ██    ██                                ││
│  │  │  ██ ██ ██ ██ ██ ██ ██ ██                          ││
│  │  │  └─────────────────────────────────────────────────││
│  │  │  Jan Feb Mar Apr May Jun                           ││
│  │  └────────────────────────────────────────────────────││
│  │  ▲ Total: 12,450,000₫ • Avg: 2,075,000₫/tháng       ││
│  │  ⚠️ Projected next month: 2,800,000₫ (+35%)         ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### 2.2 Backend — New Endpoint

#### `GET /partner/billing/cost-trend/?months=6`

**View class:** `PartnerCostTrendView` trong `commercial/views_analytics.py`

**Response payload:**
```json
{
  "monthly": [
    {"month": "2026-01", "total": 2000000, "items": {"subscription": 1500000, "api_overage": 500000}},
    {"month": "2026-02", "total": 2100000, "items": {"subscription": 1500000, "api_overage": 600000}}
  ],
  "total_6m": 12450000,
  "monthly_avg": 2075000,
  "projected_next": 2800000,
  "projected_change_pct": 35,
  "currency": "VND"
}
```

**Permission:** `manage_tenant` (giống các partner billing views khác)

**Implementation notes:**
- Đọc từ `Invoice` model (đã có sẵn trong `commercial`) — filter `tenant`, `status='paid'`, group by month
- **⚠️ Audit finding:** `Invoice` model hiện tại chỉ có `amount_due` (DecimalField) và `currency` — không có line-item breakdown (`subscription` vs `api_overage`). Để có phân rã chi tiết, cần bổ sung `JSONField line_items` vào `Invoice` model (hoặc tạo model `InvoiceLineItem` riêng) và populate từ Stripe Invoice webhook.
- **Tuyệt đối không gọi Stripe API realtime** để fetch breakdown cho 6 tháng — Stripe rate limit (100 req/s) và độ trễ mạng sẽ gây ảnh hưởng đến response time của trang Billing.
- Projected next month: linear regression dựa trên 3 tháng gần nhất. **Lưu ý:** hóa đơn prorated (do nâng cấp giữa kỳ) gây sai lệch tăng vọt — cần loại trừ hoặc điều chỉnh các tháng có proration trong thuật toán dự báo.
- Fallback: trả về `{"monthly": [], "note": "insufficient_data"}` nếu < 2 tháng dữ liệu hóa đơn liên tiếp

### 2.3 Frontend — Sửa đổi

#### `TenantAdminBillingPage.tsx`

**Changes:**
1. Thêm import `defaultCoreApiAdapter.getCostTrend(months)` trong `operator.js`
2. Gọi `getCostTrend(6)` trong `useEffect` load data
3. Render Recharts `BarChart` trong `ShellPanel` mới "Chi phí hàng tháng"
4. Thêm banner forecasting khi `projected_change_pct > 20`

**New adapter methods:**
```javascript
// operator.js
getCostTrend(months = 6) {
  return coreGet(`/partner/billing/cost-trend/?months=${months}`);
}
```

### 2.4 Files Changed

| File | Action |
|------|--------|
| `packages/core/backend/src/commercial/views_analytics.py` | New — `PartnerCostTrendView` |
| `packages/core/backend/src/commercial/urls.py` | Modified — register cost-trend route |
| `packages/web/src/adapters/core/operator.js` | Modified — add `getCostTrend` |
| `packages/web/src/adapters/coreApiAdapter.js` | Modified — wire `getCostTrend` |
| `packages/web/src/adapters/coreApiAdapter.d.ts` | Modified — type declaration |
| `packages/web/src/pages/tenant-admin/TenantAdminBillingPage.tsx` | Modified — add cost chart + forecast banner |

---

## 3. Gap 2 — Scheduled Reports

### 3.1 Mục tiêu

Cho phép admin tạo lập báo cáo định kỳ (daily/weekly/monthly) về usage, billing, security, gửi qua email. Dashboard hiển thị danh sách báo cáo đã lên lịch + lịch sử gửi.

```
┌─────────────────────────────────────────────────────────┐
│  📋 Báo cáo định kỳ                        + Tạo báo cáo│
│  ┌─────────────────────────────────────────────────────┐│
│  │ 🔄 Usage Report · Hàng tuần · Thứ 2 · 08:00       ││
│  │   Gửi: admin@tenant.com  ·  📬 12 lần gửi thành công││
│  │   [Chỉnh sửa] [Tạm dừng] [Xóa]                     ││
│  ├─────────────────────────────────────────────────────┤│
│  │ 🔄 Billing Summary · Hàng tháng · Ngày 1 · 09:00   ││
│  │   Gửi: finance@tenant.com  ·  📬 3 lần gửi thành công││
│  │   [Chỉnh sửa] [Tạm dừng] [Xóa]                     ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### 3.2 Backend — New Model + Endpoints

#### Model: `ScheduledReport`

```python
class ScheduledReport(models.Model):
    tenant = models.ForeignKey(CoreTenant, on_delete=models.CASCADE)
    name = models.CharField(max_length=128)
    report_type = models.CharField(max_length=32)
    # 'usage_summary', 'billing_summary', 'security_digest', 'audit_log'
    schedule = models.CharField(max_length=16)
    # 'daily', 'weekly_mon', 'weekly_fri', 'monthly_1', 'monthly_15'
    recipients = models.JSONField()  # list of email strings
    format = models.CharField(max_length=8, default='pdf')
    # 'pdf', 'csv', 'html'
    is_active = models.BooleanField(default=True)
    last_sent_at = models.DateTimeField(null=True)
    total_deliveries = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

#### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/partner/reports/` | List scheduled reports |
| POST | `/partner/reports/` | Create new report |
| GET | `/partner/reports/<id>/` | Get report detail + delivery history |
| PATCH | `/partner/reports/<id>/` | Update schedule/recipients/active |
| DELETE | `/partner/reports/<id>/` | Remove report |
| POST | `/partner/reports/<id>/test/` | Send test email immediately |
| GET | `/partner/reports/delivery-log/` | Recent delivery log (last 50) |

#### Dynamic Scheduler (không dùng Celery Beat tĩnh)

**⚠️ Audit finding:** Không khai báo từng lịch gửi trong `CELERY_BEAT_SCHEDULE`. Khi admin tạo báo cáo mới trên UI, Celery Beat tĩnh không tự động nhận biết.

**Giải pháp — Dynamic polling scheduler:**

```
[1 Task duy nhất] process_scheduled_reports  (Celery Beat, chạy mỗi 60 phút)
    ↓
    Quét ScheduledReport WHERE is_active=True
    ↓
    Với mỗi report, kiểm tra: now - last_sent_at >= schedule_interval
    ↓
    Nếu đã đến hạn → dispatch generate_and_deliver_report(report_id)
    ↓
    Task tạo nội dung (HTML/CSV) → gửi email qua Mailpit/SMTP
    ↓
    Ghi log delivery
```

**Định dạng email (ưu tiên HTML-based, tránh weasyprint):**

| Định dạng | Thư viện | Độ khó | Ghi chú |
|-----------|----------|:------:|---------|
| HTML inline | `django.template.loader.render_to_string` | Thấp | **Khuyến nghị** — gửi trực tiếp trong body email |
| CSV | `csv` module + `StringIO` | Thấp | Cho báo cáo dạng raw data |
| PDF | `reportlab` (pure-Python) | Trung bình | fallback nếu bắt buộc; tránh `weasyprint` (phụ thuộc C libs Pango/Cairo) |

**Không dùng `weasyprint`** — phụ thuộc thư viện C (Pango, Cairo, GObject) gây khó khăn khi build Docker image slim.

### 3.3 Frontend — New Page

#### `TenantAdminReportsPage.tsx` (mới)

**Layout:**
- `ShellPageChrome` với title "Báo cáo định kỳ"
- Metric row: số lượng báo cáo active, tổng deliveries tháng này, tỷ lệ thành công
- List view: mỗi item là `ShellPanel` với schedule info, toggle active, action buttons
- Create modal: form gồm name, report_type (dropdown), schedule (dropdown), recipients (email input list), format (radio)

**Modal create form:**
```
┌───────────────────────────────────────┐
│  Tạo báo cáo định kỳ                  │
├───────────────────────────────────────┤
│  Tên báo cáo: [_____________________] │
│  Loại: [Usage Summary      ▾]        │
│  Lịch: [Hàng tuần - Thứ 2  ▾]        │
│  Định dạng: ○ PDF  ● CSV  ○ HTML     │
│  Người nhận:                          │
│  [admin@tenant.com     ] [Thêm]       │
│  • finance@tenant.com        [×]      │
│  • ops@tenant.com           [×]       │
│  [Hủy]                    [Tạo]       │
└───────────────────────────────────────┘
```

**Required permissions:**
- `read TenantReportsView` — xem danh sách
- `manage TenantReportsView` — CRUD

### 3.4 Adapter Methods

```javascript
// operator.js
getScheduledReports()          { return coreGet('/partner/reports/'); }
createScheduledReport(data)    { return corePost('/partner/reports/', data); }
updateScheduledReport(id,data) { return corePatch(`/partner/reports/${id}/`, data); }
deleteScheduledReport(id)      { return coreDelete(`/partner/reports/${id}/`); }
testScheduledReport(id)        { return corePost(`/partner/reports/${id}/test/`); }
getReportDeliveryLog()         { return coreGet('/partner/reports/delivery-log/'); }
```

### 3.5 Files Changed

| File | Action |
|------|--------|
| `packages/core/backend/src/identity_access/models.py` | Modified — add `ScheduledReport` model + migration |
| `packages/core/backend/src/identity_access/views_reports.py` | New — report CRUD views |
| `packages/core/backend/src/identity_access/partner_urls.py` | Modified — register report routes |
| `packages/core/backend/src/identity_access/tasks.py` | New — Celery task `generate_and_deliver_report` |
| `packages/web/src/pages/tenant-admin/TenantAdminReportsPage.tsx` | New — full page |
| `packages/web/src/pages/pageRegistry.js` | Modified — register `/tenant-admin/reports` route |
| `packages/web/src/adapters/core/operator.js` | Modified — add report methods |
| `packages/web/src/adapters/coreApiAdapter.js` | Modified — wire |
| `packages/web/src/adapters/coreApiAdapter.d.ts` | Modified — type declarations |
| `packages/web/src/context/LangContext.js` (vi.js/en.js) | Modified — i18n keys |

---

## 4. Dependencies & Risks

| Item | Dependency | Risk level |
|------|-----------|------------|
| Cost Analytics | `Invoice` model trong `commercial` app | **Cao** — nếu chưa có model thì cần tạo migration |
| Cost Analytics | Stripe webhook events lưu trữ | Trung bình — fallback về 0 nếu thiếu data |
| Scheduled Reports | Celery Beat đang chạy | Thấp — dev stack đã có `vninvest-dev-core-beat` |
| Scheduled Reports | Mailpit/SMTP config | Thấp — dev đã có `vninvest-dev-mailpit` |
| Scheduled Reports | PDF generation library | Trung bình — cần `weasyprint` hoặc `reportlab` |
| Permission seeds | Thêm `TenantReportsView` vào abilities | Thấp |

---

## 5. Effort Estimate

| Task | Backend (h) | Frontend (h) | Total (h) |
|------|:-----------:|:-----------:|:---------:|
| Cost Analytics — Add `line_items` JSONField to Invoice + migration | 3 | — | 3 |
| Cost Analytics — View `PartnerCostTrendView` | 3 | — | 3 |
| Cost Analytics — Frontend chart + forecast banner | — | 6 | 6 |
| Scheduled Reports — Model + migration | 3 | — | 3 |
| Scheduled Reports — CRUD views | 6 | — | 6 |
| Scheduled Reports — Dynamic scheduler task + email (HTML/CSV, **bỏ PDF**) | 6 | — | 6 |
| Scheduled Reports — UI page + form | — | 12 | 12 |
| i18n keys + registry | — | 2 | 2 |
| Testing + validation | 2 | 2 | 4 |
| **Total** | **23** | **22** | **45** |

> **Điều chỉnh sau audit:** Giảm 2h Celery task (bỏ weasyprint PDF) + tăng 2h model migration (line_items) → **giữ nguyên 45h**. Nhưng rủi ro build Docker giảm đáng kể nhờ bỏ weasyprint.  
> **Effort đánh giá lại (audit độc lập): 42h** — xem `TENANT_ADMIN_UPGRADE_PLANS_AUDIT_REPORT.md` §4.
