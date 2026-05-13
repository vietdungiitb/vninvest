# SOC Full Replacement — Taskboard
**Ngày**: 2026-05-13  
**Status**: Active  
**Parent**: `docs/IMPLEMENTATION_PLAN_SOC_FULL_REPLACEMENT_20260513.md`

---

## Trạng thái tổng quan

| Task | Tên | Status | Assignee | Commit |
|------|-----|--------|----------|--------|
| T01 | service_ops app + 6 core models | ⬜ NOT STARTED | - | - |
| T02 | Domain config typed schemas | ⬜ NOT STARTED | - | - |
| T03 | ServiceOwnershipMatrix | ⬜ NOT STARTED | - | - |
| T04 | Serializers + Base Views + URLs | ⬜ NOT STARTED | - | - |
| T05 | Domain Views (4 domains) | ⬜ NOT STARTED | - | - |
| T06 | ScrapeMatrix + MatrixCoordinator | ⬜ NOT STARTED | - | - |
| T07 | Frontend 6 base components + i18n | ⬜ NOT STARTED | - | - |
| T08 | SOC Page + Domain Panels + Route | ⬜ NOT STARTED | - | - |
| T09 | Backend Tests | ⬜ NOT STARTED | - | - |
| T10 | Docker Build + Final Audit | ⬜ NOT STARTED | - | - |

**Legend**: ⬜ NOT STARTED | 🔄 IN PROGRESS | ✅ DONE | ❌ BLOCKED

---

## T01 — service_ops app + 6 Core Models

**Status**: ⬜ NOT STARTED  
**Dependency**: none  
**Estimate**: 2–3 giờ

### Checklist
- [ ] `service_ops/__init__.py` created
- [ ] `service_ops/apps.py` created (AppConfig)
- [ ] `service_ops/models.py` created với đủ 6 models
- [ ] `ServiceDefinition` — fields: service_key (unique), name, domain (choices), description, owner_team, tags, is_active, is_deprecated, deprecation_note, created_at, updated_at
- [ ] `ServiceConfig` — fields: service (FK), config_schema_version, config_payload, applied_by, applied_at, change_reason, is_current; logic: save() tự set is_current=False cho previous
- [ ] `ServiceHealth` — fields: service (FK), status (choices), last_check_at, last_success_at, consecutive_failures, avg_response_ms, detail
- [ ] `ServiceRunLog` — fields: service (FK), celery_task_id, status (choices), started_at, finished_at, duration_seconds, input_summary, output_summary, error_detail
- [ ] `OwnershipRecord` — fields: domain (unique), owner_team, write_mode (choices), write_surface, locked_fields, compatibility_domains, deprecation_notes, updated_at; methods: is_writable(), get_write_block_reason()
- [ ] `ConfigChangeAudit` — fields: service (FK), action (choices), actor, actor_ip, before_snapshot, after_snapshot, change_summary, timestamp, request_id
- [ ] Tất cả models có Meta.ordering và indexes phù hợp
- [ ] service_ops thêm vào INSTALLED_APPS
- [ ] Migration 0001_initial chạy OK

### Validation Command
```powershell
cd backend
../.venv/Scripts/python.exe manage.py migrate service_ops --run-syncdb
../.venv/Scripts/python.exe manage.py check
```

### Evidence Required
- Output `manage.py check` (0 errors)
- Output `manage.py migrate` thành công

---

## T02 — Domain Config Typed Schemas

**Status**: ⬜ NOT STARTED  
**Dependency**: T01 (models tồn tại)  
**Estimate**: 2–3 giờ

