# Kế Hoạch Di Cư SaaS Production Grade — Loại Bỏ Hoàn Toàn Legacy Monolith
**Ngày lập:** 2026-05-04  
**Tình trạng dự án hiện tại:** Hybrid — Legacy monolith (backend/) chạy song song SaaS core (packages/core/) chưa live data  
**Mục tiêu:** Hệ thống hoàn toàn SaaS production-grade, legacy code được xoá hoàn toàn, mọi traffic đi qua packages/core  

---

## 0. Snapshot Kiến Trúc Hiện Tại vs Mục Tiêu

```
HIỆN TẠI (Hybrid)                    MỤC TIÊU (SaaS Production)
─────────────────────────────────     ────────────────────────────────────
backend/                              packages/core/backend/    ← DGNLY backend
  portfolio/ (~55 models)               identity_access/
  ~39 Celery tasks                      market_serving/
  80+ service files                     signal_intelligence/
                                        commercial/
packages/core/backend/                  ops_audit/
  SaaS domains (STUB/no data)          data_ingest/            ← MỚI
                                        advisory/               ← MỚI
frontend/src/                           user_workspace/         ← MỚI
  Legacy React (direct API)
                                      packages/web/src/         ← DGNLY frontend
packages/web/src/                       (đã tồn tại, mở rộng)
  New React (partial)
                                      Infra:
Docker: shared DB, source mount         Immutable Docker images
        no monitoring                   Separate DB per domain
        no backup                       PgBouncer
        legacy celery stubs             Prometheus + Grafana
                                        Automated backups
                                        GitHub Actions CI/CD
```

---

## 1. Tổng Quan Phases

| Phase | Tên | Thời gian ước tính | Rủi ro |
|---|---|---|---|
| **Phase 0** | Fix blockers tức thì | 3-5 ngày | CRITICAL |
| **Phase 1** | Security hardening | 1 tuần | HIGH |
| **Phase 2** | SaaS data plane live | 2-3 tuần | HIGH |
| **Phase 3** | Business logic migration | 4-6 tuần | MEDIUM |
| **Phase 4** | Frontend cutover | 2-3 tuần | MEDIUM |
| **Phase 5** | Infra production hardening | 2-3 tuần | MEDIUM |
| **Phase 6** | Legacy decommission | 1-2 tuần | LOW (nếu Phase 3-4 đúng) |
| **Phase 7** | Post-production validation | Ongoing | LOW |

**Tổng thời gian ước tính:** 16-23 tuần làm việc thực (không tính review/testing buffer)

---

## Phase 0 — Fix Blockers Ngay (3-5 Ngày)

> Những thứ này phải xong TRƯỚC khi làm bất cứ slice nào tiếp theo. Dữ liệu không chảy = mọi test đều vô nghĩa.

### 0.1 Fix Materializers — Ánh Xạ Đúng Bảng Legacy

**Vấn đề:** `packages/core/backend/src/market_serving/materializers.py` đang query bảng không tồn tại (`portfolio_symbolsnapshot`, `portfolio_sessionfacts`).

**Hành động:**
```python
# market_serving/materializers.py — rewrite _fetch_from_legacy SQL

# SymbolSnapshot: đọc từ portfolio_tickersessionclose
SELECT symbol, close_price AS last_price, volume AS total_volume,
       change_pct AS price_change_pct, session_date, captured_at AS fetched_at
FROM portfolio_tickersessionclose
WHERE session_date = (SELECT MAX(session_date) FROM portfolio_tickersessionclose)
ORDER BY symbol

# SessionFacts: đọc từ portfolio_advisoryaggregatesnapshot (JSONB extraction)
SELECT symbol, session_date,
       (state_json->>'cvd_normalized')::float AS cvd_normalized,
       (state_json->>'buy_strength')::float AS buy_strength,
       (state_json->>'institutional_strength')::float AS institutional_strength,
       (state_json->>'whale_net_flow')::bigint AS whale_net_flow
FROM portfolio_advisoryaggregatesnapshot
WHERE session_date = (SELECT MAX(session_date) FROM portfolio_advisoryaggregatesnapshot)
```

**Files thay đổi:**
- `packages/core/backend/src/market_serving/materializers.py`
- `packages/core/backend/tests/test_saas14_materializers.py` — thêm test case SQL mapping

**Exit criteria:** `materialize_symbol_snapshot` và `materialize_session_facts` upsert dữ liệu thật vào bảng SaaS core; `/core/v1/symbol-snapshot/` trả data không rỗng.

---

### 0.2 Fix DB Connection Pooling (Legacy Backend)

**Vấn đề:** Mỗi request tạo TCP connection mới tới PostgreSQL. Ngưỡng bão hòa ~80 users.

**Hành động:** Thêm `CONN_MAX_AGE` vào `backend/config/settings.py`:
```python
DATABASES = {
    "default": {
        ...
        "CONN_MAX_AGE": int(os.getenv("DB_CONN_MAX_AGE", "60")),
        "OPTIONS": {
            "connect_timeout": 10,
            "options": "-c default_transaction_isolation=read\ committed",
        },
    }
}
```

**Ghi chú:** Đây là patch tạm thời cho legacy. Phase 5 sẽ thay bằng PgBouncer.

---

### 0.3 Gỡ Source-Mount Khỏi Prod Docker Compose

