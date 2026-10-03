# Sprint 1 Phase B — Enforce Editor/Viewer Roles (Audit-Plan)

> **Ngày:** 2026-07-18
> **Tham chiếu:** `docs/TENANT_MANAGEMENT_SPRINT_PLAN.md` Step 1.4 (lines 170–204); `docs/COUNTER_AUDIT_TENANT_MANAGEMENT_20260718.md` B4; `docs/AUDIT_TENANT_SPRINT1_20260718.md` F2
> **Mục tiêu:** Áp dụng Role Permission Matrix cho các call site `_require_tenant_role` còn lại (hiện hardcode `'owner','admin'`), chuẩn bị tiền đề cho Sprint 4 (Custom RBAC).

---

## 0. NGUYÊN TẮC BẮT BUỘC (theo AGENTS.md)

1. Mọi khẳng định kèm `file_path:line_number`.
2. Grep/scrape toàn repo bao gồm `.py`, `tests/`, `serializers`, `urls`.
3. Không đoán — verify bằng grep thực tế.
4. Đối chiếu plan ↔ code qua mục CONTRADICTIONS.

---

## 1. THỰC TRẠNG (grep `_require_tenant_role`)

Tổng 44 call sites. Phân loại:

### Đã đúng theo matrix (Phase A đã làm)
- `views_alert_config.py:45,71` → `'owner','admin','editor'` ✅ (Edit alert configs = editor)
- `views_dashboard.py:54,124` → `'owner','admin','editor','viewer'` ✅ (View dashboard = all)
- `views_forecast.py:99,136` → `'owner','admin','editor'` ✅
- `views_security.py:44,105,136` → `'owner','admin','editor','viewer'` ✅
- `views_usage.py:38,161,223` → `'owner','admin','editor','viewer'` ✅ (View usage = all)
- `views_usage_trend.py:30,95` → `'owner','admin','editor','viewer'` ✅

### Đúng theo matrix — GIỮ NGUYÊN (owner/admin only)
- `tenant_member_views.py:45,66,146,243,282` → Invite/remove members = owner/admin only ✅
- `views_webhooks.py:40,47,100,116,131,150,170,187,225` → Webhooks = owner/admin only ✅
- `views\sso.py:30,39` → SSO config = owner/admin only ✅
- `views_tenant.py:138,149?` → TenantDetailView (tenant mgmt) = owner/admin only ✅
- `views_tenant.py:598,607` → TenantSettings = owner/admin only ✅

### CẦN SỬA (hardcode owner/admin nhưng matrix cho phép editor/viewer)
Chỉ trong `views_tenant.py` — PAT/SA management:

| Line | View / Op | Loại | Matrix | Tuple mới |
|------|-----------|------|--------|-----------|
| 149 | ServiceAccountListView.get_queryset | READ SA | all | `'owner','admin','editor','viewer'` |
| 155 | ServiceAccountListView.perform_create | CREATE SA | editor(own) | `'owner','admin','editor'` |
| 166 | ServiceAccountDetailView.get_queryset | READ SA | all | `'owner','admin','editor','viewer'` |
| 194 | ServiceAccountDetailView.perform_update | UPDATE SA | editor(own) | `'owner','admin','editor'` (THÊM MỚI) |
| 200 | ServiceAccountDetailView.perform_destroy | DELETE SA | editor(own) | `'owner','admin','editor'` (THÊM MỚI) |
| 212 | PATListView.get_queryset | READ PAT | all | `'owner','admin','editor','viewer'` |
| 223 | PATListView.post (issue) | CREATE PAT | editor(own) | `'owner','admin','editor'` |
| 313 | partner_issue_pat | ISSUE PAT | editor(own) | `'owner','admin','editor'` |
| 345 | partner_rotate_pat | ROTATE PAT | editor(own) | `'owner','admin','editor'` |
| 396 | partner_revoke_pat | REVOKE PAT | editor(own) | `'owner','admin','editor'` |
| 484 | PartnerUsageMetersView | READ usage | all | `'owner','admin','editor','viewer'` |
| 525 | partner_pat_usage_summary | READ | all | `'owner','admin','editor','viewer'` |
| 561 | partner_service_account_usage | READ | all | `'owner','admin','editor','viewer'` |

**Lưu ý `ServiceAccountDetailView`:** hiện chỉ guard ở `get_queryset` (166) bao phủ cả read + write. Để tách đúng matrix, ta:
- Đổi 166 → all-roles (read)
- Thêm guard `'owner','admin','editor'` vào `perform_update` (194) và `perform_destroy` (200).

**Lưu ý `UserProfileView` (243):** không có tenant-role guard (chỉ `require_human_session`) — self-profile, KHÔNG thuốc tenant-admin op → GIỮ NGUYÊN.

