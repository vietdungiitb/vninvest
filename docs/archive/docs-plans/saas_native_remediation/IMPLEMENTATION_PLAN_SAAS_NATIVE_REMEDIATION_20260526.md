# Kế hoạch Hoàn thiện Luồng Đăng ký & Đăng nhập SaaS Native và Vận hành SOC

Tài liệu này mô tả trạng thái thực tế của codebase sau audit ngày 26/05/2026, bao gồm các hạng mục đã hoàn thành và các hạng mục còn thiếu cần implement trước khi đạt chuẩn production.

**Audit lần cuối:** 26/05/2026  
**Tiến độ tổng:** 7/14 hạng mục DONE · 1 PARTIAL · 6 MISSING

---

## Ràng buộc bất biến (không thay đổi)

> [!IMPORTANT]
> **Bảo mật Secrets Management:**
> Frontend tuyệt đối không lưu trữ hay hardcode khóa mã hóa, mật khẩu SMTP hoặc thông số Service Account Google. Các giá trị nhạy cảm chỉ được trả về dạng cờ bool (`smtp_password_configured`, `service_account_configured`).

> [!NOTE]
> **Migration & Celery:** Các model `EmailVerificationToken`, `SystemMailConfig`, `MailConfigAuditLog`, `OutboxEvent` đã tồn tại trong DB. Không cần migration mới cho các hạng mục còn lại. Celery Beat `process-outbox-events-30s` đã hoạt động.

---

## Trạng thái thực tế theo Component

### Component 1: `packages/core` (Backend Core API)

#### ✅ [DONE] `packages/core/backend/src/identity_access/views_auth.py` — Email Verification Hardening

Đã hoàn thành đầy đủ:
- Token được hash bằng `hashlib.sha256` trước khi lưu DB (`token_hash`, dòng 782, 1021).
- `EmailVerificationToken` model tồn tại với field `token_hash`.
- Attempt lockout: `ratelimit:verify:attempts:{email_key}` qua Django cache, TTL 900s (15 phút).
- Rate limit resend: theo IP (`ratelimit:resend:ip:`) và subnet (`ratelimit:resend:subnet:`).

#### ✅ [DONE] `packages/core/backend/src/vninvest_core/settings.py` — Celery Beat Outbox Scheduler

Đã cấu hình:
- `CELERY_BEAT_SCHEDULE` entry `'process-outbox-events-30s'` trỏ đến `data_ingest.tasks.process_outbox_events`.
- Task `process_outbox_events` tồn tại trong `data_ingest/tasks.py` (dòng 2221).
- `OutboxEvent` được tạo trong cả flow đăng ký và resend verification.
- `trigger_email_verification_flow` task cập nhật status `STATUS_PROCESSED` / `STATUS_FAILED`.

> [!WARNING]
> **Idempotency PARTIAL:** `process_outbox_events` chỉ filter `STATUS_PENDING` để tránh re-process.
> Chưa có bảng `ProcessedEvent` dedup explicit. Đủ cho production MVP nhưng cần hardening nếu scale.

#### ❌ [MISSING — CRITICAL] `packages/core/backend/src/identity_access/urls.py` — URL routing cho views_operator

`views_operator.py` đã được implement đầy đủ (`OperatorMailConfigListView`, CRUD, test connection) nhưng **chưa được đăng ký vào `urls.py`**. Toàn bộ mail config API hiện không thể gọi được từ bất kỳ client nào.

Cần thêm vào `identity_access/urls.py`:
```python
from . import views_operator

# Operator: Mail Config management (admin only)
path('operator/mail-configs/', views_operator.OperatorMailConfigListView.as_view(), name='operator-mail-config-list'),
path('operator/mail-configs/<int:pk>/', views_operator.OperatorMailConfigDetailView.as_view(), name='operator-mail-config-detail'),
path('operator/mail-configs/<int:pk>/activate/', views_operator.ActivateMailConfigView.as_view(), name='operator-mail-config-activate'),
path('operator/mail-configs/<int:pk>/test/', views_operator.TestMailConfigView.as_view(), name='operator-mail-config-test'),
```

---

### Component 2: `packages/web` (Giao diện Shell & Routing)

#### ✅ [DONE] `packages/web/src/app/routeCatalog.js` — Route `/register`

Route `auth-register` → `/register` đã được đăng ký (dòng 17–19).

#### ❌ [MISSING] `packages/web/src/app/routeCatalog.js` — Route `/operations-center/mail-config`

Chưa có entry cho mail config. Cần thêm:
```js
{
  id: "operations-center-mail-config",
  path: "/operations-center/mail-config",
  titleKey: "routes.mailConfig",
  requiresAuth: true,
  requiresAdmin: true,
}
```

