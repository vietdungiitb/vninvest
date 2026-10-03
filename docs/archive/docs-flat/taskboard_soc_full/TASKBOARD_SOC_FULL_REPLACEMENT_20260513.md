# SOC Full Replacement — Taskboard
**Ngày**: 2026-05-13  
**Status**: Active  
**Parent**: `docs/IMPLEMENTATION_PLAN_SOC_FULL_REPLACEMENT_20260513.md`

---

## Trạng thái tổng quan

| Task | Tên | Status | Assignee | Commit |
|------|-----|--------|----------|--------|
| T01 | service_ops app + 6 core models | ✅ DONE | Copilot | working tree |
| T02 | Domain config typed schemas | ✅ DONE | Copilot | working tree |
| T03 | ServiceOwnershipMatrix | ✅ DONE | Copilot | working tree |
| T04 | Serializers + Base Views + URLs | ✅ DONE | Copilot | working tree |
| T05 | Domain Views (4 domains) | ✅ DONE | Copilot | working tree |
| T06 | ScrapeMatrix + MatrixCoordinator | ✅ DONE | Copilot | working tree |
| T07 | Frontend 6 base components + i18n | ✅ DONE | Copilot | working tree |
| T08 | SOC Page + Domain Panels + Route | ✅ DONE | Copilot | working tree |
| T09 | Backend Tests | ✅ DONE | Copilot | working tree |
| T10 | Docker Build + Final Audit | 🔄 IN PROGRESS | Copilot | working tree |

**Legend**: ⬜ NOT STARTED | 🔄 IN PROGRESS | ✅ DONE | ❌ BLOCKED

---

## T01 — service_ops app + 6 Core Models

**Status**: ✅ DONE  
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

**Status**: ✅ DONE  
**Dependency**: T01 (models tồn tại)  
**Estimate**: 2–3 giờ

### Checklist
- [x] `domain_configs/__init__.py` exports tất cả 4 classes
- [x] `domain_configs/vnbroker.py` — VnbrokerTimeoutConfig + VnbrokerDomainConfig với validate() + from_dict()
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

**Status**: ✅ DONE  
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

**Status**: ✅ DONE  
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

**Status**: ✅ DONE  
**Dependency**: T04  
**Estimate**: 5–6 giờ

### Checklist
- [ ] `views/mixins.py` — ConfigApplyMixin với apply_config() flow
- [x] `views/vnbroker.py` — 7 views: Config, ConfigApply, ConfigPreview, Health, TestConnection, Providers, Ownership
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

**Status**: ✅ DONE  
**Dependency**: T05  
**Estimate**: 4–5 giờ

### Checklist
- [x] `models_matrix.py` — ScrapeMatrix + ScrapeMatrixCell với đầy đủ fields theo TECH_SPEC
- [x] Migration 0002_scrape_matrix chạy OK
- [x] `matrix_coordinator.py` — MatrixCoordinator class với create_cycle, try_claim_cell (select_for_update), mark_cell_done (skip pending peers), mark_cell_failed, get_cycle_summary
- [x] `tasks.py` — health_check_all_services, run_scrape_cycle, scrape_cell_task
- [x] `views/matrix.py` — 7 views: CycleList, CycleDetail, CycleStart, CellList, CycleAbort, Providers, Monitor
- [x] try_claim_cell atomic (không race condition khi 2 workers claim cùng cell)
- [x] mark_cell_done tự skip pending cells cùng row
- [x] ScrapeMatrix.progress_pct property tính đúng

### Validation Command
```powershell
../.venv/Scripts/python.exe manage.py migrate service_ops
../.venv/Scripts/python.exe -c "
from vninvest_core.service_ops.matrix_coordinator import MatrixCoordinator
c = MatrixCoordinator('test_cycle', ['vci', 'kbs'])
m = c.create_cycle(['G1', 'G2'])
print('Cells:', m.cells.count())  # Should be 4 (2 groups × 2 providers)
"
docker exec vninvest-dev-core-api python /app/src/manage.py test service_ops.tests.test_soc_matrix service_ops.tests.test_soc_tasks --keepdb
```

---

## T07 — Frontend Base Components + i18n

**Status**: ✅ DONE  
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

**Status**: ✅ DONE  
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

