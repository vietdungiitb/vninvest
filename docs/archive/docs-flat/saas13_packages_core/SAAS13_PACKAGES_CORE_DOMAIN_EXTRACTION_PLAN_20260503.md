# SAAS-13 — packages/core Domain Extraction (Django Thực)

**Ngày:** 2026-05-03  
**Trạng thái:** Planned — bắt đầu sau khi SAAS-12 completed  
**Mục tiêu:** Chuyển `packages/core` từ ThreadingHTTPServer stub thành Django/DRF application đầy đủ với domain-isolated bounded contexts, migration guard, request traceability và coverage tests.

---

## 1. Bối cảnh

### 1.1 Trạng thái hiện tại

```
packages/core/backend/src/vninvest_core/
├── api_stub.py          ← ThreadingHTTPServer stdlib — KHÔNG phải Django
├── app_manifest.py      ← manifest JSON static
├── worker_stub.py       ← fake Celery worker
├── beat_stub.py         ← fake Celery beat
└── stub_heartbeat.py    ← stub heartbeat task
```

Không có Django `settings.py`, không có `urls.py` thực, không có model nào, không có DRF view nào.

### 1.2 Vấn đề cốt lõi

`backend/portfolio/models.py` chứa `CoreTenant` (line ~1010), `CoreServiceAccount` (line ~1131), `CorePATCredential` (line ~1213) cùng với hàng trăm business/portfolio models khác trong một file duy nhất. Đây là:
- Tight coupling vi phạm bounded context principle
- Không thể test identity/access models độc lập với portfolio logic
- Không thể decommission legacy backend khi identity models vẫn nằm trong đó

### 1.3 Mục tiêu trạng thái sau SAAS-13

```
packages/core/backend/
├── requirements.txt          ← Django, DRF, psycopg2, celery, redis, dj-database-url
├── manage.py
├── src/
│   ├── vninvest_core/        ← Django project settings, urls, wsgi
│   │   ├── settings.py
│   │   ├── urls.py
│   │   ├── wsgi.py
│   │   └── celery.py
│   ├── identity_access/      ← CoreTenant, CoreServiceAccount, CorePATCredential
│   ├── market_serving/       ← SymbolSnapshot, SessionFacts (read models)
│   ├── signal_intelligence/  ← UnifiedAlert, WhaleAlert canonical models
│   ├── commercial/           ← Subscription, Quota, Invoice
│   └── ops_audit/            ← AuditEvent, RequestTrace, middleware
└── tests/
    ├── test_runtime_baseline.py  ← cập nhật từ stub → Django health check
    ├── test_identity_access.py
    ├── test_market_serving.py
    └── test_ops_audit.py
```

---

## 2. Bounded context breakdown

### 2.1 `identity_access` — Quản lý danh tính và quyền truy cập

**Phạm vi:**
- `CoreTenant` — thực thể thuê bao (org/tenant)
- `CoreServiceAccount` — machine identity trong một tenant
- `CorePATCredential` — Personal Access Token cho machine auth
- `CoreUserProfile` — profile mapping giữa Django User và CoreTenant
- Views: `/core/v1/auth/`, `/core/v1/tenant/`, `/core/v1/service-accounts/`, `/core/v1/pat/`
- Auth middleware: xác thực PAT Bearer token + session token

**Migration từ legacy:**
- Đọc models từ `backend/portfolio/models.py` lines ~1010-1350
- Không xóa legacy models cho đến khi SAAS-15 gate pass
- Tạo management command: `python manage.py sync_identity_from_legacy` để seed data

**Không bao gồm:**
- Portfolio logic
- Market data logic
- Trading logic

### 2.2 `market_serving` — Serving layer cho market data

**Phạm vi:**
- `SymbolSnapshot` — read model chứa giá, volume, session metadata của từng symbol
- `SessionFacts` — read model chứa CVD, buy_strength, institutional_strength, whale_net_flow
- Views: `/core/v1/symbol-snapshot/`, `/core/v1/session-facts/`
- Serializers mapping sang `symbol-snapshot.contract.json` và `session-facts.contract.json`

**Lưu ý:**
- Models này là **read models** (serving layer), không phải primary write storage
- Data được populate bởi Celery materializer jobs ở SAAS-14
- Ở SAAS-13: tạo model + view, để trống materializer (sẽ làm ở SAAS-14)

### 2.3 `signal_intelligence` — Signal và alert models

**Phạm vi:**
- `UnifiedAlert` — canonical model cho tất cả alert types
- `WhaleAlertCanonical` — whale alert với full metadata
- Views: `/core/v1/unified-alert/`, `/core/v1/whale-feed-aggregate/`
- Serializers mapping sang `unified-alert.contract.json` và `whale-feed-aggregate.contract.json`

