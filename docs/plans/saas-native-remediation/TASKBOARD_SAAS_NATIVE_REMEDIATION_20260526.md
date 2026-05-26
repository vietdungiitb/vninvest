# Taskboard: SaaS Native Remediation (2026-05-26)

## 1. Backend Core API (packages/core)
- [x] BE-1.1.1: Tạo Data model lưu trữ Token hash (`EmailVerificationToken`). (DONE)
- [x] BE-1.1.2: Refactor API sinh token (Hash SHA-256). (DONE)
- [x] BE-1.1.3: Refactor API verify token (attempt count lock). (DONE)
- [x] BE-1.1.4: Refactor API resend token (rate limit). (DONE)
- [x] BE-1.2.3: Thêm entry Celery Beat (30s) trong settings.py. (DONE)
- [ ] BE-1.2.4: Bổ sung cơ chế locking `select_for_update(skip_locked=True)` vào `data_ingest.tasks.process_outbox_events`.
- [ ] BE-1.3.1 (CRITICAL): Khai báo URL routing cho `views_operator.py` vào `urls.py` với base path `/core/v1/operator/mail-configs/`.

## 2. Web Frontend (packages/web)
- [x] FE-2.2.1 -> FE-2.2.4: Trang AuthRegisterPage và các bẫy spam. (DONE)
- [ ] FE-2.1.1: Bổ sung 7 phương thức vào `coreApiAdapter.js`.
- [ ] FE-2.1.2: Bổ sung route `/operations-center/mail-config` vào `routeCatalog.js`.
- [ ] FE-2.1.3: Khai báo trang trong `pageRegistry.js`.
- [ ] FE-2.3.1 -> FE-2.3.5: Phát triển giao diện `ShellMailConfigPage.js` và liên kết với Operations Center.
