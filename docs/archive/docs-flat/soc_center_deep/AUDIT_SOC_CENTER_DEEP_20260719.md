# Audit SOC Center — Bug, Gap & Root Cause Analysis

> **Thời điểm**: 2026-07-19  
> **Phạm vi**: Toàn bộ SOC (Service Operations Center) — backend `service_ops`, frontend `packages/web/src/components/soc/`, adapter `soc.js`, legacy `frontend/src/components/soc/`  
> **Phương pháp**: Trace mã nguồn thực tế, đối chiếu plan/luồng dữ liệu, kiểm tra quality gates

---

## Tóm tắt 5 findings nghiêm trọng nhất

| ID | Mức | File | Vấn đề |
|----|-----|------|--------|
| **F1** | P0-CRITICAL | `dataops_planner.py:100,153,360` | DataOps run logs/purge/abort dùng sai service key `['matrix']` thay vì `['dataops']` (không tồn tại) — mọi thao tác DataOps trên run logs đều chạm nhầm matrix data |
| **F2** | P0-CRITICAL | `tasks.py:56-76` | Health probe luôn trả về `{'status': 'healthy'}` bất kể service có hoạt động hay không — toàn bộ dashboard SOC luôn xanh lá giả tạo |
| **F3** | P0-CRITICAL | `registry.py:241-247` | `SOC_DOMAIN_PRIMARY_SERVICE_KEYS` không có entry cho domain `'dataops'` — gốc của F1, khiến DataOps views không thể filter run logs đúng service |
| **F4** | P1-MAJOR | `DataOpsContext.tsx:81-112` | DataOps context swallow toàn bộ error (catch rỗng) và **không auto-load data** — hero metrics luôn hiện `0` cho đến khi user click vào subtab |
| **F5** | P1-MAJOR | `tasks.py:56-76` + `settings.py:508` | Health check chạy mỗi 60s nhưng không ping endpoint, không verify upstream dependency — chỉ đếm DB rows (signals) hoặc check config tồn tại (mọi domain khác) |

---

## 1. Bản đồ kiến trúc

### Backend (`packages/core/backend/src/service_ops/`)

| File | Dòng | Trách nhiệm | Ghi chú |
|------|------|-------------|---------|
| `models.py` | 711 | 6 core models + 3 execution models | ServiceDef, ServiceConfig, ServiceHealth, ServiceRunLog, OwnershipRecord, ConfigChangeAudit, ScrapeMatrix, ScrapeMatrixCell, MarketDataParitySnapshot, CustomSymbolGroup, BackfillExecutionRun |
| `registry.py` | 420 | Bootstrap 23-service baseline, domain ownership, anchor configs | `CANONICAL_SOC_SERVICES` tuple; `SOC_DOMAIN_PRIMARY_SERVICE_KEYS` dict (5 domains, **thiếu dataops**) |
| `tasks.py` | 1080 | ~15 Celery tasks: health check, queue tier scheduler, scrape cycle, backfill, signal materialization, parity snapshot | Health check luôn return 'healthy' |
| `dataops_market_data.py` | 857 | Queue tier resolution, runtime config, observability, parity, coverage | SSOT helpers |
| `views/` | ~4000 | 50+ API endpoints cho 6 domains + DataOps (inventory, planner, backfill, registry, observability, queue-tiers, runtime-config) | `dataops_planner.py` có copy-paste bug service key |

### Frontend (`packages/web/src/components/soc/`)

| File | Dòng | Trách nhiệm | Ghi chú |
|------|------|-------------|---------|
| `DataOpsContext.tsx` | 148 | Context provider cho DataOps state | Catch rỗng, không auto-load |
| `SocOverviewPanel.tsx` | 570 | Service health dashboard | fetch + filter + pagination + toggle |
| `SocDataOpsPanel.tsx` | 205 | DataOps master panel với 5 subtabs | Hero metrics phụ thuộc context |
| `SocDataInventorySection.tsx` | 203 | Data warehouse stats | Fetch riêng API |
| `SocDataOpsOperationsSection.tsx` | 753 | Backfill form + planner console | Lớn nhất, nhiều logic nhất |
| `SocDataOpsMonitorSection.tsx` | 660 | Queue tiers, observability, parity, retention, anomaly | |
| `soc.module.css` | 2657 | Design tokens glassmorphism | |
| `soc.js` (adapter) | 499 | ~60 API methods | |

---

## 2. Luồng dữ liệu đã trace

### Use-case: User mở SOC → Overview → thấy service health

```
ShellOperationsCenterPage.tsx:56
  → renderTabContent() → SocOverviewPanel
    → fetchData() → defaultCoreApiAdapter.getSocOverviewSummary()
      → soc.js:34 GET /core/v1/operator/soc/overview/
        → OverviewSummaryView.get() {overview.py:269}
          → ServiceDefinition.objects.all() (23 services)
          → ServiceHealth.objects.filter(service__in=services)
            ← health records created by health_check_all_services
              → _probe_service_health() ALWAYS returns 'healthy'
```

