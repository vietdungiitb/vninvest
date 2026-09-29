# AUDIT: Mô hình quản lý User + Tenant — thực trạng, chuẩn SaaS, mô hình thống nhất (2026-09-23)

> **5 findings nghiêm trọng nhất**: (1) Auto-provision 1 tenant/user + `owner_user` OneToOne
> vỡ mô hình tổ chức đa ghế — tenant rác, login mặc định về workspace cá nhân;
> (2) Billing/quota owner-centric — member mù thanh toán, quota fallback unlimited;
> (3) Active-org context gãy 3 chỗ FE (dual-storage, stale ability, switch không validate);
> (4) Vòng đời invite cụt (không có trang accept) + route FE không authorization;
> (5) Personal-vs-Org không được phân định — key/session/setting cá nhân lẫn với quản trị.
> Chi tiết đầy đủ §6; mô hình thống nhất §4; lộ trình nâng cấp ở
> `docs/IMPLEMENTATION_PLAN_USER_TENANT_UNIFICATION_20260923.md`.

---

## 1. Phạm vi + phương pháp

- BE: `packages/core/backend/src/identity_access` (models, middleware, resolve,
  views register/onboarding/members/invites/sso/login/tenant, permissions) + linkage
  `commercial/`, `ops_audit/`, `service_ops/`.
- FE: `packages/web/src` (menu, routes, tenant-admin pages, self-service pages,
  context/ability, adapters, i18n).
- Chuẩn đối chiếu: WorkOS Organizations / Clerk Organizations / Auth0 Organizations
  (tài liệu chính hãng 2025–2026, tra cứu live ngày 2026-09-23).
- Mọi khẳng định kèm `file:line`; chưa đọc → ghi CHƯA XÁC MINH.

## 2. Thực trạng codebase (rút gọn, có bằng chứng)

### 2.1 Entity map

| Entity | Quan hệ khóa | Ghi chú |
|---|---|---|
| `auth.User` | Gốc danh tính | Register tạo `is_active=False` (`views/register.py:110-117`) |
| `CoreTenant` | `owner_user=OneToOneField(User)` (`models.py:65-70`) → **1 user chỉ sở hữu 1 tenant**; `tenant_code unique` (`:71-76`); plan FREE default (`:78-83`); status ACTIVE default (`:84-89`); Stripe ids (`:98-102`); quota (`:105-108`) | Plan: FREE/STARTER/PRO/ENTERPRISE/CUSTOM/INTERNAL (`:50-56`); Status: +TRIAL/PENDING_ACTIVATION (`:43-48`) |
| `TenantMember` | FK tenant + FK user, `unique_together` (`models.py:597-606,634`); role OWNER/ADMIN/EDITOR/VIEWER (`:585-589`); `custom_role` nullable (`:613-620`) | Doc: owner không cần row (`:579-583`) — nhưng không có guard cấm row owner |
| `TenantInvite` | token unique + `expires_at` bắt buộc + status PENDING/ACCEPTED/DECLINED/EXPIRED (`models.py:657-707`); hết hạn 7 ngày (`tenant_member_views.py:122-131`) | `DECLINED` chết (không view nào set); cancel **xoá row** (`:301-311`) |
| `CoreServiceAccount` | 1 tenant → N SA (`models.py:190-195`); scopes JSON (`:203`) | Register tạo SA `default` (`register.py:139-144`), verify nâng scopes (`:296-299`) |
| `CorePATCredential` | FK SA + `issued_for_member` nullable (`models.py:250-263`); human/machine (`:274`); `effective_status` tự EXPIRED (`:305-309`) | Machine PAT không gắn member → collapse về owner (`authentication.py:57-62`) |
| `TenantCustomRole` | `unique (tenant,name)` (`models.py:563`); `is_system` (`:553-556`) | Không có seed production → nhánh bảo vệ chết |
| `UserProfile` / `TenantSettings` / `TenantSSOConfig` / `LoginAttempt` | 1-1/FK như bảng chuẩn | `UserProfile.tenant` nullable (`:485-492`) |

### 2.2 Lifecycles đã trace

- **Register**: `POST /api/auth/register/` → User inactive + tenant FREE + profile + SA default
  + outbox + mail token 30p (`register.py:29-182`); verify → active + nâng scopes
  (`:267-299`). Onboarding (đã login) tạo tenant TRIAL 14 ngày, 409 nếu đã có
  (`onboarding_views.py:68-114`). Backfill user cũ thiếu tenant (`backfill_missing_tenants.py:24-69`).
