# TRACEABILITY MATRIX — SaaS Tenant Management Upgrade

**Ngày**: 2026-05-12
**Workstream ID**: TENANT-UPGRADE
**Version**: 1.0

---

## 1. Requirement → Gap → Task → Evidence

| Req ID | Requirement | Gap ID | Gap Description | Task | File(s) Changed | Evidence Reference |
|---|---|---|---|---|---|---|
| REQ-01 | Một SSOT duy nhất cho CoreTenant model | G1 | Duplicate `class CoreTenant` tại `backend/portfolio/models.py` | TENANT-T01 | `backend/portfolio/models.py` | T01-evidence.md: grep 0 results |
| REQ-02 | PAT auth không dùng raw SQL | G1 | `backend/core_pat_auth.py` dùng raw SQL string | TENANT-T02 | `backend/core_pat_auth.py` | T02-evidence.md: grep 0 results |
| REQ-03 | Per-request tenant status enforcement | G2 | Entitlement chỉ check lúc login, không check per-request | TENANT-T03 | `identity_access/permissions.py`, `settings.py` | T03-evidence.md: 403 test screenshots |
| REQ-04 | API quota enforcement per tenant | G3 | `api_calls_limit=-1` không enforce | TENANT-T04 | `identity_access/middleware.py`, `settings.py` | T04-evidence.md: 429 test |
| REQ-05 | Quota counter flush to DB | G3 | Không có flush mechanism | TENANT-T05 | `commercial/tasks.py` | T05-evidence.md: task test output |
| REQ-06 | Monthly invoice generation | G3 | Invoice model stub, không generate | TENANT-T05 | `commercial/tasks.py` | T05-evidence.md: invoice count assertion |
| REQ-07 | Overdue invoice → tenant suspend | G3 | Không có overdue check | TENANT-T05 | `commercial/tasks.py` | T05-evidence.md: suspend assertion |
| REQ-08 | Trial expiry automation | G4 | Không có lifecycle automation | TENANT-T06 | `tenant_lifecycle/tasks.py` | T06-evidence.md: auto_expire test |
| REQ-09 | Quota overflow → auto suspend | G4 | Không có | TENANT-T06 | `tenant_lifecycle/tasks.py` | T06-evidence.md: quota suspend test |
| REQ-10 | Trial expiry warning email | G4 | Không có | TENANT-T06 | `tenant_lifecycle/tasks.py` | T06-evidence.md: email enqueue test |
| REQ-11 | Deprovisioning automation sau 30 ngày | G4 | Không có | TENANT-T06 | `tenant_lifecycle/tasks.py` | T06-evidence.md: deprovision test |
| REQ-12 | Operator suspend tenant | G5 | Operator API chỉ GET | TENANT-T07 | `views_admin_runtime.py`, `urls.py` | T07-evidence.md: 200 suspend |
| REQ-13 | Operator activate tenant | G5 | Không có write endpoint | TENANT-T07 | `views_admin_runtime.py` | T07-evidence.md: 200 activate |
| REQ-14 | Operator change plan | G5 | Không có write endpoint | TENANT-T07 | `views_admin_runtime.py` | T07-evidence.md: 200 change-plan |
| REQ-15 | Operator provision new tenant | G5 | Không có provision endpoint | TENANT-T07 | `views_admin_runtime.py` | T07-evidence.md: 201 provision |
| REQ-16 | Self-service tenant onboarding | G6 | Không có onboarding endpoint | TENANT-T08 | `identity_access/onboarding_views.py` | T08-evidence.md: 201 register |
| REQ-17 | Trial activated on register | G6 | Không có trial activation | TENANT-T08 | `identity_access/onboarding_views.py` | T08-evidence.md: trial_ends_at assertion |
| REQ-18 | Multi-member tenant support | G7 | `owner_user` OneToOneField, không có TenantMember | TENANT-T09 | `identity_access/models.py`, migrations | T09-evidence.md: member CRUD |
| REQ-19 | Invite flow với token | G7 | Không có invite mechanism | TENANT-T09 | `identity_access/models.py` | T09-evidence.md: invite accept flow |
| REQ-20 | Tenant FK trên critical user data | G8 | Models critical không có tenant scope | TENANT-T10 | Multiple models | T10-evidence.md: 0 orphans |
| REQ-21 | Immutable audit trail cho lifecycle events | G9 | Không có audit trail | TENANT-T06, T11 | `tenant_lifecycle/models.py`, `signals.py` | T11-evidence.md: event log |
| REQ-22 | Operator xem lifecycle history | G9 | Không có history endpoint | TENANT-T11 | `views_admin_runtime.py` | T11-evidence.md: paginated history |

---

## 2. Architecture Decision → Task Mapping

