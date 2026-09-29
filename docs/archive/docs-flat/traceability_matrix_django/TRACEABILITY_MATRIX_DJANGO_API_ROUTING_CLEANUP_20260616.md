# Traceability Matrix: Django API Routing Cleanup — `/core/v1/` Standardization

**Program:** DJANGO_API_ROUTING_CLEANUP  
**Date Stamp:** 20260616  
**Version:** 1.0  

---

## 1. Requirement → Task → Validation Mapping

| Req ID | Requirement Description | Source | Tasks | Validation Method | Gate |
|--------|-------------------------|--------|-------|-------------------|------|
| **REQ-01** | Eliminate all duplicate routes between `/core/v1/` and `/api/` for identity_access | Audit §2.1 | T-001, T-003, T-004 | Route diff script: zero overlap | Phase 0 |
| **REQ-02** | Eliminate all duplicate routes between `/core/v1/` and `/api/` for signal_intelligence | Audit §2.4 | T-002, T-003 | Route diff script: zero overlap | Phase 0 |
| **REQ-03** | Remove duplicate `market_data.urls` mount under `/api/` | Audit §2.3 | T-003, T-205 | Single mount in root urls.py | Phase 0 / Phase 2 |
| **REQ-04** | Remove duplicate `support.urls` mount under `/api/support/` | Audit §2.9 | T-003 | Mount absent in root urls.py | Phase 0 |
| **REQ-05** | Preserve backward compatibility for `/operator/mail-config/` (singular) | Strategy Doc §3.1 | T-004 | Both singular + plural routes respond 200 | Phase 0 |
| **REQ-06** | Merge all unique routes from `identity_access.api_urls` into `identity_access/urls.py` | Audit §2.1 | T-004 | All 12 routes present in urls.py | Phase 0 |
| **REQ-07** | Fix baseline test mock patches in identity_access tests | Implementation Plan §Chủ đề 4 | T-005 | Test suite passes without mock errors | Phase 0 |
| **REQ-08** | Frontend uses `/core/v1/` as canonical base URL | Strategy Doc §3.2 | T-101 | Env var + adapter config = `/core/v1/` | Phase 1 |
| **REQ-09** | Frontend calls `/core/v1/workspace/*` instead of `/api/portfolio/*` | Audit §2.2 | T-102 | Grep: zero `/api/portfolio/` in frontend src | Phase 1 |
| **REQ-10** | Frontend calls `/core/v1/auth/*` instead of `/api/auth/*` | Audit §2.1 | T-103 | Grep: zero `/api/auth/` in frontend src | Phase 1 |
| **REQ-11** | Frontend calls `/core/v1/partner/*` instead of `/api/core/v1/partner/*` | Audit §2.1 | T-104 | Grep: zero `/api/core/v1/partner/` in frontend src | Phase 1 |
| **REQ-12** | Remove `user_workspace` mount from `/api/` namespace | Audit §2.2 | T-105 | Mount absent in root urls.py | Phase 1 |
| **REQ-13** | Remove legacy stub views from `user_workspace/urls.py` | Audit §2.2 | T-106 | LegacyWatchlist*, PortfolioUserConfigView, GenericEmpty* absent | Phase 1 |
| **REQ-14** | Remove `portfolio/*` duplicate routes from `user_workspace/urls.py` | Audit §2.2 | T-107 | Only `workspace/*` routes remain | Phase 1 |
| **REQ-15** | Preserve `realtime/symbol-investigation` route during market_serving cleanup | Audit §2.6 | T-201 | Route responds 200 on `/core/v1/` | Phase 2 |
| **REQ-16** | Eliminate `market_serving.api_urls` (legacy bridge + duplicates) | Audit §2.6 | T-202, T-203 | File gone, mount absent | Phase 2 |
| **REQ-17** | Decide fate of `market_data.public_urls` (public read mirror) | Audit §2.3 | T-204 | Product sign-off recorded | Phase 2 |
| **REQ-18** | All `/core/v1/` endpoints enforce tenant isolation | Constitution INV-01 | All phases | Permission class audit (grep) | All |
| **REQ-19** | All `/core/v1/` endpoints have OpenAPI schemas | Constitution INV-02 | All phases | drf-spectacular validation pass | All |
| **REQ-20** | All `/core/v1/` list endpoints use cursor pagination | Constitution INV-04 | All phases | Response shape audit | All |
| **REQ-21** | Health endpoints accessible unauthenticated | Constitution INV-07 | T-006, T-108, T-206, T-303 | `/core/v1/health`, `/core/v1/capability-bootstrap` → 200 no auth | All |
| **REQ-22** | Swagger UI loads without errors | Constitution INV-08 | T-304 | `/core/v1/schema/swagger-ui/` → 200, renders | Final |
| **REQ-23** | Zero 404 on any `/core/v1/` endpoint | Constitution INV-05 | T-305 | Automated crawl → 0 404s | Final |
| **REQ-24** | Full test suite passes (backend + frontend) | Quality Gate | T-301, T-302 | 0 failures | Final |
| **REQ-25** | Governance artifacts updated | Governance | T-306 | CODE_CHANGE_AUDIT_LEDGER.md, PROGRESS_DASHBOARD.md current | Final |

---

## 2. Coverage Summary

| Category | Requirements | Tasks | Validation Points |
|----------|--------------|-------|-------------------|
| Duplicate Removal | REQ-01 to REQ-04 | 4 | 4 route diff checks |
| Route Preservation | REQ-05, REQ-06, REQ-15 | 3 | 3 endpoint tests |
| Test Hygiene | REQ-07 | 1 | 1 test suite pass |
| Frontend Migration | REQ-08 to REQ-11 | 4 | 4 grep checks |
| Legacy Cleanup | REQ-12 to REQ-14 | 3 | 3 git diff checks |
| Market Cleanup | REQ-16, REQ-17 | 2 | 1 file deletion + 1 decision |
| Constitutional Compliance | REQ-18 to REQ-22 | 5 | 5 automated checks |
| Final Verification | REQ-23 to REQ-25 | 3 | 3 gate checks |
| **Total** | **25** | **26** | **25** |

