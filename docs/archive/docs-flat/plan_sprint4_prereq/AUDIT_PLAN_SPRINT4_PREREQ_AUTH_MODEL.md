# AUDIT PLAN — Sprint 4 Prerequisite: PAT Auth Model phải mang role member thật

**Ngày:** 2026-07-18
**Phạm vi:** Fix auth layer để `request.tenant_role` phản ánh role thực của member (editor/viewer) thay vì luôn collapse về `owner`.
**Khung:** AGENTS.md AI Audit Framework (verify by evidence, no silent failures)
**Trạng thái:** PLAN (chưa implement)

---

## 0. TÓM TẮT 5 FINDINGS NGHIÊM TRỌNG NHẤT

1. 🔴 **AUTH-COLLAPSE**: `middleware.py:112` + `authentication.py:55` luôn authenticate PAT → `tenant.owner_user`. Mọi editor/viewer PAT thành owner. (Critical, verified.)
2. 🔴 **NO MEMBER BINDING**: `CorePATCredential` (models.py:236) link → `ServiceAccount` → `Tenant`, **không** link → `TenantMember`. Auth layer không có dữ liệu role người login.
3. 🟠 **LOGIN DROPS ROLE**: `login.py:134-139` biết user là member (lấy `member.tenant`) nhưng `login.py:147,156` issue PAT cho `tenant.service_accounts.first()` — mất thông tin member.
4. 🟠 **HEADER PATH DEAD**: `_resolve_by_header` (`middleware.py:165-167`) resolve `member.role` đúng NHƯNG chỉ khi `user` truyền vào là member thật. Vì `_get_user_from_pat` set user=owner → luôn vào branch owner (`middleware.py:161`). Frontend gửi `X-Tenant-ID` vô dụng với editor/viewer.
5. 🟡 **SPRINT 4 BLOCKED**: Mọi guard `_require_tenant_role` (views_tenant.py:227-565) declared đúng nhưng không thể reject viewer cho tới khi auth layer mang role thật.

---

## 1. BẢN ĐỒ KIẾN TRÚC (file | line | trách nhiệm)

| File | Line | Trách nhiệm | Note |
|---|---|---|---|
| `identity_access/models.py` | 236-355 | `CorePATCredential` model + `issue_for_service_account` | Thiếu FK `issued_for_member` |
| `identity_access/middleware.py` | 86-122 | `_get_user_from_pat` | Line 112 collapse → owner |
| `identity_access/middleware.py` | 124-169 | `_resolve_tenant` / `_resolve_by_header` | Line 161 owner-check; 165-167 member.role (dead path) |
| `identity_access/authentication.py` | 20-59 | `CorePATAuthentication.authenticate` | Line 55 collapse → owner |
| `identity_access/utils/resolve_tenant.py` | 80-114 | `get_tenant_role` | Line 102 owner-check fallback |
| `identity_access/views/login.py` | 132-163 | Issue human PAT lúc login | Line 134-139 biết member; 147,156 mất role |
| `identity_access/tests/test_tenant_role_matrix.py` | 91-107 | Record limitation (Sprint 1 Phase B) | Assert 200 (gap) → convert thành 403 sau fix |

---

## 2. LUỒNG DỮ LIỆU ĐÃ TRACE (use-case: viewer login → PUT /settings/)

1. `login.py:134` user là viewer-member → `tenant = member.tenant` ✅
2. `login.py:147` `service_account = tenant.service_accounts.filter(status='active').first()` — SA thuộc tenant, không gắn member
3. `login.py:156` `issue_for_service_account(service_account=..., is_human_session=True)` — PAT lưu `service_account_id`, `issued_for_member=NULL`
4. Frontend gửi `Authorization: Bearer <pat>` + `X-Tenant-ID: <tenant_id>` (`TenantAdminSettingsPage.tsx:59`)
5. `middleware.py:98` `resolve_from_raw_secret` → credential
6. `middleware.py:112` `owner = credential.service_account.tenant.owner_user` → **user = owner**
7. `middleware.py:131` `_resolve_by_header` → line 161 `tenant.owner_user_id == user.id` TRUE → `role = OWNER`
8. `views_tenant.py:592` `PartnerTenantSettingsView.put` → `_require_tenant_role(request, 'owner','admin')` → PASS (viewer truy cập được)
9. **Kết quả: viewer thực hiện được owner-only write. GAP.**