### Checklist
- [ ] `domain_configs/__init__.py` exports tất cả 4 classes
- [ ] `domain_configs/vnbroker.py` — VnbrokerTimeoutConfig + VnbrokerDomainConfig với validate() + from_dict()
- [ ] `domain_configs/prefetch.py` — TimePolicyProfile + PrefetchTimePolicyConfig với validate(), VALID_PROFILE_NAMES, get_active_profile()
- [ ] `domain_configs/signals.py` — SignalDetectionConfig + SignalServicesDomainConfig với validate()
- [ ] `domain_configs/screener.py` — ScreenerRuleConfig + ScreenerDomainConfig với validate()
- [ ] validate() trả về list[str] rỗng khi input hợp lệ
- [ ] validate() có message rõ ràng bằng tiếng Việt khi lỗi

### Validation Command
```powershell
../.venv/Scripts/python.exe -c "
from vninvest_core.service_ops.domain_configs import VnbrokerDomainConfig, PrefetchTimePolicyConfig
cfg = VnbrokerDomainConfig()
print('Validate OK:', cfg.validate())
"
```

---

## T03 — ServiceOwnershipMatrix

**Status**: ⬜ NOT STARTED  
**Dependency**: T02  
**Estimate**: 1–2 giờ

### Checklist
- [ ] `ownership.py` created với class ServiceOwnershipMatrix
- [ ] WRITABLE_MODES set đúng (canonical, native-write, bridge-write, write-through, write-enabled, direct-writer)
- [ ] DEFAULT ownership constants cho 4 domains: vnbroker (native-write), prefetch (native-write), signals (bridge-write), screener (native-write)
- [ ] is_domain_writable() trả True/False đúng theo mode
- [ ] get_write_block_reason() trả None khi writable, string rõ ràng khi không
- [ ] get_domain_ownership() trả dict có đủ keys: domain, mode, writer, can_apply, locked_fields, write_surface
- [ ] Không circular import từ admin_ops

### Validation Command
```powershell
../.venv/Scripts/python.exe -c "
from vninvest_core.service_ops.ownership import ServiceOwnershipMatrix
print('vnbroker writable:', ServiceOwnershipMatrix.is_domain_writable('vnbroker'))
print('signals writable:', ServiceOwnershipMatrix.is_domain_writable('signals'))
print('signals block reason:', ServiceOwnershipMatrix.get_write_block_reason('signals'))
"
```

---

## T04 — Serializers + Base Views + URLs (6 overview endpoints)

**Status**: ⬜ NOT STARTED  
**Dependency**: T03  
**Estimate**: 3–4 giờ

### Checklist
- [ ] `serializers.py` — 5 serializers: ServiceDefinitionSerializer, ServiceHealthSerializer, ServiceRunLogSerializer, ConfigChangeAuditSerializer, OwnershipRecordSerializer
- [ ] `views/base.py` — SOCBaseView với: permission_classes=[IsAuthenticated, IsAdminUser], handle_exception() trả error envelope chuẩn, get_request_id() helper
- [ ] `views/overview.py` — SOCOverviewView, ServiceListView (pagination), ServiceDetailView, TriggerHealthCheckView, RunLogListView, ConfigChangeAuditListView
- [ ] `urls.py` — 40 URL patterns theo TECH_SPEC section 9
- [ ] Error envelope: tất cả lỗi có {detail, code, timestamp, request_id, field_errors?}
- [ ] Pagination: page_size default 20, max 100
- [ ] Register urls vào contracts router

### Validation Command
```powershell
../.venv/Scripts/python.exe manage.py check
curl http://localhost:8001/api/soc/overview/ -H "Authorization: Bearer TOKEN"
```

---

## T05 — Domain Views (vnbroker + prefetch + signals + screener)

**Status**: ⬜ NOT STARTED  
**Dependency**: T04  
**Estimate**: 5–6 giờ

