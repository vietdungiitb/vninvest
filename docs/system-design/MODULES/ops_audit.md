# MODULES/ops_audit — Ops Audit

> Tin cậy tổng: ⚠. Ngày rà: 2026-10-14.

## 1. Mục đích + ranh giới

Nhật ký audit vận hành: event, trace request, rollup gọi API. Fail-closed theo
tenant (thiếu scope ⇒ `qs.none()`).

## 2. Models (3 — chi tiết ở `06.02`)

`ApiCallRollup`, `AuditEvent`, `RequestTrace` (cả 3 có tenant FK ✅).

## 3. API (6 route — chi tiết ở `07.02`)

`audit-log/*` + `partner/audit-logs` (4). Phân quyền tenant/operator.

## 4. Job/signal

Có `ops_audit/tasks.py` + 2 beat. Không có file signal riêng.

## 5. Finding mở

- F-OA-01 (⚠): `packages/core/backend/src/ops_audit/tests/test_audit_logs_api.py` tồn tại 1 bản trùng tên ở `packages/core/backend/tests/` — dossier làm rõ bản nào chạy trong gate.

## 6. Test khóa + trạng thái

1 test file (+ 1 bản trùng tên nêu trên).
