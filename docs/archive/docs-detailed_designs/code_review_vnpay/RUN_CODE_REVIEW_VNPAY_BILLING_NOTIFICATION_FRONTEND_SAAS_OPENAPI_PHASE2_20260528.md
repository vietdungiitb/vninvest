# Run Code Review — VNPAY Billing Notification Frontend SaaS OpenAPI Phase 2
**Ngày**: 2026-05-28
**Mục đích**: Runbook review bắt buộc trước khi merge các slice frontend phase 2

---

## 1. Bootstrap docs phải đọc

1. Handoff master
2. Tech spec
3. Frontend design
4. Taskboard
5. Traceability matrix
6. OpenAPI constitution
7. OpenAPI PR gate checklist

---

## 2. Review focus

1. Commercial pages có nằm đúng trong `packages/web` không.
2. Mọi call commercial API có đi qua adapter facade không.
3. Payment return có thật sự lấy truth từ status endpoint không.
4. Notification UX có bị mở sớm khi chưa có backend contract không.
5. Route catalog, page registry, build targets, capabilities có đồng bộ không.
6. Text mới có qua i18n đúng tiếng Việt không.

---

## 3. Mandatory grep checks

```powershell
git diff --check
git grep -n "fetch(" -- packages/web/src
git grep -n "/payments/vnpay-ipn/" -- packages/web/src
git grep -n "window.location" -- packages/web/src
git grep -n "CORE_API_BASE_URL\|REACT_APP_CORE_API_BASE_URL\|payment-return" -- packages/web/src
git grep -n "ShellMailConfigPage\|mail-config" -- packages/web/src
git grep -n "from '../\|from '../../\|from '../../../frontend" -- packages/web/src
```

Reviewer interpretation:
1. `fetch(` chỉ được chấp nhận trong transport layer hoặc test harness hợp lệ.
2. `/payments/vnpay-ipn/` không được xuất hiện trong browser consumer code.
3. `payment-return` xuất hiện ngoài route config/page docs phải được xem xét kỹ.

---

## 4. Reject conditions

1. Page/component gọi API trực tiếp, bypass adapter.
2. Browser dùng query params làm payment truth cuối.
3. Notification settings trộn với operator mail config.
4. Route mới không đăng ký đủ route catalog + page registry.
5. i18n chưa hoàn tất.
6. Governance docs không sync.