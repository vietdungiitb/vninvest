# Self-Audit & Test Protocol (2026-05-26)

## 1. Backend Checks
- [ ] Lệnh test: `python -m pytest packages\core\backend\src\identity_access\tests\ -v --keepdb` (Đạt 100% PASS).
- [ ] Xác minh Celery Beat: Log celery worker in ra task `process_outbox_events` mỗi **30 giây**.
- [ ] Xác minh URL Routing: Chạy `Invoke-WebRequest -Uri "http://localhost:8000/core/v1/operator/mail-configs/" -Method Get -SkipHttpErrorCheck` nhận status 200/401 thay vì 404.
- [ ] Xác minh HTTP 403: Endpoint operator phải trả về 403 nếu user không có quyền Admin.
- [ ] Xác minh Idempotency: Tạo 2 concurrent requests tới cùng 1 outbox event, đảm bảo chỉ có 1 request được update thành công và 1 request bị drop.

## 2. Frontend Checks
- [ ] Không import file từ legacy `frontend/`.
- [ ] Giao diện form Mail Config (GET `/core/v1/operator/mail-configs/`) không chứa plaintext secret.
- [ ] pageRegistry.js: Phải nạp động component `ShellMailConfigPage` thành công thông qua `createDeferredPageComponent`.
