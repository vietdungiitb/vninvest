# TECH SPEC — SaaS Full Independence: Loại bỏ Hoàn toàn Phụ thuộc Legacy

**Ngày tạo**: 2026-05-04  
**Scope**: Option B — core-api thành single entry point, legacy backend decommission  
**Level**: A (kiến trúc routing, data migration, domain expansion)  
**Status**: APPROVED FOR IMPLEMENTATION

---

## 1. Nguyên tắc kỹ thuật bất biến

1. **Single entry point**: Sau B1, mọi HTTP traffic phải qua `core-api:8100`. nginx không được route thẳng đến `backend:8000`.
2. **Proxy-then-migrate**: B1 thêm transparent proxy. Từng domain được migrate native vào core, sau đó proxy rule cho domain đó bị xóa.
3. **No data loss**: User data (portfolios, transactions, watchlist) phải được migrate với parity ≥ 99% và shadow run ≥ 3 ngày trade trước cutover.
4. **Backward-compatible contracts**: Frontend API client (`frontend/src/api/client.js`) không được thay đổi URL contracts — mọi thứ vẫn là `/api/*` từ client perspective.
5. **Legacy read-only**: CoreRouter (`vninvest_core/db_router.py`) phải tiếp tục block writes vào legacy DB từ core containers.

---

## 2. Phase B1 — Proxy Gateway

### 2.1 Mục tiêu
Phá vỡ sự phụ thuộc nginx→backend. Sau phase này nginx chỉ biết đến `core-api:8100`.

### 2.2 Component: `legacy_proxy.py`

**File**: `packages/core/backend/src/vninvest_core/legacy_proxy.py`

```python
# Spec: transparent HTTP proxy từ core-api → legacy backend
# - Forward toàn bộ headers (trừ hop-by-hop)
# - Preserve method, path, query string, body
# - Streaming response (dùng httpx.AsyncClient)
# - Timeout: connect=5s, read=120s (cho admin-ops endpoints dài)
# - Log: request path + upstream response status (không log body)
# - Không cache, không modify response
# - WebSocket: không proxy qua đây (xử lý riêng ở nginx level)

HOP_BY_HOP = frozenset([
    'connection', 'keep-alive', 'proxy-authenticate',
    'proxy-authorization', 'te', 'trailers', 'transfer-encoding', 'upgrade'
])

LEGACY_BACKEND_URL = settings.LEGACY_BACKEND_URL  # từ env var
```

**Contract**:
- URL wildcard: `path('api/<path:remaining>', legacy_proxy_view)` — đặt CUỐI cùng trong urls.py
- Method: ALL (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS)
- Auth headers: pass-through nguyên vẹn (core không validate, legacy tự validate)
- Response: stream trực tiếp, không buffer toàn bộ body

### 2.3 Settings mới trong `vninvest_core/settings.py`

```python
# Phase B1 — Legacy proxy target
LEGACY_BACKEND_URL = os.environ.get('LEGACY_BACKEND_URL', 'http://backend:8000')
```

### 2.4 Thay đổi `docker-compose.dev.yml`

```yaml
core-api:
  environment:
    LEGACY_BACKEND_URL: http://backend:8000  # thêm mới

frontend:
  depends_on:
    core-api:           # giữ
      condition: service_healthy
    # XÓA: backend: service_healthy  ← phá vỡ dependency

backend:
  # XÓA: ports: - "8000:8000"  ← không expose ra ngoài nữa
  # Giữ: vẫn chạy trong internal network
```

### 2.5 Thay đổi `frontend/docker/nginx.conf`

```nginx
# CŨ:
location /api/ {
    proxy_pass http://$backend_upstream;
    ...
}

# MỚI:
location /api/ {
    proxy_pass http://core-api:8100;
    proxy_redirect off;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $proxy_forwarded_proto;
    proxy_read_timeout 300s;  # admin-ops cần timeout dài
}
```

### 2.6 Dependency mới
- `httpx>=0.27,<1.0` — thêm vào `packages/core/backend/requirements.txt`

