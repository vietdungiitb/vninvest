# Kế Hoạch Phase 4 — Lifecycle Automation

> **Ngày:** 2026-06-24
> **Phiên bản:** 1.1 (Revised after audit)
> **Trạng thái:** Đã audit — chờ phê duyệt
> **Audit phản biện:** `TENANT_ADMIN_UPGRADE_PLANS_AUDIT_REPORT.md` §3

---

## 1. Tổng Quan

Tự động hóa vòng đời tenant: trial → active → upgrade → churn/deprovision. Cho phép admin cấu hình webhook để nhận sự kiện realtime từ hệ thống.

### 1.1 Mục tiêu

| Tính năng | Mô tả | Ưu tiên |
|-----------|-------|---------|
| **Webhook Management** | CRUD webhook + delivery log + test + HMAC signing | P0 |
| **In-App Upgrade UI** | Plan comparison table, upgrade confirmation, return từ Stripe portal | P0 |
| **Trial Lifecycle** | Trial banner đếm ngược, email reminder tự động (7 ngày, 3 ngày, 1 ngày) | P1 |
| **Deprovisioning Flow** | Confirm dialog, grace period, scheduled deletion, cancellation email | P1 |

---

## 2. Backend — Webhook Management

### 2.1 Models

```python
class TenantWebhookConfig(models.Model):
    tenant = models.ForeignKey(CoreTenant, on_delete=models.CASCADE, related_name='webhook_configs')
    name = models.CharField(max_length=128, default='Default')
    url = models.URLField(max_length=512)
    secret = models.CharField(max_length=64, blank=True, default='')
    events = models.JSONField(default=list)
    # Ví dụ: ["member.joined", "member.removed", "pat.created", "pat.revoked",
    #         "sa.created", "sa.deleted", "quota.warning", "quota.critical",
    #         "billing.invoice.paid", "billing.subscription.changed",
    #         "tenant.trial.ending", "tenant.deprovisioned"]
    is_active = models.BooleanField(default=True)
    headers = models.JSONField(default=dict, blank=True)
    retry_count = models.IntegerField(default=3)
    timeout_seconds = models.IntegerField(default=10)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.secret:
            self.secret = secrets.token_hex(32)  # auto-generate HMAC secret
        super().save(*args, **kwargs)


class WebhookDelivery(models.Model):
    config = models.ForeignKey(TenantWebhookConfig, on_delete=models.CASCADE, related_name='deliveries')
    event_type = models.CharField(max_length=64)
    event_id = models.CharField(max_length=64, db_index=True)
    payload = models.JSONField()
    status = models.CharField(max_length=16)
    # 'pending', 'success', 'failed', 'retrying'
    response_code = models.IntegerField(null=True)
    response_body = models.TextField(blank=True, default='')
    attempts = models.IntegerField(default=0)
    next_retry_at = models.DateTimeField(null=True)
    duration_ms = models.IntegerField(null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['config', 'created_at']),
            models.Index(fields=['status', 'next_retry_at']),
        ]
```

### 2.2 Webhook Dispatcher

```python
# webhook_dispatcher.py (mới)

class WebhookDispatcher:
    HMAC_HEADER = 'X-VNInvest-Signature'

    @staticmethod
    def dispatch(tenant, event_type, payload):
        configs = TenantWebhookConfig.objects.filter(
            tenant=tenant, is_active=True, events__contains=[event_type]
        )
        for config in configs:
            _schedule_delivery(config, event_type, payload)

    @staticmethod
    def sign_payload(secret, payload):
        import hmac, hashlib
        body = json.dumps(payload, separators=(',', ':'), sort_keys=True)
        return hmac.new(
            secret.encode(), body.encode(), hashlib.sha256
        ).hexdigest()
```

#### Celery Task: `deliver_webhook`

```
deliver_webhook(delivery_id)
  → GET WebhookDelivery
  → POST đến config.url với HMAC signature header
  → Success: update status + response_code + duration_ms
  → 4xx: không retry (mark failed)
  → 5xx/timeout: retry (exponential backoff: 1min, 5min, 15min, max 3 lần)
```

