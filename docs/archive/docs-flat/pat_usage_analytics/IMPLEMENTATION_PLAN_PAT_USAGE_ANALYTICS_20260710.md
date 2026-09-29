# Kế hoạch thực hiện: PAT & API Usage Analytics System

> Phiên bản: 1.1 — 2026-07-10 (fix all review issues)
> Tổng effort: 14 ngày ±2
> Bàn giao cho: Đội code core-api + frontend

---

## Cấu trúc phase

Mỗi phase gồm:
- **Mục tiêu**: Kết quả mong đợi sau phase
- **Checklist code**: Các file cần thay đổi + nội dung cụ thể
- **Audit checklist**: Đội QA/lead kiểm tra sau khi merge — mỗi mục phải pass thì phase mới hoàn thành
- **Rollback plan**: Cách revert nếu gặp sự cố

---

## Phase 0 — Fix lõi (Critical Path)

### Mục tiêu
Luồng dữ liệu usage hoạt động đúng: Redis counter → QuotaRecord → QuotaHistory. PAT `last_used_at` được update. Meter codes đồng bộ giữa snapshot và views. Tenant thấy được `api_calls_limit`/`api_calls_used`.

### Checklist code

| # | Task | File | Thay đổi |
|---|---|---|---|
| 0.1 | Register snapshot_quota_history vào Celery Beat | `vninvest_core/settings.py` | Thêm vào `CELERY_BEAT_SCHEDULE`: task `commercial.tasks.snapshot_quota_history`, schedule `crontab(minute=55, hour=23)`, queue `celery` |
| 0.2 | Fix meter codes trong snapshot task | `commercial/tasks.py` — function `snapshot_quota_history` | Đổi: `symbols` → `whale_symbols`, bỏ `users` và `storage_mb`, thêm `ai_regenerate` và `exports`. Dùng plan-based mapping: free/starter không có `ai_regenerate`, pro/enterprise có full. |
| 0.3 | Fix valid meters list trong views | `identity_access/views_usage_trend.py` | `VALID_METERS = {'api_calls', 'ai_regenerate', 'whale_symbols', 'exports'}` — đồng bộ với task |
| 0.4 | Update CorePATCredential.last_used_at | `identity_access/middleware.py` — trong `TenantQuotaMiddleware.process()` | Sau khi increment Redis counter, nếu `request.auth` là `CorePATCredential`: `CorePATCredential.objects.filter(pk=credential.pk).update(last_used_at=timezone.now())` **(phải filter pk=credential.pk để tránh update toàn bộ)** |
| 0.5 | Update CoreTenant.api_calls_used từ Redis | `commercial/tasks.py` — trong `flush_quota_counters` | Sau khi upsert `QuotaRecord`, đọc Redis counter và ghi: `CoreTenant.objects.filter(pk=tenant.pk).update(api_calls_used=redis_value)` |
| 0.6 | Expose api_calls_limit/api_calls_used trong serializer | `identity_access/serializers.py` — `CoreTenantSerializer` | Thêm 2 field: `api_calls_limit = serializers.IntegerField(read_only=True)`, `api_calls_used = serializers.IntegerField(read_only=True)` |
| 0.7 | Frontend hiển thị limit/used | `packages/web/src/pages/tenant-admin/TenantAdminUsagePage.js` | Thêm card "API Calls Usage" hiển thị `used / limit` với progress bar, color coding (<80% xanh, 80-95% vàng, >95% đỏ) |

### Audit checklist (phải pass hết)

