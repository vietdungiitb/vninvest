# Tech Spec: SaaS Native Remediation (2026-05-26)

## 1. Kiến trúc luồng Email Verification (Đã hoàn thiện)
- **Hiện trạng:** Token đã được hash SHA-256 (`views_auth.py:782`), model `EmailVerificationToken` đã tồn tại, có attempt count caching và rate limit IP resend đầy đủ. Logic backend đã đạt chuẩn.

## 2. Kiến trúc Outbox Pattern Reliability
- **Hiện trạng:** Celery Beat đã cấu hình chạy `data_ingest.tasks.process_outbox_events` mỗi 30 giây (`settings.py:325`).
- **Lỗ hổng (Gap):** Không có cơ chế DB locking.
- **Thiết kế mới:** Cập nhật `process_outbox_events` thêm `select_for_update(skip_locked=True)` khi fetch các OutboxEvent "PENDING".

## 3. API Routing Blocker (CRITICAL)
- **Hiện trạng:** View logic có nhưng URL routing bị thiếu, dẫn đến 404.
- **Thiết kế mới:** Cấu hình `urls.py` trỏ vào `views_operator.py` với endpoint base là `/core/v1/operator/mail-configs/`.

## 4. Web UI Shell Integration
- **Trang Đăng Ký:** Đã hoàn thiện `AuthRegisterPage.js`.
- **Trang SOC Mail Config (Thiết kế mới):**
  - Tích hợp 7 APIs adapter vào `/core/v1/operator/mail-configs/`.
  - Component `ShellMailConfigPage.js` không được hiển thị plain-text secret.
