# SOC Full Replacement — Implementation Plan
**Ngày**: 2026-05-13  
**Phiên bản**: 1.0  
**Status**: Approved — Ready for execution  
**Parent**: `docs/SOC_FULL_REPLACEMENT_HANDOFF_MASTER_20260513.md`  
**Tech Spec**: `docs/TECH_SPEC_SOC_FULL_REPLACEMENT_20260513.md`

---

## 1. Tổng quan kế hoạch

| Hạng mục | Giá trị |
|----------|---------|
| Tổng số tasks | 10 tasks (T01–T10) |
| Backend tasks | T01–T06 |
| Frontend tasks | T07–T08 |
| Test + Validation | T09–T10 |
| Ước tính tổng commit | 15–20 commits |
| Priority order | T01 → T02 → T03 → T04 → T05 → T06 → T07 → T08 → T09 → T10 |

---

## 2. Dependency Graph

```
T01 (models) 
  → T02 (domain configs)
    → T03 (ownership matrix)
      → T04 (serializers + base views)
        → T05 (domain views)
          → T06 (matrix models + coordinator)
            → T07 (frontend base components)
              → T08 (domain panels + routing)
                → T09 (tests)
                  → T10 (docker + final audit)
```

---

## 3. Tasks Chi Tiết

---

### T01 — service_ops Django App + 6 Core Models + Migrations

**Mục tiêu**: Tạo Django app `service_ops` tại `packages/core/backend/src/vninvest_core/service_ops/` với 6 models theo TECH_SPEC section 2.

**Files tạo mới**:
- `packages/core/backend/src/vninvest_core/service_ops/__init__.py` (CREATE)
- `packages/core/backend/src/vninvest_core/service_ops/apps.py` (CREATE)
- `packages/core/backend/src/vninvest_core/service_ops/models.py` (CREATE — 6 models)
- `packages/core/backend/src/vninvest_core/service_ops/migrations/0001_initial.py` (CREATE — auto-generated)

**Files sửa**:
- `packages/core/backend/src/vninvest_core/settings.py` hoặc `base.py` (MODIFY — thêm `service_ops` vào INSTALLED_APPS)

**Interface cần implement** (theo TECH_SPEC):
```python
class ServiceDefinition(models.Model): ...
class ServiceConfig(models.Model): ...
class ServiceHealth(models.Model): ...
class ServiceRunLog(models.Model): ...
class OwnershipRecord(models.Model): ...
class ConfigChangeAudit(models.Model): ...
```

**Test cases bắt buộc**:
1. Tạo ServiceDefinition với domain='vnbroker' → save thành công
2. Tạo ServiceConfig → is_current=True → tạo thêm ServiceConfig mới → ServiceConfig cũ tự set is_current=False
3. OwnershipRecord.is_writable() với mode='canonical' → True; mode='read-only' → False
4. python manage.py check → 0 errors

**DoD**:
- [ ] Tất cả 6 model tồn tại và có đúng fields theo TECH_SPEC
- [ ] Migration 0001_initial tạo thành công: `python manage.py migrate service_ops`
- [ ] `python manage.py check` → 0 errors
- [ ] OwnershipRecord.is_writable() logic đúng

**Không thuộc scope T01**: Serializers, views, URLs — để T04.

---

### T02 — Domain Config Typed Schemas (4 dataclasses)

**Mục tiêu**: Implement 4 typed domain config dataclasses với `validate()` method theo TECH_SPEC section 3.

**Files tạo mới**:
- `packages/core/backend/src/vninvest_core/service_ops/domain_configs/__init__.py` (CREATE)
- `packages/core/backend/src/vninvest_core/service_ops/domain_configs/vnbroker.py` (CREATE — VnbrokerDomainConfig)
- `packages/core/backend/src/vninvest_core/service_ops/domain_configs/prefetch.py` (CREATE — PrefetchTimePolicyConfig)
- `packages/core/backend/src/vninvest_core/service_ops/domain_configs/signals.py` (CREATE — SignalServicesDomainConfig)
- `packages/core/backend/src/vninvest_core/service_ops/domain_configs/screener.py` (CREATE — ScreenerDomainConfig)

