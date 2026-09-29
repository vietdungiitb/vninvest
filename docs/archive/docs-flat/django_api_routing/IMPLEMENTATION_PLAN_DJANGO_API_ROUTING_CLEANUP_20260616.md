# Implementation Plan: Django API Routing Cleanup — `/core/v1/` Standardization

**Program:** DJANGO_API_ROUTING_CLEANUP  
**Date Stamp:** 20260616  
**Version:** 1.0 (Handoff-ready)  
**Based on:** AUDIT_DJANGO_API_ROUTING_CORE_V1_VS_API_20260615.md + IMPLEMENTATION_PLAN_DJANGO_API_ROUTING_CLEANUP_20260615.md  

---

## 1. Dependency Graph

```mermaid
graph TD
    A[Phase 0: Immediate Cleanup] --> B[Phase 1: Identity & Workspace]
    B --> C[Phase 2: Market Data & Signals]
    C --> D[Phase 3: Final Verification]
    
    A1[Delete identity_access.api_urls] --> A
    A2[Delete signal_intelligence.api_urls] --> A
    A3[Remove 4 duplicate mounts from root urls.py] --> A
    A4[Merge missing routes into identity_access/urls.py] --> A
    
    B1[Frontend: REACT_APP_CORE_API_BASE_URL=/core/v1] --> B
    B2[Frontend: Migrate /api/portfolio/* -> /core/v1/workspace/*] --> B
    B3[Frontend: Migrate /api/auth/* -> /core/v1/auth/*] --> B
    B4[Frontend: Migrate /api/core/v1/partner/* -> /core/v1/partner/*] --> B
    B5[Remove user_workspace mount from /api/] --> B
    B6[Remove legacy stubs from user_workspace/urls.py] --> B
    
    C1[Add realtime/symbol-investigation to market_serving/urls.py] --> C
    C2[Delete market_serving.api_urls] --> C
    C3[Remove market_serving mount from /api/] --> C
    C4[Decision: market_data.public_urls keep/remove] --> C
    C5[Remove market_data duplicate mount (market_data_api)] --> C
    
    D1[Full test suite pass] --> D
    D2[Smoke tests 7/7 pass] --> D
    D3[Swagger UI loads] --> D
    D4[Zero 404 on /core/v1/ endpoints] --> D
```

---

## 2. Task Breakdown

### Phase 0 — Immediate Cleanup (No Frontend Dependency)
**Target:** T+1 day | **Owner:** Backend Engineer | **Risk:** Low

| Task ID | Task | Files | DoD | Gate |
|---------|------|-------|-----|------|
| T-001 | Delete `identity_access/api_urls.py` | `identity_access/api_urls.py` | File removed, no references in codebase | Git diff |
| T-002 | Delete `signal_intelligence/api_urls.py` | `signal_intelligence/api_urls.py` | File removed, no references in codebase | Git diff |
| T-003 | Remove 4 duplicate mounts from `vninvest_core/urls.py` | `vninvest_core/urls.py` | Lines for `signal_intelligence_api`, `identity_access_api`, `market_data_api` (2nd mount), `support_api` removed | Git diff |
| T-004 | Merge missing routes into `identity_access/urls.py` | `identity_access/urls.py` | All routes from deleted `api_urls.py` present: auth register/verify-email/resend/password-reset, dnse-credential, tenant-members, operator/mail-config (singular + plural) | Test pass |
| T-005 | Fix baseline test bugs (Chủ đề 4) | `identity_access/tests/test_password_reset.py`, `identity_access/tests/test_email_tasks.py` | Mock patches corrected: `views.password_reset.send_password_reset_email`, `data_ingest.tasks.send_system_email` | Test pass |
| T-006 | Run Phase 0 verification | — | `identity_access` + `signal_intelligence` test suites pass; smoke tests 1-4 pass | Test output |

### Phase 1 — Identity & Workspace (Requires Frontend Migration)
**Target:** T+5 days | **Owner:** Backend + Frontend | **Risk:** Medium

| Task ID | Task | Files | DoD | Gate |
|---------|------|-------|-----|------|
| T-101 | Frontend: Update `REACT_APP_CORE_API_BASE_URL=/core/v1` | `packages/web/.env.*`, `packages/web/src/config/api.ts` | Env var changed; coreApiAdapter baseURL = `/core/v1` | Frontend build |
| T-102 | Frontend: Migrate portfolio calls | `packages/web/src/**/*.tsx` | All `/api/portfolio/*` → `/core/v1/workspace/*` (grep confirms zero `/api/portfolio/`) | Grep + build |
| T-103 | Frontend: Migrate auth calls | `packages/web/src/**/*.tsx` | All `/api/auth/*` → `/core/v1/auth/*` (grep confirms zero `/api/auth/`) | Grep + build |
| T-104 | Frontend: Migrate partner calls | `packages/web/src/**/*.tsx` | All `/api/core/v1/partner/*` → `/core/v1/partner/*` (grep confirms zero `/api/core/v1/partner/`) | Grep + build |
| T-105 | Remove `user_workspace` mount from `/api/` | `vninvest_core/urls.py` | `path('api/', include(('user_workspace.urls', 'user_workspace_api')))` removed | Git diff |
| T-106 | Remove legacy stubs from `user_workspace/urls.py` | `user_workspace/urls.py` | Lines 63-78 removed: LegacyWatchlist*, PortfolioUserConfigView, GenericEmpty* for ai-advisory/screener/whale | Git diff |
| T-107 | Remove `portfolio/*` duplicate routes from `user_workspace/urls.py` | `user_workspace/urls.py` | Only `workspace/*` routes remain | Git diff |
| T-108 | Run Phase 1 verification | — | Full test suite pass; smoke tests 1-7 pass; frontend E2E pass | Test output |