### 2.7 Acceptance criteria B1
- `curl http://localhost/api/health/` → 200 (qua proxy)
- `curl http://localhost/api/portfolio/portfolios/` → 200 hoặc 401 (không phải 502)
- `curl http://localhost/api/realtime/whale-feed/VIC/` → đúng data như trước
- Không có port `8000` exposed trên host sau khi áp dụng
- Nginx không còn `set $backend_upstream backend:8000` trong location /api/

---

## 3. Phase B2 — Auth Native

### 3.1 Mục tiêu
Core-api tự handle toàn bộ auth endpoints, xóa proxy rule cho `/api/auth/*`.

### 3.2 Endpoints phải implement trong core

| Endpoint | Method | Handler |
|---------|--------|---------|
| `/api/auth/register/` | POST | `identity_access.views_auth.register_view` |
| `/api/auth/verify-email/` | POST | `identity_access.views_auth.verify_email_view` |
| `/api/auth/resend-verification/` | POST | `identity_access.views_auth.resend_verification_view` |
| `/api/auth/password-reset/request/` | POST | `identity_access.views_auth.password_reset_request_view` |
| `/api/auth/password-reset/confirm/` | POST | `identity_access.views_auth.password_reset_confirm_view` |
| `/api/auth/oauth/google/` | POST | `identity_access.views_auth.google_oauth_view` |

### 3.3 Email backend spec

```python
# settings.py — dev
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = os.environ.get('EMAIL_HOST', 'mailpit')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', '1025'))
EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'false').lower() == 'true'

# settings.py — prod (khi EMAIL_USE_TLS=true và EMAIL_HOST_PASSWORD set)
```

### 3.4 User model mapping (legacy → core)

| Legacy field | Core field | Notes |
|-------------|-----------|-------|
| `auth_user.id` | `identity_access_userprofile.legacy_user_id` | FK reference |
| `auth_user.email` | `identity_access_userprofile.email` | Primary key trong core |
| `auth_user.is_active` | `identity_access_userprofile.is_active` | |
| `auth_user.date_joined` | `identity_access_userprofile.created_at` | |

### 3.5 Migration strategy B2
1. Script `migrate_users.py`: SELECT tất cả `auth_user` từ legacy DB → INSERT vào core DB với mapping ở trên
2. Grace period 24h: core auth sẽ fallback sang proxy nếu user chưa được migrate
3. Cutover: sau 24h, xóa proxy rule cho `/api/auth/*`

---

## 4. Phase B3 — Market & Realtime Native

### 4.1 Endpoints phải implement

#### Nhóm Realtime (`signal_intelligence` app)
| Endpoint | Data source | Notes |
|---------|-------------|-------|
| `/api/realtime/ticker/<symbol>/` | vnbroker realtime hoặc Redis cache | TTL 15s |
| `/api/realtime/tickers/?symbols=` | Batch fetch | Tối đa 50 symbols |
| `/api/realtime/intraday/<symbol>/` | `portfolio_intradaytick` qua legacy readonly | Paginated |
| `/api/realtime/price-board/<symbol>/` | vnbroker | TTL 10s |
| `/api/realtime/breadth/<symbol>/` | Computed từ ticks | |
| `/api/realtime/whale-feed/<symbol>/` | `portfolio_whalealertevent` qua legacy readonly | |
| `/api/realtime/whale-feed/aggregate/` | Aggregated | |
| `/api/realtime/whale-campaigns/` | `portfolio_whalecampaign` qua legacy readonly | |
| `/api/realtime/unified-alerts/` | Redirect → `/core/v1/signals/unified-alert` | Alias |
| `/api/realtime/rvol/<symbol>/` | Computed từ intraday | |
| `/api/realtime/depth-chart/<symbol>/` | vnbroker | |