**Interface** (theo TECH_SPEC section 3):
```python
@dataclass class VnbrokerDomainConfig: 
    def validate(self) -> list[str]: ...
    
@dataclass class PrefetchTimePolicyConfig:
    def validate(self) -> list[str]: ...
    
@dataclass class SignalServicesDomainConfig:
    def validate(self) -> list[str]: ...
    
@dataclass class ScreenerDomainConfig:
    def validate(self) -> list[str]: ...
```

**Test cases bắt buộc**:
1. VnbrokerDomainConfig(timeout=VnbrokerTimeoutConfig(read=1.0)).validate() → có lỗi về read
2. PrefetchTimePolicyConfig với market_open.interval_seconds=10 → validate() → lỗi về interval
3. SignalServicesDomainConfig với hot_tier_days=0 → validate() → lỗi
4. ScreenerDomainConfig với 51 rules → validate() → lỗi "Tối đa 50 rules"
5. VnbrokerDomainConfig.from_dict(valid_dict) → không raise exception

**DoD**:
- [ ] 4 dataclass files tồn tại
- [ ] validate() trả về list[str] rỗng khi config hợp lệ
- [ ] validate() có lỗi khi fields out of range
- [ ] from_dict() hoạt động đúng với dict hợp lệ
- [ ] Import từ `domain_configs` package thành công

**Không thuộc scope T02**: Tích hợp với models hay views — để T04.

---

### T03 — ServiceOwnershipMatrix + Ownership Constants

**Mục tiêu**: Implement class `ServiceOwnershipMatrix` và default ownership constants kế thừa từ Admin-Ops.

**Files tạo mới**:
- `packages/core/backend/src/vninvest_core/service_ops/ownership.py` (CREATE)

**Interface**:
```python
class ServiceOwnershipMatrix:
    """Cung cấp ownership decisions cho mọi domain."""
    
    WRITABLE_MODES = {'canonical', 'native-write', 'bridge-write', 'write-through', 'write-enabled', 'direct-writer'}
    
    @staticmethod
    def is_domain_writable(domain: str) -> bool: ...
    
    @staticmethod
    def get_write_block_reason(domain: str) -> str | None: ...
    
    @staticmethod
    def get_domain_ownership(domain: str) -> dict: ...
    
    @staticmethod
    def get_locked_fields(domain: str) -> list[str]: ...

# Ownership constants (kế thừa từ admin_ops/views.py)
DEFAULT_SIGNAL_OWNERSHIP = { ... }  # copy từ admin_ops, không import tránh circular
DEFAULT_VNBROKER_OWNERSHIP = { ... }
DEFAULT_PREFETCH_OWNERSHIP = { ... }
DEFAULT_SCREENER_OWNERSHIP = { ... }
```

**Test cases bắt buộc**:
1. ServiceOwnershipMatrix.is_domain_writable('vnbroker') → True (native-write)
2. ServiceOwnershipMatrix.is_domain_writable('signals') → False (bridge-write → read-only cho SOC)
3. ServiceOwnershipMatrix.get_write_block_reason('signals') → str có nội dung
4. ServiceOwnershipMatrix.get_write_block_reason('vnbroker') → None
5. get_domain_ownership() response có đủ fields: domain, mode, writer, can_apply

**DoD**:
- [ ] ServiceOwnershipMatrix class tồn tại và importable
- [ ] Tất cả 4 domain có ownership entry
- [ ] is_domain_writable và get_write_block_reason trả đúng theo mode
- [ ] Không circular import từ admin_ops

---

### T04 — Serializers + Base Views + URLs

**Mục tiêu**: Implement serializers, base viewsets, và URL routing cho 6 overview endpoints.

