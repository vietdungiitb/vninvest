# SAAS-14 — Data-Plane Serving Models Materialization

**Ngày:** 2026-05-03  
**Trạng thái:** Planned — bắt đầu sau khi SAAS-13 completed  
**Mục tiêu:** Materialize `SymbolSnapshot`, `SessionFacts`, `UnifiedAlert` trong `packages/core` bằng Celery jobs; cung cấp facts-first serving path không raw-scan legacy tables; thêm cursor pagination cho tất cả list APIs; migrate packages/web sang coreApiAdapter.

---

## 1. Bối cảnh

### 1.1 Vấn đề hiện tại (sau SAAS-13)

Sau SAAS-13, `packages/core` có Django models nhưng các models đó **rỗng** — chưa có data. Tất cả data vẫn nằm trong:
- `backend/portfolio/services_whale_analytics_snapshot.py` — whale analytics
- `backend/portfolio/market_data_service.py` — market data
- Raw tables trong `backend/portfolio/models.py` — trades, orders, ticks

Các packages clients (web, mobile) hiện tại vẫn gọi các endpoints này. Khi legacy decommission, data sẽ mất.

### 1.2 Mục tiêu trạng thái sau SAAS-14

1. `SymbolSnapshot` trong packages/core được populate tự động mỗi 1 phút bởi Celery task
2. `SessionFacts` trong packages/core được recompute mỗi phiên giao dịch
3. `UnifiedAlert` trong packages/core được populate từ whale alerts + signal alerts
4. `packages/web` có `coreApiAdapter.js` gọi `/core/v1` thay vì legacy paths
5. Tất cả list APIs có cursor pagination
6. Raw scan từ legacy tables không còn là primary serving path

---

## 2. Materializer job architecture

### 2.1 Celery task hierarchy

```
vninvest_core/celery.py
├── market_serving.materializers
│   ├── materialize_symbol_snapshot      ← mỗi 1 phút per symbol
│   ├── materialize_session_facts        ← mỗi phiên
│   └── backfill_symbol_snapshots        ← one-time backfill
└── signal_intelligence.materializers
    ├── materialize_unified_alerts       ← mỗi 5 phút
    └── materialize_whale_feed_aggregate ← mỗi 5 phút per symbol
```

### 2.2 Beat schedule

```python
# vninvest_core/celery.py

app.conf.beat_schedule = {
    'materialize-symbol-snapshots': {
        'task': 'market_serving.materializers.materialize_symbol_snapshot',
        'schedule': 60.0,  # mỗi 1 phút
    },
    'materialize-session-facts': {
        'task': 'market_serving.materializers.materialize_session_facts',
        'schedule': crontab(minute='*/5'),  # mỗi 5 phút
    },
    'materialize-unified-alerts': {
        'task': 'signal_intelligence.materializers.materialize_unified_alerts',
        'schedule': 300.0,  # mỗi 5 phút
    },
    'materialize-whale-feed-aggregate': {
        'task': 'signal_intelligence.materializers.materialize_whale_feed_aggregate',
        'schedule': 300.0,
    },
}
```

---

## 3. Data sourcing strategy

### 3.1 Trong khoảng cutover (legacy còn sống)

Materializers sẽ đọc từ legacy database qua separate database connection (read-only):

```python
# settings.py — thêm legacy DB connection
DATABASES = {
    'default': ...,  # packages/core DB
    'legacy_readonly': dj_database_url.config(
        env='LEGACY_DATABASE_URL',
        default=os.environ.get('LEGACY_DATABASE_URL', ''),
    ),
}
```

Materializer đọc từ `legacy_readonly`, write vào `default`:

```python
# market_serving/materializers.py

@app.task
def materialize_symbol_snapshot():
    """
    Đọc giá và volume từ legacy DB (read-only), 
    write vào SymbolSnapshot trong core DB.
    """
    from market_serving.models import SymbolSnapshot
    
    # Đọc từ legacy DB
    with connections['legacy_readonly'].cursor() as cursor:
        cursor.execute("""
            SELECT symbol, price, volume, price_change, session_date
            FROM portfolio_marketsnapshot
            WHERE fetched_at > NOW() - INTERVAL '5 minutes'
        """)
        rows = cursor.fetchall()
    
    # Write vào core DB
    for row in rows:
        SymbolSnapshot.objects.update_or_create(
            symbol=row[0],
            defaults={
                'price': row[1],
                'volume': row[2],
                'price_change': row[3],
                'session_date': row[4],
                'fetched_at': now(),
                'stale': False,
                'source': 'legacy_sync',
            }
        )
```

