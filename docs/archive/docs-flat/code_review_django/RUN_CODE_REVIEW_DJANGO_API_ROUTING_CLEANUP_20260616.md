# Run Code Review: Django API Routing Cleanup — `/core/v1/` Standardization

**Program:** DJANGO_API_ROUTING_CLEANUP  
**Date Stamp:** 20260616  
**Version:** 1.0  

---

## 1. Bootstrap Documents (Required Reading for Reviewers)

| Document | Purpose | Location |
|----------|---------|----------|
| HANDOFF_MASTER | Program overview, decisions, success criteria | `docs/DJANGO_API_ROUTING_CLEANUP_HANDOFF_MASTER_20260616.md` |
| IMPLEMENTATION_PLAN | Phase breakdown, tasks, gates, rollback | `docs/IMPLEMENTATION_PLAN_DJANGO_API_ROUTING_CLEANUP_20260616.md` |
| TECH_SPEC | Routing matrix, invariants, API contracts | `docs/TECH_SPEC_DJANGO_API_ROUTING_CLEANUP_20260616.md` |
| CODE_QUALITY_CONSTITUTION | Coverage targets, theater prevention, fitness scenarios | `docs/CODE_QUALITY_CONSTITUTION_DJANGO_API_ROUTING_CLEANUP_20260616.md` |
| SELF_AUDIT_AND_TEST_PROTOCOL | Checklists A-E, fail conditions | `docs/SELF_AUDIT_AND_TEST_PROTOCOL_DJANGO_API_ROUTING_CLEANUP_20260616.md` |
| AGENTS.md | Hard rules (governance, skills, anti-patterns) | `AGENTS.md` |
| quality/QUALITY.md | Quality standards, coverage, review process | `quality/QUALITY.md` |

---

## 2. Review Focus Areas (Per Phase)

### Phase 0 Review Focus
| Area | What to Check | Grep / Command |
|------|---------------|----------------|
| **File Deletions** | `identity_access/api_urls.py` and `signal_intelligence/api_urls.py` fully removed | `ls packages/core/backend/src/identity_access/api_urls.py` → not found |
| **Mount Removal** | 4 duplicate mounts gone from `vninvest_core/urls.py` | `grep -n "signal_intelligence_api\|identity_access_api\|market_data_api\|support_api" vninvest_core/urls.py` → 0 |
| **Route Merge** | All 12 unique routes from `identity_access.api_urls` present in `identity_access/urls.py` | `diff <(grep "^path" identity_access/api_urls.py | sort) <(grep "^path" identity_access/urls.py | sort)` |
| **Backward Compat** | Both `/operator/mail-config/` and `/operator/mail-configs/` registered | `grep "operator/mail-config" identity_access/urls.py` → 2 lines |
| **Test Fixes** | Mock patches corrected in `test_password_reset.py` and `test_email_tasks.py` | `grep "views.password_reset.send_password_reset_email" test_password_reset.py` + `grep "send_system_email" test_email_tasks.py` |
| **No Regressions** | `identity_access` + `signal_intelligence` test suites pass | `python manage.py test identity_access signal_intelligence` |

### Phase 1 Review Focus
| Area | What to Check | Grep / Command |
|------|---------------|----------------|
| **Frontend Config** | `REACT_APP_CORE_API_BASE_URL=/core/v1` in all `.env*` | `grep REACT_APP_CORE_API_BASE_URL packages/web/.env*` |
| **Adapter Config** | `coreApiAdapter.defaults.baseURL === '/core/v1'` | `grep "baseURL" packages/web/src/config/api.ts` |
| **Portfolio Migration** | Zero `/api/portfolio/` in frontend src | `grep -r "/api/portfolio/" packages/web/src/` → 0 |
| **Auth Migration** | Zero `/api/auth/` in frontend src | `grep -r "/api/auth/" packages/web/src/` → 0 |
| **Partner Migration** | Zero `/api/core/v1/partner/` in frontend src | `grep -r "/api/core/v1/partner/" packages/web/src/` → 0 |
| **Legacy Removal** | `user_workspace/urls.py` has no `LegacyWatchlist*`, `PortfolioUserConfigView`, `GenericEmpty*` | `grep -E "LegacyWatchlist|PortfolioUserConfigView|GenericEmpty" user_workspace/urls.py` → 0 |
| **Duplicate Removal** | No `portfolio/*` routes in `user_workspace/urls.py` | `grep "portfolio/" user_workspace/urls.py` → 0 |
| **Mount Removal** | `user_workspace` mount gone from `/api/` in root urls.py | `grep "user_workspace_api" vninvest_core/urls.py` → 0 |
| **E2E Tests** | Frontend E2E suite passes | `cd packages/web && npm run test:e2e` |

### Phase 2 Review Focus
| Area | What to Check | Grep / Command |
|------|---------------|----------------|
| **Route Preservation** | `realtime/symbol-investigation` in `market_serving/urls.py` | `grep "symbol-investigation" market_serving/urls.py` |
| **File Deletion** | `market_serving/api_urls.py` removed | `ls packages/core/backend/src/market_serving/api_urls.py` → not found |
| **Mount Removal** | `market_serving_api` mount gone from root urls.py | `grep "market_serving_api" vninvest_core/urls.py` → 0 |
| **Public URLs Decision** | Product sign-off documented for `market_data.public_urls` | Decision record in PR / Confluence |
| **Duplicate Mount** | `market_data` mounted once (or zero) under `/api/` | `grep -c "market_data.urls" vninvest_core/urls.py` → 1 or 0 |

