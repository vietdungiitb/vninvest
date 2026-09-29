# TECH SPEC — SaaS Production Migration & Legacy Monolith Decommission

**Ngày tạo**: 2026-05-04  
**Scope**: Toàn bộ chương trình migration SaaS production  
**Level**: A (architecture overhaul, security hardening, data migration, infra)  
**Status**: APPROVED FOR IMPLEMENTATION

---

## 1. Mục tiêu kỹ thuật

Spec này định nghĩa các quyết định kỹ thuật bắt buộc cho toàn bộ chương trình SaaS migration, bao gồm:

1. Schema cho SaaS domains và cách ánh xạ từ legacy models.
2. API contract cho từng domain core.
3. Materializer SQL đúng để fix data drift ngay trong Phase 0.
4. Security model sau hardening.
5. Celery task routing và shadow run protocol.
6. Database separation và migration strategy.
7. Frontend API adapter contracts.
8. Infra target topology.

---

## 2. Domain architecture

### 2.1 Domain map và dependency

```
                        ┌─────────────────┐
                        │ identity_access  │
                        │ CoreTenant       │
                        │ UserProfile      │
                        │ CorePATCredential│
                        └────────┬────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                   │
    ┌─────────┴──────┐  ┌────────┴───────┐  ┌──────┴────────┐
    │  commercial    │  │  market_data   │  │  ops_audit    │
    │  Subscription  │  │  DailyPrice    │  │  SystemEmail  │
    │  Quota         │  │  StockProfile  │  │  AuditLog     │
    │  Plan          │  │  VnbrokerConfig │  └───────────────┘
    └────────────────┘  └────────┬───────┘
                                 │
                        ┌────────┴───────────┐
                        │    data_ingest      │
                        │    IngestJob        │
                        │    MarketTick       │
                        │    VnbrokerFeed      │
                        └────────┬────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                   │
    ┌─────────┴──────┐  ┌────────┴───────┐           │
    │ market_serving │  │signal_intelligence│         │
    │ SymbolSnapshot │  │ UnifiedAlert   │           │
    │ SessionFacts   │  │ OrderFlowEvent │           │
    │ PriceBoard     │  │ ForensicWindow │           │
    └────────────────┘  └────────┬───────┘           │
                                 │                   │
                        ┌────────┴───────────────────┴──┐
                        │         advisory               │
                        │         AdvisoryRecord         │
                        │         TokenBudget            │
                        │         SystemAISettings       │
                        └────────────────────────────────┘
                                 │
                        ┌────────┴───────────┐
                        │  user_workspace     │
                        │  Portfolio          │
                        │  Transaction        │
                        │  WatchlistGroup     │
                        └────────────────────┘
```

### 2.2 Nguyên tắc domain boundaries

1. Mỗi domain có migration file riêng, không chia sẻ FK cross-domain ngoài `CoreTenant`.
2. Cross-domain queries phải qua service layer, không JOIN trực tiếp across domain tables.
3. `identity_access` là foundation — tất cả domain khác đều foreign key vào `CoreTenant`.
4. `data_ingest` và `market_serving` là input tier cho `signal_intelligence` và `advisory`.

---

## 3. Phase 0 — Materializer SQL fix (CRITICAL)

### 3.1 Bảng legacy đúng cho SymbolSnapshot

```sql
-- Đọc từ portfolio_tickersessionclose (legacy)
SELECT
    tsc.symbol,
    tsc.close_price AS last_price,
    tsc.volume AS total_volume,
    tsc.change_pct AS price_change_pct,
    tsc.change_value AS price_change_value,
    tsc.session_date,
    tsc.captured_at AS fetched_at
FROM portfolio_tickersessionclose tsc
WHERE tsc.session_date = (
    SELECT MAX(session_date) FROM portfolio_tickersessionclose
)
ORDER BY tsc.symbol;
```

**Target model**: `market_serving.SymbolSnapshot`  
**Upsert key**: `(symbol, session_date)`  
**Update frequency**: Celery beat mỗi 60 giây

### 3.2 Bảng legacy đúng cho SessionFacts

