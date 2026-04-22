# TASKBOARD: Background Services Control Plane

**Ngày tạo**: 2026-04-22  
**Trạng thái tổng**: 🔲 PENDING APPROVAL

---

## Tóm tắt tiến độ

| Phase | Trạng thái | Tasks | Done |
|---|---|:---:|:---:|
| Phase 0 — Schema + Registry | 🔲 Chưa bắt đầu | 7 | 0 |
| Phase 1 — Core API + Ledger | 🔲 Chưa bắt đầu | 8 | 0 |
| Phase 2 — Pilot Integration | 🔲 Chưa bắt đầu | 9 | 0 |
| Phase 3 — Write Governance | 🔲 Chưa bắt đầu | 6 | 0 |
| Phase 4 — Frontend Ops UI | 🔲 Chưa bắt đầu | 7 | 0 |
| Phase 5 — Hardening + Handoff | 🔲 Chưa bắt đầu | 8 | 0 |

---

## Phase 0 — Schema + Registry

| ID | Task | File | Loại | Trạng thái |
|---|---|---|:---:|:---:|
| P0-01 | Thêm models `ServiceDefinition`, `ServiceExecutionPolicy`, `ServiceRun`, `ServiceRunEvent`, `ServiceSchedule` | `backend/portfolio/models.py` | MODIFIED | 🔲 |
| P0-02 | Tạo migration additive ban đầu | `backend/portfolio/migrations/*` | NEW | 🔲 |
| P0-03 | Tạo registry module + seed pilot services | `backend/portfolio/service_registry.py` | NEW | 🔲 |
| P0-04 | Tạo helper Redis key contract | `backend/portfolio/services_service_control.py` | NEW | 🔲 |
| P0-05 | Viết unit test cho model/state defaults | `backend/portfolio/tests/test_service_control_models.py` | NEW | 🔲 |
| P0-06 | Viết unit test cho registry load/seed | `backend/portfolio/tests/test_service_registry.py` | NEW | 🔲 |
| P0-07 | Chạy migration + test unit phase 0 | N/A | VERIFY | 🔲 |

---

## Phase 1 — Core API + Run Ledger

| ID | Task | File | Loại | Trạng thái |
|---|---|---|:---:|:---:|
| P1-01 | Tạo serializers service/run/event | `backend/portfolio/serializers.py` | MODIFIED | 🔲 |
| P1-02 | Tạo admin service control views | `backend/portfolio/views_admin_service_control.py` | NEW | 🔲 |
| P1-03 | Đăng ký URL `/api/v1/admin-ops/services/*` | `backend/config/urls.py` hoặc router tương ứng | MODIFIED | 🔲 |
| P1-04 | Implement create run + stop + retry + active runs | `views_admin_service_control.py` | NEW | 🔲 |
| P1-05 | Implement audit logging + run events | `backend/portfolio/services_service_control.py` | NEW | 🔲 |
| P1-06 | Viết API contract tests | `backend/portfolio/tests/test_service_control_api.py` | NEW | 🔲 |
| P1-07 | Viết overlap/idempotency tests | `backend/portfolio/tests/test_service_control_guards.py` | NEW | 🔲 |
| P1-08 | Verify full API phase 1 | N/A | VERIFY | 🔲 |

---

## Phase 2 — Pilot Integration

| ID | Task | File | Service | Loại | Trạng thái |
|---|---|---|---|:---:|:---:|
| P2-01 | Wrap `intraday_side_backfill` với run ledger + heartbeat | `tasks_maintenance.py`, `views_admin_runtime.py` | backfill | MODIFIED | 🔲 |
| P2-02 | Thêm `release_sha`, `image_tag`, `worker_hostname` vào payload/status | `tasks_maintenance.py` | backfill | MODIFIED | 🔲 |
| P2-03 | Wrap `tasks_stock_profile_sync.py` vào service registry | module tương ứng | sync | MODIFIED | 🔲 |
| P2-04 | Chọn 1 prefetch job làm pilot thứ ba | `tasks_prefetch.py` | prefetch | MODIFIED | 🔲 |
| P2-05 | Implement stalled detection monitor | `tasks_service_control.py` | shared | NEW | 🔲 |
| P2-06 | Implement version drift detector | `services_service_control.py` | shared | NEW | 🔲 |
| P2-07 | Viết integration tests với Celery worker thật | `backend/portfolio/tests/test_service_control_integration.py` | shared | NEW | 🔲 |
| P2-08 | Verify run lifecycle: queue -> run -> success/failed/stop | N/A | shared | VERIFY | 🔲 |
| P2-09 | Verify drift/stalled alerts phase 2 | N/A | shared | VERIFY | 🔲 |

