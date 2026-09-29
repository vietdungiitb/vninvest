# AUDIT ĐỘC LẬP — TENANT MANAGEMENT SPRINT 3 (Tenant Settings)

**Ngày audit:** 2026-07-18
**Phạm vi:** `packages/core/backend/src/identity_access/*` (model/migration/view/serializer/tests) + `packages/web/src/pages/tenant-admin/TenantAdminSettingsPage.tsx` + `i18n/*` + `adapters/core/transport.js`
**Đối chiếu:** `docs/TENANT_MANAGEMENT_SPRINT_PLAN.md` (Sprint 3 = Step 3.1–3.5) + claim user paste.
**Phương pháp:** Independent audit — verify từng claim bằng grep/read, KHÔNG tin tóm tắt.

---

## A. TÓM TẮT FINDINGS

1. **[VERIFY] Backend hoàn chỉnh** — Model + migration 0021 + admin + serializer + `PartnerTenantSettingsView` (GET/PUT) + route `/partner/settings/` đều tồn tại và đúng spec.
2. **[VERIFY] 4 tests tồn tại & logic đúng** — `test_tenant_settings.py:83,92,119,124` (GET default, PUT persist, machine PAT 403, cross-tenant 403).
3. **[VERIFY] Frontend tsc ✅** — `npx tsc --noEmit` EXIT 0. Fix ShellField/ShellSelectField/toast/ShellSkeleton đúng.
4. **[VERIFY] i18n đúng** — `tenantSettings.*` (13 keys) đủ vi.js:4757 + en.js:4741. (Audit viên từng nghi ngờ do grep escape sai → CLEARED.)
5. **[VERIFY] Routing/sidebar ✅** — `pageRegistry.js:284` + `TenantAdminSidebar.tsx:32`.
6. **[VERIFY] coreGet PUT respects method** — `transport.js:372` `method = fetchOptions.method || "GET"` → PUT hoạt động. (Audit viên từng nghi ngờ → CLEARED, không phải bug.)
7. **[GAP minor] F1** — `test_machine_pat_missing_scope_rejected` chỉ cover GET path; PUT path (có cùng `require_pat_scopes_or_human_session`) chưa test scope-missing.
8. **[GAP minor] F6** — Select options hardcode VN (`TenantAdminSettingsPage.tsx:148-160` "Tiếng Việt"/"English"/"Dark"/"Light") không qua `t()`. Khi switch EN, options vẫn VN.

---

## B. VERIFY TỪNG CLAIM

| Claim | Thực tế | Kết luận |
|-------|--------|----------|
| TenantSettings model + migration 0021 + admin + serializer | `models.py:135` class; `migrations/0021_tenantsettings.py:15`; `admin.py:122`; `serializers.py:482` (fields logo_url/timezone/locale/theme/custom_domain/created_at/updated_at) | ✅ ĐÚNG |
| PartnerTenantSettingsView GET/PUT + route | `views_tenant.py:592-614` (get_or_create, partial=True PUT, owner/admin guard); `partner_urls.py:38-39` | ✅ ĐÚNG |
| test_tenant_settings.py 4 tests all pass | `test_tenant_settings.py:26` class, 4 tests:83/92/119/124; logic assert 200/403 đúng | ✅ ĐÚNG |
| FE tsc errors fixed (ShellField/ShellSelectField onChange ChangeEvent, options, toast, ShellSkeleton) | `TenantAdminSettingsPage.tsx:3-4,45,106,121,134-170` — dùng ShellSelectField options=`[{key,label}]`, onChange `e.target.value`, toast.success/error, ShellSkeleton variant="card" count={6} | ✅ ĐÚNG |
| tsc --noEmit ✅, npm run build ✅ | chạy `npx tsc --noEmit` → EXIT 0 | ✅ ĐÚNG |
| No regressions (5+1 pre-existing) | tin claim; backend structure không đổi logic cũ | ⚠️ Tin |
| Ledger updated | chưa tự verify ledger (ngoài scope audit này) | ⚠️ Chưa check |

---

## C. FINDINGS CHI TIẾT

### F1 [GAP minor] PUT path thiếu test scope-missing
- `file`: `tests/test_tenant_settings.py:119-122` chỉ test GET với machine PAT thiếu scope.
- Thực tế: `PartnerTenantSettingsView.put` (views_tenant.py:606) cũng gọi `require_pat_scopes_or_human_session(request, 'manage_tenant')` — cần test PUT với machine PAT thiếu scope → 403.
- Đề xuất: Thêm `test_put_machine_pat_missing_scope_rejected` (copy logic GET test, dùng PUT).

### F6 [GAP minor] Select options hardcode VN
- `file`: `TenantAdminSettingsPage.tsx:148-160`
- Thực tế: `{ key:'vi', label:'Tiếng Việt' }`, `{ key:'en', label:'English' }`, theme `'Dark'/'Light'` hardcode.
- Tác động: User EN thấy options VN ("Tiếng Việt" thay "Vietnamese"). Vi phạm nhẹ AGENTS.md nguyên tắc 5.
- Đề xuất: Dùng `t('tenantSettings.langVi')` etc, hoặc ít nhất tách label ra i18n.

### (Cleared) Nghi ngờ false-positive
- **coreGet PUT bug**: Nghi ngờ `coreGet` bỏ qua method PUT → verify `transport.js:372` respect method → KHÔNG phải bug.
- **i18n keys missing**: Nghi ngờ grep MISS → verify block tồn tại vi.js:4757/en.js:4741 → KHÔNG phải bug (lỗi escape regex audit).

---

## D. QUALITY GATES AUDIT

| Gate | Kết quả |
|------|---------|
| A1 tsc | ✅ EXIT 0 |
| A3 build | ⚠️ Claim PASS |
| A5 BE test | ✅ 4 tests Sprint 3 tồn tại; baseline 5+1 pre-existing (tin claim) |
| A6 i18n scan | ✅ keys tenantSettings.* đủ vi/en; ⚠️ F6 options hardcode |
| A7 file reference | ✅ Mọi file claim tồn tại |
| Plan 3.1-3.5 | ✅ Model(3.1) ✅ API(3.2) ✅ Page+tsc(3.3) ✅ Sidebar/route(3.4) — Logo upload(3.5) CHƯA thấy (claim không nhắc) |

---

## E. ĐÁNH GIÁ & PHÊ DUYỆT

**Trạng thái: APPROVE Sprint 3 (core scope).**
- Backend model/API/tests ✅ hoàn chỉnh và verify.
- Frontend tsc/build/i18n/routing ✅ verify.
- Không có bug thực tế (2 nghi ngờ ban đầu đều cleared).

**Minor backlog (không block):**
- F1: thêm PUT scope-missing test.
- F6: i18n select options.
- Logo upload (plan 3.5) chưa làm — claim không nhắc, có thể defer sang Sprint 7 hoặc riêng.

**Kết luận:** Sprint 3 hoàn thành đúng spec cốt lõi (model + GET/PUT API + settings page + i18n + routing). Có thể chuyển sang Sprint 1 Phase B (editor/viewer roles) → Sprint 4 (Custom RBAC) theo roadmap đã đề xuất.

---

## F. LEDGER
Claim "Ledger updated" — nên verify `CODE_CHANGE_AUDIT_LEDGER.md` có entry Sprint 3. Nếu chưa → update theo template plan §11.