| ID | Mục kiểm tra | Cách test | Expected |
|---|---|---|---|
| A0.1 | `snapshot_quota_history` schedule | `docker exec core-api python -c "from django.conf import settings; print([t for t in settings.CELERY_BEAT_SCHEDULE if 'snapshot' in t])"` | Task tồn tại, schedule đúng |
| A0.2 | Meter codes đồng bộ | `curl /partner/usage/trend/ai_regenerate/?days=7` | Trả về `{meter_code: "ai_regenerate", daily: [...]}` — **Cần verify view này đã support meter_code param. Nếu chưa, sửa view trước.** |
| A0.3 | QuotaHistory tự động tạo | Check DB: `select * from commercial_quotahistory where date = current_date` | Có row cho mỗi meter code |
| A0.4 | `last_used_at` được update | Gọi API với PAT → check DB: `select last_used_at from identity_access_pat_credential` | Cập nhật sau mỗi request |
| A0.5 | `api_calls_used` được sync với Redis | Gọi API 3 lần → `curl /partner/tenant/` trả về `api_calls_used` | Giá trị >0 |
| A0.6 | Tenant thấy được usage UI | Mở `/tenant-admin/usage` | Progress bar hiển thị đúng số |
| A0.7 | Không regression trên các endpoint cũ | Chạy `partner/usage/meters/`, `partner/usage/trend/`, `partner/dashboard/summary/` | Trả về 200, data đúng format |

### Rollback

```bash
# Xác định số commits trong phase
git log --oneline HEAD~5..HEAD  # kiểm tra số lượng
# Revert toàn bộ phase (N = số commits)
git revert --no-commit HEAD~N..HEAD
git commit -m "revert: Phase 0 PAT analytics"
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d core-api
```

---

## Phase 1 — PAT-level Usage Tracking

### Mục tiêu
Mỗi request authenticated bằng PAT được ghi log riêng: PAT nào gọi, endpoint nào, từ IP nào, HTTP method, status code, duration, user agent. Tenant admin xem được usage của từng PAT.

### Checklist code

| # | Task | File | Thay đổi |
|---|---|---|---|
| 1.1 | Thêm migration: PATAuditLog model | `identity_access/models.py` | Model `PATAuditLog` với fields: `pat` (FK CorePATCredential), `tenant` (FK CoreTenant), `ip_address`, `endpoint` (CharField 256), `method` (CharField 8), `status_code` (SmallIntegerField), `user_agent` (TextField), `duration_ms` (IntegerField), `auth_source` (CharField 16: 'pat'/'session'), `occurred_at` (DateTimeField auto_now_add). Indexes: `(pat, occurred_at)`, `(tenant, occurred_at)`, `(ip_address)`. DB table: `identity_access_pat_audit_log`. |
| 1.2 | Thêm migration: AuditEvent.pat_id nullable | `ops_audit/models.py` | Thêm `pat_id = CharField(36, null=True, blank=True, db_index=True)` |
| 1.3 | Ghi PATAuditLog trong middleware bằng batch write queue | `identity_access/middleware.py` — `TenantQuotaMiddleware` | Sau `_increment_daily_counter`, kiểm tra `request.auth` là `CorePATCredential` → append vào **in-memory list** `request._pat_audit_entries` (list of dict). Không ghi DB ngay. Task `flush_pat_audit_log` chạy mỗi 10s (internal worker, queue `celery`): đọc queue ghi bulk_create. **KHÔNG dùng threading.Thread** — dangerous (no error handling, worker chết không retry). **KHÔNG dùng on_commit + Celery** — latency. |
| 1.4 | UPDATE AuditEvent.pat_id batch | Task mới `cross_ref_pat_audit_events` trong `commercial/tasks.py` hoặc `ops_audit/tasks.py` | Task chạy mỗi 60s. **Cần xác nhận AuditEvent có field `request_id`**. Nếu không có: dùng mechanism khác (VD: tham chiếu bằng `occurred_at` + `ip_address` + `endpoint` gần đúng, hoặc thêm `request_id` vào AuditEvent trước). **Giải pháp fallback**: bỏ cross-ref, PATAuditLog đã đủ cho per-PAT query. |
| 1.5 | View: per-PAT usage | `identity_access/views_tenant.py` | `PatUsageView`: GET `/partner/pats/<public_id>/usage/?days=30`. Trả về: `pat_id`, `label`, `total_calls`, `unique_ips`, `top_endpoints` (top 10), `status_breakdown` (2xx/4xx/5xx counts), `timeline` (daily call count), `last_used_at`, `expires_at`. |
| 1.6 | View: all PATs usage summary | `identity_access/views_tenant.py` | `PatUsageSummaryView`: GET `/partner/pats/usage-summary/`. Trả về: `total_pats`, `active_pats`, `total_calls_30d`, `pats_usage` (list: mỗi PAT có `id`, `label`, `calls_30d`, `last_used_at`). Query từ `PATAuditLog` aggregate. |
| 1.7 | View: per-ServiceAccount usage | `identity_access/views_tenant.py` | `ServiceAccountUsageView`: GET `/partner/service-accounts/<public_id>/usage/?days=30`. Trả về: `sa_id`, `name`, `total_pats`, `total_calls`, `pats` (list usage per PAT). |
| 1.8 | URLs — thêm 3 routes với thứ tự cụ thể | `identity_access/partner_urls.py` | THỨ TỰ CHÍNH XÁC:<br>`path('partner/pats/usage-summary/', PatUsageSummaryView.as_view(), name='pat-usage-summary'),`  ← TRƯỚC<br>`path('partner/pats/<str:pat_id>/usage/', PatUsageView.as_view(), name='pat-usage'),`  ← SAU<br>`path('partner/service-accounts/<str:sa_id>/usage/', ServiceAccountUsageView.as_view(), name='sa-usage'),`<br>**Phải đặt `usage-summary` trước `<str:pat_id>` để tránh DRF coi 'usage-summary' là pat_id.** |
| 1.9 | Serializers | `identity_access/serializers.py` | `PATAuditLogSerializer`, `PatUsageSerializer`, `PatUsageSummarySerializer`, `ServiceAccountUsageSerializer` |
| 1.10 | Frontend: PAT usage page | `packages/web/src/pages/tenant-admin/TenantAdminPATsPage.js` | Mỗi dòng PAT thêm button "Usage" → modal/drawer hiển thị: chart timeline 30 ngày, top endpoints, status breakdown, IP list |