---

## 3. CONTRADICTIONS (plan/doc vs code)

| Plan/Spec | Thực tế (file:line) | Tác động |
|---|---|---|
| Sprint 1 Phase B Role Matrix (write=owner/admin/editor) | Guards declared đúng `views_tenant.py:227,317,349,400` NHƯNG auth layer luôn set role=owner (`middleware.py:112`) | Guard không thể reject viewer → spec "editor/viewer differentiation" chưa enforce được |
| `test_tenant_role_matrix.py:92` docstring "KNOWN GAP (Sprint 4 scope)" | Auth layer chưa fix → gap còn live | Test ghi 200 (không reject) — trung thực nhưng chưa đóng |

---

## 4. DESIGN FIX (đề xuất, backward-compatible)

### 4.1 Schema (migration mới, e.g. `0022_pat_issued_for_member`)
`models.py` `CorePATCredential` thêm:
```python
issued_for_member = models.ForeignKey(
    'TenantMember', null=True, blank=True, on_delete=models.CASCADE,
    related_name='pat_credentials', verbose_name='Issued for tenant member',
)
```
- `null=True`: machine PAT (CI/API) không gắn member → giữ behavior owner (legacy correct).
- `blank=True` cho admin shell.

### 4.2 `issue_for_service_account` (models.py:322)
Thêm param `issued_for_member=None`. Truyền từ login.
```python
def issue_for_service_account(cls, service_account, scopes, ..., is_human_session=False, issued_for_member=None):
    ...
    credential = cls.objects.create(..., issued_for_member=issued_for_member)
```

### 4.3 `login.py:147-163` — truyền member
```python
member = TenantMember.objects.filter(user=user, tenant=tenant).first()  # line 137 đã có
service_account = tenant.service_accounts.filter(status='active').first()
...
credential, raw = CorePATCredential.issue_for_service_account(
    service_account=service_account, scopes=..., is_human_session=True,
    issued_for_member=member,   # <-- NEW: chỉ khi user là member
)
```
Note: nếu `user == tenant.owner_user` → `member = None` → PAT owner-equivalent (legacy correct).

### 4.4 `_get_user_from_pat` (middleware.py:111-120)
```python
member = credential.issued_for_member
if member is not None:
    user = member.user
    request.tenant_role = member.role
else:
    user = credential.service_account.tenant.owner_user
    request.tenant_role = TenantMember.RoleChoices.OWNER
# is_human_session downgrade staff/superuser chỉ khi member is None
if not credential.is_human_session or member is None:
    user.is_staff = False; user.is_superuser = False
request.auth = credential
return user
```
- `request.tenant_role` set trực tiếp → `_resolve_tenant` bypass (line 92 `get_tenant_role` đọc `request.tenant_role` trước).
- Machine PAT (member=None) → owner (không đổi behavior).

### 4.5 `authentication.py:54-59` — đồng bộ
Tương tự: `user = credential.issued_for_member.user if credential.issued_for_member else owner`.

### 4.6 `_resolve_by_header` (middleware.py:151-169) — cleanup (optional)
Giờ `user` đã là member thật → line 165-167 resolve đúng. Không cần đổi, nhưng có thể bỏ owner-check shortcut nếu muốn uniform. **Không bắt buộc.**

---

## 5. TEST PLAN (quality gates)

### 5.1 Convert `test_tenant_role_matrix.py:91-107` → enforcement
Sau fix, viewer PAT phải trả **403** (không 200):
```python
def test_viewer_pat_rejected_from_owner_write(self):
    raw = self._human_pat(self.viewer_user)  # _human_pat phải set issued_for_member=viewer_user.member
    resp = self.client.put('/core/v1/partner/settings/', ...)
    self.assertEqual(resp.status_code, 403)  # WAS 200 (gap) -> NOW enforced
```
- `_human_pat` (test line 73-82) cần truyền `issued_for_member` tương ứng.