```sql
-- Đọc từ portfolio_advisoryaggregatesnapshot (JSONB extraction)
SELECT
    aas.symbol,
    aas.session_date,
    (aas.state_json->>'cvd_normalized')::float AS cvd_normalized,
    (aas.state_json->>'buy_strength')::float AS buy_strength,
    (aas.state_json->>'institutional_strength')::float AS institutional_strength,
    (aas.state_json->>'whale_net_flow')::bigint AS whale_net_flow,
    (aas.state_json->>'dark_flow_net')::bigint AS dark_flow_net,
    (aas.state_json->>'total_buy_notional')::bigint AS total_buy_notional,
    (aas.state_json->>'total_sell_notional')::bigint AS total_sell_notional,
    aas.freshness_ts AS computed_at
FROM portfolio_advisoryaggregatesnapshot aas
WHERE aas.session_date = (
    SELECT MAX(session_date) FROM portfolio_advisoryaggregatesnapshot
)
ORDER BY aas.symbol;
```

**Target model**: `market_serving.SessionFacts`  
**Upsert key**: `(symbol, session_date)`  
**Update frequency**: Celery beat mỗi 5 phút

### 3.3 UnifiedAlert materializer

```sql
-- Đọc từ portfolio_whalealertevent (legacy)
SELECT
    wae.event_id,
    wae.symbol,
    wae.alert_type,
    wae.value_vnd,
    wae.side,
    wae.detected_at,
    wae.session_date,
    wae.severity
FROM portfolio_whalealertevent wae
WHERE wae.detected_at >= NOW() - INTERVAL '24 hours'
ORDER BY wae.detected_at DESC;
```

**Target model**: `signal_intelligence.UnifiedAlert`  
**Upsert key**: `event_id`  
**Update frequency**: Celery beat mỗi 5 phút

---

## 4. Phase 1 — Security model sau hardening

### 4.1 JWT token flow

```
POST /api/token/                 → access_token (15 phút) + refresh_token (7 ngày)
POST /api/token/refresh/         → mới access_token; refresh_token cũ BỊ BLACKLIST
POST /api/token/blacklist/       → explicit logout, blacklist cả hai

INSTALLED_APPS += ['rest_framework_simplejwt.token_blacklist']
SIMPLE_JWT['BLACKLIST_AFTER_ROTATION'] = True
SIMPLE_JWT['ROTATE_REFRESH_TOKENS'] = True
```

### 4.2 PAT hash function (sau hardening)

```python
import hmac as _hmac
import hashlib
import os

def _hash_pat_secret(raw_secret: str) -> str:
    """
    HMAC-SHA256 với pepper từ env var.
    Đây là hàm canonical — áp dụng giống nhau ở
    backend/portfolio/models.py VÀ packages/core/.../identity_access/models.py
    """
    pepper = os.environ.get('CORE_PAT_PEPPER', '').encode('utf-8')
    secret_bytes = str(raw_secret or '').encode('utf-8')
    if pepper:
        return _hmac.new(pepper, secret_bytes, hashlib.sha256).hexdigest()
    # Chỉ cho dev mode — prod phải set CORE_PAT_PEPPER
    import warnings
    warnings.warn(
        "CORE_PAT_PEPPER chưa được set — PAT hash đang dùng SHA-256 thuần. "
        "Không an toàn cho production.",
        SecurityWarning
    )
    return hashlib.sha256(secret_bytes).hexdigest()
```

**⚠️ Data migration required**: Sau khi deploy hash fix, tất cả PAT tokens hiện tại sẽ invalid.  
Phải chạy management command `rotate_all_pat_tokens` trước khi deploy.

### 4.3 ALLOWED_HOSTS strategy

```python
# packages/core/backend/src/vninvest_core/settings.py
_raw_hosts = os.environ.get('DJANGO_ALLOWED_HOSTS', '').strip()
if not _raw_hosts:
    if DEBUG:
        ALLOWED_HOSTS = ['localhost', '127.0.0.1', 'core-api', '[::1]']
    else:
        raise ImproperlyConfigured(
            'DJANGO_ALLOWED_HOSTS phải được set trong production. '
            'Ví dụ: DJANGO_ALLOWED_HOSTS=api.vninvest.vn,core-api'
        )
else:
    ALLOWED_HOSTS = [h.strip() for h in _raw_hosts.split(',') if h.strip()]
```

### 4.4 CORS strategy

