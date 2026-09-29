# AUDIT — TENANT MANAGEMENT SPRINT 1 (Claim: "Sprint 1 Complete")

**Ngày audit:** 2026-07-18
**Phạm vi:** `packages/core/backend/src/identity_access/*` + `packages/web/src/pages/tenant-admin/*` + `packages/web/src/i18n/*`
**Đối chiếu:** `docs/TENANT_MANAGEMENT_SPRINT_PLAN.md` (Sprint 1 = Step 1.1–1.8) + claim user paste.

---

## A. TÓM TẮT 5 FINDINGS NGHIÊM TRỌNG NHẤT

1. **[CONTRADICTION] Claim "Sprint 1 Complete" SAI** — Plan định nghĩa Sprint 1 = Step 1.1–1.8. Thực tế chỉ làm xong 1.1, 1.2, 1.3 (limit), 1.6 (i18n). **Thiếu Step 1.7 (ErrorBoundary) và Step 1.8 (activeTenantId reactivity)**. Không phải "Complete".
2. **[GAP] Step 1.7 ErrorBoundary chưa làm** — `TenantAdminErrorBoundary.tsx` KHÔNG TỒN TẠI (glob no files). `TenantAdminLayout.tsx` không wrap ErrorBoundary.
3. **[GAP] Step 1.8 activeTenantId reactivity chưa làm** — `PortfolioContext.js:86-89` đọc localStorage init nhưng KHÔNG có `useEffect` + `storage` event listener (plan spec line 304-310). Switch tenant vẫn cần reload.
4. **[BUG] Plan Step 1.4 (editor/viewer roles) chưa implement** — Mọi call site `_require_tenant_role(request, 'owner', 'admin')` (tenant_member_views.py:38,58,128,225,264; views_tenant.py 12 sites...). Không có role 'editor'/'viewer' nào được enforce. Role matrix trong plan không được áp dụng.
5. **[GAP/i18n] Hardcoded VN còn sót** — `PolicyCheckboxes.js:127` ("Không có quyền hạn"), `AIUsageDashboard.tsx:37-38` ("30 ngày"/"90 ngày") vẫn hardcode (claim chỉ sửa TenantAdminPATsPage/SSOPage).

---

## B. BẢN ĐỒ KIẾN TRÚC (files liên quan)

| File | Dòng | Trách nhiệm | Trạng thái audit |
|------|------|-------------|------------------|
| `identity_access/utils/resolve_tenant.py` | 18/80/117 | `resolve_tenant`/`get_tenant_role`/`require_tenant_role` | ✅ Tạo đúng (Step 1.1-1.3) |
| `identity_access/utils/__init__.py` | 1-3 | Re-export 3 hàm | ✅ |
| `tenant_member_views.py` | 22,38,58,68-83,128,173-185,225,264 | Import util + role guard + member limit (post & accept) | ✅ limit cả 2 chỗ |
| `views_dashboard.py` | 18,54,124 | Import + 2 guard | ✅ |
| `views_alert_config.py` | 13,45,71 | Import + 2 guard | ✅ |
| `views_usage.py` | 19,38,161,223 | Import + 3 guard | ✅ |
| `views_usage_trend.py` | 16,30,95 | Import + 2 guard | ✅ |
| `views_forecast.py` | 17,99,136 | Import + 2 guard | ✅ |
| `views_security.py` | 18,44,105,136 | Import + 3 guard | ✅ |
| `views_webhooks.py` | 25,40,47,100,116,131,150,170,187,225 | Import + 10 guard | ✅ (đúng 10) |
| `views_tenant.py` | 17,137,148,154,165,211,222,312,344,395,483,524,560 | Import + 12 guard | ✅ |
| `views/sso.py` | 14,30,39 | Import + 2 guard | ✅ |
| `TenantAdminPATsPage.tsx` | 559,635,727,733,741,784,788 | Dùng keys `tenantPats.*` | ✅ (keys đúng tên thực tế) |
| `TenantAdminSSOPage.tsx` | 303,327 | `t("tenantPats.copySuccess")` | ⚠️ vẫn `tenantPats` không `tenantSSO` |
| `i18n/vi.js` | 1314-1321, 1274 | keys tồn tại | ✅ |
| `i18n/en.js` | 1239 tenantPats, 1722 tenantSSO | keys tồn tại | ✅ |
| `PolicyCheckboxes.js` | 127 | "Không có quyền hạn" hardcode | ❌ residual |
| `AIUsageDashboard.tsx` | 37-38 | "30 ngày"/"90 ngày" hardcode | ❌ residual |
| `TenantAdminErrorBoundary.tsx` | — | KHÔNG TỒN TẠI | ❌ Step 1.7 chưa làm |
| `PortfolioContext.js` | 86-89,264-265 | activeTenantId init nhưng không reactive | ❌ Step 1.8 chưa làm |