### 3.2 Sau khi legacy decommission (SAAS-15)

Materializers sẽ đọc trực tiếp từ vnstock feed thay vì legacy DB:

```python
@app.task
def materialize_symbol_snapshot():
    """
    Sau SAAS-15: đọc trực tiếp từ vnstock/realtime feed.
    """
    from vninvest_core.vnstock_client import fetch_latest_prices
    # ...
```

Đây là lý do cần materializer pattern — swap source mà không đổi contract.

---

## 4. Cursor pagination implementation

### 4.1 Tạo shared cursor pagination class

```python
# vninvest_core/pagination.py

from rest_framework.pagination import CursorPagination

class CoreCursorPagination(CursorPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200
    ordering = '-triggered_at'  # override per view nếu cần

class AlertCursorPagination(CoreCursorPagination):
    ordering = '-triggered_at'

class AuditCursorPagination(CoreCursorPagination):
    ordering = '-created_at'
    page_size = 100
```

### 4.2 Apply vào các views cần pagination

- `signal_intelligence/views.py` — `UnifiedAlertListView`
- `ops_audit/views.py` — `AuditEventListView`
- `market_serving/views.py` — `SymbolSnapshotListView` (if needed)

---

## 5. packages/web coreApiAdapter

### 5.1 Tạo adapter file

```javascript
// packages/web/src/adapters/coreApiAdapter.js

const CORE_API_BASE = window.CORE_API_BASE_URL 
  || process.env.REACT_APP_CORE_API_BASE_URL 
  || '/core/v1';

async function coreGet(path, options = {}) {
  const requestId = crypto.randomUUID();
  const response = await fetch(`${CORE_API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': requestId,
      ...options.headers,
    },
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(`Core API error: ${response.status} ${path}`);
  }
  return response.json();
}

export const coreApiAdapter = {
  getSymbolSnapshot: (symbol) => coreGet(`/symbol-snapshot/${symbol}/`),
  getSessionFacts: (symbol, date) => coreGet(`/session-facts/${symbol}/?date=${date}`),
  getUnifiedAlerts: (params) => coreGet(`/unified-alert/?${new URLSearchParams(params)}`),
  getWhaleFeedAggregate: (symbol) => coreGet(`/whale-feed-aggregate/${symbol}/`),
  getTenantLifecycle: () => coreGet('/tenant/lifecycle/'),
};
```

### 5.2 Shell pages dùng adapter

Từng shell page trong packages/web khi cần data, import từ `coreApiAdapter` thay vì legacy client:

```javascript
// packages/web/src/pages/workspace/ShellDashboardPage.js
import { coreApiAdapter } from '../../adapters/coreApiAdapter';
// Không import từ frontend/src/api/client
```

---

## 6. Freshness và stale semantics

### 6.1 Freshness threshold config

```python
# market_serving/models.py

class SymbolSnapshot(models.Model):
    FRESHNESS_THRESHOLD_SECONDS = 120  # 2 phút

    symbol = models.CharField(max_length=20, db_index=True)
    price = models.DecimalField(max_digits=15, decimal_places=2)
    ...
    fetched_at = models.DateTimeField()
    stale = models.BooleanField(default=False)
    source = models.CharField(max_length=50)  # 'live' | 'cache' | 'degraded'

    @property
    def is_stale(self):
        threshold = timedelta(seconds=self.FRESHNESS_THRESHOLD_SECONDS)
        return (now() - self.fetched_at) > threshold
```

### 6.2 Stale detection trong views

```python
# market_serving/views.py

class SymbolSnapshotView(RetrieveAPIView):
    def retrieve(self, request, symbol):
        snapshot = get_object_or_404(SymbolSnapshot, symbol=symbol)
        serializer = SymbolSnapshotSerializer(snapshot)
        data = serializer.data
        data['stale'] = snapshot.is_stale  # override stale field dynamically
        return Response(data)