#### Signal-based dispatch

Dùng Django signals để tự động dispatch webhooks:

```python
# signals.py (mới)
@receiver(post_save, sender=TenantMember)
def on_member_changed(sender, instance, created, **kwargs):
    event = 'member.joined' if created else 'member.updated'
    WebhookDispatcher.dispatch(instance.tenant, event, {
        'event': event,
        'user_id': instance.user_id,
        'email': instance.user.email,
        'role': instance.role,
        'occurred_at': now().isoformat(),
    })

@receiver(post_save, sender=CorePATCredential)
def on_pat_changed(sender, instance, created, **kwargs):
    event = 'pat.created' if created else 'pat.updated'
    WebhookDispatcher.dispatch(instance.service_account.tenant, event, {...})
```

**Events list (phase 1 support):**
- `member.joined`, `member.removed`
- `pat.created`, `pat.revoked`
- `sa.created`, `sa.deleted`
- `quota.warning`, `quota.critical`
- `billing.invoice.paid`

### 2.4 Celery Queue Isolation

**⚠️ Audit finding:** Webhook delivery có độ trễ mạng lớn (URL đối tác phản hồi chậm). Nếu dùng chung queue mặc định, webhook bị timeout chiếm worker threads, gây nghẽn cho OTP, tính toán, v.v.

**Giải pháp:**
- Định tuyến task `deliver_webhook` sang queue riêng: `webhooks_queue`
- Worker riêng: `celery -A vninvest_core worker -Q webhooks_queue --concurrency=4`
- Task ưu tiên thấp: timeout 30s, max retries 3, rate limit 100/h/tenant

```python
@shared_task(queue='webhooks_queue', default_retry_delay=60, max_retries=3, autoretry_for=(TimeoutError, ConnectionError))
def deliver_webhook(delivery_id):
    ...
```

### 2.5 Webhook Delivery Log Retention

**⚠️ Audit finding:** Chạy cleanup hàng tháng (`day_of_month='1'`) gây lock bảng khi xóa hàng trăm ngàn bản ghi một lần.

**Giải pháp — Daily batch delete:**
- Chạy cleanup mỗi ngày lúc 02:00 AM
- Xóa cuốn chiếu theo batch nhỏ (1000 records/lần) để tránh lock bảng kéo dài

```python
@shared_task
def cleanup_webhook_deliveries():
    cutoff = timezone.now() - timedelta(days=90)
    deleted = 1
    while deleted > 0:
        batch = list(WebhookDelivery.objects.filter(
            created_at__lt=cutoff
        ).values_list('id', flat=True)[:1000])
        if not batch:
            break
        WebhookDelivery.objects.filter(id__in=batch).delete()
        deleted = len(batch)
```

### 2.6 Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/partner/webhooks/` | List webhook configs |
| POST | `/partner/webhooks/` | Create webhook + auto-generate secret |
| GET | `/partner/webhooks/<id>/` | Get detail (không trả secret) |
| PATCH | `/partner/webhooks/<id>/` | Update url, events, active |
| DELETE | `/partner/webhooks/<id>/` | Delete config |
| POST | `/partner/webhooks/<id>/regenerate-secret/` | Rotate HMAC secret |
| GET | `/partner/webhooks/<id>/deliveries/` | Delivery log (paginated) |
| POST | `/partner/webhooks/<id>/test/` | Test: dispatch `webhook.test` event |
| POST | `/partner/webhooks/<id>/deliveries/<delivery_id>/retry/` | Manual retry |

---

## 3. Backend — In-App Upgrade

### 3.1 Current State

Hiện tại, Billing page redirect user sang Stripe Customer Portal. User phải tự so sánh gói trên trang Stripe.

### 3.2 Target State

Hiển thị bảng so sánh gói ngay trong trang Billing, cho phép chọn gói và upgrade. Stripe Portal vẫn là backend nhưng user không cần rời khỏi VNInvest.