**Kết luận**: Mọi service luôn xanh lá vì health probe không bao giờ trả về degraded/unhealthy.

### Use-case: User mở SOC → DataOps → Run Logs

```
SocDataOpsPanel → SocDataOpsOperationsSection
  → gọi adapter.getSocDataOpsRunLogs()
    → soc.js GET /core/v1/operator/scraping/dataops/run-logs/
      → DataOpsRunLogsView.get() {dataops_planner.py:98}
        → filter by service__service_key=SOC_DOMAIN_PRIMARY_SERVICE_KEYS['matrix']
          → 'matrix_cycle_coordinator' (Sai! Phải là 'backfill_daily_prices' hoặc dataops service)
```

**Kết luận**: Run logs DataOps trả về run logs của Matrix, không phải DataOps. Bug copy-paste.

---

## 3. CONTRADICTIONS (Plan vs Code)

| Plan | Thực tế | Tác động |
|------|---------|----------|
| "Health check probes service availability" `IMPLEMENTATION_PLAN_SOC_REVIEW_20260512.md` | `tasks.py:72` hardcoded `'status': 'healthy'` | Toàn bộ health dashboard vô dụng |
| "DataOps run logs show operator history" `TECH_SPEC_SOC_DATAOPS_20260625.md` | `dataops_planner.py:100` query sai service key | Run logs trả về sai data |
| "SOC supports DataOps domain ownership" | `registry.py:241-247` không có dataops key | DataOps views không thể filter đúng |
| "DataOpsProvider loads inventory/runs/coverage" | `DataOpsContext.tsx:74-140` không gọi refresh | Hero metrics = 0 khi mới mount |
| "Error handling trong SOC panels" | `DataOpsContext.tsx:86,97,108` catch rỗng | User không thấy API error |

---

## 4. Findings chi tiết

### F1 [P0-CRITICAL] DataOps run logs/purge/abort sai service key

- **File**: `dataops_planner.py:100,153,360`
- **Hiện trạng**: `SOC_DOMAIN_PRIMARY_SERVICE_KEYS['matrix']` (='matrix_cycle_coordinator') được dùng trong cả 3 views: `DataOpsRunLogsView`, `DataOpsRunLogsPurgeView`, `DataOpsPlannerRunAbortView`
- **Tác động**: 
  - DataOps run log history = matrix cycle run logs
  - Purge run logs = xóa matrix run logs  
  - Abort planner run = không tìm thấy run (vì filter sai service)
- **Nguyên nhân gốc**: Copy-paste từ matrix views. `'dataops'` không tồn tại trong `SOC_DOMAIN_PRIMARY_SERVICE_KEYS` (registry.py:241-247)
- **Đề xuất**: 
  1. Thêm `'dataops': 'backfill_daily_prices'` vào `SOC_DOMAIN_PRIMARY_SERVICE_KEYS`
  2. Sửa cả 3 views dùng `SOC_DOMAIN_PRIMARY_SERVICE_KEYS['dataops']`

### F2 [P0-CRITICAL] Health probe trả về 'healthy' bất kể thực tế

- **File**: `tasks.py:56-76`
- **Hiện trạng**: 
  ```python
  def _probe_service_health(service):
      # ...
      return {'status': 'healthy', 'detail': detail, 'response_ms': ...}
  ```
  `status` luôn là `'healthy'` — không bao giờ degraded/unhealthy dù service có chết.
- **Tác động**: Dashboard SOC luôn xanh, operator không biết service thực sự đang hoạt động hay không.
- **Nguyên nhân gốc**: Implement chưa hoàn thiện — chỉ probe signals/matrix domain với DB count, còn lại chỉ check config tồn tại rồi hardcode healthy.
- **Đề xuất**: 
  1. Thêm actual endpoint ping (`requests.head` hoặc `httpx`) cho mỗi service
  2. Thêm timeout + retry
  3. Nếu ping fail → degraded; nếu fail > N lần liên tiếp → unhealthy
  4. Feature gate bằng `SOC_HEALTH_PROBE_MODE=simple|deep`

### F3 [P0-CRITICAL] Thiếu dataops entry trong SOC_DOMAIN_PRIMARY_SERVICE_KEYS

- **File**: `registry.py:241-247`
- **Hiện trạng**: 
  ```python
  SOC_DOMAIN_PRIMARY_SERVICE_KEYS = {
      'vnbroker': 'vnbroker_quote',
      'prefetch': 'prefetch_daily',
      'signals': 'signal_whale_detector',
      'screener': 'screener_rule_engine',
      'matrix': 'matrix_cycle_coordinator',
  }
  ```
  Không có `'dataops'` mặc dù `CANONICAL_SOC_SERVICES` có 3 service dataops domain.