### 2.4 `commercial` — Subscription và billing

**Phạm vi:**
- `Subscription` — gói đăng ký của tenant
- `QuotaRecord` — usage tracking theo tenant
- `Invoice` — billing record
- Views: `/core/v1/billing/`, `/core/v1/quota/`
- Serializers mapping sang `tenant-lifecycle.contract.json`

### 2.5 `ops_audit` — Audit và traceability

**Phạm vi:**
- `AuditEvent` — record của tất cả mutating operations
- `RequestTrace` — record của request-level tracing
- `RequestTraceMiddleware` — Django middleware sinh `X-Request-ID`
- Views: `/core/v1/audit-log/` (cursor paginated)

---

## 3. Django project structure chi tiết

### 3.1 `settings.py` tối thiểu

```python
# packages/core/backend/src/vninvest_core/settings.py

INSTALLED_APPS = [
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'rest_framework',
    'identity_access',
    'market_serving',
    'signal_intelligence',
    'commercial',
    'ops_audit',
]

DATABASES = {
    'default': dj_database_url.config(
        default=os.environ.get('CORE_DATABASE_URL', 'postgresql://vninvest:vninvest@localhost:5432/vninvest_core')
    )
}

REST_FRAMEWORK = {
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.CursorPagination',
    'PAGE_SIZE': 50,
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'identity_access.authentication.CorePATAuthentication',
        'identity_access.authentication.CoreSessionAuthentication',
    ],
    'DEFAULT_VERSIONING_CLASS': 'rest_framework.versioning.NamespaceVersioning',
}

MIDDLEWARE = [
    'ops_audit.middleware.RequestTraceMiddleware',
    ...
]
```

### 3.2 URL structure

```python
# packages/core/backend/src/vninvest_core/urls.py

urlpatterns = [
    path('core/v1/health', include('vninvest_core.views_health')),
    path('core/v1/', include('identity_access.urls')),
    path('core/v1/', include('market_serving.urls')),
    path('core/v1/', include('signal_intelligence.urls')),
    path('core/v1/', include('commercial.urls')),
    path('core/v1/', include('ops_audit.urls')),
]
```

### 3.3 `RequestTraceMiddleware`

```python
# packages/core/backend/src/ops_audit/middleware.py

import uuid

class RequestTraceMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request_id = request.META.get('HTTP_X_REQUEST_ID') or str(uuid.uuid4())
        request.META['X_REQUEST_ID'] = request_id
        response = self.get_response(request)
        response['X-Request-ID'] = request_id
        return response
```

---

## 4. Migration guard — Không move logic vội

### Quy tắc quan trọng:

1. **KHÔNG** move business logic từ `backend/portfolio/views*.py` sang packages/core ở SAAS-13
2. SAAS-13 chỉ tạo **models mới** và **API views mới** trong packages/core
3. Models cũ trong `backend/portfolio/models.py` vẫn tồn tại song song cho đến SAAS-15
4. Data sync từ legacy → core models là nhiệm vụ của SAAS-14 materializers
5. Không đánh dấu SAAS-13 xong nếu có bất kỳ import nào từ `backend/portfolio` vào `packages/core`

### Isolation test:

Sau SAAS-13, chạy kiểm tra:
```powershell
# Không được có import từ backend/portfolio vào packages/core
Select-String -Path "packages/core/**/*.py" -Pattern "from backend|import backend|from portfolio"
# Kết quả phải RỖNG
```

---

## 5. File anchors

### Tạo mới (packages/core)
- `packages/core/backend/requirements.txt`
- `packages/core/backend/manage.py`
- `packages/core/backend/src/vninvest_core/settings.py`
- `packages/core/backend/src/vninvest_core/urls.py`
- `packages/core/backend/src/vninvest_core/wsgi.py`
- `packages/core/backend/src/vninvest_core/celery.py`
- `packages/core/backend/src/identity_access/__init__.py`
- `packages/core/backend/src/identity_access/models.py`
- `packages/core/backend/src/identity_access/views.py`
- `packages/core/backend/src/identity_access/serializers.py`
- `packages/core/backend/src/identity_access/authentication.py`
- `packages/core/backend/src/identity_access/urls.py`
- `packages/core/backend/src/identity_access/migrations/0001_initial.py`
- `packages/core/backend/src/market_serving/__init__.py`
- `packages/core/backend/src/market_serving/models.py`
- `packages/core/backend/src/market_serving/views.py`
- `packages/core/backend/src/market_serving/serializers.py`
- `packages/core/backend/src/market_serving/urls.py`
- `packages/core/backend/src/signal_intelligence/__init__.py`
- `packages/core/backend/src/signal_intelligence/models.py`
- `packages/core/backend/src/signal_intelligence/views.py`
- `packages/core/backend/src/signal_intelligence/serializers.py`
- `packages/core/backend/src/signal_intelligence/urls.py`
- `packages/core/backend/src/commercial/__init__.py`
- `packages/core/backend/src/commercial/models.py`
- `packages/core/backend/src/commercial/views.py`
- `packages/core/backend/src/commercial/serializers.py`
- `packages/core/backend/src/commercial/urls.py`
- `packages/core/backend/src/ops_audit/__init__.py`
- `packages/core/backend/src/ops_audit/middleware.py`
- `packages/core/backend/src/ops_audit/models.py`
- `packages/core/backend/src/ops_audit/views.py`
- `packages/core/backend/src/ops_audit/urls.py`