**Vấn đề:** `docker-compose.prod.yml` mount `./packages/core/backend:/workspace` — bất kỳ thay đổi file trực tiếp trên host đều ảnh hưởng production ngay.

**Hành động:** Tạo `packages/core/backend/Dockerfile`:
```dockerfile
FROM python:3.13-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV PYTHONPATH=/app/src
EXPOSE 8100
CMD ["gunicorn", "vninvest_core.wsgi:application", \
     "--bind", "0.0.0.0:8100", "--workers", "4", "--timeout", "60", \
     "--access-logfile", "-", "--error-logfile", "-"]
```

Update `docker-compose.prod.yml`:
```yaml
core-api:
  build:
    context: ./packages/core/backend
    dockerfile: Dockerfile
  # XOÁ volumes: - ./packages/core/backend:/workspace
```

Loại bỏ `pip install` khỏi startup command.

**Files thay đổi:**
- `packages/core/backend/Dockerfile` (NEW)
- `docker-compose.prod.yml`

---

### 0.4 Migrate `manage.py migrate` Ra Khỏi Startup

**Vấn đề:** Migration chạy tự động khi start → crash loop nếu migration lỗi.

**Hành động:** Tạo entrypoint script riêng:
```bash
# packages/core/backend/entrypoint.sh
#!/bin/sh
set -e
python manage.py migrate --noinput
exec "$@"
```

Docker:
```yaml
entrypoint: ["/bin/sh", "/app/entrypoint.sh"]
command: ["gunicorn", ...]
```

---

## Phase 1 — Security Hardening (1 Tuần)

### 1.1 Enable JWT Token Blacklist

**Vấn đề:** Refresh token cũ vẫn valid 7 ngày sau khi logout/rotate.

**Hành động:**
```bash
pip install djangorestframework-simplejwt[crypto]
```

`backend/config/settings.py`:
```python
INSTALLED_APPS = [
    ...
    'rest_framework_simplejwt.token_blacklist',  # THÊM
]

SIMPLE_JWT = {
    ...
    'BLACKLIST_AFTER_ROTATION': True,   # SỬA
    'ROTATE_REFRESH_TOKENS': True,
}
```

Tạo migration: `python manage.py migrate`

**Files thay đổi:**
- `backend/config/settings.py`
- `backend/requirements.txt`
- Migration mới

---

### 1.2 Fix PAT Hash — Thêm HMAC Pepper

**Vấn đề:** `_hash_pat_secret` dùng SHA-256 thuần, pepper env var tồn tại nhưng không được dùng.

**Hành động trong `backend/portfolio/models.py`:**
```python
import hmac as _hmac

def _hash_pat_secret(raw_secret: str) -> str:
    pepper = os.environ.get('CORE_PAT_PEPPER', '').encode('utf-8')
    secret = str(raw_secret or '').encode('utf-8')
    if pepper:
        return _hmac.new(pepper, secret, hashlib.sha256).hexdigest()
    # Fallback nếu không có pepper (chỉ dev mode)
    return hashlib.sha256(secret).hexdigest()
```

**Áp dụng tương tự cho `packages/core/backend/src/identity_access/models.py`** — cùng logic.

⚠️ **Migration data:** PAT tokens hiện tại sẽ invalid sau khi deploy (hash khác). Cần tạo Celery task rotate tất cả PAT trước khi deploy, hoặc thông báo service accounts.

---

### 1.3 Lock ALLOWED_HOSTS Core API

**Hành động trong `packages/core/backend/src/vninvest_core/settings.py`:**
```python
_raw_hosts = os.environ.get('DJANGO_ALLOWED_HOSTS', '').strip()
if not _raw_hosts:
    if DEBUG:
        ALLOWED_HOSTS = ['localhost', '127.0.0.1', 'core-api']
    else:
        raise ValueError('DJANGO_ALLOWED_HOSTS phải được set trong production.')
else:
    ALLOWED_HOSTS = [h.strip() for h in _raw_hosts.split(',') if h.strip()]
```

Update `docker-compose.prod.yml`:
```yaml
DJANGO_ALLOWED_HOSTS: "core-api,localhost,${CORE_API_HOST:-}"
```

---

### 1.4 Lock CORS Core API

**Hành động:**
```python
# Thay thế CORS_ALLOW_ALL_ORIGINS = DEBUG
CORS_ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get('CORS_ALLOWED_ORIGINS', '').split(',')
    if o.strip()
]
if not CORS_ALLOWED_ORIGINS and DEBUG:
    CORS_ALLOWED_ORIGINS = ['http://localhost:3000', 'http://localhost:8088']
```

---

### 1.5 Thêm Secret Key Guard Cho Email Credential Decryption

**Vấn đề:** `SystemEmailAccount` dùng `django.core.signing` gắn với `SECRET_KEY`. Nếu key rotate → SMTP credentials không đọc được.

**Hành động:** Thêm tầng validation khi startup:
```python
# backend/config/apps.py hoặc AppConfig.ready()
def verify_email_credential_decryption():
    """Kiểm tra ít nhất 1 active email account decrypt được khi startup."""
    from portfolio.models import SystemEmailAccount
    from django.conf import settings
    account = SystemEmailAccount.objects.filter(is_active=True, is_default=True).first()
    if account and account.password_ciphertext:
        pwd = account.get_smtp_password()
        if not pwd:
            import warnings
            warnings.warn(
                "SystemEmailAccount credentials KHÔNG decrypt được — SECRET_KEY có thể đã thay đổi. "
                "Email service sẽ không hoạt động.",
                RuntimeWarning
            )
```

