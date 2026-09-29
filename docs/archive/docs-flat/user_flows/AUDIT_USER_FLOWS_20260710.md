# AUDIT TỔNG HỢP: Đăng ký · Nâng cấp Plan · Quản trị Tenant · Thống kê/Báo cáo · Billing

**Ngày audit:** 2026-07-10
**Ngày cập nhật:** 2026-07-10 (v2 — tích hợp phản biện độc lập)
**Phạm vi:** Monorepo `vninvest` — Django backend (`packages/core/backend`) + React frontend (`packages/web`)
**Phương pháp:** 3 agent explore song song quét code + 1 vòng phản biện độc lập verify thực tế từng claim.

---

## Tổng quan mức độ chuẩn hóa

| Luồng | Điểm | Trạng thái |
|---|---|---|
| Đăng ký tài khoản | **7-8/10** | Tốt (production-ready) |
| Quản trị Tenant (phân quyền) | **4/10** | Có bug gãy chức năng |
| Thống kê / Báo cáo / Analytics | **5/10** | Có 3 bug làm rỗng data |
| Billing & Nâng cấp Plan | **2-4/10** | Hỏng logic nghiêm trọng |

---

## 🔴 CRITICAL — Cần sửa gấp (gãy chức năng)

### C1. Nâng cấp plan bị hỏng hoàn toàn (revenue-blocking)
- **File:** `packages/core/backend/src/commercial/views.py:223-229` (VNPayIPNWebhookView)
- **Nguyên nhân:** IPN xác định plan bằng cách tìm `"pro"/"starter"/"enterprise"` trong `invoice_number`, nhưng `invoice_number` sinh ra là UUID hex (`INV-XXXX...`, dòng 117) → không bao giờ khớp → **luôn gán `tenant.plan="pro"`** (default dòng 223).
- **Root cause sâu:** `CreateVNPayPaymentView` nhận `plan` từ request (dòng 88) nhưng **chỉ ghi vào `description`** (dòng 137), không lưu vào `Invoice` hay `PaymentTransaction`.
- **Thiếu field cấu trúc:** `Invoice` (models.py:61-88) và `PaymentTransaction` (models.py:91-103) **đều KHÔNG có field `plan`** → IPN không thể truy vấn plan từ DB, chỉ còn cách parse `invoice_number` (bất khả thi).
- **Hậu quả:** User trả VIP_12M (enterprise) → hệ thống vẫn set `tenant.plan = "pro"`.
- **Sửa:** Thêm `plan = models.CharField(...)` vào `PaymentTransaction` (hoặc `Invoice`); lưu plan lúc tạo payment; IPN đọc `txn.plan` thay vì parse UUID.

### C2. Plan taxonomy 3 bộ không khớp
- Backend `CoreTenant.PlanChoices` (`commercial/models.py:50-56`): `free, starter, pro, enterprise, custom, internal`
- `UpgradePage.tsx:13-29`: `basic, pro, premium` (không gọi API, trang trí)
- `BillingCenterPage.tsx:562-590`: `VIP_1M, VIP_6M, VIP_12M`
- `basic`/`premium` thậm chí không tồn tại ở backend. Không có mapping layer nào.

### C3. Webhook manage khóa vĩnh viễn
- **File:** `packages/web/src/pages/tenant-admin/TenantAdminWebhooksPage.tsx:66`
- `canManage = ability?.can?.("write", "TenantWebhookView")` nhưng backend (`helpers.py:125-126`) **không cấp action `write`** (chỉ `read`/`manage`) → CASL trả `false` mọi trường hợp.
- Nút tạo/sửa/xóa ẩn với mọi user kể cả staff. Trang vẫn đọc được (canRead dùng `read` đúng).
- **Sửa:** `"write"` → `"manage"`.

### C4. Tab Meters & Quotas luôn rỗng
- **File:** `packages/core/backend/src/identity_access/commercial_partner_views.py:48-85`
- `PartnerUsageMetersView` import `from commercial.models import UsageMeter` — **`UsageMeter` KHÔNG TỒN TẠI** (models chỉ có Invoice/QuotaRecord/Subscription/QuotaHistory/PaymentTransaction/VNPayIPNLog) → `ImportError` → catch → `return Response([])`.
- `PartnerUsageQuotasView` trả list thô `Response(QuotaRecordSerializer(qs, many=True).data)` — không wrapper `results` → frontend đọc `.results` = `undefined` → `[]`.
- **Schema lệch:** frontend `Quota` interface (`TenantAdminUsagePage.tsx:19-27`) cần `{meter_code, display_name, unit, entitled_amount, consumed_amount, remaining_amount, hard_stop}`; backend `QuotaRecord` (`commercial/models.py:38-51`) có `{api_calls_used, api_calls_limit, symbols_used, symbols_limit, ...}`. *(Đây là nội dung critique gọi là "NEW#2" nhưng thực tế đã nằm trong audit gốc C4 — xem Errata.)*
- **Dữ liệu thực tế đã có sẵn** ở `QuotaHistory` (`commercial/models.py:131-160`) với đúng schema cần, exposed qua `/partner/usage/history/` (hoạt động đúng). Nên tái sử dụng thay vì 2 endpoint chết.