**Files tạo mới**:
- `packages/core/backend/src/vninvest_core/service_ops/serializers.py` (CREATE)
- `packages/core/backend/src/vninvest_core/service_ops/views/__init__.py` (CREATE)
- `packages/core/backend/src/vninvest_core/service_ops/views/base.py` (CREATE)
- `packages/core/backend/src/vninvest_core/service_ops/views/overview.py` (CREATE)
- `packages/core/backend/src/vninvest_core/service_ops/urls.py` (CREATE — 40 URL patterns)

**Files sửa**:
- Contracts urls.py (MODIFY — include service_ops urls)

**Interface serializers**:
```python
class ServiceDefinitionSerializer(ModelSerializer): ...
class ServiceHealthSerializer(ModelSerializer): ...
class ServiceRunLogSerializer(ModelSerializer): ...
class ConfigChangeAuditSerializer(ModelSerializer): ...
class OwnershipRecordSerializer(ModelSerializer): ...
```

**Interface base views**:
```python
class SOCBaseView(APIView):
    """Base view với auth, error envelope, request_id."""
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def handle_exception(self, exc):
        # Đảm bảo tất cả errors theo error envelope chuẩn
        ...

class SOCOverviewView(SOCBaseView):
    """GET /api/soc/overview/"""
    
class ServiceListView(SOCBaseView):
    """GET /api/soc/services/ — with pagination"""

class ServiceDetailView(SOCBaseView):
    """GET /api/soc/services/<service_key>/"""
```

**Test cases bắt buộc**:
1. GET /api/soc/overview/ → 200 với đúng structure
2. GET /api/soc/overview/ unauthenticated → 401
3. GET /api/soc/services/?page=1 → có pagination fields
4. GET /api/soc/services/nonexistent/ → 404 với error envelope
5. Error envelope luôn có: detail, code, timestamp, request_id

**DoD**:
- [ ] 6 overview endpoints respond đúng theo TECH_SPEC
- [ ] Tất cả responses có đúng structure
- [ ] 401 cho unauthenticated request
- [ ] 404 với error envelope đúng format
- [ ] Pagination trên list endpoint

---

### T05 — Domain Views (vnbroker, prefetch, signals, screener)

**Mục tiêu**: Implement 33 domain-specific endpoints với typed config validation và ownership checks.

**Files tạo mới**:
- `packages/core/backend/src/vninvest_core/service_ops/views/vnbroker.py` (CREATE — 7 views)
- `packages/core/backend/src/vninvest_core/service_ops/views/prefetch.py` (CREATE — 7 views)
- `packages/core/backend/src/vninvest_core/service_ops/views/signals.py` (CREATE — 13 views)
- `packages/core/backend/src/vninvest_core/service_ops/views/screener.py` (CREATE — 7 views)
- `packages/core/backend/src/vninvest_core/service_ops/views/mixins.py` (CREATE — ConfigApplyMixin, OwnershipMixin)

**Interface mixin**:
```python
class ConfigApplyMixin:
    """Mixin cho config apply flow: validate → ownership check → save → audit."""
    domain: str
    config_class: type
    
    def apply_config(self, request, config_data: dict) -> dict:
        # 1. Parse + validate typed config
        # 2. Check ownership (ServiceOwnershipMatrix)
        # 3. Preview diff
        # 4. Save ServiceConfig
        # 5. Log ConfigChangeAudit
        # 6. Return response với ownership info
        ...
```

**Test cases bắt buộc**:
1. POST /api/soc/vnbroker/config/apply/ với valid config → 200
2. POST /api/soc/vnbroker/config/apply/ với invalid timeout.read → 400 với field_errors
3. POST /api/soc/signals/config/apply/ → 403 hoặc write_block_reason (signals là bridge-write, SOC không được ghi trực tiếp)
4. GET /api/soc/signals/ownership/ → response có locked_fields
5. GET /api/soc/prefetch/config/ → response có 6 profiles + active_profile