**Giải pháp dài hạn (Phase 3):** Migrate credential encryption sang KMS-based encryption (Fernet với key riêng, không phụ thuộc Django SECRET_KEY).

---

### 1.6 Remove Default Dev Password Khỏi Prod Compose

**Hành động:** Thay trong `docker-compose.prod.yml`:
```yaml
# TRƯỚC (nguy hiểm):
POSTGRES_PASSWORD: vninvest

# SAU:
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set}
CORE_PAT_PEPPER: ${CORE_PAT_PEPPER:?CORE_PAT_PEPPER must be set}
DJANGO_SECRET_KEY: ${DJANGO_SECRET_KEY:?DJANGO_SECRET_KEY must be set}
```

Dùng `${VAR:?error_message}` syntax để Docker Compose từ chối start nếu thiếu biến.

---

## Phase 2 — SaaS Data Plane Live (2-3 Tuần)

> Mục tiêu: packages/core backend có data thật, serving thật. Legacy vẫn chạy nhưng chỉ làm nguồn đọc.

### 2.1 Tách Database SaaS Core Hoàn Toàn

**Vấn đề hiện tại:** Core API và Legacy share cùng PostgreSQL instance `vninvest`. Migration của bên nào cũng có thể ảnh hưởng bên kia.

**Hành động:**
1. Tạo PostgreSQL instance riêng `vninvest_core` (đã có `core-db` trong prod compose nhưng chưa active)
2. Chạy `python manage.py migrate` cho packages/core vào DB riêng
3. Set `CORE_DATABASE_URL=postgres://...@core-db:5432/vninvest_core`
4. Set `LEGACY_DATABASE_URL=postgres://...@db:5432/vninvest` (readonly, chỉ cho materializers)

**Migration Script (một lần):**
```bash
# Trong core-api container:
python manage.py migrate --database=default  # Core DB
# KHÔNG migrate legacy DB từ core-api
```

---

### 2.2 Viết Lại Materializers Với Schema Đúng (từ 0.1)

Xem bước 0.1. Sau khi viết lại:

**Verification:**
```bash
docker compose exec core-api python manage.py shell -c "
from market_serving.materializers import materialize_symbol_snapshot
result = materialize_symbol_snapshot()
print(result)
"
```

Expected output: `{'status': 'ok', 'upserted': N}` với N > 0.

---

### 2.3 Kích Hoạt Core Celery Worker Thực (Thay Stub)

**Vấn đề:** `core-worker` và `core-beat` đang chạy stub scripts, không xử lý tasks thật.

**Hành động trong `docker-compose.dev.yml` và `docker-compose.prod.yml`:**
```yaml
core-worker:
  command: ["celery", "-A", "vninvest_core", "worker", 
            "-l", "info", "--concurrency=2", "-Q", "core"]

core-beat:
  command: ["celery", "-A", "vninvest_core", "beat",
            "-l", "info", "--scheduler=django_celery_beat.schedulers:DatabaseScheduler"]
```

**Thêm `django-celery-beat` vào `packages/core/backend/requirements.txt`**.

---

### 2.4 Thêm Domain `data_ingest` Cho Live Market Feed

Thay vì materializer đọc legacy DB (short-term bridge), cần long-term ingest pipeline.

**Tạo `packages/core/backend/src/data_ingest/`:**
```
data_ingest/
├── models.py          ← IngestJob, IngestRun, MarketFeedEvent
├── vnbroker_feed.py    ← Wrapper gọi vnbroker trực tiếp (clone adapter từ legacy)
├── tasks.py           ← fetch_and_upsert_price_board (thay thế materializers)
├── serializers.py
└── migrations/
```

**Lộ trình ingest tasks thay thế:**
| Legacy task | Core replacement |
|---|---|
| `prefetch_realtime_ticker_shard` | `data_ingest.tasks.fetch_symbol_batch` |
| `collect_and_publish_realtime` | `data_ingest.tasks.publish_realtime_snapshot` |
| `run_stream_consumer_batch` | `data_ingest.tasks.consume_redis_stream` |

---

### 2.5 Kết Nối `/core/v1/` Endpoints Với Data Thật

**Kiểm tra sau khi materializer chạy:**
```bash
# Symbol snapshot
curl -H "Authorization: Bearer <pat>" http://localhost:8100/core/v1/market/symbol-snapshot/?symbol=VNM

# Session facts
curl -H "Authorization: Bearer <pat>" http://localhost:8100/core/v1/market/session-facts/?symbol=VNM

# Whale alerts
curl -H "Authorization: Bearer <pat>" http://localhost:8100/core/v1/signals/unified-alerts/?symbol=VNM
```

---

### 2.6 Thêm Tầng Cache Redis Cho Read Endpoints

**Trong `packages/core/backend/src/market_serving/views.py`:**
```python
from django.core.cache import cache

class SymbolSnapshotView(generics.ListAPIView):
    def list(self, request, *args, **kwargs):
        symbol = request.query_params.get('symbol')
        cache_key = f'core:snapshot:{symbol}'
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)
        result = super().list(request, *args, **kwargs)
        cache.set(cache_key, result.data, timeout=15)  # 15 giây TTL
        return result
```

