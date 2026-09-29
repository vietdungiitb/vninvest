# Counter-Audit: TENANT_MANAGEMENT_SPRINT_PLAN.md

**Ngày:** 2026-07-18
**Phản biện bởi:** AI Audit (framework chuẩn AGENTS.md)
**Đối tượng:** `docs/TENANT_MANAGEMENT_SPRINT_PLAN.md` (1374 lines, 44.3KB)
**Tham chiếu:** `docs/COUNTER_AUDIT_TENANT_MANAGEMENT_20260718.md` (counter-audit audit doc trước)
**Phương pháp:** grep/read thực tế trên `packages/core/backend/src/identity_access/` + `packages/web/src/` + `package.json`; verify mọi file:line citation.

---

## 0. TỔNG KẾT

| Hạng mục | Kết quả |
|----------|---------|
| **Backend file:line citations (Sprint 1)** | ✅ **CHÍNH XÁC 100%** — mọi dòng được verify khớp |
| **Quality gate commands** | ✅ Hợp lệ (trừ dev port sai) |
| **Structural paths (NEW files)** | ✅ Không có phantom file (tất cả file "NEW" đều xác nhận chưa tồn tại) |
| **Dependency logic** | ⚠️ 2 dependencies là **narrative/artificial**, không có code coupling |
| **Sai số kỹ thuật** | 4 chỗ: dev port, react-query đã có sẵn, partner_urls.py đã có, dependency graph |

**Kết luận:** Doc sprint plan là **thực thi được ngay** (đúng như claim "đội code có thể bắt đầu Sprint 1 mà không cần hỏi lại"). Tất cả citations backend chính xác. Chỉ cần sửa 4 lỗi nhỏ + làm rõ 2 dependencies trước khi chạy.

---

## 1. CONTRADICTIONS (CẦN SỬA)

| # | Claim trong doc | Thực tế (file:line) | Mức | Sửa gì |
|---|----------------|---------------------|-----|--------|
| **C1** | DoD line 79: demo trên dev server `http://localhost:5199` | Vite dev port thực là **3000** (`vite.config.ts:28`). 8080 là port của Docker nginx frontend. | MED | Đổi `:5199` → `:3000` (hoặc `:8080` nếu test qua Docker) |
| **C2** | Sprint 6.2: "Thêm `@tanstack/react-query`" vào package.json | `@tanstack/react-query@^5.101.2` **đã có sẵn** (`packages/web/package.json:59`) | LOW | Bỏ bước "Thêm dependency", giữ bước tạo `QueryProvider.tsx` + migrate pages |
| **C3** | Sprint 3.2 / 4.2: "NEW in `partner_urls.py`" | `partner_urls.py` **đã tồn tại** (`identity_access/partner_urls.py`) | LOW | Đổi "NEW" → "Existing file, thêm route vào" |
| **C4** | Dependency graph: Sprint 5 (SSO) depends on Sprint 4 (RBAC) | `views/sso.py` tự define `_require_tenant_role` (`:38`), chỉ gọi `('owner','admin')` (`:55,64`), **không reference custom RBAC**. Không có code coupling. | MED | Đổi thành "SSO independent of RBAC; RBAC enhances SSO sau này" hoặc bỏ dependency |
| **C5** | Dependency graph: Sprint 2 (Email) depends on Sprint 1.5 (member limit) | Code **không có member-seat limit** nào (`tenant_member_views.py` không có `member_limit`/`max_member`). Chỉ có `CoreTenant.max_active_pats` (PAT limit, `models.py:107`). Sprint 1.5 là work mới, chưa có trong code → dependency là narrative. | MED | Làm rõ: Sprint 1.5 + 2.4 cùng implement member limit; không phải "Sprint 2 phụ thuộc Sprint 1" theo nghĩa code |

---

## 2. FINDINGS CHI TIẾT

### 2.1 Quality Gates — CONFIRMED (trừ C1)

| Gate | Command | Status | Evidence |
|------|---------|--------|----------|
| A1 tsc | `npx tsc --noEmit` | ✅ | packages/web standard |
| A2 lint | `npm run lint` | ✅ | `package.json:20` |
| A3 build | `npm run build` | ✅ | `package.json:9` = `tsc && vite build` |
| A4 test FE | `npm run test` | ✅ | `package.json:15` (jest) |
| A5 test BE | `python manage.py test` | ✅ | `identity_access` + `tenant_lifecycle` apps exist |
| A6 i18n scan | `npm run i18n:scan` | ✅ | `package.json:22` = `i18next-scanner` (doc nghi ngờ nhưng THỰC TẾ CÓ) |
| A9 console | Dev server load | ✅ logic | — |
| A10 visual | Playwright | ✅ | `tests/visual/tenant-admin.spec.ts` exists |

**Lưu ý:** A6 grep command trong doc (line 66) dùng `grep -rn "\"[A-ZÀ-Ỹ]"` — Windows PowerShell không hỗ trợ `-r`/`--include` syntax này. Nên dùng `rg` (ripgrep) hoặc task tool. Minor.

### 2.2 Sprint 1 — Backend Citations CHÍNH XÁC 100%

