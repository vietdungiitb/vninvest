# AUDIT TOÀN DIỆN: Quản lý người dùng + Tenant Admin (2026-09-24)

> Phạm vi: toàn bộ BE `identity_access` + `service_ops/views/{users,billing,usage,audit,staff}`
> + `contracts/operator` + `commercial` + `ops_audit`, FE routes/menu/pages/ability/switch-UX —
> **tại trạng thái hiện tại gồm cả working-tree R0–R7 chưa commit**.
> Phương pháp: 2 audit độc lập BE/FE + spot-verify trực tiếp + đối chiếu chuẩn SaaS
> (WorkOS / Clerk / Auth0 — benchmark live 2026-09-23).
> Mọi khẳng định kèm `file:line`. Không đổi code trong audit này.

## 0. TÓM TẮT 5 NGHIÊM TRỌNG NHẤT

1. **[CRITICAL] Staff-switch leo thang**: phiên xem hộ ép role `viewer` nhưng giữ
   `is_staff` → vẫn gọi được mọi endpoint staff-only (`IsAdminUser` không đọc
   `tenant_role`). `middleware.py:157-160` vs `service_ops/views/base.py:102`.
2. **[CRITICAL] Route `/admin-crawl-control` auth-only**: sót `StaffRoute`
   (`main.tsx:113`) + page không gate → non-staff điều khiển crawl.
3. **[CRITICAL] Invite `role=owner`**: serializer cho phép (`serializers.py:326`),
   member có `member:write` tự tạo owner → leo đặc quyền, không có owner-transfer flow.
