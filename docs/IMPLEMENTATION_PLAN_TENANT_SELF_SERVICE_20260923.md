# IMPLEMENTATION PLAN — Tenant Self-Service B+A (2026-09-23)

> **Mục tiêu**: User thường (non-staff) có khu **"Tenant của tôi"** tự phục vụ:
> tạo/quản lý **API key cá nhân** + xem **usage thống kê tổng kết** —
> song song với console `/tenant-admin/*` đầy đủ khi đủ quyền (B+A).
> Đội code thực hiện **không cần hỏi lại**: mọi contract, file:line, lệnh gates,
> test case, acceptance đều chốt trong file này.

**Căn cứ đã verify** (không suy luận):
`docs/AUDIT_TENANT_APIKEY_NORMAL_USER_20260923.md` + research 2026-09-23.

---

## 0. Định nghĩa B+A (chốt, không đổi giữa chừng)

- **B — Self-service cho mọi user có tenant**: 2 trang mới `/tenant/keys` (API key của tôi)
  + `/tenant/usage` (Thống kê sử dụng), menu group mới hiện với **mọi user đã login có tenant**
  (kể cả viewer), không cần staff, không cần role token.
- **A — Giữ nguyên console admin**: `/tenant-admin/*` + menu Quản trị giữ nguyên
  `staffOnly` (`sidebaritems.ts:42,46`, `Sidebar.tsx:126-127`); không đụng 13 page hiện tại.
- **Bắt buộc kèm**: sửa **F1 webhook** (`views_webhooks.py:68-92` thiếu token check) — blocker audit.

---

## 1. Quyết định thiết kế đã chốt (D1–D12)