### Audit checklist

| ID | Mục kiểm tra | Cách test | Expected |
|---|---|---|---|
| A1.1 | PATAuditLog được ghi | Gọi 1 API với PAT → check DB sau 30s (cho batch flush) | Row `PATAuditLog` tồn tại với đúng pat_id, endpoint, IP |
| A1.2 | Không ghi cho anonymous request | Gọi API không auth → check DB | Không có row PATAuditLog mới |
| A1.3 | AuditEvent.pat_id được update | Chạy cross-ref task → check AuditEvent row (hoặc bỏ qua nếu dùng fallback) | `pat_id` không null, trùng với pat thật |
| A1.4 | Per-PAT usage API | `curl /partner/pats/<id>/usage/` | Trả về: top 10 endpoints, status breakdown, timeline |
| A1.5 | Usage summary API | `curl /partner/pats/usage-summary/` | `total_pats`, `total_calls_30d` > 0 |
| A1.6 | SA usage API | `curl /partner/service-accounts/<id>/usage/` | `total_pats` > 0, mỗi PAT có `calls_30d` |
| A1.7 | Frontend hiển thị | Mở PAT page → click "Usage" | Modal có chart, endpoints list |
| A1.8 | Performance: API trả về < 500ms | Đo response time với 1000+ event | < 500ms |
| A1.9 | **Middleware không có synchronous DB write** | Kiểm tra code: trong `process()` không có `PATAuditLog.objects.create()` — chỉ queued | Không có DB write synchronous trong hot path |

### Rollback

```bash
# 1. Remove routes, views, serializers (git revert + 1 commit)
# 2. Drop table migration — dùng lệnh migrate đến migration trước Phase 1 (không hardcode số)
python manage.py showmigrations identity_access  # kiểm tra số migration hiện tại
python manage.py migrate identity_access <prev_migration>
# 3. Restart
docker compose up -d core-api
```

---

## Phase 2 — API Analytics Dashboard

### Mục tiêu
Tenant admin xem được: top caller IPs, top endpoints, success/error rates, latency, time series call volume. Dữ liệu từ `AuditEvent` + `PATAuditLog` aggregated vào `ApiCallRollup` để query nhanh.

### Checklist code