**DoD**:
- [ ] 33 domain endpoints respond đúng
- [ ] Config validation trả 400 với field_errors khi invalid
- [ ] Ownership check trong config apply
- [ ] ConfigChangeAudit được tạo sau mỗi apply thành công
- [ ] Bridge-write domains trả ownership info đúng

---

### T06 — ScrapeMatrix Models + MatrixCoordinator + Matrix Views

**Mục tiêu**: Implement 2 matrix models, MatrixCoordinator class, và 7 matrix endpoints.

**Files tạo mới**:
- `packages/core/backend/src/vninvest_core/service_ops/models_matrix.py` (CREATE)
- `packages/core/backend/src/vninvest_core/service_ops/matrix_coordinator.py` (CREATE)
- `packages/core/backend/src/vninvest_core/service_ops/views/matrix.py` (CREATE — 7 views)
- `packages/core/backend/src/vninvest_core/service_ops/tasks.py` (CREATE — Celery tasks)
- `packages/core/backend/src/vninvest_core/service_ops/migrations/0002_scrape_matrix.py` (CREATE)

**Interface**:
```python
class ScrapeMatrix(models.Model): ...
class ScrapeMatrixCell(models.Model): ...

class MatrixCoordinator:
    def create_cycle(self, symbol_group_ids: list[str]) -> ScrapeMatrix: ...
    def try_claim_cell(self, symbol_group_id: str, provider: str, worker_id: str) -> bool: ...
    def mark_cell_done(self, symbol_group_id: str, provider: str, symbols_processed: int) -> None: ...
    def mark_cell_failed(self, symbol_group_id: str, provider: str, error: str) -> None: ...
    def get_cycle_summary(self) -> dict: ...
```

**Test cases bắt buộc**:
1. create_cycle() tạo đúng N×M cells (N groups × M providers)
2. try_claim_cell() khi row đã có cell=done → trả False và set cell=skipped
3. try_claim_cell() concurrency: 2 workers cùng claim 1 cell → chỉ 1 thành công
4. mark_cell_done() → cells pending cùng row tự chuyển thành skipped
5. GET /api/soc/matrix/cycles/ → paginated list
6. POST /api/soc/matrix/cycles/start/ → tạo cycle và dispatch tasks

**DoD**:
- [ ] ScrapeMatrix + ScrapeMatrixCell migration thành công
- [ ] MatrixCoordinator atomic claim không có race condition
- [ ] Row dedup logic đúng (1 row chỉ cần 1 done cell)
- [ ] 7 matrix endpoints respond đúng

---

### T07 — Frontend Base Components (6 components + i18n)

**Mục tiêu**: Implement 6 base SOC components với Tailwind dark theme và i18n tiếng Việt.

**Files tạo mới**:
- `frontend/src/components/soc/ServiceHealthCard.jsx` (CREATE)
- `frontend/src/components/soc/OwnershipBadgeRow.jsx` (CREATE)
- `frontend/src/components/soc/WriteGuardBanner.jsx` (CREATE)
- `frontend/src/components/soc/ConfigPreviewModal.jsx` (CREATE)
- `frontend/src/components/soc/MatrixScrapeMonitor.jsx` (CREATE)
- `frontend/src/components/soc/SOCDomainTabs.jsx` (CREATE)
- `frontend/src/components/soc/index.js` (CREATE — re-exports)

**Files sửa**:
- `frontend/src/i18n/vi.json` (MODIFY — thêm namespace soc.*)

**Interface** (theo TECH_SPEC section 7):
- Xem chi tiết trong TECH_SPEC section 7.1–7.6