```
┌──────────────────────────────────────────────────────────────┐
│  💳 Gói hiện tại: Pro  ·  2,000,000₫/tháng                  │
│  ┌──────────────────────────────────────────────────────────┐│
│  │                    Starter    Pro      Enterprise        ││
│  │  API calls/mo      10,000    50,000   Unlimited         ││
│  │  Members              5        25      Unlimited         ││
│  │  Service Accounts     3        10      100               ││
│  │  Support           Email    Priority  Dedicated          ││
│  │  SSO/SAML            —        ✅       ✅                ││
│  │  Audit Logs        7 days   30 days   90 days            ││
│  │  Webhooks            —        ✅       ✅                ││
│  │                    [Hiện tại] [Nâng cấp] [Liên hệ]       ││
│  └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────
```

### 3.3 New Endpoint

#### `POST /partner/subscription/preview-change/`

**Request:**
```json
{
  "target_plan": "enterprise",
  "immediate": true
}
```

**Response:**
```json
{
  "current_plan": "pro",
  "target_plan": "enterprise",
  "prorated_amount": 1500000,
  "next_billing_amount": 5000000,
  "effective_date": "2026-07-01",
  "trial_extension_days": null,
  "changes": {
    "api_calls": {"from": 50000, "to": null},
    "members": {"from": 25, "to": null},
    "sso": {"from": false, "to": true}
  }
}
```

**Logic:**
- Gọi Stripe API để tính prorated amount
- Nếu `immediate=false` (end of billing period) → không tính proration
- Nếu `immediate=true` → tính proration từ hôm nay đến hết kỳ

### 3.4 Upgrade Flow

1. User click "Nâng cấp" trên bảng so sánh
2. Preview modal: show prorated amount + effective date
3. User confirm
4. Backend gọi Stripe API `subscription.update`
5. Redirect user sang Stripe Customer Portal với `return_url=/tenant-admin/billing`
6. Stripe webhook `checkout.session.completed` → update CoreTenant.plan
7. Frontend polling hoặc WebSocket push → refresh billing page

### 3.5 Stripe Webhook Async Delay Handling

**⚠️ Audit finding:** Stripe webhook `checkout.session.completed` có thể đến sau 2-5 giây hoặc lâu hơn (tùy Stripe infrastructure). Nếu frontend không handle delay này, user thấy "còn pending" → click nhiều lần → tạo nhiều subscription.change.

**Giải pháp — Client-side optimistic + polling:**
1. Sau khi redirect về từ Stripe Portal, frontend gọi `GET /partner/billing/status/` ngay:
   ```json
   {"plan": "enterprise", "status": "active", "pending": false}
   ```
   hoặc:
   ```json
   {"plan": "pro", "status": "active", "pending": true, "last_change_requested_at": "2026-06-24T10:30:00Z"}
   ```
2. Backend trả `pending: true` khi Stripe `checkout.session.completed` chưa đến.
3. Frontend poll mỗi 3 giây, tối đa 30 giây. Hiển thị spinner + "Đang xử lý, vui lòng chờ..."
4. Nếu quá 30 giây, hiển thị "Yêu cầu đang được xử lý. Kết quả sẽ cập nhật trong vài phút." + link retry.
5. Thêm Stripe webhook idempotency key để tránh double processing:
   ```python
   stripe.Subscription.modify(
       sub_id,
       items=[{"id": item_id, "price": price_id}],
       idempotency_key=f"upgrade_{tenant.id}_{int(time.time())}"
   )
   ```

---

## 4. Backend — Trial Lifecycle

### 4.1 Current State

`TenantAdminHomePage.tsx` đã có trial banner với `trial_remaining_days`. Chưa có reminder tự động.

### 4.2 Celery Tasks

```python
# tasks.py
@shared_task
def check_trial_expirations():
    """Daily check — gửi email reminder cho trial sắp hết"""
    tiers = CoreTenant.objects.filter(
        status='trial',
        trial_ends_at__gte=date.today(),
    )
    for tier in tiers:
        remaining = (tier.trial_ends_at - date.today()).days
        if remaining in [7, 3, 1]:
            send_trial_reminder_email(tier, remaining)


@shared_task
def auto_disable_expired_trials():
    """Daily — disable tenants quá 3 ngày sau trial end"""
    cutoff = date.today() - timedelta(days=3)
    expired = CoreTenant.objects.filter(
        status='trial',
        trial_ends_at__lte=cutoff,
    )
    for tier in expired:
        tier.status = 'disabled'
        tier.save(update_fields=['status'])
        enqueue_deprovision(tier)
```