4. **[HIGH] `resolve_tenant` fallback đọc tenant không check membership**
   (`resolve_tenant.py:127-135`) + staff cross-tenant không audit (`:111-125}).
5. **[HIGH] 6 trang AdminCore* + AdminUsersPage fetch-trước-check** + dead links
   `/admin/runtime/jobs` ×2 + FE ability khác BE permission (viewer thấy menu, 403 ở BE).

---

## 1. MA TRẬN PHÂN QUYỀN THỰC TẾ (rút gọn, đã verify)

| Surface | Staff | Owner | Admin | Editor/Viewer | No-tenant | Machine PAT |
|---|---|---|---|---|---|---|
| `/api/soc/*`, `/operator/*` (BE) | ✅ `IsAdminUser` | ❌ 403 | ❌ | ❌ | ❌ | ❌ (strip staff) |
| `/admin/*` (FE route) | ✅ StaffRoute | ❌ redirect* | ❌ | ❌ | ❌ | n/a |
| Staff-switch phiên | ⚠️ **leo (M1)** | n/a | n/a | n/a | n/a | ❌ từ chối |
| `/tenant-admin/*` | ✅ | ✅ (wildcard) | ✅/❌ theo token | ✅/❌ theo token | ❌ TenantRoute | theo scope+role |
| `/tenant/*` self-service | ✅ | ✅ | ✅ | ✅ own-data | ❌ TenantRoute | n/a |
| `/partner/*` | ✅ | ✅ | ✅/❌ token | ✅/❌ token | 403 middleware | scope+role |
| `/commercial/billing` (FE) | ✅ | ✅ | ✅ mở được | ✅ **mở được** (BE chặn/crash) | ✅ mở | n/a |
| `admin-crawl-control`, `settings/ai*` | ✅ | ✅ **mở được** | ✅ mở được | ✅ **mở được** | ✅ mở | n/a |

\* `/tenant-admin` bọc `TenantRoute` (giữ owner tự quản) — quyết định R0 có chủ ý.

## 2. CHUẨN SAAS THỊ TRƯỜNG (đối chiếu)

Consensus WorkOS/Clerk/Auth0: (1) Identity tách access, user thuộc 0..N org;
(2) Organization顶层 + billing gắn org; (3) Membership có status
pending/active/inactive + deactivate giữ vết; (4) Active-org per-session,
server-validate; (5) Invite gắn email+role, accept route riêng, **không có role owner
qua invite** (owner-transfer flow riêng có xác nhận); (6) Roles global + custom per-org;
(7) Personal vs Org显式; API key user-owned vs org-owned; (8) AuthN 2 pha;
(9) Audit tenant-scoped mọi thay đổi; (10) Admin plane tách self-service,
support-access (impersonation) có audit + TTL + read-only + không leo quyền.

## 3. FINDINGS CHI TIẾT

### M1 [CRITICAL] Staff-switch leo staff-only
- `middleware.py:157-160` gán tenant+`viewer` nhưng `user.is_staff` giữ nguyên;
  `SOCBaseView.permission_classes=[IsAuthenticated, IsAdminUser]` (`base.py:102`)
  chỉ check `is_staff` → phiên viewer gọi được SOC/operator kèm header switch.
  Thêm: superuser bypass (`middleware.py:55-58`) chạy trước nhánh switch nên
  switch-header bị lờn với superuser; audit chỉ lúc cấp (`staff.py:68-77`),
  không per-request; token replay vô hạn trong TTL, không bind IP/revoke.
- Fix: strip `is_staff/is_superuser` trên request khi switch active (mirror
  `apply_pat_user_privileges`, `resolve_tenant.py:79-89`) + từ chối switch-header
  ở mọi SOC/operator view nếu `request.staff_switch` (defense-in-depth) +
  audit per-use (sampled) + nút thu hồi (cache denylist).

### M2 [CRITICAL] `admin-crawl-control` auth-only
- Route `main.tsx:113` quên `StaffRoute` (catalog đòi `admin.operator.read`,
  menu `staffOnly`); page không gate → non-staff kích job crawl. Fix 1 dòng bọc
  StaffRoute + test (mẫu R0).

### M3 [CRITICAL] Invite `role=owner`
- `serializers.py:326` choices full + accept tạo đúng role (`tenant_member_views.py:218-228`),
  không transfer flow (grep 0 hit). Fix: blacklist `owner` ở invite + endpoint
  owner-transfer riêng (2-man rule: owner hiện tại xác nhận + target chấp nhận).

### M4 [HIGH] `resolve_tenant` fallback không check membership
- Header bất kỳ → tenant (`resolve_tenant.py:127-135`); staff SA cross-tenant
  không audit (`:111-125`); `get_tenant_role` staff→admin (`:190-193`).
  Fix: fallback validate membership như middleware (`middleware.py:233-251`),
  staff path deny-mặc-định + audit.

### M5 [HIGH] Fetch-trước-check + dead links + AdminUsersPage không gate
- 6 AdminCore* fetch trong `useEffect` trước gate render; `AdminUsersPage.tsx:10-11`
  + `SocUsersPanel.tsx:70-92` fetch vô điều kiện (trang duy nhất thiếu depth).
  Fix: early-return + skip fetch (mẫu TenantsPage `:92,120`).
- Dead `/admin/runtime/jobs` ×2 (`AdminCoreOverviewPage.tsx:154`,
  `AdminCoreAuditTracePage.tsx:297`) → `/admin/jobs`.

### M6 [HIGH] FE ability ≠ BE permission
- BE cấp subjects giống hệt mọi role (`helpers.py:107-135`) nhưng enforce tokens
  (`resolve_tenant.py:25-55`) → viewer thấy Members invite/Webhooks/SSO/Settings/Roles
  nhưng 403 ở BE. Fix đúng: BE trả abilities theo role (Phase 4 unification);
  tạm: FE ẩn action theo token-map显式.

### M7 [MEDIUM] Billing owner-only + guard thiếu + quota unlimited
- `_get_tenant` owner-only (`commercial_partner_views.py:23-24`, `views_reports.py:19-20`)
  → member 500; `commercial/views.py:39-58` chỉ `IsAuthenticated`;
  quota fallback member = unlimited (`middleware.py:406-419`); `report:*` vắng khỏi
  catalog+roles (member 403 mọi reports). Fix: resolve theo `request.tenant` +
  `billing:read/write` + 403 sạch; bổ sung `report:*`; quota fail-closed theo plan.

### M8 [MEDIUM] PAT lifecycle rách + offboarding hỏng + SSO stub
- Quota đếm thiếu (`models.py:337-343`); `mark_rotating` kép (`:367-373/:388-402`);
  revoked-PAT silent-downgrade về session (`models.py:317-329` + `middleware.py:173-176`);
  remove-member không revoke PAT/session (`tenant_member_views.py:277`);
  deprovision query sai field (`tasks.py:440`); SSO thiếu verify-domain/JIT-role.

### M9 [LOW] i18n hardcoded + switch UX mòn + Settings/Reports/Roles gates lệch
- Overview/Jobs/AuditTrace/Billing/Usage hardcoded toàn trang; Roles ALL_TOKENS,
  palette, banner, keys-toast bypass `t()`; banner đọc 1 lần, bỏ `expires_at`,
  kẹt khi storage blocked. Settings no-gate, Roles fetch-bất-chấp, Home `??true`,
  Reports manage-cho-read. Fix theo checklist R6-mở-rộng.

### Điểm TỐT (giữ): SOC/operator `IsAdminUser` nhất quán; machine-PAT strip staff;
partner querysets bóp tenant; personal keys fail-closed 404; invite accept check
email/hạn/limit + human-only; VNPay IPN HMAC+idempotency; audit issuance ở users/switch.

## 4. GIẢI PHÁP (3 batch, theo thứ tự)

**H0 — Hotfix (giờ):** M1 (strip staff khi switch + từ chối ở SOC layer),
M2 (StaffRoute crawl-control), M3 (blacklist invite-owner), M5 dead links.
Mỗi mục ≤5 dòng code + test hồi quy.
**H1 — Hardening (1 đợt):** M5 fetch-gates, AdminUsers gate, settings/ai+vip guard,
M4 membership validation, `IsTenantActive` đọc `request.tenant`, revoked-PAT 403 cứng,
M7 billing `request.tenant` + 403 + `report:*`, quota fail-closed.
**H2 — Structural (roadmap unification Ph.1-4):** M6 ability-theo-role, owner-transfer,
membership statuses + deactivate, offboarding revoke đầy đủ, SSO JIT/domain,
PAT quota/rotate cleanup, i18n + switch UX, audit per-use.

## 5. TIÊU CHÍ PHẢN BIỆN (reviewer tick trước merge từng batch)

T1. M1: test chứng minh switched-session gọi SOC → 403 (kèm header switch).
T2. Invite role=owner → 400; transfer flow 2-man có test.
T3. Fallback tenant lạ → 403 + audit; staff SA cross-tenant có audit.
T4. Mọi admin page: non-staff **0 request** (mock assert not-called).
T5. Dead-link grep 0 + route-catalog-cover xanh.
T6. Member billing: 403 sạch (không 500) + member đúng quyền đọc được.
T7. Revoked PAT + Bearer → 401/403 cứng, không downgrade session.
T8. i18n:scan 0 + không literal VI/EN mới trong pages.

## 6. Gates audit này

2 subagent độc lập (BE/FE) + verify trực tiếp (main.tsx, dead links, serializer,
OneToOne, middleware) + benchmark chuẩn đã có. Không đổi code.