---

## Phase 3 — Business Logic Migration (4-6 Tuần)

> Đây là phase nặng nhất. Di chuyển ~55 models và ~39 Celery tasks từ legacy sang packages/core. Làm theo domain, mỗi domain là một slice độc lập.

### Domain Migration Order (theo dependency graph)

```
1. identity_access  ← Không phụ thuộc domain nào (đã có)
2. commercial       ← Phụ thuộc identity_access (đã có skeleton)
3. market_serving   ← Phụ thuộc data_ingest (Phase 2)
4. signal_intelligence ← Phụ thuộc market_serving
5. advisory         ← Phụ thuộc signal_intelligence + commercial
6. user_workspace   ← Phụ thuộc tất cả trên
```

---

### 3.1 Domain: `identity_access` — Hoàn Thiện

**Đã có:** `CoreTenant`, `CoreServiceAccount`, `CorePATCredential`, `CorePATAuthentication`

**Cần thêm (migrate từ legacy `backend/portfolio/models.py`):**

| Legacy Model | Core Domain | Ghi chú |
|---|---|---|
| `UserConfig` | `identity_access.UserProfile` | Tách plan/billing → `commercial` |
| `OnboardingPlanPolicy` | `commercial.TrialPolicy` | |
| `PlanAssignmentLog` | `commercial.PlanAuditLog` | |
| `TelegramProfile` | `identity_access.NotificationProfile` | |

**Migration approach:**
```python
# packages/core/backend/src/identity_access/models.py — THÊM
class UserProfile(models.Model):
    """Replaces legacy portfolio.UserConfig — phi-plan fields."""
    tenant = models.OneToOneField(CoreTenant, on_delete=models.CASCADE, related_name='profile')
    theme = models.CharField(max_length=10, default='dark')
    language = models.CharField(max_length=5, default='vi')
    whale_alert_threshold = models.DecimalField(max_digits=12, decimal_places=0, default=500)
    email_verified = models.BooleanField(default=False)
    oauth_provider = models.CharField(max_length=20, blank=True, default='')
    # ... các fields phi-commercial
```

**Data migration (one-time):** Viết management command `migrate_user_profiles_to_core` đọc từ legacy DB và insert vào core DB.

---

### 3.2 Domain: `commercial` — Subscription & Quota

**Đã có:** Skeleton (`packages/core/backend/src/commercial/`)

**Cần implement:**

| Component | Legacy source | Notes |
|---|---|---|
| `Subscription` model | `UserConfig.plan`, `plan_expires_at` | |
| `Quota` model | `UserConfig.advisory_max_tokens_per_day` | |
| `Invoice` model | (chưa có legacy) | Mới cho SaaS billing |
| Plan enforcement middleware | `portfolio/permissions.py` | |
| VNPay/MoMo webhook handler | (chưa có) | Mới |

**API endpoints:**
```
GET  /core/v1/commercial/subscription/
POST /core/v1/commercial/subscription/upgrade/
GET  /core/v1/commercial/quota/usage/
POST /core/v1/commercial/webhooks/vnpay/
POST /core/v1/commercial/webhooks/momo/
```

---

### 3.3 Domain: `signal_intelligence` — Whale & Order Flow

**Đã có:** `UnifiedAlert`, `WhaleAlertCanonical` skeleton.

**Cần migrate từ legacy:**

| Legacy | Core | Migration complexity |
|---|---|---|
| `WhaleAlertEvent` | `UnifiedAlert` + `WhaleAlertCanonical` | MEDIUM — event_id mapping |
| `OrderFlowSignal` | `signal_intelligence.OrderFlowEvent` | LOW |
| `AdvisoryAggregateSnapshot` | `market_serving.SessionFacts` (partial) | MEDIUM |
| `SignalVerification` | `signal_intelligence.SignalAudit` | LOW |
| `MoneyFlowForensicWindow` | `signal_intelligence.ForensicWindow` | LOW |

**Celery tasks để migrate:**
```
tasks_whale_service.py:detect_and_store_global_whale_alerts
tasks_order_flow.py:detect_and_store_order_flow
tasks_order_flow.py:distribute_order_flow_signal
tasks_order_flow.py:detect_whale_reversal
```

→ Tất cả di chuyển vào `packages/core/backend/src/signal_intelligence/tasks.py`

**Shadow run strategy:** Chạy cả legacy task lẫn SaaS task song song trong 1 tuần, so sánh output. Nếu parity đạt 99%+ thì tắt legacy task.

---

### 3.4 Domain: `advisory` — AI Advisory Engine (MỚI)

**Đây là domain hoàn toàn mới trong packages/core**, migrate từ legacy `tasks_whale_advisory.py`, `tasks_whale_generation.py`, `ai_service.py`, v.v.

**Tạo `packages/core/backend/src/advisory/`:**
```
advisory/
├── models.py         ← AdvisoryRecord, AdvisorySession, TokenBudget
├── ai_client.py      ← Wrapper gọi OpenAI/OpenClaw/Anthropic
├── prompt_engine.py  ← Prompt builder (migrate từ ai_prompt_config_ssot.py)
├── tasks.py          ← generate_advisory, auto_refresh_advisory
├── quota.py          ← Token budget enforcement
├── views.py
├── serializers.py
└── migrations/
```