### Phase 3 / Final Review Focus
| Area | What to Check | Grep / Command |
|------|---------------|----------------|
| **Full Test Suite** | Backend + Frontend all pass | `python manage.py test && cd packages/web && npm test` |
| **Smoke Tests** | All 7 endpoints return 200 | Run `scripts/smoke/curl_smoke.sh` |
| **Swagger UI** | `/core/v1/schema/swagger-ui/` loads | `curl -s -o /dev/null -w "%{http_code}" /core/v1/schema/swagger-ui/` → 200 |
| **Zero 404** | Crawl `/core/v1/` → no 404s | `python scripts/audit/crawl_core_v1.py` |
| **Coverage** | Targets met for all modified subsystems | `coverage report` |
| **Governance** | `CODE_CHANGE_AUDIT_LEDGER.md`, `PROGRESS_DASHBOARD.md` updated | `git diff docs/CODE_CHANGE_AUDIT_LEDGER.md docs/PROGRESS_DASHBOARD.md` |

---

## 3. Grep Checks (Automated in CI)

```bash
# Run these in CI for every PR in this program

# 1. No deleted files referenced
grep -r "api_urls" packages/core/backend/src/ --include="*.py" | grep -v "__pycache__" | grep -v ".pyc" || echo "PASS: No api_urls references"

# 2. No legacy stubs in user_workspace
grep -E "LegacyWatchlist|PortfolioUserConfigView|GenericEmpty" packages/core/backend/src/user_workspace/urls.py || echo "PASS: No legacy stubs"

# 3. No portfolio/* routes in user_workspace
grep "portfolio/" packages/core/backend/src/user_workspace/urls.py || echo "PASS: No portfolio routes"

# 4. No duplicate mounts in root urls.py
DUPES=$(grep -c "signal_intelligence_api\|identity_access_api\|market_data_api\|support_api\|user_workspace_api\|market_serving_api" packages/core/backend/src/vninvest_core/urls.py)
[ "$DUPES" -eq 0 ] && echo "PASS: No duplicate mounts" || echo "FAIL: $DUPES duplicate mounts found"

# 5. Constitutional invariants
grep -r "permission_classes" packages/core/backend/src/*/views.py | grep -v "AllowAny" | grep -v "IsTenantActive\|IsTenantOwnerOrAdmin" && echo "WARN: Views missing tenant permissions" || echo "PASS: Tenant permissions present"

# 6. OpenAPI validation
python manage.py spectacular --validate 2>&1 | grep -q "error" && echo "FAIL: OpenAPI validation errors" || echo "PASS: OpenAPI valid"

# 7. Frontend base URL (Phase 1+)
grep -r "REACT_APP_CORE_API_BASE_URL" packages/web/.env* | grep -v "/core/v1/" && echo "FAIL: Wrong base URL" || echo "PASS: Base URL correct"

# 8. Frontend old paths (Phase 1+)
grep -r "/api/portfolio/\|/api/auth/\|/api/core/v1/partner/" packages/web/src/ && echo "FAIL: Old paths found" || echo "PASS: No old paths"
```

---

## 4. Reject Conditions (Auto-Block Merge)

| Condition | Phase | Reason |
|-----------|-------|--------|
| Any deleted `api_urls.py` file referenced | 0, 2 | Dead code reference |
| Any duplicate mount remains in `vninvest_core/urls.py` | 0, 1, 2 | Routing conflict |
| `identity_access/urls.py` missing any route from deleted `api_urls.py` | 0 | Functionality loss |
| Singular `/operator/mail-config/` missing | 0 | Backward compat broken |
| Frontend base URL not `/core/v1/` | 1+ | Migration incomplete |
| Any `/api/portfolio/`, `/api/auth/`, `/api/core/v1/partner/` in frontend src | 1+ | Migration incomplete |
| Legacy stubs (`LegacyWatchlist*`, `GenericEmpty*`) in `user_workspace/urls.py` | 1 | Dead code |
| `portfolio/*` routes in `user_workspace/urls.py` | 1 | Duplicate routes |
| `market_serving/api_urls.py` exists after Phase 2 | 2 | Cleanup incomplete |
| `realtime/symbol-investigation` missing from `market_serving/urls.py` | 2 | Route lost |
| Test suite failures | All | Regression |
| Coverage decrease on modified files | All | Quality gate |
| OpenAPI validation errors | All | Contract broken |
| Governance artifacts not updated | 3 | Process violation |

---

## 5. Review Checklist (Per PR)

| Item | Reviewer | Status |
|------|----------|--------|
| Bootstrap documents read | | [ ] |
| Phase-appropriate focus areas checked | | [ ] |
| Grep checks all pass | | [ ] |
| Zero reject conditions | | [ ] |
| Execution Evidence Template complete | | [ ] |
| Self-Audit Protocol checklists pass | | [ ] |
| Fitness-to-Purpose scenarios covered | | [ ] |
| Coverage targets met | | [ ] |
| No new technical debt | | [ ] |
| **APPROVE / REQUEST CHANGES** | | [ ] |

---

## 6. Reviewer Assignment

| Phase | Primary Reviewer | Secondary Reviewer |
|-------|------------------|-------------------|
| Phase 0 | Backend Tech Lead | QA Lead |
| Phase 1 | Frontend Tech Lead + Backend Tech Lead | QA Lead |
| Phase 2 | Backend Tech Lead | Product Owner (for public_urls) |
| Phase 3 | Tech Lead + Architect | All Stakeholders |

---

*Part of 12-document handoff pack. See HANDOFF_MASTER for index.*