### Checklist
- [ ] `views/mixins.py` — ConfigApplyMixin với apply_config() flow
- [ ] `views/vnbroker.py` — 7 views: Config, ConfigApply, ConfigPreview, Health, TestConnection, Providers, Ownership
- [ ] `views/prefetch.py` — 7 views: Config, ConfigApply, ConfigPreview, Status, WarmNow, Schedule, Ownership
- [ ] `views/signals.py` — 13 views: Config, ConfigApply, ConfigPreview, Summary, RetentionPolicy, RetentionPreview, Materialization, MaterializationPreview, Universe, UniverseUpdate, Ownership, JobRun, JobStatus
- [ ] `views/screener.py` — 7 views: Config, ConfigApply, ConfigPreview, RuleList, RulesRun, RulesLastRun, Ownership
- [ ] Config apply: validate typed config → return 400 với field_errors nếu sai
- [ ] Signals domain: apply trả ownership info với can_apply=False + write_block_reason
- [ ] ConfigChangeAudit tạo sau mỗi apply thành công

### Validation Command
```powershell
# Test vnbroker config apply với invalid data
curl -X POST http://localhost:8001/api/soc/vnbroker/config/apply/ \
  -H "Content-Type: application/json" \
  -d '{"timeout": {"read": 1.0}}' \
  -H "Authorization: Bearer TOKEN"
# Expected: 400 với field_errors về timeout.read
```

---

## T06 — ScrapeMatrix + MatrixCoordinator + Matrix Views

**Status**: ⬜ NOT STARTED  
**Dependency**: T05  
**Estimate**: 4–5 giờ

### Checklist
- [ ] `models_matrix.py` — ScrapeMatrix + ScrapeMatrixCell với đầy đủ fields theo TECH_SPEC
- [ ] Migration 0002_scrape_matrix chạy OK
- [ ] `matrix_coordinator.py` — MatrixCoordinator class với create_cycle, try_claim_cell (select_for_update), mark_cell_done (skip pending peers), mark_cell_failed, get_cycle_summary
- [ ] `tasks.py` — health_check_all_services, run_scrape_cycle, scrape_cell_task
- [ ] `views/matrix.py` — 7 views: CycleList, CycleDetail, CycleStart, CellList, CycleAbort, Providers, Monitor
- [ ] try_claim_cell atomic (không race condition khi 2 workers claim cùng cell)
- [ ] mark_cell_done tự skip pending cells cùng row
- [ ] ScrapeMatrix.progress_pct property tính đúng

### Validation Command
```powershell
../.venv/Scripts/python.exe manage.py migrate service_ops
../.venv/Scripts/python.exe -c "
from vninvest_core.service_ops.matrix_coordinator import MatrixCoordinator
c = MatrixCoordinator('test_cycle', ['vci', 'kbs'])
m = c.create_cycle(['G1', 'G2'])
print('Cells:', m.cells.count())  # Should be 4 (2 groups × 2 providers)
"
```

---

## T07 — Frontend Base Components + i18n

**Status**: ⬜ NOT STARTED  
**Dependency**: T06 (backend endpoints ready)  
**Estimate**: 4–5 giờ

### Checklist
- [ ] `frontend/src/components/soc/ServiceHealthCard.jsx` — status colors đúng (emerald/amber/rose/sky/slate), i18n
- [ ] `frontend/src/components/soc/OwnershipBadgeRow.jsx` — mode colors đúng, canApply prop
- [ ] `frontend/src/components/soc/WriteGuardBanner.jsx` — amber banner với lock icon, reason + writeSurface
- [ ] `frontend/src/components/soc/ConfigPreviewModal.jsx` — before/after diff, impactWarnings, validationErrors, isSubmitting
- [ ] `frontend/src/components/soc/MatrixScrapeMonitor.jsx` — heatmap grid, poll interval, cell colors
- [ ] `frontend/src/components/soc/SOCDomainTabs.jsx` — 6 tabs, active state, i18n labels
- [ ] `frontend/src/components/soc/index.js` — export all
- [ ] `frontend/src/i18n/vi.json` soc.* namespace đầy đủ theo TECH_SPEC section 8
- [ ] Không có Ant Design / MUI imports
- [ ] Tailwind classes dùng: bg-slate-950, border-slate-800, text-slate-100/300/400

