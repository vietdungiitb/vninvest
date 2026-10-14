# MODULES/tenant_lifecycle — Tenant Lifecycle

> Tin cậy tổng: ✅ cấu trúc (đo trực tiếp 2026-10-14). Ngày rà: 2026-10-14.

## 1. Mục đích + ranh giới

Vòng đời tenant chạy bằng signals/tasks, **không có HTTP API** (đo được: không có
`urls.py`/`views.py`, vẫn trong `INSTALLED_APPS`). Ranh giới với
`identity_access` (tạo tenant) và `vninvest_core` (operator tenants API).

## 2. Models (1 — chi tiết ở `06.02`)

`TenantLifecycleEvent` (có tenant FK ✅).

## 3. API (0 route — đo được, không phải sót trích)

## 4. Job/signal

Có `tenant_lifecycle/tasks.py` + `tenant_lifecycle/signals.py` + 4 beat.

## 5. Finding mở

Không có finding cấu trúc. Nội dung signal/task rà ở dossier sâu.

## 6. Test khóa + trạng thái

3 test file trong `tenant_lifecycle/tests/` (`test_models.py`, `test_signals.py` và `packages/core/backend/src/tenant_lifecycle/tests/test_tasks.py` — tên đọc từ đĩa 2026-10-14).
