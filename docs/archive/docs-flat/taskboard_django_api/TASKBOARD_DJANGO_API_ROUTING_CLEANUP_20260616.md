# Taskboard: Django API Routing Cleanup — `/core/v1/` Standardization

**Program:** DJANGO_API_ROUTING_CLEANUP  
**Date Stamp:** 20260616  
**Version:** 1.0  

---

## 1. Task Board Overview

| Phase | Task Count | Est. Effort | Status |
|-------|------------|-------------|--------|
| Phase 0: Immediate Cleanup | 6 | 4-6 hrs | 🔴 Not Started |
| Phase 1: Identity & Workspace | 8 | 16-24 hrs | 🔴 Blocked (Frontend) |
| Phase 2: Market Data & Signals | 6 | 8-12 hrs | 🔴 Not Started |
| Phase 3: Final Verification | 6 | 4-6 hrs | 🔴 Not Started |
| **Total** | **26** | **32-48 hrs** | |

---

## 2. Phase 0 — Immediate Cleanup (No Frontend Dependency)

| Task ID | Title | Owner | Status | Dependencies | Gate Condition | Notes |
|---------|-------|-------|--------|--------------|----------------|-------|
| T-001 | Delete `identity_access/api_urls.py` | Backend | 🔴 TODO | None | File gone, no imports | Zero unique logic |
| T-002 | Delete `signal_intelligence/api_urls.py` | Backend | 🔴 TODO | None | File gone, no imports | Exact duplicate |
| T-003 | Remove 4 duplicate mounts from `vninvest_core/urls.py` | Backend | 🔴 TODO | T-001, T-002 | Lines removed: signal_intelligence_api, identity_access_api, market_data_api (2nd), support_api | 4 `path()` calls |
| T-004 | Merge missing routes into `identity_access/urls.py` | Backend | 🔴 TODO | T-001 | All api_urls routes present + singular mail-config | Auth register, verify-email, password-reset, dnse-credential, tenant-members |
| T-005 | Fix baseline test bugs (Chủ đề 4) | Backend | 🔴 TODO | None | Mock patches corrected in 2 test files | `test_password_reset.py`, `test_email_tasks.py` |
| T-006 | Phase 0 Verification | QA | 🔴 TODO | T-001 to T-005 | Test suites pass + smoke tests 1-4 | Run `python manage.py test identity_access signal_intelligence` |

---

## 3. Phase 1 — Identity & Workspace (Requires Frontend Migration)

| Task ID | Title | Owner | Status | Dependencies | Gate Condition | Notes |
|---------|-------|-------|--------|--------------|----------------|-------|
| T-101 | Frontend: Update `REACT_APP_CORE_API_BASE_URL=/core/v1` | Frontend | 🔴 BLOCKED | Phase 0 Gate | Env var changed, coreApiAdapter updated | `.env.*`, `src/config/api.ts` |
| T-102 | Frontend: Migrate `/api/portfolio/*` → `/core/v1/workspace/*` | Frontend | 🔴 BLOCKED | T-101 | Grep: zero `/api/portfolio/` in src | ~15-20 call sites |
| T-103 | Frontend: Migrate `/api/auth/*` → `/core/v1/auth/*` | Frontend | 🔴 BLOCKED | T-101 | Grep: zero `/api/auth/` in src | ~8-10 call sites |
| T-104 | Frontend: Migrate `/api/core/v1/partner/*` → `/core/v1/partner/*` | Frontend | 🔴 BLOCKED | T-101 | Grep: zero `/api/core/v1/partner/` in src | ~5-8 call sites |
| T-105 | Remove `user_workspace` mount from `/api/` | Backend | 🔴 BLOCKED | T-101 to T-104, Phase 0 Gate | Mount line removed from `vninvest_core/urls.py` | Namespace `user_workspace_api` |
| T-106 | Remove legacy stubs from `user_workspace/urls.py` | Backend | 🔴 BLOCKED | T-105 | Lines 63-78 removed (LegacyWatchlist*, PortfolioUserConfigView, GenericEmpty*) | ~16 routes |
| T-107 | Remove `portfolio/*` duplicate routes from `user_workspace/urls.py` | Backend | 🔴 BLOCKED | T-105 | Only `workspace/*` routes remain | ~20 routes |
| T-108 | Phase 1 Verification | QA | 🔴 BLOCKED | T-101 to T-107 | Full test suite + frontend E2E + smoke tests 1-7 | Frontend build must pass |

