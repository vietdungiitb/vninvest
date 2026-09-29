# Self-Audit and Test Protocol: Django API Routing Cleanup — `/core/v1/` Standardization

**Program:** DJANGO_API_ROUTING_CLEANUP  
**Date Stamp:** 20260616  
**Version:** 1.0  

---

## 1. Audit Checklist Framework

### Checklist A: Routing Correctness (Automated)

| Check ID | Description | Command / Script | Pass Criteria | Phase |
|----------|-------------|------------------|---------------|-------|
| A-01 | Zero duplicate routes between `/core/v1/` and `/api/` | `python scripts/audit/route_diff.py` | 0 conflicts | 0,1,2 |
| A-02 | All `/core/v1/` routes registered in root urls.py | `python scripts/audit/route_coverage.py --prefix=/core/v1/` | 100% coverage | 0,1,2,3 |
| A-03 | No orphaned urlpatterns in deleted api_urls files | `grep -r "api_urls" packages/core/backend/src/` | 0 matches | 0,2 |
| A-04 | Singular + plural mail-config both exist | `curl -s -o /dev/null -w "%{http_code}" /core/v1/operator/mail-config/ && curl -s -o /dev/null -w "%{http_code}" /core/v1/operator/mail-configs/` | Both 200 (auth) | 0 |
| A-05 | `realtime/symbol-investigation` route exists | `curl -s -o /dev/null -w "%{http_code}" /core/v1/realtime/symbol-investigation/VNM` | 200 (auth) | 2 |
| A-06 | `market_data` mounted exactly once under `/api/` (or zero if removed) | `grep -c "market_data.urls" packages/core/backend/src/vninvest_core/urls.py` | Count = 1 (or 0) | 0,2 |
| A-07 | `support` mounted exactly once (under `/core/v1/` only) | `grep -c "support.urls" packages/core/backend/src/vninvest_core/urls.py` | Count = 1 | 0 |

### Checklist B: Constitutional Compliance (Automated + Manual)

| Check ID | Description | Command / Script | Pass Criteria | Phase |
|----------|-------------|------------------|---------------|-------|
| B-01 | All `/core/v1/` views use `IsTenantActive` or `IsTenantOwnerOrAdmin` | `grep -r "permission_classes" packages/core/backend/src/*/views.py \| grep -v "AllowAny" \| grep -E "IsTenantActive|IsTenantOwnerOrAdmin"` | 100% of non-health views | All |
| B-02 | All `/core/v1/` serializers have OpenAPI schema annotations | `python manage.py spectacular --validate` | 0 errors | All |
| B-03 | All list endpoints return cursor pagination envelope | `grep -r "CursorPagination\|cursor" packages/core/backend/src/*/views.py` | All list views | All |
| B-04 | Error responses use standard envelope | `grep -r "error.*code.*message" packages/core/backend/src/*/views.py` | Consistent pattern | All |
| B-05 | Health endpoints allow unauthenticated access | `grep -A5 "class.*Health\|def health" packages/core/backend/src/vninvest_core/views_health.py` | `permission_classes = [AllowAny]` | All |

### Checklist C: Functional Correctness (Test Suite)

| Check ID | Description | Command | Pass Criteria | Phase |
|----------|-------------|---------|---------------|-------|
| C-01 | `identity_access` test suite passes | `python manage.py test identity_access` | 0 failures | 0,1,3 |
| C-02 | `signal_intelligence` test suite passes | `python manage.py test signal_intelligence` | 0 failures | 0,2,3 |
| C-03 | `user_workspace` test suite passes | `python manage.py test user_workspace` | 0 failures | 1,3 |
| C-04 | `market_serving` test suite passes | `python manage.py test market_serving` | 0 failures | 2,3 |
| C-05 | `market_data` test suite passes | `python manage.py test market_data` | 0 failures | 2,3 |
| C-06 | Full backend test suite passes | `python manage.py test` | 0 failures | 3 |
| C-07 | Frontend test suite passes | `cd packages/web && npm test` | 0 failures | 1,3 |
| C-08 | Frontend build succeeds | `cd packages/web && npm run build` | Exit code 0 | 1,3 |

### Checklist D: Smoke Tests (Runtime)

| Check ID | Endpoint | Expected | Phase |
|----------|----------|----------|-------|
| D-01 | `GET /core/v1/health` | 200, JSON `{status: "ok"}` | All |
| D-02 | `GET /core/v1/capability-bootstrap` | 200, JSON with capabilities | All |
| D-03 | `GET /core/v1/auth/me` (with valid JWT) | 200, user profile | All |
| D-04 | `GET /api/health` (compat) | 200 | All |
| D-05 | `GET /api/soc/` (any endpoint) | 200/401 (not 404) | All |
| D-06 | `GET /core/v1/schema/` | 200, OpenAPI JSON | 3 |
| D-07 | `GET /core/v1/schema/swagger-ui/` | 200, HTML loads | 3 |

### Checklist E: Frontend Integration (Phase 1+)

