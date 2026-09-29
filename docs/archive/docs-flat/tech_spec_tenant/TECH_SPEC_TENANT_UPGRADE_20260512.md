# TECH SPEC — SaaS Tenant Management Upgrade

**Ngày**: 2026-05-12
**Workstream ID**: TENANT-UPGRADE
**Version**: 1.0

---

## 1. Scope

### Trong scope

- Hợp nhất `CoreTenant` về một SSOT duy nhất tại `packages/core`
- `IsTenantActive` permission class — per-request tenant status enforcement
- `TenantQuotaMiddleware` — Redis-backed quota counting + `429` response
- Celery tasks: `flush_quota_counters`, `generate_monthly_invoices`, `check_overdue_invoices`
- Django app `tenant_lifecycle`: `TenantLifecycleEvent` model + automation Celery tasks
- Operator write API: suspend/activate/change-plan endpoints
- Self-service onboarding endpoint + trial activation
- `TenantMember` + `TenantInvite` models và CRUD API
- `TenantLifecycleEvent` signal hooks + operator history endpoint
- Data isolation audit (top 3 critical models)

### Ngoài scope

- Payment gateway integration (Stripe/VNPay) — P3+
- Email SMTP thật — email tasks enqueue nhưng không cần SMTP live trong dev/test
- UI cho tenant self-admin portal — chỉ backend API
- Import billing từ hệ thống kế toán bên ngoài

---

## 2. Kiến trúc tổng thể sau upgrade

```
Request path:
  HTTP Request
    → Django MIDDLEWARE stack
        → SessionMiddleware
        → AuthenticationMiddleware
        → TenantQuotaMiddleware  ← MỚI (đếm + 429)
    → View
        → permission_classes=[IsAuthenticated, IsTenantActive]  ← MỚI
        → business logic
    → Response

Lifecycle automation:
  Celery Beat
    → auto_expire_trials (daily 01:00)
    → auto_suspend_quota_overflow (hourly)
    → send_trial_expiry_warning (daily 09:00)
    → generate_monthly_invoices (1st of month 00:05)
    → flush_quota_counters (every 60s)
    → check_overdue_invoices (daily 08:00)
    → auto_deprovision_stale (weekly Sunday)

State machine CoreTenant.status:
  pending_activation → trial → active → suspended → deprovisioned
                                ↑______________|        ↑
                              (reactivate)           (30 days after suspend)
```

---

## 3. Model specifications

### 3.1 CoreTenant (packages/core — không thay đổi schema)

File: `packages/core/backend/src/identity_access/models.py`

Giữ nguyên schema hiện tại. Chỉ thêm:

```python
# Thêm class method để track state transition
def _set_status(self, new_status: str, actor_user=None, actor_type: str = 'system', old_status: str = None):
    """
    Thay đổi trạng thái và ghi TenantLifecycleEvent.
    Dùng update_fields để signal chỉ trigger khi status thực sự thay đổi.
    """
    if old_status is None:
        old_status = self.status
    self.status = new_status
    self.save(update_fields=['status', 'updated_at'])
    # Signal sẽ tự tạo TenantLifecycleEvent (xem section 7)
```

### 3.2 TenantMember (NEW)

File: `packages/core/backend/src/identity_access/models.py`

```python
class TenantMember(models.Model):
    class RoleChoices(models.TextChoices):
        OWNER = 'owner', 'Owner'
        ADMIN = 'admin', 'Admin'
        MEMBER = 'member', 'Member'
        VIEWER = 'viewer', 'Viewer'

    tenant = models.ForeignKey(
        CoreTenant, on_delete=models.CASCADE, related_name='members'
    )
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='tenant_memberships'
    )
    role = models.CharField(
        max_length=16, choices=RoleChoices.choices, default=RoleChoices.MEMBER, db_index=True
    )
    invited_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name='+'
    )
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'identity_access_tenantmember'
        unique_together = [('tenant', 'user')]
        indexes = [models.Index(fields=['tenant', 'role'])]
```

### 3.3 TenantInvite (NEW)

File: `packages/core/backend/src/identity_access/models.py`

```python
class TenantInvite(models.Model):
    class StatusChoices(models.TextChoices):
        PENDING = 'pending', 'Pending'
        ACCEPTED = 'accepted', 'Accepted'
        EXPIRED = 'expired', 'Expired'
        REVOKED = 'revoked', 'Revoked'

    tenant = models.ForeignKey(CoreTenant, on_delete=models.CASCADE, related_name='invites')
    email = models.EmailField(db_index=True)
    role = models.CharField(max_length=16, choices=TenantMember.RoleChoices.choices)
    token = models.CharField(max_length=64, unique=True, db_index=True)  # secrets.token_urlsafe(48)
    status = models.CharField(
        max_length=16, choices=StatusChoices.choices, default=StatusChoices.PENDING, db_index=True
    )
    expires_at = models.DateTimeField()  # now() + 7 days
    accepted_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'identity_access_tenantinvite'
        indexes = [models.Index(fields=['tenant', 'status'])]
```