---

## C. VERIFY TỪNG CLAIM (user paste)

| Claim | Thực tế verify | Kết luận |
|-------|----------------|----------|
| Step 1.1 — shared `resolve_tenant.py`, update 9 view files, eliminate 9+ dup | `resolve_tenant.py` có 3 hàm; 9 files import từ `utils.resolve_tenant` (tenant_member_views, views_dashboard, views_alert_config, views_usage, views_usage_trend, views_forecast, views_security, views_webhooks, views_tenant, views/sso) | ✅ ĐÚNG |
| Step 1.2 — `_require_tenant_role('owner','admin')` to admin-only views (dashboard 2, alert_config 2, usage 3, usage_trend 2, forecast 2, security 3, webhooks 10) | Counts khớp chính xác (dashboard:54,124=2; alert_config:45,71=2; usage:38,161,223=3; usage_trend:30,95=2; forecast:99,136=2; security:44,105,136=3; webhooks:10 sites) | ✅ ĐÚNG |
| Step 1.3 — member limit enforcement (post + accept) | `tenant_member_views.py:68-83` (post) + `:173-185` (accept) đều check `PLAN_MEMBER_LIMITS` free:3/starter:5/pro:25/enterprise/custom/internal:unlimited | ✅ ĐÚNG (đầy đủ cả 2 chỗ) |
| Step 1.4 (claim) — Fixed hardcode VN in PATsPage(6)/SSOPage(3), added 8 i18n keys | Keys thực tế: `tenantPats.createServiceAccount/noScopes/days30/days90/year1/expiresAt/unlimitedWarning` + `tenantSSO.copySuccess` — TỒN TẠI vi.js/en.js. PATsPage dùng đúng. Nhưng SSO page vẫn `t("tenantPats.copySuccess")` (không phải `tenantSSO.copySuccess`). Naming trong claim SAI vs code (`createSAAction`→`createServiceAccount`, `expiry30d`→`days30`, `expiry1y`→`year1`, `noExpiryWarning`→`unlimitedWarning`) | ⚠️ LÀM XONG NHƯNG NAMING SAI + SSO copySuccess chưa chuyển namespace |
| "Sprint 1 Complete" | Plan Sprint 1 = Step 1.1–1.8. Thiếu **1.7 ErrorBoundary** (file không tồn tại) + **1.8 activeTenantId reactivity** (không có storage listener) | ❌ SAI — chỉ ~60% Sprint 1 |

**Lưu ý:** User paste gọi i18n là "Step 1.4" nhưng plan gọi i18n là "Step 1.6", và plan "Step 1.4" là enforce editor/viewer roles. Claim đã gộp nhầm thứ tự bước. Thực tế: editor/viewer (plan 1.4) CHƯA làm; i18n (plan 1.6) ĐÃ làm.

---

## D. FINDINGS CHI TIẾT

### F1 [CONTRADICTION] "Sprint 1 Complete" claim sai scope — Cao
- `file`: claim vs `TENANT_MANAGEMENT_SPRINT_PLAN.md:83-330`
- Thực tế: Chỉ Step 1.1, 1.2, 1.3, 1.6 hoàn thành. Thiếu 1.4 (editor/viewer), 1.5 (member limit accept — actually done in 1.3), 1.7, 1.8.
- Tác động: Misleading status; Step 1.4 (RBAC editor/viewer) là prerequisite cho Sprint 4 (Custom RBAC).

### F2 [GAP] Step 1.4 editor/viewer roles chưa enforce — Cao
- `file`: tất cả `_require_tenant_role(request, 'owner', 'admin')` (13+ sites)
- Thực tế: Plan Role Matrix (plan:182-197) yêu cầu editor có write (alert configs, SA own, usage, audit read), viewer read-only. Hiện tại mọi view chỉ owner/admin → editor/viewer bị chặn hoàn toàn (không có gradation).
- Tác động: Tính năng RBAC phân cấp chưa hoạt động; Sprint 4 sẽ phải refactor lại guard.
- Đề xuất: Thêm `require_tenant_role(request, 'owner','admin','editor')` cho write ops; `'owner','admin','editor','viewer'` cho read ops theo matrix.