```python
# Thay thế CORS_ALLOW_ALL_ORIGINS = DEBUG
_cors_origins = os.environ.get('CORS_ALLOWED_ORIGINS', '').strip()
if _cors_origins:
    CORS_ALLOWED_ORIGINS = [o.strip() for o in _cors_origins.split(',') if o.strip()]
    CORS_ALLOW_ALL_ORIGINS = False
elif DEBUG:
    CORS_ALLOWED_ORIGINS = ['http://localhost:3000', 'http://localhost:8088', 'http://127.0.0.1:8088']
    CORS_ALLOW_ALL_ORIGINS = False
else:
    raise ImproperlyConfigured(
        'CORS_ALLOWED_ORIGINS phải được set trong production.'
    )
```

### 4.5 Production secret guards

```yaml
# docker-compose.prod.yml — pattern bắt buộc
environment:
  DJANGO_SECRET_KEY: ${DJANGO_SECRET_KEY:?DJANGO_SECRET_KEY must be set in .env}
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set}
  CORE_PAT_PEPPER: ${CORE_PAT_PEPPER:?CORE_PAT_PEPPER must be set}
  CORS_ALLOWED_ORIGINS: ${CORS_ALLOWED_ORIGINS:?CORS_ALLOWED_ORIGINS must be set}
  DJANGO_ALLOWED_HOSTS: ${DJANGO_ALLOWED_HOSTS:?DJANGO_ALLOWED_HOSTS must be set}
```

---

## 5. Phase 2 — Database separation spec

### 5.1 Database layout

```
PostgreSQL instance (shared host)
├── vninvest          ← Legacy DB (readonly sau Phase 3 cutover)
│   ├── portfolio_*   (55+ legacy tables)
│   └── ...
└── vninvest_core     ← SaaS Core DB
    ├── identity_access_*
    ├── market_serving_*
    ├── signal_intelligence_*
    ├── commercial_*
    ├── advisory_*
    ├── user_workspace_*
    ├── market_data_*
    ├── data_ingest_*
    └── ops_audit_*
```

### 5.2 Django database routing

```python
# packages/core/backend/src/vninvest_core/db_router.py
class CoreRouter:
    """Route tất cả core models vào core DB, chỉ đọc legacy DB từ materializers."""
    
    LEGACY_READONLY_APPS = {'legacy_read'}  # Pseudo-app cho legacy queries
    
    def db_for_read(self, model, **hints):
        if model._meta.app_label in self.LEGACY_READONLY_APPS:
            return 'legacy'
        return 'default'
    
    def db_for_write(self, model, **hints):
        if model._meta.app_label in self.LEGACY_READONLY_APPS:
            raise RuntimeError('Không được ghi vào legacy DB từ core containers')
        return 'default'
    
    def allow_migrate(self, db, app_label, model_name=None, **hints):
        if db == 'legacy':
            return False  # Không bao giờ migrate vào legacy DB
        return True

# settings.py
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': env('CORE_DB_NAME', default='vninvest_core'),
        'USER': env('CORE_DB_USER'),
        'PASSWORD': env('CORE_DB_PASSWORD'),
        'HOST': env('CORE_DB_HOST', default='core-db'),
        'PORT': env('CORE_DB_PORT', default='5432'),
        'CONN_MAX_AGE': int(env('CORE_DB_CONN_MAX_AGE', default='60')),
    },
    'legacy': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': env('LEGACY_DB_NAME', default='vninvest'),
        'USER': env('LEGACY_DB_USER'),
        'PASSWORD': env('LEGACY_DB_PASSWORD'),
        'HOST': env('LEGACY_DB_HOST', default='db'),
        'PORT': env('LEGACY_DB_PORT', default='5432'),
        'CONN_MAX_AGE': int(env('LEGACY_DB_CONN_MAX_AGE', default='30')),
        'OPTIONS': {'options': '-c default_transaction_read_only=on'},  # Readonly
    },
}
DATABASE_ROUTERS = ['vninvest_core.db_router.CoreRouter']
```

---

## 6. Phase 3 — Domain model specs

### 6.1 `identity_access.UserProfile`

```python
class UserProfile(models.Model):
    """Replaces legacy portfolio.UserConfig — phi-commercial fields."""
    tenant = models.OneToOneField(
        'identity_access.CoreTenant',
        on_delete=models.CASCADE,
        related_name='profile'
    )
    theme = models.CharField(max_length=10, default='dark',
                             choices=[('dark', 'Tối'), ('light', 'Sáng')])
    language = models.CharField(max_length=5, default='vi')
    whale_alert_threshold_vnd = models.BigIntegerField(default=500_000_000)
    email_verified = models.BooleanField(default=False)
    notification_channels = models.JSONField(default=dict)  # {email: bool, telegram: bool}
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'identity_access_userprofile'
```