---

## 3. Bidirectional Traceability

### 3.1 Task → Requirements

| Task | Covers Requirements |
|------|---------------------|
| T-001 | REQ-01 |
| T-002 | REQ-02 |
| T-003 | REQ-01, REQ-02, REQ-03, REQ-04 |
| T-004 | REQ-01, REQ-05, REQ-06 |
| T-005 | REQ-07 |
| T-006 | REQ-01, REQ-02, REQ-03, REQ-04, REQ-05, REQ-06, REQ-07, REQ-21 |
| T-101 | REQ-08 |
| T-102 | REQ-09 |
| T-103 | REQ-10 |
| T-104 | REQ-11 |
| T-105 | REQ-12 |
| T-106 | REQ-13 |
| T-107 | REQ-14 |
| T-108 | REQ-09, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-21, REQ-24 |
| T-201 | REQ-15 |
| T-202 | REQ-16 |
| T-203 | REQ-16 |
| T-204 | REQ-17 |
| T-205 | REQ-03, REQ-17 |
| T-206 | REQ-15, REQ-16, REQ-17, REQ-21, REQ-24 |
| T-301 | REQ-24 |
| T-302 | REQ-24 |
| T-303 | REQ-21 |
| T-304 | REQ-22 |
| T-305 | REQ-23 |
| T-306 | REQ-25 |

### 3.2 Requirement → Tasks (Reverse)

| Requirement | Covered By Tasks |
|-------------|------------------|
| REQ-01 | T-001, T-003, T-004, T-006 |
| REQ-02 | T-002, T-003, T-006 |
| REQ-03 | T-003, T-205 |
| REQ-04 | T-003, T-006 |
| REQ-05 | T-004, T-006 |
| REQ-06 | T-004, T-006 |
| REQ-07 | T-005, T-006 |
| REQ-08 | T-101, T-108 |
| REQ-09 | T-102, T-108 |
| REQ-10 | T-103, T-108 |
| REQ-11 | T-104, T-108 |
| REQ-12 | T-105, T-108 |
| REQ-13 | T-106, T-108 |
| REQ-14 | T-107, T-108 |
| REQ-15 | T-201, T-206 |
| REQ-16 | T-202, T-203, T-206 |
| REQ-17 | T-204, T-205, T-206 |
| REQ-18 | All phases (architectural) |
| REQ-19 | All phases (architectural) |
| REQ-20 | All phases (architectural) |
| REQ-21 | T-006, T-108, T-206, T-303 |
| REQ-22 | T-304 |
| REQ-23 | T-305 |
| REQ-24 | T-301, T-302 |
| REQ-25 | T-306 |

---

## 4. Validation Evidence Checklist

| Req ID | Evidence Artifact | Location | Collected At Gate |
|--------|-------------------|----------|-------------------|
| REQ-01 | Route diff output | CI artifact / local script | Phase 0 |
| REQ-02 | Route diff output | CI artifact / local script | Phase 0 |
| REQ-03 | Git diff `vninvest_core/urls.py` | PR #xxx | Phase 0 / Phase 2 |
| REQ-04 | Git diff `vninvest_core/urls.py` | PR #xxx | Phase 0 |
| REQ-05 | curl test both routes | Smoke test log | Phase 0 |
| REQ-06 | Git diff `identity_access/urls.py` | PR #xxx | Phase 0 |
| REQ-07 | Test output `identity_access.tests` | CI log | Phase 0 |
| REQ-08 | Frontend `.env` + `api.ts` | PR #xxx | Phase 1 |
| REQ-09 | `grep -r "/api/portfolio/" packages/web/src` | CI log / local | Phase 1 |
| REQ-10 | `grep -r "/api/auth/" packages/web/src` | CI log / local | Phase 1 |
| REQ-11 | `grep -r "/api/core/v1/partner/" packages/web/src` | CI log / local | Phase 1 |
| REQ-12 | Git diff `vninvest_core/urls.py` | PR #xxx | Phase 1 |
| REQ-13 | Git diff `user_workspace/urls.py` | PR #xxx | Phase 1 |
| REQ-14 | Git diff `user_workspace/urls.py` | PR #xxx | Phase 1 |
| REQ-15 | curl `/core/v1/realtime/symbol-investigation/VNM` | Smoke test log | Phase 2 |
| REQ-16 | Git diff (file deletion + mount removal) | PR #xxx | Phase 2 |
| REQ-17 | Product sign-off email/Slack | Decision record | Phase 2 |
| REQ-18 | `grep -r "IsTenantActive\|IsTenantOwnerOrAdmin" packages/core/backend/src/*/views.py` | CI gate | All |
| REQ-19 | `python manage.py spectacular --validate` | CI gate | All |
| REQ-20 | `grep -r "CursorPagination\|cursor" packages/core/backend/src/*/views.py` | CI gate | All |
| REQ-21 | Smoke test log (7 endpoints) | CI artifact | All |
| REQ-22 | Screenshot Swagger UI | CI artifact | Final |
| REQ-23 | Crawl script output | CI artifact | Final |
| REQ-24 | Test suite summary (backend + frontend) | CI log | Final |
| REQ-25 | Git diff governance files | PR #xxx | Final |

---

*Part of 12-document handoff pack. See HANDOFF_MASTER for index.*