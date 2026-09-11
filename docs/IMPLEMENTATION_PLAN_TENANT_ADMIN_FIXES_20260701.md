# Implementation Plan: Tenant Admin Fixes

**Kế hoạch triển khai sửa lỗi Tenant Admin**  
**Dựa trên:** `docs/AUDIT_TENANT_ADMIN_UI_UX_AND_TECHNICAL_GAPS_20260701.md` (đã hiệu chỉnh)  
**Phản biện:** `docs/REBUTTAL_TENANT_ADMIN_AUDIT_20260701.md`  
**Trạng thái:** i18n `tenantSecurity` + `tenantReports` đã đồng bộ. `coreApiAdapter` đã mở rộng Stripe methods. `npx tsc --noEmit` pass.

---

## Phase 1 — 🚨 CRITICAL (5 bugs)

| # | File | Bug | Approach | Kiểm tra |
|---|------|-----|----------|----------|
| **C1** | `WebhooksPage.tsx` | Missing permission check | Thêm `ability.can("write", "TenantWebhookView")` guard ở đầu component, trước mọi API call và render. Pattern: copy từ `ServiceAccountsPage.tsx` lines 147-160. | Test với user không có quyền → không gọi API, render AccessDenied |
| **C2** | `WebhooksPage.tsx` | Secret reveal modal đóng ngay | Dùng `result.raw_secret` trực tiếp thay vì đọc từ `secretReveal` state. Sửa logic lines 152-161: lưu raw_secret vào 1 biến riêng trước khi setState, dùng biến đó cho modal condition. | Tạo webhook → modal hiển thị secret, không tự đóng |
| **C3** | `BillingPage.tsx` | `handleUpgrade` gọi preview thay vì upgrade | Thay `operatorClient.previewPlanChange(targetPlan)` bằng `defaultCoreApiAdapter.corePost("/partner/billing/upgrade/", { plan: targetPlan })` hoặc Stripe checkout method đã được thêm vào `coreApiAdapter`. Kết hợp ConfirmModal trước khi gọi. | Nhấn Upgrade → Confirm dialog → API upgrade thật được gọi |
| **C4** | `HomePage.tsx` | Deprovision modal đóng khi lỗi | Di chuyển `setShowDeprovision(false)` ra khỏi `finally`. Chỉ đóng modal khi thành công (trong try block). Khi lỗi, giữ modal mở + hiển thị error message. | API lỗi → modal vẫn mở + hiển thị lỗi. API thành công → modal đóng. |
| **C5** | `ServiceAccountsPage.tsx` | API call trước permission check | Thêm `if (!canRead) return;` ở đầu `useEffect` của `loadServiceAccounts`. Hoặc chuyển permission guard lên trước cả `useEffect`. | Mở Network tab → user không quyền → không thấy request `GET /partner/service-accounts/` |

---

## Phase 2 — 🔴 HIGH (11 bugs)

| # | File | Bug | Approach | Ghi chú |
|---|------|-----|----------|---------|
| **H1** | `HomePage.tsx:154` | Empty catch trend days | Thêm `setError(t("tenantHome.trendLoadError"))` trong catch block | Cần tạo key `trendLoadError` trong i18n nếu chưa có |
| **H2** | `HomePage.tsx:282` | PAT checklist sai condition | Sửa `done: summary?.pats_expiring_soon !== undefined` thành `done: (summary?.pats_expiring_soon ?? 0) > 0` | Kiểm tra: khi pats_expiring_soon = 0 → done = false |
| **H3** | `BillingPage.tsx:136` | `setInvoices` fallback crash | Sửa thành `setInvoices(invData.results ?? invData.data ?? [])` — loại bỏ `invData` (object) khỏi fallback chain | Test với API trả về `{}` → invoices là [] thay vì crash |
| **H4** | `ServiceAccountsPage.tsx:280` | `saId!` non-null assertion | Thêm early return nếu `!saId`, hoặc throw error có message. Pattern: `if (!saId) { toast.error("Invalid service account ID"); return; }` | Click delete trên SA không có ID → toast error, không gửi request |
| **H5** | `PATsPage.tsx:156,677` | UTC timezone shift | Dùng `Intl.DateTimeFormat` hoặc thư viện date (dayjs) thay vì `toISOString()`. Đảm bảo `datetime-local` input nhận giá trị local time. | Tạo PAT → thời gian hiển thị đúng UTC+7. Kiểm tra ở các múi giờ khác. |
| **H6** | `SSOPage.tsx:352` | `window.location.href` mất dữ liệu | Thêm confirm dialog trước khi navigate: `if (isDirty && !await confirm(...)) return;`. Hoặc lưu form data vào sessionStorage trước khi redirect. | Form có thay đổi → cảnh báo trước khi test SSO |
| **H7** | `SSOPage.tsx:301-327` | SP fields editable | Đổi từ `<input>` sang `<div>` hoặc `<span>` với `className` cho styling. Thêm copy button kế bên. API trả về giá trị nào thì hiển thị giá trị đó (read-only). | UI hiển thị SP Entity ID / ACS URL dạng text + nút Copy |
| **H8** | `SecurityPage.tsx:60-65` | `common.justNow` sai key path | Sửa `t("common.justNow")` → `t("tenantHome.justNow")`, `t("common.minutesAgo")` → `t("tenantHome.minutesAgo")`, etc. | Thời gian hiển thị đúng tiếng Việt |
| **H9** | `UsagePage.tsx:137,149,161` | 3 silent catch blocks | Mỗi catch block thêm `setError(...)` + optional toast. Tham khảo pattern từ `UsageHistoryPage.tsx:76-78`. | API lỗi → user thấy error message + retry option |
| **H10** | `AuditLogsPage.tsx:164-194` | Stats từ current page | Option A: Thêm API aggregation endpoint ở backend. Option B: Tích lũy logs từ tất cả pages đã load (pagination-aware). Option C: Thêm disclaimer "Số liệu dựa trên trang hiện tại". | Hiển thị disclaimer hoặc tính từ aggregate data |
| **H11** | `ReportsPage.tsx:210-253` | Nút "Tạo mới" ẩn khi có data | Thêm `actions={canManage ? createAction : null}` vào `ShellPanel` ở cả 2 branches (empty và có data). | Luôn thấy nút "Tạo mới" bất kể danh sách trống hay không |