**API endpoints:**
```
GET  /core/v1/advisory/{symbol}/latest/
POST /core/v1/advisory/{symbol}/refresh/
GET  /core/v1/advisory/history/
GET  /core/v1/advisory/token-usage/
```

**Celery tasks migrate:**
```
tasks_whale_advisory.py → advisory/tasks.py
tasks_whale_generation.py → advisory/tasks.py
tasks_whale_auto_generation.py → advisory/tasks.py
tasks_whale_ai_call.py → advisory/ai_client.py
```

---

### 3.5 Domain: `user_workspace` — Portfolio & Watchlist (MỚI)

Migrate portfolio management từ legacy `views.py`, `trading_views.py`.

**Tạo `packages/core/backend/src/user_workspace/`:**
```
user_workspace/
├── models.py         ← Portfolio, SubAccount, Transaction, WatchlistGroup, WatchlistItem
├── views.py
├── serializers.py
├── tasks.py          ← sync_portfolio_performance, generate_news_digest
└── migrations/
```

**Đây là domain đơn giản nhất về logic**, hầu hết là CRUD có validation.

---

### 3.6 Domain: `market_data` — Historical Price & Profile (MỚI)

**Tạo `packages/core/backend/src/market_data/`:**
```
market_data/
├── models.py         ← DailyPrice, StockProfile, TickerSessionClose
├── adapters/         ← vnbroker adapter (migrate từ portfolio/adapters/)
│   ├── base.py
│   └── vnbroker_adapter.py
├── tasks.py          ← sync_daily_price, sync_stock_profiles
└── migrations/
```

**Quan trọng:** Giữ nguyên runtime config pattern `RuntimeVnbrokerConfig` dưới dạng `market_data.VnbrokerRuntimeConfig`.

---

### 3.7 Celery Task Migration Matrix (Đầy Đủ)

| Legacy Task | SaaS Domain | Priority |
|---|---|---|
| `detect_and_store_global_whale_alerts` | `signal_intelligence.tasks` | P0 |
| `distribute_whale_alert_event` | `signal_intelligence.tasks` | P0 |
| `detect_and_store_order_flow` | `signal_intelligence.tasks` | P0 |
| `collect_and_publish_realtime` | `data_ingest.tasks` | P0 |
| `prefetch_realtime_ticker_shard` | `data_ingest.tasks` | P0 |
| `generate_whale_advisory_task` | `advisory.tasks` | P1 |
| `auto_generate_advisories_for_all_tracked` | `advisory.tasks` | P1 |
| `process_plan_lifecycle_transitions` | `commercial.tasks` | P1 |
| `cleanup_old_intraday_ticks` | `data_ingest.tasks` | P1 |
| `sync_user_watch_assets` | `user_workspace.tasks` | P2 |
| `generate_all_portfolio_news_digests_task` | `user_workspace.tasks` | P2 |
| `run_global_screener_scheduled_task` | `signal_intelligence.tasks` | P2 |
| `run_stream_consumer_batch` | `data_ingest.tasks` | P1 |
| `trim_streams` | `data_ingest.tasks` | P2 |
| `sync_stock_profiles` | `market_data.tasks` | P2 |
| `run_vnbroker_price_board_benchmark` | `ops_audit.tasks` | P3 |
| `tasks_telegram.*` | `identity_access.notification_tasks` | P3 |
| `tasks_sentiment.*` | `signal_intelligence.tasks` | P3 |
| `tasks_crawl.*` | Standalone `news_ingester` service | P3 |

---

## Phase 4 — Frontend Cutover (2-3 Tuần)

> Mục tiêu: Mọi traffic frontend đi qua `packages/web/`, không còn `frontend/` legacy.

### 4.1 Audit `packages/web/src/` vs `frontend/src/`

**Đã có trong packages/web:**
- `DashboardShellHost.jsx`, `WhaleAlertsShellHost.jsx`, `WatchlistShellHost.jsx`
- `AdminCore*.jsx` (admin panel mới)
- `coreApiAdapter.js` (client cho core-api)

**Còn trong frontend/ nhưng chưa có trong packages/web:**
- `StockDetail.jsx` (whale + KLine chart)
- `PortfolioManagement.jsx`
- `Transactions.jsx`
- `UserConfig.jsx`
- `Support.jsx`

### 4.2 Migration Approach Per Page

**Không copy-paste.** Mỗi page phải được viết lại sạch theo pattern packages/web, sử dụng `coreApiAdapter.js`.

**Ưu tiên theo traffic:**
1. `Dashboard` (đã có shell host, cần data)
2. `WhaleAlerts` + `StockDetail` (core feature)
3. `Portfolio` + `Transactions`
4. `UserConfig` + `Settings`
5. `Support` + `Admin`

### 4.3 API Compatibility Layer (Temporary)

Trong quá trình chuyển đổi, `packages/core/backend/src/vninvest_core/compat_portfolio.py` (đã có) cần được mở rộng để cover:

```
/api/portfolio/portfolios/       → /core/v1/workspace/portfolios/
/api/portfolio/transactions/     → /core/v1/workspace/transactions/
/api/portfolio/watchlist/        → /core/v1/workspace/watchlist/
/api/portfolio/whale-alerts/     → /core/v1/signals/unified-alerts/
/api/realtime/ticker/            → /core/v1/market/symbol-snapshot/
```