### 6.2 `commercial.Subscription`

```python
class Subscription(models.Model):
    PLAN_CHOICES = [
        ('free', 'Miễn phí'),
        ('basic', 'Cơ bản'),
        ('pro', 'Chuyên nghiệp'),
        ('enterprise', 'Doanh nghiệp'),
    ]
    STATUS_CHOICES = [
        ('active', 'Đang hoạt động'),
        ('trial', 'Dùng thử'),
        ('expired', 'Hết hạn'),
        ('cancelled', 'Đã hủy'),
    ]
    
    tenant = models.OneToOneField(
        'identity_access.CoreTenant', on_delete=models.CASCADE
    )
    plan = models.CharField(max_length=20, choices=PLAN_CHOICES, default='free')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='trial')
    started_at = models.DateTimeField()
    expires_at = models.DateTimeField(null=True, blank=True)
    trial_ends_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'commercial_subscription'
```

### 6.3 `commercial.Quota`

```python
class Quota(models.Model):
    """AI token budget và usage tracking."""
    tenant = models.ForeignKey('identity_access.CoreTenant', on_delete=models.CASCADE)
    quota_type = models.CharField(max_length=50)  # 'ai_tokens_daily', 'api_calls_hourly'
    limit_value = models.BigIntegerField()
    used_value = models.BigIntegerField(default=0)
    window_start = models.DateTimeField()
    window_end = models.DateTimeField()
    
    class Meta:
        db_table = 'commercial_quota'
        unique_together = [('tenant', 'quota_type', 'window_start')]
```

### 6.4 `signal_intelligence.UnifiedAlert`

```python
class UnifiedAlert(models.Model):
    """Canonical alert store — replaces WhaleAlertEvent + DarkFlowAlert."""
    DOMAIN_CHOICES = [
        ('whale', 'Whale'),
        ('dark_flow', 'Luồng tối'),
        ('order_flow', 'Dòng lệnh'),
    ]
    SIDE_CHOICES = [('buy', 'Mua'), ('sell', 'Bán'), ('neutral', 'Trung tính')]
    
    event_id = models.CharField(max_length=64, unique=True, db_index=True)
    symbol = models.CharField(max_length=12, db_index=True)
    domain = models.CharField(max_length=20, choices=DOMAIN_CHOICES)
    alert_type = models.CharField(max_length=50)
    value_vnd = models.BigIntegerField()
    side = models.CharField(max_length=10, choices=SIDE_CHOICES)
    severity = models.SmallIntegerField(default=1)  # 1-5
    detected_at = models.DateTimeField(db_index=True)
    session_date = models.DateField(db_index=True)
    metadata = models.JSONField(default=dict)
    
    class Meta:
        db_table = 'signal_intelligence_unifiedalert'
        indexes = [
            models.Index(fields=['symbol', 'session_date', 'domain']),
            models.Index(fields=['detected_at']),
        ]
```

### 6.5 `market_serving.SymbolSnapshot`

```python
class SymbolSnapshot(models.Model):
    """Materialized từ portfolio_tickersessionclose."""
    symbol = models.CharField(max_length=12, db_index=True)
    session_date = models.DateField()
    last_price = models.DecimalField(max_digits=12, decimal_places=2)
    total_volume = models.BigIntegerField(default=0)
    price_change_pct = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    price_change_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    fetched_at = models.DateTimeField()
    materialized_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'market_serving_symbolsnapshot'
        unique_together = [('symbol', 'session_date')]
```

### 6.6 `market_serving.SessionFacts`

```python
class SessionFacts(models.Model):
    """Materialized analytics facts từ portfolio_advisoryaggregatesnapshot."""
    symbol = models.CharField(max_length=12, db_index=True)
    session_date = models.DateField()
    cvd_normalized = models.FloatField(null=True, blank=True)
    buy_strength = models.FloatField(null=True, blank=True)
    institutional_strength = models.FloatField(null=True, blank=True)
    whale_net_flow = models.BigIntegerField(default=0)
    dark_flow_net = models.BigIntegerField(default=0)
    total_buy_notional = models.BigIntegerField(default=0)
    total_sell_notional = models.BigIntegerField(default=0)
    computed_at = models.DateTimeField(null=True, blank=True)
    materialized_at = models.DateTimeField(auto_now=True)
    is_complete = models.BooleanField(default=False)
    
    class Meta:
        db_table = 'market_serving_sessionfacts'
        unique_together = [('symbol', 'session_date')]
```

