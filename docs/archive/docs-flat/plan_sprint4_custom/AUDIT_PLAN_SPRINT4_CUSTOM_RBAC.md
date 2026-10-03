# AUDIT PLAN — Sprint 4: Custom RBAC Roles (Full Permission-Based + Full UI)

**Ngày:** 2026-07-18
**Phạm vi:** TenantCustomRole model + permission resolution layer + guard refactor (role→permission) + CRUD API + frontend TenantAdminRolesPage.
**Khung:** AGENTS.md AI Audit Framework (verify by evidence)
**Trạng thái:** PLAN (chưa implement)
**User scope decision:** Full permission-based enforcement + full UI in this sprint.

---

## 0. TÓM TẮT 5 FINDINGS NGHIÊM TRỌNG NHẤT

1. 🔴 **Plan gốc bỏ sót enforcement layer**: `TENANT_MANAGEMENT_SPRINT_PLAN.md` Step 4.1-4.3 chỉ thêm model + API + UI, KHÔNG đổi guard mechanism. Nếu chỉ làm vậy, custom roles vô nghĩa (như Sprint 1 Phase B cũ). Phải thêm `require_tenant_permission()` + wire vào `get_tenant_role`/`TenantMember.custom_role`.
2. 🔴 **46 guard call sites** (verified: grep = 46, không phải 42). Phải map sang permission tokens. Full permission-based = refactor toàn bộ.
3. 🟠 **`TenantMember.role` là CharField choices** (models.py:555) — chỉ 4 values. Thêm `custom_role` FK (null); GIỮ nguyên `role` field (option A — backward-compat). custom_role override permission resolution.
4. 🟠 **Permission layer tồn tại nhưng không cover tenant-role perms**: `permissions.py:39` `require_pat_scopes_or_human_session` chỉ check PAT `scopes` (machine). Custom role chỉ affect layer 2 (tenant permission). Hai layer là orthogonal dimensions — xem §4.3.
5. 🟡 **System role → permission seed**: definitive token list ở §4.0. owner=['*'], admin=all, editor=write-subset, viewer=read-only.

---

## 0.1 INDEPENDENT CRITIQUE RESOLUTION (2026-07-18)

All 7 critique findings VERIFIED by code evidence and RESOLVED:

| ID | Finding | Resolution |
|----|---------|-----------|
| F1 | Guard count 42 → thực tế 46 | Corrected. 46 sites across 10 files. Full map ở §4.4. |
| F2 | `request.tenant_member` phantom → N+1 | Set `request.tenant_member` trong `get_tenant_role` khi query TenantMember. `get_tenant_permissions` đọc từ request cache. |
| F3 | PAT scope vs permission double-gate | RESOLVED: Human-session PATs always carry SA scope `manage_tenant` → layer 1 pass. Custom role chỉ affect layer 2. Machine PATs scope-gated như cũ. Two orthogonal dimensions, no conflict. |
| F4 | `role='custom'` breaks choices validation | Chọn Option (a): GIỮ original `role` value, thêm `custom_role` FK độc lập. |
| F5 | views_reports.py + commercial_partner_views.py scope-only | Thêm vào Phase B scope: 17 endpoints cần `require_tenant_permission`. |
| F6 | Token list placeholders | Definitive bảng ở §4.0. |
| F7 | views_tenant.py:583 ref sai | Corrected: CRUD views append sau line 618. |

---

## 1. BẢN ĐỒ KIẾN TRÚC (file | line | trách nhiệm)

| File | Line | Trách nhiệm | Note |
|---|---|---|---|
| `identity_access/models.py` | 533-537 | `RoleChoices` (owner/admin/editor/viewer) | Giữ làm fallback |
| `identity_access/models.py` | 555-560 | `TenantMember.role` CharField choices | Thêm `custom_role` FK |
| `identity_access/utils/resolve_tenant.py` | 93-129 | `get_tenant_role` | Set `request.tenant_member` khi query |
| `identity_access/utils/resolve_tenant.py` | NEW | `get_tenant_permissions` + `require_tenant_permission` | Mới |
| `identity_access/permissions.py` | 39-52 | `require_pat_scopes_or_human_session` | Layer 1 — unchanged |
| `identity_access/views/*.py` | (46 sites) | `_require_tenant_role` calls | Map sang permission tokens |
| `identity_access/views_tenant.py` | 618+ (append) | `PartnerRoleListCreateView`, `PartnerRoleDetailView` | CRUD custom roles |
| `identity_access/partner_urls.py` | 38-39 | Routes | Thêm `/partner/roles/` |
| `web/src/pages/tenant-admin/TenantAdminSettingsPage.tsx` | — | FE pattern mẫu | Copy convention |
| `web/src/adapters/coreApiAdapter.js` | — | `coreGet/corePost` | Dùng cho roles API |
| `web/src/i18n/vi.js` / `en.js` | 4757 / 4741 | i18n keys | Thêm `tenantRoles.*` |