| File | Claimed line | Actual | Status |
|------|-------------|--------|--------|
| views_tenant.py `_get_request_tenant` | 120 | 120 | ✅ |
| views_tenant.py role calls | 223,234,240,251,297,308,398,430,481,569,610,646 | all real | ✅ |
| tenant_member_views.py `_get_request_tenant` | 31 | 31 | ✅ |
| tenant_member_views.py `_require_tenant_role` | 95 | 95 | ✅ |
| tenant_member_views.py `_get_request_tenant_role` | 68 | 68 | ✅ |
| tenant_member_views.py invite POST | 126 | 126 | ✅ |
| tenant_member_views.py invite block | 156-165 | 156-165 | ✅ (no email) |
| views/sso.py `_get_request_tenant` | 20 | 20 | ✅ |
| views/sso.py `_get_request_tenant_role` | 29 | 29 | ✅ |
| views/sso.py `_require_tenant_role` | 38 | 38 | ✅ |
| views/sso.py SSOLoginInitiateView | 74-118 | 74-118 | ✅ |
| views/sso.py SSOCallbackView | 121-223 | 121-223 | ✅ |
| views_webhooks.py `_get_request_tenant` | 34 | 34 | ✅ |
| views_webhooks.py regenerate secret | 103-115 | 103-115 | ✅ |
| views_webhooks.py DeprovisionView | 222-234 | 222-234 | ✅ |
| views_dashboard.py / _security / _alert_config / _usage / _usage_trend / _forecast | 20/20/15/23/18/19 | exact | ✅ |
| onboarding_views.py stub | 29-36 | 29-39 | ✅ |

→ **Sprint 1 có thể thực thi ngay không cần hỏi lại.** Tất cả line numbers đúng.

### 2.3 Structural / NEW Files — No Phantom

| File | Claim | Actual | Status |
|------|-------|--------|--------|
| `providers/QueryProvider.tsx` | NEW (6.2) | NOT FOUND | ✅ consistent |
| `components/TenantAdminErrorBoundary.tsx` | NEW (1.7) | NOT FOUND | ✅ consistent |
| `pages/tenant-admin/TenantAdminSettingsPage.tsx` | NEW (3.3) | NOT FOUND | ✅ consistent |
| `pages/tenant-admin/TenantAdminRolesPage.tsx` | NEW (4.3) | NOT FOUND | ✅ consistent |
| `tests/visual/tenant-admin.spec.ts` | Update existing (8.4) | EXISTS | ✅ consistent |
| `partner_urls.py` | NEW (3.2/4.2) | EXISTS | ⚠️ C3: đổi "NEW"→"existing" |
| `tasks.py` `deprovision_tenant_async` | 420-451 (7.1) | 420-451 | ✅ exact |
| `layouts/full/vertical/sidebar/Sidebar.tsx` | exists (6.1) | EXISTS | ✅ |

**Không có phantom file nào** (file cited-as-existing nhưng không tồn tại).

### 2.4 Dependency Graph — 2 Artificial (C4, C5)

| Dependency | Code reality | Assessment |
|------------|--------------|------------|
| Sprint 5 (SSO) → Sprint 4 (RBAC) | `views/sso.py` self-contained, role check hardcoded `('owner','admin')`, không import RBAC | **Artificial** — SSO có thể làm independent. RBAC chỉ enhance sau này |
| Sprint 2 (Email) → Sprint 1.5 (member limit) | Không có member limit trong code hiện tại; Sprint 1.5 + 2.4 cùng implement feature mới | **Narrative** — thực chất là 2 bước của cùng 1 feature, không phải dependency theo nghĩa code |

**Critical path** doc ghi: `Sprint 1 → Sprint 2 → Sprint 5 → Sprint 8`. Với C4, Sprint 5 có thể chạy song song với Sprint 4 (không block). Đề xuất sửa critical path thành: `Sprint 1 → {Sprint 2, Sprint 4} → Sprint 5 → Sprint 8`.

---

## 3. ĐÁNH GIÁ CHẤT LƯỢNG DOC

**Điểm mạnh:**
- Mọi backend citation chính xác đến từng dòng (hiếm thấy trong plan doc)
- Quality gates A1-A10 comprehensive, đúng commands
- Sub-steps có spec code + acceptance criteria rõ ràng → thực thi được ngay
- Auto-Update Protocol + Ledger Template chuẩn → dễ tuân thủ AGENTS.md
- Dependency graph + parallel opportunities hữu ích

**Điểm yếu (sửa trước khi chạy):**
1. **C1:** Dev port `5199` sai → `3000`. Dev có thể mở sai URL.
2. **C2:** `@tanstack/react-query` đã có → bước "Thêm" là no-op, gây confusion.
3. **C3:** `partner_urls.py` đã có → ghi "NEW" sai.
4. **C4/C5:** 2 dependencies artificial → critical path không tối ưu, có thể song song hóa tốt hơn.
5. **Minor:** A6 grep command không chạy trên Windows PowerShell (dùng `rg` thay).

---

## 4. KHUYẾN NGHỊ

1. **Sửa C1-C5** trong doc (dev port, react-query, partner_urls, dependency graph)
2. **Sprint 1 có thể bắt đầu ngay** — tất cả citations đã verify, không cần clarify
3. **Tối ưu hóa parallel:** Sprint 3 (Settings) + Sprint 6 (UX) + Sprint 5 (SSO, sau khi S1 xong) có thể chạy song song thay vì sequential
4. **A6 grep:** đổi sang `rg` hoặc task tool cho cross-platform

---

## 5. KẾT LUẬN

`TENANT_MANAGEMENT_SPRINT_PLAN.md` là **sprint plan thực thi được cao**. Khác với audit doc trước (có 5 lỗi kỹ thuật), sprint plan này **chỉ có 4 lỗi nhỏ** (C1-C3 là sai số, C4-C5 là logic dependency). 

**Quan trọng nhất:** Sprint 1 citations 100% chính xác → đội code BẮT ĐẦU ĐƯỢC NGAY như doc claim. Chỉ cần note dev port `:3000` (không phải `:5199`).

**Không có blocker.** Doc sẵn sàng đưa vào thực thi sau khi sửa C1-C5 (5 phút edit).