| Decision ID | Decision | Rationale | Enforced By |
|---|---|---|---|
| AD-01 | Redis INCR cho quota counting | Atomic, <1ms, không block request path | TENANT-T04 middleware |
| AD-02 | `IsTenantActive` chỉ bypass `is_superuser`, không bypass `is_staff` | Security — staff thường không nên bypass quota/status | TENANT-T03 test case 4 |
| AD-03 | `TenantLifecycleEvent` là append-only (không update, không delete) | Immutable audit trail | Model `Meta` — không có `update_fields` trên event |
| AD-04 | `tenant_lifecycle` là Django app riêng, không inline vào `identity_access` | Separation of concerns; app có thể disable nếu cần | T06 app structure |
| AD-05 | `packages/core` code không import từ `backend.portfolio` hoặc `backend.*` | Tránh circular dependency | Code review gate |
| AD-06 | Invite token = `secrets.token_urlsafe(48)` | Entropy đủ cao, URL-safe | TENANT-T09 model |
| AD-07 | Beat schedule flush quota mỗi 60s, không mỗi request | Performance | T05 beat schedule |
| AD-08 | Pre-save signal capture `_original_status` | Không thể dùng `post_save` với queryset.update() cho history | T06 signals.py |
| AD-09 | Migration additive — không drop column, không rename | Backward compatible, zero-downtime | T09, T10 migrations |
| AD-10 | `TenantMember` là bảng riêng; `owner_user` OneToOneField trên CoreTenant không đổi | Backward compat — không break existing foreign keys | T09 model spec |

---

## 3. Security Requirement → Implementation Mapping

| Security Req | Standard | Implementation | Validation |
|---|---|---|---|
| Không raw SQL | OWASP A03 | T02: ORM thay raw SQL trong core_pat_auth.py | `grep "cursor.execute" core_pat_auth.py` → 0 |
| Invite token entropy | OWASP A07 | T09: `secrets.token_urlsafe(48)` | Code review |
| Invite expiry check | OWASP A07 | T09: check `expires_at` + `status` trước accept | Test case 4 |
| Operator action audit | OWASP A09 | T07+T11: log `actor_user`, `ip_address` vào lifecycle event | T11 test case 1 |
| Quota warning dedup | Anti-spam | T05: Redis key `quota:warning_sent:{tid}:{date}:{%}` | T05 test case 4 |
| HMAC PAT | OWASP A02 | Đã có — giữ nguyên `_hash_pat_secret()` hiện tại | T02 regression |
| 429 response body | OWASP A05 | T04: body có `error`, `detail`, `limit`, `used` — không leak internal stack | T04 test case |

---

## 4. Test Coverage Map

| Task | Unit Tests | Integration Tests | Smoke Tests |
|---|---|---|---|
| T01 | `grep` assertions | `manage.py test portfolio.tests` | `manage.py check` |
| T02 | `grep` assertions | PAT issue+use | `manage.py check` |
| T03 | `IsTenantActiveTest` (5 cases) | Permission middleware chain | Manual 403 verify |
| T04 | `QuotaMiddlewareTest` (7 cases) | Redis integration | Benchmark overhead |
| T05 | `CommercialTasksTest` (5 cases) | Invoice generation | Beat schedule |
| T06 | `TenantLifecycleTest` (7 cases) | Signal chain | Task enqueue |
| T07 | `OperatorWriteAPITest` (6 cases) | End-to-end suspend/activate | Admin UI verify |
| T08 | `OnboardingTest` (5 cases) | Trial lifecycle | Trial expiry check |
| T09 | `TenantMemberTest` (7 cases) | Invite accept flow | Member CRUD |
| T10 | `DataIsolationTest` (3 cases) | Backfill check | 0 orphans |
| T11 | `AuditTrailTest` (3 cases) | Paginated history API | Event log verify |

---

## 5. Commit Mapping

| Commit | Task | PR Branch |
|---|---|---|
| `TENANT-T01: remove duplicate CoreTenant from portfolio/models.py` | T01 | `tenant/T01-ssot-coretenant` |
| `TENANT-T02: replace raw SQL in core_pat_auth.py with ORM` | T02 | `tenant/T02-pat-auth-orm` |
| `TENANT-T03: add IsTenantActive permission class` | T03 | `tenant/T03-tenant-active-perm` |
| `TENANT-T04: add TenantQuotaMiddleware with Redis metering` | T04 | `tenant/T04-quota-middleware` |
| `TENANT-T05: add commercial/tasks.py - quota flush and invoicing` | T05 | `tenant/T05-commercial-tasks` |
| `TENANT-T06: create tenant_lifecycle Django app` | T06 | `tenant/T06-tenant-lifecycle-app` |
| `TENANT-T07: add operator write API endpoints` | T07 | `tenant/T07-operator-write-api` |
| `TENANT-T08: add self-service onboarding endpoint` | T08 | `tenant/T08-onboarding` |
| `TENANT-T09: add TenantMember and TenantInvite models + CRUD API` | T09 | `tenant/T09-member-invite` |
| `TENANT-T10: data isolation audit + tenant FK migration top 3 models` | T10 | `tenant/T10-data-isolation` |
| `TENANT-T11: complete audit trail + operator lifecycle-events endpoint` | T11 | `tenant/T11-audit-trail` |
