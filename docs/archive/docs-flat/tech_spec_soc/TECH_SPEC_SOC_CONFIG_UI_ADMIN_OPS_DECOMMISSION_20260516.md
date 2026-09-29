# TECH SPEC — SOC Config UI Upgrade & Admin-Ops Decommission

**Ngày tạo**: 2026-05-16  
**Scope**: SOC UI 5 slices + legacy admin-ops decommission  
**Level**: B (UI upgrade + API extension + route cleanup)  
**Status**: APPROVED FOR IMPLEMENTATION

---

## 1. Nguyên tắc kỹ thuật bất biến

1. **SOC là single operator surface**: Sau D3, `/operations-center` là **điểm duy nhất** cho operator config. Không có parallel admin surface nào tồn tại.
2. **Backend-first cho backend gaps**: Screener rule DELETE/PUT endpoints phải được implement và test trước khi viết UI (S5-BE trước S5-FE).
3. **Contract correctness**: `socApi.manualScan()` phải gửi `{symbols: [...]}` không phải `{rule_ids: [...]}` — sửa ngay trong S5, không defer.
4. **Decommission với 410 GONE**: Khi xóa admin-ops routes, trả `{"error": "gone", "migrate_to": "/api/soc/..."}` với HTTP 410 — không 404 im lặng.
5. **No regression**: Mỗi slice phải pass `npm run build` và smoke test trước khi sang slice kế tiếp.
6. **i18n mandatory**: Mọi text mới phải có key trong `frontend/src/i18n/vi.js` và `en.js`.
7. **ConfigPreviewModal reuse**: Các panel có write capability phải dùng `ConfigPreviewModal` pattern (preview diff → confirm → apply), không submit trực tiếp.
8. **OpenAPI compliance**: Mọi endpoint backend mới phải có `@extend_schema` decorator (drf-spectacular).

---

## 2. Slice S1 — PrefetchPanel: Runtime Config Form

### 2.1 Component: `PrefetchPanel.jsx`

**Xóa**:
- Raw JSON `<pre>` dump toàn bộ config

**Thêm/thay**:

```
Section A: Cài đặt Runtime (SettingsCard)
  Fields (type: number):
  - batch_size (default: 20, min: 1, max: 200)
  - symbol_limit (default: 40)
  - max_retries (default: 4, min: 0, max: 10)
  - retry_base_delay_seconds (default: 15)
  - retry_max_delay_seconds (default: 120)
  - rate_limit_cooldown_seconds (default: 30)
  - circuit_breaker_window_seconds (default: 300)
  - circuit_breaker_failure_threshold (default: 3)
  - circuit_breaker_cooldown_seconds (default: 1800)
  - cache_ttl_seconds (default: 3600)
  - close_history_days (default: 7)
  CTA: [Xem trước & Lưu] → ConfigPreviewModal → socApi.applyPrefetchConfig()

Section B: Universe Groups (UniverseGroupsCard)
  - Multiselect list (gọi socApi.getPrefetchUniverseGroups() khi mount)
  - Hiển thị group_id + label
  - Chọn → include trong payload save

Section C: Lịch cập nhật (TimePolicyCard)
  Thay readonly cards → editable inputs:
  - pre_open_interval_seconds (readonly → number input)
  - market_open_interval_seconds
  - lunch_break_interval_seconds
  - pre_close_interval_seconds
  - post_close_interval_seconds
  - offhours_interval_seconds
  + Toggles: enabled per profile (nếu API trả về)

Section D: Trigger thủ công (WarmNowCard)
  - [Warm Now (Async)] → POST /api/soc/prefetch/warm-now/?mode=async
  - [Warm Now (Sync)]  → POST /api/soc/prefetch/warm-now/?mode=sync
  - Hiển thị task_id hoặc status sau trigger

Section E: Cache Status + Purge (giữ nguyên, không thay đổi)
```

### 2.2 API calls

| Action | Function | Endpoint |
|--------|----------|----------|
| Load config | `socApi.getPrefetchConfig()` | GET /api/soc/prefetch/config/ |
| Save config | `socApi.applyPrefetchConfig(payload)` | POST /api/soc/prefetch/config/ |
| Load groups | `socApi.getPrefetchUniverseGroups()` | GET /api/soc/prefetch/universe-groups/ |
| Warm Now | `socApi.warmPrefetchNow(mode)` | POST /api/soc/prefetch/warm-now/ |

### 2.3 State management

```jsx
const [config, setConfig] = useState(null);        // loaded từ API
const [formValues, setFormValues] = useState({});   // form state
const [groups, setGroups] = useState([]);
const [selectedGroups, setSelectedGroups] = useState([]);
const [saving, setSaving] = useState(false);
const [warmNowResult, setWarmNowResult] = useState(null);
```

