# TASKBOARD — SaaS Tenant Management Upgrade

**Ngày**: 2026-05-12
**Workstream ID**: TENANT-UPGRADE
**Version**: 1.0

> **Legend**: 🔴 P0 — Blocking | 🟠 P1 — High | 🟡 P2 — Medium | 🟢 P3 — Low
> **Status**: `not-started` | `in-progress` | `code-review` | `testing` | `done` | `blocked`

---

## Sprint 1 — SSOT & Per-Request Guard (Week 1)

| Task ID | Title | Priority | Status | Owner | Branch | Notes |
|---|---|---|---|---|---|---|
| TENANT-T01 | Hợp nhất SSOT CoreTenant | 🔴 P0 | done | AI agent | `tenant/T01-ssot-coretenant` | Xoá class duplicate trong portfolio/models.py; runtime đã boot qua SaaS `identity_access` |
| TENANT-T02 | Refactor core_pat_auth.py xoá raw SQL | 🔴 P0 | not-started | — | `tenant/T02-pat-auth-orm` | Blocker cho T03+ |
| TENANT-T03 | IsTenantActive permission class | 🔴 P0 | done | AI agent | `tenant/T03-tenant-active-perm` | Applied to identity_access tenant surfaces + REST defaults |

---

## Sprint 2 — Commercial Enforcement (Week 2)

| Task ID | Title | Priority | Status | Owner | Branch | Notes |
|---|---|---|---|---|---|---|
| TENANT-T04 | TenantQuotaMiddleware + Redis metering | 🟠 P1 | done | AI agent | `tenant/T04-quota-middleware` | Redis metering wired into core settings; 9-test suite passed; benchmark 0.0159 ms/request |
| TENANT-T05 | Celery tasks — billing + quota flush | 🟠 P1 | done | AI agent | `tenant/T05-commercial-tasks` | Added quota flush, monthly invoicing, overdue suspension, and commercial beat routing; 5-test suite passed |

---

## Sprint 3 — Lifecycle & Operator API (Week 2–3)

| Task ID | Title | Priority | Status | Owner | Branch | Notes |
|---|---|---|---|---|---|---|
| TENANT-T06 | Django app tenant_lifecycle | 🟠 P1 | done | AI agent | `tenant/T06-tenant-lifecycle-app` | App + migration + signals/tasks + schedule wiring complete; focused tests passed |
| TENANT-T07 | Operator write API | 🟠 P1 | done | AI agent | `tenant/T07-operator-write-api` | Write endpoints + route wiring + focused regression pass (13/13) |

---

## Sprint 4 — Onboarding & Multi-Member (Week 3)

| Task ID | Title | Priority | Status | Owner | Branch | Notes |
|---|---|---|---|---|---|---|
| TENANT-T08 | Self-service onboarding endpoint | 🟡 P2 | not-started | — | `tenant/T08-onboarding` | Depends on T06 |
| TENANT-T09 | TenantMember + TenantInvite | 🟡 P2 | not-started | — | `tenant/T09-member-invite` | Parallel với T08 |

---

## Sprint 5 — Data Isolation & Audit (Week 4)

| Task ID | Title | Priority | Status | Owner | Branch | Notes |
|---|---|---|---|---|---|---|
| TENANT-T10 | Data isolation audit + FK migration top 3 | 🟡 P2 | not-started | — | `tenant/T10-data-isolation` | Depends on T09 |
| TENANT-T11 | TenantLifecycleEvent audit trail hoàn thiện | 🟢 P3 | not-started | — | `tenant/T11-audit-trail` | Depends on T10 |

---

## Overall Progress

| Sprint | Tasks | Done | In Progress | Remaining |
|---|---|---|---|---|
| Sprint 1 | T01–T03 | 2 | 0 | 1 |
| Sprint 2 | T04–T05 | 2 | 0 | 0 |
| Sprint 3 | T06–T07 | 2 | 0 | 0 |
| Sprint 4 | T08–T09 | 0 | 0 | 2 |
| Sprint 5 | T10–T11 | 0 | 0 | 2 |
| **TOTAL** | **11** | **6** | **0** | **5** |

---

## DoD Checklist (copy vào mỗi PR)

```
- [ ] Code viết xong, không có syntax error
- [ ] python manage.py check PASS
- [ ] python manage.py test <app>.tests --keepdb PASS
- [ ] Test cases bắt buộc trong IMPLEMENTATION_PLAN đều PASS
- [ ] docs/CODE_CHANGE_AUDIT_LEDGER.md cập nhật
- [ ] PROGRESS_DASHBOARD.md cập nhật
- [ ] module_tree_full.md regenerated (nếu có new app/model)
- [ ] Commit message format: "TENANT-T0X: <description>"
- [ ] Push to origin/dev
```

---

## Blockers Log

| Date | Task | Blocker | Status |
|---|---|---|---|
| — | — | — | — |

---

## Change Log

| Date | Change | Author |
|---|---|---|
| 2026-05-12 | Initial taskboard created | AI agent |
| 2026-05-12 | Mark TENANT-T07 done after focused + adjacent regression pass | AI agent |
