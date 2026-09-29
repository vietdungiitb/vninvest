# Giải pháp tổng thể: PAT & API Usage Analytics System

> Ngày: 2026-07-10
> Mục tiêu: Hệ thống quản lý thống kê PAT/API usage cho tenant, tương đương các phần mềm thương mại (GitHub, GitLab, Stripe)

---

## 1. Hiện trạng

### Đã có sẵn

| Component | File | Status |
|---|---|---|
| `AuditEvent` — 219k records, IP/path/status/duration/tenant_id | `ops_audit/middleware.py` | ✅ Hoạt động |
| `TenantQuotaMiddleware` — Redis counter + check limit | `identity_access/middleware.py:193` | ✅ Hoạt động |
| `QuotaRecord` — monthly quota snapshot | `commercial/models.py:38` | ✅ Cập nhật mỗi 60s |
| `flush_quota_counters` (Celery 60s) — Redis → QuotaRecord | `commercial/tasks.py` | ✅ Hoạt động |
| `partner/usage/meters/` — expose QuotaHistory | `identity_access/commercial_partner_views.py` | ✅ Có |
| `partner/security/login-activity/` — login IP analytics | `identity_access/views_security.py` | ✅ Có |
| `CorePATCredential.last_used_at` — last used timestamp | `identity_access/models.py` | ✅ Có |
| `UsageAlertConfig` — alert thresholds config | `identity_access/models.py:965` | ✅ Có model |
| `RequestTrace` model — full request trace (chưa dùng) | `ops_audit/models.py:44` | ⚠️ Model nhưng không ai ghi |

### Bugs hiện tại

| Bug | Mô tả | Mức độ |
|---|---|---|
| `snapshot_quota_history` không schedule | Task định nghĩa nhưng không trong `CELERY_BEAT_SCHEDULE` | 🔴 Critical |
| Meter code mismatch | Views dùng `ai_regenerate`/`whale_symbols`/`exports` nhưng snapshot ghi `symbols`/`users`/`storage_mb` | 🔴 Critical |
| Alert không enforce | `UsageAlertConfig` tồn tại nhưng không có task kiểm tra ngưỡng | 🟠 Major |
| `api_calls_used` không update | `CoreTenant.api_calls_used` field tồn tại nhưng không bao giờ được ghi | 🟠 Major |
| Tenant `api_calls_limit`/`api_calls_used` bị exclude khỏi serializer | `CoreTenantSerializer` không expose 2 field này | 🟡 Minor |

---

## 2. Giải pháp 5 Phase

### Phase 0 — Fix lõi (1-2 ngày)

**Mục tiêu:** Sửa các bugs critical/major để luồng dữ liệu usage hoạt động đúng.

#### Tasks

| # | Task | File | Chi tiết |
|---|---|---|---|
| 0.1 | Register `snapshot_quota_history` vào Celery Beat | `vninvest_core/settings.py` | Thêm crontab daily 23:55 |
| 0.2 | Fix meter codes đồng bộ | `commercial/tasks.py` | Đổi `symbols`→`whale_symbols`, `users`→`(xóa)`, `storage_mb`→`(xóa)`, thêm `ai_regenerate`, `exports` |
| 0.3 | Fix `views_usage_trend.py` valid meters | `identity_access/views_usage_trend.py` | Đồng bộ danh sách meter_code |
| 0.4 | Update `CoreTenant.api_calls_used` từ Redis | `identity_access/middleware.py` hoặc `commercial/tasks.py` | Ghi giá trị sau mỗi lần flush |
| 0.5 | Update `CorePATCredential.last_used_at` trong middleware | `identity_access/middleware.py` | Ghi timestamp mỗi request authenticated |
| 0.6 | Expose `api_calls_limit`/`api_calls_used` trong serializer | `identity_access/serializers.py` | Thêm vào `CoreTenantSerializer` |

### Phase 1 — PAT-level Usage Tracking (2-3 ngày)

**Mục tiêu:** Track từng PAT credential — ai gọi, gọi endpoint nào, từ IP nào.

#### Model mới: `PATAuditLog`

