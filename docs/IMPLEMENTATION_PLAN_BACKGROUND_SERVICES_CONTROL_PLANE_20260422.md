# IMPLEMENTATION PLAN: Background Services Control Plane

**Ngày tạo**: 2026-04-22  
**Phạm vi chương trình**: Background Services Control Plane  
**Level**: A (Major — scheduler/background jobs, Redis lease, DB schema, admin workflow)  
**Owner**: Backend Lead  
**Reviewer**: Project Lead  
**Trạng thái**: READY FOR REVIEW / ĐỢI PHÊ DUYỆT

---

## 1. Business Objective

### Vấn đề cần giải quyết

Hệ thống hiện có nhiều dịch vụ chạy nền phân tán qua Celery/Beat nhưng chưa có một control plane thống nhất để:
1. Nhận diện job nào đang chạy thật, job nào đã stalled/zombie.
2. Phát hiện worker đang chạy lệch phiên bản release/config.
3. Ngăn chạy chồng cùng phạm vi dữ liệu.
4. Chạy lại an toàn mà không ghi đè dữ liệu ngoài policy.
5. Truy vết đầy đủ ai chạy, lý do gì, ghi bao nhiêu dòng, tác động dữ liệu ra sao.

### KPI kỳ vọng sau khi triển khai

| Chỉ số | Hiện trạng | Mục tiêu |
|---|---|---|
| Phát hiện stalled run | Không thống nhất | < 2 phút |
| Chạy chồng cùng scope | Có thể xảy ra | 0 ngoài policy |
| Run có metadata version | Không thống nhất | 100% |
| Run có write mode rõ ràng | Không thống nhất | 100% cho job mutation |
| Audit thao tác điều hành | Rời rạc | 100% run/stop/retry/pause |

---

## 2. Scope và Non-Scope

### In-Scope
1. Service registry cho toàn bộ dịch vụ nền quan trọng.
2. Run ledger + event timeline + heartbeat.
3. API điều hành chung: run/stop/retry/pause/resume/active-runs/detail.
4. Lease lock, idempotency, overlap policy, write mode governance.
5. UI điều hành nội bộ cho admin/staff.
6. Metric, alert, runbook và handoff cho team code.

### Out-of-Scope
1. Viết lại toàn bộ business logic bên trong từng task hiện hữu.
2. Chuyển mọi Celery task cũ sang generic runner trong một lần.
3. Refactor toàn bộ frontend Admin Ops ngoài phần điều hành service nền.

---

## 3. Current-State Assessment

1. Runtime đã có Django + Celery + Redis + PostgreSQL.
2. Có nhiều task rải trong `backend/portfolio/tasks_*.py` nhưng thiếu registry chuẩn hóa.
3. Một số luồng, như backfill IntradayTick.side, đã có status cache theo `task_id`, nhưng chưa có:
- run ledger bất biến,
- heartbeat chuẩn hóa,
- version drift tracking,
- overlap lock theo scope,
- write mode governance.
4. Admin APIs hiện hữu tại `backend/portfolio/views_admin_*.py` nhưng mới theo từng nghiệp vụ riêng lẻ.
5. Frontend có JWT client sẵn, phù hợp để cắm thêm màn hình điều phối.

### Constraint
1. Phải bám kiến trúc hiện hữu, không mở thêm scheduler song song ngoài Celery/Beat.
2. Phải tương thích rollout tăng dần, không phá workflow task cũ.
3. Phải ưu tiên an toàn dữ liệu trước tốc độ onboard hết mọi service.

---

## 4. Target Design

### Thành phần đích
1. `ServiceDefinition` / `ServiceExecutionPolicy` / `ServiceRun` / `ServiceRunEvent` / `ServiceSchedule`.
2. Generic orchestration layer dùng chung cho mọi service nền.
3. Redis lease/heartbeat/idempotency/stop-flag control keys.
4. Admin API service-agnostic.
5. Hệ metric và alert với prefix `vninvest_background_*` hoặc `vninvest_service_*`.