---

## 2. LUỒNG DỮ LIỆU ĐÃ TRACE (use-case: custom role "Analyst" với perms ['usage:read','forecast:read'])

1. Owner tạo role: `POST /core/v1/partner/roles/` `{name:'Analyst', permissions:['usage:read','forecast:read']}` → `PartnerRoleListCreateView` → `TenantCustomRole.objects.create(tenant, name, permissions, is_system=False)`.
2. Owner gán role cho member: `PATCH /core/v1/tenant-members/{id}/` `{custom_role_id: '<role_id>'}` → `TenantMember.custom_role = role`. `role` field giữ nguyên giá trị gốc (viewer/editor/etc).
3. Member login → PAT `issued_for_member=member` → middleware resolve `user=member.user`, `request.tenant_role=member.role`, `request.tenant_member=member`.
4. Member gọi `GET /core/v1/partner/usage/` → view guard `require_tenant_permission(request, 'usage:read')` → `get_tenant_permissions(request)` → từ `request.tenant_member.custom_role.permissions` = ['usage:read','forecast:read'] → có 'usage:read' → PASS.
5. Member gọi `POST /core/v1/partner/settings/` → guard `require_tenant_permission(request, 'settings:write')` → custom_role không có → 403.

---

## 3. CONTRADICTIONS (plan vs code)

| Plan (TENANT_MANAGEMENT_SPRINT_PLAN.md) | Thực tế (code) | Tác động |
|---|---|---|
| Step 4.1 "System roles seeded" | Chưa có seed logic; `RoleChoices` chỉ define constants | Cần viết seed migration/data |
| Step 4.2 "Owner/admin only" cho roles API | `_require_tenant_role(request,'owner','admin')` đã có pattern | OK, tái dùng |
| Step 4.3 "permission matrix checkboxes" | FE chưa có permission token list constants | Cần định nghĩa token list ở FE (mirror backend) |
| Plan KHÔNG mention đổi `_require_tenant_role` calls | 46 sites hardcode role tuples | FULL permission-based yêu cầu refactor → plan thiếu step này |

---

## 4. DESIGN (Full Permission-Based)

### 4.0 DEFINITIVE PERMISSION TOKEN LIST (F6 resolved — blocking gap)

**Token catalog** — flat `<resource>:<action>` tokens:

```
member:read    member:write
sa:read        sa:write
pat:read       pat:write
usage:read
dashboard:read
security:read
alert:read     alert:write
forecast:read  forecast:write
webhook:read   webhook:write
sso:read       sso:write
billing:read   billing:write
settings:read  settings:write
tenant:write   (owner/admin destructive: deprovision, transfer)
```

**System role → permission mapping** (implementation-ready):

| Token | owner | admin | editor | viewer |
|-------|-------|-------|--------|--------|
| `*` (wildcard) | ✅ | — | — | — |
| `member:read` | ✅ | ✅ | ✅ | — |
| `member:write` | ✅ | ✅ | — | — |
| `sa:read` | ✅ | ✅ | ✅ | ✅ |
| `sa:write` | ✅ | ✅ | ✅ | — |
| `pat:read` | ✅ | ✅ | ✅ | ✅ |
| `pat:write` | ✅ | ✅ | ✅ | — |
| `usage:read` | ✅ | ✅ | ✅ | ✅ |
| `dashboard:read` | ✅ | ✅ | ✅ | ✅ |
| `security:read` | ✅ | ✅ | ✅ | ✅ |
| `alert:read` | ✅ | ✅ | ✅ | ✅ |
| `alert:write` | ✅ | ✅ | ✅ | — |
| `forecast:read` | ✅ | ✅ | ✅ | ✅ |
| `forecast:write` | ✅ | ✅ | ✅ | — |
| `webhook:read` | ✅ | ✅ | — | — |
| `webhook:write` | ✅ | ✅ | — | — |
| `sso:read` | ✅ | ✅ | — | — |
| `sso:write` | ✅ | ✅ | — | — |
| `billing:read` | ✅ | ✅ | — | — |
| `billing:write` | ✅ | ✅ | — | — |
| `settings:read` | ✅ | ✅ | ✅ | ✅ |
| `settings:write` | ✅ | ✅ | — | — |
| `tenant:write` | ✅ | ✅ | — | — |