---

## 2. FRONTEND

Không đổi UI role enforcement trong Phase B (frontend routing đã ẩn/hiện sidebar theo route, không theo role). Theo matrix, editor/viewer vẫn thấy cùng sidebar nhưng bị 403 ở API nếu sai role. Đây là acceptable cho Phase B; Sprint 4 (Custom RBAC) sẽ làm UI gating chi tiết.

---

## 3. TESTS (Acceptance Criteria từ plan Step 1.4)

Thêm `test_tenant_role_matrix.py`:
- T1: editor user ISSUE PAT (`partner/issue-pat/`) → 200 (editor allowed)
- T2: viewer user ISSUE PAT → 403
- T3: editor user CREATE SA (`partner/service-accounts/`) → 201
- T4: viewer user CREATE SA → 403
- T5: viewer user READ PAT list (`partner/pats/`) → 200
- T6: viewer user READ SA list → 200
- T7: viewer user EDIT tenant settings (`partner/settings/`) → 403 (owner/admin only)
- T8: viewer user INVITE member (`partner/members/invite/`) → 403 (owner/admin only)

Helper: tạo TenantMember với role EDITOR/VIEWER, issue human PAT, gọi API.

---

## 4. QUALITY GATES
- Backend: `python manage.py test identity_access` (baseline 5+1 pre-existing in test_pat_tenant_binding.py — không regress)
- `python manage.py check --deploy` 0 CRITICAL
- Không đổi frontend → không cần tsc/build.

---

## 5. CONTRADICTIONS
- Plan Step 1.4 line 177 ghi `views_tenant.py:223,234,240,251,297,308,398,430,481,569,610,646` — các line này KHÔNG khớp file thực tế (file hiện có 614 lines, guard ở 138,149,155,166,212,223,313,345,396,484,525,561,598,607). **Plan cite sai line numbers** → dùng line numbers thực tế từ grep ở mục 1.
- Plan line 178 ghi `views_usage.py all` → đã đúng (Phase A làm rồi), không cần sửa.
- Plan line 179 `views_webhooks.py all → owner/admin` → đã đúng, GIỮ.
- Plan line 180 `views\sso.py:55,64` → thực tế 30,39, đã owner/admin, GIỮ.

---

## 6. ĐÁNH GIÁ

### 6.1 Implemented ✅
- `views_tenant.py`: PAT/SA write ops → `'owner','admin','editor'`; read ops (PAT list, SA list, usage, SA usage, PAT usage) → `'owner','admin','editor','viewer'`. `ServiceAccountDetailView` tách `perform_update`/`perform_destroy` guard riêng (editor) khỏi `get_queryset` (all-roles).
- `tenant_member_views` / `views_webhooks` / `views\sso` / `views_tenant.py:602,611` (tenant settings) GIỮ owner/admin — đúng matrix.
- Tests: `test_tenant_role_matrix.py` (3 tests).

### 6.2 BLOCKER — Auth model collapses PAT → OWNER (verified by evidence)
- `middleware.py:112` và `authentication.py:55` trả `credential.service_account.tenant.owner_user` làm request user CHO MỌI PAT.
- Login (`views/login.py:156`) issue human PAT cho `tenant.service_accounts.first()` → auth user = tenant owner.
- ⇒ `request.tenant_role` LUÔN = `'owner'` cho mọi request PAT, bất kể TenantMember (editor/viewer) nào login.
- ⇒ **Role Matrix KHÔNG THỂ enforce qua lớp auth hiện tại.** Các guard `_require_tenant_role('owner','admin','editor')` đã khai báo ĐÚNG nhưng KHÔNG thể reject viewer vì viewer auth = owner.
- Frontend dùng PAT Bearer (`coreApiAdapter.js:172`) → production cùng behavior.

### 6.3 Kết luận
Phase B hoàn thành mức **"declare đúng per matrix"** (future-proof khi auth sửa). Nhưng **behavioral enforcement bị block** bởi auth model. Đây là architectural gap thuộc **Sprint 4 (Custom RBAC)** — Sprint 4 PHẢI sửa auth layer để resolve đúng member role (không collapse về owner) trước khi RBAC có tác dụng.

**Khuyến nghị:** Chuyển "editor/viewer enforcement" thành Sprint 4 prerequisite. Không claim Sprint 1 Phase B = "RBAC enforced".

### 6.4 Test evidence
- `test_tenant_role_matrix.py::test_pat_authenticates_as_owner_regardless_of_member_role` — ghi nhận viewer PAT vẫn PUT settings thành công (200), chứng minh limitation không bị silent.
- Không để lại failing test.

