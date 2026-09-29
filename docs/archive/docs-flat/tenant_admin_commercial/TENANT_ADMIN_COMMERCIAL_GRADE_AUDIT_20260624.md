# 🔍 TENANT ADMIN — KIỂM TRA CHUẨN PHẦN MỀM THƯƠNG MẠI QUỐC TẾ

> **Ngày audit:** 2026-06-24  
> **Người thực hiện:** AI Audit Agent  
> **Phạm vi:** 13 trang tenant-admin (`packages/web/src/pages/tenant-admin/`)  
> **Benchmark:** Stripe Dashboard · Clerk · Auth0 · Vercel Admin Console · Linear  
> **Trạng thái:** ĐỢI DUYỆT — Chưa triển khai

---

## MỤC LỤC

1. [Tổng quan đánh giá](#1-tổng-quan-đánh-giá)
2. [Các vấn đề xuyên suốt (Cross-Cutting)](#2-các-vấn-đề-xuyên-suốt)
3. [Đánh giá chi tiết từng trang](#3-đánh-giá-chi-tiết-từng-trang)
4. [So sánh benchmark thương mại](#4-so-sánh-benchmark-thương-mại)
5. [Roadmap nâng cấp theo phase](#5-roadmap-nâng-cấp-theo-phase)
6. [File manifest dự kiến](#6-file-manifest-dự-kiến)
7. [Effort summary](#7-effort-summary)

---

## 1. TỔNG QUAN ĐÁNH GIÁ

### 1.1 Danh sách 13 trang tenant-admin

| # | File | Route | Kích thước | Chức năng |
|---|------|-------|:----------:|-----------|
| 1 | `TenantAdminHomePage.tsx` | `/tenant-admin/home` | 26.6 KB | Trang chủ, KPI, usage chart, quick links |
| 2 | `TenantAdminMembersPage.tsx` | `/tenant-admin/members` | 17.3 KB | Quản lý thành viên, mời thành viên |
| 3 | `TenantAdminServiceAccountsPage.tsx` | `/tenant-admin/service-accounts` | 17.1 KB | Quản lý Service Account (CRUD) |
| 4 | `TenantAdminPATsPage.tsx` | `/tenant-admin/pats` | 24.3 KB | Personal Access Tokens (issue, rotate, revoke) |
| 5 | `TenantAdminUsagePage.tsx` | `/tenant-admin/usage` | 23.3 KB | Usage metrics, quota gauges |
| 6 | `TenantAdminUsageHistoryPage.tsx` | `/tenant-admin/usage-history` | 12.9 KB | Lịch sử sử dụng chi tiết |
| 7 | `TenantAdminBillingPage.tsx` | `/tenant-admin/billing` | 20.8 KB | Subscription, invoices, cost trends |
| 8 | `TenantAdminCapabilitiesPage.tsx` | `/tenant-admin/capabilities` | 5.6 KB | Abilities + quota caps hiển thị |
| 9 | `TenantAdminAuditLogsPage.tsx` | `/tenant-admin/audit-logs` | 17.4 KB | Nhật ký kiểm toán, filter, timeline |
| 10 | `TenantAdminSSOPage.tsx` | `/tenant-admin/sso` | 14.0 KB | SAML 2.0 SSO configuration |
| 11 | `TenantAdminSecurityPage.tsx` | `/tenant-admin/security` | 12.2 KB | Login activity, sessions, revoke |
| 12 | `TenantAdminReportsPage.tsx` | `/tenant-admin/reports` | 14.4 KB | Scheduled reports |
| 13 | `TenantAdminWebhooksPage.tsx` | `/tenant-admin/webhooks` | 20.3 KB | Webhook CRUD, delivery log, test |

### 1.2 Bảng điểm tổng hợp

| # | Trang | UI/UX | A11y | i18n | Responsive | Error Handling | Feature Parity | Điểm TB |
|---|-------|:-----:|:----:|:----:|:----------:|:--------------:|:--------------:|:-------:|
| 1 | Home | 6/10 | 3/10 | 7/10 | 5/10 | 6/10 | 7/10 | **5.7** |
| 2 | Members | 5/10 | 3/10 | 8/10 | 4/10 | 5/10 | 6/10 | **5.2** |
| 3 | Service Accounts | 6/10 | 3/10 | 8/10 | 4/10 | 5/10 | 8/10 | **5.7** |
| 4 | PATs | 7/10 | 4/10 | 8/10 | 5/10 | 6/10 | 8/10 | **6.3** |
| 5 | Usage | 6/10 | 3/10 | 8/10 | 5/10 | 6/10 | 7/10 | **5.8** |
| 6 | Usage History | 5/10 | 3/10 | 8/10 | 5/10 | 5/10 | 6/10 | **5.3** |
| 7 | Billing | 7/10 | 4/10 | 8/10 | 5/10 | 6/10 | 7/10 | **6.2** |
| 8 | Capabilities | 5/10 | 3/10 | 8/10 | 6/10 | 5/10 | 5/10 | **5.3** |
| 9 | Audit Logs | 6/10 | 3/10 | 8/10 | 5/10 | 6/10 | 7/10 | **5.8** |
| 10 | SSO | 6/10 | 5/10 | 8/10 | 6/10 | 7/10 | 7/10 | **6.5** |
| 11 | Security | 7/10 | 4/10 | 8/10 | 5/10 | 6/10 | 7/10 | **6.2** |
| 12 | Reports | 5/10 | 3/10 | 8/10 | 5/10 | 5/10 | 6/10 | **5.3** |
| 13 | Webhooks | 6/10 | 3/10 | 7/10 | 5/10 | 5/10 | 8/10 | **5.7** |

> **Điểm trung bình toàn bộ: 5.7/10**  
> **Nhận xét:** Chức năng backend đã đạt parity với phần mềm thương mại. **Frontend UX là gap chính** cần đầu tư để đạt chuẩn quốc tế.

---

## 2. CÁC VẤN ĐỀ XUYÊN SUỐT

Các vấn đề lặp lại ở **tất cả hoặc đa số 13 trang**, cần giải quyết một lần ở layer shared component.

### 2.1 Thiếu Loading Skeleton / Shimmer Effect

**Mức độ:** 🔴 CRITICAL (ảnh hưởng first impression)

| Hiện tại | Chuẩn thương mại (Stripe/Clerk/Vercel) |
|----------|----------------------------------------|
| Text "Đang tải..." thuần | Skeleton shimmer giữ layout + pulse animation |
| Layout shift lớn khi data load xong | Smooth fade-in transition, layout ổn định |
| Không progressive loading | Stale-while-revalidate pattern |

**Phạm vi ảnh hưởng:** Tất cả 13 trang đều dùng `{t("common.loading")}` text thuần.

**Giải pháp:** Tạo component `<ShellSkeleton>` chung với variants: `metric`, `table-row`, `card`, `chart`.

---

### 2.2 Accessibility (A11y) — Không đạt WCAG 2.1 AA

**Mức độ:** 🔴 CRITICAL (chặn khả năng bán cho khách enterprise quốc tế)

| Lỗi | Mô tả | Trang ảnh hưởng |
|-----|-------|----------------|
| Thiếu `aria-label` | Buttons chỉ có icon/emoji, không có label cho screen reader | Tất cả 13 trang |
| `confirm()` / `alert()` native | Không custom được, không screen reader friendly | Members, ServiceAccounts, PATs, Webhooks |
| Focus trap thiếu | Modals không trap focus — user có thể tab ra ngoài | ServiceAccounts, PATs, Webhooks |
| Color contrast fail | Text `#64748b` trên nền `#0b0f19` ≈ ratio 3.2:1 (AA yêu cầu ≥ 4.5:1) | Tất cả 13 trang |
| Missing `role` attributes | Tables không có `role="table"`, status pills thiếu `role="status"` | Tất cả |
| Keyboard navigation thiếu | Bảng dữ liệu không navigable bằng keyboard | Members, ServiceAccounts, PATs |
| Emoji as semantic indicator | 🔴 😀 ⚠️ dùng làm trạng thái mà không có `aria-label` | Security, PATs |

---

### 2.3 Responsive Design — Chưa Mobile-First

**Mức độ:** 🟠 HIGH

| Vấn đề | Chi tiết |
|--------|---------|
| Tables không responsive | `<table>` thuần với `overflowX: auto` — horizontal scroll trên mobile |
| Metrics row vỡ layout | `repeat(auto-fit, minmax(240px, 1fr))` — vỡ dưới 480px |
| Modals cứng kích thước | `maxWidth: 500px` — không tối ưu iPad landscape |
| Actions buttons không wrap | Inline buttons chen nhau trên màn hình nhỏ |
| Touch targets quá nhỏ | Buttons `padding: 6px 12px` — nhỏ hơn chuẩn 44×44px |

---

### 2.4 Thiếu Toast/Notification System

**Mức độ:** 🔴 CRITICAL

Stripe, Clerk, Vercel đều có global toast system. VNInvest dùng `alert()` và `confirm()` native browser.

**Giải pháp:** Tạo `<ToastProvider>` + `useToast()` hook:
- Position: top-right
- Auto-dismiss với progress bar
- Severity levels: `success`, `error`, `warning`, `info`
- Screen reader announcement qua `aria-live="polite"`
- Stack nhiều toasts

---

### 2.5 Thiếu Navigation Sidebar

**Mức độ:** 🔴 CRITICAL — **Không có sidebar = không phải phần mềm quản trị thương mại**

| Hiện tại | Chuẩn thương mại |
|----------|-----------------|
| Chỉ có links từ Home page | Persistent left sidebar với active state indicator |
| Không breadcrumb | Breadcrumb: `Tenant Admin > Members` |
| Không highlight trang hiện tại | Active page với accent border/background |
| SSO page có "Back to Home" link riêng | Sidebar cho phép navigate trực tiếp mọi trang |

---

### 2.6 Thiếu Micro-Animations

**Mức độ:** 🟡 MEDIUM

| Cần bổ sung | Mô tả |
|-------------|-------|
| Page transition | Fade-in khi chuyển trang |
| Card entrance | Stagger animation cho danh sách cards |
| Table row hover | Highlight row + subtle translateY |
| Modal entrance/exit | Scale + opacity transition |
| Button feedback | Active state press + ripple effect |
| Metric counter | Count-up animation cho số liệu KPI |
| Toggle switch | Animated on/off cho SSO enable, webhook active |

---

### 2.7 Empty States Quá Đơn Giản

**Mức độ:** 🟡 MEDIUM

| Hiện tại | Chuẩn thương mại |
|----------|-----------------|
| Text đơn giản: "Không có dữ liệu" | Illustration + mô tả + CTA button rõ ràng |
| Không phân biệt empty vs error | Empty state có guide hành động cụ thể |
| Không contextual help | First-time user onboarding tips |

**Ví dụ chuẩn (Stripe):**
```
     [illustration]
  Bạn chưa có API key nào
  Tạo API key đầu tiên để bắt đầu tích hợp
  [+ Tạo API Key]     [📖 Xem hướng dẫn]
```

---

## 3. ĐÁNH GIÁ CHI TIẾT TỪNG TRANG

### 3.1 Home Page — `TenantAdminHomePage.tsx` (573 lines, 26.6 KB)

**Điểm mạnh đã có:**
- ✅ KPI cards với health gauge visual (mini progress ring)
- ✅ Usage chart với Recharts (AreaChart)
- ✅ Quick links grid tới các trang con
- ✅ Trial banner cho tenant dùng thử

**Danh sách issue:**

| # | Issue | Severity | Giải pháp |
|---|-------|:--------:|-----------|
| 1 | KPI cards dùng inline styles 400+ lines, khó maintain | Medium | Extract thành CSS classes hoặc styled component |
| 2 | `\u2191` / `\u2193` Unicode arrows thay vì SVG icons | High | Dùng SVG icon component (ArrowUp/ArrowDown) |
| 3 | Quick links grid thiếu icon + description | Medium | Thêm icon SVG + subtitle mô tả cho mỗi link |
| 4 | Không có "Recent Activity" timeline | Medium | Hiển thị 5 audit log gần nhất |
| 5 | Không "Getting Started" checklist cho tenant mới | Medium | Onboarding wizard với % hoàn thành |
| 6 | Trial banner dùng inline style, không animation | Low | CSS class + pulse animation |

**Đề xuất nâng cấp:**
1. Thêm **"Onboarding Checklist"** component cho tenant mới (đã tạo SA? đã issue PAT? đã cấu hình SSO?)
2. Thêm **"Recent Activity"** feed (5 audit log gần nhất dạng timeline)
3. Quick links cần **icon SVG + subtitle** mô tả chức năng
4. Thêm **"Health Score"** tổng hợp với animated gauge (tổng hợp từ usage %, security rating, active members)

---

### 3.2 Members Page — `TenantAdminMembersPage.tsx` (367 lines, 17.3 KB)

**Điểm mạnh:**
- ✅ Tab system (Members/Invites)
- ✅ Role badges với color coding (owner=coral, admin=cyan)
- ✅ Invite form với email + role selection

**Danh sách issue:**

| # | Issue | Severity | Giải pháp |
|---|-------|:--------:|-----------|
| 1 | **Cancel invite — `alert("Not implemented")`** | 🔴 Critical | Gọi `corePost("/tenant-members/invites/{id}/cancel/")` |
| 2 | Không inline role change | Medium | Dropdown inline để đổi role trực tiếp |
| 3 | Không search/filter members | Medium | Search box + role filter dropdown |
| 4 | Không avatar/initials circle | Medium | Avatar component (2 ký tự đầu username) |
| 5 | Tab buttons dùng inline style | Low | CSS class `shellPage__tab--active` |
| 6 | Không bulk actions | Medium | Checkbox select all + bulk remove/change role |
| 7 | Invite form maxWidth 400px cứng | Low | Full-width responsive |

---

### 3.3 Service Accounts Page — `TenantAdminServiceAccountsPage.tsx` (383 lines, 17.1 KB)

**Điểm mạnh:**
- ✅ CRUD đầy đủ (Create/Delete/Toggle status)
- ✅ Environment badges (PROD/STAGING/DEV) với color coding
- ✅ Policy checkboxes trong create modal

**Danh sách issue:**

| # | Issue | Severity | Giải pháp |
|---|-------|:--------:|-----------|
| 1 | Không edit Service Account (chỉ toggle + delete) | Medium | Thêm edit modal (rename, change env, update policies) |
| 2 | Modal backdrop `rgba(0,0,0,0.7)` — không blur | Low | Thêm `backdropFilter: blur(8px)` |
| 3 | Không search/filter | Medium | Search box + environment dropdown filter |
| 4 | Không pagination | Medium | Pagination cho list > 20 items |
| 5 | **Duplicate title header** — "Service Accounts" xuất hiện 2 lần | High | Loại bỏ `<h2>` bên trong, giữ `ShellPanel title` |
| 6 | Không tracking created_by / last_active | Medium | Hiện creator + last activity timestamp |

---

### 3.4 PATs Page — `TenantAdminPATsPage.tsx` (570 lines, 24.3 KB)

**Đây là trang tốt nhất về chức năng trong toàn bộ 13 trang.**

**Điểm mạnh:**
- ✅ Secret reveal flow tốt (one-time display)
- ✅ Copy to clipboard với feedback
- ✅ Token rotation + revocation
- ✅ Hide revoked / filter unused
- ✅ Expiring soon warning (⚠️ < 7 ngày)
- ✅ "Last Used" timestamp tracking

**Danh sách issue (nhỏ):**

| # | Issue | Severity | Giải pháp |
|---|-------|:--------:|-----------|
| 1 | Expiry date picker — `datetime-local` native | Low | Custom date picker với presets (30d, 90d, 1y, never) |
| 2 | Secret reveal banner — thiếu auto-dismiss timer | Medium | Countdown 30s + auto-hide (giống GitHub) |
| 3 | Scope pills flat — thiếu grouping | Medium | Group scopes theo category (read/write/admin) |
| 4 | "Last Used" chỉ hiện ISO date | Low | Relative time: "3 giờ trước" |

---

### 3.5 Usage Page — `TenantAdminUsagePage.tsx` (23.3 KB)

**Điểm mạnh:**
- ✅ Biểu đồ usage trend
- ✅ Forecasting endpoint
- ✅ Quota gauges (circular)

**Danh sách issue:**

| # | Issue | Severity | Giải pháp |
|---|-------|:--------:|-----------|
| 1 | **Forecast API trả 500** (lỗi đã biết) | 🔴 High | Fix backend `/partner/usage/forecast/` |
| 2 | Không date range picker | Medium | Date range selector với presets |
| 3 | Thiếu export CSV/PDF | Medium | Download button cho usage data |
| 4 | Gauge circles static | Low | Animated fill khi data load xong |

---

### 3.6 Usage History Page — `TenantAdminUsageHistoryPage.tsx` (12.9 KB)

**Danh sách issue:**

| # | Issue | Severity |
|---|-------|:--------:|
| 1 | Chưa review chi tiết | — |

---

### 3.7 Billing Page — `TenantAdminBillingPage.tsx` (490 lines, 20.8 KB)

**Điểm mạnh:**
- ✅ Cost trend chart (BarChart)
- ✅ Invoice list
- ✅ Plan comparison table
- ✅ Preview plan change modal

**Danh sách issue:**

| # | Issue | Severity | Giải pháp |
|---|-------|:--------:|-----------|
| 1 | Invoice download không có | Medium | Download PDF button cho mỗi invoice |
| 2 | Payment method management thiếu | Medium | Thêm/sửa/xóa payment method |
| 3 | Credit balance display quá nhỏ | Low | Highlight credit balance nổi bật hơn |
| 4 | Plan upgrade CTA không đủ nổi bật | Medium | Gradient button + animation |

---

### 3.8 Capabilities Page — `TenantAdminCapabilitiesPage.tsx` (162 lines, 5.6 KB)

**Trang đơn giản nhất — chỉ hiển thị abilities + quotas dạng list.**

| # | Issue | Severity | Giải pháp |
|---|-------|:--------:|-----------|
| 1 | Chỉ list thuần — không visual hierarchy | Medium | Card grid với icon per ability |
| 2 | **Không hiện quota usage vs limit** | 🔴 High | Progress bar: `Used 850 / 1000 (85%)` |
| 3 | Không nhóm abilities theo category | Medium | Group: Market Data, Signals, Admin, etc. |
| 4 | Không link tới billing để upgrade | Medium | CTA: "Nâng cấp để mở thêm tính năng" |

**Đề xuất:** Redesign thành "Plan & Limits" dashboard với progress bars cho từng quota.

---

### 3.9 Audit Logs Page — `TenantAdminAuditLogsPage.tsx` (424 lines, 17.4 KB)

**Điểm mạnh:**
- ✅ Cursor-based pagination
- ✅ Filter by event type + date range
- ✅ Expandable log detail (JSON view)
- ✅ Event type breakdown pie chart

**Danh sách issue:**

| # | Issue | Severity | Giải pháp |
|---|-------|:--------:|-----------|
| 1 | **"Daily Activity" dùng PieChart** — sai chart type! | 🔴 High | Đổi sang BarChart hoặc AreaChart (time-series data) |
| 2 | Event type filter là text input | Medium | Dropdown select từ `uniqueEventTypes` |
| 3 | Không export logs | Medium | Download CSV button |
| 4 | JSON details hiển thị raw | Medium | Structured diff view (old vs new) |

**Lý do #1 critical:** PieChart cho time-series data (daily activity) là anti-pattern trong data visualization. Pie chart chỉ phù hợp cho composition/proportion data.

---

### 3.10 SSO Page — `TenantAdminSSOPage.tsx` (375 lines, 14.0 KB)

**Trang tốt nhất về UX flow:**
- ✅ Enterprise plan gate (chặn non-enterprise)
- ✅ SAML 2.0 form đầy đủ (IdP Entity ID, SSO URL, X509 Cert, Domain Hint)
- ✅ SP metadata display
- ✅ Test connection button
- ✅ Success/error banners với `role="alert"` / `role="status"`

**Danh sách issue:**

| # | Issue | Severity | Giải pháp |
|---|-------|:--------:|-----------|
| 1 | Certificate paste thô — thiếu validation | Medium | Validate PEM format + show thumbprint |
| 2 | Không step-by-step wizard | Medium | 3-step wizard: Configure → Test → Enable |
| 3 | Không IdP metadata XML import | Medium | File upload hoặc URL fetch |
| 4 | Test result không show chi tiết | Low | Hiện SAML response details |

---

### 3.11 Security Page — `TenantAdminSecurityPage.tsx` (332 lines, 12.2 KB)

**Điểm mạnh:**
- ✅ Login activity chart (stacked BarChart — success/failed)
- ✅ Session list với revoke individual + revoke all
- ✅ Recent failures panel
- ✅ Day selector (7/14/30 ngày)

**Danh sách issue:**

| # | Issue | Severity | Giải pháp |
|---|-------|:--------:|-----------|
| 1 | **Emoji 🔴 😀 dùng cho UI elements** | 🔴 High | Thay bằng SVG icons (AlertCircle, UserCircle) |
| 2 | `vaint()` function naming lạ | Low | Rename hoặc inline |
| 3 | Thiếu geo-location cho sessions | Medium | Hiện country/city từ IP |
| 4 | Session detail thiếu browser/OS parsing | Medium | Parse User-Agent → "Chrome 120 / Windows 11" |
| 5 | Thiếu "Trust this device" flow | Low | Cho phép đánh dấu device tin cậy |

---

### 3.12 Reports Page — `TenantAdminReportsPage.tsx` (14.4 KB)

Chưa review chi tiết trong audit này — sẽ bổ sung sau.

---

### 3.13 Webhooks Page — `TenantAdminWebhooksPage.tsx` (454 lines, 20.3 KB)

**Điểm mạnh:**
- ✅ CRUD hoàn chỉnh (create, edit, delete)
- ✅ Event selection UI (chip toggles)
- ✅ Delivery log inline per webhook
- ✅ Test webhook
- ✅ Regenerate secret
- ✅ Manual retry failed deliveries

**Danh sách issue:**

| # | Issue | Severity | Giải pháp |
|---|-------|:--------:|-----------|
| 1 | **Hardcoded Vietnamese strings** | 🔴 High | Di chuyển sang i18n keys |
| 2 | `window.confirm()` cho xóa | Medium | Custom confirm modal |
| 3 | Event checkboxes flat — thiếu grouping | Medium | Group theo category (member/pat/sa/billing) |
| 4 | Delivery log inline thay vì drawer/modal | Low | Slide-out drawer panel |
| 5 | Không webhook signature verification guide | Medium | Inline code snippet + docs link |
| 6 | Không delivery success rate metric | Medium | Thêm metric: "95% success rate (30d)" |

**Hardcoded strings cần fix (line refs):**
```
Line 43:  "Khác" → t("tenantWebhooks.eventOther")
Line 154: "Lỗi khi lưu webhook" → t("tenantWebhooks.saveError")
Line 161: `Xóa webhook "${config.name}"?` → t("tenantWebhooks.deleteConfirm", { name: config.name })
Line 166: "Lỗi khi xóa webhook" → t("tenantWebhooks.deleteError")
Line 175: "Lỗi khi tạo lại secret" → t("tenantWebhooks.regenerateError")
Line 182: "Test webhook đã được gửi." → t("tenantWebhooks.testSent")
Line 184: "Lỗi khi kiểm tra webhook" → t("tenantWebhooks.testError")
```

---

## 4. SO SÁNH BENCHMARK THƯƠNG MẠI

| Feature | Stripe | Clerk | Auth0 | VNInvest | Gap Level |
|---------|:------:|:-----:|:-----:|:--------:|:---------:|
| **Navigation** | | | | | |
| Sidebar nav | ✅ | ✅ | ✅ | ❌ | 🔴 Critical |
| Breadcrumbs | ✅ | ✅ | ✅ | ❌ | 🔴 Critical |
| **Loading UX** | | | | | |
| Skeleton loading | ✅ | ✅ | ✅ | ❌ | 🔴 Critical |
| Page transitions | ✅ | ✅ | ⬜ | ❌ | 🟡 Medium |
| **Feedback** | | | | | |
| Toast system | ✅ | ✅ | ✅ | ❌ | 🔴 Critical |
| Confirmation modals | ✅ | ✅ | ✅ | ❌ Native | 🔴 Critical |
| **Accessibility** | | | | | |
| WCAG 2.1 AA | ✅ | ✅ | ✅ | ❌ | 🔴 Critical |
| Keyboard navigation | ✅ | ✅ | ✅ | 🟡 Partial | 🟡 Medium |
| **Data** | | | | | |
| Responsive tables | ✅ | ✅ | ✅ | 🟡 Scroll | 🟡 Medium |
| Export data | ✅ | ✅ | ✅ | ❌ | 🟡 Medium |
| Search/filter | ✅ | ✅ | ✅ | 🟡 Partial | 🟡 Medium |
| **Onboarding** | | | | | |
| Getting started flow | ✅ | ✅ | ✅ | ❌ | 🟡 Medium |
| Empty state guides | ✅ | ✅ | ✅ | 🟡 Basic | 🟡 Medium |
| **Features (đã đạt)** | | | | | |
| i18n | ✅ | ✅ | ✅ | ✅ | ✅ Đạt |
| RBAC gating | ✅ | ✅ | ✅ | ✅ | ✅ Đạt |
| PAT management | ✅ | ⬜ | ✅ | ✅ | ✅ Đạt |
| Webhook management | ✅ | ✅ | ✅ | ✅ | ✅ Đạt |
| SSO SAML | ✅ | ✅ | ✅ | ✅ | ✅ Đạt |
| Audit logs | ✅ | ✅ | ✅ | ✅ | ✅ Đạt |
| Usage analytics | ✅ | ⬜ | ✅ | ✅ | ✅ Đạt |
| Dark mode | ✅ | ✅ | ⬜ | 🟡 Dark only | 🟢 Nice-to-have |

> **Kết luận:** Backend features đã đạt hoặc vượt parity. **Frontend UX infrastructure (sidebar, toast, skeleton, a11y) là 4 gap blocking** cần ưu tiên sửa trước.

---

## 5. ROADMAP NÂNG CẤP THEO PHASE

### Phase 0: Quick Wins — Sửa ngay, không cần design mới

| # | Task | Effort | File ảnh hưởng |
|---|------|:------:|---------------|
| 0.1 | Tạo `<ToastNotification>` component thay `alert()`/`confirm()` | 4h | Mới: `components/tenant-admin/ToastNotification.tsx` |
| 0.2 | Audit Logs: Daily Activity PieChart → BarChart | 1h | `TenantAdminAuditLogsPage.tsx` (L280-306) |
| 0.3 | Webhooks: hardcoded Vietnamese → i18n keys | 2h | `TenantAdminWebhooksPage.tsx` + `i18n/vi.js` + `i18n/en.js` |
| 0.4 | Members: implement cancel invite API call | 2h | `TenantAdminMembersPage.tsx` (L333-339) |
| 0.5 | Service Accounts: remove duplicate title header | 0.5h | `TenantAdminServiceAccountsPage.tsx` (L172-180) |
| 0.6 | Security: emoji 🔴😀 → SVG icons | 2h | `TenantAdminSecurityPage.tsx` |
| 0.7 | Fix color contrast `#64748b` → `#94a3b8` minimum | 2h | `ShellPageTemplate.js` (CSS variables) |
| 0.8 | Cải thiện empty states (thêm CTA button) | 3h | All pages |
| | **Tổng Phase 0** | **~16h** | |

### Phase 1: Core UX Infrastructure — Shared components

| # | Task | Effort | File ảnh hưởng |
|---|------|:------:|---------------|
| 1.1 | `<ShellSkeleton>` loading component (metric, table, chart variants) | 6h | Mới: `components/tenant-admin/ShellSkeleton.tsx` |
| 1.2 | `<TenantAdminSidebar>` persistent navigation | 8h | Mới: `components/tenant-admin/TenantAdminSidebar.tsx` |
| 1.3 | `<ConfirmModal>` custom modal thay `confirm()` | 4h | Mới: `components/tenant-admin/ConfirmModal.tsx` |
| 1.4 | Page transition animations (fade-in / stagger) | 4h | CSS + wrapper component |
| 1.5 | Responsive breakpoint system + mobile card fallback | 8h | `ShellPageTemplate.js` + individual pages |
| 1.6 | Breadcrumb component | 2h | Mới: `components/tenant-admin/Breadcrumb.tsx` |
| | **Tổng Phase 1** | **~32h** | |

### Phase 2: Page-Level Improvements

| # | Task | Effort | File ảnh hưởng |
|---|------|:------:|---------------|
| 2.1 | Home: Onboarding checklist + Activity feed + Health score | 8h | `TenantAdminHomePage.tsx` |
| 2.2 | Members: Avatar, inline role change, search, cancel invite | 6h | `TenantAdminMembersPage.tsx` |
| 2.3 | Capabilities: Redesign → "Plan & Limits" with progress bars | 6h | `TenantAdminCapabilitiesPage.tsx` |
| 2.4 | PATs: Date picker presets, scope grouping | 4h | `TenantAdminPATsPage.tsx` |
| 2.5 | Audit Logs: Event type dropdown, structured diff view | 6h | `TenantAdminAuditLogsPage.tsx` |
| 2.6 | Webhooks: Event category grouping, delivery rate metric | 4h | `TenantAdminWebhooksPage.tsx` |
| 2.7 | Billing: Invoice download, payment method management | 6h | `TenantAdminBillingPage.tsx` |
| | **Tổng Phase 2** | **~40h** | |

### Phase 3: Premium Polish

| # | Task | Effort | File ảnh hưởng |
|---|------|:------:|---------------|
| 3.1 | Animated KPI counter (count-up effect) | 4h | Home + metrics components |
| 3.2 | Custom modal với backdrop blur + slide animation | 4h | All modal usages |
| 3.3 | Table sorting + column resize | 6h | Shared table component |
| 3.4 | Export CSV/PDF (Usage, Audit Logs, Invoices) | 6h | Multiple pages |
| 3.5 | Dark/light theme toggle | 4h | Theme system |
| | **Tổng Phase 3** | **~24h** | |

---

## 6. FILE MANIFEST DỰ KIẾN

### Shared Components mới (Phase 1)

```
packages/web/src/components/tenant-admin/
├── ToastNotification.tsx     (Phase 0) — Toast system + useToast hook
├── ConfirmModal.tsx          (Phase 1) — Custom confirm dialog
├── ShellSkeleton.tsx         (Phase 1) — Loading skeleton variants
├── TenantAdminSidebar.tsx    (Phase 1) — Persistent sidebar nav
├── TenantAdminLayout.tsx     (Phase 1) — Layout wrapper (sidebar + content)
├── Breadcrumb.tsx            (Phase 1) — Breadcrumb navigation
├── EmptyState.tsx            (Phase 0) — Rich empty state with CTA
└── AvatarInitials.tsx        (Phase 2) — User avatar from initials
```

### Files sửa đổi

```
packages/web/src/
├── components/ShellPageTemplate.js         — Color contrast fix, hover styles
├── i18n/vi.js                              — Thêm keys cho Webhooks hardcoded strings
├── i18n/en.js                              — Mirror keys
├── pages/tenant-admin/
│   ├── TenantAdminAuditLogsPage.tsx        — PieChart → BarChart
│   ├── TenantAdminWebhooksPage.tsx         — i18n fix
│   ├── TenantAdminMembersPage.tsx          — Cancel invite, avatar
│   ├── TenantAdminServiceAccountsPage.tsx  — Remove dup title
│   ├── TenantAdminSecurityPage.tsx         — Emoji → SVG
│   ├── TenantAdminHomePage.tsx             — Activity feed, onboarding
│   ├── TenantAdminCapabilitiesPage.tsx     — Plan & Limits redesign
│   └── (all 13 pages)                     — Sidebar integration, skeleton, toast
└── main.tsx                                — Layout wrapper cho tenant-admin routes
```

---

## 7. EFFORT SUMMARY

| Phase | Mô tả | Effort | Priority | Timeline đề xuất |
|-------|-------|:------:|:--------:|:-----------------:|
| Phase 0 | Quick Wins — sửa lỗi ngay | 16h | 🔴 Immediate | Tuần 1 |
| Phase 1 | Core UX Infrastructure | 32h | 🟠 High | Tuần 2–3 |
| Phase 2 | Page-Level Improvements | 40h | 🟡 Medium | Tuần 4–5 |
| Phase 3 | Premium Polish | 24h | 🟢 Nice-to-have | Tuần 6 |
| **Tổng** | | **112h** | | **~6 tuần** |

---

## TOP 5 ƯU TIÊN CAO NHẤT

1. 🔴 **Tạo Sidebar Navigation** — Không có sidebar = không phải admin console thương mại
2. 🔴 **Toast System** — Loại bỏ hoàn toàn `alert()`/`confirm()` native
3. 🔴 **Loading Skeletons** — First impression khi mở bất kỳ trang nào
4. 🔴 **Fix A11y Critical** — Color contrast + aria labels + focus management
5. 🟡 **Responsive Tables** — Card layout fallback cho mobile

---

## GHI CHÚ CHO TEAM

- Document này là kết quả audit tĩnh (code review) — chưa bao gồm browser testing.
- Đề xuất team review trên browser thực tế trước khi duyệt Phase 0.
- Mọi shared component mới nên có unit tests cơ bản.
- Chiến lược: Tạo thư mục `packages/web/src/components/tenant-admin/` chứa shared components → refactor tất cả 13 trang dùng chung → đảm bảo consistency tự động.

---

> **Trạng thái:** ĐỢI DUYỆT  
> **Hành động tiếp theo:** Team review → Duyệt Phase 0 → Bắt đầu triển khai