```python
class PATAuditLog(models.Model):
    pat = ForeignKey(CorePATCredential, related_name='audit_logs')
    tenant = ForeignKey(CoreTenant)
    ip_address = GenericIPAddressField()
    endpoint = CharField(256)       # /core/v1/identity/profile/
    method = CharField(8)            # GET/POST/PATCH/DELETE
    status_code = SmallIntegerField()
    user_agent = TextField(blank=True)
    duration_ms = IntegerField()
    auth_source = CharField(16)      # 'pat' | 'session' | 'jwt'
    occurred_at = DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'identity_access_pat_audit_log'
        indexes = [
            models.Index(fields=['pat', 'occurred_at']),
            models.Index(fields=['tenant', 'occurred_at']),
            models.Index(fields=['ip_address']),
        ]
```

#### Ghi dữ liệu

- **Middleware:** Ghi 1 row từ `TenantQuotaMiddleware` khi request authenticated
- **Batch queue:** Dùng Django's `on_commit` + background thread để không block response
- **Giới hạn:** Chỉ ghi với PAT credentials (`request.auth` là `CorePATCredential`)

#### API mới

| Endpoint | Method | Trả về |
|---|---|---|
| `GET /partner/pats/<id>/usage/` | GET | Per-PAT: total calls, top IPs, top endpoints, status distribution, timeline |
| `GET /partner/pats/usage-summary/` | GET | Tổng hợp all PATs: active/inactive, calls breakdown, expiring soon |
| `GET /partner/service-accounts/<id>/usage/` | GET | Per-ServiceAccount: PATs breakdown, total calls |

### Phase 2 — API Analytics Dashboard (3-4 ngày)

**Mục tiêu:** Tenant admin có thể xem ai gọi API nào, từ IP nào, thành công/thất bại ra sao.

#### View mới: `partner_api_usage`

Query từ `AuditEvent` + `PATAuditLog`:

```python
@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTenantActive])
def partner_api_usage(request):
    """
    GET /partner/usage/api-calls/
    Query params:
      - group_by: ip | endpoint | status | pat | hour
      - days: int (default 7, max 90)
      - status: int (filter by status code)
      - method: str (filter by HTTP method)
      - endpoint: str (filter by path pattern)
    """
```

#### API mới

| Endpoint | Query Params | Trả về |
|---|---|---|
| `GET /partner/usage/api-calls/` | `group_by=ip&days=7` | Top caller IPs + count + unique endpoints |
| `GET /partner/usage/api-calls/` | `group_by=endpoint&days=7` | Top endpoints + count + avg latency + status breakdown |
| `GET /partner/usage/api-calls/` | `group_by=status&days=30` | Success/4xx/5xx rates + total calls |
| `GET /partner/usage/api-calls/` | `group_by=pat&days=7` | Per-PAT breakdown (Phase 1 required) |
| `GET /partner/usage/api-calls/timeline/` | `interval=hour\|day&days=7` | Time series call volume |
| `GET /partner/usage/api-calls/export/` | `format=csv&days=30` | Export raw data |

### Phase 3 — Alert Enforcement (2 ngày)

**Mục tiêu:** Ngưỡng cảnh báo trong `UsageAlertConfig` thực sự gửi được thông báo.

#### Task mới: `check_usage_thresholds`

```python
@shared_task(bind=True, max_retries=3)
def check_usage_thresholds(self):
    """
    Celery task chạy mỗi 5 phút.
    So sánh Redis counter vs UsageAlertConfig cho từng tenant/meter.
    Nếu vượt ngưỡng → email + webhook + TenantLifecycleEvent.
    """
```

#### Chi tiết

| Hành động | Khi vượt warning_pct | Khi vượt critical_pct |
|---|---|---|
| Ghi `TenantLifecycleEvent` | `quota_warning` | `quota_exceeded` |
| Gửi email | ✅ Có (dùng existing mail template) | ✅ Có |
| Webhook | ✅ `notification.quota_warning` | ✅ `notification.quota_exceeded` |
| Chặn API | ❌ Không | ✅ `TenantQuotaMiddleware` trả 429 |