**Status**: ✅ DONE  
**Dependency**: T08 (tất cả backend code đã có)  
**Estimate**: 4–5 giờ

### Checklist
- [x] `tests/test_soc_models.py` — lifecycle tests cho current SOC models
- [x] `tests/test_soc_domain_configs.py` — validate() tests cho 4 dataclasses
- [x] `tests/test_soc_ownership.py` — ownership matrix tests
- [x] `tests/test_soc_api_overview.py` — overview endpoints tests (200/401/404)
- [x] `tests/test_soc_api_domain.py` — vnbroker/prefetch/screener domain tests
- [x] `tests/test_soc_api_signals.py` — signals ownership, bridge-write behavior, task-backed jobs/materialization
- [x] `tests/test_soc_matrix.py` — MatrixCoordinator, atomic claim, row dedup
- [x] `tests/test_soc_tasks.py` — health check + tracked Signals workflow tasks
- [ ] Coverage ≥ 80% cho service_ops app

### Validation Command
```powershell
cd backend
../.venv/Scripts/python.exe -m pytest packages/core/backend/tests/test_soc_*.py -v --cov=vninvest_core.service_ops --cov-report=term-missing
```

---

## T10 — Docker Build + Final Audit

**Status**: 🔄 IN PROGRESS  
**Dependency**: T09  
**Estimate**: 1–2 giờ

### Checklist
- [x] docker compose -f docker-compose.dev.yml up -d --build core-api → success
- [x] docker compose -f docker-compose.dev.yml up -d --build frontend → success
- [ ] python manage.py migrate → no conflicts
- [x] Smoke: GET /api/soc/overview/ → 200 hoặc 401 (đúng auth behavior)
- [x] Smoke: Browser /operations-center → SOCPage loads
- [x] CODE_CHANGE_AUDIT_LEDGER.md updated với đầy đủ entries T01–T09
- [x] PROGRESS_DASHBOARD.md updated
- [x] module_tree_full.md regenerated
- [ ] All changes committed và pushed to dev branch

### Validation Command
```powershell
docker compose -f docker-compose.dev.yml up -d --build core-api frontend
docker exec vninvest-core-api python manage.py check
docker exec vninvest-core-api python manage.py showmigrations service_ops
```

### Current Evidence Snapshot
- `docker compose --env-file compose.dev.env -p vninvest-dev -f docker-compose.yml -f docker-compose.dev.yml up -d --build --force-recreate frontend core-api core-worker core-worker-manual core-worker-realtime-stream core-worker-analytics core-worker-enrichment core-worker-realtime-prefetch core-beat`
- `docker compose ... ps frontend core-api ...` showed `core-api` healthy, `frontend` up, workers up, and `core-beat` still `health: starting` at capture time
- `docker compose ... exec -T core-api python /app/src/manage.py check` returned `System check identified no issues (0 silenced).`
- `docker compose ... exec -T core-api python /app/src/manage.py showmigrations service_ops` showed `0001_initial` and `0002_add_scrape_matrix_models` both applied
- `Invoke-WebRequest http://127.0.0.1:8001/api/soc/overview/ -SkipHttpErrorCheck` returned `401` with the standard SOC auth envelope, which matches expected unauthenticated behavior
- Integrated browser smoke at `/operations-center?tab=signals` rendered the SOC page heading, all 6 tabs (`Tổng quan`, `Tín hiệu`, `DataOps`, `Prefetch`, `Screener`, `Ma trận`), and the Signals panel shell; screenshot captured in-session
- `Set-Location "C:\Mujoco Projects\vninvest\frontend"; $env:CI='true'; npm test -- --watch=false --runTestsByPath src/components/soc/SOCComponents.test.jsx src/pages/SOCPage.test.jsx src/App.test.jsx` passed (`12` tests) and locked REQ-32..40, including direct `/operations-center` render plus legacy `/admin-ops` alias redirect
- `C:\Mujoco Projects\vninvest\.venv\Scripts\python.exe scripts\ops\generate_module_tree.py` regenerated `module_tree_full.md` to `1166` modules after adding `frontend/src/App.test.jsx`
- `docker compose --env-file compose.dev.env -p vninvest-dev -f docker-compose.yml -f docker-compose.dev.yml up -d --build --force-recreate frontend`
- `docker compose ... ps frontend` showed `frontend` up on port `80` after the alias-route rebuild