| # | Task | File | Thay đổi |
|---|---|---|---|
| 2.1 | Model ApiCallRollup | `ops_audit/models.py` | Model mới: `tenant` (FK CoreTenant), `date` (DateField), `hour` (IntegerField nullable — null = daily total), `ip_address` (GenericIPAddressField nullable — null = all IPs), `endpoint_group` (CharField 64 nullable — null = all endpoints), `status_group` (CharField 8 nullable: '2xx'/'4xx'/'5xx'), `call_count` (IntegerField), `error_count` (IntegerField), `total_duration_ms` (BigIntegerField). Composite index: `(tenant, date, endpoint_group, status_group)`. DB table: `ops_audit_api_call_rollup`. |
| 2.2 | Rollup aggregation task với watermark + endpoint_group mapping | `commercial/tasks.py` hoặc `ops_audit/tasks.py` | Task `aggregate_api_call_rollup`, schedule 5 phút. **Dùng watermark (last_processed_id) thay vì time window để không miss events:**<br>`last_id = Cache.get('rollup_last_id') or 0`<br>`rows = AuditEvent.objects.filter(id__gt=last_id).values(...).annotate(...)`<br>`Cache.set('rollup_last_id', max_id)`<br>**Endpoint_group mapping table** (dict trong code, không regex):<br>`ENDPOINT_GROUPS = {'/core/v1/identity': 'identity', '/core/v1/partner': 'partner', '/core/v1/commercial': 'commercial', ...}`<br>**Fallback**: nếu path không khớp mapping → group = 'other'. |
| 2.3 | Register aggregation task | `vninvest_core/settings.py` | Thêm vào `CELERY_BEAT_SCHEDULE`: `aggregate-api-call-rollup`, every 300s, queue `celery` **(không dùng `analytics_heavy` nếu chưa chắc worker subscribe)** |
| 2.4 | View: API analytics group_by | `identity_access/views_usage.py` (NEW) | `PartnerApiUsageView`: GET `/partner/usage/api-calls/?group_by=ip\|endpoint\|status\|hour&days=7`. Query từ `ApiCallRollup`. Filter: `days` (default 7, max 90), `status` (200/4xx/5xx), `method` (GET/POST), `endpoint` (pattern). Response: `{group_by: "...", data: [{key, count, error_count, avg_duration_ms, ...}]}`.<br>**Raw query fallback**: nếu `days <= 1`, query trực tiếp `AuditEvent` thay vì rollup (để có per-endpoint precision). |
| 2.5 | View: timeline | `identity_access/views_usage.py` | `PartnerApiUsageTimelineView`: GET `/partner/usage/api-calls/timeline/?interval=hour\|day&days=7`. Response: `{interval, data: [{timestamp, total_calls, success_count, error_count}]}` |
| 2.6 | View: export CSV | `identity_access/views_usage.py` | `PartnerApiUsageExportView`: GET `/partner/usage/api-calls/export/?days=30&format=csv`. Stream CSV response. Columns: date, time, ip, method, endpoint, status, duration_ms, pat_id, user_agent |
| 2.7 | URLs | `identity_access/partner_urls.py` | Thêm 3 routes mới |
| 2.8 | Serializers | `identity_access/serializers.py` | `ApiUsageGroupSerializer`, `ApiUsageTimelineSerializer` |
| 2.9 | Frontend: Usage analytics tab | `packages/web/src/pages/tenant-admin/TenantAdminUsagePage.js` | Thêm tab "API Analytics": group_by dropdown, date range picker, table + chart. Tab mặc định: 7-day timeline chart, top 10 endpoints, top 10 IPs, success rate % |

### Audit checklist