### C5. HomePage link Audit Logs bị ẩn
- **File:** `packages/web/src/pages/tenant-admin/TenantAdminHomePage.tsx:193`
- Subject `"TenantAuditLogView"` (không tồn tại) thay vì `"TenantAuditAdmin"` → `allowedLinks` filter loại bỏ link "Audit Logs" cho mọi user dù có quyền (vào được qua sidebar).
- **Sửa:** `"TenantAuditLogView"` → `"TenantAuditAdmin"`.

### C6. AI Usage leak multi-tenant
- **File:** `packages/core/backend/src/ai_analytics/views.py:11-104`
- `AIUsageRecordListView`/`AIUsageSummaryView`/`AIUsageAggregateView` chỉ `IsAuthenticated`, query `AIUsageRecord.objects.all()` / `AIUsageSummary.objects.all()` **không lọc tenant** → mọi user đăng nhập thấy AI usage của mọi tenant.
- Trang là admin-level (`settings/ai/usage`) nhưng backend không enforce `IsCoreOperator`.

---

## 🟠 HIGH — Không nhất quán / Lỗ hổng

### H7. Fail-open phân quyền (11-12 trang tenant-admin)
- Pattern `canRead = ability?.can?.(...) ?? true` (vd `TenantAdminBillingPage.tsx:166`, `TenantAdminMembersPage.tsx:52`, `TenantAdminWebhooksPage.tsx:65`, `TenantAdminUsagePage.tsx:190`, `TenantAdminUsageHistoryPage.tsx:62`, `TenantAdminCapabilitiesPage.tsx:70`, `TenantAdminAuditLogsPage.tsx:62`, `TenantAdminSSOPage.tsx:126`, `TenantAdminSecurityPage.tsx:99`, `TenantAdminServiceAccountsPage.tsx:58`, `TenantAdminPATsPage.tsx:232`).
- Nếu context `ability` chưa load/rỗng → mặc định CHO PHÉP (bypass UI). Trái ngược `canManage` webhook dùng `?? false` (an toàn hơn). Không nhất quán.
- **Sửa:** `?? true` → `?? false` (fail-closed).

### H8. Billing response shape lệch
- **File:** `packages/web/src/pages/commercial/BillingCenterPage.tsx:464-529`
- Đọc `subscription.plan_name` (488) / `next_billing_date` (491) nhưng backend `SubscriptionSerializer` (`commercial/serializers.py:11`) trả `plan` / `current_period_end`.
- Đọc `feature_name`/`used`/`limit` (529/514/515) nhưng backend trả `api_calls_used, symbols_used, users_used...` → section Quota luôn rỗng.
- Đọc `invoice_id`/`amount`/`status` (464-467) nhưng backend trả `invoice_number`/`amount_due`/`status` → mã hóa đơn & số tiền undefined.
- `BillingCenterPage` còn định nghĩa `useI18n()` giả (hardcode map cục bộ, dòng 10-48) vi phạm AGENTS.md.

### H9. Stripe/VNPay plan param contract mismatch (PHÁT HIỆN MỚI từ phản biện — xác thực)
- **Frontend:** `BillingCenterPage.tsx:606` gửi `payload = { amount, plan: activePlan }` với `activePlan ∈ {VIP_1M, VIP_6M, VIP_12M}`.
- **VNPay backend** (`commercial/views.py:88`): nhận `plan`, validate không rỗng, nhưng chỉ ghi vào `description` (137) + trả `{'plan': plan}` (156). IPN không map được `VIP_*` → rơi về "pro" (xem C1).
- **Stripe backend** (`commercial/views.py:336-355`): nhận `plan`, gọi `stripe_service.get_price_id(plan)` (352). Nếu `plan` không phải `starter/pro/enterprise` → **422 "Gói {plan} không có Stripe Price ID được cấu hình"** (355). Do frontend gửi `VIP_1M` → Stripe path sẽ fail.
- **Kết luận:** Không có translation layer giữa `VIP_*` (frontend) ↔ `starter/pro/enterprise` (backend/Stripe). Payment creation với Stripe sẽ fail; với VNPay thì tạo sai/siêu cấp sai plan.