```

---

## 7. File anchors

### Tạo mới (packages/core)
- `packages/core/backend/src/market_serving/materializers.py`
- `packages/core/backend/src/signal_intelligence/materializers.py`
- `packages/core/backend/src/vninvest_core/pagination.py`
- `packages/core/backend/src/vninvest_core/celery_beat_schedule.py`

### Sửa (packages/core)
- `packages/core/backend/src/vninvest_core/settings.py` — thêm `legacy_readonly` DB, beat schedule
- `packages/core/backend/src/vninvest_core/celery.py` — register beat schedule
- `packages/core/backend/src/market_serving/views.py` — apply cursor pagination
- `packages/core/backend/src/signal_intelligence/views.py` — apply cursor pagination
- `packages/core/backend/src/ops_audit/views.py` — apply cursor pagination

### Tạo mới (packages/web)
- `packages/web/src/adapters/coreApiAdapter.js`
- `packages/web/src/adapters/coreApiAdapter.test.js`

### Sửa (docker-compose)
- `docker-compose.dev.yml` — thêm `LEGACY_DATABASE_URL` env cho core-api

---

## 8. Exit criteria

| # | Tiêu chí | Kiểm tra bằng |
|---|---|---|
| 1 | Celery beat chạy materialize_symbol_snapshot mỗi 60s | Celery beat log |
| 2 | SymbolSnapshot có data trong core DB | Django shell query |
| 3 | `/core/v1/symbol-snapshot/{symbol}/` trả data fresh | curl + timestamp check |
| 4 | `/core/v1/unified-alert/` có cursor pagination | curl + `next` link trong response |
| 5 | stale=true khi data cũ hơn 2 phút | mock test |
| 6 | packages/web có `coreApiAdapter.js` | file check |
| 7 | Không có shell page nào import trực tiếp từ legacy client | grep check |
| 8 | `coreApiAdapter.test.js` pass | jest |
| 9 | Materializer không fail nếu legacy DB unreachable (degraded mode) | unit test |

---

## 9. Degraded mode handling

Materializer phải xử lý gracefully khi legacy DB không reach được:

```python
@app.task(bind=True, max_retries=3)
def materialize_symbol_snapshot(self):
    try:
        # ... read from legacy, write to core
    except OperationalError as e:
        # Đánh dấu snapshots hiện có là stale thay vì crash
        SymbolSnapshot.objects.update(stale=True)
        raise self.retry(exc=e, countdown=30)
```

---

## 10. Validation commands

```powershell
# Kiểm tra materializer jobs đã được register
Push-Location packages/core/backend
..\..\..\.venv\Scripts\python.exe -c "from vninvest_core.celery import app; print(list(app.conf.beat_schedule.keys()))"
Pop-Location

# Kiểm tra SymbolSnapshot có data
Push-Location packages/core/backend
..\..\..\.venv\Scripts\python.exe manage.py shell -c "from market_serving.models import SymbolSnapshot; print(SymbolSnapshot.objects.count())"
Pop-Location

# Test cursor pagination
curl "http://localhost:8100/core/v1/unified-alert/" | python -m json.tool | Select-String "next|previous|cursor"

# Kiểm tra packages/web không gọi legacy paths
Select-String -Path "packages/web/src/**/*.js" -Pattern "/portfolio/|/stock-management/|/whale-analytics/" -Recurse
```

---

## 11. Evidence template

Sau khi SAAS-14 hoàn thành, tạo:
`docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_SAAS_CUTOVER_EXECUTION_EVIDENCE_20260503_SAAS14.md`

Nội dung bắt buộc:
1. Danh sách file đã tạo/sửa
2. Celery beat log snippet — proof materializers đang chạy
3. Django shell query — SymbolSnapshot count > 0
4. curl responses cho `/core/v1/symbol-snapshot/{symbol}/` và `/core/v1/unified-alert/`
5. grep check packages/web không gọi legacy paths
6. Residual risk: legacy còn sống, chưa decommission (sẽ làm SAAS-15)