| ID | Mục kiểm tra | Cách test | Expected |
|---|---|---|---|
| A2.1 | Rollup table có data | Chờ 5 phút sau deploy → query DB `select count(*) from ops_audit_api_call_rollup` | >0 rows |
| A2.2 | group_by=ip | `curl /partner/usage/api-calls/?group_by=ip&days=1` | Top IPs list, mỗi IP có count |
| A2.3 | group_by=endpoint | `curl /partner/usage/api-calls/?group_by=endpoint&days=7` | Top endpoints với count, avg_duration |
| A2.4 | group_by=status | `curl /partner/usage/api-calls/?group_by=status&days=30` | 2xx/4xx/5xx breakdown |
| A2.5 | Timeline | `curl /partner/usage/api-calls/timeline/?interval=day&days=7` | 7 data points, mỗi điểm có total/success/error |
| A2.6 | Export CSV | `curl /partner/usage/api-calls/export/?days=7` | CSV content với header row |
| A2.7 | Filter status | `curl "/partner/usage/api-calls/?group_by=endpoint&status=5xx"` | Chỉ endpoint có 5xx |
| A2.8 | Frontend tab | Mở `/tenant-admin/usage` → chọn tab "API Analytics" | Chart + table hiển thị |
| A2.9 | Performance: analytics API < 2s | Với 100k+ events trong rollup | < 2s response |
| A2.10 | **Rollup data không phình** | Kiểm tra total rows sau 1 ngày | **Total rollup rows ≤ 5 × số ngày × số tenant** (concrete threshold) |

### Rollback

```bash
# 1. Remove views, URLs, serializers (git revert)
# 2. Drop task từ Celery Beat (comment out)
# 3. Drop table migration
python manage.py showmigrations ops_audit  # kiểm tra số migration hiện tại
python manage.py migrate ops_audit <prev_migration>
# 4. Restart worker + core-api
docker compose up -d core-api celery-worker
```

---

## Phase 3 — Alert Enforcement

### Mục tiêu
Ngưỡng cảnh báo trong `UsageAlertConfig` thực sự gửi được email + webhook + ghi `TenantLifecycleEvent`. Cooldown 6h giữa các lần gửi để tránh spam.

### Checklist code

| # | Task | File | Thay đổi |
|---|---|---|---|
| 3.1 | Task check_usage_thresholds | `commercial/tasks.py` | Task mới: query all active tenants, đọc Redis counter `quota:api_calls:{tenant}:{date}`, so sánh với `UsageAlertConfig.warning_pct`/`critical_pct`. Nếu vượt ngưỡng: kiểm tra cooldown (cache key `alert_cooldown:{tenant}:{meter_code}:{level}` TTL 6h), nếu chưa có cooldown thì gửi notification và set cooldown key. **Email recipient**: `UsageAlertConfig.notify_email` nếu có, fallback về `tenant.owner.email` (hoặc `CoreTenant.contact_email`). |
| 3.2 | Email notification | `commercial/tasks.py` hoặc `identity_access/notifications.py` (NEW) | Function `send_quota_alert_email(tenant, meter_code, level, current_usage, limit)`: render email template, gửi qua existing mail system. Mẫu nội dung: "Cảnh báo: {meter_code} của {tenant_name} đã đạt {current_usage}/{limit} ({pct}%) — {level}" |
| 3.3 | Webhook notification | `commercial/tasks.py` | Khi vượt ngưỡng: gọi `dispatch_webhook(tenant, event_type='quota_warning'\|'quota_exceeded', payload={tenant_id, meter_code, level, usage_percent})`. Tái sử dụng webhook dispatch infra từ `identity_access/signals.py`. |
| 3.4 | TenantLifecycleEvent | `commercial/tasks.py` | Ghi event: `TenantLifecycleEvent.objects.create(tenant=tenant, event_type='quota_warning'\|'quota_exceeded', actor_type='system', ...)` |
| 3.5 | **Enterprise soft limit (quota monthly)** | `identity_access/middleware.py` — `TenantQuotaMiddleware` | Nếu tenant plan = enterprise: khi vượt **monthly quota limit**, trả response header `X-Quota-Warning: exceeded` + warning log, KHÔNG block (vẫn 200). Các plan khác: giữ nguyên 429. **(Phase 3 là quota alert cho monthly usage, KHÔNG phải rate limit — Phase 4 mới là rate limit hourly. 2 cơ chế khác nhau, dùng chung từ "enterprise unlimited" nhưng không conflict.)** |
| 3.6 | Register task vào beat | `vninvest_core/settings.py` | Thêm `check-usage-thresholds`, every 300s, queue `celery` |
| 3.7 | Frontend: alert indicator | `packages/web/src/pages/tenant-admin/TenantAdminUsagePage.js` | Header bar: icon cảnh báo + text "Đã sử dụng {pct}% API calls". Màu: <80% xanh, 80-95% vàng, >95% đỏ. |