#### Nhóm Stock Management (`market_data` + `signal_intelligence` apps)
| Endpoint | App | Notes |
|---------|-----|-------|
| `/api/stock-management/stocks/<symbol>/` | `market_data` | Profile + metadata |
| `/api/stock-management/stocks/<symbol>/overview/` | `market_data` | Extended overview |
| `/api/stock-management/stocks/<symbol>/chart/` | `market_data` | OHLCV từ DailyPrice |
| `/api/stock-management/stocks/<symbol>/order-flow/` | `signal_intelligence` | OrderFlowEvent |
| `/api/stock-management/stocks/<symbol>/news/` | `market_data` | Fetch từ news source |
| `/api/stock-management/stocks/<symbol>/financials/` | `market_data` | |
| `/api/stock-management/technicals/bulk/` | `market_data` | Bulk TA compute |
| `/api/stock-management/groups/` | `market_data` | Market groups |
| `/api/stock-management/tracked-symbols/` | `signal_intelligence` | CRUD tracked symbols |

### 4.2 vnbroker integration spec

```python
# Không thêm vnbroker vào core requirements ngay — dùng legacy readonly DB
# làm data source qua CoreRouter legacy_readonly alias.
# Chỉ khi đến B8 (legacy decommission) mới cần direct vnbroker integration.

DATABASES['legacy_readonly'] = {
    'ENGINE': 'django.db.backends.postgresql',
    'NAME': os.environ.get('LEGACY_DB_NAME', 'vninvest'),
    # ... read-only connection
}
```

### 4.3 Acceptance criteria B3
- Mọi endpoint trên trả đúng data như trước (so sánh sample 20 symbols)
- Proxy rule cho `/api/realtime/*` và `/api/stock-management/*` đã xóa
- `/api/realtime/whale-feed/VIC/` latency < 200ms (p95)

---

## 5. Phase B4 — Portfolio & Workspace Native

### 5.1 Models cần thêm vào `user_workspace`

```python
class SubAccount(models.Model):
    portfolio = models.ForeignKey(Portfolio, on_delete=models.CASCADE, related_name='subaccounts')
    name = models.CharField(max_length=100)
    broker = models.CharField(max_length=50, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    # ... map từ portfolio_subaccount legacy

class Transaction(models.Model):
    subaccount = models.ForeignKey(SubAccount, on_delete=models.CASCADE, related_name='transactions')
    symbol = models.CharField(max_length=20)
    transaction_type = models.CharField(max_length=10)  # buy/sell
    quantity = models.DecimalField(max_digits=15, decimal_places=2)
    price = models.DecimalField(max_digits=15, decimal_places=2)
    transaction_date = models.DateField()
    fee = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    # ... map từ portfolio_transaction legacy
```

### 5.2 Endpoints phải implement

| Endpoint | Method | Notes |
|---------|--------|-------|
| `/api/portfolio/portfolios/` | GET, POST | List/create |
| `/api/portfolio/portfolios/<id>/` | GET, PUT, DELETE | Detail |
| `/api/portfolio/portfolios/<id>/holdings/` | GET | Computed từ transactions |
| `/api/portfolio/portfolios/<id>/summary/` | GET | P&L summary |
| `/api/portfolio/portfolios/<id>/chart/?days=` | GET | Equity curve |
| `/api/portfolio/portfolios/<id>/equity-curve/?days=` | GET | |
| `/api/portfolio/portfolios/<id>/allocation/` | GET | By symbol + sector |
| `/api/portfolio/portfolios/<id>/analytics/?days=` | GET | |
| `/api/portfolio/portfolios/<id>/technicals/` | GET | |
| `/api/portfolio/portfolios/<id>/sync/` | POST | Sync prices |
| `/api/portfolio/subaccounts/` | GET, POST | |
| `/api/portfolio/subaccounts/<id>/` | PATCH, DELETE | |
| `/api/portfolio/subaccounts/<id>/transactions/` | GET, POST | |
| `/api/portfolio/transactions/<id>/` | PATCH, DELETE | |
| `/api/portfolio/watchlist/groups/` | GET, POST | |
| `/api/portfolio/watchlist/groups/<id>/` | PATCH, DELETE | |
| `/api/portfolio/watchlist/groups/<id>/items/` | POST | Add symbol |
| `/api/portfolio/watchlist/items/<id>/` | DELETE | |
| `/api/portfolio/watchlist/seed/` | POST | Seed default |
| `/api/portfolio/watchlist/sync/` | POST | Sync prices |

### 5.3 Data migration protocol B4