**Test cases bắt buộc**:
1. ServiceHealthCard với status='healthy' → có class emerald
2. ServiceHealthCard với status='unhealthy' → có class rose
3. WriteGuardBanner render → hiện đúng reason và writeSurface
4. MatrixScrapeMonitor với cells data → render đúng màu theo status
5. i18n key `soc.tab.overview` → "Tổng quan"
6. i18n key `soc.ownership.mode.canonical` → "Người ghi chính"

**DoD**:
- [ ] 6 components tồn tại và importable
- [ ] Không có Ant Design / MUI imports
- [ ] i18n namespace soc.* có đủ keys theo TECH_SPEC section 8
- [ ] npm run build → 0 errors
- [ ] Status colors đúng theo TECH_SPEC (emerald/amber/rose/sky/slate)

---

### T08 — SOC Page + Domain Panels + Route

**Mục tiêu**: Implement trang SOCPage với SOCDomainTabs và 6 domain panels, add route vào app.

**Files tạo mới**:
- `frontend/src/pages/SOCPage.jsx` (CREATE)
- `frontend/src/components/soc/panels/SOCOverviewPanel.jsx` (CREATE)
- `frontend/src/components/soc/panels/SOCSignalsPanel.jsx` (CREATE)
- `frontend/src/components/soc/panels/SOCDataOpsPanel.jsx` (CREATE)
- `frontend/src/components/soc/panels/SOCPrefetchPanel.jsx` (CREATE)
- `frontend/src/components/soc/panels/SOCScreenerPanel.jsx` (CREATE)
- `frontend/src/components/soc/panels/SOCMatrixPanel.jsx` (CREATE)
- `frontend/src/api/socApi.js` (CREATE — API functions)

**Files sửa**:
- `frontend/src/App.jsx` hoặc router file (MODIFY — thêm route /operations-center)
- `frontend/src/api/client.js` (MODIFY — thêm SOC API base functions)

**API function interface**:
```js
// socApi.js
export const getSOCOverview = () => apiClient.get('/api/soc/overview/')
export const getVnbrokerConfig = () => apiClient.get('/api/soc/vnbroker/config/')
export const applyVnbrokerConfig = (data) => apiClient.post('/api/soc/vnbroker/config/apply/', data)
export const getPrefetchConfig = () => apiClient.get('/api/soc/prefetch/config/')
export const triggerPrefetchWarm = () => apiClient.post('/api/soc/prefetch/warm-now/')
export const getSignalsConfig = () => apiClient.get('/api/soc/signals/config/')
export const getSignalsOwnership = () => apiClient.get('/api/soc/signals/ownership/')
export const getScreenerConfig = () => apiClient.get('/api/soc/screener/config/')
export const getMatrixCycles = () => apiClient.get('/api/soc/matrix/cycles/')
export const startMatrixCycle = (data) => apiClient.post('/api/soc/matrix/cycles/start/', data)
export const getMatrixMonitor = () => apiClient.get('/api/soc/matrix/monitor/')
```

**Test cases bắt buộc**:
1. SOCPage load → không crash, hiện SOCDomainTabs
2. Tab "Tổng quan" active by default
3. Tab "Ma trận Thu thập" → hiện MatrixScrapeMonitor
4. Tab "Tín hiệu" → hiện WriteGuardBanner cho signals domain
5. Route /operations-center → render SOCPage
6. Route /admin-ops → redirect tới /operations-center

**DoD**:
- [ ] SOCPage render không crash khi loading state
- [ ] Tất cả 6 tabs switch correctly
- [ ] Route /operations-center hoạt động
- [ ] SOCSignalsPanel hiện WriteGuardBanner khi ownership.can_apply = false
- [ ] npm run build → 0 errors

---

### T09 — Backend Tests (Unit + Integration)

**Mục tiêu**: Viết test coverage ≥ 80% cho service_ops app.