### Phase 4 — Rate Limiting by PAT (2-3 ngày)

**Mục tiêu:** Rate limiting theo từng PAT credential (không chỉ global IP-based).

#### Throttle class mới

```python
class PATRateThrottle(BaseThrottle):
    """
    Rate limit theo CorePATCredential.
    Rate: configured per-plan hoặc per-tenant.
    """
    scope = 'pat'

    def get_cache_key(self, request, view):
        pat = getattr(request, 'auth', None)
        if not isinstance(pat, CorePATCredential):
            return None
        return f'throttle_pat_{pat.public_id}'
```

#### Response headers

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 842
X-RateLimit-Reset: 1688976000
X-RateLimit-Resource: pat:vni_free_abc123
```

#### Cấu hình rate theo plan

| Plan | Rate |
|---|---|
| Free | 100/hour |
| Starter | 1000/hour |
| Pro | 10000/hour |
| Enterprise | Unlimited |

---

## 3. Kiến trúc tổng thể

```
HTTP Request
    │
    ▼
[RequestTraceMiddleware] ───→ AuditEvent (giữ nguyên, không đổi)
    │
    ▼
[TenantResolutionMiddleware] ───→ request.tenant
    │
    ▼
[TenantQuotaMiddleware] ───→ Redis counter
    │   ├── Update CoreTenant.api_calls_used
    │   ├── Update CorePATCredential.last_used_at
    │   └── Batch write → PATAuditLog (Phase 1)
    │
    ▼
[PATRateThrottle] (Phase 4) ───→ X-RateLimit-* headers
    │
    ▼
[DRF Throttling] ───→ UserRateThrottle (global)
    │
    ▼
[API Response] ───→ success/fail với headers
    │
    ▼