### Validation Command
```powershell
cd frontend
npm run build 2>&1 | Select-String "error"
```

---

## T08 — SOC Page + Domain Panels + Route

**Status**: ⬜ NOT STARTED  
**Dependency**: T07  
**Estimate**: 4–5 giờ

### Checklist
- [ ] `frontend/src/api/socApi.js` — tất cả API functions theo TECH_SPEC section 8
- [ ] `frontend/src/pages/SOCPage.jsx` — load overview data, render SOCDomainTabs
- [ ] `frontend/src/components/soc/panels/SOCOverviewPanel.jsx` — ServiceHealthCard list, summary stats
- [ ] `frontend/src/components/soc/panels/SOCSignalsPanel.jsx` — config view + WriteGuardBanner (can_apply=false)
- [ ] `frontend/src/components/soc/panels/SOCDataOpsPanel.jsx` — run logs, service health grid
- [ ] `frontend/src/components/soc/panels/SOCPrefetchPanel.jsx` — 6 profiles config, warm-now button
- [ ] `frontend/src/components/soc/panels/SOCScreenerPanel.jsx` — rules list, run button
- [ ] `frontend/src/components/soc/panels/SOCMatrixPanel.jsx` — MatrixScrapeMonitor + cycle controls
- [ ] Route `/operations-center` registered trong App router
- [ ] Route `/admin-ops` redirect → `/operations-center`
- [ ] Tab switching via URL search param `?tab=`

### Validation Command
```powershell
cd frontend
npm run build
# Sau đó rebuild docker và smoke test
docker compose -f ../docker-compose.dev.yml up -d --build frontend
```

---

## T09 — Backend Tests

**Status**: ⬜ NOT STARTED  
**Dependency**: T08 (tất cả backend code đã có)  
**Estimate**: 4–5 giờ

### Checklist
- [ ] `tests/test_soc_models.py` — lifecycle tests cho 6 models
- [ ] `tests/test_soc_domain_configs.py` — validate() tests cho 4 dataclasses
- [ ] `tests/test_soc_ownership.py` — ownership matrix tests
- [ ] `tests/test_soc_api_overview.py` — overview endpoints tests (200/401/404)
- [ ] `tests/test_soc_api_vnbroker.py` — vnbroker domain tests (400 validation)
- [ ] `tests/test_soc_api_signals.py` — signals ownership (write block), bridge-write behavior
- [ ] `tests/test_soc_matrix.py` — MatrixCoordinator, atomic claim, row dedup
- [ ] Coverage ≥ 80% cho service_ops app

### Validation Command
```powershell
cd backend
../.venv/Scripts/python.exe -m pytest packages/core/backend/tests/test_soc_*.py -v --cov=vninvest_core.service_ops --cov-report=term-missing
```

---

## T10 — Docker Build + Final Audit

**Status**: ⬜ NOT STARTED  
**Dependency**: T09  
**Estimate**: 1–2 giờ

### Checklist
- [ ] docker compose -f docker-compose.dev.yml up -d --build core-api → success
- [ ] docker compose -f docker-compose.dev.yml up -d --build frontend → success
- [ ] python manage.py migrate → no conflicts
- [ ] Smoke: GET /api/soc/overview/ → 200 hoặc 401 (đúng auth behavior)
- [ ] Smoke: Browser /operations-center → SOCPage loads
- [ ] CODE_CHANGE_AUDIT_LEDGER.md updated với đầy đủ entries T01–T09
- [ ] PROGRESS_DASHBOARD.md updated
- [ ] module_tree_full.md regenerated
- [ ] All changes committed và pushed to dev branch

### Validation Command
```powershell
docker compose -f docker-compose.dev.yml up -d --build core-api frontend
docker exec vninvest-core-api python manage.py check
docker exec vninvest-core-api python manage.py showmigrations service_ops
```