### 2.4 Payload shape khi save

```json
{
  "config_payload": {
    "batch_size": 20,
    "symbol_limit": 40,
    "max_retries": 4,
    "retry_base_delay_seconds": 15,
    "retry_max_delay_seconds": 120,
    "rate_limit_cooldown_seconds": 30,
    "circuit_breaker_window_seconds": 300,
    "circuit_breaker_failure_threshold": 3,
    "circuit_breaker_cooldown_seconds": 1800,
    "cache_ttl_seconds": 3600,
    "close_history_days": 7,
    "universe_group_ids": [1, 2, 3],
    "profiles": {
      "pre_open": { "interval_seconds": 120 },
      "market_open": { "interval_seconds": 30 },
      "lunch_break": { "interval_seconds": 300 },
      "pre_close": { "interval_seconds": 30 },
      "post_close": { "interval_seconds": 600 },
      "offhours": { "interval_seconds": 3600 }
    }
  },
  "change_reason": "operator_update_from_soc"
}
```

---

## 3. Slice S2 — VnbrokerPanel: Structured Form + Benchmark

### 3.1 Component: `VnbrokerPanel.jsx`

**Thay raw JSON textarea** bằng:

```
Section A: Cấu hình Provider (ProviderConfigCard)
  - data_source: Select (VCI | KBS | DNSE | TCBS | SSI)
  - max_workers: number input (default: 12, min: 1, max: 50)
  - request_delay_ms: number input (default: 200)
  - max_retries: number input (default: 1)
  - batch_size: number input (default: 50)
  - extra.connect_timeout_seconds: number (default: 10)
  - extra.read_timeout_seconds: number (default: 30)
  - extra.backoff_factor: float (default: 0.35)
  CTA: [Xem trước & Lưu] → ConfigPreviewModal → socApi.applyVnbrokerConfig()
  CTA: [Reset về mặc định] → confirm dialog → resetAdminVnbrokerConfig() (bridge)

Section B: Benchmark Price Board (BenchmarkCard)
  - Provider selector: [KBS] [VCI] [DNSE] [Tất cả]
  - [Chạy Benchmark] → runAdminVnbrokerBenchmark({provider})
  - Kết quả bảng: Provider | Latency | Success Rate | Rate Limit Hits | Timestamp
  - Loading spinner khi chạy, auto-show khi có kết quả
```

**Giữ nguyên**: Health status section + Metrics section hiện có.

### 3.2 Note về DNSE credentials

DNSE dùng env vars `SOC_MATRIX_DNSE_API_ID` / `SOC_MATRIX_DNSE_API_KEY` — **không** lưu trong DB.  
UI không cần field nhập key — chỉ hiển thị trạng thái:
```
DNSE API ID: ✓ Đã cấu hình (from env)  /  ✗ Chưa cấu hình
DNSE API Key: ✓ Đã cấu hình (from env)  /  ✗ Chưa cấu hình
```
(Backend endpoint `GET /api/soc/vnbroker/providers/` đã trả `env_configured: true/false`)

---

## 4. Slice S3 — DataOps: Comprehensive Backfill Center

### 4.1 Component: `DataOpsPanel.jsx` — thêm section mới

**Thêm** collapsible section `BackfillCenterSection` phía trên Coverage section:

```
┌─ Trung tâm Backfill Dữ liệu ─────────────────────────── [Thu gọn ▲] ┐
│                                                                       │
│  Loại dữ liệu:                                                        │
│  ☑ OHLCV ngày (Daily Prices)   ☑ Nến intraday (Intraday Bars)       │
│  ☐ Intraday Tick (Side label)  ☐ Session Facts                       │
│  ☐ Whale Events (re-detect)    ☐ CVD/Strengths (re-compute)          │
│  ☐ Dark Money Flow (re-compute)                                       │
│                                                                       │
│  Nhóm symbol:                                                         │
│  ● VN30  ○ VN100  ○ Tất cả niêm yết  ○ Tùy chỉnh                    │
│  [textarea khi chọn Tùy chỉnh]                                       │
│                                                                       │
│  Khoảng thời gian:   [2026-01-01] → [2026-05-16]                     │
│  Chế độ:             ● missing_only  ○ force_refresh                  │
│  Thực thi:           ● async         ○ sync                           │
│                                                                       │
│  [Xem trước (Dry-run)] [Chạy Backfill ▶]                             │
│                                                                       │
│  ── Kết quả gần nhất ───────────────────────────────────────────────  │
│  task_id: xxx-yyy | status: queued | symbols: 30 | dispatched: 14:32 │
└───────────────────────────────────────────────────────────────────────┘
```

### 4.2 Mapping dataset → API endpoint

