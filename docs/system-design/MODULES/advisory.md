# MODULES/advisory — Advisory

> Tin cậy tổng: ⚠ (pipeline đã trace ở `05.01` WF-03; quan hệ tenant chưa rõ).
> Ngày rà: 2026-10-14.

## 1. Mục đích + ranh giới

Pipeline khuyến nghị AI: 3 sub-agent + synthesis (`orchestrator.py:230`), điều khiển
qua 6 endpoint (status/refresh/refresh-info/latest/history/backtest —
`views.py:200-824`). Đọc snapshot thị trường, ghi `AdvisoryRecord`.

## 2. Models (6 — chi tiết ở `06.02`)

`AdvisoryRecord`, `AdvisorySession`, `AdvisoryComponent`, `SystemAISettings`,
`UserAICredential`, `AIAuditLog` — **0/6 có tenant FK trực tiếp** (❓ finding
candidate: bản ghi theo user hay tenant? Cách ly qua bảng cha hay thiếu scope?
Chưa verdict — cần đọc quan hệ FK).

## 3. API (6 route — chi tiết ở `07.02`)

Đều `IsAuthenticated`. Luồng đầy đủ ở `05.01` WF-03.

## 4. Job/signal

Có `advisory/tasks.py` (`generate_advisory_task` ở `advisory/tasks.py:170`); không có file signal riêng.

## 5. Finding mở

- F-ADVSR-01 (⚠ GAP): **0 test file** (đo được ở `04.01`) — pipeline 3-agent
  không có test khóa nào.
- F-ADVSR-02 (❓): 0/6 model có tenant FK trực tiếp — xác minh cách ly tenant.

## 6. Test khóa + trạng thái

Không có. Dossier v1 — ưu tiên viết test đầu tiên cho `AdvisoryRefreshView`.
