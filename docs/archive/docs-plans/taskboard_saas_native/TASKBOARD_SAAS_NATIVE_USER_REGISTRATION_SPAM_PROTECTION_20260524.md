# TASKBOARD & SLICES CHECKLIST: Nâng cấp Đăng ký Người dùng SaaS Native OpenAPI kèm Chống Spam
**Mã tài liệu**: `TASKBOARD_SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_20260524`  
**Ngày phát hành**: 24-05-2026  
**Trạng thái**: BAN HÀNH CHÍNH THỨC  
**Phạm vi**: Backend API Service (`packages/core`) & Web Frontend (`packages/web`)  

---

## BẢNG THEO DÕI TIẾN ĐỘ & ĐỊNH NGHĨA HOÀN THÀNH (DoD PER SLICE)

Đội ngũ phát triển bắt buộc triển khai tuần tự theo 6 lát cắt (Slices) dưới đây. Một Slice chỉ được coi là HOÀN THÀNH (`[x]`) khi đáp ứng đầy đủ định nghĩa hoàn thành (DoD) ở tất cả 5 cột.

### ── SLICE 1: Cấu hình DB & Hệ thống ──────────────────────────────────────────
- `[ ]` **CODE**:
  - Định nghĩa model `SystemMailConfig` trong `identity_access/models.py` hỗ trợ SMTP và Google API credentials.
  - Định nghĩa model `OutboxEvent` và `ProcessedEvent` cho Transactional Outbox.
  - Áp dụng ràng buộc ở mức cơ sở dữ liệu `models.UniqueConstraint` cho `is_active=True` (Partial Unique Index) trong Meta của `SystemMailConfig`.
  - Khởi tạo file migration: `python manage.py makemigrations` và chạy `python manage.py migrate`.
- `[ ]` **TEST**:
  - Chạy migrate thành công trên PostgreSQL/SQLite mà không có lỗi tương thích.
  - Viết test ORM cơ bản để đảm bảo các model truy vấn bình thường.
- `[ ]` **AUDIT**:
  - Xác minh rằng: Cố gắng lưu 2 bản ghi `SystemMailConfig` cùng có `is_active=True` sẽ lập tức bị chặn ở mức database và quăng ra lỗi `django.db.utils.IntegrityError`.