[Celery Beat Tasks]
├── [60s]  flush_quota_counters    → QuotaRecord + CoreTenant.api_calls_used
├── [daily] snapshot_quota_history → QuotaHistory (Phase 0 fix)
├── [5min] check_usage_thresholds → Email + Webhook + LifecycleEvent (Phase 3)
└── [3600s] auto_suspend_quota_overflow → Suspend tenant (giữ nguyên)
```

---

## 4. API Endpoints Summary

### Hiện tại (giữ nguyên)

| Endpoint | Mô tả |
|---|---|
| `GET /partner/usage/meters/` | Latest quota snapshot per meter |
| `GET /partner/usage/quotas/` | Same as meters |
| `GET /partner/usage/history/` | Daily quota history |
| `GET /partner/usage/trend/` | All meters trend |
| `GET /partner/usage/trend/<meter_code>/` | Single meter trend |
| `GET /partner/usage/forecast/` | Usage forecast |
| `GET /partner/usage/alert-config/` | Alert thresholds |
| `GET /partner/security/login-activity/` | Login analytics |

### Mới (các Phase)

| Phase | Endpoint | Mô tả |
|---|---|---|
| P1 | `GET /partner/pats/<id>/usage/` | Per-PAT usage breakdown |
| P1 | `GET /partner/pats/usage-summary/` | All PATs usage summary |
| P1 | `GET /partner/service-accounts/<id>/usage/` | Per-SA usage breakdown |
| P2 | `GET /partner/usage/api-calls/` | API analytics (group_by IP/endpoint/status/pat) |
| P2 | `GET /partner/usage/api-calls/timeline/` | Time series call volume |
| P2 | `GET /partner/usage/api-calls/export/` | CSV export |
| P4 | Rate limit headers on all responses | `X-RateLimit-*` |

---

## 5. Migration Plan

### Thứ tự ưu tiên

```
Phase 0 ─→ Phase 1 ─→ Phase 2 ─→ Phase 3 ─→ Phase 4
(fix lỗi)  (PAT log)  (analytics) (alert)    (rate limit)
```

### Phase 0 — Critical path

1. Register `snapshot_quota_history` → daily QuotaHistory tự động
2. Fix meter codes → data đồng bộ giữa snapshot và views
3. Update `last_used_at` + `api_calls_used` → số liệu realtime
4. Expose limit/used trong serializer → tenant thấy được

### Risks

| Risk | Mitigation |
|---|---|
| `PATAuditLog` có thể lớn (~10M rows/tháng) | Retention policy: xóa sau 90 ngày, aggregate vào daily summary |
| Ghi DB trong middleware có thể chậm | Batch write + async queue |
| Rate limit by PAT có thể gây false positive | Grace period + clear error message |

---

## 6. So sánh với Commercial Software

### GitHub API Usage

| GitHub | VNInvest (hiện tại) | VNInvest (sau giải pháp) |
|---|---|---|
| PAT usage dashboard | ❌ Không có | ✅ Phase 1 + 2 |
| Per-token call count | ❌ Không | ✅ Phase 1 |
| Rate limit headers | ❌ Không | ✅ Phase 4 |
| IP allowlist | ✅ CIDR blocks | ✅ Giữ nguyên |
| Audit log (event) | ✅ TenantLifecycleEvent | ✅ Giữ nguyên |
| API analytics by endpoint | ❌ Không | ✅ Phase 2 |
| Usage alerts | ⚠️ Config only | ✅ Phase 3 |

### Stripe API Usage

| Stripe | VNInvest (hiện tại) | VNInvest (sau giải pháp) |
|---|---|---|
| Request volume chart | ❌ Không | ✅ Phase 2 timeline |
| Status code breakdown | ❌ Không | ✅ Phase 2 group_by=status |
| Top source IPs | ❌ Không | ✅ Phase 2 group_by=ip |
| Response time | ✅ AuditEvent có | ✅ Phase 2 expose avg latency |
| Monthly usage report | ✅ ScheduledReport | ✅ Giữ nguyên |

---

## 7. Files cần thay đổi

### Phase 0

| File | Thay đổi |
|---|---|
| `vninvest_core/settings.py` | Thêm `snapshot_quota_history` vào beat schedule |
| `commercial/tasks.py` | Fix meter codes trong `snapshot_quota_history` |
| `identity_access/views_usage_trend.py` | Fix valid meters list |
| `identity_access/middleware.py` | Update `last_used_at` + `api_calls_used` |
| `identity_access/serializers.py` | Expose `api_calls_limit` + `api_calls_used` |
| `packages/web/src/...` | Frontend hiển thị limit/used |

### Phase 1

| File | Thay đổi |
|---|---|
| `identity_access/models.py` | Thêm `PATAuditLog` model |
| `identity_access/middleware.py` | Ghi `PATAuditLog` |
| `identity_access/partner_urls.py` | Thêm 3 endpoint mới |
| `identity_access/views_tenant.py` | Thêm 3 view mới |
| `identity_access/serializers.py` | Thêm serializer cho PATAuditLog |

### Phase 2

| File | Thay đổi |
|---|---|
| `identity_access/partner_urls.py` | Thêm 3 endpoint mới |
| `identity_access/views_usage.py` (NEW) | `partner_api_usage`, `partner_api_timeline`, `partner_api_export` |
| `identity_access/serializers.py` | Analytics serializers |

### Phase 3

| File | Thay đổi |
|---|---|
| `commercial/tasks.py` | Thêm `check_usage_thresholds` task |
| `vninvest_core/settings.py` | Thêm task vào beat schedule (5 min) |
| `identity_access/notifications.py` (NEW) | Email + webhook notification helpers |

### Phase 4

| File | Thay đổi |
|---|---|
| `identity_access/throttles.py` (NEW) | `PATRateThrottle` class |
| `vninvest_core/settings.py` | Thêm vào `DEFAULT_THROTTLE_CLASSES` |

---

## 8. Tổng effort

| Phase | Effort | Dependencies |
|---|---|---|
| Phase 0: Fix lõi | 1-2 ngày | Không |
| Phase 1: PAT tracking | 2-3 ngày | Phase 0 |
| Phase 2: API analytics | 3-4 ngày | Phase 1 |
| Phase 3: Alert enforcement | 2 ngày | Phase 0 |
| Phase 4: Rate limiting | 2-3 ngày | Phase 1 |
| **Tổng** | **10-14 ngày** | |