### 4.4 Nginx Routing Strategy

```nginx
# Trong packages/opencore/distribution/nginx-opencore.conf
# Legacy API route (tạm thời trong Phase 4)
location /api/ {
    proxy_pass http://backend:8000;  # Legacy
}

# SaaS API route
location /core/ {
    proxy_pass http://core-api:8100;
}

# Khi compat layer đủ coverage → chuyển /api/ sang core-api
location /api/ {
    proxy_pass http://core-api:8100;
}
```

---

## Phase 5 — Infra Production Hardening (2-3 Tuần)

### 5.1 PgBouncer — Connection Pooling

**Thêm vào `docker-compose.prod.yml`:**
```yaml
pgbouncer:
  image: bitnami/pgbouncer:latest
  container_name: vninvest-pgbouncer
  environment:
    POSTGRESQL_HOST: db
    POSTGRESQL_PORT: 5432
    POSTGRESQL_USERNAME: postgres
    POSTGRESQL_PASSWORD: ${POSTGRES_PASSWORD}
    POSTGRESQL_DATABASE: vninvest
    PGBOUNCER_POOL_MODE: transaction
    PGBOUNCER_MAX_CLIENT_CONN: 500
    PGBOUNCER_DEFAULT_POOL_SIZE: 20
  networks:
    - vninvest_network
```

Sau đó update backend để kết nối qua `pgbouncer:5432` thay vì `db:5432`.

---

### 5.2 Gunicorn Workers Tuning

**Core API (packages/core):**
```
workers = 4  # 2 * CPU cores + 1 (server 2 CPUs)
worker_class = "uvicorn.workers.UvicornWorker"  # Async support
timeout = 60
keepalive = 5
max_requests = 1000
max_requests_jitter = 50
```

**Legacy Backend (transition period):**
```
workers = 4
worker_class = "daphne"  # Đã dùng cho WebSocket
```

---

### 5.3 Automated Database Backup

**Thêm Celery beat task:**
```python
# ops_audit/tasks.py
@shared_task(name='ops_audit.daily_db_backup')
def daily_db_backup():
    """pg_dump + upload tới S3/R2."""
    import subprocess, boto3, datetime
    filename = f"backup_{datetime.date.today().isoformat()}.sql.gz"
    subprocess.run([
        "pg_dump", "-U", os.getenv("POSTGRES_USER"), 
        "-h", os.getenv("POSTGRES_HOST"),
        os.getenv("POSTGRES_DB"), 
        "--compress=9", f"--file=/tmp/{filename}"
    ], check=True)
    # Upload to Cloudflare R2 or AWS S3
    ...
```

Lịch: `crontab(hour=2, minute=0)` — 2:00 AM hàng ngày.

---

### 5.4 Prometheus + Grafana Monitoring Stack

**Thêm vào docker-compose.prod.yml:**
```yaml
prometheus:
  image: prom/prometheus:latest
  volumes:
    - ./infra/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml

grafana:
  image: grafana/grafana:latest
  volumes:
    - grafana_data:/var/lib/grafana
  environment:
    GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
```

**Metrics cần collect:**
- Django request duration (via `django-prometheus`)
- PostgreSQL stats (via `postgres_exporter`)
- Redis memory + ops/sec (via `redis_exporter`)
- Celery queue depth (via `flower` metrics endpoint)
- Business KPIs: whale detection latency, AI token burn rate, active user sessions

**Dashboards:**
1. Infrastructure Overview (DB, Redis, Container health)
2. API Performance (p50/p95/p99 latency per endpoint)
3. Business KPIs (daily active users, advisory generations, whale alert volume)

---

### 5.5 Sentry Error Tracking

**Trong `packages/core/backend/requirements.txt`:**
```
sentry-sdk[django,celery]>=2.0
```

**Trong settings.py:**
```python
import sentry_sdk
SENTRY_DSN = os.environ.get('SENTRY_DSN', '')
if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        environment=os.environ.get('CORE_ENV', 'development'),
        traces_sample_rate=0.1,
        profiles_sample_rate=0.05,
    )
```

---

### 5.6 CI/CD Pipeline (GitHub Actions)

**Tạo `.github/workflows/core-api-deploy.yml`:**
```yaml
name: Deploy Core API
on:
  push:
    branches: [main]
    paths: ['packages/core/**']

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run tests
        run: |
          cd packages/core/backend
          pip install -r requirements.txt
          python -m pytest tests/ -v

  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Build Docker image
        run: docker build -t ghcr.io/vninvest/core-api:${{ github.sha }} packages/core/backend/
      - name: Push to registry
        run: docker push ghcr.io/vninvest/core-api:${{ github.sha }}

  deploy:
    needs: build-and-push
    steps:
      - name: Deploy to production
        run: |
          # Docker Swarm hoặc Portainer webhook
```

---

### 5.7 IntradayTick Table Partitioning

**Thêm migration:**
```python
# Trong một migration mới của legacy (hoặc core sau khi migrate model này)
operations = [
    migrations.RunSQL("""
        -- Chuyển sang partitioned table theo trade_date
        -- Partition monthly: portfolio_intradaytick_2026_05, portfolio_intradaytick_2026_06, ...
        CREATE TABLE portfolio_intradaytick_partitioned (
            LIKE portfolio_intradaytick INCLUDING ALL
        ) PARTITION BY RANGE (trade_date);
        
        -- Tạo partition cho tháng hiện tại
        CREATE TABLE portfolio_intradaytick_2026_05
            PARTITION OF portfolio_intradaytick_partitioned
            FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
    """)
]
```