### 5.2 New unit tests
- `test_pat_issued_for_member_resolves_role`: PAT với `issued_for_member=editor` → `request.tenant_role == 'editor'`.
- `test_machine_pat_still_owner`: PAT `issued_for_member=None` → `request.tenant_role == 'owner'` (legacy CI behavior intact).
- `test_login_issues_member_bound_pat`: login viewer → decoded PAT có `issued_for_member` set (verify qua DB query sau login).

### 5.3 Integration (regression)
- Editor PAT POST `/core/v1/partner/pats/issue/` → 200/201 (đã có `test_editor_pat_can_issue_pat`).
- Viewer PAT PUT `/core/v1/partner/settings/` → 403 (new).
- Owner PAT invite → 201/400 (đã có).

---

## 6. QUALITY GATES (verify sau implement)

- [ ] `npm run lint` (web) — không đổi web
- [ ] Backend: `python manage.py test identity_access` — tất cả xanh
- [ ] Migration: `python manage.py makemigrations --check --dry-run` sạch (hoặc commit migration mới)
- [ ] tsc web EXIT 0 (không đổi FE)
- [ ] i18n scan: không có string mới hardcode
- [ ] `test_tenant_role_matrix.py` chuyển từ "record gap" → "enforce 403"

---

## 7. ROLLBACK / RISK

- **Risk thấp**: `issued_for_member=null` default → machine PAT + legacy owner PAT unaffected.
- **Risk**: Nếu login flow issue PAT trước khi migration chạy → `issued_for_member` column missing. Mitigation: chạy migration trước deploy.
- **Rollback**: revert middleware/authentication 2 files → về owner-collapse (gap cũ, đã known).

---

## 8. DEPENDENCY CHO SPRINT 4 (Custom RBAC)

Sau fix này:
- Auth layer mang `request.tenant_role` thật → `_require_tenant_role` tuples (views_tenant.py:227-565)生效.
- Sprint 4 có thể thêm dynamic role (custom roles, permission sets) vì base role đã correct.
- **KHÔNG** implement Custom RBAC trước khi fix này xong (guard sẽ vô hiệu).

---

## 9. FILES TO TOUCH (checklist implement)

1. `packages/core/backend/src/identity_access/models.py` — thêm FK `issued_for_member` (line ~273)
2. `packages/core/backend/src/identity_access/models.py` — `issue_for_service_account` param (line 322)
3. `packages/core/backend/src/identity_access/views/login.py` — truyền member (line 137, 156)
4. `packages/core/backend/src/identity_access/middleware.py` — `_get_user_from_pat` (line 111-120)
5. `packages/core/backend/src/identity_access/authentication.py` — `authenticate` (line 54-59)
6. `packages/core/backend/src/identity_access/migrations/0022_*.py` — new migration
7. `packages/core/backend/src/identity_access/tests/test_tenant_role_matrix.py` — convert + add tests

---

---

## 10. IMPLEMENTATION RESULT (2026-07-18)

**Status: DONE ✅** — implemented + tests green.

### Files changed
1. `models.py` — FK `issued_for_member` added (line ~256) + `issue_for_service_account(issued_for_member=...)` (line 322)
2. `migrations/0022_pat_issued_for_member.py` — generated
3. `views/login.py` — resolve `TenantMember` + pass to PAT issue (line 137, 156)
4. `middleware.py` — `_get_user_from_pat` carries `issued_for_member.role` (line 111-131); machine-PAT tenant-binding 403 `pat_tenant_mismatch` added in `__call__` (line 60-72)
5. `authentication.py` — `authenticate` mirrors member resolution (line 54-67)
6. `tests/test_tenant_role_matrix.py` — converted gap test → enforcement (viewer→403) + 2 unit tests (member role + machine owner collapse)