#### ✅ [DONE] `packages/web/src/pages/pageRegistry.js` — AuthRegisterPage

`makePageEntry("auth-register", ...)` trỏ đến `./auth/AuthRegisterPage.js` đã tồn tại (dòng 110–111).

#### ❌ [MISSING] `packages/web/src/pages/pageRegistry.js` — ShellMailConfigPage

Chưa có entry cho `operations-center-mail-config`. Cần thêm:
```js
makePageEntry("operations-center-mail-config", "core", () =>
  import("./admin/ShellMailConfigPage.js").then((module) => module.ShellMailConfigPage)),
```

#### ❌ [MISSING — CRITICAL] `packages/web/src/adapters/coreApiAdapter.js` — 7 phương thức mail config

Không có phương thức nào liên quan đến mail config. Cần thêm đủ 7 hàm:

| Hàm | Endpoint backend |
|-----|-----------------|
| `getOperatorMailConfigs(params)` | `GET /core/v1/operator/mail-configs/` |
| `getOperatorMailConfigDetail(id)` | `GET /core/v1/operator/mail-configs/{id}/` |
| `createOperatorMailConfig(payload)` | `POST /core/v1/operator/mail-configs/` |
| `updateOperatorMailConfig(id, payload)` | `PATCH /core/v1/operator/mail-configs/{id}/` |
| `deleteOperatorMailConfig(id)` | `DELETE /core/v1/operator/mail-configs/{id}/` |
| `activateOperatorMailConfig(id)` | `POST /core/v1/operator/mail-configs/{id}/activate/` |
| `testOperatorMailConfig(id)` | `POST /core/v1/operator/mail-configs/{id}/test/` |

---

### Component 3: `packages/web/src/pages` (UI Pages)

#### ✅ [DONE] `packages/web/src/pages/auth/AuthRegisterPage.js`

File tồn tại và hoàn chỉnh:
- `TurnstileWidget` tích hợp (lớp bảo vệ Cloudflare Turnstile).
- Honeypot field `website` (hidden field chống bot).
- Validation đầy đủ: username, email, password, password_confirm.
- Error parsing từ API response (field errors + global message).
- `coreApiAdapter.registerUser()` được gọi đúng cách.

#### ❌ [MISSING — CRITICAL] `packages/web/src/pages/admin/ShellMailConfigPage.js`

File chưa được tạo. Thư mục `packages/web/src/pages/admin/` chỉ có `ShellOperationsCenterPage.js`.

Cần xây dựng:
- Danh sách các cấu hình mail hiện có (provider, is_active, from_email).
- Form tạo/sửa cấu hình (SMTP hoặc Gmail API — secret fields hiển thị dạng `***` hoặc bool flag).
- Nút "Kích hoạt" (chỉ một config được active tại một thời điểm).
- Nút "Test kết nối" — gọi `testOperatorMailConfig()` và hiển thị kết quả success/fail.

#### ❌ [MISSING] `packages/web/src/pages/admin/ShellOperationsCenterPage.js` — Link đến mail-config

Chưa có card hoặc link nào trỏ tới `/operations-center/mail-config`. Cần bổ sung một `renderSummaryCard` hoặc liên kết điều hướng trong phần operator surface.

---

## Thứ tự implement còn lại (theo dependency)

```
1. [Backend]  identity_access/urls.py       — wire views_operator routes (unblock API)
2. [Frontend] coreApiAdapter.js             — thêm 7 phương thức mail config
3. [Frontend] ShellMailConfigPage.js        — tạo mới component
4. [Frontend] routeCatalog.js               — đăng ký route /operations-center/mail-config
5. [Frontend] pageRegistry.js              — đăng ký ShellMailConfigPage
6. [Frontend] ShellOperationsCenterPage.js — thêm card/link mail-config
```

---

## Verification Plan

### Automated Tests
- Chạy: `python -m pytest packages/core/backend/src/identity_access/tests/ -v --keepdb`
- Verify token hash được lưu đúng trong `EmailVerificationToken.token_hash`.
- Verify lockout sau 5 lần verify sai (cache key `ratelimit:verify:attempts:`).
- Verify mail config API trả về 401 khi không authen, 403 khi không phải admin.

### Manual Verification
1. Truy cập `/register` — đăng ký tài khoản mới, kiểm tra honeypot + Turnstile hoạt động.
2. Kiểm tra DB: `EmailVerificationToken` có `token_hash` (không có raw token).
3. Truy cập `/operations-center/mail-config` — tạo một cấu hình SMTP ảo, kích hoạt, chạy test kết nối và nhận status success/fail từ backend.
4. Xác nhận Celery Beat log có entry `process_outbox_events` chạy mỗi 30 giây.