| ID | Quyết định | Lý do / căn cứ |
|---|---|---|
| D1 | Personal key = `CorePATCredential` sẵn có, **không migration**: `is_human_session=False`, `issued_for_member=<member của requester; None nếu owner>`, `service_account=<default SA của tenant>`, `label` bắt buộc prefix `personal:` | Tái dùng `issue_for_service_account` (`models.py:332-365`) → `max_active_pats` tự enforce; auth resolution đã đúng (`authentication.py:54-63`, `middleware.py:137-147`): key của member resolve đúng role member; owner (không member row) collapse về owner |
| D2 | Prefix `personal:` là **reserved**: endpoint personal tự gắn prefix; endpoint admin issue/rotate (`views_tenant.py:partner_issue_pat`, `partner_rotate_pat`, `issue_pat`) **reject** label/audit_reason bắt đầu `personal:` (mirror `_reject_human_session_markers`, `views_tenant.py:60-72`) | Phân biệt key cá nhân vs key máy trong admin list mà không cần thêm column |
| D3 | Endpoint personal **không yêu cầu role token** (own-data principle): chỉ `TENANT_PERMISSION_CLASSES` + tenant đã resolve bởi middleware. Mọi role (owner/admin/editor/viewer) đều tự quản key của mình | Key là dữ liệu cá nhân; role-token layer vẫn là authority cho mọi endpoint admin/shared khác |
| D4 | Scope key cá nhân: `requested ⊆ default SA scopes`, tái dùng `_validate_requested_pat_scopes(request, default_sa, scopes)` (`views_tenant.py:75-109`). Không allowlist riêng. Lưu ý 2 lớp phòng thủ độc lập: PAT-scope layer (`manage_pats` — human session bypass, `permissions.py:41-42`) và tenant-permission layer (`pat:write` — viewer không có) — viewer cầm scope rộng vẫn 403 ở lớp 2 | Role-token layer (`require_tenant_permission`) vẫn là authority cuối khi key được dùng |
| D5 | Default SA resolve bằng `get_or_create(tenant, name="default", defaults={status ACTIVE, scopes ['market:read','signals:read']})` — mirror `register.py:288-295`. Scope mặc định khi request rỗng = `list(default_sa.scopes)` nguyên vẹn (tenant đã activate có thêm `ai:invoke,manage_pats` — `register.py:296-299`, không hardcode) | Tenant cũ thiếu SA default (trước backfill) vẫn dùng được |
| D6 | Admin `PATListView` (`views_tenant.py:210-222`) **vẫn thấy** personal keys (transparency cho admin); admin rotate/revoke kỹ thuật chạm được (owner/admin/editor có `pat:write`) — **known limitation v1**, giống key máy shared hiện nay. UI admin hiển thị nhãn `personal:` để nhận biết | Không đổi behavior admin; không scope-creep |
| D7 | FE section mới **ngoài** `TenantAdminLayout`: `/tenant/keys`, `/tenant/usage` dưới AppShell (`main.tsx:101-149`), dùng `ShellPageChrome` như page thường. Sidebar group mới `layout.nav.group.tenant`, item **không** `staffOnly` mà dùng flag mới `requiresTenant` | Tách UX self-service khỏi console admin; menu hiện đúng đối tượng |
| D8 | Page gate = `ability.can` (convention 13 page hiện tại, vd `TenantAdminPATsPage.tsx:116`): keys → `read TenantPATAdmin`, usage → `read TenantUsageView` (BE đã cấp cho mọi user có tenant, `helpers.py:113-135`, **không sửa abilities**). User không tenant → sidebar ẩn + page render `noPermission` empty | Zero BE ability change; nhất quán convention |
| D9 | i18n: object mới `tenantKeys.*`, `tenantUsageSummary.*` (vi+en) + label sidebar `layout.nav.tenantKeys/tenantUsageSummary/group.tenant` + `routes.tenantKeys/tenantUsageSummary`. `npm run i18n:scan` exit 0 | Convention `vi.js:1584-1797` / `en.js:1584-1781` |
| D10 | `routeCatalog.js`: 2 entries `tenant-keys` (`/tenant/keys`), `tenant-usage` (`/tenant/usage`), `group:"system"`, `requiredCapabilities:["tenant.self.read"]` (descriptive, không enforce — như F6), `adapter:"core"`, `status:"core"`. `navigationCatalog.js`: thêm group `tenant` (items `["tenant-keys","tenant-usage"]`) **sau khi** grep consumer (S0) | Test `main-menu-contract` dòng 98-102 bắt buộc mọi sidebar path có mặt trong catalog |
| D11 | Icon sidebar: `Key` (thêm 1 dòng whitelist `lucide-icon.tsx:12-64`) + `Activity` (đã có `:45`) | Convention whitelist (R5 audit broker) |
| D12 | API FE qua `defaultCoreApiAdapter as unknown as {...}` (constraint AGENTS.md); React Query hook mới `useTenantSelfQuery` mirror `useTenantAdminQuery.ts:14-87` với scope `'tenant-self'` (tránh lẫn cache admin) | Không lẫn invalidate scope `tenant-admin` |

---

## 2. Ma trận phân quyền (sau implement)

| Actor | `/tenant/keys` + `/tenant/usage` | `/tenant-admin/*` (menu) | Personal key của người khác |
|---|---|---|---|
| Owner (mọi user solo) | ✅ full (tạo/xem/xoá key mình, usage) | ✅ (giữ nguyên hiện tại) | Thấy trong admin list (D6), không sửa qua endpoint personal |
| Admin/Editor/Viewer (member) | ✅ key của mình, usage tenant | Theo menu staffOnly hiện tại | 404 (fail-closed, không lộ tồn tại) |
| User không tenant | Ẩn menu; page → noPermission | Ẩn | 403 `tenant_not_found` (middleware) |
| Staff/Superuser | Như owner + admin menu hiện tại | ✅ | Như owner |

---

## 3. Contract BE (chi tiết, implement y hệt)

### 3.1 File mới `packages/core/backend/src/identity_access/views_personal.py`