### Test results
- `test_tenant_role_matrix` (5 tests): OK
- `MachinePATTenantBindingIntegrationTests` (5 tests): OK
- Full `identity_access` suite: 141/142 pass; 1 pre-existing ERROR
  (`test_drf_auth_reuses_middleware_credential_avoids_double_query` — DB lock conflict
  under parallel full-suite run, unrelated to this change; fails identically on baseline).
- Web `tsc --noEmit`: EXIT 0

### Scope addition (vs original plan)
Plan §4.4 only covered role carry. Implementation ALSO added machine-PAT tenant-binding
enforcement because `test_machine_pat_cannot_access_tenant2_via_header` expected
`403 pat_tenant_mismatch` — a security control the middleware did not yet implement.
This is correct hardening (machine PATs must not switch tenants via header) and makes
the existing test suite consistent. Human session PATs remain allowed to switch tenants.

### Verification of critical finding closure
- Before: viewer PAT → `request.tenant_role == 'owner'` → owner-only write reachable (200)
- After: viewer PAT → `request.tenant_role == member.role` → owner-only write rejected (403)
- `_require_tenant_role` guards (views_tenant.py:227-565) now ENFORCE correctly.

---

## 11. INDEPENDENT CRITIQUE — P0/P1/P2 FIXES (2026-07-18)

Independent review found 2 P0 bugs, 2 P1 risks, 3 P2 issues the self-report missed.
ALL CONFIRMED by code evidence and FIXED.

### P0 Bug 1 — refresh_token_view dropped issued_for_member (role escalation)
- `views/login.py:205-214` (old): `user = tenant.owner_user`; issue call missing
  `issued_for_member`. A viewer who refreshes reverted to owner. FIXED:
  `member = credential.issued_for_member; user = member.user if member else owner;
  issued_for_member=member` (login.py:205-214).

### P0 Bug 2 — SSO login dropped issued_for_member
- `views/sso.py:152-177` (old): `member` created but not passed; `is_human_session`
  set post-create. SSO users always owner-equivalent. FIXED: pass
  `issued_for_member=member` + `is_human_session=True` inline (sso.py:171-178).

### P1 Risk 1 — on_delete=CASCADE destroys audit trail
- `models.py:260`: changed to `on_delete=models.SET_NULL` (field already null=True).
  Migration 0023 generated. Member removal now nulls PAT.issued_for_member, keeps PAT.

### P1 Risk 2 — N+1 query on PAT auth
- `models.py:320`: `resolve_from_raw_secret` now `select_related('service_account__tenant',
  'issued_for_member')`. Removes per-request extra query for the FK.

### P2 Issue 1 — stale test docstring
- `test_tenant_role_matrix.py` header rewritten: no longer claims "cannot reject a viewer".

### P2 Issue 2 — duplicated is_staff/is_superuser mutation
- Extracted `apply_pat_user_privileges(user, credential)` in
  `utils/resolve_tenant.py`; used by both middleware.py and authentication.py.

### P2 Issue 3 — get_tenant_role staff fallback escalation
- `utils/resolve_tenant.py:106-107`: member lookup now runs BEFORE the `is_staff → admin`
  shortcut, so a viewer/staff member is not silently escalated to admin on exempt paths.

### Added tests
- `test_refresh_preserves_member_role` (P0 Bug 1): refresh keeps issued_for_member,
  refreshed PAT still rejected from owner writes (403).
- `test_sso_style_issue_keeps_member_role` (P0 Bug 2 guard): human PAT for member keeps
  issued_for_member + is_human_session, resolves viewer role.

### Final test status
- `test_tenant_role_matrix`: 7/7 OK
- `MachinePATTenantBindingIntegrationTests`: 5/5 OK
- Full `identity_access`: 143/144 pass, 1 pre-existing ERROR
  (`test_drf_auth_reuses_middleware_credential_avoids_double_query` = DB lock / MagicMock
  under full-suite run; fails identically on baseline, unrelated to this change).
- Web `tsc --noEmit`: EXIT 0
- Verdict: Sprint 4 prerequisite now COMPLETE. Safe to start Sprint 4 (Custom RBAC).