### Sửa (packages/core)
- `packages/core/backend/src/vninvest_core/api_stub.py` — giữ stub nhưng thêm comment "to be replaced"
- `packages/core/docker-compose.core.yml` — update để dùng Django wsgi thay stub port

### Sửa (docker-compose)
- `docker-compose.dev.yml` — update `core-api` service dùng Django wsgi

### Thêm tests
- `packages/core/backend/tests/test_identity_access.py`
- `packages/core/backend/tests/test_market_serving.py`
- `packages/core/backend/tests/test_ops_audit.py`
- `packages/core/backend/tests/test_runtime_baseline.py` — cập nhật từ stub tests

---

## 6. Dependency management

### requirements.txt tối thiểu cho packages/core

```
Django>=4.2,<5.0
djangorestframework>=3.15
dj-database-url>=2.0
psycopg2-binary>=2.9
celery>=5.3
redis>=5.0
django-cors-headers>=4.0
```

### Không depend vào backend/portfolio:

```
# KHÔNG được import:
# from backend.portfolio.models import ...
# from backend.portfolio.services import ...
```

---

## 7. Compose update

```yaml
# docker-compose.dev.yml — core-api service (thay stub)
core-api:
  build:
    context: ./packages/core/backend
    dockerfile: Dockerfile
  environment:
    - CORE_DATABASE_URL=postgresql://vninvest:vninvest@db:5432/vninvest_core
    - DJANGO_SETTINGS_MODULE=vninvest_core.settings
    - REDIS_URL=redis://redis:6379/1
  ports:
    - "8100:8100"
  command: gunicorn vninvest_core.wsgi:application --bind 0.0.0.0:8100
  depends_on:
    - db
    - redis
```

---

## 8. Exit criteria

| # | Tiêu chí | Kiểm tra bằng |
|---|---|---|
| 1 | packages/core chạy Django dev server độc lập | `python manage.py runserver 8100` không lỗi |
| 2 | `/core/v1/health` trả 200 JSON | curl |
| 3 | `/core/v1/capability-bootstrap` trả versioned contract | curl + schema check |
| 4 | CoreTenant/CoreServiceAccount/CorePATCredential có trong identity_access/models.py | code review |
| 5 | `makemigrations --check` không có pending migrations | command |
| 6 | X-Request-ID header xuất hiện trong response | curl -v |
| 7 | Unit tests pass cho identity_access | pytest |
| 8 | Không có import từ backend/portfolio trong packages/core | grep check |
| 9 | docker-compose.dev.yml core-api service build và start | docker compose up |

---

## 9. Validation commands

```powershell
# Build và chạy thử core standalone
Push-Location packages/core/backend
..\..\..\.venv\Scripts\python.exe manage.py check
..\..\..\.venv\Scripts\python.exe manage.py test
Pop-Location

# Kiểm tra không có legacy imports
Select-String -Path "packages/core/**/*.py" -Pattern "from backend|from portfolio" -Recurse

# Test X-Request-ID propagation
curl -s -v http://localhost:8100/core/v1/health 2>&1 | Select-String "X-Request-ID"

# Kiểm tra migration state
Push-Location packages/core/backend
..\..\..\.venv\Scripts\python.exe manage.py showmigrations
Pop-Location
```

---

## 10. Evidence template

Sau khi SAAS-13 hoàn thành, tạo:
`docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_SAAS_CUTOVER_EXECUTION_EVIDENCE_20260503_SAAS13.md`

Nội dung bắt buộc:
1. Danh sách tất cả file đã tạo/sửa
2. `python manage.py check` output — 0 errors
3. `python manage.py test` output — tất cả pass
4. `curl /core/v1/health` response
5. Grep check không có legacy imports
6. Docker compose up output cho core-api service
7. Residual risk: data chưa sync (sẽ làm SAAS-14)