Import dùng lại (không copy logic):
`_normalize_scope_codes`, `_reject_human_session_markers`, `_validate_requested_pat_scopes`,
`_serialize_partner_pat` từ `views_tenant`; `require_pat_scopes_or_human_session` từ `permissions`;
`resolve_tenant`, `get_tenant_permissions` từ `utils.resolve_tenant`;
`CorePATCredentialSerializer` (+ serializer mới §3.2) từ `serializers`.
`TENANT_PERMISSION_CLASSES`: import từ **`views/helpers.py:18`** (module nhẹ;
định nghĩa gốc `views_tenant.py:32`, nhưng cấm import từ `views_tenant` để tránh coupling) —
**không định nghĩa lại** (hằng này đã bị duplicate ở `views_webhooks.py:32`,
`commercial_partner_views.py:20`, `views_reports.py:16).

Helper nội bộ (private, prefix `_personal_`):
- `_personal_member(request)` → trả `TenantMember|None`: `getattr(request,'tenant_member',None)`
  (chỉ tồn tại khi `get_tenant_role()` đã chạy — `resolve_tenant.py:178,188,192`;
  **middleware KHÔNG set attribute này**, chỉ set `tenant`/`tenant_role` tại
  `middleware.py:97-98`) + fallback query
  `TenantMember.objects.filter(tenant=..., user=...).first()`;
  owner (không row) → `None`. Gọi `get_tenant_role(request)` trước để lấp cache.
- `_personal_default_sa(tenant)` → `get_or_create(name="default", defaults scopes ['market:read','signals:read'])`.
- `_personal_key_qs(request)` → `CorePATCredential.objects.filter(service_account__tenant=tenant, is_human_session=False, issued_for_member=<member|None>, label__startswith="personal:")`.
  Owner: `issued_for_member__isnull=True` + cùng 2 điều kiện còn lại.
- `_personal_get_key(request, key_id)` → `get_object_or_404(_personal_key_qs, public_id=key_id)` → cross-user auto **404**.

### 3.2 Serializer mới trong `serializers.py` (append cuối, không sửa cũ)

`PersonalPATIssueSerializer`: copy `PartnerPATIssueSerializer` (`serializers.py:201-234`)
**bỏ** field `service_account_id` (BE tự resolve default SA), giữ `scope_codes/scopes/expires_at/display_name/label/audit_reason/allowed_cidr_blocks` + validate CIDR y hệt.
Reuse nguyên `PartnerPATRotateSerializer`, `PartnerPATRevokeSerializer`.

### 3.3 Endpoints (mount vào `partner_urls.py`, kèm bản `-noslash` như convention `:33-170`)

| Method + Path | Gate | Input | Output 200/201 | Lỗi |
|---|---|---|---|---|
| `GET /partner/me/keys/` | TENANT_PERMISSION_CLASSES | — | `{results:[CorePATCredentialSerializer...]}` (secret **không** trả) | 403 no-tenant (middleware) |
| `POST /partner/me/keys/` | như trên | `{display_name?, scope_codes?=[], expires_at?, allowed_cidr_blocks?=[]}`; label ép `personal:<display_name hoặc 'key'>` | `_serialize_partner_pat(cred, secret=raw)` — **secret chỉ 1 lần** | 400 scope ⊄ SA / CIDR sai / expires quá khứ / `personal:` trong input (ép prefix, không cho tự đặt); 400 `max_active_pats` (từ model) |
| `POST /partner/me/keys/<id>/rotate/` | như trên | reuse RotateSerializer (grace default 3600) | `{object:'personal_pat_rotation', old_token_id, old_token_grace_until, new_token:{...secret 1 lần}}` | 404 key người khác; 400 SA default bị disable |
| `POST /partner/me/keys/<id>/revoke/` | như trên | reuse RevokeSerializer | `{object:'personal_pat_revocation', token_id, status, revoked_at}` | 404 key người khác |
| `GET /partner/me/keys/usage-summary/?days=30` | như trên | `days 1-90` (`_parse_days_param`, `views_tenant.py:468-473`) | `{total_keys, active_keys, total_calls_30d, keys:[{pat_id,label,calls_30d,last_used_at}]}` — mirror `partner_pat_usage_summary` (`views_tenant.py:531-564`) nhưng filter `_personal_key_qs` | — |
| `GET /partner/me/summary/` | như trên | — | `{tenant:{plan,status,display_name,tenant_code}, quotas:{api_calls_limit,period_start,period_end}, my:{total_keys,active_keys,calls_30d}}` — quotas copy truy vấn `QuotaRecord` kỳ hiện tại (`commercial.models`; mẫu `middleware.py:359-405`; **cấm import** `_get_tenant_quota_limit` vì là instance method của `TenantQuotaMiddleware`) | no-tenant → **403** `tenant_not_found` từ middleware (không 404 — mẫu `TenantLifecycleView` chỉ 404 được vì dùng `permission_classes=[IsAuthenticated]`) |

Validation cứng (400, message VI full dấu):
- `expires_at` nếu có phải > now.
- `scope_codes` rỗng → mặc định scopes của default SA (`['market:read','signals:read']` + `ai:invoke` nếu SA có).
- Từ chối input label/audit_reason bắt đầu `personal:` (để BE ép prefix) và `login:` (reuse `_reject_human_session_markers`).
- `allowed_cidr_blocks` validate CIDR (có sẵn trong serializer).

### 3.4 Sửa F1 webhook (cùng đợt, file `views_webhooks.py`)

Thêm vào `WebhookConfigDetailView.get` → `_require_tenant_permission(request, 'webhook:read')`;
`patch`/`delete` → `_require_tenant_permission(request, 'webhook:write')`
(ngay sau dòng `require_pat_scopes_or_human_session`, mirror `WebhookConfigListCreateView:40,47`).
Lưu ý: cả 3 methods (GET/PATCH/DELETE) đều thiếu — GET cũng lộ config + HMAC secret cho viewer.

---

## 4. Contract FE (chi tiết, implement y hệt)

### 4.1 Hook `src/pages/tenant/useTenantSelfQuery.ts` (mới)

Mirror `pages/tenant-admin/useTenantAdminQuery.ts:1-87`, đổi duy nhất scope
`TENANT_ADMIN_QUERY_SCOPE → "tenant-self"`, còn lại giữ nguyên
(`coreFetch` cast adapter, `readActiveTenantId`, `enabled`, `invalidateTenantSelfQueries`).

### 4.2 Registry + route + catalog

- `pageRegistry.js` (sau block `:260-289`): 2 dòng `makePageEntry("tenant-keys","core",()=>import("./tenant/TenantKeysPage.tsx").then(m=>m.TenantKeysPage))` + `("tenant-usage",...TenantUsageSummaryPage)`.
- `main.tsx` (trong parent `/`, ngang hàng `:125-143`): `Route path:'tenant/keys' → resolvePageComponent('tenant-keys')`, `Route path:'tenant/usage' → resolvePageComponent('tenant-usage')`. **Không** đặt dưới `TenantAdminLayout`.
- `routeCatalog.js`: 2 entries shape như `dashboard` (`:47-55`): `{id:"tenant-keys", path:"/tenant/keys", titleKey:"routes.tenantKeys", group:"system", buildTargets:["saas","vip"], requiredCapabilities:["tenant.self.read"], adapter:"core", status:"core"}` (+ tương tự usage).
- `navigationCatalog.js`: thêm group `{id:"tenant", labelKey:"layout.nav.group.tenant", buildTargets:["saas","vip"], requiredCapabilities:["tenant.self.read"], items:["tenant-keys","tenant-usage"]}` — trước đó S0 grep consumer (hiện tại **zero consumer**: chỉ định nghĩa + re-export `index.js:3` + nhắc `README`; thêm vào chỉ để đồng bộ metadata, kèm test catalog chứa 2 path mới — nếu vướng thì cắt khỏi phạm vi, không ảnh hưởng runtime).

### 4.3 Sidebar + icon

- `navigation.ts`: `NavItem/NavGroup` thêm `requiresTenant?: boolean` (optional, mirror `staffOnly?`).
- `sidebaritems.ts`: group mới sau group account (`:29-38`), trước admin:
  `{group:'layout.nav.group.tenant', requiresTenant:true, items:[{labelKey:'layout.nav.tenantKeys', path:'/tenant/keys', icon:'Key', requiresTenant:true},{labelKey:'layout.nav.tenantUsageSummary', path:'/tenant/usage', icon:'Activity', requiresTenant:true}]}`.
- `Sidebar.tsx` filter (cạnh `:126-127`): `const hasTenant=(userTenants?.length??0)>0;` group/item có `requiresTenant && !hasTenant → ẩn`.
- `lucide-icon.tsx`: thêm `Key: Icons.Key` (cạnh `:35 User`).

### 4.4 Pages mới `src/pages/tenant/`

**`TenantKeysPage.tsx`** (mirror flow `TenantAdminPATsPage.tsx:116-268`):
gate `canRead=ability?.can?.("read","TenantPATAdmin") ?? false` → `!canRead` render
`ShellPageChrome(notice noPermission)+ShellEmptyState` y hệt `:255-268`;
list `useTenantSelfQuery(["tenant-self","keys"],"/partner/me/keys/")`;
create modal (display_name, scope multi-check từ SA scopes, expires date, CIDR textarea) →
`POST /partner/me/keys/` → hiện secret 1 lần (copy button, cảnh báo) → invalidate;
mỗi row: prefix, scopes, last_used, expires, calls_30d (lazy `GET /partner/me/keys/usage-summary/`),
nút Rotate (confirm + grace note) / Revoke (confirm + reason).
**`TenantUsageSummaryPage.tsx`** (rút gọn từ `TenantAdminUsagePage.tsx:110-286`):
`GET /partner/me/summary/` (card plan/status/quota + my keys/calls),
`getApiUsageAnalytics(groupBy,days)` (`coreApiAdapter.js:164`) chart,
`getUsageTrend(days)` (`operator.js:81`) timeline; tabMeters/history tối giản 2 tab;
gate `ability.can("read","TenantUsageView")`, skeleton/error/empty mirror `:246-286`.

### 4.5 i18n (vi+en, full dấu VI)

- `vi.js` sau `tenantUsageHistory` (`:1797`): object `tenantKeys:{eyebrow:"API Key",title:"API Key của tôi",descriptionQUEST, actions, table headers, createModal fields, secretOnceWarning, rotateConfirm, revokeConfirm, emptyState, errors:{scopeExceeded, expiredPast, ...}}`,
  `tenantUsageSummary:{eyebrow,title,description,cards:{plan,quota,myKeys,myCalls},tabs}`.
- Sidebar: `layout.nav.group.tenant:"Tenant của tôi"`, `layout.nav.tenantKeys:"API Key của tôi"`, `layout.nav.tenantUsageSummary:"Thống kê sử dụng"` (+ `routes.tenantKeys/tenantUsageSummary`).
- `en.js` mirror 1-1. `npm run i18n:scan` exit 0.

---

## 5. Work breakdown (thứ tự bắt buộc)

| Step | Việc | Files chạm | DoD | Gates |
|---|---|---|---|---|
| S0 | Grep consumer `navigationCatalog` (kết quả đã biết: zero consumer — S0 chỉ xác nhận lại) + đọc `PartnerPATRevokeSerializer` + S0 verify `ability.can('read','TenantPATAdmin')` bằng rules BE thật (BE chỉ cấp `manage` — cần bằng chứng CASL khớp) + liệt kê lệnh test BE/FE đang xanh trên HEAD | read-only | Ghi kết quả vào evidence `s0-verify.md` | — |
| S1 BE personal | `views_personal.py` (6 fn §3.1/3.3) + serializer §3.2 + mount `partner_urls.py` + **chặn prefix `personal:` ở `views_tenant.py` (3 hàm `issue_pat`/`partner_issue_pat`/`partner_rotate_pat`, mirror `_reject_human_session_markers`)** + `tests/test_personal_keys.py` (≥12 cases §6) | 5 files mới/sửa | API đúng contract §3.3 qua test client | BE suite identity_access xanh; `manage.py check` 0 |
| S2 BE F1 | Sửa `views_webhooks.py` §3.4 + test viewer PATCH/DELETE→403, owner→200 trong `tests/test_webhook_*.py` (tạo mới nếu chưa có) | 1-2 files | F1 đóng, không vỡ test cũ | BE suite xanh |
| S3 FE nền | `mkdir src/pages/tenant/` (chưa tồn tại) + i18n §4.5 + whitelist Key + hook §4.1 (mirror cả mutation hoặc tham số hoá scope) + registry/route/catalog/nav §4.2 + sidebar §4.3 | ~9 files | `i18n:scan` 0; menu test cũ vẫn xanh | `npx tsc --noEmit` 0 |
| S4 FE keys | `TenantKeysPage.tsx` + `TenantKeysPage.component.test.tsx` (skeleton, noPermission khi canRead false, create success hiện secret 1 lần, revoke confirm) | 2 files | 4+ tests xanh | tsc 0 |
| S5 FE usage | `TenantUsageSummaryPage.tsx` + test (skeleton, cards từ me/summary, chart render) | 2 files | 3+ tests xanh | tsc 0 |
| S6 Contract | Update `main-menu-contract` (+2 tests: group tenant hiện với non-staff có tenant / ẩn khi không tenant; catalog cover 2 path mới) | 1 file | Toàn bộ menu tests xanh | vitest + jest liên quan xanh |
| S7 Đóng | `npm run build` PASS + full gates + ledger Entry + AGENTS progress | docs | §7 đạt hết | §7 |

Sau mỗi sub-step: `npx tsc --noEmit`; cuối mỗi step: `npm run build` (constraint AGENTS.md).

---

## 6. Tests bắt buộc (liệt kê để đội code tick)

**BE `tests/test_personal_keys.py`** (dùng APIClient + force_authenticate, tenant+member fixture như `test_pat_tenant_binding.py:42-90`):
1. owner GET list rỗng → `[]`; 2. owner POST tạo key → 201, `secret` có, `secret.startswith('vni_')` + `token_prefix == raw[:12]` (format `vni_<plan>_` + token — `models.py:26-33`), label startswith `personal:`; 3. GET list thấy key, **không** có secret; 4. scope vượt SA → 400; 5. expires quá khứ → 400; 6. rotate (gọi **keyword-only**, mirror `views_tenant.py:380-383` — `models.py` có 2 `mark_rotating`, định nghĩa sau `:388` thắng) → 200 có `new_token.secret`, old ROTATING + `expires_at` được set; 7. revoke → status revoked, key revoke Bearer gọi API → **401** (`AuthenticationFailed`, không 403); 8. member tạo key mình → 201; rotate key của member khác → **404** (không 403); 9. viewer tạo key → 201 (self-service đúng D3); 10. personal key Bearer gọi `GET /partner/me/summary/` → 200 đúng user; 11. usage-summary số khớp `PATAuditLog` **seed trực tiếp** (`objects.create(...)`, không gọi HTTP rồi đếm — log flush bất đồng bộ qua Redis); 12. `max_active_pats` (set tenant=1): cả 2 key **bắt buộc `expires_at` tương lai** (model chỉ đếm `expires_at__gt=now`, key không expiry bypass quota) → key thứ 2 → 400.
**BE webhook**: viewer GET/PATCH/DELETE webhook → 403; owner PATCH → 200 (đóng F1).
**FE**: S4 (4) + S5 (3) + S6 (2) như bảng §5; update snapshot nếu có.

---

## 7. Tiêu chí nghiệm thu (Acceptance — PASS/FAIL rõ ràng)

- [ ] A1. Login user thường (non-staff, đã verify email): sidebar **thấy** "Tenant của tôi" → "API Key của tôi", "Thống kê sử dụng"; **không thấy** nhóm Quản trị.
- [ ] A2. Tạo key: nhập tên → nhận secret **đúng 1 lần** (+ copy), reload không còn secret; key dùng Bearer gọi được API read; hết hạn/revoke → gọi fail.
- [ ] A3. Member B không list/rotate/revoke được key member A (UI không hiện; API 404).
- [ ] A4. `/tenant/usage` hiện đúng plan/quota/keys/calls của chính tenant mình; số khớp BE.
- [ ] A5. User không tenant: không thấy group; vào URL → noPermission (không crash).
- [ ] A6. Staff: menu Quản trị + self-service đều đủ; 13 page admin không đổi behavior.
- [ ] A7. F1 đóng: viewer PATCH webhook → 403 (test).
- [ ] A8. Gates: `npx tsc --noEmit` 0; `npm run build` PASS; `npm run lint` 0 errors; vitest/jest suites chạm xanh; BE `identity_access` + `manage.py check` 0; `i18n:scan` 0; VI full dấu.
- [ ] A9. Evidence `docs/evidence/tenant-self-service-20260923/` có: BE test log, FE test log, build log, 2 screenshot (`/tenant/keys`, `/tenant/usage` role user thường).

**Checklist phản biện** (reviewer độc lập tick trước merge):
R1. Mọi endpoint personal có test cross-user 404? R2. Secret có lọt vào GET list/log? (grep `secret` response GET) R3. Scope có vượt SA được không? R4. Admin list có phân biệt `personal:`? R5. Menu test cover có/không tenant? R6. Catalog cover 2 path mới? R7. Không migration mới? (`git status` không có `migrations/`) R8. Không vỡ 13 page admin (suite tenant-admin xanh)?

---

## 8. Rủi ro + ngoài phạm vi

- Rủi ro: tenant cũ thiếu SA default → đã cover D5 get_or_create. Quota `max_active_pats=-1` = unlimited (giữ semantics model).
- **Out of scope**: đổi behavior `/tenant-admin/*`; thêm scope code mới; key-to-key delegation; SSO/billing self-service; rate-limit riêng personal key.
- Known limitation v1 (ghi vào release note): admin có `pat:write` kỹ thuật chạm được personal key (D6).

## 9. Bàn giao

Đội code trả: code + tests §6 + evidence §A9 + ledger entry mới + cập nhật AGENTS.md Progress.
Reviewer chạy lại §7+Mục R rồi mới merge.

---

# PHỤ LỤC A2 — Màn quản trị Users native trong SOC (staff-only)

> Phạm vi: admin (staff) quản trị user toàn hệ thống — list/search/filter,
> khoá/mở tài khoản, đổi plan. **Không đụng B+A, không đổi abilities,
> không migration.** Tổng **11 tests** (8 BE + 3 FE) + DoD + evidence.
> Căn cứ verify: `service_ops/urls.py:1-164`, `views/base.py:99-102`,
> `ops_audit/models.py:12-43`, `identity_access/models.py:42-89,597-634`,
> `ShellOperationsCenterPage.tsx:26-108`, `soc.js:45-50`, `lucide-icon.tsx:35`,
> `vi.js:134,162-183`, `test_soc_api_overview.py:201-217`.

## A2.1 Contract BE — `service_ops/views/users.py` (mới) + mount `service_ops/urls.py`

- Class base: kế thừa `SOCBaseView` (`views/base.py:99-102`,
  `permission_classes=[IsAuthenticated, IsAdminUser]`) — hưởng staff-guard,
  không override. Mount: `users/`, `users/<int:user_id>/set-active/`,
  `users/<int:user_id>/set-plan/` (đuôi `/`, theo convention `urls.py:19-163`).
- `GET /api/soc/users/` query: `search` (icontains username/email/first_name/last_name),
  `plan` (1 trong `PlanChoices`: free/starter/pro/enterprise/custom/internal),
  `status` (active/suspended/deprovisioned — của tenant sở hữu; user không tenant → `none`),
  `is_staff`/`is_active` (true/false). Paginate `StandardPageNumberPagination`
  (`vninvest_core.pagination`, mẫu `base.py:22,160`), `page_size` default 20 max 100
  (mẫu `scheduler.py:24-27`).
  Row: `{id, username, email, full_name, is_active, is_staff, is_superuser,
  date_joined, tenant:{tenant_code, display_name, plan, status}|null, member_of:[{tenant_code, role}]}`.
  Join: owner `CoreTenant.owner_user` (OneToOne, `models.py:65-70`) +
  member `TenantMember(user)` (`models.py:597-612`) — `select_related/prefetch_related`,
  test `assertNumQueries` (N+1).
- `POST set-active/` body `{is_active: bool, reason: string bắt buộc non-empty → 400}`:
  target == request.user → 400 (chặn tự khoá); target.is_superuser + is_active=false → 403;
  user không tồn tại → 404. Ghi `AuditEvent(action='update', resource_type='core_user',
  resource_id, actor_user_id/label, metadata={reason, from, to})`
  (mẫu `admin_ops/views.py:492-501`; `AuditEvent` **không** có cột reason riêng —
  reason vào `metadata`, `ops_audit/models.py:12-43`).
- `POST set-plan/` body `{plan, reason bắt buộc}`: plan phải thuộc `PlanChoices` → 400 nếu sai;
  đổi `plan` của `CoreTenant` mà `owner_user=target`; target không sở hữu tenant → 404
  (member thuần không đổi được plan — ghi rõ message). Ghi `AuditEvent` như trên
  (`metadata={reason, from_plan, to_plan}`).
- Tests BE (8, mẫu envelope 403 `test_soc_api_overview.py:201-217`):
  1. staff GET 200 + envelope/page keys; 2. non-staff GET → 403; 3. search/filter combo
  đúng tập; 4. plan/status filter (kể cả `status=none`); 5. set-active lock/unlock OK +
  AuditEvent có metadata.reason; 6. tự khoá → 400 + thiếu reason → 400 + khoá superuser → 403;
  7. set-plan OK + plan sai → 400 + target không tenant → 404; 8. `assertNumQueries` list 50 users.

## A2.2 Contract FE — tab SOC "Người dùng"

- `ShellOperationsCenterPage.tsx`: thêm `{key:'users', icon:'User'}` vào `SOC_TABS`
  (`:26-36`) + `case 'users'` trong `renderTabContent()` (`:73-96`) +
  entry `TAB_DESCRIPTIONS` (`:98-108`). Icon `User` đã có whitelist (`lucide-icon.tsx:35`).
- Component mới `components/soc/SocUsersPanel.tsx`: search input (debounce) + filter
  (plan/status/staff/active) + table + nút Khoá/Mở (confirm + reason prompt bắt buộc) +
  modal đổi plan (select + reason bắt buộc). Adapter `soc.js`: `getSocUsers(params)`,
  `setSocUserActive(id, body)`, `setSocUserPlan(id, body)` qua `createSocClient`
  (`soc.js:45-50`); FE gọi qua `defaultCoreApiAdapter as unknown as {...}`
  (mẫu `DataOpsContext.tsx:77-83`).
- i18n ~25 keys `soc.users.*` (table headers, filters, confirm, errors, empty) +
  `soc.tabs.users` + `users_description` (khu `vi.js:134,162-183` / `en.js:134,162-183`,
  mirror 1-1; `i18n:scan` 0).
- Tests FE (3, mẫu `__tests__/soc-overview-tab.component.test.tsx:1-19` —
  mock `defaultCoreApiAdapter`): render table từ mock; nút khoá gọi API kèm reason;
  modal đổi plan submit đúng body.

## A2.3 DoD + evidence A2

- DoD: 11 tests xanh; `tsc` 0; build PASS; lint 0 errors; `manage.py check` 0;
  self-lock/superuser-lock bị chặn (test); N+1 assert pass; VI full dấu.
- Evidence: `docs/evidence/soc-users-20260923/` (BE/FE test log + screenshot tab Users
  với staff).
- Ledger entry riêng khi đóng A2. Không chạm file B+A (§5) trừ khi merge conflict.