---

## 4. Phase 2 — Market Data & Signals

| Task ID | Title | Owner | Status | Dependencies | Gate Condition | Notes |
|---------|-------|-------|--------|--------------|----------------|-------|
| T-201 | Add `realtime/symbol-investigation` to `market_serving/urls.py` | Backend | 🔴 TODO | Phase 1 Gate | Route registered with `RealtimeSymbolInvestigationView` | From `native_views.py` |
| T-202 | Delete `market_serving/api_urls.py` | Backend | 🔴 TODO | T-201 | File gone, no imports | Contains legacy bridge views |
| T-203 | Remove `market_serving` mount from `/api/` | Backend | 🔴 TODO | T-202 | Mount line removed from `vninvest_core/urls.py` | Namespace `market_serving_api` |
| T-204 | Decision: `market_data.public_urls` keep/remove | Product + Backend | 🔴 TODO | Phase 1 Gate | Product sign-off documented | If remove → T-205 |
| T-205 | Remove `market_data` duplicate mount (`market_data_api`) | Backend | 🔴 TODO | T-204 | 2nd `market_data.urls` mount removed | Keep 1st mount (`market_data_public`) if decision=keep |
| T-206 | Phase 2 Verification | QA | 🔴 TODO | T-201 to T-205 | Test suites pass + smoke tests | `market_serving`, `market_data` |

---

## 5. Phase 3 — Final Verification

| Task ID | Title | Owner | Status | Dependencies | Gate Condition | Notes |
|---------|-------|-------|--------|--------------|----------------|-------|
| T-301 | Run full backend test suite | QA | 🔴 TODO | Phase 2 Gate | `python manage.py test` → 0 failures | All apps |
| T-302 | Run frontend test suite | QA | 🔴 TODO | Phase 2 Gate | `npm test` → 0 failures | All packages |
| T-303 | Smoke test 7 endpoints | QA | 🔴 TODO | Phase 2 Gate | All 7 return 200 | See Verification Plan |
| T-304 | Swagger UI accessibility | QA | 🔴 TODO | Phase 2 Gate | `/core/v1/schema/swagger-ui/` loads | Screenshot evidence |
| T-305 | Zero 404 audit on `/core/v1/` | QA | 🔴 TODO | Phase 2 Gate | Crawl all routes → no 404 | Automated script |
| T-306 | Update governance artifacts | Backend | 🔴 TODO | T-301 to T-305 | CODE_CHANGE_AUDIT_LEDGER.md, PROGRESS_DASHBOARD.md updated | Per governance |

---

## 6. Gate Conditions Summary

| Gate | Required Tasks | Blocking Next Phase? |
|------|----------------|----------------------|
| **Phase 0 Gate** | T-001 to T-006 all ✅ | Yes → Phase 1 |
| **Phase 1 Gate** | T-101 to T-108 all ✅ | Yes → Phase 2 |
| **Phase 2 Gate** | T-201 to T-206 all ✅ | Yes → Phase 3 |
| **Final Gate** | T-301 to T-306 all ✅ | Program Complete |

---

## 7. Blocker Tracking

| Blocker ID | Description | Impact | Owner | Resolution Target |
|------------|-------------|--------|-------|-------------------|
| BLK-01 | Frontend team capacity for migration | Blocks Phase 1 start | Frontend Lead | T+1 day |
| BLK-02 | Product decision on `market_data.public_urls` | Blocks T-204/T-205 | Product Owner | T+3 days |
| BLK-03 | Baseline test flakiness | May false-fail gates | QA Lead | T-005 fixes |

---

## 8. Daily Standup Format

```
Phase: [0/1/2/3]
Completed yesterday: [Task IDs]
Today: [Task IDs]
Blockers: [Blocker IDs]
Gate status: [Gate name - PASS/FAIL/PENDING]
```

---

*Part of 12-document handoff pack. See HANDOFF_MASTER for index.*