| Check ID | Description | Verification | Phase |
|----------|-------------|--------------|-------|
| E-01 | `REACT_APP_CORE_API_BASE_URL=/core/v1` in all env files | `grep REACT_APP_CORE_API_BASE_URL packages/web/.env*` | 1 |
| E-02 | `coreApiAdapter.defaults.baseURL === '/core/v1'` | `grep -r "baseURL" packages/web/src/config/` | 1 |
| E-03 | Zero `/api/portfolio/` calls in frontend src | `grep -r "/api/portfolio/" packages/web/src/` → 0 | 1 |
| E-04 | Zero `/api/auth/` calls in frontend src | `grep -r "/api/auth/" packages/web/src/` → 0 | 1 |
| E-05 | Zero `/api/core/v1/partner/` calls in frontend src | `grep -r "/api/core/v1/partner/" packages/web/src/` → 0 | 1 |
| E-06 | Frontend E2E tests pass (Cypress/Playwright) | `cd packages/web && npm run test:e2e` | 1,3 |

---

## 2. Fail Conditions (Block Merge/Close)

| Condition | Severity | Action |
|-----------|----------|--------|
| Any Checklist A check fails | **BLOCKER** | Do not merge; fix routing |
| Any Checklist B check fails | **BLOCKER** | Do not merge; fix constitutional violation |
| Any Checklist C check fails | **BLOCKER** | Do not merge; fix test regression |
| Any Checklist D check fails | **BLOCKER** | Do not deploy; investigate runtime |
| Any Checklist E check fails (Phase 1+) | **BLOCKER** | Do not merge frontend; fix migration |
| Test coverage < 80% on modified apps | **WARNING** | Require coverage justification |
| New `TODO`/`FIXME` in routing files | **WARNING** | Clean up before merge |

---

## 3. Coverage Targets

| Subsystem | Target | Measurement |
|-----------|--------|-------------|
| `identity_access` | ≥ 90% | `coverage run -m pytest identity_access` |
| `signal_intelligence` | ≥ 85% | `coverage run -m pytest signal_intelligence` |
| `user_workspace` | ≥ 85% | `coverage run -m pytest user_workspace` |
| `market_serving` | ≥ 80% | `coverage run -m pytest market_serving` |
| `market_data` | ≥ 80% | `coverage run -m pytest market_data` |
| **Overall backend** | ≥ 80% | `coverage run manage.py test` |
| **Frontend** | ≥ 75% | `npm run test:coverage` |

**Coverage Theater Prevention:**
- No mock-only tests without real assertions
- Each test must verify behavior, not just execution
- Integration tests preferred over unit mocks for routing

---

## 4. Fitness-to-Purpose Scenarios

| Scenario | Description | Validation |
|----------|-------------|------------|
| S-01 | Tenant A cannot access Tenant B's portfolio via `/core/v1/workspace/portfolios/` | Integration test with 2 tenants |
| S-02 | Unauthenticated request to `/core/v1/auth/me` returns 401 | Unit test |
| S-03 | `/core/v1/health` returns 200 without any headers | Smoke test D-01 |
| S-04 | Pagination on `/core/v1/workspace/portfolios/?limit=5` returns cursor envelope | Integration test |
| S-05 | Error on invalid symbol `/core/v1/stock-management/stocks/INVALID/` returns error envelope | Integration test |
| S-06 | Frontend login flow works end-to-end with `/core/v1/auth/login` | E2E test E-06 |
| S-07 | Partner self-service billing works at `/core/v1/partner/billing/subscription` | Integration test |
| S-08 | Real-time ticker `/core/v1/realtime/ticker/VCB` returns live data | Manual / staging test |

---

## 5. Audit Execution Protocol

### Pre-Merge (Per PR)
1. Run Checklist A (automated via CI)
2. Run Checklist B (automated via CI + manual spot-check)
3. Run Checklist C for affected apps
4. Verify no new warnings in CI

### Per Phase Gate
1. Run all Checklist A-D for phase scope
2. Run Checklist E if Phase 1+
3. Document results in Execution Evidence Template
4. Gate sign-off by QA + Tech Lead

### Final Audit (Pre-Release)
1. Full Checklist A-E execution
2. Fitness-to-purpose scenarios S-01 to S-08
3. Coverage report generation
4. Governance artifact update (T-306)
5. Final sign-off by all stakeholders

---

## 6. Tools & Scripts

| Tool | Purpose | Location |
|------|---------|----------|
| `route_diff.py` | Compare `/core/v1/` vs `/api/` routes | `scripts/audit/` |
| `route_coverage.py` | Verify all routes registered | `scripts/audit/` |
| `drf-spectacular` | OpenAPI validation | `python manage.py spectacular --validate` |
| `coverage.py` | Test coverage measurement | `coverage run manage.py test` |
| `curl_smoke.sh` | Run 7 smoke tests | `scripts/smoke/` |

---

*Part of 12-document handoff pack. See HANDOFF_MASTER for index.*