### 3.4 TenantLifecycleEvent (NEW)

File: `packages/core/backend/src/tenant_lifecycle/models.py`

```python
class TenantLifecycleEvent(models.Model):
    class EventType(models.TextChoices):
        PLAN_CHANGED = 'plan_changed', 'Plan Changed'
        STATUS_CHANGED = 'status_changed', 'Status Changed'
        TRIAL_STARTED = 'trial_started', 'Trial Started'
        TRIAL_EXPIRED = 'trial_expired', 'Trial Expired'
        QUOTA_EXCEEDED = 'quota_exceeded', 'Quota Exceeded'
        QUOTA_WARNING = 'quota_warning', 'Quota Warning'
        INVOICE_CREATED = 'invoice_created', 'Invoice Created'
        INVOICE_PAID = 'invoice_paid', 'Invoice Paid'
        INVOICE_OVERDUE = 'invoice_overdue', 'Invoice Overdue'
        MEMBER_INVITED = 'member_invited', 'Member Invited'
        MEMBER_JOINED = 'member_joined', 'Member Joined'
        MEMBER_REMOVED = 'member_removed', 'Member Removed'
        PAT_ROTATED = 'pat_rotated', 'PAT Rotated'
        DEPROVISIONED = 'deprovisioned', 'Deprovisioned'

    tenant = models.ForeignKey(
        'identity_access.CoreTenant',
        on_delete=models.CASCADE,
        related_name='lifecycle_events'
    )
    event_type = models.CharField(max_length=64, choices=EventType.choices, db_index=True)
    actor_type = models.CharField(max_length=32, default='system')  # system/operator/tenant_user
    actor_user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    old_value = models.JSONField(null=True, blank=True)
    new_value = models.JSONField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'tenant_lifecycle_event'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['tenant', 'event_type']),
            models.Index(fields=['tenant', 'created_at']),
        ]
```

---

## 4. Permissions spec

### 4.1 IsTenantActive

File: `packages/core/backend/src/identity_access/permissions.py`

```python
class IsTenantActive(BasePermission):
    """
    Block API access nếu CoreTenant của user đang suspended hoặc deprovisioned.
    Superuser luôn bypass.
    Tenant chưa tồn tại: không block (để IsAuthenticated xử lý).
    """
    message = 'Tài khoản tenant đang bị tạm dừng hoặc đã bị thu hồi. Liên hệ hỗ trợ.'
    BLOCKED_STATUSES = frozenset({'suspended', 'deprovisioned'})

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not user or not user.is_authenticated:
            return True  # Để IsAuthenticated xử lý
        if user.is_superuser:
            return True  # Superuser bypass
        try:
            tenant = CoreTenant.objects.only('status').get(owner_user=user)
            return tenant.status not in self.BLOCKED_STATUSES
        except CoreTenant.DoesNotExist:
            return True  # Tenant chưa có — không block
```

### 4.2 Áp dụng global trong REST_FRAMEWORK settings

File: `packages/core/backend/src/vninvest_core/settings.py`

```python
REST_FRAMEWORK = {
    ...
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
        'identity_access.permissions.IsTenantActive',
    ],
}
```

**Lưu ý**: public endpoints dùng `permission_classes = [AllowAny]` override — không bị ảnh hưởng.

---

## 5. Quota middleware spec

### 5.1 TenantQuotaMiddleware

File: `packages/core/backend/src/identity_access/middleware.py`