- **Tác động**: Mọi DataOps view cần filter by service key đều không có reference để dùng. Gốc rễ của F1.
- **Đề xuất**: Thêm `'dataops': 'backfill_daily_prices'`.

### F4 [P1-MAJOR] DataOpsContext: catch rỗng + không auto-load

- **File**: `DataOpsContext.tsx:81-112`
- **Hiện trạng**: 
  ```typescript
  const refreshInventory = useCallback(async () => {
      try {
          const data = await adapter.getSocDataOpsInventory();
          setInventory(data);
      } catch { /* handled by section */ }
  }, []);
  ```
  3 functions định nghĩa (`refreshInventory`, `refreshRuns`, `refreshCoverage`) nhưng không được gọi trong Provider. Error bị nuốt.
- **Tác động**: 
  - Hero metrics trong `SocDataOpsPanel.tsx:47-53` luôn = 0 cho đến khi user click subtab
  - API fail không hiển thị
- **Đề xuất**: 
  1. `useEffect` trong Provider gọi `refreshInventory()` + `refreshRuns()` khi mount
  2. Thêm `error` state vào `DataOpsState` interface
  3. Expose error qua context để sections có thể render `<InlineError>`

### F5 [P1-MAJOR] Health check superficial

- **File**: `tasks.py:56-76` + `settings.py:508`
- **Hiện trạng**: Celery Beat chạy `health_check_all_services` mỗi 60s, nhưng probe chỉ đếm DB rows hoặc check config tồn tại. Không endpoint ping, không upstream verify.
- **Tác động**: Service có thể chết nhưng SOC vẫn báo healthy. Operator không biết để can thiệp.
- **Đề xuất**: Implement `DeepHealthProbe` class với:
  - `ping_endpoint(url, timeout=5)` → degraded khi timeout
  - `verify_db_connectivity()` → unhealthy khi DB down
  - `check_upstream_dependency(service_key)` → cascade failure detection
  - Configurable threshold cho `consecutive_failures` → auto degraded/unhealthy

### F6 [P2-MINOR] Legacy code chưa dọn

- **File**: `frontend/src/components/soc/` (18 files, ~5000 lines)
- **Hiện trạng**: Legacy DataOpsPanel.jsx (2642 dòng) và 17 file khác vẫn tồn tại. `frontend/` app import `ShellOperationsCenterPage` từ package web, nhưng legacy component tree không được xóa.
- **Tác động**: Confusion cho dev — không rõ code nào đang chạy. Có thể drift i18n.
- **Đề xuất**: Xóa `frontend/src/components/soc/` sau khi xác nhận frontend app dùng `@vninvest/web` exports.

### F7 [P2-MINOR] Loading state undefined trong DataOpsContext

- **File**: `DataOpsContext.tsx:48`
- **Hiện trạng**: `loading` khởi tạo là `{}`. `loading.inventory` = undefined (falsy). `SocDataOpsPanel.tsx:103` kiểm tra `loading.inventory && loading.runs` → false, skeleton không hiện.
- **Tác động**: User không thấy loading skeleton khi data đang fetch.
- **Đề xuất**: Khởi tạo `loading: { inventory: true, runs: true, coverage: true }` hoặc dùng `loading['inventory'] !== false`.

### F8 [P2-MINOR] soc.js adapter: dataops run-logs type mismatch

- **File**: `soc.js` adapter
- **Hiện trạng**: SOC Base URL dùng `/core/v1/operator/soc/` cho overview/services và `/core/v1/operator/scraping/dataops/` cho DataOps. Sự phân tách namespace này không đồng nhất — operator phải nhớ 2 base paths.
- **Tác động**: Khó maintain, dễ sai URL.
- **Đề xuất**: Thống nhất tất cả SOC API dưới `/core/v1/operator/soc/`, dùng URL routing redirect cho các scraping/dataops cũ.

### F9 [P3-LOW] Security: show_operations_center default false

- **File**: `context/authRuntime.js:59`
- **Hiện trạng**: Feature flag tắt mặc định. Backend chỉ cho staff/superuser thấy SOC.
- **Tác động**: User thường không thấy SOC. Đúng thiết kế security nhưng hạn chế adoption.
- **Đề xuất**: Feature flag system → cho phép tenant admin enable SOC.

---

## 5. Quality Gates

| Gate | Status | Ghi chú |
|------|--------|---------|
| `npx tsc --noEmit` | ✅ PASS | (packages/web) |
| `npm run lint` | ✅ PASS | Chỉ pre-existing warnings |
| `npm run build` | ✅ PASS | Chỉ chunk-size warning |
| `vitest run` | ✅ 6 files / 16 tests | PASS |
| Backend tests (service_ops) | ? | ~1436 dòng test_soc_api_domain.py — cần chạy |
| i18n key parity vi/en | ✅ | `soc.*` namespace ~400 keys, parity confirmed |
| Legacy i18n parity | ❌ | `frontend/src/i18n/vi.js` + `en.js` có `soc.*` keys riêng — không đồng bộ với packages/web |