### 6.7 `advisory.AdvisoryRecord`

```python
class AdvisoryRecord(models.Model):
    """Replaces legacy WhaleAdvisory."""
    STATUS_CHOICES = [
        ('generating', 'Đang tạo'),
        ('ready', 'Sẵn sàng'),
        ('error', 'Lỗi'),
        ('stale', 'Lỗi thời'),
    ]
    
    tenant = models.ForeignKey('identity_access.CoreTenant', on_delete=models.CASCADE)
    symbol = models.CharField(max_length=12)
    session_date = models.DateField()
    content = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    provider = models.CharField(max_length=30)  # 'openclaw', 'openai', 'anthropic'
    tokens_used = models.IntegerField(default=0)
    generated_at = models.DateTimeField()
    expires_at = models.DateTimeField()
    metadata = models.JSONField(default=dict)
    
    class Meta:
        db_table = 'advisory_advisoryrecord'
        indexes = [
            models.Index(fields=['tenant', 'symbol', 'session_date']),
        ]
```

---

## 7. Phase 3 — Celery task migration spec

### 7.1 Shadow run protocol

Mỗi Celery task migration phải theo protocol:

```
Week 1: Legacy task chạy bình thường
         Core task cũng chạy (shadow mode) — ghi vào DB core NHƯNG không affect production flow
         Core task tự so sánh output với legacy output và log parity metric

Week 2-3: Compare parity logs mỗi ngày
          Nếu parity < 99% → fix core task, kéo dài shadow thêm 1 tuần
          Nếu parity >= 99% trong 3 ngày liên tiếp → proceed to cutover

Cutover: Tắt legacy task, enable core task fully
         Monitor 48 giờ post-cutover
         Nếu incident → rollback (bật lại legacy task)
```

### 7.2 Task routing spec

```python
# packages/core/backend/src/vninvest_core/celery.py
app.conf.task_routes = {
    'data_ingest.*': {'queue': 'ingest'},
    'market_serving.*': {'queue': 'core'},
    'signal_intelligence.*': {'queue': 'core'},
    'advisory.*': {'queue': 'advisory'},   # Separate queue — AI calls nặng
    'user_workspace.*': {'queue': 'core'},
    'ops_audit.*': {'queue': 'maintenance'},
    'commercial.*': {'queue': 'core'},
}
```

### 7.3 Shadow run logging format

```python
def log_shadow_parity(task_name: str, legacy_result, core_result, symbol: str = None):
    """Bắt buộc gọi trong mọi shadow task."""
    match = _compute_parity(legacy_result, core_result)
    logger.info(
        "SHADOW_PARITY",
        extra={
            'task': task_name,
            'symbol': symbol,
            'parity_pct': match,
            'match': match >= 99.0,
            'legacy_hash': _hash_result(legacy_result),
            'core_hash': _hash_result(core_result),
            'ts': timezone.now().isoformat(),
        }
    )
```

---

## 8. Phase 4 — Frontend migration spec

### 8.1 coreApiAdapter contract

```javascript
// packages/web/src/adapters/coreApiAdapter.js — pattern bắt buộc

// Tất cả calls phải đi qua adapter này, không gọi fetch/axios trực tiếp
export const coreApi = {
  // Market
  getSymbolSnapshot: (symbol) => get(`/core/v1/market/symbol-snapshot/?symbol=${symbol}`),
  getSessionFacts:   (symbol, sessionDate) => get(`/core/v1/market/session-facts/?symbol=${symbol}&session_date=${sessionDate}`),
  
  // Signals
  getUnifiedAlerts:  (symbol, sessionDate) => get(`/core/v1/signals/unified-alerts/?symbol=${symbol}&session_date=${sessionDate}`),
  
  // Advisory
  getAdvisory:       (symbol) => get(`/core/v1/advisory/${symbol}/latest/`),
  refreshAdvisory:   (symbol) => post(`/core/v1/advisory/${symbol}/refresh/`),
  
  // Workspace
  getPortfolios:     () => get('/core/v1/workspace/portfolios/'),
  getTransactions:   (portfolioId) => get(`/core/v1/workspace/portfolios/${portfolioId}/transactions/`),
  getWatchlist:      () => get('/core/v1/workspace/watchlist/'),
  
  // Commercial
  getSubscription:   () => get('/core/v1/commercial/subscription/'),
  getQuotaUsage:     () => get('/core/v1/commercial/quota/usage/'),
};
```