### Audit checklist

| ID | Mục kiểm tra | Cách test | Expected |
|---|---|---|---|
| A3.1 | Warning threshold | **Mock Redis counter** (set `quota:api_calls:{tenant}:{date}` = 10% của limit) → chờ 5 phút | Email được gửi (đến `UsageAlertConfig.notify_email` hoặc `tenant.owner.email`), TenantLifecycleEvent có `quota_warning` |
| A3.2 | Critical threshold | Mock Redis counter = 20% của limit | Email gửi, event `quota_exceeded`, enterprise không bị block |
| A3.3 | Cooldown hoạt động | Vượt threshold lần 1 → email. Vượt lại trong 6h | Không gửi email lần 2 |
| A3.4 | Enterprise không bị block | Enterprise tenant vượt limit | API trả 200 + header `X-Quota-Warning` |
| A3.5 | Non-enterprise bị 429 | Free tenant vượt limit | API trả 429 + message "Vượt quá..." |
| A3.6 | Webhook dispatch | Config webhook URL → vượt threshold | Webhook nhận được payload |
| A3.7 | Frontend indicator | Mở usage page | Header bar hiển thị đúng % + màu |

### Rollback

```bash
# 1. Disable task trong Celery Beat (comment out)
# 2. Deploy → task tự dừng sau 5 phút (không cần restart)
```

---

## Phase 4 — Rate Limiting by PAT

### Mục tiêu
Mỗi PAT credential có rate limit riêng theo plan: Free 100/h, Starter 1000/h, Pro 10000/h, Enterprise unlimited. Response headers `X-RateLimit-*` trên mọi response.

### Checklist code

| # | Task | File | Thay đổi |
|---|---|---|---|
| 4.1 | PATRateThrottle class với **sliding window** | `identity_access/throttles.py` (NEW) | Class `PATRateThrottle(BaseThrottle)`: `scope='pat'`. **Dùng sliding window với Redis sorted set**, không phải fixed-hour window:<br>`key = f'throttle_pat_{pat.public_id}'`<br>`now = time.time()`<br>`window_start = now - 3600`<br>`ZREMRANGEBYSCORE {key} 0 {window_start}` — xóa request cũ<br>`ZCARD {key}` — đếm request trong sliding window 1h<br>`ZADD {key} {now} {request_id}` — thêm request mới<br>`EXPIRE {key} 3600`<br><br>Nếu `rate == -1` (enterprise): skip check, luôn return True.<br>Lưu `request._pat_rate_remaining` để middleware đọc. |
| 4.2 | Plan → rate mapping | `identity_access/throttles.py` | Dict `PAT_RATE_MAP = {'free': 100, 'starter': 1000, 'pro': 10000, 'enterprise': -1, 'custom': -1, 'internal': -1}`. Lấy plan từ `credential.service_account.tenant.plan`. **Xử lý -1**: skip check, không crash. |
| 4.3 | Register throttle class | `vninvest_core/settings.py` | Thêm `'identity_access.throttles.PATRateThrottle'` vào `DEFAULT_THROTTLE_CLASSES` (đầu danh sách, trước UserRateThrottle) |
| 4.4 | RateLimitHeadersMiddleware — **đọc remaining từ request object** | `identity_access/middleware.py` hoặc middleware mới | Middleware `RateLimitHeadersMiddleware`: sau response, nếu `request._pat_rate_remaining` tồn tại (được set bởi PATRateThrottle trong `allow_request()`), set headers:<br>`X-RateLimit-Limit`: rate từ plan mapping<br>`X-RateLimit-Remaining`: `request._pat_rate_remaining`<br>`X-RateLimit-Reset`: epoch seconds của sorted set member cũ nhất + 3600<br>**2 component (throttle + middleware) share state qua request object**, không đọc cache riêng. |
| 4.5 | Register headers middleware | `vninvest_core/settings.py` | Thêm `'identity_access.middleware.RateLimitHeadersMiddleware'` vào MIDDLEWARE (sau TenantQuotaMiddleware) |
| 4.6 | Frontend: rate limit warning | `packages/web/src/services/apiClient.js` | Interceptor: đọc `X-RateLimit-Remaining` header, nếu <10% thì hiển thị toast warning "Sắp hết lượt gọi API" |

