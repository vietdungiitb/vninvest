# MODULES/advisory — Advisory

> Tin cậy tổng: ⚠ (pipeline đã trace ở `05.01` WF-03; quan hệ tenant chưa rõ).
> Ngày rà: 2026-10-14.

## 1. Mục đích + ranh giới

Pipeline khuyến nghị AI: 3 sub-agent + synthesis (`orchestrator.py:230`), điều khiển
qua 6 endpoint (status/refresh/refresh-info/latest/history/backtest —
`views.py:200-824`). Đọc snapshot thị trường, ghi `AdvisoryRecord`.

## 2. Models (6 — chi tiết ở `06.02`)

`AdvisoryRecord` (FK user nullable), `AdvisorySession` (FK user), `AdvisoryComponent`,
`SystemAISettings`, `UserAICredential`, `AIAuditLog` — 0/6 có tenant FK trực tiếp.
**Verdict F-ADVSR-02 (✅ ĐÃ XÁC MINH slice sysdesign-p11): ĐÚNG THIẾT KẾ, không
phải lỗi.** Quy tắc cách ly ghi ngay trong code (`advisory/models.py:240`:
"ISOLATION RULE: Chỉ dependency là User model" — BYOK per-user); mọi query lọc
`user=request.user` (12 chỗ trong `advisory/views.py`: `:159`, `:209`, `:251`, `:324`,
`:352`, `:592`, `:711`, `:758`, `:843`…); credential đọc theo user (`:416`,
`:494`); tenant resolve qua user (`:289` `_get_tenant`). Tenant kế thừa qua
user, không cần FK trực tiếp.

## 3. API (6 route — chi tiết ở `07.02`)

Đều `IsAuthenticated`. Luồng đầy đủ ở `05.01` WF-03.

## 4. Job/signal

Có `advisory/tasks.py` (`generate_advisory_task` ở `advisory/tasks.py:170`); không có file signal riêng.

## 5. Finding mở

- F-ADVSR-02 (✅ ĐÃ ĐÓNG slice sysdesign-p11): 0/6 tenant FK là đúng thiết kế
  (cách ly qua User — xem §2). Không mở lại trừ khi đổi mô hình BYOK.
- F-ADVSR-01 (✅ ĐÃ ĐÓNG slice sysdesign-p13 — GAP sai): `advisory` CÓ 15 test
  file ở `backend/tests/` (script cũ chỉ quét `src/` nên báo 0); chạy 2026-10-14
  trên Postgres local, chung 18 file: **170 tests OK**.

## 6. Test khóa + trạng thái

Không có. Dossier v1 — ưu tiên viết test đầu tiên cho `AdvisoryRefreshView`.