```python
class TenantQuotaMiddleware:
    """
    Đếm API calls theo tenant dùng Redis INCR (atomic, < 1ms overhead).
    Flush vào QuotaRecord DB mỗi 60s qua Celery task.
    Block request với 429 nếu vượt api_calls_limit.
    """
    QUOTA_EXEMPT_PATH_PREFIXES = (
        '/health',
        '/api/core/v1/auth/',
        '/api/public/',
        '/admin/',
        '/static/',
    )
    REDIS_KEY_TTL = 86400 * 2  # 2 ngày

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # 1. Skip nếu path exempt
        if self._is_exempt(request.path):
            return self.get_response(request)

        # 2. Skip nếu chưa authenticated (trả về response bình thường để auth middleware xử lý)
        if not hasattr(request, 'user') or not request.user.is_authenticated:
            return self.get_response(request)

        # 3. Superuser bypass
        if request.user.is_superuser:
            return self.get_response(request)

        # 4. Lấy tenant và limit
        tenant_id, limit = self._get_tenant_quota(request.user)
        if tenant_id is None:
            return self.get_response(request)

        # 5. Kiểm tra và increment
        if limit > 0:  # -1 = unlimited
            count = self._increment_and_get(tenant_id)
            if count > limit:
                return JsonResponse(
                    {
                        'error': 'quota_exceeded',
                        'detail': 'Vượt quá giới hạn API trong ngày. Nâng cấp plan để tiếp tục.',
                        'limit': limit,
                        'used': count,
                    },
                    status=429
                )

        return self.get_response(request)

    def _is_exempt(self, path: str) -> bool:
        return any(path.startswith(prefix) for prefix in self.QUOTA_EXEMPT_PATH_PREFIXES)

    def _get_tenant_quota(self, user) -> tuple[str | None, int]:
        """Returns (tenant_public_id, api_calls_limit). Cache trong request."""
        try:
            from commercial.models import QuotaRecord
            from identity_access.models import CoreTenant
            from django.utils import timezone
            today = timezone.now().date()
            tenant = CoreTenant.objects.only('public_id').get(owner_user=user)
            record = QuotaRecord.objects.filter(
                tenant=tenant,
                period_start__lte=today,
                period_end__gte=today,
            ).first()
            limit = record.api_calls_limit if record else -1
            return str(tenant.public_id), limit
        except Exception:
            return None, -1

    def _increment_and_get(self, tenant_id: str) -> int:
        from django.core.cache import cache
        from django.utils import timezone
        key = f'quota:api_calls:{tenant_id}:{timezone.now().date()}'
        count = cache.incr(key, 1)
        # Set TTL chỉ lần đầu (khi key mới tạo, incr trả về 1)
        if count == 1:
            cache.expire(key, self.REDIS_KEY_TTL)
        return count
```

---

## 6. Celery tasks spec

### 6.1 commercial/tasks.py (NEW)

```python
@shared_task(name='commercial.flush_quota_counters', bind=True, max_retries=3)
def flush_quota_counters(self):
    """
    Flush Redis quota counters vào QuotaRecord DB.
    Chạy mỗi 60s. Idempotent — dùng update_or_create.
    """

@shared_task(name='commercial.generate_monthly_invoices', bind=True)
def generate_monthly_invoices(self):
    """
    Tạo Invoice cho mỗi Subscription active ở đầu tháng.
    Invoice number format: INV-{YYYYMM}-{tenant_code}-{sequence:04d}
    """

@shared_task(name='commercial.check_overdue_invoices', bind=True)
def check_overdue_invoices(self):
    """
    Invoice status=open và due_date < today - 7 ngày → status=past_due.
    Invoice status=past_due → suspend tenant + log TenantLifecycleEvent.
    """

@shared_task(name='commercial.send_quota_warning', bind=True)
def send_quota_warning(self, tenant_id: str, percent: int):
    """
    Enqueue email cảnh báo quota. percent = 80 hoặc 100.
    Không gửi nếu đã gửi trong 24h (Redis dedup key).
    """
```

### 6.2 tenant_lifecycle/tasks.py (NEW)

```python
@shared_task(name='tenant_lifecycle.auto_expire_trials', bind=True)
def auto_expire_trials(self):
    """
    Query CoreTenant: status=trial AND trial_ends_at < now() → status=suspended.
    Log TenantLifecycleEvent(TRIAL_EXPIRED).
    Gửi email thông báo.
    """

@shared_task(name='tenant_lifecycle.auto_suspend_quota_overflow', bind=True)
def auto_suspend_quota_overflow(self):
    """
    Query QuotaRecord hôm nay: api_calls_used > api_calls_limit AND limit != -1.
    Tenant tương ứng → status=suspended.
    Log TenantLifecycleEvent(QUOTA_EXCEEDED).
    """

@shared_task(name='tenant_lifecycle.send_trial_expiry_warning', bind=True)
def send_trial_expiry_warning(self):
    """
    Query CoreTenant: status=trial AND trial_ends_at IN [7 ngày, 1 ngày].
    Enqueue email cảnh báo cho tenant owner.
    Redis dedup: chỉ gửi mỗi milestone 1 lần.
    """

@shared_task(name='tenant_lifecycle.auto_deprovision_stale', bind=True)
def auto_deprovision_stale(self):
    """
    Query CoreTenant: status=suspended AND suspended_at < now() - 30 ngày.
    → status=deprovisioned.
    Log TenantLifecycleEvent(DEPROVISIONED).
    """
```

