# SOC Full Replacement — Code Quality Constitution
**Ngày**: 2026-05-13  
**Status**: Mandatory  
**Scope**: Tất cả code trong `service_ops/` và `frontend/src/components/soc/`  
**Owner**: Tech Lead

---

## 1. Mục tiêu

Tài liệu này định nghĩa các tiêu chuẩn code không thể compromise cho SOC feature. Mọi PR chạm `service_ops` hoặc `components/soc` PHẢI pass tất cả gates dưới đây trước khi merge.

---

## 2. Python Backend Rules

### R-PY-01: Không có except: pass

```python
# ❌ CẤM
try:
    result = fetch_config()
except:
    pass

try:
    result = fetch_config()
except Exception:
    pass

# ✅ BẮT BUỘC
try:
    result = fetch_config()
except ConfigFetchError as exc:
    logger.error("fetch_config failed: %s", exc, exc_info=True)
    raise ServiceUnavailableError("Không thể đọc config") from exc
```

### R-PY-02: Error envelope chuẩn

```python
# ❌ CẤM
return Response({"error": "bad input"}, status=400)
return Response({"message": "not found"}, status=404)

# ✅ BẮT BUỘC
return Response({
    "detail": "Giá trị timeout.read không hợp lệ",
    "code": "config_validation_failed",
    "timestamp": timezone.now().isoformat(),
    "request_id": request.META.get('HTTP_X_REQUEST_ID', ''),
    "field_errors": {"timeout.read": ["read phải trong khoảng [5.0, 300.0]"]}
}, status=status.HTTP_400_BAD_REQUEST)
```

### R-PY-03: Typed config validation trước khi save

```python
# ❌ CẤM
ServiceConfig.objects.create(service=svc, config_payload=request.data)

# ✅ BẮT BUỘC
config = VnbrokerDomainConfig.from_dict(request.data)
errors = config.validate()
if errors:
    return Response({"detail": "...", "field_errors": {...}}, status=400)
ServiceConfig.objects.create(service=svc, config_payload=asdict(config))
```

### R-PY-04: Ownership check trong mọi config apply view

```python
# ❌ CẤM — áp config mà không check ownership
class SignalsConfigApplyView(SOCBaseView):
    def post(self, request):
        ...save config...  # Không check ownership

# ✅ BẮT BUỘC
class SignalsConfigApplyView(SOCBaseView):
    def post(self, request):
        if not ServiceOwnershipMatrix.is_domain_writable('signals'):
            reason = ServiceOwnershipMatrix.get_write_block_reason('signals')
            return Response({
                "detail": reason,
                "code": "write_blocked",
                "timestamp": timezone.now().isoformat(),
                "request_id": request.META.get('HTTP_X_REQUEST_ID', ''),
            }, status=status.HTTP_403_FORBIDDEN)
```

### R-PY-05: Pagination bắt buộc trên list views

```python
# ❌ CẤM — return toàn bộ queryset
class ServiceListView(SOCBaseView):
    def get(self, request):
        services = ServiceDefinition.objects.all()
        return Response(ServiceDefinitionSerializer(services, many=True).data)

# ✅ BẮT BUỘC
class ServiceListView(SOCBaseView):
    pagination_class = StandardResultsSetPagination  # page_size=20, max=100
    def get(self, request):
        queryset = ServiceDefinition.objects.filter(is_active=True)
        page = self.paginate_queryset(queryset)
        serializer = ServiceDefinitionSerializer(page, many=True)
        return self.get_paginated_response(serializer.data)
```

### R-PY-06: select_for_update bắt buộc trong MatrixCoordinator.try_claim_cell

```python
# ❌ CẤM — không atomic
def try_claim_cell(self, symbol_group_id, provider, worker_id):
    cell = ScrapeMatrixCell.objects.get(...)
    if cell.status == 'pending':
        cell.status = 'claimed'
        cell.save()
        return True

# ✅ BẮT BUỘC
def try_claim_cell(self, symbol_group_id, provider, worker_id):
    with transaction.atomic():
        cell = ScrapeMatrixCell.objects.select_for_update().get(
            matrix__cycle_id=self.cycle_id,
            symbol_group_id=symbol_group_id,
            provider=provider,
            status='pending',
        )
        ...
```

### R-PY-07: Log có context trên mọi error path