| Dataset UI | API endpoint | Task |
|-----------|-------------|------|
| Daily Prices | `socApi.runDataOpsPlanner({datasets:['daily_prices']})` | `backfill_daily_prices` |
| Intraday Bars | `socApi.runDataOpsPlanner({datasets:['intraday_bars']})` | intraday bars |
| Intraday Tick | `adminIntradaySideBackfillApply(payload)` (client.js bridge) | `run_intraday_side_backfill_apply` |
| Session Facts | `socApi.runDataOpsPlanner({datasets:['session_facts']})` | session facts |
| Whale Events | `socApi.runDataOpsPlanner({datasets:['whale_events']})` | whale re-detect |
| CVD/Strengths | `socApi.runDataOpsPlanner({datasets:['order_flow']})` | order flow |
| Dark Money | `socApi.runDataOpsPlanner({datasets:['dark_flow']})` | dark flow |

**Lưu ý**: Whale/CVD/dark-flow datasets có thể cần verify backend hỗ trợ dataset key tương ứng — nếu chưa, hiển thị badge "Sắp ra mắt" và disable checkbox.

### 4.3 Payload mẫu

```json
{
  "symbols": ["VNM", "VIC"],
  "datasets": ["daily_prices", "session_facts"],
  "mode": "missing_only",
  "force_refresh": false,
  "execution_mode": "async",
  "reason": "operator_backfill_soc",
  "date_from": "2026-01-01",
  "date_to": "2026-05-16"
}
```

---

## 5. Slice S4 — SOCPage: Thêm Tabs

### 5.1 `SOCDomainTabs.jsx`

Thêm 2 tab mới:
```javascript
{ key: 'vnbroker',    label: t('soc.tabs.vnbroker'),     icon: '⚡' },
{ key: 'runtime-kpi', label: t('soc.tabs.runtime_kpi'),  icon: '📊' },
```

### 5.2 `SOCPage.jsx`

Thêm vào `VALID_DOMAINS`:
```javascript
const VALID_DOMAINS = ['overview', 'signals', 'dataops', 'prefetch', 'screener', 'matrix', 'vnbroker', 'runtime-kpi'];
```

Thêm vào render switch:
```jsx
case 'vnbroker':    return <VnbrokerPanel t={t} />;
case 'runtime-kpi': return <RuntimeKPIPanel />;
```

### 5.3 i18n keys cần thêm

```javascript
// vi.js
'soc.tabs.vnbroker': 'Cấu hình VnBroker',
'soc.tabs.runtime_kpi': 'Runtime KPI',
```

---

## 6. Slice S5 — ScreenerPanel: Config Form + Rule CRUD

### 6.1 Backend (S5-BE) — phải xong TRƯỚC frontend

**File**: `packages/core/backend/src/service_ops/views/screener.py`

Thêm 2 views:

```python
class ScreenerRuleUpdateView(SOCBaseView):
    """PUT /api/soc/screener/rules/<rule_id>/"""
    def put(self, request, rule_id):
        # Tìm rule trong config hiện tại theo id
        # Validate với ScreenerRuleCreateRequestSerializer
        # Patch rule, save ServiceConfig mới
        # Return updated rule

class ScreenerRuleDeleteView(SOCBaseView):
    """DELETE /api/soc/screener/rules/<rule_id>/delete/"""
    def delete(self, request, rule_id):
        # Tìm rule trong config theo id
        # Return 404 nếu không tìm thấy
        # Remove khỏi rules list, save ServiceConfig mới
        # Return 204 No Content
```

**File**: `packages/core/backend/src/service_ops/urls.py`

```python
path('screener/rules/<str:rule_id>/', ScreenerRuleUpdateView.as_view(), name='screener-rule-update'),
path('screener/rules/<str:rule_id>/delete/', ScreenerRuleDeleteView.as_view(), name='screener-rule-delete'),
```

### 6.2 Frontend — `socApi.js` contract fix

**Sửa**:
```javascript
// CŨ — sai contract
manualScan: async (ruleIds = []) => {
  body: JSON.stringify({ rule_ids: ruleIds })
}

// MỚI — đúng theo ScreenerManualScanRequestSerializer
manualScan: async (symbols = []) => {
  body: JSON.stringify({ symbols })
}
```

**Thêm**:
```javascript
createScreenerRule: async (payload) =>
  // POST /api/soc/screener/rules/

updateScreenerRule: async (ruleId, payload) =>
  // PUT /api/soc/screener/rules/{ruleId}/

deleteScreenerRule: async (ruleId) =>
  // DELETE /api/soc/screener/rules/{ruleId}/delete/
```

### 6.3 Component: `ScreenerPanel.jsx` — refactor