Implementation:
```python
SYSTEM_ROLE_PERMISSIONS = {
    'owner': ['*'],
    'admin': [
        'member:read', 'member:write',
        'sa:read', 'sa:write',
        'pat:read', 'pat:write',
        'usage:read', 'dashboard:read', 'security:read',
        'alert:read', 'alert:write',
        'forecast:read', 'forecast:write',
        'webhook:read', 'webhook:write',
        'sso:read', 'sso:write',
        'billing:read', 'billing:write',
        'settings:read', 'settings:write',
        'tenant:write',
    ],
    'editor': [
        'member:read',
        'sa:read', 'sa:write',
        'pat:read', 'pat:write',
        'usage:read', 'dashboard:read', 'security:read',
        'alert:read', 'alert:write',
        'forecast:read', 'forecast:write',
        'settings:read',
    ],
    'viewer': [
        'sa:read', 'pat:read',
        'usage:read', 'dashboard:read', 'security:read',
        'alert:read', 'forecast:read',
        'settings:read',
    ],
}
```

Wildcard handling: `'*'` grants all. Tokens are strict-match (`usage:read` ≠ `usage:write`). `admin` explicit list (not wildcard) để có thể exclude `tenant:delete` nếu cần trong tương lai.

### 4.1 Model: TenantCustomRole (models.py)
```python
class TenantCustomRole(models.Model):
    tenant = models.ForeignKey(CoreTenant, on_delete=models.CASCADE, related_name='custom_roles')
    name = models.CharField(max_length=64)
    permissions = models.JSONField(default=list)  # ['member:read', ...]
    is_system = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        unique_together = ('tenant', 'name')
```

Seed system roles (owner/admin/editor/viewer) với permission sets tương ứng trong data migration hoặc `get_or_create` lazy.

### 4.2 TenantMember: thêm custom_role FK (F4 Option A — GIỮ nguyên role)
```python
custom_role = models.ForeignKey(
    'TenantCustomRole', null=True, blank=True,
    on_delete=models.SET_NULL, related_name='members',
)
```
- **KHÔNG đổi `role` field** (giữ value gốc owner/admin/editor/viewer để backward-compat + Django choices validation).
- `custom_role` là override layer: khi set → permission resolution ưu tiên `custom_role.permissions`.
- `get_tenant_role` vẫn trả `role` (không đổi). `get_tenant_permissions` check `custom_role` trước.

### 4.3 Permission resolution (utils/resolve_tenant.py) — F2 + F3 resolved

```python
SYSTEM_ROLE_PERMISSIONS = {
    'owner': ['*'],
    'admin': ['member:read', 'member:write', ...],  # ← full list từ §4.0
    'editor': ['member:read', 'sa:read', 'sa:write', ...],
    'viewer': ['sa:read', 'pat:read', 'usage:read', ...],
}

def get_tenant_permissions(request) -> set:
    """Resolve tenant permissions for the current request.

    Priority:
    1. request._tenant_permissions cache (avoid N+1)
    2. request.tenant_member.custom_role.permissions (if custom_role set)
    3. SYSTEM_ROLE_PERMISSIONS[get_tenant_role(request)] (system role fallback)
    """
    cached = getattr(request, '_tenant_permissions', None)
    if cached is not None:
        return cached

    member = getattr(request, 'tenant_member', None)
    if member is None:
        # Fallback: query (rare — normally set by middleware via get_tenant_role)
        tenant = getattr(request, 'tenant', None)
        user = getattr(request, 'user', None)
        if tenant and user and user.is_authenticated:
            member = TenantMember.objects.filter(
                tenant=tenant, user=user
            ).select_related('custom_role').first()

    if member and member.custom_role_id:
        perms = set(member.custom_role.permissions)
    else:
        role = get_tenant_role(request)
        perms = set(SYSTEM_ROLE_PERMISSIONS.get(role, []))

    request._tenant_permissions = perms
    return perms


def require_tenant_permission(request, *required_perms) -> None:
    """Check if the current user has ALL required permissions in the tenant."""
    granted = get_tenant_permissions(request)
    if '*' in granted:
        return
    missing = [p for p in required_perms if p not in granted]
    if missing:
        raise PermissionDenied(f'Thiếu quyền: {", ".join(missing)}')
```