### 4.3 Trial Email Templates

| Template | Trigger | Nội dung |
|----------|---------|----------|
| `trial_7d_remaining` | 7 ngày trước khi hết | "Còn 7 ngày dùng thử. Nâng cấp lên Pro để tiếp tục." |
| `trial_3d_remaining` | 3 ngày | "Chỉ còn 3 ngày. Các tính năng sẽ bị giới hạn." |
| `trial_1d_remaining` | 1 ngày | "Ngày cuối! Gia hạn ngay để không gián đoạn." |
| `trial_expired` | Hết trial + chưa upgrade | "Tài khoản đã bị giới hạn. Nâng cấp để kích hoạt lại." |

Gửi email qua Mailpit (dev) / SMTP (production).

---

## 5. Frontend

### 5.1 New Page: `TenantAdminWebhooksPage.tsx`

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  🔗 Webhooks                                   + Tạo mới│
│  ┌─────────────────────────────────────────────────────┐│
│  │ 🔄 Default Webhook  ·  [Hoạt động]                 ││
│  │   URL: https://hooks.tenant.com/events              ││
│  │   Events: member.joined, pat.revoked, quota.warning ││
│  │   📬 142 deliveries · 98.6% success                ││
│  │   [Chỉnh sửa] [Xem nhật ký] [Kiểm tra]             ││
│  └─────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────┐│
│  │ ⏸️ Slack Notifier  ·  [Tạm dừng]                   ││
│  │   URL: https://hooks.slack.com/...                  ││
│  │   Events: quota.critical only                       ││
│  │   📬 12 deliveries · 100% success                  ││
│  │   [Chỉnh sửa] [Xem nhật ký] [Kiểm tra]             ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

**Create/Edit modal:**
- Name (text input)
- URL (URL input)
- Events (checkbox group, grouped by category: Member, PAT, SA, Quota, Billing)
- Retry count (number input, default 3)
- Timeout (number input, default 10s)
- Active toggle

**Delivery log panel:**
- Table: timestamp, event_type, status, response_code, attempts, duration
- Retry button for failed deliveries
- Filter: status, event_type, date range

### 5.2 Billing Page — Upgrade UI

Sửa `TenantAdminBillingPage.tsx`:

**Changes:**
1. Thêm plan comparison table component (3 plans × features)
2. Highlight current plan
3. "Nâng cấp" button → Stripe portal redirect
4. Nếu đã là Enterprise → hiển thị "Liên hệ sales" hoặc message
5. Banner forecasting cost nếu đã implement

### 5.3 Trial Banner Enhancement

`TenantAdminHomePage.tsx` đã có trial banner cơ bản. Cần thêm:
- Màu sắc thay đổi theo số ngày: xanh (>7), vàng (3-7), đỏ (<3)
- Nút CTA "Nâng cấp ngay" trong banner khi < 7 ngày
- Animation: pulse effect khi < 3 ngày

### 5.4 Adapter Methods

```javascript
// operator.js
getWebhooks()                                { return coreGet('/partner/webhooks/'); }
createWebhook(data)                          { return corePost('/partner/webhooks/', data); }
updateWebhook(id, data)                      { return corePatch(`/partner/webhooks/${id}/`, data); }
deleteWebhook(id)                            { return coreDelete(`/partner/webhooks/${id}/`); }
regenerateWebhookSecret(id)                  { return corePost(`/partner/webhooks/${id}/regenerate-secret/`); }
getWebhookDeliveries(id)                     { return coreGet(`/partner/webhooks/${id}/deliveries/`); }
testWebhook(id)                              { return corePost(`/partner/webhooks/${id}/test/`); }
retryWebhookDelivery(deliveryId)             { return corePost(`/partner/webhooks/${id}/deliveries/${deliveryId}/retry/`); }
previewPlanChange(targetPlan, immediate)     { return corePost('/partner/subscription/preview-change/', {target_plan: targetPlan, immediate}); }
```