- `[ ]` **DOC-SYNC**:
  - Cập nhật thông tin schema mới vào mục `1. THIẾT KẾ MÔ HÌNH DỮ LIỆU CHI TIẾT` của [TECH_SPEC_SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_20260524.md](file:///c:/Mujoco%20Projects/vninvest/docs/plans/TECH_SPEC_SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_20260524.md).
- `[ ]` **COMMIT/PUSH**:
  - Nhánh: `feature/saas-register-up-db`
  - Commit message: `feat(auth): add SystemMailConfig and OutboxEvent DB schemas with partial unique constraints`

### ── SLICE 2: Bộ lọc Spam & Serializer ──────────────────────────────────────────
- `[ ]` **CODE**:
  - Cấu hình danh sách chặn `BLOCKED_DISPOSABLE_DOMAINS` dạng Python **`set`** trong `settings.py`.
  - Thiết lập kiểm tra strict mode cho Turnstile key tại AppConfig (`apps.py`) để chỉ fail-fast ở web server thread, bỏ qua khi chạy command line tools (`migrate`, `shell`, `test`, `collectstatic`).
  - Viết lớp `SaaSRegisterSerializer` kế thừa từ `serializers.Serializer` tích hợp:
    - Bẫy Honeypot (trường `website` bắt buộc trống).
    - Bộ lọc email tạm thời (truy xuất nhanh `O(1)` qua `set`).
    - API Call kiểm chứng token Cloudflare Turnstile.
    - So khớp mật khẩu trùng khớp và xác thực độ mạnh qua `validate_password` của Django.
- `[ ]` **TEST**:
  - Viết unit test xác thực độc lập các hàm validate:
    - Nhập honeypot `website` -> ném `ValidationError`.
    - Dùng email rác (`@mailinator.com`) -> ném `ValidationError`.
    - Mock API Turnstile thành công / thất bại và kiểm tra mã trả về.
- `[ ]` **AUDIT**:
  - Kiểm thử bypass Turnstile trong môi trường local (`DEBUG=True` mà không có Turnstile key) đảm bảo chỉ ghi log cảnh báo kèm `request_id`, không làm crash luồng đăng ký của dev.
- `[ ]` **DOC-SYNC**:
  - Đồng bộ các mã lỗi Turnstile và Email rác vào mục đặc tả lỗi OpenAPI.
- `[ ]` **COMMIT/PUSH**:
  - Nhánh: `feature/saas-register-up-spam`
  - Commit message: `feat(auth): implement 3-layer spam shield validation serializer with environment-aware Turnstile check`

### ── SLICE 3: Giao diện & Provisioning (Atomic) ──────────────────────────────────
- `[ ]` **CODE**:
  - Cập nhật hàm `register_view` trong `views_auth.py` sử dụng `SaaSRegisterSerializer` mới.
  - Sử dụng khối `with transaction.atomic()` đảm bảo luồng tạo **User + CoreTenant + UserProfile + CoreServiceAccount** mặc định là atomic.
  - Thực thi **Nguyên tắc Quyền tối thiểu (Least Privilege)**: Service Account mới chỉ có scopes `['market:read', 'signals:read']`.
  - Cập nhật `verify_email_view` thực hiện nâng cấp scopes (Progressive Scope Elevation) lên thêm `['ai:invoke', 'manage_pats']` ngay sau khi người dùng xác minh email thành công.
- `[ ]` **TEST**:
  - Kiểm thử happy path đăng ký: Xác nhận 4 bản ghi được tạo và liên kết hoàn hảo trong DB.
  - Kiểm thử xác minh email thành công: Xác nhận scopes của Service Account được tự động cập nhật và nâng cao đầy đủ.
- `[ ]` **AUDIT**:
  - Đảm bảo không có lỗi rò rỉ session hoặc locks giao dịch bị kẹt do atomic transaction block kéo dài.
- `[ ]` **DOC-SYNC**:
  - Cập nhật sơ đồ luồng Least Privilege vào mục `5. ĐẶC TẢ UỶ QUYỀN HẠN NGẠCH` của [TECH_SPEC_SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_20260524.md](file:///c:/Mujoco%20Projects/vninvest/docs/plans/TECH_SPEC_SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_20260524.md).
- `[ ]` **COMMIT/PUSH**:
  - Nhánh: `feature/saas-register-up-views`
  - Commit message: `feat(auth): upgrade registration view with atomic tenant provisioning and progressive scope elevation`

### ── SLICE 4: Outbox & CDC (Reliability) ──────────────────────────────────────────
- `[ ]` **CODE**:
  - Tích hợp ghi nhận sự kiện `UserRegisteredEvent` vào bảng `OutboxEvent` ngay bên trong khối transaction đăng ký.
  - Viết background worker/Celery Beat task (`process_outbox_events`) quét các sự kiện `pending`, đẩy qua handler xử lý provisioning, áp dụng **Exponential Backoff Retry** khi lỗi, và đẩy vào DLQ khi quá 5 lần thử lại.
  - Viết Consumer phía provisioning kiểm tra **Idempotency** bằng bảng `ProcessedEvent` (sử dụng `event_id` làm idempotency key) và thực thi trong transaction để tránh khởi tạo trùng lặp.
- `[ ]` **TEST**:
  - Giả lập lỗi ở handler provisioning (ném ngoại lệ tạm thời). Xác nhận worker thực hiện thử lại đúng chu kỳ backoff.
  - Đẩy một event `UserRegisteredEvent` hai lần liên tiếp tới consumer. Xác nhận lượt thứ 2 bị chặn ở bảng `ProcessedEvent` và không chạy lại provisioning.
- `[ ]` **AUDIT**:
  - Giả lập database crash ngay trước khi transaction đăng ký commit. Đảm bảo không có sự kiện outbox nào bị gửi mồ côi (Zero Data Loss).
- `[ ]` **DOC-SYNC**:
  - Đồng bộ hoá luồng outbox vào mục `8. THIẾT KẾ TIN CẬY HỆ THỐNG` của [IMPLEMENTATION_PLAN_SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_20260524.md](file:///c:/Mujoco%20Projects/vninvest/docs/plans/IMPLEMENTATION_PLAN_SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_20260524.md).
- `[ ]` **COMMIT/PUSH**:
  - Nhánh: `feature/saas-register-up-outbox`
  - Commit message: `feat(auth): implement transactional outbox eventing with consumer idempotency and exponential backoff retry`

### ── SLICE 5: Quản trị Mail động & Google API ─────────────────────────────────────
- `[ ]` **CODE**:
  - Cập nhật task gửi email `send_email_verification_token` thực hiện router động:
    - Nếu `provider == 'smtp'`: Gửi mail SMTP động qua `get_connection`.
    - Nếu `provider == 'gmail_api'`: Giải mã JSON key của Google Service Account, thực hiện **impersonate** (Domain-Wide Delegation) qua `google_delegated_user_email` với scope `gmail.send`, và kích hoạt Gmail API client để gửi.
    - Fallback: Nếu không có cấu hình dynamic active, tự động fallback về static default SMTP cấu hình tĩnh trong `settings.py`.
  - Tạo `views_operator.py` chứa API CRUD `SystemMailConfig` và endpoint `/test/` kết nối động dành riêng cho Admin/Staff (`is_staff=True`).
- `[ ]` **TEST**:
  - Bật cấu hình Gmail API động và gửi thử qua endpoint `/test/` thành công.
  - Mock connection Google API để chạy test suite độc lập không phụ thuộc internet thực tế.
- `[ ]` **AUDIT**:
  - Đăng ký bộ lọc log masking để đảm bảo mật khẩu SMTP, client secrets, refresh tokens và JSON private key không bao giờ bị lộ ra console, file logs, hoặc đẩy lên Sentry.
- `[ ]` **DOC-SYNC**:
  - Cập nhật đặc tả endpoint quản trị vào mục `6. ĐẶC TẢ CHI TIẾT DỊCH VỤ QUẢN TRỊ` của [TECH_SPEC_SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_20260524.md](file:///c:/Mujoco%20Projects/vninvest/docs/plans/TECH_SPEC_SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_20260524.md).
- `[ ]` **COMMIT/PUSH**:
  - Nhánh: `feature/saas-register-up-mail`
  - Commit message: `feat(auth): implement dynamic SMTP and Google Gmail API router with DWD support and operator APIs`

### ── SLICE 6: Kiểm thử & Go-live ────────────────────────────────────────────────
- `[ ]` **CODE**:
  - Tạo file `test_register_upgrade.py` chứa đầy đủ 5 test cases nâng cao trong **Expanded Test Matrix** (TC_CONCURRENCY_01 đến TC_MIGRATION_KEY_05).
  - Chuẩn hoá toàn bộ API response (đăng ký thành công và lỗi) khớp 100% với Error/Success OpenAPI Envelope của VNInvest Core.
- `[ ]` **TEST**:
  - Chạy `pytest packages/core/backend/src/identity_access/tests/` và xác nhận **100% PASS** (23/23 tests bao gồm cả T08 + T09 + tests mới).
- `[ ]` **AUDIT**:
  - Khởi động service động ở môi trường local và staging (với strict check enabled). Xác nhận Startup check fail-fast đúng quy tắc khi thiếu Turnstile key ở production.
- `[ ]` **DOC-SYNC**:
  - Điền đầy đủ kết quả chạy test và log di chuyển cơ sở dữ liệu vào [SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_EXECUTION_EVIDENCE_TEMPLATE_20260524.md](file:///c:/Mujoco%20Projects/vninvest/docs/plans/SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_EXECUTION_EVIDENCE_TEMPLATE_20260524.md).
  - Cập nhật trạng thái DONE lên `PROGRESS_DASHBOARD.md` và cập nhật PR ledger trong `docs/plans/CODE_CHANGE_AUDIT_LEDGER.md`.
- `[ ]` **COMMIT/PUSH**:
  - Nhánh: `feature/saas-register-up-tests`
  - Commit message: `test(auth): add full expanded regression test suite and finalize OpenAPI envelope alignment`

### ── SLICE 7: Tích hợp Frontend (`packages/web`) ─────────────────────────────
- `[x]` **CODE**:
  - Cài đặt thư viện `@marsview/react-turnstile` trong `packages/web`.
  - Triển khai component React `TurnstileWidget` để hiển thị captcha bảo mật của Cloudflare Turnstile.
  - Tích hợp trường Honeypot `website` vào form đăng ký thành viên và viết CSS `.invisible-honeypot` ẩn an toàn ngoài viewport (`left: -9999px`).
  - Viết helper `parseApiErrors` phân rã lỗi API và highlight các trường lỗi `username`, `email`, `password_confirm`, hoặc `turnstile_token` tương ứng trên form đăng ký.
- `[x]` **TEST**:
  - Kiểm thử happy path trên trình duyệt: Điền form hợp lệ và submit thành công, nhận màn hình cảm ơn kèm thông báo kiểm tra email bằng tiếng Việt có dấu.
  - Kiểm thử bẫy Honeypot: F12 bật input website và điền text -> Submit -> Bị hệ thống chặn ngay lập tức mà không gửi request rác đến gateway gửi mail.
- `[x]` **AUDIT**:
  - Xác minh rằng: Giao diện form hiển thị mượt mà trên Mobile và Desktop, typography sử dụng font chữ cao cấp (Outfit và Inter), và Turnstile tự động tải lại nếu token hết hạn (expire callback).
- `[x]` **DOC-SYNC**:
  - Cập nhật thông tin UI và sơ đồ tích hợp vào [FRONTEND_DESIGN_SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_20260524.md](file:///c:/Mujoco%20Projects/vninvest/docs/plans/FRONTEND_DESIGN_SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_20260524.md).
- `[x]` **COMMIT/PUSH**:
  - Nhánh: `feature/saas-register-up-frontend`
  - Commit message: `feat(web): integrate Turnstile widget, website honeypot, i18n and field error parsing to registration view`

#### Execution evidence update (2026-05-25)

1. Installed Turnstile package for package-web runtime and host build graph: `npm install @marsidev/react-turnstile@^1.5.2` in `packages/web` and `frontend` (`--legacy-peer-deps` for host lock compatibility).
2. Auth package tests: `cd packages/web && npm test -- src/pages/auth/AuthPages.test.js src/adapters/coreApiAdapter.test.js` ✅ (`58 passed`).
3. Backend registration baseline validation: `cd packages/core/backend && DJANGO_DEBUG=true python manage.py test src.identity_access.tests.test_register_upgrade src.identity_access.tests.test_operator_mail_config src.identity_access.tests.test_login_upgrade --keepdb` ✅ (`30 passed`).
4. Module tree refresh: `./.venv/Scripts/python.exe scripts/ops/generate_module_tree.py` ✅ (`2595` modules).
5. Runtime refresh via required entrypoint: `./start_dev.ps1 -SkipBuild` ✅ build success + smoke checks `Core API health: OK`, `Frontend health: OK`.

---
*Taskboard được phê duyệt và lưu vết trên hệ thống quản lý công việc của VNInvest.*