- **Invite→accept**: tạo (member:write, limit ghế free3/starter5/pro25, 409 trùng)
  (`tenant_member_views.py:63-150`); accept bắt human-session, check hạn/email/limit,
  `get_or_create` member (`:175-246`); **FE không có trang accept** (grep `invite`只 trúng
  MembersPage tạo/huỷ + i18n — vòng đời cụt phía client); middleware miễn resolve cho
  accept/cancel (`middleware.py:108-110`); xoá member cấm xoá owner/tự xoá (`:257-286`).
- **SSO**: `get_or_create` User theo email **không tạo tenant/profile/SA**
  (`sso.py:277-285`), member viewer (`:292-296`), SA riêng mỗi email (`:299-307`),
  human PAT gắn member (`:310-318`) — nhưng backfill sau đó vẫn đẻ tenant cá nhân.
- **Resolution**: middleware header→owner→member, header sai 403, suspended 403,
  set `request.tenant/tenant_role` (`middleware.py:25-99,156-201`); machine PAT lệch
  tenant 403 (`:64-76`); superuser bypass (`:55-58,203-228`); util fallback có lỗ header
  không validate (`resolve_tenant.py:128-135`); staff→admin (`:190-193`).
- **PAT**: login/SSO human gắn member (`login.py:157-170,205-217`); machine admin không gắn
  member (`views_tenant.py:250-256,353-360,399-406`); admin list lọc human
  (`:226-233`); auth prefix-12+HMAC, chỉ ACTIVE/ROTATING (`models.py:317-329`,
  `authentication.py:30-37`); quota `max_active_pats` đếm thiếu (`models.py:337-343`).

### 2.3 Role semantics

Matrix `resolve_tenant.py:25-55`: owner wildcard; admin đủ (billing+tenant:write);
editor (sa/pat write, không billing/sso/webhook); viewer (read). Custom role **override
toàn phần** (`:237-241`). Chết/khó tới: row `role=owner` (cho phép ở serializer,
`serializers.py:322-328`); `is_system` không seed; `report:*` vắng khỏi catalog+roles
→ reports owner-only thực tế; `_build_abilities` cấp full subject mọi user có tenant
(`helpers.py:107-135`) trong khi BE chặn theo role → UI over-promise.

### 2.4 Billing linkage

`commercial/views.py:42,52,62,86,329,359,432` + `commercial_partner_views.py:23-24`
đều resolve tenant qua `owner_user` → member mù subscription/invoice/quota/VNPay/Stripe;
partner view nuốt lỗi trả rỗng; quota fallback member = unlimited (`middleware.py:362-369`).

### 2.5 FE theo actor

Ability từ `/identity/profile/` (`PortfolioContext.js:69-108`); menu lọc staff/requiresTenant
(`Sidebar.tsx:126-131`); **route không authorization** (`main.tsx:61-82`);
`TenantAdminLayout` không gate; mỗi page tự `can()` (bảng 14 page đã audit —
ngoại lệ: Home `??true`, Settings **không check**, Roles fetch-trước-check-sau,
Reports manage-vs-read lệch). Switcher chỉ ở Sidebar, `switchTenant` ghi localStorage +
dispatch event, không validate/refresh ability (`PortfolioContext.js:296-302`);
transport đọc `sessionStorage` (`transport.js:335-338`) — header đứt gãy.
Ba hệ billing song song (`/upgrade`, `/commercial/billing` không gate,
`/tenant-admin/billing` có gate). Sidebar hardcode user + logout chết
(`Sidebar.tsx:176-190`) vs Header thật.

## 3. Chuẩn SaaS thương mại (WorkOS / Clerk / Auth0 — consensus)

1. **Identity tách khỏi access**: User toàn cục (key = email); quyền nằm ở membership.
2. **Organization là resource顶层**: id/name/domains/`stripe_customer_id`/settings;
   billing gắn org, không gắn user.
3. **Membership** (user, org, role, status pending/active/inactive): user thuộc 0..N org;
   role theo từng membership; người tạo = admin/owner; deactivate (giữ role) vs delete.
4. **Active organization per session**: switcher đổi context, server validate,
   mọi authz tính trong context đó (Clerk Active Organization; WorkOS session org).
5. **Invitations**: gắn email + role preset + token accept + route accept riêng;
   email khớp tuyệt đối; revoke độc lập domain policy.
6. **Roles định nghĩa 1 lần toàn cục** (admin/member...), gán theo membership;
   custom role per-org optional; check cả FE lẫn BE.
7. **Personal vs Org显式**: B2B chuẩn tắt personal account (Clerk 08/2025:
   user phải tạo/join org); API key phân `user-owned` vs `organization-owned`
   (WorkOS `owner.type`), secret hiện 1 lần.