---

## Phase 3 — 🟡 MEDIUM + 🟢 LOW (19 bugs + missing features)

| # | File | Bug | Ưu tiên |
|---|------|-----|---------|
| M1 | HomePage | Checklist dùng permission thay vì data | MEDIUM |
| M2 | HomePage | `KpiCard` nested definition | MEDIUM |
| M3 | BillingPage | Hardcoded `"VND"` | MEDIUM |
| M4 | BillingPage | Plan limits hardcoded | MEDIUM |
| M5 | BillingPage | Thiếu confirm khi upgrade | MEDIUM |
| M6 | UsagePage | `METER_CODES` hardcoded | MEDIUM |
| M7 | UsageHistoryPage | `METER_CODES` hardcoded | MEDIUM |
| M8 | UsageHistoryPage | Peak day reduce fragile | MEDIUM |
| M9 | MembersPage | Cancel invite filter | MEDIUM |
| M10 | MembersPage | Hardcoded Owner/Admin labels | MEDIUM |
| M11 | MembersPage | No role change | **MISSING FEATURE** |
| M12 | ServiceAccountsPage | Toggle không confirm | MEDIUM |
| M13 | PATsPage | Hardcoded labels | MEDIUM |
| M14 | SSOPage | Success banner không dismiss | MEDIUM |
| M15 | SecurityPage | `last_active_at` không hiển thị | MEDIUM |
| M16 | AuditLogsPage | setTimeout workaround | MEDIUM |
| M17 | CapabilitiesPage | formatQuotaValue type | MEDIUM |
| M18 | CapabilitiesPage | Progress bar binary | MEDIUM |
| M19 | CapabilitiesPage | Chỉ 3 action groups | MEDIUM |
| L1 | HomePage | `[7, 14, 30]` hardcoded | LOW |
| L2 | MembersPage | `MEMBER_CSS` inline | LOW |
| L3 | SSOPage | Thiếu metadata XML download | LOW |
| L4 | SSOPage | Thiếu copy buttons | LOW |
| L5 | PATsPage | Missing Bulk Revoke | **MISSING FEATURE** |
| L6 | Cross-cutting | Generic AdminModal component | **ARCHITECTURAL** |

---

## i18n Keys cần thêm / sửa

| Keys | File | Trạng thái |
|------|------|-----------|
| `tenantBilling.costTrendTitle`, `costTrendSubtitle`, `costTotal`, `costAvg`, `costForecast`, `costTrendEmpty` | `vi.js` | **Cần thêm** (có sẵn trong `en.js`) |
| `tenantWebhooks.eventMember`, `eventPAT`, `eventSA`, `eventQuota`, `eventBilling` | `vi.js` + `en.js` | **Cần thêm** (chỉ có `eventOther`) |
| `tenantMembers.searchPlaceholder` | `vi.js` + `en.js` | **Cần thêm** |
| Sửa key path: `common.justNow` → `tenantHome.justNow` (và các key timeAgo khác) | `SecurityPage.tsx` lines 60-65 | **Cần sửa code** |

---

## Thứ tự thực hiện đề xuất

```
Day 1:  C1 + C2 (WebhooksPage — permission + secret reveal)
Day 2:  C3 (BillingPage — upgrade), C4 (HomePage — deprovision)
Day 3:  C5 (ServiceAccountsPage — permission guard)
        + Verify Phase 1: npx tsc --noEmit
Day 4:  H1-H4 (HomePage catch, checklist, BillingPage invoices, SA id)
Day 5:  H5-H8 (PAT timezone, SSO confirm + SP read-only + Security timeAgo)
Day 6:  H9-H11 (UsagePage catches, AuditLogs stats, ReportsPage create button)
        + i18n sync (costTrend*, event*, searchPlaceholder)
        + Verify Phase 2: npx tsc --noEmit + npm run build
Day 7+: Phase 3 (MEDIUM + LOW + missing features)
```

---

*Reference: Audit report tại `docs/AUDIT_TENANT_ADMIN_UI_UX_AND_TECHNICAL_GAPS_20260701.md` (đã hiệu chỉnh), phản biện tại `docs/REBUTTAL_TENANT_ADMIN_AUDIT_20260701.md`.*