### Luồng chính
1. Admin hoặc scheduler tạo run request.
2. Control plane kiểm tra permission, overlap policy, idempotency, off-peak, write mode.
3. Nếu hợp lệ: tạo `ServiceRun`, cấp lease Redis, enqueue Celery task.
4. Worker cập nhật heartbeat, progress, event timeline.
5. Khi xong: release lease, ghi terminal state và mutation summary.

---

## 5. Execution Phases

### Phase 0 — Foundation + Schema
1. Thêm schema models và migration.
2. Tạo service registry seed cho nhóm service ưu tiên.
3. Tạo helper Redis key + lease manager + heartbeat manager.

**Files dự kiến**:
- `backend/portfolio/models.py`
- `backend/portfolio/migrations/*`
- `backend/portfolio/services_service_control.py` (mới)
- `backend/portfolio/service_registry.py` (mới)

**Rollback**:
- Giữ feature flag `BACKGROUND_CONTROL_PLANE_ENABLED=False`.
- Migration additive only, không xóa schema cũ.

### Phase 1 — Generic Run Ledger + Admin API nền
1. Tạo API list services, active runs, run detail.
2. Tạo run request/stop request/retry request chuẩn.
3. Ghi audit log và run events.

### Phase 2 — Worker Integration Pilot
1. Onboard pilot services:
- `intraday_side_backfill`
- `stock_profile_sync`
- một prefetch job đại diện
2. Thêm metadata `release_sha`, `image_tag`, `worker_hostname`, `config_fingerprint`.
3. Bật stalled detection + version drift alert.

### Phase 3 — Write Mode Governance
1. Gán write mode mặc định cho từng service mutation.
2. Bắt buộc preview/dry-run cho nhóm `reconcile` và `force_overwrite`.
3. Thêm manual lock support nếu data model cho phép.

### Phase 4 — Frontend Ops UI
1. Màn hình service registry.
2. Màn hình active runs.
3. Drawer run detail + events + drift + mutation summary.
4. Nút run/stop/retry/pause/resume với i18n tiếng Việt.

### Phase 5 — Hardening + Rollout
1. Canary theo nhóm service non-critical.
2. Tinh chỉnh alert thresholds.
3. Soak test 24-48h.
4. Chốt handoff evidence.

---

## 6. API and Data Contract Changes

### API mới
1. `GET /api/v1/admin-ops/services/`
2. `GET /api/v1/admin-ops/runs/active/`
3. `GET /api/v1/admin-ops/runs/{run_id}/`
4. `POST /api/v1/admin-ops/services/{service_code}/run/`
5. `POST /api/v1/admin-ops/runs/{run_id}/stop/`
6. `POST /api/v1/admin-ops/runs/{run_id}/retry/`
7. `POST /api/v1/admin-ops/services/{service_code}/pause/`
8. `POST /api/v1/admin-ops/services/{service_code}/resume/`

### Schema additive
1. `ServiceDefinition`
2. `ServiceExecutionPolicy`
3. `ServiceRun`
4. `ServiceRunEvent`
5. `ServiceSchedule`

### Backward compatibility
1. Các endpoint admin cũ vẫn giữ trong giai đoạn migrate.
2. Task cũ được wrap dần, không cắt đột ngột.

---

## 7. Scheduling and Operations

1. Timezone lưu DB: UTC.
2. Hiển thị UI: `Asia/Ho_Chi_Minh`.
3. Lock key chuẩn: `lock:{service_code}:{scope_hash}`.
4. Stop flag chuẩn: `service:run:{run_id}:stop_requested`.
5. Heartbeat key chuẩn: `service:run:{run_id}:heartbeat`.
6. Idempotency key scope: `service_code + scope_hash + idempotency_key`.
7. Misfire policy được khai báo theo `ServiceExecutionPolicy`.

---

## 8. Testing and Verification