---

## Phase 3 — Write Governance

| ID | Task | File | Loại | Trạng thái |
|---|---|---|:---:|:---:|
| P3-01 | Thêm `write_mode` vào policy và run API | backend control modules | MODIFIED | 🔲 |
| P3-02 | Gán write mode mặc định cho pilot services | registry seed | MODIFIED | 🔲 |
| P3-03 | Bổ sung preview/dry-run gate cho `reconcile` | backend control modules | MODIFIED | 🔲 |
| P3-04 | Bổ sung mutation summary schema | `models.py`, services | MODIFIED | 🔲 |
| P3-05 | Viết tests cho fill_missing/reconcile/force_overwrite policies | tests | NEW | 🔲 |
| P3-06 | Verify mutation safety on pilot services | N/A | VERIFY | 🔲 |

---

## Phase 4 — Frontend Ops UI

| ID | Task | File | Loại | Trạng thái |
|---|---|---|:---:|:---:|
| P4-01 | Tạo page `AdminServiceControl` | frontend admin page | NEW | 🔲 |
| P4-02 | Thêm API client methods | `frontend/src/api/client.js` | MODIFIED | 🔲 |
| P4-03 | Tạo bảng service registry | frontend admin page | MODIFIED | 🔲 |
| P4-04 | Tạo panel active runs | frontend admin page | MODIFIED | 🔲 |
| P4-05 | Tạo run detail drawer + timeline | frontend admin page | MODIFIED | 🔲 |
| P4-06 | Thêm i18n tiếng Việt đầy đủ | `frontend/src/i18n/vi.js` | MODIFIED | 🔲 |
| P4-07 | Smoke test UI polling/stop/retry | N/A | VERIFY | 🔲 |

---

## Phase 5 — Hardening + Handoff

| ID | Task | File | Loại | Trạng thái |
|---|---|---|:---:|:---:|
| P5-01 | Thêm metric Prometheus chính thức | `backend/portfolio/observability.py` | MODIFIED | 🔲 |
| P5-02 | Draft alert rules | monitoring repo / docs | DOCS | 🔲 |
| P5-03 | Rehearse runbook stalled/overlap/drift | N/A | VERIFY | 🔲 |
| P5-04 | Canary pilot trên staging | N/A | VERIFY | 🔲 |
| P5-05 | Soak 24-48h và đo KPI | N/A | VERIFY | 🔲 |
| P5-06 | Cập nhật audit ledger | `docs/CODE_CHANGE_AUDIT_LEDGER.md` | MODIFIED | 🔲 |
| P5-07 | Cập nhật progress dashboard | `PROGRESS_DASHBOARD.md` | MODIFIED | 🔲 |
| P5-08 | Chốt walkthrough handoff final | `docs/WALKTHROUGH_BACKGROUND_SERVICES_CONTROL_PLANE_20260422.md` | MODIFIED | 🔲 |

---

## Release Gate Tổng Thể

| Gate | Điều kiện | Đạt chưa |
|---|---|:---:|
| G1 | Schema additive + migration PASS | 🔲 |
| G2 | API contract tests PASS | 🔲 |
| G3 | Pilot service lifecycle PASS | 🔲 |
| G4 | Stalled detection hoạt động | 🔲 |
| G5 | Version drift detection hoạt động | 🔲 |
| G6 | Write mode governance verified | 🔲 |
| G7 | UI active runs + run detail stable | 🔲 |
| G8 | Runbook rehearsal hoàn tất | 🔲 |
