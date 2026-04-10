# Sprint 33 Handoff Note

Sprint 33 đã đạt trạng thái release-ready trên stack compose đã được kiểm chứng.

Điểm đã xác nhận:
- Backend, frontend, db, redis, celery beat đã chạy ổn trên stack thực tế.
- Auth flow quan trọng đã smoke pass:
  - sai mật khẩu -> 401
  - tài khoản chưa xác thực -> 401 với thông điệp đúng
  - resend verification -> 200 sau khi cấu hình mail fallback
- Email xác thực đã được gửi thật và capture trong Mailpit.
- Bug runtime `trim_streams` của Celery đã được fix và verify lại.

Điểm vận hành cần nhớ:
- Stack local/staging hiện dùng Mailpit + env fallback để đóng release gate.
- Khi deploy production public, cần thay Mailpit bằng SMTP hoặc mail account thật trong Admin.
- Nếu gặp backend restart loop với Postgres auth error trên volume cũ, ưu tiên đồng bộ password user `postgres` thay vì xóa volume.

Artifact chính để team dùng tiếp:
- `docs/SPRINT33_PRODUCTION_READINESS_20260410.md`
- `docs/SPRINT33_GO_LIVE_COMMAND_SHEET.md`
- `docs/SPRINT33_LIVE_EVIDENCE_TEMPLATE_20260410.md`
- `docs/SPRINT33_RELEASE_DAY_TIMELINE_20260410.md`
- `docs/SPRINT33_LOCAL_STACK_EXECUTION_EVIDENCE_20260410.md`

Khuyến nghị bước tiếp theo:
- DevOps: map mail transport thật cho production ngoài compose local.
- QA/PM: chạy walkthrough UI cuối cho `/settings`, WhaleAdvisory, login modal rồi ký sign-off.