1. Unit tests
- models, serializers, lease manager, idempotency manager, state transition guard.

2. Integration tests
- API -> DB -> Celery -> Redis -> run ledger.
- Worker thật trên queue test để verify lifecycle full.

3. Pilot verification
- `intraday_side_backfill`: run/stop/status/drift.
- `stock_profile_sync`: run complete + mutation summary.

4. Exit criteria
- Không còn overlap ngoài policy trên staging.
- Stalled detection hoạt động.
- Drift detection có alert thực tế.

---

## 9. Observability and Alerting

1. Metrics tối thiểu
- `vninvest_service_runs_total`
- `vninvest_service_run_duration_seconds`
- `vninvest_service_queue_latency_seconds`
- `vninvest_service_stalled_total`
- `vninvest_service_version_drift_total`
- `vninvest_service_mutation_rows_total`

2. Alert tối thiểu
- `service_stalled`
- `service_version_drift_detected`
- `service_lock_contention_abnormal`
- `service_success_rate_drop`
- `service_force_overwrite_invoked`

---

## 10. Security and Governance

1. Permission extension
- `IsServiceControlAdmin`
- `IsServiceControlOperator`
- `IsServiceControlViewer`

2. Audit trail bắt buộc
- actor, action, reason, request_id, write_mode, target run/service.

3. Secrets/config
- `release_sha`, `image_tag`, queue name và feature flags lấy từ config/runtime env.

---

## 11. Release Plan

1. Canary phase 1: chỉ pilot services non-critical.
2. Canary phase 2: mở thêm prefetch/sync jobs.
3. Production rollout theo feature flag.
4. Backout plan:
- tắt feature flag,
- ngừng route vào control plane mới,
- giữ run ledger để audit,
- trả flow về admin cũ nếu có.

---

## 12. Ownership and Timeline

| Workstream | Owner | Reviewer | Ước lượng |
|---|---|---|---:|
| Schema + Redis control | Backend Lead | Project Lead | 2 ngày |
| API layer | Backend Lead | Project Lead | 2 ngày |
| Pilot service integration | Backend Lead | Domain Owner | 3 ngày |
| Frontend ops UI | Frontend Lead | Project Lead | 3 ngày |
| Hardening + rollout | Backend + Ops | Project Lead | 2 ngày |

---

## 13. SSOT Integration Map (Mandatory)

1. `vnbroker adapter`
- canonical adapter cho provider access và rate-limit handling.

2. `ai advisory`
- background advisory jobs phải đi qua service registry, không mở pipeline song song.

3. `whale alert` / `darkmoney flow`
- các task generation/broadcast/persistence phải được gắn `service_code` và run ledger.

4. `market data`
- các job prefetch/sync/backfill mutation phải khai báo write mode và mutation summary.

---

## 14. MDSU Compliance Map (Mandatory vì có market data)

1. Các service đụng market data phải map rõ:
- source canonical,
- phạm vi dữ liệu,
- write mode,
- cache key,
- retention.

2. Không cho phép job mới truy vấn/ghi dữ liệu theo luồng song song ngoài SSOT domain đã chốt.

3. Pilot cần ưu tiên:
- `intraday_side_backfill`
- `tasks_prefetch`
- `tasks_stock_profile_sync`

---

## 15. Definition of Ready

1. Chốt danh sách pilot services.
2. Chốt role mapping permission.
3. Chốt write mode mặc định theo service.
4. Chốt Redis/DB schema additive.
5. Chốt alert recipients và threshold ban đầu.

---

## 16. Definition of Done

1. Triad + walkthrough + runbook + go/no-go đã có file vật lý trong `docs/`.
2. Có test evidence cho lifecycle run pilot.
3. Có KPI baseline và alert config draft.
4. Có audit ledger và progress dashboard cập nhật đầy đủ.
5. Team code có thể bắt đầu implementation mà không cần hỏi lại kiến trúc lõi.