**Files tạo mới**:
- `packages/core/backend/tests/test_soc_models.py` (CREATE)
- `packages/core/backend/tests/test_soc_domain_configs.py` (CREATE)
- `packages/core/backend/tests/test_soc_ownership.py` (CREATE)
- `packages/core/backend/tests/test_soc_api_overview.py` (CREATE)
- `packages/core/backend/tests/test_soc_api_vnbroker.py` (CREATE)
- `packages/core/backend/tests/test_soc_api_signals.py` (CREATE)
- `packages/core/backend/tests/test_soc_matrix.py` (CREATE)

**Test cases bắt buộc** (xem chi tiết trong T01–T06 DoD + SELF_AUDIT doc):
- Model lifecycle tests (T01–T03)
- Domain config validation tests (T02)
- API endpoint tests: 200/400/401/403/404 cho tất cả endpoints
- Matrix coordinator concurrency test (T06)
- Pagination test trên list endpoints

**DoD**:
- [ ] Tất cả test files tồn tại
- [ ] `pytest packages/core/backend/tests/test_soc_*.py` → 0 failures
- [ ] Coverage ≥ 80% (đo bằng `pytest --cov=service_ops`)

---

### T10 — Docker Build + Final Audit

**Mục tiêu**: Build thành công, chạy migrations, smoke test từ browser.

**Files sửa**:
- `CODE_CHANGE_AUDIT_LEDGER.md` (MODIFY — thêm entries cho T01–T09)
- `PROGRESS_DASHBOARD.md` (MODIFY — cập nhật SOC status)
- `module_tree_full.md` (MODIFY — regenerate)

**Commands bắt buộc**:
```powershell
# Build
docker compose -f docker-compose.dev.yml up -d --build core-api frontend

# Migration check
docker exec vninvest-core-api python manage.py migrate service_ops
docker exec vninvest-core-api python manage.py check

# Smoke test
curl http://localhost:8001/api/soc/overview/  # core-api port
curl http://localhost:3000/operations-center  # frontend port
```

**DoD**:
- [ ] Docker build 0 errors
- [ ] Migration thành công
- [ ] /api/soc/overview/ → 200 (hoặc 401 unauthenticated → đúng)
- [ ] /operations-center load trong browser
- [ ] CODE_CHANGE_AUDIT_LEDGER.md updated
- [ ] module_tree_full.md regenerated

---

## 4. Validation Gates Toàn Workstream

```
Gate 1 — Backend Static
  python manage.py check → 0 errors
  flake8 service_ops/ → 0 violations (no except: pass)

Gate 2 — Backend Tests
  pytest tests/test_soc_*.py -v --cov=service_ops → ≥ 80% coverage

Gate 3 — Frontend Build
  npm run build → exit 0

Gate 4 — Migration
  python manage.py migrate → no conflicts
  python manage.py showmigrations service_ops → all applied

Gate 5 — Docker Build
  docker compose -f docker-compose.dev.yml up -d --build core-api frontend → success

Gate 6 — Governance
  CODE_CHANGE_AUDIT_LEDGER.md updated
  module_tree_full.md regenerated
  PROGRESS_DASHBOARD.md updated
```

---

## 5. Risks

| Risk | Probability | Mitigation |
|------|-------------|------------|
| Circular import giữa service_ops và admin_ops | M | Copy constants vào service_ops/ownership.py, không import từ admin_ops |
| Migration conflict với core-api existing tables | L | Check `python manage.py showmigrations` trước khi run |
| Frontend bundle size tăng nhiều | L | Code-split SOCPage với lazy import |
| Celery task concurrency race condition ở MatrixCoordinator | M | Test với select_for_update, ThreadPoolExecutor mock |
| signals domain bridge-write cần giải thích rõ cho FE | M | WriteGuardBanner phải hiện đủ context |

---

## 6. Governance Artifacts

Sau mỗi task:
- `CODE_CHANGE_AUDIT_LEDGER.md` — thêm entry: date, files changed, command run, result
- `TASKBOARD_SOC_FULL_REPLACEMENT_20260513.md` — update status
- Commit riêng, push origin/dev ngay sau khi task done