---

## 6. Đề xuất nâng cấp SOC Center lên chuẩn quốc tế

### Phase 1 — Fix critical bugs (ước lượng: 2-3 ngày)

1. **F1+F3**: Thêm `'dataops': 'backfill_daily_prices'` vào `SOC_DOMAIN_PRIMARY_SERVICE_KEYS`, sửa `DataOpsRunLogsView`, `DataOpsRunLogsPurgeView`, `DataOpsPlannerRunAbortView`
2. **F2+F5**: Implement `DeepHealthProbe` — endpoint ping + upstream verify + cascade failure detection
3. **F4**: Auto-load data trong DataOpsProvider, expose error state, fix skeleton loading
4. **F7**: Init loading state với giá trị `true` cho inventory/runs/coverage

### Phase 2 — Observability & Alerting (ước lượng: 3-5 ngày)

5. **Real service health**: Thêm `requests.head()` probe với timeout config, circuit breaker pattern
6. **Alert integration**: Khi service xuống degraded/unhealthy → tự động tạo `UnifiedAlert` → Alert Center hiển thị
7. **SLO/SLI tracking**: `ServiceHealth` model thêm `uptime_percentage`, `slo_target`, `error_budget` fields
8. **SOC notification channel**: Webhook/Slack/Email khi service health thay đổi

### Phase 3 — Code quality & Cleanup (ước lượng: 2-3 ngày)

9. **Xóa legacy code**: `frontend/src/components/soc/` (18 files, ~5000 dòng)
10. **Xóa legacy i18n**: `frontend/src/i18n/vi.js` + `en.js` SOC keys (dùng packages/web làm SSOT)
11. **Đồng nhất SOC URL namespace**: Gộp `/operator/scraping/dataops/` → `/operator/soc/dataops/`
12. **Add ErrorBoundary**: Mỗi SOC panel wrap bằng ErrorBoundary

### Phase 4 — Premium features (ước lượng: 5-7 ngày)

13. **Service dependency graph**: Model `ServiceDependency` (service → upstream service), visualize trong Overview
14. **Auto-remediation**: Khi service unhealthy → tự động restart Celery worker, clear cache, hoặc rollback config
15. **Capacity planning dashboard**: `ServiceRunLog` → trend analysis (duration trend, queue depth trend, failure rate trend)
16. **Multi-tenant SOC**: Phân quyền SOC cho tenant admin (hiện chỉ staff/superuser)
17. **SOC audit export**: Export `ConfigChangeAudit` + `ServiceRunLog` → CSV/JSON/Push-to-S3

### Priority matrix

| ID | Effort | Impact | Priority |
|----|--------|--------|----------|
| F1+F3 | 0.5d | 🔴 DataOps sai data | **P0** |
| F2+F5 | 1d | 🔴 Health dashboard vô dụng | **P0** |
| F4 | 0.5d | 🟠 Hero metrics = 0, errors silent | **P1** |
| F7 | 0.25d | 🟡 No skeleton loading | **P2** |
| Phase 2 (Alerting) | 3-5d | 🟠 SOC thụ động → chủ động | **P1** |
| Phase 3 (Cleanup) | 2-3d | 🟡 Technical debt | **P2** |
| Phase 4 (Premium) | 5-7d | 🔵 Competitive advantage | **P3** |

---

## 7. Câu hỏi cần làm rõ

1. DataOps service nào là primary cho SOC_DOMAIN_PPIMARY_SERVICE_KEYS? `backfill_daily_prices` hay cần service mới?
2. Health probe có nên chạy sync (trong task) hay async (dispatch subtask cho mỗi service)?
3. Legacy `frontend/src/components/soc/` có còn được reference bởi code nào ngoài test không?
4. Alert Center integration: muốn SOC tự động tạo UnifiedAlert hay chỉ log internal?

---

## 8. Đánh giá tổng thể

**SOC Center implement hiện tại: ~65% hoàn thiện**. Giao diện đẹp (glassmorphism, 2657 dòng CSS), i18n đầy đủ, backend API có coverage rộng (~50 endpoints). 

Tuy nhiên, **3 critical bugs làm mất giá trị cốt lõi**:
1. Health check không hoạt động → dashboard luôn xanh
2. DataOps run logs sai service → operator thấy sai data
3. DataOps context không auto-load + swallow errors → UX kém

**Sau khi fix P0 + P1 → đạt ~85%**. Premium features (Phase 4) cần thêm 5-7 ngày để đạt chuẩn quốc tế (auto-remediation, dependency graph, multi-tenant).