**Celery beat: auto-create monthly partitions:**
```python
@shared_task(name='data_ingest.create_next_month_partition')
def create_next_month_partition():
    ...  # Tạo partition trước 7 ngày cuối tháng
```

---

## Phase 6 — Legacy Decommission (1-2 Tuần)

> Chỉ thực hiện khi TẤT CẢ exit criteria của Phase 2-5 được verify.

### 6.1 Pre-Decommission Checklist

Trước khi xoá bất kỳ file legacy nào, verify:

- [ ] `/core/v1/` endpoints phục vụ 100% traffic (kiểm tra nginx access logs)
- [ ] Tất cả `packages/web` pages hoạt động không cần `frontend/` 
- [ ] Legacy Celery tasks không còn trong Redis queue
- [ ] Không còn cronjob nào schedule legacy tasks
- [ ] Full DB backup đã chạy thành công trong 7 ngày gần nhất
- [ ] Sentry không có lỗi mới từ legacy code trong 72 giờ
- [ ] Monitoring dashboards đã verify: zero traffic tới `backend:8000`

### 6.2 Decommission Order

**Bước 1 — Tắt legacy containers:**
```yaml
# docker-compose.prod.yml — comment out hoặc xoá:
# backend: ...
# celery_worker: ...
# celery_beat: ...
```

Deploy, verify 24h không có incident.

**Bước 2 — Xoá legacy frontend:**
```bash
git rm -r frontend/
```

**Bước 3 — Backup và xoá legacy backend code:**
```bash
# Tạo archive tag trước khi xoá
git tag legacy-monolith-archive-20260504
git push origin legacy-monolith-archive-20260504

# Xoá khỏi main branch
git rm -r backend/
```

**Bước 4 — Xoá legacy Docker services và volumes:**
```bash
docker compose down backend celery_worker celery_beat
docker volume rm vninvest_postgres_data  # SAU KHI đã migrate data sang core-db
```

**Bước 5 — Cleanup Docker Compose files:**
- Hợp nhất `docker-compose.yml` + `docker-compose.dev.yml` + `docker-compose.prod.yml` thành 1 file production sạch
- Xoá tất cả service legacy khỏi compose

**Bước 6 — Clean up root-level legacy files:**
```bash
git rm check_setting.py debug_*.py gen_token.py test_ticker*.py
git rm AUDIT_*.md CHANGELOG_PRICING_DISPLAY*.md
```

---

### 6.3 Database Migration Post-Decommission

Sau khi legacy code xoá, chạy cleanup trên `vninvest_core` DB:

```sql
-- Xoá bảng legacy nếu đã migrate xong data
-- (Chỉ thực hiện sau khi backup xác nhận và data đã lên core DB)
DROP TABLE IF EXISTS portfolio_intradaytick CASCADE;  -- Đã migrate
DROP TABLE IF EXISTS portfolio_advisoryaggregatesnapshot CASCADE;  -- Data đã vào SessionFacts
-- ... các bảng khác theo trình tự
```

**KHÔNG xoá ngay mà giữ 30 ngày dưới dạng `_deprecated_` prefix:**
```sql
ALTER TABLE portfolio_intradaytick RENAME TO _deprecated_portfolio_intradaytick;
```

---

## Phase 7 — Post-Production Validation & Ongoing (Liên Tục)

### 7.1 Week 1 Post-Decommission Monitoring

- Theo dõi Sentry — zero unhandled exceptions từ core code
- Check Grafana: API p95 latency < 500ms cho tất cả endpoints
- Verify webhook delivery cho VNPay/MoMo (Phase 3.2 commercial)
- Run full integration test suite daily

### 7.2 Retention & Archival Policy

| Data | Policy | Tool |
|---|---|---|
| `UnifiedAlert` / whale events | 1 năm online, sau archive S3 | pg_partman + Celery |
| `DailyPrice` | Permanent (financial data) | — |
| `SessionFacts` | 90 ngày online, sau delete | Celery cleanup task |
| Advisory records | 6 tháng | — |
| Ops audit logs | 1 năm | — |
| DB backup | 30 ngày rolling | Daily Celery + R2 |

### 7.3 SaaS Billing Activation

Sau khi infrastructure ổn định:
1. Tích hợp VNPay subscription endpoint thật
2. Enable MoMo recurring payment
3. Set up Stripe cho international users (nếu cần)
4. Activate `commercial.Quota` enforcement — từ chối advisory generation khi vượt token budget

### 7.4 Performance Targets Post-Migration

| KPI | Baseline (hiện tại) | Target (post-migration) |
|---|---|---|
| API p95 latency | ~300-500ms | <200ms |
| Concurrent users | ~80 (bottleneck) | 500+ |
| Celery task success rate | ~95% | 99.5%+ |
| Whale detection latency | ~60s (batch) | <30s |
| Advisory generation | ~30-60s | <20s (cache hit <2s) |
| DB query p95 | Unknown | <100ms |
| Uptime | ~98% | 99.9% |

---

## Appendix A — Domain Mapping Đầy Đủ (Legacy → Core)