8. **AuthN 2 pha**: chứng minh danh tính → vào tenant context (WorkOS).
9. **Audit log tenant-scoped** cho mọi thay đổi membership/role/billing/keys.

## 4. Mô hình thống nhất đề xuất (target — chốt)

```
Identity (auth.User, key=email)
  │ 1 — N
  ├─ Ownership: user sở hữu 0..N Organization (BỎ OneToOne → FK, xem U-Phase 1)
  └─ Membership: (user, org, role, custom_role, status active|inactive, invited_by)
Organization (= CoreTenant + kind: personal|team + stripe_customer_id đã có)
  ├─ Billing/quota theo ORG; permission billing:read/manage thay vì owner_user
  ├─ API keys: owner = user-owned (gắn membership) | org-owned (gắn SA)
  └─ Settings/SSO/audit theo ORG
Session context: { identity + active_org_id (server-validate) + role/perms snapshot }
```

Nguyên tắc bất biến:
- P1: mọi request tính quyền trong **active org đã validate**, không fallback ngầm.
- P2: personal workspace là org `kind=personal` (không transfer, không invite);
  org team mới invite/transfer/billing chung được.
- P3: invite luôn có accept route + email match + role preset; deactivate giữ vết.
- P4: key nào chủ đó — user-owned gắn membership, org-owned gắn SA; admin thấy nhưng
  chỉ owner key thao tác (trừ owner/admin org theo policy显式).
- P5: billing đọc cho billing managers, viết cho owner/admin; không bao giờ `owner_user`.
- P6: FE route guard theo ability + menu theo role; không security-by-obscurity.

## 5. Gap analysis (hiện tại → chuẩn → target)

| # | Chuẩn | Hiện tại | Target (phase) |
|---|---|---|---|
| G1 | Org显式, personal opt-in | Auto-tenant/user + OneToOne owner | `kind` + tạo-org + transfer (Ph.1) |
| G2 | Membership status | Chỉ tồn tại row; cancel xoá | `status` active/inactive + deactivate (Ph.1) |
| G3 | Accept route + email match | BE đủ, FE缺 accept; DECLINED chết | Trang accept + decline (Ph.1) |
| G4 | Active org server-validate | Dual-storage, stale ability | Context统一 (Ph.1) |
| G5 | Billing on org + roles | owner_user everywhere | Billing managers (Ph.2) |
| G6 | user- vs org-owned keys | SA-bound + prefix hack | owner model (Ph.2) |
| G7 | Route guard + least privilege | Menu-hiding; Settings no-gate | Guard + siết gates (Ph.0) |
| G8 | System user admin | Rải rác Django/operator | SOC Users A2 + staff-switch A3 (Ph.0-1) |
| G9 | SSO JIT/domain routing | Per-email SA, không mapping | JIT + domain (Ph.3) |
| G10 | Audit tenant-scoped đủ | Thiếu user/invite/key events | Bổ sung events (mỗi phase) |

## 6. Findings xếp hạng (kế thừa audit BE/FE, giữ file:line)

1. **OneToOne + auto-workspace → vỡ org** (`models.py:65-70`, `register.py:120-126`,
   `backfill_missing_tenants.py:41-47`, `login.py:133-144`) — HIGH.
2. **Billing owner-centric** (`commercial/views.py`, `commercial_partner_views.py:23-24`,
   `middleware.py:362-369`) — HIGH.
3. **Active-org gãy FE** (dual-storage `transport.js:335-338` vs `PortfolioContext.js:296-302`;
   stale ability; switch không validate) — HIGH.
4. **Invite cụt + route mở** (không trang accept; `main.tsx:61-82`; Settings no-gate
   `TenantAdminSettingsPage.tsx:58`) — HIGH (vuln ghi).
5. **Dual-owner/role rách** (invite owner, custom override, `report:*`缺, abilities over-grant) — MED.
6. **PAT lifecycle rách** (human vô hình, quota thiếu, `mark_rotating` kép
   `models.py:367-373/388-402`, SA/email SSO) — MED.
7. **Resolution bất đồng** (util header không validate, `IsTenantActive` owner-only,
   staff/superuser không nhất quán) — MED.
8. **SSO thiếu JIT/domain** — LOW (Ph.3). 9. **Profile/logout giả, billing 3 hệ** — LOW (UX).

## 7. Quality gates audit này

Đọc file thật + grep toàn repo (css/config/i18n/adapter); subagent BE/FE độc lập;
benchmark live WorkOS/Clerk/Auth0 2026-09-23; spot-verify claim nền tảng
(OneToOne, accept-absence, switchTenant, Settings-gate). Không đổi code.