### Phase 2 — Market Data & Signals
**Target:** T+8 days | **Owner:** Backend Engineer | **Risk:** Low-Medium

| Task ID | Task | Files | DoD | Gate |
|---------|------|-------|-----|------|
| T-201 | Add `realtime/symbol-investigation` to `market_serving/urls.py` | `market_serving/urls.py` | Route registered using `RealtimeSymbolInvestigationView` from `native_views.py` | Git diff |
| T-202 | Delete `market_serving/api_urls.py` | `market_serving/api_urls.py` | File removed, no references | Git diff |
| T-203 | Remove `market_serving` mount from `/api/` | `vninvest_core/urls.py` | `path('api/', include(('market_serving.api_urls', 'market_serving_api')))` removed | Git diff |
| T-204 | Decision: `market_data.public_urls` keep or remove | `market_data/public_urls.py`, `vninvest_core/urls.py` | Product Owner sign-off documented; if remove → file + mount deleted | Decision record |
| T-205 | Remove `market_data` duplicate mount (`market_data_api`) | `vninvest_core/urls.py` | Second `market_data.urls` mount under `/api/` removed | Git diff |
| T-206 | Run Phase 2 verification | — | `market_serving` + `market_data` test suites pass; smoke tests pass | Test output |

### Phase 3 — Final Verification
**Target:** T+9 days | **Owner:** QA + Backend | **Risk:** Low

| Task ID | Task | DoD | Gate |
|---------|------|-----|------|
| T-301 | Run full backend test suite | `python manage.py test` → 0 failures | Test report |
| T-302 | Run frontend test suite | `npm test` → 0 failures | Test report |
| T-303 | Smoke test 7 endpoints | All 7 return 200 (see Verification Plan) | Smoke test log |
| T-304 | Swagger UI accessibility | `/core/v1/schema/swagger-ui/` loads without error | Screenshot |
| T-305 | Zero 404 audit | Crawl `/core/v1/` endpoints → no 404 | Crawl report |
| T-306 | Update governance artifacts | CODE_CHANGE_AUDIT_LEDGER.md, PROGRESS_DASHBOARD.md updated | Git diff |

---

## 3. Validation Gates (Per Phase)

### Phase 0 Gate
- [ ] T-001 to T-005 complete
- [ ] `python manage.py test identity_access signal_intelligence` → PASS
- [ ] Smoke tests 1-4 PASS:
  - `GET /core/v1/health` → 200
  - `GET /core/v1/capability-bootstrap` → 200
  - `GET /core/v1/auth/me` (auth) → 200
  - `GET /api/health` (compat) → 200
- [ ] No regression in `/api/soc/` endpoints

### Phase 1 Gate
- [ ] T-101 to T-107 complete
- [ ] Frontend build succeeds (`npm run build`)
- [ ] Grep confirms zero `/api/portfolio/`, `/api/auth/`, `/api/core/v1/partner/` in frontend code
- [ ] `python manage.py test user_workspace identity_access` → PASS
- [ ] Frontend E2E tests pass (Cypress/Playwright)
- [ ] Smoke tests 1-7 PASS

### Phase 2 Gate
- [ ] T-201 to T-205 complete
- [ ] Product decision on `market_data.public_urls` recorded
- [ ] `python manage.py test market_serving market_data` → PASS
- [ ] Smoke tests 1-7 PASS

### Final Gate
- [ ] T-301 to T-306 complete
- [ ] All test suites PASS
- [ ] Governance artifacts updated

---

## 4. Rollback Procedures

| Phase | Trigger | Action | Time |
|-------|---------|--------|------|
| Phase 0 | Test failure / smoke fail | `git checkout HEAD -- vninvest_core/urls.py identity_access/urls.py identity_access/api_urls.py signal_intelligence/api_urls.py` | < 5 min |
| Phase 1 | Frontend break / test fail | Revert `vninvest_core/urls.py` (user_workspace mount) + frontend env/config | < 15 min |
| Phase 2 | Test failure | Revert `vninvest_core/urls.py` (market_serving/market_data mounts) + restore `market_serving/api_urls.py` | < 10 min |
| Any | DB migration needed | **N/A** — no DB changes in this program | — |

---

## 5. Resource Allocation

| Role | Phase 0 | Phase 1 | Phase 2 | Phase 3 |
|------|---------|---------|---------|---------|
| Backend Engineer | 1.0 FTE | 0.5 FTE | 1.0 FTE | 0.5 FTE |
| Frontend Engineer | 0 | 1.0 FTE | 0 | 0.5 FTE |
| QA | 0.2 FTE | 0.5 FTE | 0.5 FTE | 1.0 FTE |
| Product Owner | 0 | 0 | 0.2 FTE (decision) | 0 |

---

## 6. Communication Plan

| Event | Channel | Audience | Timing |
|-------|---------|----------|--------|
| Phase 0 Complete | Slack #backend-releases | Backend, QA, Tech Lead | Immediate |
| Frontend Migration Start | Slack #frontend-releases | Frontend, Backend, PM | T+1 day |
| Phase 1 Complete | Slack #releases | All | T+5 days |
| Phase 2 Complete | Slack #releases | All | T+8 days |
| Final Sign-off | Email + Slack | Stakeholders | T+9 days |

---

*Part of 12-document handoff pack per VNInvest Governance. See HANDOFF_MASTER for full index.*