| Legacy File | Core Domain | Migration Type |
|---|---|---|
| `models.py:UserConfig` | `identity_access.UserProfile` + `commercial.Subscription` | Split |
| `models.py:CoreTenant` | `identity_access.CoreTenant` (already exists) | Canonical cutover |
| `models.py:WhaleAlertEvent` | `signal_intelligence.UnifiedAlert` | Rename + enrich |
| `models.py:WhaleAdvisory` | `advisory.AdvisoryRecord` | Move |
| `models.py:IntradayTick` | `data_ingest.MarketTick` (with partitioning) | Move + partition |
| `models.py:AdvisoryAggregateSnapshot` | `market_serving.SessionFacts` | Materialize |
| `models.py:OrderFlowSignal` | `signal_intelligence.OrderFlowEvent` | Move |
| `models.py:DailyPrice` | `market_data.DailyPrice` | Move |
| `models.py:TickerSessionClose` | `market_serving.SymbolSnapshot` (via materializer) | Materializer |
| `models.py:StockProfile` | `market_data.StockProfile` | Move |
| `models.py:Portfolio` | `user_workspace.Portfolio` | Move |
| `models.py:Transaction` | `user_workspace.Transaction` | Move |
| `models.py:WatchlistGroup/Item` | `user_workspace.WatchlistGroup/Item` | Move |
| `models.py:SystemAISettings` | `advisory.SystemAISettings` | Move |
| `models.py:RuntimeVnbrokerConfig` | `market_data.VnbrokerRuntimeConfig` | Move |
| `models.py:SystemEmailAccount` | `ops_audit.SystemEmailAccount` (with KMS) | Move + encrypt |
| `ai_service.py` | `advisory.ai_client` | Move |
| `ai_prompt_config_ssot.py` | `advisory.prompt_engine` | Move |
| `global_signal_policy_helpers.py` | `signal_intelligence.policy` | Move |
| `market_data_service.py` | `market_data.service` | Move |
| `analytics.py` | `ops_audit.analytics` | Move |
| `openclaw_client.py` | `advisory.providers.openclaw` | Move |
| `permissions.py` | `commercial.permissions` | Move |
| `quota_service.py` | `commercial.quota` | Move |
| `adapters/vnbroker_adapter.py` | `market_data.adapters.vnbroker` | Move |

---

## Appendix B — New Docker Architecture Post-Migration

```yaml
# docker-compose.prod.yml (clean, post-migration)
services:
  # Infrastructure
  core-db:     postgres:16 (vninvest_core DB)
  core-redis:  redis:7 (db=0 broker, db=1 cache, db=2 streams)
  pgbouncer:   bitnami/pgbouncer (transaction pooling)
  
  # Core API (immutable image, built via CI/CD)
  core-api:    ghcr.io/vninvest/core-api:${IMAGE_TAG}
               gunicorn (4 uvicorn workers)
  
  # Workers
  core-worker: ghcr.io/vninvest/core-api:${IMAGE_TAG}
               celery worker -Q core,ingest,advisory,maintenance
  
  core-beat:   ghcr.io/vninvest/core-api:${IMAGE_TAG}
               celery beat (DatabaseScheduler)
  
  # Frontend
  web:         ghcr.io/vninvest/web:${WEB_IMAGE_TAG}
               nginx serve packages/web/dist/
  
  # Proxy
  nginx:       nginx:alpine
               SSL termination, routing
  
  # Observability
  prometheus:  prom/prometheus
  grafana:     grafana/grafana
  
  # Optional
  sentry:      (SaaS hoặc self-hosted)
  mailpit:     (dev only — xoá khỏi prod)
```

---

## Appendix C — Risk Register

| Rủi ro | Xác suất | Impact | Mitigation |
|---|---|---|---|
| Data loss khi tách DB | LOW | CRITICAL | Backup 7 ngày trước, migration script dry-run |
| PAT invalidation sau fix hash | HIGH | HIGH | Thông báo trước 48h, auto-rotate script |
| Materializer lag trong giờ giao dịch | MEDIUM | HIGH | Redis cache layer, fallback sang legacy query |
| Vnbroker API outage | MEDIUM | HIGH | Fallback provider chain (KBS → VCI) đã có |
| Frontend regression | MEDIUM | MEDIUM | A/B routing tại nginx, canary release |
| Celery task duplication (legacy + core) | HIGH | MEDIUM | Shadow run với dedup logic, comparison logging |
| Legacy DB migration downtime | LOW | HIGH | Rolling migration với compatibility views |

---

## Appendix D — Pre-Production Gates

Trước khi Phase 6 decommission, tất cả gates phải PASS:

| Gate | Verification Method | Owner |
|---|---|---|
| **Gate A** — Zero data gap in materializers | Compare row counts legacy vs core | Backend dev |
| **Gate B** — All API endpoints covered | Contract validator script 9/9 PASS | Backend dev |
| **Gate C** — Frontend 100% on packages/web | Nginx access logs: 0 requests to backend:8000 | Frontend dev |
| **Gate D** — Zero critical alerts in Sentry (72h) | Sentry dashboard | DevOps |
| **Gate E** — Backup verified (restore test) | Restore to staging, smoke test | DevOps |
| **Gate F** — Performance targets met | Grafana dashboard | Backend dev |
| **Gate G** — Legacy Celery tasks drained | Redis inspect: 0 legacy tasks in queue | Backend dev |