---

## 🟡 MEDIUM — Thiết kế / Chuẩn hóa

### M10. i18n vi phạm nghiêm trọng
- 4 trang auth **hardcode tiếng Việt**, không dùng `t()`/`LangContext`:
  - `AuthRegisterPage.tsx` (19, 82, 89, 111, 136-137, 220)
  - `AuthLoginPage.tsx` (100, 107, 121, 133)
  - `AuthVerifyEmailPage.tsx` (21, 28, 35, 46)
  - `AuthResetPasswordPage.tsx` (49, 51, 69, 73, 89, 141-142)
- `UpgradePage.tsx`, `BillingCenterPage.tsx` cũng hardcode. Vi phạm AGENTS.md "i18n qua LangContext".

### M11. Sidebar không gate ability
- **File:** `packages/web/src/components/TenantAdminSidebar.tsx:16-30, 148-161`
- Render cứng 13 item, không gọi `ability.can` nào → menu không đồng bộ với per-page gate. Hiện chấp nhận được vì backend cấp mọi `Tenant*` cho mọi plan, nhưng thiết kế mong manh.

### M12. Phân quyền kép không map nhau
- UI dùng CASL `TenantBillingView`; backend billing dùng scope `manage_tenant` + `require_pat_scopes_or_human_session(request, 'manage_tenant')` (`commercial_partner_views.py`) — không qua CASL. Hai hệ thống song song không map.

### M13. Dead / redundant abilities
- `TenantAdminHome` (read, helpers.py:114) cấp nhưng không dùng → dead.
- `TenantSSOView` ≡ `TenantSSOAdmin` (cùng read+manage) → dư thừa, dễ lệch khi bảo trì.
- `TenantMemberAdmin` create/remove (helpers.py:119-120) cấp nhưng MembersPage không gate.

### M14. Error swallowing trong partner views (ĐÃ HIỆU CHỈNH từ phản biện NEW#3)
- **File:** `commercial_partner_views.py:62-65, 82-85, 117-120, 143-146, 246-249`
- Các `except Exception` bắt **mọi** lỗi và trả `Response([])` / `{error}` với 200/500 — **NHƯNG CÓ LOG** qua `logger.error(..., exc_info=True)`.
- **Không "silent" như critique ghi** — lỗi được ghi log. Vấn đề thực sự: (a) trả 200 + empty array thay vì 5xx → frontend hiển thị "chưa có data" giả; (b) lỗi DB/schema (vd `UsageMeter` import fail) bị ngụy trang thành "không có dữ liệu" → debug khó.
- **Sửa:** Chỉ catch exception cụ thể (vd `ImportError` khi app chưa migrate), để lỗi thực sự propagate thành 500.

### M15. Partner envelope không thống nhất
- Endpoints trả lẫn lộn: list thô (`meters`, `quotas`, `history`), `{results}` (`audit-logs`, `billing/invoices`), object (`trend`, `forecast`, `alert-config`) — không có chuẩn cho `/partner/*`.

---

## ✅ ĐIỂM TỐT (giữ nguyên)

- **Đăng ký:** rate-limit đa tầng (IP /24, email), honeypot, Cloudflare Turnstile, transactional outbox, verify-email bắt buộc, progressive privilege elevation sau verify (`register.py:29-310`).
- **Audit-logs / Reports / Security / Trend / Forecast:** response shape khớp frontend, cursor pagination đúng.
- **Data models đầy đủ:** `Invoice` có lịch sử, `QuotaHistory`, `LoginAttempt`, `ScheduledReport`, `ReportDeliveryLog`.
- **Charts recharts** có tooltip style consistent (`rgba(15,23,42,0.95)`, accent `#00b4d8`) ở luồng tenant-admin.

---

## 📋 ĐỀ XUẤT ƯU TIÊN SỬA (validated + corrected)

