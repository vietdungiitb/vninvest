# IMPLEMENTATION PLAN — Thống nhất quản trị User + Tenant (2026-09-23)

> Mục tiêu: đưa mô hình user+tenant rời rạc hiện tại về đúng **target §4** của
> `docs/AUDIT_USER_TENANT_MANAGEMENT_MODEL_20260923.md` (chuẩn WorkOS/Clerk/Auth0).
> Kế hoạch umbrella theo phase; **B+A** (personal keys/usage) và **A2** (SOC Users)
> là slice bên trong — không làm trùng. Đội code làm từng phase, không cần hỏi lại.

## 0. Thứ tự triển khai (chốt)

**Phase 0 → A2 → B+A → Phase 1 → 2 → 3 → 4.**
Lý do: Phase 0 đóng lỗ hổng ghi (Settings no-gate, route mở) + F1; A2 staff-only gọn;
B+A user-facing sau khi nền sạch; Phase 1+ cần migration nên đi sau cùng.

Quy ước chung mọi phase: `npx tsc --noEmit` sau sub-step, `npm run build` cuối step,
`lint` 0 errors, `i18n:scan` 0, VI full dấu, adapter qua `defaultCoreApiAdapter cast`,
evidence `docs/evidence/user-tenant-unify/<phase>/`, ledger entry khi đóng phase.

## Phase 0 — Guard nóng, không migration (1 đợt, ~7 tests)

| Slice | Việc | Files | Tests |
|---|---|---|---|
| U0.1 | F1 webhook (map từ B+A S2, không lặp) | `views_webhooks.py` | viewer GET/PATCH/DELETE→403 |
| U0.2 | Gate `TenantAdminSettingsPage` = `settings:write` (hiện `enabled:!!activeTenantId`, `TenantAdminSettingsPage.tsx:58`) — cả query enabled + UI | 1 FE + test | viewer mở → noPermission, không fetch |
| U0.3 | Route guard FE: `StaffRoute` (isStaff) cho `/operations-center`, `/admin/*`; `TenantRoute` (có tenant) cho `/tenant-admin/*`, `/tenant/*` → redirect `/dashboard` + notice | `main.tsx`, guard mới, menu test | 3 tests (staff/non-staff/no-tenant) |
| U0.4 | A2 SOC Users (map plan A2, không lặp) | §A2 | 11 tests |
| U0.5 | Roles page: query `enabled` theo quyền (hết fetch-trước-check-sau, `TenantAdminRolesPage.tsx:92-96`) + dùng `usePortfolio().ability` (bỏ `useAbility` lẻ `:74`) | 1 FE + test | — |

DoD: A1-A9 B+A không vỡ; U0 tests xanh; build PASS.

## Phase 1 — Membership + context (1 migration, 1 đợt)

| Slice | Việc | Files | Tests |
|---|---|---|---|
| U1.0 | Migration `TenantMember.status` (active/inactive, default active) + `TenantInvite` giữ nguyên | `models.py` + migration | migrate up/down OK |
| U1.1 | Deactivate thay delete: `DELETE members/` → set inactive giữ vết (vẫn cấm xoá owner/tự xoá); cancel invite pending vẫn xoá; list lọc active + tab inactive | `tenant_member_views.py`, Members page | 4 BE + 1 FE |
| U1.2 | Invite accept FE: route `/invites/:token/accept` (login rồi accept, email match) + decline endpoint (`DECLINED` sống lại) + **chặn invite `role=owner`** (serializer) | urls, views, page mới | 3 BE + 2 FE |
| U1.3 | Active-org统一: 1 storage (`localStorage tenant_id`); transport đọc cùng chỗ (sửa `transport.js:335-338` đang đọc sessionStorage); `switchTenant` validate membership (GET `/tenant/lifecycle/`) + refresh abilities (`syncAuthState`); middleware là authority cuối | transport, PortfolioContext, test | 2 FE + 1 BE |
| U1.4 | Transfer ownership v1 (giữ OneToOne): endpoint + UI, điều kiện target **chưa sở hữu tenant** (constraint ghi显式 trong message lỗi); chuyển xong inviter thành admin | views, Members page | 3 BE + 1 FE |

DoD: invite vòng đời tròn (mời→mail→accept/decline→member/deactivate); switch tenant đúng header+quyền; transfer 1 case.

## Phase 2 — Ownership + billing theo org (migration vừa, 2 đợt)

| Slice | Việc | Files | Tests |
|---|---|---|---|
| U2.1 | Migration `owner_user` OneToOne→FK + data giữ nguyên; sửa mọi `get(owner_user=)` (commercial ×6, middleware quota, abilities owner-check) thành resolve theo **active org** | models, commercial, middleware, resolve | suite BE liên quan xanh |
| U2.2 | Billing managers: `billing:read` xem subscription/invoice/quota (member có quyền), viết giữ owner/admin; partner billing helper resolve active org (bỏ owner-only) | commercial ×2 files, tests | 5 BE |
| U2.3 | Tạo tổ chức: `POST /partner/orgs/` (user sở hữu N) + `kind` (`personal|team`; tenant cũ: có member→team, solo→personal — data migration) + UI tạo/chuyển `kind` | models+views+FE | 3 BE + 1 FE |

DoD: member billing-manager xem/trả được; user 2 org switch đúng billing; quota theo org (hết fallback unlimited).

## Phase 3 — Keys + SSO + audit (1 đợt)

| Slice | Việc | Files | Tests |
|---|---|---|---|
| U3.1 | B+A personal keys (map plan B+A S1-S6, gắn `issued_for_member` = owner model user-owned; org key = SA-bound hiện có; UI phân biệt nhãn) | plan B+A | §6 B+A |
| U3.2 | SSO JIT: role mapping theo config + domain routing (về đúng org) + ngừng đẻ SA/email (dùng SA `sso` chung/tenant) | `sso.py`, tests | 4 BE |
| U3.3 | Audit events bổ sung: invite/member/role/transfer/plan/key (tenant-scoped, mẫu `admin_ops`) | các views chạm | mỗi slice ≥1 |

DoD: key nào chủ đó显式; SSO user vào đúng org không đẻ tenant rác.

## Phase 4 — UX polish (1 đợt)

Menu theo role (ẩn mục BE chặn — hết over-promise); gộp 3 hệ billing về 1 entry;
profile/logout sidebar thật (hết hardcode `Sidebar.tsx:176-190`); custom role **merge**
với system (thay override toàn phần) + seed `is_system`; `report:*` vào catalog+roles.
Mỗi mục 1-2 tests. DoD: viewer không còn thấy nút chết; suite menu xanh.

## Acceptance tổng + evidence

- [ ] Không còn lỗ ghi (Settings/route/F1) — test đỏ→xanh.
- [ ] Invite tròn vòng đời; transfer/owner N-org; billing đúng org; keys đúng chủ.
- [ ] Switch tenant đúng tenant + đúng quyền (test multi-tenant).
- [ ] Gates toàn repo xanh; evidence mỗi phase; ledger từng phase.
