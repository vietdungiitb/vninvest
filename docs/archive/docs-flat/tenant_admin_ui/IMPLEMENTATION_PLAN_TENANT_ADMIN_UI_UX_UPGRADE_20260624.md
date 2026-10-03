# Kế hoạch triển khai nâng cấp Tenant Admin UI/UX

> **Nguồn:** `docs/TENANT_ADMIN_COMMERCIAL_GRADE_AUDIT_20260624.md`  
> **Ngày lập:** 2026-06-24  
> **Tổng effort:** ~112 giờ (≈ 6 tuần)  
> **Trạng thái:** CHỜ DUYỆT

---

## Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Phụ thuộc và điều kiện tiên quyết](#2-phụ-thuộc-và-điều-kiện-tiên-quyết)
3. [Phase 0 — Quick Wins (16h)](#3-phase-0--quick-wins-16h)
4. [Phase 1 — Core UX Infrastructure (32h)](#4-phase-1--core-ux-infrastructure-32h)
5. [Phase 2 — Page-Level Improvements (40h)](#5-phase-2--page-level-improvements-40h)
6. [Phase 3 — Premium Polish (24h)](#6-phase-3--premium-polish-24h)
7. [File manifest](#7-file-manifest)
8. [Rủi ro và giảm thiểu](#8-rủi-ro-và-giảm-thiểu)
9. [Tiêu chí hoàn thành (Definition of Done)](#9-tiêu-chí-hoàn-thành-definition-of-done)

---

## 1. Tổng quan

### 1.1 Phạm vi

13 trang tenant-admin hiện tại (`packages/web/src/pages/tenant-admin/`), điểm trung bình **5.7/10** theo benchmark Stripe/Clerk/Auth0/Vercel.

### 1.2 Bốn gap chính

| Gap | Severity | Benchmark | Hiện tại |
|-----|----------|-----------|----------|
| **Sidebar navigation** | 🔴 Critical | ✅ | ❌ |
| **Toast/notification system** | 🔴 Critical | ✅ | Native `alert()`/`confirm()` |
| **Loading skeleton** | 🔴 Critical | ✅ | Text "Đang tải..." |
| **WCAG 2.1 AA** | 🔴 Critical | ✅ | ❌ (color contrast, aria, keyboard) |

---

## 2. Phụ thuộc và điều kiện tiên quyết

### 2.1 Shared components layer

Phase 1 `TenantAdminLayout.tsx` + `TenantAdminSidebar.tsx` là **blocking dependency** cho tất cả page-level improvements (Phase 2). Mọi trang phải được wrap trong layout này.

### 2.2 CSS infrastructure

Color contrast fix tại `ShellPageTemplate.js` (CSS variables) phải làm trước Phase 0.8 (empty states) và Phase 1.5 (responsive).

### 2.3 Sequence bắt buộc

```
Phase 0.7 (color contrast)
  └─ Phase 0 (các quick wins còn lại)
       └─ Phase 1 (sidebar + skeleton + toast + responsive)
            └─ Phase 2 (page refactors)
                 └─ Phase 3 (polish/animation)
```

Không được làm Phase 2 trước Phase 1 — sẽ gây rework layout.

---

## 3. Phase 0 — Quick Wins (16h)

Sửa ngay, không cần design mới, ít rủi ro.

| # | Task | Mô tả | Effort | File | Dependencies |
|---|------|-------|:------:|------|:-----------:|
| 0.1 | **ToastNotification** | Component toast + `useToast()` hook, thay `alert()`/`confirm()` ở Members, ServiceAccounts, PATs, Webhooks | 4h | `components/ShellToast.tsx` | None |
| 0.2 | **Audit Logs: PieChart → BarChart** | Daily Activity đổi từ PieChart sang BarChart (time-series data) | 1h | `TenantAdminAuditLogsPage.tsx` | None |
| 0.3 | **Webhooks: i18n hardcoded** | 7 hardcoded Vietnamese strings → i18n keys | 2h | `TenantAdminWebhooksPage.tsx` + `i18n/vi.js` + `i18n/en.js` | None |
| 0.4 | **Members: cancel invite** | Implement API call `corePost("/tenant-members/invites/{id}/cancel/")` (đang `alert("Not implemented")`) | 2h | `TenantAdminMembersPage.tsx` | Backend endpoint tồn tại? Cần kiểm tra |
| 0.5 | **Service Accounts: duplicate title** | Xoá `<h2>` duplicate trong ShellPanel | 0.5h | `TenantAdminServiceAccountsPage.tsx` | None |
| 0.6 | **Security: emoji → SVG** | Thay 🔴😀 bằng `AlertCircle`/`UserCircle` SVG icons | 2h | `TenantAdminSecurityPage.tsx` | None |
| 0.7 | **Color contrast** | Fix `#64748b` → `#94a3b8`, đảm bảo ratio ≥ 4.5:1 | 2h | `ShellPageTemplate.js` (CSS variables) | None |
| 0.8 | **Empty states** | Thêm CTA button + illustration vào empty state | 3h | 13 pages | 0.7 (color contrast) |

### 3.1 Task 0.4 — Risk note

Cancel invite gọi `POST /partner/tenant-members/invites/{id}/cancel/` — cần xác nhận backend endpoint này đã tồn tại. Nếu chưa, Phase 0.4 sẽ cần backend work (~2h extra).

---

## 4. Phase 1 — Core UX Infrastructure (32h)

Tạo shared components layer. **Blocking dependency cho Phase 2.**

| # | Task | Mô tả | Effort | File | Dependencies |
|---|------|-------|:------:|------|:-----------:|
| 1.1 | **ShellSkeleton** | Loading skeleton variants: `metric` (hình chữ nhật + pulse), `table-row` (5 dòng), `chart` (khuôn biểu đồ), `card` | 6h | `components/ShellSkeleton.tsx` | None |
| 1.2 | **TenantAdminSidebar** | Persistent left sidebar: icon + label + active state + route config | 8h | `components/TenantAdminSidebar.tsx` | 0.7 (contrast variables) |
| 1.3 | **ConfirmModal** | Custom confirm dialog (thay `window.confirm()`) với focus trap, keyboard ESC, `aria-modal` | 4h | `components/ConfirmModal.tsx` | 0.1 (ToastNotification style) |
| 1.4 | **Page transitions** | CSS fade-in + stagger animation wrapper | 4h | `components/PageTransition.tsx` + CSS | 1.2 (cần layout wrapper) |
| 1.5 | **Responsive breakpoint system** | Mobile card fallback cho tables, touch target ≥ 44×44px | 8h | `ShellPageTemplate.js` + individual pages | 1.2, 0.7 |
| 1.6 | **Breadcrumb** | Component breadcrumb tự động từ route config | 2h | `components/Breadcrumb.tsx` | 1.2 (RouteProvider) |

### 4.1 Layout architecture

```
<ShellPageChrome>          ← hiện tại
  <TenantAdminSidebar />   ← mới (persistent)
  <main>
    <Breadcrumb />         ← mới
    <PageTransition>       ← mới
      {children}           ← page content
    </PageTransition>
  </main>
</ShellPageChrome>
```

### 4.2 Route integration

Thêm layout wrapper trong `main.tsx` cho tất cả `/tenant-admin/*` routes. Không wrap route không liên quan (login, register, public pages).

### 4.3 Responsive strategy

| Breakpoint | Layout | Table |
|------------|--------|-------|
| ≥ 1024px | Sidebar + content | Full table |
| 768–1023px | Collapsed sidebar (icons only) | Table + horizontal scroll |
| < 768px | Bottom nav bar | Card list fallback |

---

## 5. Phase 2 — Page-Level Improvements (40h)

Cải thiện từng trang sau khi có shared infrastructure.

| # | Trang | Task | Effort | Dependencies |
|---|-------|------|:------:|:------------:|
| 2.1 | Home | Onboarding checklist + Activity feed + Health score gauge animated | 8h | 1.2 (sidebar đã active) |
| 2.2 | Members | Avatar initials, inline role dropdown, search box + role filter | 6h | 1.3 (ConfirmModal cho remove) |
| 2.3 | Capabilities | Redesign → "Plan & Limits" với progress bar per quota, link upgrade CTA | 6h | 1.5 (responsive cards) |
| 2.4 | PATs | Date picker presets (30d/90d/1y/never), scope grouping theo category | 4h | 1.3 (ConfirmModal) |
| 2.5 | Audit Logs | Event type filter dropdown (từ `uniqueEventTypes`), structured diff view | 6h | 1.2 (sidebar nav) |
| 2.6 | Webhooks | Event category grouping, delivery success rate metric | 4h | 1.2, 1.3 |
| 2.7 | Billing | Invoice download button, payment method management | 6h | 1.2, 1.5 |

### 5.1 2.3 — Capabilities redesign detail

Hiện tại: list abilities dạng text. Thay bằng card grid:

```
┌─────────────────────┬─────────────────────┐
│ 📊 Market Data      │ 🔔 Alerts           │
│ Used: 850 / 1000    │ Used: 12 / 50       │
│ ████████████░░░ 85% │ ████░░░░░░░░░ 24%  │
│ [Upgrade]           │ [Upgrade]           │
├─────────────────────┼─────────────────────┤
│ 👥 Team Members     │ 🔌 API Calls        │
│ Used: 3 / 5         │ Used: 1,234 / 10k   │
│ ██████░░░░░░░░░ 60% │ █░░░░░░░░░░░░░░ 12% │
│ [Upgrade]           │ [Upgrade]           │
└─────────────────────┴─────────────────────┘
```

### 5.2 2.1 — Home page additions

- **Onboarding Checklist:** CTA progress (đã tạo SA? PAT? SSO?) — data từ `abilities` endpoint
- **Activity Feed:** 5 audit log gần nhất dạng timeline — reuse `AuditLogsPage` backend
- **Health Score:** Tổng hợp từ usage %, security rating, active members — cần backend compute

---

## 6. Phase 3 — Premium Polish (24h)

Tinh chỉnh animation, interactivity.

| # | Task | Effort | Mô tả kỹ thuật |
|---|------|:------:|----------------|
| 3.1 | Animated KPI counter | 4h | Count-up animation khi metric xuất hiện trong viewport (IntersectionObserver + requestAnimationFrame) |
| 3.2 | Custom modal backdrop blur | 4h | `backdropFilter: blur(8px)` + scale-in/slide-up animation cho modal entrance |
| 3.3 | Table sorting + column resize | 6h | Click header để sort asc/desc, drag column border để resize |
| 3.4 | Export CSV/PDF | 6h | Usage (CSV), Audit Logs (CSV), Invoices (PDF) — dùng `papaparse` + `jspdf` |
| 3.5 | Dark/light theme toggle | 4h | CSS custom properties + localStorage persistence |

---

## 7. File manifest

### Files mới (shared components)

```
packages/web/src/components/
├── ShellToast.tsx           (0.1) — Toast system
├── ShellSkeleton.tsx        (1.1) — Loading skeleton
├── TenantAdminSidebar.tsx   (1.2) — Persistent sidebar
├── ConfirmModal.tsx         (1.3) — Custom confirm
├── PageTransition.tsx       (1.4) — Fade-in wrapper
├── Breadcrumb.tsx           (1.6) — Breadcrumb nav
└── AvatarInitials.tsx       (2.2) — User avatar
```

### Files sửa đổi

```
packages/web/src/
├── components/ShellPageTemplate.js       — 0.7 contrast, 1.5 responsive
├── i18n/vi.js                            — 0.3 webhooks keys
├── i18n/en.js                            — 0.3 webhooks keys
├── pages/tenant-admin/
│   ├── TenantAdminHomePage.tsx           — 2.1
│   ├── TenantAdminMembersPage.tsx        — 0.4, 2.2
│   ├── TenantAdminServiceAccountsPage.tsx — 0.5
│   ├── TenantAdminPATsPage.tsx           — 2.4
│   ├── TenantAdminUsagePage.tsx          — 3.4 export
│   ├── TenantAdminUsageHistoryPage.tsx   — 3.4 export
│   ├── TenantAdminBillingPage.tsx        — 2.7, 3.4
│   ├── TenantAdminCapabilitiesPage.tsx   — 2.3
│   ├── TenantAdminAuditLogsPage.tsx      — 0.2, 2.5, 3.4
│   ├── TenantAdminSSOPage.tsx            — 1.2 sidebar
│   ├── TenantAdminSecurityPage.tsx       — 0.6, 1.2 sidebar
│   ├── TenantAdminReportsPage.tsx        — 1.2 sidebar
│   └── TenantAdminWebhooksPage.tsx       — 0.3, 2.6
└── main.tsx                              — 1.2 layout wrapper
```

---

## 8. Rủi ro và giảm thiểu

| # | Rủi ro | Khả năng | Tác động | Giảm thiểu |
|---|--------|:--------:|:--------:|-----------|
| R1 | Backend cancel-invite endpoint chưa tồn tại | Medium | Cao (block 0.4) | Kiểm tra ngay đầu Phase 0; nếu thiếu, chuyển 0.4 xuống Phase 2 và implement backend song song |
| R2 | Sidebar breaking change với route cấu hình | Thấp | Cao | Test tất cả 13 routes sau khi wrap layout; CI pipeline |
| R3 | Responsive breakpoint ảnh hưởng existing users | Trung bình | Trung bình | Chỉ thay đổi CSS, không HTML structure; visual regression test |
| R4 | ConfirmModal không bắt hết `window.confirm()` cũ | Trung bình | Thấp | Grep toàn bộ codebase tìm `confirm(` và `alert(` sau Phase 0.1 |
| R5 | Phase 3 scope creep (thêm animation không cần thiết) | Cao | Thấp | Chỉ làm đúng 5 task trong spec; không mở rộng |

### R1 — Backend check

```bash
# Kiểm tra cancel-invite endpoint tồn tại
grep -r "cancel" packages/core/backend/src/identity_access/tenant_member_views.py
grep -r "invites.*cancel" packages/core/backend/src/identity_access/partner_urls.py
```

---

## 9. Tiêu chí hoàn thành (Definition of Done)

### Mỗi phase

- [ ] `npx tsc --noEmit`: 0 errors
- [ ] `npm run build`: thành công
- [ ] `python manage.py check`: 0 issues mới
- [ ] Không `alert()` / `confirm()` native còn sót (grep xác nhận)
- [ ] i18n keys đầy đủ cho mọi text mới (cả vi.js + en.js)

### Phase 0 cụ thể

- [ ] 0.1: Toast xuất hiện đúng position top-right, auto-dismiss, có progress bar
- [ ] 0.2: Daily Activity chart là BarChart (không còn PieChart)
- [ ] 0.3: Webhooks page không còn hardcoded Vietnamese strings
- [ ] 0.4: Cancel invite không còn `alert("Not implemented")`
- [ ] 0.5: Service Accounts page chỉ còn 1 "Service Accounts" title
- [ ] 0.6: Security page không còn emoji làm semantic indicator
- [ ] 0.7: Color contrast ratio ≥ 4.5:1 trên tất cả text
- [ ] 0.8: Empty states có illustration + CTA button

### Phase 1 cụ thể

- [ ] 1.1: Skeleton loading xuất hiện ngay lập tức, pulse animation
- [ ] 1.2: Sidebar hiển thị trên tất cả 13 trang tenant-admin
- [ ] 1.3: ConfirmModal có focus trap, ESC đóng, `aria-modal="true"`
- [ ] 1.4: Page transition smooth, không giật layout
- [ ] 1.5: Tables trên mobile → card list, touch target ≥ 44×44px
- [ ] 1.6: Breadcrumb hiển thị đúng path hierarchy

### Gate cho Phase 1 → Phase 2

Phase 1 phải pass tất cả DoD trước khi bắt đầu Phase 2. Không làm song song.

---

## Phụ lục A: Effort tóm tắt

| Phase | Task count | Effort (giờ) | Ngày làm việc | Tuần |
|-------|:----------:|:------------:|:--------------:|:----:|
| Phase 0 | 8 | 16 | 2 | Tuần 1 |
| Phase 1 | 6 | 32 | 4 | Tuần 2–3 |
| Phase 2 | 7 | 40 | 5 | Tuần 4–5 |
| Phase 3 | 5 | 24 | 3 | Tuần 6 |
| **Total** | **26** | **112** | **14** | **~6 tuần** |

## Phụ lục B: Benchmark score target

| Chỉ số | Hiện tại | Target Phase 0 | Target Phase 1 | Target Phase 2 | Target Phase 3 |
|--------|:--------:|:--------------:|:--------------:|:--------------:|:--------------:|
| UI/UX | 5.9/10 | 6.5/10 | 7.5/10 | 8.0/10 | 8.5/10 |
| A11y | 3.3/10 | 4.0/10 | 6.0/10 | 7.5/10 | 8.0/10 |
| i18n | 7.8/10 | 8.0/10 | 8.0/10 | 8.5/10 | 8.5/10 |
| Responsive | 5.0/10 | 5.5/10 | 7.0/10 | 8.0/10 | 8.5/10 |
| Error Handling | 5.5/10 | 6.5/10 | 7.5/10 | 8.0/10 | 8.5/10 |
| Feature Parity | 6.8/10 | 7.0/10 | 7.5/10 | 8.0/10 | 8.5/10 |
| **Overall** | **5.7/10** | **6.3/10** | **7.3/10** | **8.0/10** | **8.4/10** |