```python
# ❌ CẤM
logger.error("Health check failed")

# ✅ BẮT BUỘC
logger.error(
    "Health check failed for service=%s: %s",
    service.service_key, exc,
    exc_info=True,
    extra={"service_key": service.service_key, "domain": service.domain}
)
```

### R-PY-08: ConfigChangeAudit bắt buộc sau mỗi config apply

```python
# Mỗi lần apply config phải tạo audit record
ConfigChangeAudit.objects.create(
    service=service,
    action='apply',
    actor=request.user.username,
    actor_ip=get_client_ip(request),
    before_snapshot=current_config,
    after_snapshot=new_config,
    change_summary=compute_diff_text(current_config, new_config),
    request_id=request.META.get('HTTP_X_REQUEST_ID', ''),
)
```

### R-PY-09: VnBroker SSOT — không direct import

```python
# ❌ CẤM
from vnbroker.explorer.vci.quote import Quote
from vnbroker import Vnbroker

# ✅ BẮT BUỘC
from market_data.vnbroker_adapter import fetch_realtime_price, fetch_daily_history
```

### R-PY-10: Request body không được log

```python
# ❌ CẤM
logger.info("Config apply request body: %s", request.data)

# ✅ OK — chỉ log method + path + service_key
logger.info("Config apply: method=%s path=%s service=%s", request.method, request.path, service_key)
```

---

## 3. Frontend / React Rules

### R-FE-01: Tailwind dark theme — không Ant Design

```jsx
// ❌ CẤM
import { Card, Badge, Button } from 'antd'
import { Box, Chip } from '@mui/material'

// ✅ BẮT BUỘC — pure Tailwind
<div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
  <span className="text-emerald-400 text-xs font-medium px-2 py-0.5 rounded bg-emerald-950/30">
    Hoạt động tốt
  </span>
</div>
```

### R-FE-02: Tất cả text mới qua i18n

```jsx
// ❌ CẤM
<span>Trung tâm Vận hành Dịch vụ</span>
<span>Không thể áp dụng</span>

// ✅ BẮT BUỘC
const { t } = useI18n()
<span>{t('soc.title')}</span>
<span>{t('soc.ownership.writeBlocked', { writer })}</span>
```

### R-FE-03: Write guard derive từ ownership API

```jsx
// ❌ CẤM — hardcode
const canApply = domain !== 'signals'

// ✅ BẮT BUỘC — derive từ API response
const { data: ownership } = useQuery(['signals-ownership'], getSignalsOwnership)
const canApply = ownership?.can_apply ?? false
const writeBlockReason = ownership?.write_block_reason ?? null
```

### R-FE-04: Không direct API call — phải qua socApi.js

```jsx
// ❌ CẤM
const response = await fetch('/api/soc/vnbroker/config/')
const response = await axios.get('/api/soc/signals/ownership/')

// ✅ BẮT BUỘC
import { getVnbrokerConfig, getSignalsOwnership } from '@/api/socApi'
const data = await getVnbrokerConfig()
```

### R-FE-05: Loading và error state bắt buộc

```jsx
// ❌ CẤM — không handle loading
const { data } = useQuery(['soc-overview'], getSOCOverview)
return <ServiceHealthCard {...data} />  // crash khi data=undefined

// ✅ BẮT BUỘC
const { data, isLoading, error } = useQuery(['soc-overview'], getSOCOverview)
if (isLoading) return <div className="animate-pulse bg-slate-800 h-32 rounded-lg" />
if (error) return <ErrorBanner message={error.message} />
return <ServiceHealthCard {...data} />
```

### R-FE-06: Status colors theo chuẩn thiết kế

```jsx
// Mapping bắt buộc (theo TECH_SPEC section 7.1)
const STATUS_COLORS = {
  healthy:     'text-emerald-400 border-emerald-700 bg-emerald-950/30',
  degraded:    'text-amber-400   border-amber-700   bg-amber-950/30',
  unhealthy:   'text-rose-400    border-rose-700    bg-rose-950/30',
  unknown:     'text-slate-400   border-slate-700   bg-slate-800',
  maintenance: 'text-sky-400     border-sky-700     bg-sky-950/30',
}

// Matrix cell colors (theo TECH_SPEC section 7.5)
const CELL_COLORS = {
  pending:  'bg-slate-700',
  claimed:  'bg-sky-700',
  working:  'bg-amber-700',
  done:     'bg-emerald-700',
  failed:   'bg-rose-700',
  skipped:  'bg-slate-600',
}
```