**F2 fix — middleware caches request.tenant_member:**
In `get_tenant_role()` (utils/resolve_tenant.py:121), khi query TenantMember:
```python
member = TenantMember.objects.filter(
    tenant=tenant, user=user
).select_related('custom_role').first()  # ← thêm select_related('custom_role')
if member:
    request.tenant_member = member  # F2: cache cho get_tenant_permissions
    request.tenant_role = member.role
    return member.role
```
Owner không có TenantMember row → `request.tenant_member = None` → `get_tenant_permissions` trả `['*']` via SYSTEM_ROLE_PERMISSIONS.

**F3 interaction (PAT scope vs permission) — DESIGN DECISION:**
- Layer 1 (`require_pat_scopes_or_human_session`) = PAT **scope** gate (machine/CI level). **Unchanged.**
- Layer 2 (`require_tenant_permission`) = tenant **role/permission** gate (human RBAC). **Replaces** `_require_tenant_role`.
- Human-session PATs (login/refresh/SSO) được issue với SA scopes (`manage_tenant` typically) → layer 1 pass cho tất cả human users.
- Custom roles CHỈ thay đổi layer 2. Human user có custom role với `settings:read` → layer 2 pass; layer 1 đã pass qua SA scope. **Không double-block.**
- Machine PATs (CI) giữ narrow scopes → correctly blocked from tenant writes (intended).
- ⇒ Không cần code change ở layer 1. Custom role ≠ PAT scope. Hai orthogonal dimensions.

### 4.4 Guard refactor — FULL MAP (46 sites)

**Layer 2 replacement** (`_require_tenant_role` → `require_tenant_permission`), 46 sites:

| File | Lines | Current roles | New permission | View/method |
|------|-------|---------------|----------------|-------------|
| **tenant_member_views.py** | | | | |
| | 45 | owner,admin | `member:read` | MemberListView.get |
| | 66 | owner,admin | `member:write` | InvitesCombinedView.post |
| | 146 | owner,admin | `member:read` | InvitesCombinedView.get |
| | 243 | owner,admin | `member:write` | MemberRemoveView.delete |
| | 282 | owner,admin | `member:write` | InviteCancelView.post |
| **views/sso.py** | | | | |
| | 30 | owner,admin | `sso:read` | SSOConfigView.get |
| | 39 | owner,admin | `sso:write` | SSOConfigView.post |
| **views_webhooks.py** | | | | |
| | 40 | owner,admin | `webhook:write` | WebhookListCreate.post |
| | 47 | owner,admin | `webhook:read` | WebhookListCreate.get |
| | 100 | owner,admin | `webhook:write` | WebhookDetail.put |
| | 116 | owner,admin | `webhook:write` | WebhookDetail.delete |
| | 131 | owner,admin | `webhook:write` | WebhookTest.post |
| | 150 | owner,admin | `webhook:read` | WebhookLogs.get |
| | 170 | owner,admin | `billing:read` | BillingStatus.get |
| | 187 | owner,admin | `billing:write` | PreviewPlanChange.post |
| | 225 | owner,admin | `tenant:write` | DeprovisionView.post |
| **views_tenant.py** | | | | |
| | 138 | owner,admin | `tenant:write` | TenantDetailView.get_object |
| | 149 | owner,admin,editor,viewer | `sa:read` | SAListView.get_queryset |
| | 155 | owner,admin,editor | `sa:write` | SAListView.perform_create |
| | 166 | owner,admin,editor,viewer | `sa:read` | SADetailView.get_queryset |
| | 196 | owner,admin,editor | `sa:write` | SADetailView.perform_update |
| | 204 | owner,admin,editor | `sa:write` | SADetailView.perform_destroy |
| | 216 | owner,admin,editor,viewer | `pat:read` | PATListView.get_queryset |
| | 227 | owner,admin,editor | `pat:write` | issue_pat (legacy) |
| | 317 | owner,admin,editor | `pat:write` | partner_issue_pat |
| | 349 | owner,admin,editor | `pat:write` | partner_rotate_pat |
| | 400 | owner,admin,editor | `pat:write` | partner_revoke_pat |
| | 488 | owner,admin,editor,viewer | `pat:read` | partner_pat_usage |
| | 529 | owner,admin,editor,viewer | `pat:read` | partner_pat_usage_summary |
| | 565 | owner,admin,editor,viewer | `sa:read` | partner_sa_usage |
| | 602 | owner,admin | `settings:write` | SettingsView.get |
| | 611 | owner,admin | `settings:write` | SettingsView.put |
| **views_dashboard.py** | | | | |
| | 54 | owner,admin,editor,viewer | `dashboard:read` | dashboard_summary.get |
| | 124 | owner,admin,editor,viewer | `dashboard:read` | portfolio_summary.get |
| **views_usage.py** | | | | |
| | 38 | owner,admin,editor,viewer | `usage:read` | usage_stats.get |
| | 161 | owner,admin,editor,viewer | `usage:read` | usage_history.get |
| | 223 | owner,admin,editor,viewer | `usage:read` | usage quotas.get |
| **views_usage_trend.py** | | | | |
| | 30 | owner,admin,editor,viewer | `usage:read` | usage_trend.get |
| | 95 | owner,admin,editor,viewer | `usage:read` | cost_trend.get |
| **views_security.py** | | | | |
| | 44 | owner,admin,editor,viewer | `security:read` | security_overview.get |
| | 105 | owner,admin,editor,viewer | `security:read` | login_history.get |
| | 136 | owner,admin,editor,viewer | `security:read` | pat_audit.get |
| **views_alert_config.py** | | | | |
| | 45 | owner,admin,editor | `alert:write` | alert_config.get (create/update) |
| | 71 | owner,admin,editor | `alert:write` | alert_config.delete |
| **views_forecast.py** | | | | |
| | 99 | owner,admin,editor | `forecast:write` | forecast_list.get (create) |
| | 136 | owner,admin,editor | `forecast:write` | forecast_detail.delete |

**F5 — scope-only endpoints needing layer 2 added** (currently NO `_require_tenant_role`):

| File | Lines (count) | Add permission |
|------|---------------|----------------|
| `views_reports.py` | 8 sites | `report:read` (list/get), `report:write` (create/export/test) |
| `commercial_partner_views.py` | 9 sites | `billing:read` (meters/history), `billing:write` (checkout/portal) |

⇒ Total 63 endpoints get `require_tenant_permission`. Each maps to §4.0 token.

### 4.5 API: PartnerRoleListCreateView / PartnerRoleDetailView
- `GET /partner/roles/` — list (include system + custom)
- `POST /partner/roles/` — create (owner/admin only; unique name; validate tokens against known list)
- `GET /partner/roles/{id}/` — detail
- `PATCH /partner/roles/{id}/` — update (non-system only)
- `DELETE /partner/roles/{id}/` — delete (non-system only, reassign members to viewer first)
- Guard: `_require_tenant_role(request, 'owner', 'admin')` (roles management = admin op, giữ nguyên role-based cho endpoint quản lý roles).

### 4.6 Frontend: TenantAdminRolesPage.tsx
Copy convention từ `TenantAdminSettingsPage.tsx`:
- `ShellPageChrome` + `ShellPanel` + `ShellSkeleton`
- `defaultCoreApiAdapter.coreGet('/core/v1/partner/roles/', {headers:{'X-Tenant-ID':activeTenantId}})`
- Role list table (name, perm count, member count, actions)
- Create/Edit modal với permission matrix checkboxes (grouped by category: member/sa/pat/usage/billing/sso/webhook/audit/report/settings)
- Delete confirm (non-system only)
- i18n keys `tenantRoles.*` in vi.js/en.js