### 6.3 Beat schedule additions

```python
# Thêm vào CELERY_BEAT_SCHEDULE trong settings.py hoặc celery_app.py

'flush-quota-counters': {
    'task': 'commercial.flush_quota_counters',
    'schedule': 60.0,
},
'generate-monthly-invoices': {
    'task': 'commercial.generate_monthly_invoices',
    'schedule': crontab(day_of_month='1', hour='0', minute='5'),
},
'check-overdue-invoices': {
    'task': 'commercial.check_overdue_invoices',
    'schedule': crontab(hour='8', minute='0'),
},
'auto-expire-trials': {
    'task': 'tenant_lifecycle.auto_expire_trials',
    'schedule': crontab(hour='1', minute='0'),
},
'auto-suspend-quota-overflow': {
    'task': 'tenant_lifecycle.auto_suspend_quota_overflow',
    'schedule': 3600.0,
},
'send-trial-expiry-warning': {
    'task': 'tenant_lifecycle.send_trial_expiry_warning',
    'schedule': crontab(hour='9', minute='0'),
},
'auto-deprovision-stale': {
    'task': 'tenant_lifecycle.auto_deprovision_stale',
    'schedule': crontab(day_of_week='0', hour='2', minute='0'),
},
```

---

## 7. Django signals spec

File: `packages/core/backend/src/tenant_lifecycle/signals.py`

```python
from django.db.models.signals import pre_save
from django.dispatch import receiver
from identity_access.models import CoreTenant
from .models import TenantLifecycleEvent


@receiver(pre_save, sender=CoreTenant)
def capture_original_status(sender, instance, **kwargs):
    """Capture status trước khi save để so sánh sau."""
    if instance.pk:
        try:
            instance._original_status = CoreTenant.objects.values_list('status', flat=True).get(pk=instance.pk)
        except CoreTenant.DoesNotExist:
            instance._original_status = None
    else:
        instance._original_status = None


@receiver(post_save, sender=CoreTenant)
def log_status_change(sender, instance, created, **kwargs):
    """Log TenantLifecycleEvent khi status thay đổi."""
    if created:
        TenantLifecycleEvent.objects.create(
            tenant=instance,
            event_type=TenantLifecycleEvent.EventType.TRIAL_STARTED if instance.status == 'trial' else TenantLifecycleEvent.EventType.STATUS_CHANGED,
            actor_type='system',
            new_value={'status': instance.status},
        )
        return

    original = getattr(instance, '_original_status', None)
    if original is not None and original != instance.status:
        TenantLifecycleEvent.objects.create(
            tenant=instance,
            event_type=TenantLifecycleEvent.EventType.STATUS_CHANGED,
            actor_type=getattr(instance, '_actor_type', 'system'),
            actor_user=getattr(instance, '_actor_user', None),
            old_value={'status': original},
            new_value={'status': instance.status},
        )
```

---

## 8. API endpoints spec

### 8.1 Operator write endpoints

```
PATCH  /api/core/v1/operator/tenants/{tenant_id}/
  Body: { "status": "active" | "suspended", "plan": "free" | "starter" | "pro" | "enterprise", "features": [...] }
  Permission: IsAdminUser
  Response 200: tenant snapshot

POST   /api/core/v1/operator/tenants/{tenant_id}/suspend/
  Body: { "reason": "string" }
  Permission: IsAdminUser
  Response 200: { "tenant_id": ..., "status": "suspended", "event_id": ... }

POST   /api/core/v1/operator/tenants/{tenant_id}/activate/
  Body: {}
  Permission: IsAdminUser
  Response 200: { "tenant_id": ..., "status": "active", "event_id": ... }

POST   /api/core/v1/operator/tenants/{tenant_id}/change-plan/
  Body: { "plan": "starter", "reason": "upgrade request" }
  Permission: IsAdminUser
  Response 200: { "tenant_id": ..., "plan": "starter", "event_id": ... }

POST   /api/core/v1/operator/tenants/
  Body: { "display_name": "...", "owner_email": "...", "plan": "free" }
  Permission: IsAdminUser
  Response 201: tenant snapshot

GET    /api/core/v1/operator/tenants/{tenant_id}/lifecycle-events/
  Permission: IsAdminUser
  Response 200: paginated list of TenantLifecycleEvent
```

### 8.2 Onboarding endpoints