| # | Ưu tiên | Hạng mục | File chính | Sửa |
|---|---|---|---|---|
| 1 | Gấp | IPN plan detection + thêm field `plan` | `commercial/views.py:223-229`, `models.py:61-103` | Thêm `plan` vào PaymentTransaction; IPN đọc `txn.plan` |
| 2 | Gấp | Plan taxonomy unification | `models.py:50-56`, `UpgradePage.tsx`, `BillingCenterPage.tsx` | 1 bộ từ vựng + mapping VIP↔plan |
| 3 | Gấp | Webhook `write`→`manage` | `TenantAdminWebhooksPage.tsx:66` | Đổi action |
| 4 | Gấp | Home audit subject | `TenantAdminHomePage.tsx:193` | `TenantAuditLogView`→`TenantAuditAdmin` |
| 5 | Cao | Meters/Quotas rewrite | `commercial_partner_views.py:48-85` | Viết lại dựa trên `QuotaHistory` |
| 6 | Cao | AI usage tenant filter | `ai_analytics/views.py:11-104` | Thêm filter tenant + `IsCoreOperator` |
| 7 | Cao | Stripe/VNPay plan param contract | `BillingCenterPage.tsx:606`, `commercial/views.py:88,336` | Translation layer VIP↔starter/pro/enterprise |
| 8 | Trung bình | Fail-open `?? true` | 11-12 trang tenant-admin | `?? true`→`?? false` |
| 9 | Trung bình | Billing response alignment | `serializers.py` hoặc `BillingCenterPage.tsx` | Sửa field đọc + xóa fake useI18n |
| 10 | Trung bình | i18n auth pages | 4 trang auth + Upgrade/Billing | Dùng `t()`/`LangContext` |
| 11 | Trung bình | Sidebar CASL gating | `TenantAdminSidebar.tsx` | Thêm `ability.can` |
| 12 | Thấp | Partner envelope chuẩn hóa | `partner_urls.py` + serializers | Thống nhất `{results}` |
| 13 | Thấp | Error swallowing | `commercial_partner_views.py` | Catch cụ thể, để lỗi thực propagate |

---

## Phụ lục A: Danh sách abilities backend hiện có (`helpers.py:107-167`)

**Nhóm A — Mọi plan (free+paid+internal), cấp vô điều kiện:**
Dashboard, Watchlist, Support, Settings, TenantAdminHome, TenantCapabilityView, TenantUsageView, TenantBillingView, TenantMemberAdmin (read/create/remove), TenantServiceAccountAdmin (manage), TenantPATAdmin (manage), TenantSSOView (read/manage), TenantWebhookView (read/manage), TenantSecurityView (read/manage), TenantAuditAdmin (read/manage), TenantSSOAdmin (read/manage), TenantReportsView (read/manage).

**Nhóm B — Chỉ paid plan:** Transactions, Portfolios (manage), WhaleAdvisory, WhaleAlerts.

**Nhóm C — Staff/Superuser/Internal:** admin.operator.read, system.ai_command_center.manage, ServiceOpsCenter, AdminOps, AdminCrawlControl, CoreJobOps, CoreAuditTrace.

**Nhóm D — VIP build:** vip.local_control.read.

**Lưu ý:** Backend không bao giờ cấp action `write`/`update` — chỉ `read/create/remove/manage`.

---

## Phụ lục B: ERRATA — Phản biện độc lập với `AUDIT_CRITIQUE_VERIFICATION_20260710.md`

Vòng phản biện thứ 2 đã verify lại 13 finding gốc + 4 claim mới. Kết quả:

| Claim phản biện | Đánh giá độc lập | Bằng chứng |
|---|---|---|
| 13/13 finding gốc đúng | ✅ **ĐÚNG** — verify sâu C1 (views.py:117,224-229) & C4 (UsageMeter import) đều khớp | views.py, commercial_partner_views.py |
| NEW#1 Stripe/VNPay plan mismatch | ✅ **ĐÚNG & MỚI** — frontend gửi `VIP_*`, Stripe expect `starter/pro/enterprise` (views.py:342,352) | BillingCenterPage.tsx:606, commercial/views.py:336-355 |
| NEW#2 QuotaRecord serializer mismatch | ⚠️ **TRÙNG LẶP** — đã nằm trong audit gốc C4 (schema lệch) | TenantAdminUsagePage.tsx:19-27 vs QuotaRecord |
| NEW#3 Silent error swallowing "không log" | ❌ **SAI một phần** — `except` có `logger.error(..., exc_info=True)` (lines 63-64,83-84). Đúng hơn: swallowed-with-logging, trả 200 rỗng | commercial_partner_views.py:62-85 |
| NEW#4 Invoice thiếu field `plan` | ✅ **ĐÚNG** — mở rộng: `PaymentTransaction` (models.py:91-103) CŨNG thiếu `plan` | models.py:61-103 |
| Tiêu đề "audit SOC DataOps parity (Phase 1)" | ⚠️ **Gắn sai ngữ cảnh** — audit gốc là user-flows, không phải SOC DataOps | — |

**Kết luận phản biện:** Audit gốc đúng và đầy đủ. Phản biện bổ sung được 1 finding mới thực sự (H9 plan param contract) + 1 insight cấu trúc (thiếu field `plan` ở 2 model). 2/4 "finding mới" của phản biện là trùng lặp/sai framing → đã hiệu chỉnh trong tài liệu này.