**Shadow mode (3 ngày trade)**:
```python
# Dual-write: ghi vào cả legacy và core DB khi user tạo/sửa data
# Read: vẫn từ legacy (source of truth trong shadow period)
# Parity check script: compare legacy vs core, report % match
```

**Cutover checklist**:
- [ ] Shadow run ≥ 3 ngày trade liên tiếp
- [ ] Parity ≥ 99% trên tất cả portfolios, subaccounts, transactions
- [ ] Backup legacy DB trước cutover
- [ ] Chuyển read từ core DB
- [ ] Monitor 24h sau cutover

### 5.4 Acceptance criteria B4
- Tất cả 22 portfolio endpoints trả đúng data (compare với legacy)
- Portfolio summary P&L khớp ±0.01% với legacy
- Shadow parity report: `parity_score >= 0.99`

---

## 6. Phase B5 — AI Advisory Native

### 6.1 Models cần thêm vào `advisory`

```python
class AdvisorySession(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    symbol = models.CharField(max_length=20)
    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, default='active')

class AdvisoryComponent(models.Model):
    session = models.ForeignKey(AdvisorySession, on_delete=models.CASCADE, related_name='components')
    component_type = models.CharField(max_length=50)
    content = models.TextField()
    included = models.BooleanField(default=True)
    generated_at = models.DateTimeField(auto_now_add=True)

class AdvisoryObservability(models.Model):
    session = models.ForeignKey(AdvisorySession, on_delete=models.CASCADE)
    event_type = models.CharField(max_length=50)
    payload = models.JSONField(default=dict)
    recorded_at = models.DateTimeField(auto_now_add=True)
```

### 6.2 AI config spec

```python
# settings.py
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')
OPENAI_MODEL = os.environ.get('OPENAI_MODEL', 'gpt-4o-mini')
AI_ADVISORY_MAX_TOKENS = int(os.environ.get('AI_ADVISORY_MAX_TOKENS', '4096'))
```

### 6.3 Endpoints phải implement

| Endpoint | Notes |
|---------|-------|
| `/api/stock-management/stocks/<symbol>/ai-advisory-session/` | GET + POST |
| `/api/stock-management/stocks/<symbol>/ai-advisory-observability/` | GET + POST |
| `/api/stock-management/ai-advisory-components/<id>/toggle-include/` | POST |
| `/api/stock-management/ai-advisory-components/<id>/refresh/` | POST |
| `/api/stock-management/ai-advisory-components/<id>/restore/` | POST |
| `/api/stock-management/ai-advisory-components/<id>/` | DELETE |
| `/api/stock-management/stocks/<symbol>/ai-advisory-components/deleted/` | DELETE |
| `/api/stock-management/stocks/<symbol>/ai-advisory-summary/regenerate/` | POST |
| `/api/stock-management/stocks/<symbol>/ai-advisory-summary/<id>/` | DELETE |
| `/api/portfolio/ai-advisory/<symbol>/canonical/` | GET |
| `/api/portfolio/ai-advisory/<symbol>/current/` | DELETE |
| `/api/portfolio/ai-advisory/<symbol>/auto-refresh-info/` | GET |
| `/api/portfolio/ai-advisory-symbol-stats/` | GET |
| `/api/ai-options/` | GET |

---

## 7. Phase B6 — Admin Ops Native

### 7.1 Phân loại endpoints

#### Nhóm A — Port sang `ops_audit` app
- `/api/admin-ops/stats/` — system stats
- `/api/admin-ops/runtime-kpi/` — runtime KPIs
- `/api/admin-ops/system-ai-settings/` — AI config CRUD
- `/api/admin-ops/vnbroker-config/*` — vnbroker runtime config
- `/api/admin-ops/signals/*` — signal admin (universe, governance, retention)

#### Nhóm B — Port sang Celery tasks trong core
- `/api/admin-ops/prefetch/warm/` → trigger `core_worker.tasks.warm_prefetch`
- `/api/admin-ops/market-groups/sync/` → trigger `data_ingest.tasks.sync_market_groups`
- `/api/admin-ops/intraday-universe/warm-now/` → trigger `signal_intelligence.tasks.warm_universe`