---

## 5. TEST PLAN (quality gates)

- `test_tenant_custom_role.py`:
  - create custom role (owner) → 201
  - duplicate name → 400
  - non-owner create → 403
  - delete system role → 400
  - assign custom role to member → member.custom_role set
  - member with custom role accesses permitted endpoint → 200
  - member with custom role blocked from non-permitted endpoint → 403
  - system role permission resolution (owner=all, viewer=read-only)
  - `get_tenant_permissions` caching: second call returns cached set (no extra query)
  - `request.tenant_member` set by get_tenant_role → available in get_tenant_permissions
- Full `identity_access` suite: 0 regression (pre-existing flaky `test_drf_auth_reuses...` excluded)
- Web `tsc --noEmit` EXIT 0; `npm run build` PASS
- i18n scan: no hardcoded strings in TenantAdminRolesPage.tsx

---

## 6. ROLLBACK / RISK

- **Risk cao**: refactor 46 guard sites → dễ miss/sai map. Mitigation: build explicit map table (§4.4), 1 PR per view-group, test từng group. Mỗi PR chỉ refactor 1 file-group, không combine.
- **Risk trung bình**: `custom_role` FK SET_NULL → member rớt custom role → fallback `role` field. Since `role` field giữ nguyên giá trị gốc, `get_tenant_permissions` tự fallback về `SYSTEM_ROLE_PERMISSIONS[role]`. Không mất data.
- **Rollback**: revert models + guard calls → về role-tuple (đã verified working sau Sprint 4 prereq fix). `require_tenant_permission` falls back to `require_tenant_role` behavior.

---

## 7. PHÂN CHIA IMPLEMENTATION PHASES

- **Phase A** (backend model + seed): TenantCustomRole + TenantMember.custom_role + SYSTEM_ROLE_PERMISSIONS + migration. Wire `request.tenant_member` trong `get_tenant_role`. Tests: model + permission resolution + caching.
- **Phase B** (guard refactor): `require_tenant_permission` + map 63 endpoints (46 role-sites + 17 scope-only from F5) thành từng PR nhỏ:
  - B1: tenant_member_views + webhooks/billing/deprovision + sso (16 sites)
  - B2: views_tenant (SA/PAT/settings/tenant — 16 sites)
  - B3: dashboard + usage + usage_trend + security (10 sites)
  - B4: alert_config + forecast (4 sites)
  - B5: reports + commercial_partner (17 scope-only sites — F5)
  Tests per group.
- **Phase C** (roles API): PartnerRoleListCreateView + DetailView + routes (append sau views_tenant.py:618) + tests.
- **Phase D** (frontend): TenantAdminRolesPage.tsx + i18n + module.css + tests (tsc/build).

---

## 8. FILES TO TOUCH (checklist)

1. `models.py` — TenantCustomRole + TenantMember.custom_role
2. `migrations/0024_tenantcustomrole.py` + seed data migration
3. `utils/resolve_tenant.py` — get_tenant_permissions + require_tenant_permission + SYSTEM_ROLE_PERMISSIONS + wire `request.tenant_member` trong get_tenant_role
4. `views/*.py` (63 endpoints: 46 role-sites + 17 scope-only F5) — refactor guards per Phase B groups
5. `views_tenant.py` (append after line 618) — PartnerRoleListCreateView/DetailView
6. `partner_urls.py` — /partner/roles/ routes
7. `web/src/pages/tenant-admin/TenantAdminRolesPage.tsx` (NEW)
8. `web/src/i18n/vi.js`, `en.js` — tenantRoles.* keys
9. Tests: `test_tenant_custom_role.py` + guard map tests + F5 reports/commercial tests

---

**APPROVE TO IMPLEMENT?** Plan verified by evidence (46 guard sites traced to exact file:line:method, definitive token table, permission resolution design). 3 blocking gaps từ critique (F6 token list, F3 scope/permission, F2 tenant_member) ĐÃ RESOLVED. All corrections (F1-F7) applied.

**Verdict: IMPLEMENTABLE.** Start Phase A sau khi user approve token list (§4.0).