---

## 6. i18n Keys

```javascript
// vi.js additions
tenantWebhooks: {
  eyebrow: "Tenant Admin",
  title: "Webhooks",
  description: "Quản lý các webhook nhận sự kiện từ hệ thống",
  createTitle: "Tạo webhook mới",
  editTitle: "Chỉnh sửa webhook",
  nameLabel: "Tên webhook",
  urlLabel: "URL nhận sự kiện",
  eventsLabel: "Sự kiện",
  retryLabel: "Số lần thử lại",
  timeoutLabel: "Timeout (giây)",
  eventMember: "Thành viên",
  eventPAT: "API Token",
  eventSA: "Service Account",
  eventQuota: "Hạn mức",
  eventBilling: "Thanh toán",
  deliveryLog: "Nhật ký gửi",
  testAction: "Kiểm tra",
  regenerateAction: "Tạo lại secret",
  statusSuccess: "Thành công",
  statusFailed: "Thất bại",
  statusRetrying: "Đang thử lại",
  loadError: "Lỗi khi tải danh sách webhook",
},
tenantBilling: {
  // additions
  upgradeTitle: "Nâng cấp gói",
  currentPlan: "Gói hiện tại",
  comparePlans: "So sánh gói cước",
  upgradeAction: "Nâng cấp",
  contactSales: "Liên hệ bán hàng",
  proratedAmount: "Số tiền prorated",
  effectiveDate: "Ngày hiệu lực",
  featureApiCalls: "API calls/tháng",
  featureMembers: "Số thành viên",
  featureServiceAccounts: "Service Accounts",
  featureSupport: "Hỗ trợ",
  featureSSO: "SSO/SAML",
  featureAuditLogs: "Audit Logs",
  featureWebhooks: "Webhooks",
},
```

---

## 7. Page Registry

```javascript
// pageRegistry.js
{
  path: "/tenant-admin/webhooks",
  component: "TenantAdminWebhooksPage",
  permission: "read TenantWebhookView"
}
```

Nav link trong `TenantAdminHomePage.tsx`:
```javascript
{ labelKey: "tenantHome.webhooksRoute", to: "/tenant-admin/webhooks", subject: "TenantWebhookView", icon: "\uD83D\uDD17" },
```

---

## 8. Files Changed

| File | Action |
|------|--------|
| `packages/core/backend/src/identity_access/models.py` | Modified — add `TenantWebhookConfig`, `WebhookDelivery` |
| `packages/core/backend/src/identity_access/migrations/` | New — migration |
| `packages/core/backend/src/identity_access/views_webhooks.py` | New — webhook CRUD + delivery views |
| `packages/core/backend/src/identity_access/webhook_dispatcher.py` | New — dispatch + HMAC signing |
| `packages/core/backend/src/identity_access/signals.py` | New — signal handlers → dispatch |
| `packages/core/backend/src/identity_access/tasks.py` | Modified — add webhook delivery (queue=`webhooks_queue`), trial reminder, deprovision (batch) tasks |
| `packages/core/backend/src/identity_access/views/billing.py` | New — polling endpoint `GET /partner/billing/status/` |
| `packages/core/backend/src/identity_access/partner_urls.py` | Modified — register webhook routes |
| `packages/core/backend/src/identity_access/partner_abilities.py` | Modified — seed `TenantWebhookView` |
| `packages/core/backend/src/signal_intelligence/tasks.py` | Modified — add trial_expiration_check, auto_disable_expired_trials |
| `packages/web/src/pages/tenant-admin/TenantAdminWebhooksPage.tsx` | New — full webhook management page |
| `packages/web/src/pages/tenant-admin/TenantAdminBillingPage.tsx` | Modified — add plan comparison table + upgrade flow |
| `packages/web/src/pages/tenant-admin/TenantAdminHomePage.tsx` | Modified — trial banner enhancement |
| `packages/web/src/pages/pageRegistry.js` | Modified — register webhook route |
| `packages/web/src/adapters/core/operator.js` | Modified — add webhook + upgrade methods |
| `packages/web/src/adapters/coreApiAdapter.js` | Modified — wire |
| `packages/web/src/adapters/coreApiAdapter.d.ts` | Modified — type declarations |
| `packages/web/src/i18n/vi.js` | Modified — add keys |
| `packages/web/src/i18n/en.js` | Modified — add keys |