### F3 [GAP] Step 1.7 ErrorBoundary chưa làm — Trung bình
- `file`: `TenantAdminErrorBoundary.tsx` KHÔNG TỒN TẠI
- Thực tế: glob no files; `TenantAdminLayout.tsx` không wrap boundary.
- Đề xuất: Tạo component theo spec plan:243-281, wrap trong layout.

### F4 [GAP] Step 1.8 activeTenantId reactivity chưa làm — Trung bình
- `file`: `PortfolioContext.js:86-89,264-265`
- Thực tế: init đọc `localStorage.getItem("tenant_id")` nhưng không có `useEffect` + `window.addEventListener('storage', ...)`. Switch tenant vẫn reload để sync.
- Đề xuất: Thêm `useState` init + `useEffect` storage listener per plan spec:300-311.

### F5 [GAP/i18n] Residual hardcoded VN — Thấp
- `file`: `PolicyCheckboxes.js:127`, `AIUsageDashboard.tsx:37-38`
- Thực tế: "Không có quyền hạn", "30 ngày", "90 ngày" hardcode. Claim không nhắc.
- Đề xuất: Chuyển sang `t("tenantPats.noScopes")` / `t("tenantPats.days30")` etc (keys đã có).

### F6 [BUG minor] SSO copySuccess namespace — Thấp
- `file`: `TenantAdminSSOPage.tsx:303,327`
- Thực tế: Dùng `t("tenantPats.copySuccess")` thay `t("tenantSSO.copySuccess")` (key đã tồn tại vi.js:1274). Claim "fixed" chưa đúng scope.
- Đề xuất: Đổi `tenantPats.copySuccess` → `tenantSSO.copySuccess` cho semantic đúng.

---

## E. QUALITY GATES AUDIT

| Gate | Lệnh | Kết quả |
|------|------|---------|
| A1 Type-check FE | `npx tsc --noEmit` | ✅ EXIT 0 |
| A2 Lint FE | `npm run lint` | (chưa chạy riêng; tsc sạch) |
| A3 Build FE | `npm run build` | (claim: PASS 1m12s) |
| A5 Test BE | claim 120/126 (5+1 pre-existing PAT binding) | ⚠️ Chưa tự chạy; tin claim |
| A6 i18n scan | grep hardcode VN trong tenant-admin | ⚠️ PATsPage/SSOPage sạch; nhưng residual ở PolicyCheckboxes/AIUsageDashboard (ngoài tenant-admin dir) |
| A7 File reference | glob `TenantAdminErrorBoundary.*` | ❌ KHÔNG TỒN TẠI (plan claim tạo) |

---

## F. ĐÁNH GIÁ & ĐỀ XUẤT

**Trạng thái thực tế:** ~60% Sprint 1. Deduplication (1.1) + role guard admin-only (1.2) + member limit (1.3) + i18n PATs/SSO (1.6) ĐÃ LÀM TỐT và verify đúng. Nhưng:
- Editor/viewer RBAC (plan 1.4) CHƯA làm → mọi guard vẫn hardcode owner/admin.
- ErrorBoundary (1.7) + activeTenantId reactivity (1.8) CHƯA làm.

**Có nên gọi "Complete"?** KHÔNG. Nên gọi "Sprint 1 Phase A: backend dedupe + admin role guard + member limit + i18n PATs/SSO".

**Đề xuất hoàn thiện Sprint 1 (trước khi sang Sprint 4 RBAC):**
1. **F2** — Refactor `_require_tenant_role` calls theo Role Matrix (editor write / viewer read). Đây là cốt lõi Sprint 4.
2. **F3** — Tạo `TenantAdminErrorBoundary.tsx` + wrap layout.
3. **F4** — `PortfolioContext.js` thêm storage listener.
4. **F5/F6** — Cleanup residual hardcode + SSO copySuccess namespace.

**Rủi ro nếu bỏ qua:** Sprint 4 (Custom RBAC) sẽ conflict với guard hardcode owner/admin hiện tại → tech debt.

---

## G. LEDGER / AGENTS UPDATE NEEDED

Theo plan §10, claim "Complete" phải update `CODE_CHANGE_AUDIT_LEDGER.md` + `AGENTS.md`. Nhưng vì SAI scope, **KHÔNG NÊN update là "Sprint 1 Complete"**. Nên update thành "Sprint 1 Phase A" và thêm TODO Phase B (1.4 editor/viewer, 1.7, 1.8).