4 sections (xem IMPLEMENTATION_PLAN section 5.2 cho layout chi tiết):
- **A**: Cấu hình lịch quét — form editable với `ScreenerDomainConfig` fields
- **B**: Quét thủ công — button + symbol filter + result display
- **C**: Quản lý luật — form CRUD + paginated table
- **D**: Kết quả & Cảnh báo — kết quả quét + paginated alert history

**Validation**: Rule conditions JSON phải pass `JSON.parse()`. Nếu fail → inline error, không submit.

---

## 7. Phase D1 — Parity Verification Gate

**Không decommission gì** trước khi tất cả pass:

```
□ S1 PrefetchPanel: form load đúng + save + warm-now hoạt động
□ S2 VnbrokerPanel: structured form + benchmark gọi thành công
□ S3 DataOpsPanel: dry-run + run backfill ít nhất 1 dataset
□ S4 SOCPage: 2 tabs mới routing đúng
□ S5 ScreenerPanel: CRUD rules đầy đủ + config save + manual scan đúng
□ Frontend build pass clean
□ ./start_dev.ps1 stack healthy
```

---

## 8. Phase D2 — Backend Admin-Ops Decommission

### 8.1 Files thay đổi

**`backend/config/urls.py`** — xóa/comment tất cả `api/admin-ops/*` routes:

Danh sách endpoints phải xóa (35 routes):
- `/api/admin-ops/stats/`
- `/api/admin-ops/runtime-kpi/` và sub-paths
- `/api/admin-ops/system-ai-settings/` và sub-paths
- `/api/admin-ops/vnbroker-config/` và sub-paths
- `/api/admin-ops/prefetch/` và sub-paths
- `/api/admin-ops/signals/` và sub-paths
- `/api/admin-ops/intraday-side-backfill/` và sub-paths
- `/api/admin-ops/universe/` và sub-paths
- `/api/admin-ops/backfill/` và sub-paths

**Thay bằng** view trả 410:
```python
from django.http import JsonResponse

def admin_ops_gone(request, **kwargs):
    return JsonResponse(
        {"error": "gone", "message": "Endpoint này đã bị ngừng. Dùng /api/soc/ thay thế."},
        status=410,
    )

# Trong urlpatterns:
path('api/admin-ops/', admin_ops_gone),
path('api/admin-ops/<path:remaining>/', admin_ops_gone),
```

**Giữ nguyên** (không xóa):
- View functions trong `portfolio/views.py` — chỉ xóa URL wiring
- `vninvest_core/contracts/admin_ops/views.py` (để audit trail, có thể xóa sau)

### 8.2 Test sau D2

```powershell
curl -s http://localhost/api/admin-ops/stats/ -o $null -w "%{http_code}"
# Expected: 410

curl -s http://localhost/api/soc/overview/ -o $null -w "%{http_code}"
# Expected: 200
```

---

## 9. Phase D3 — Frontend Admin-Ops Cleanup

### 9.1 `frontend/src/api/client.js` — xóa bridge functions

Functions cần xóa (hoặc comment + deprecated warning):
- `getAdminOpsStats()`
- `getAdminRuntimeKPI()` và sub-variants
- `getAdminSystemAiSettings()`, `updateAdminSystemAiSettings()`
- `getAdminPrefetchRuntimeSettings()`, `updateAdminPrefetchRuntimeSettings()`
- `getAdminVnbrokerConfigCurrent()`, `updateAdminVnbrokerConfig()`, `resetAdminVnbrokerConfig()`
- `runAdminVnbrokerBenchmark()`
- `warmTickerPrefetch()`
- `adminIntradaySideBackfillPreview()`, `adminIntradaySideBackfillApply()`, `adminIntradaySideBackfillStatus()`
- `adminIntradayUniverseWarmNow()`
- `getAdminSignalsSummary()`, `getAdminSignalsConfig()`
- `previewAdminSignalMaterialization()`

**Trước khi xóa**: Grep để đảm bảo không còn component nào import những functions này.

### 9.2 `frontend/src/App.jsx` — xóa admin-ops routes

Xóa các `<Route path="admin-ops" ...>` entries và import tương ứng.  
Giữ redirect rule: `<Route path="admin-ops" element={<Navigate to="/operations-center" />} />` nếu cần backward compat URL.

### 9.3 `frontend/src/i18n/vi.js` và `en.js`

Giữ nguyên key `adminOps` trong i18n (dùng cho navigation labels), chỉ xóa nếu không còn reference nào.

---

## 10. Dependency diagram

```
S1-PrefetchPanel ──→ Gate D1 ──→ D2-Backend-Decommission ──→ D3-Frontend-Cleanup
S2-VnBroker      ──→ Gate D1
S3-DataOps       ──→ Gate D1
S4-SOCPage       ──→ Gate D1
S5-BE (screener) ──→ S5-FE (screener) ──→ Gate D1
```