---

## 9. Celery Beat Schedule

```python
# settings.py / celery.py additions
CELERY_BEAT_SCHEDULE = {
    'webhook-retry': {
        'task': 'identity_access.tasks.retry_failed_webhooks',
        'schedule': crontab(minute='*/5'),
    },
    'trial-expiration-check': {
        'task': 'identity_access.tasks.check_trial_expirations',
        'schedule': crontab(hour='8', minute='0'),
    },
    'auto-disable-expired-trials': {
        'task': 'identity_access.tasks.auto_disable_expired_trials',
        'schedule': crontab(hour='2', minute='0'),
    },
    'cleanup-old-deliveries': {
        'task': 'identity_access.tasks.cleanup_webhook_deliveries',
        'schedule': crontab(hour='2', minute='0'),  # 🔁 Audit: daily batch delete, không monthly
    },
}
```

---

## 10. Effort Estimate

| Task | Backend (h) | Frontend (h) | Total (h) |
|------|:-----------:|:-----------:|:---------:|
| Webhook models + migration | 3 | — | 3 |
| Webhook CRUD views | 5 | — | 5 |
| Webhook dispatcher + HMAC | 4 | — | 4 |
| Signal-based dispatch | 3 | — | 3 |
| Webhook queue isolation (queue riêng `webhooks_queue`) | 2 | — | 2 |
| Celery delivery + retry | 4 | — | 4 |
| In-app upgrade preview endpoint | 3 | — | 3 |
| Stripe async delay handling (polling endpoint + idempotency) | 2 | — | 2 |
| Trial reminder tasks + email | 5 | — | 5 |
| Deprovision flow (soft-delete → batch Celery dần) | 5 | — | 5 |
| `TenantAdminWebhooksPage.tsx` | — | 16 | 16 |
| `TenantAdminBillingPage.tsx` upgrade UI | — | 10 | 10 |
| Trial banner enhancement | — | 3 | 3 |
| i18n + registry + permissions | 1 | 2 | 3 |
| Testing + validation | 3 | 3 | 6 |
| **Total** | **38** | **34** | **72** |

---

## 11. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Stripe proration tính sai khi upgrade giữa kỳ | Medium | Preview endpoint gọi Stripe API realtime; fallback message "vui lòng liên hệ support" |
| Webhook HMAC secret bị lộ trong response | **Cao** | Secret chỉ trả về khi create, không bao giờ trong GET/list |
| Webhook delivery chậm → queue congested | Medium | ✅ **Audit fix:** Queue riêng `webhooks_queue` + worker riêng — không shared với task OTP/tính toán |
| Stripe webhook async delay → user click upgrade nhiều lần | Medium | ✅ **Audit fix:** Polling endpoint `GET /partner/billing/status/` + idempotency key |
| Deprovision cascade delete → mất dữ liệu vĩnh viễn | **Cao** | ✅ **Audit fix:** Soft-delete → batch Celery dần — cho tenant 30 ngày grace trước cleanup thật |
| Monthly cleanup lock bảng WebhookDelivery | Medium | ✅ **Audit fix:** Daily batch delete (1000 records/lần) — không lock bảng kéo dài |
| Trial email bị mark spam | Medium | DKIM/SPF cho production SMTP; dev dùng Mailpit |
| User upgrade trial → enterprise không qua Stripe | Medium | Validate `stripe_customer_id` tồn tại; fallback redirect tạo subscription mới |

> **Audit findings applied:** 4/6 risks có mitigation mới (đánh dấu ✅), giảm residual risk từ **1 cao** xuống **0 cao**. Xem audit report §3.2 để biết thêm chi tiết từng finding.