#### Nhóm C — Port sang `market_data` app
- `/api/admin-sync/stockprofile/` → `market_data.tasks.sync_stock_profiles`
- `/api/stock-management/seed/` → seed fixtures
- `/api/stock-management/sync/` → sync prices

### 7.2 Permission model cho admin endpoints

```python
# Admin ops phải require IsAdminUser hoặc custom IsCoreOperator permission
from identity_access.permissions import IsCoreOperator

class AdminOpsView(APIView):
    permission_classes = [IsAuthenticated, IsCoreOperator]
```

---

## 8. Phase B7 — WebSocket Migration

### 8.1 Django Channels setup

```python
# requirements.txt
channels[daphne]>=4.0,<5.0

# asgi.py
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack

application = ProtocolTypeRouter({
    'http': django_asgi_app,
    'websocket': AuthMiddlewareStack(URLRouter(websocket_urlpatterns)),
})
```

### 8.2 nginx WebSocket routing

```nginx
# Thêm vào nginx.conf
location /ws/ {
    proxy_pass http://core-api:8100;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;
}
```

### 8.3 Consumers cần port
- `portfolio/consumers.py` → `signal_intelligence/consumers.py`
- Channel groups: `ticker_{symbol}`, `whale_feed_{symbol}`, `portfolio_{user_id}`

---

## 9. Phase B8 — Legacy Decommission

### 9.1 Pre-decommission checklist (7 gates)
- Gate A: Mọi `/api/*` endpoint có response đúng từ core-api (không qua proxy)
- Gate B: WebSocket connections ổn định ≥ 24h trên core
- Gate C: Zero frontend errors trong 24h Sentry monitoring
- Gate D: Portfolio parity ≥ 99% (verified lần cuối)
- Gate E: Admin ops đầy đủ chức năng (tested manually)
- Gate F: Backup core DB thành công ít nhất 3 lần liên tiếp
- Gate G: Load test k6: p95 < 200ms at 500 VUs

### 9.2 Decommission steps
```powershell
# 1. Xóa proxy fallback trong urls.py (xóa legacy_proxy route cuối)
# 2. Xóa LEGACY_BACKEND_URL khỏi settings và compose
# 3. Stop legacy containers
docker compose -f docker-compose.dev.yml stop backend celery_worker celery_beat
# 4. Xóa services khỏi docker-compose.dev.yml và docker-compose.prod.yml
# 5. Tag git: git tag -a v2.0-saas-only -m "Legacy decommissioned"
# 6. Archive legacy code vào branch: git checkout -b archive/legacy-backend
```

---

## 10. API proxy exclusion list

Các path KHÔNG được proxy vào legacy (phải xử lý trong core ngay từ B1):
- `/api/auth/token/` — đã có trong core compat_urls
- `/api/auth/token/refresh/` — đã có
- `/api/auth/me/` — đã có
- `/api/portfolio/userconfig/` — đã có
- `/api/portfolio/portfolios/` — đã có skeleton (mở rộng trong B4)
- `/core/v1/*` — không proxy, luôn xử lý native

---

## 11. Environment variables mới cần thêm

| Biến | Phase | Default (dev) | Bắt buộc prod |
|------|-------|--------------|---------------|
| `LEGACY_BACKEND_URL` | B1 | `http://backend:8000` | `http://backend:8000` (internal) |
| `EMAIL_HOST` | B2 | `mailpit` | SMTP server |
| `EMAIL_PORT` | B2 | `1025` | `587` |
| `EMAIL_HOST_USER` | B2 | `""` | email address |
| `EMAIL_HOST_PASSWORD` | B2 | `""` | `${EMAIL_HOST_PASSWORD:?error}` |
| `EMAIL_USE_TLS` | B2 | `false` | `true` |
| `OPENAI_API_KEY` | B5 | `""` | `${OPENAI_API_KEY:?error}` |
| `OPENAI_MODEL` | B5 | `gpt-4o-mini` | configurable |
| `CHANNELS_REDIS_URL` | B7 | `redis://redis:6379/4` | Redis URL |