### 8.2 Nginx routing transition plan

```nginx
# Phase 4 — Transition state
location /api/ {
    # Legacy backend — TEMPORARY
    proxy_pass http://backend:8000;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}

location /core/ {
    proxy_pass http://core-api:8100;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Authorization $http_authorization;
}

# Phase 6 — Post-cutover state (thay thế block /api/ ở trên)
# location /api/ {
#     return 410 '{"error": "Legacy API đã ngừng hoạt động. Dùng /core/v1/"}';
# }
```

### 8.3 Page migration priority

| Page | Legacy file | Packages/web target | API endpoints cần |
|---|---|---|---|
| Dashboard | `frontend/src/pages/Dashboard.jsx` | `packages/web/src/pages/DashboardPage.jsx` | `/core/v1/market/symbol-snapshot/` |
| WhaleAlerts | `frontend/src/pages/WhaleAlertsDashboard.jsx` | `packages/web/src/pages/WhaleAlertsPage.jsx` | `/core/v1/signals/unified-alerts/` |
| StockDetail | `frontend/src/pages/StockDetail.jsx` | `packages/web/src/pages/StockDetailPage.jsx` | `/core/v1/market/*` + `/core/v1/signals/*` |
| Portfolio | `frontend/src/pages/PortfolioManagement.jsx` | `packages/web/src/pages/PortfolioPage.jsx` | `/core/v1/workspace/portfolios/` |
| Transactions | `frontend/src/pages/Transactions.jsx` | `packages/web/src/pages/TransactionsPage.jsx` | `/core/v1/workspace/transactions/` |
| UserConfig | `frontend/src/pages/UserConfig.jsx` | `packages/web/src/pages/UserConfigPage.jsx` | `/core/v1/identity/profile/` |

---

## 9. Phase 5 — Infrastructure spec

### 9.1 Docker images

```yaml
# packages/core/backend/Dockerfile
FROM python:3.13-slim AS builder
WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt --target=/deps

FROM python:3.13-slim
WORKDIR /app
COPY --from=builder /deps /usr/local/lib/python3.13/site-packages/
COPY . .
ENV PYTHONPATH=/app/src
ENV DJANGO_SETTINGS_MODULE=vninvest_core.settings
EXPOSE 8100
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8100/core/health/')"
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["gunicorn", "vninvest_core.wsgi:application", \
     "--bind", "0.0.0.0:8100", "--workers", "4", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--timeout", "60", "--keepalive", "5", \
     "--max-requests", "1000", "--max-requests-jitter", "50", \
     "--access-logfile", "-", "--error-logfile", "-"]
```

### 9.2 entrypoint.sh

```bash
#!/bin/sh
set -e

echo "=== VNInvest Core API Starting ==="
echo "Environment: ${CORE_ENV:-development}"
echo "Running migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput --clear

echo "Starting server..."
exec "$@"
```

### 9.3 PgBouncer config

```ini
# infra/pgbouncer/pgbouncer.ini
[databases]
vninvest_core = host=core-db port=5432 dbname=vninvest_core

[pgbouncer]
pool_mode = transaction
max_client_conn = 500
default_pool_size = 20
min_pool_size = 5
server_idle_timeout = 600
client_idle_timeout = 60
log_connections = 0
log_disconnections = 0
```

### 9.4 Prometheus scrape config

```yaml
# infra/prometheus/prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'core-api'
    static_configs:
      - targets: ['core-api:8100']
    metrics_path: '/core/metrics/'
    
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
      
  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']
      
  - job_name: 'celery'
    static_configs:
      - targets: ['flower:5555']
    metrics_path: '/metrics'
```

---

## 10. Pre-decommission verification spec

### 10.1 Gate A — Data parity verification