### R-FE-07: PropTypes bắt buộc cho mọi SOC component

```jsx
// ❌ CẤM — không có PropTypes
function ServiceHealthCard({ serviceKey, status }) { ... }

// ✅ BẮT BUỘC
import PropTypes from 'prop-types'
ServiceHealthCard.propTypes = {
  serviceKey: PropTypes.string.isRequired,
  status: PropTypes.oneOf(['healthy', 'degraded', 'unhealthy', 'unknown', 'maintenance']).isRequired,
  ...
}
```

---

## 4. Test Quality Rules

### R-TEST-01: Không test presence only

```python
# ❌ CẤM — coverage theater
def test_overview_renders():
    response = self.client.get('/api/soc/overview/')
    self.assertEqual(response.status_code, 200)
    # Không assert gì thêm → không có giá trị

# ✅ BẮT BUỘC
def test_overview_structure():
    response = self.client.get('/api/soc/overview/', **auth_headers)
    self.assertEqual(response.status_code, 200)
    data = response.json()
    self.assertIn('summary', data)
    self.assertIn('by_domain', data)
    self.assertIn('services', data)
    self.assertIn('total', data['summary'])
    self.assertIn('healthy', data['summary'])
```

### R-TEST-02: Phải test 401 cho mọi private endpoint

```python
def test_overview_unauthenticated(self):
    response = self.client.get('/api/soc/overview/')  # No auth
    self.assertEqual(response.status_code, 401)

def test_config_apply_unauthenticated(self):
    response = self.client.post('/api/soc/vnbroker/config/apply/', {...})
    self.assertEqual(response.status_code, 401)
```

### R-TEST-03: Validation error phải assert field_errors

```python
def test_vnbroker_config_invalid_read_timeout(self):
    response = self.client.post(
        '/api/soc/vnbroker/config/apply/',
        data={'timeout': {'read': 1.0}},  # Invalid: should be [5.0, 300.0]
        **auth_headers
    )
    self.assertEqual(response.status_code, 400)
    data = response.json()
    self.assertIn('field_errors', data)
    self.assertIn('timeout.read', data['field_errors'])
```

### R-TEST-04: Matrix concurrency test bắt buộc

```python
from concurrent.futures import ThreadPoolExecutor

def test_matrix_atomic_claim_no_race_condition(self):
    """2 workers cùng claim 1 cell → chỉ 1 thành công."""
    coordinator = MatrixCoordinator('test_cycle', ['vci', 'kbs'])
    coordinator.create_cycle(['G1'])
    
    results = []
    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [
            executor.submit(coordinator.try_claim_cell, 'G1', 'vci', f'worker_{i}')
            for i in range(2)
        ]
        results = [f.result() for f in futures]
    
    # Chỉ 1 trong 2 được claim thành công
    self.assertEqual(results.count(True), 1)
    self.assertEqual(results.count(False), 1)
```

---

## 5. OpenAPI Compliance

Tuân theo đầy đủ `docs/CORE_API_OPENAPI_FUNCTION_DESIGN_CONSTITUTION_20260513.md`:

- **R1**: Mọi endpoint có request schema rõ ràng
- **R2**: Mọi endpoint có response schema với examples
- **R3**: HTTP status semantics đúng (200/201/400/401/403/404/409/429/500)
- **R4**: Error envelope thống nhất `{detail, code, timestamp, request_id, field_errors?}`
- **R5**: Cấm `except: pass` — đã có R-PY-01
- **R6**: Auth + tenant isolation — tất cả SOC endpoints có `IsAuthenticated + IsAdminUser`
- **R7**: Rate limit — config apply endpoints giới hạn 10 req/min per user
- **R8**: Pagination — list endpoints default 20, max 100

---

## 6. PR Checklist Summary

Trước mỗi PR:

```
Backend:
[ ] flake8 service_ops/ → 0 violations
[ ] grep -r "except:" service_ops/ → không kết quả
[ ] pytest tests/test_soc_*.py → 0 failures
[ ] python manage.py check → 0 errors

Frontend:
[ ] npm run build → 0 errors
[ ] grep -r "from 'antd'" src/components/soc/ → không kết quả
[ ] Tất cả text mới có i18n key
[ ] PropTypes đầy đủ

Governance:
[ ] CODE_CHANGE_AUDIT_LEDGER.md có entry mới
[ ] TASKBOARD_SOC_FULL_REPLACEMENT_20260513.md updated
```