```
POST   /api/core/v1/onboarding/register/
  Permission: IsAuthenticated (user đã có account)
  Body: { "display_name": "string", "plan": "trial" }
  Response 201: {
    "tenant_id": "...",
    "status": "trial",
    "trial_ends_at": "ISO8601",
    "welcome_email_queued": true
  }
  Error 409: tenant đã tồn tại cho user này
```

### 8.3 Member management endpoints

```
GET    /api/core/v1/members/
  Permission: IsAuthenticated + IsTenantActive
  Response: paginated list of TenantMember trong tenant của user

POST   /api/core/v1/members/invite/
  Permission: IsAuthenticated + IsTenantActive + role in [owner, admin]
  Body: { "email": "...", "role": "member" }
  Response 201: { "invite_id": ..., "token": ..., "expires_at": ... }

DELETE /api/core/v1/members/{user_id}/
  Permission: IsAuthenticated + IsTenantActive + role in [owner, admin]
  Response 204

GET    /api/core/v1/invites/accept/
  Permission: AllowAny
  Query params: ?token=<token>
  Response 200: { "tenant_id": ..., "role": ..., "joined": true }
  Error 404: token invalid
  Error 410: token expired
```

---

## 9. SSOT migration spec (T01 + T02)

### 9.1 Xoá CoreTenant khỏi backend/portfolio/models.py

**Approach**: Thay `class CoreTenant(models.Model):` bằng re-export từ packages/core.

```python
# backend/portfolio/models.py — thay block dòng 1140–1250
# TRƯỚC:
class CoreTenant(models.Model):
    ...  # toàn bộ class definition

# SAU (chỉ một dòng):
from identity_access.models import CoreTenant  # noqa: F401 — re-export for backward compat
```

**Lưu ý**: Django không thể có cùng một `db_table` từ hai app khác nhau. Vì `identity_access_coretenant` và `portfolio_coretenant` hiện là cùng bảng (nhờ explicit `db_table`), re-export là đủ. Cần verify `python manage.py check` PASS.

### 9.2 Refactor backend/core_pat_auth.py

```python
# TRƯỚC (raw SQL):
cursor.execute(
    "SELECT owner_user_id FROM identity_access_coretenant WHERE id = %s",
    [matched_tenant_id]
)
row = cursor.fetchone()

# SAU (ORM):
from identity_access.models import CoreTenant
try:
    tenant = CoreTenant.objects.select_related('owner_user').get(pk=matched_tenant_id)
    user = tenant.owner_user
except CoreTenant.DoesNotExist:
    return None  # Invalid tenant
```

---

## 10. tenant_lifecycle Django app bootstrap

```
packages/core/backend/src/tenant_lifecycle/
├── __init__.py
├── apps.py            ← TenantLifecycleConfig, ready() đăng ký signals
├── models.py          ← TenantLifecycleEvent
├── signals.py         ← pre_save, post_save handlers
├── tasks.py           ← Celery automation tasks
├── admin.py           ← TenantLifecycleEventAdmin (readonly)
├── migrations/
│   └── 0001_initial.py
└── tests/
    ├── test_models.py
    ├── test_tasks.py
    └── test_signals.py
```

**apps.py**:

```python
class TenantLifecycleConfig(AppConfig):
    name = 'tenant_lifecycle'
    default_auto_field = 'django.db.models.BigAutoField'

    def ready(self):
        import tenant_lifecycle.signals  # noqa: F401
```

**INSTALLED_APPS addition** (`settings.py`):

```python
INSTALLED_APPS = [
    ...
    'tenant_lifecycle',
]
```

---

## 11. Performance constraints

| Component | Constraint |
|---|---|
| `TenantQuotaMiddleware` | Overhead < 2ms per request (Redis INCR = O(1)) |
| `flush_quota_counters` | Batch upsert — không INSERT row-by-row |
| `IsTenantActive.has_permission` | Dùng `.only('status')` — không fetch toàn bộ CoreTenant |
| `auto_expire_trials` | Dùng `queryset.update()` + `TenantLifecycleEvent.objects.bulk_create()` |
| Operator tenant list | Annotate counts tại DB layer — không N+1 |

---

## 12. Security requirements

1. **Token invite**: dùng `secrets.token_urlsafe(48)` — không dùng UUID4.
2. **Invite expiry**: bắt buộc check `expires_at` + `status != accepted` trước khi chấp nhận.
3. **Operator actions**: phải log `actor_user`, `ip_address` vào `TenantLifecycleEvent`.
4. **Quota dedup**: Redis key `quota:warning_sent:{tenant_id}:{date}:{percent}` — không gửi email cảnh báo trùng trong ngày.
5. **`IsTenantActive` bypass rule**: chỉ `is_superuser` bypass — không bypass cho `is_staff` thường.