```python
# scripts/verify_migration_parity.py
"""
Chạy command này để verify data parity trước Phase 6.
Usage: python verify_migration_parity.py --domain=all --sample-size=1000
"""
PARITY_THRESHOLD = 99.0  # percent

def verify_symbol_snapshot_parity():
    """So sánh market_serving_symbolsnapshot vs portfolio_tickersessionclose."""
    ...

def verify_unified_alert_parity():
    """So sánh signal_intelligence_unifiedalert vs portfolio_whalealertevent."""
    ...
```

### 10.2 Gate F — Performance targets

| Metric | Verification command | Pass condition |
|---|---|---|
| API p95 latency | `k6 run infra/load-tests/api-smoke.js` | p95 < 200ms |
| Concurrent users | `k6 run --vus=500 infra/load-tests/api-load.js` | 0 errors at 500 VUs |
| DB query p95 | Grafana dashboard `postgres_query_duration_p95` | < 100ms |
| Celery task success | `celery inspect active` + beat log review | >= 99.5% success rate |

### 10.3 Gate G — Celery queue drain verification

```bash
# Kiểm tra không còn task legacy trong Redis queue
docker compose exec core-redis redis-cli \
  --pipe-mode \
  keys "celery*" | wc -l  # Phải = 0 sau khi legacy shutdown

# Hoặc dùng celery inspect
docker compose exec backend \
  celery -A config inspect active_queues
# Expected: empty sau khi legacy shutdown
```

---

## 11. API endpoint registry

### 11.1 Core API endpoint list (đầy đủ)

| Method | Path | Domain | Auth | Notes |
|---|---|---|---|---|
| `GET` | `/core/health/` | ops | None | Health check |
| `GET` | `/core/v1/identity/profile/` | identity_access | PAT | User profile |
| `PATCH` | `/core/v1/identity/profile/` | identity_access | PAT | Update profile |
| `GET` | `/core/v1/identity/pats/` | identity_access | PAT | List PAT tokens |
| `POST` | `/core/v1/identity/pats/` | identity_access | PAT | Create PAT |
| `DELETE` | `/core/v1/identity/pats/{id}/` | identity_access | PAT | Revoke PAT |
| `GET` | `/core/v1/market/symbol-snapshot/` | market_serving | PAT | Price snapshot |
| `GET` | `/core/v1/market/session-facts/` | market_serving | PAT | Session analytics |
| `GET` | `/core/v1/market/price-board/` | market_serving | PAT | Full price board |
| `GET` | `/core/v1/signals/unified-alerts/` | signal_intelligence | PAT | Whale + dark flow alerts |
| `GET` | `/core/v1/signals/order-flow/` | signal_intelligence | PAT | Order flow events |
| `GET` | `/core/v1/advisory/{symbol}/latest/` | advisory | PAT | Latest advisory |
| `POST` | `/core/v1/advisory/{symbol}/refresh/` | advisory | PAT | Trigger new advisory |
| `GET` | `/core/v1/workspace/portfolios/` | user_workspace | PAT | User portfolios |
| `POST` | `/core/v1/workspace/portfolios/` | user_workspace | PAT | Create portfolio |
| `GET` | `/core/v1/workspace/portfolios/{id}/transactions/` | user_workspace | PAT | Transactions |
| `GET` | `/core/v1/workspace/watchlist/` | user_workspace | PAT | Watchlist |
| `GET` | `/core/v1/commercial/subscription/` | commercial | PAT | Subscription info |
| `GET` | `/core/v1/commercial/quota/usage/` | commercial | PAT | Token usage |
| `POST` | `/core/v1/commercial/webhooks/vnpay/` | commercial | Signature | VNPay webhook |
| `POST` | `/core/v1/commercial/webhooks/momo/` | commercial | Signature | MoMo webhook |
| `GET` | `/core/v1/admin/lifecycle/summary/` | ops_audit | AdminPAT | Lifecycle overview |
| `GET` | `/core/metrics/` | ops | Internal | Prometheus metrics |

### 11.2 Response envelope chuẩn

```json
{
  "data": { ... },
  "meta": {
    "request_id": "uuid",
    "source": "facts-first | materializer | legacy-fallback",
    "freshness_ts": "ISO8601",
    "is_complete": true
  },
  "errors": null
}
```

**`source` field là bắt buộc** cho mọi market/signal endpoints — audit và debugging phụ thuộc vào đây.