### Audit checklist

| ID | Mục kiểm tra | Cách test | Expected |
|---|---|---|---|
| A4.1 | Rate limit headers xuất hiện | Gọi API với PAT → check response headers | `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` |
| A4.2 | Free bị giới hạn 100/h | **Mock Redis sorted set** (set 100 entries) → gọi 1 request | Request trả về 429 |
| A4.3 | Pro 10000/h | Mock Redis sorted set (10000 entries) → gọi 1 request | Request trả về 429 |
| A4.4 | Enterprise unlimited | Gọi API với Enterprise PAT (rate=-1) | Không bị 429, headers có `X-RateLimit-Remaining: -1` |
| A4.5 | Rate limit resets sau 1h | Mock Redis sorted set với entries > 3600s cũ | Request thành công (window đã reset) |
| A4.6 | Anonymous không bị PAT rate limit | Gọi request không auth | Không có rate limit headers, không bị block |
| A4.7 | Rate limit không ảnh hưởng global DRF throttle | Kiểm tra UserRateThrottle vẫn hoạt động | Cả 2 rate limit hoạt động độc lập |
| A4.8 | Frontend toast warning | Set remaining header <10% trong mock | Toast hiển thị |

### Rollback

```bash
# 1. Remove PATRateThrottle từ DEFAULT_THROTTLE_CLASSES
# 2. Remove RateLimitHeadersMiddleware từ MIDDLEWARE
# 3. Deploy → rate limiting tắt ngay
```

---

## Cross-cutting Configuration

### Redis database spec

| Key pattern | DB | TTL | Mục đích |
|---|---|---|---|
| `quota:{meter_code}:{tenant_id}:{date}` | DB 0 | 48h | Daily quota counter |
| `rollup_last_id` | DB 1 | ∞ | Watermark cho rollup task |
| `alert_cooldown:{tenant}:{meter_code}:{level}` | DB 1 | 6h | Alert cooldown |
| `throttle_pat_{pat.public_id}` | DB 1 | 3600s | Sliding window rate limit |
| `pat_audit_queue` | DB 1 | 60s | Batch write queue (Redis list) |

**Quy tắc**: DB 0 = business data (quota counters). DB 1 = infra/metadata (watermark, cooldown, throttle, queue). Key prefix: `pat_` cho PAT-related keys, `quota:` cho quota counters.

### Queue names

| Task | Queue | Worker tồn tại? |
|---|---|---|
| `snapshot_quota_history` | `celery` | ✅ Default worker |
| `flush_quota_counters` | `celery` | ✅ |
| `flush_pat_audit_log` | `celery` | ✅ (internal worker, chạy mỗi 10s) |
| `cross_ref_pat_audit_events` | `celery` | ✅ |
| `aggregate_api_call_rollup` | `celery` | ✅ (không dùng `analytics_heavy` — chưa chắc worker subscribe) |
| `check_usage_thresholds` | `celery` | ✅ |

### Migration numbering

```bash
# KHÔNG hardcode số migration — dùng lệnh động
python manage.py showmigrations identity_access  # xem số migration hiện tại
python manage.py migrate identity_access <prev_migration_name>
```

### Monitoring & error tracking plan

Mỗi component cần:

| Component | Error counter metric | Alert nếu | Action |
|---|---|---|---|
| `TenantQuotaMiddleware` — ghi PATAuditLog | `pat_audit_write_errors_total` | >5 trong 5 phút | Kiểm tra DB connection, flush_pat_audit_log task |
| `flush_pat_audit_log` task | `pat_audit_flush_errors_total` | >3 liên tiếp | Kiểm tra Redis queue, DB write |
| `cross_ref_pat_audit_events` task | `pat_cross_ref_errors_total` | >3 liên tiếp | Kiểm tra request_id matching |
| `aggregate_api_call_rollup` task | `rollup_aggregation_errors_total` | >3 liên tiếp | Kiểm tra AuditEvent schema |
| `check_usage_thresholds` task | `check_thresholds_errors_total` | >3 liên tiếp | Kiểm tra Redis counter, UsageAlertConfig |
| `PATRateThrottle` | `pat_throttle_errors_total` | >5 trong 5 phút | Kiểm tra Redis sorted set, rate mapping |
| Batch write queue lag | `pat_audit_queue_depth` | >1000 entries | Queue bị nghẽn, cần tăng flush frequency |

**Cách implement**: Thêm `from prometheus_client import Counter` (nếu có Prometheus) hoặc ghi vào `logging.error` + Datadog/Prometheus metric. Nếu không có monitoring infra: ghi error vào DB table `SystemMetric` (hoặc `AuditEvent` với event_type='system_error').

---

## Phase Testing & Rollback (Cross-phase)

### Testing strategy

| Phase | Unit test files (mới/cập nhật) | Integration test | E2E |
|---|---|---|---|
| 0 | `tests/test_quota_counters.py`, `tests/test_meter_codes.py`, `tests/test_last_used_at.py` | `compose exec core-api pytest tests/ -k "quota or meter or last_used"` | Frontend: usage page load |
| 1 | `tests/test_pat_audit_log_write.py`, `tests/test_pat_usage_api.py` | Test create PAT → call API → check log → check batch flush queue depth | PAT page "Usage" modal |
| 2 | `tests/test_api_analytics_group_by.py`, `tests/test_rollup_aggregation.py` | Tạo 1000 AuditEvent → chờ rollup → query → check watermark | Usage tab charts |
| 3 | `tests/test_quota_alert_thresholds.py` | Mock Redis counter → vượt threshold → check email (mock send_mail) | Alert indicator trên UI |
| 4 | `tests/test_pat_rate_limit.py` (sliding window), `tests/test_rate_limit_headers.py` | Mock Redis sorted set (N entries) → check 429 → check reset | Frontend toast |

### Rollback triggers

| Tình huống | Hành động |
|---|---|
| Phase 0: `last_used_at` không update sau 1h | `git revert --no-commit HEAD~N..HEAD` + deploy |
| Phase 1: Response time tăng >20% | Tắt middleware ghi log bằng config flag, deploy |
| Phase 2: Rollup task crash worker | Disable task, deploy |
| Phase 3: Email spam (cooldown fail) | Tắt `check-usage-thresholds`, deploy |
| Phase 4: 429 false positive với user hợp lệ | Remove throttle class, deploy |

### CI/CD gating

Trước mỗi lần merge phase vào `enterprise`:

```bash
# 1. TypeScript check
npx tsc --noEmit

# 2. Unit tests
docker compose exec core-api pytest tests/identity_access/tests/ -x -q

# 3. Audit checklist pass
# (manual review bởi lead)

# 4. Build
docker compose build core-api

# 5. Deploy staging (nếu có) → smoke test
```

---

## Effort Summary

| Phase | Code | Test | Total | Dependencies |
|---|---|---|---|---|
| 0 — Fix lõi | 0.5 ngày | 0.5 ngày | **1 ngày** | None |
| 1 — PAT tracking | 2 ngày | 1 ngày | **3 ngày** | Phase 0 |
| 2 — API analytics | 2.5 ngày | 1.5 ngày | **4 ngày** | Phase 1 |
| 3 — Alert enforcement | 1.5 ngày | 0.5 ngày | **2 ngày** | Phase 0 |
| 4 — Rate limiting | 1.5 ngày | 0.5 ngày | **2 ngày** | Phase 1 |
| Cross-phase testing + review | 1 ngày | 1 ngày | **2 ngày** | All |
| **Total** | **9 ngày** | **5 ngày** | **14 ngày ±2** | |
