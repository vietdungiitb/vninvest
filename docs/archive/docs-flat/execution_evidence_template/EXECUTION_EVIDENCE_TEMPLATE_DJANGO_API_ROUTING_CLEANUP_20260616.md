# Execution Evidence Template: Django API Routing Cleanup — `/core/v1/` Standardization

**Program:** DJANGO_API_ROUTING_CLEANUP  
**Date Stamp:** 20260616  
**Version:** 1.0  

---

## 1. Usage Instructions

**One template per slice/PR.** Fill completely before gate review. Attach to PR as evidence.

| Field | Description |
|-------|-------------|
| **Slice ID** | e.g., `PHASE-0-T001`, `PHASE-1-T102` |
| **PR Link** | GitHub/GitLab PR URL |
| **Executor** | Engineer name |
| **Reviewer** | Tech Lead / QA name |
| **Date Executed** | YYYY-MM-DD |
| **Gate** | Phase 0 / Phase 1 / Phase 2 / Final |

---

## 2. Slice Metadata

| Field | Value |
|-------|-------|
| Slice ID | |
| PR Link | |
| Executor | |
| Reviewer | |
| Date Executed | |
| Gate | |
| Phase | [0 / 1 / 2 / 3] |
| Tasks Covered | [Task IDs from Taskboard] |

---

## 3. Files Changed

| File Path | Change Type | Lines Added | Lines Removed | Description |
|-----------|-------------|-------------|---------------|-------------|
| | [CREATE / MODIFY / DELETE] | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |

**Git Diff Summary:**
```bash
# Paste `git diff --stat` output here
```

---

## 4. Validation Commands Executed

| Check ID | Command | Exit Code | Output Summary | Pass/Fail |
|----------|---------|-----------|----------------|-----------|
| A-01 | `python scripts/audit/route_diff.py` | | | [PASS/FAIL] |
| A-02 | `python scripts/audit/route_coverage.py --prefix=/core/v1/` | | | [PASS/FAIL] |
| A-03 | `grep -r "api_urls" packages/core/backend/src/` | | | [PASS/FAIL] |
| A-04 | `curl -s -o /dev/null -w "%{http_code}" /core/v1/operator/mail-config/ && curl -s -o /dev/null -w "%{http_code}" /core/v1/operator/mail-configs/` | | | [PASS/FAIL] |
| A-05 | `curl -s -o /dev/null -w "%{http_code}" /core/v1/realtime/symbol-investigation/VNM` | | | [PASS/FAIL] |
| A-06 | `grep -c "market_data.urls" packages/core/backend/src/vninvest_core/urls.py` | | | [PASS/FAIL] |
| A-07 | `grep -c "support.urls" packages/core/backend/src/vninvest_core/urls.py` | | | [PASS/FAIL] |
| B-01 | `grep -r "permission_classes" packages/core/backend/src/*/views.py \| grep -v "AllowAny" \| grep -E "IsTenantActive\|IsTenantOwnerOrAdmin"` | | | [PASS/FAIL] |
| B-02 | `python manage.py spectacular --validate` | | | [PASS/FAIL] |
| B-03 | `grep -r "CursorPagination\|cursor" packages/core/backend/src/*/views.py` | | | [PASS/FAIL] |
| B-04 | `grep -r "error.*code.*message" packages/core/backend/src/*/views.py` | | | [PASS/FAIL] |
| B-05 | `grep -A5 "class.*Health\|def health" packages/core/backend/src/vninvest_core/views_health.py` | | | [PASS/FAIL] |
| C-01 | `python manage.py test identity_access` | | | [PASS/FAIL] |
| C-02 | `python manage.py test signal_intelligence` | | | [PASS/FAIL] |
| C-03 | `python manage.py test user_workspace` | | | [PASS/FAIL] |
| C-04 | `python manage.py test market_serving` | | | [PASS/FAIL] |
| C-05 | `python manage.py test market_data` | | | [PASS/FAIL] |
| C-06 | `python manage.py test` | | | [PASS/FAIL] |
| C-07 | `cd packages/web && npm test` | | | [PASS/FAIL] |
| C-08 | `cd packages/web && npm run build` | | | [PASS/FAIL] |
| D-01 | `curl -s -o /dev/null -w "%{http_code}" /core/v1/health` | | | [PASS/FAIL] |
| D-02 | `curl -s -o /dev/null -w "%{http_code}" /core/v1/capability-bootstrap` | | | [PASS/FAIL] |
| D-03 | `curl -H "Authorization: Bearer <token>" -s -o /dev/null -w "%{http_code}" /core/v1/auth/me` | | | [PASS/FAIL] |
| D-04 | `curl -s -o /dev/null -w "%{http_code}" /api/health` | | | [PASS/FAIL] |
| D-05 | `curl -s -o /dev/null -w "%{http_code}" /api/soc/` | | | [PASS/FAIL] |
| D-06 | `curl -s -o /dev/null -w "%{http_code}" /core/v1/schema/` | | | [PASS/FAIL] |
| D-07 | `curl -s -o /dev/null -w "%{http_code}" /core/v1/schema/swagger-ui/` | | | [PASS/FAIL] |
| E-01 | `grep REACT_APP_CORE_API_BASE_URL packages/web/.env*` | | | [PASS/FAIL] |
| E-02 | `grep -r "baseURL" packages/web/src/config/` | | | [PASS/FAIL] |
| E-03 | `grep -r "/api/portfolio/" packages/web/src/` | | | [PASS/FAIL] |
| E-04 | `grep -r "/api/auth/" packages/web/src/` | | | [PASS/FAIL] |
| E-05 | `grep -r "/api/core/v1/partner/" packages/web/src/` | | | [PASS/FAIL] |
| E-06 | `cd packages/web && npm run test:e2e` | | | [PASS/FAIL] |

---

## 5. Payload / UI / Parity Evidence

### 5.1 API Response Samples (attach JSON)

**Endpoint:** `/core/v1/health`
```json
{
  "status": "ok"
}
```

**Endpoint:** `/core/v1/auth/me`
```json
{
  "data": {
    "id": "user_123",
    "email": "user@example.com",
    "tenant_id": "tenant_456",
    "roles": ["tenant_owner"]
  },
  "meta": { "timestamp": "2026-06-16T10:30:00Z" }
}
```

**Endpoint:** `/core/v1/workspace/portfolios/`
```json
{
  "data": [...],
  "meta": {
    "pagination": { "next_cursor": "abc", "has_more": true },
    "timestamp": "2026-06-16T10:30:00Z"
  }
}
```

### 5.2 Frontend Screenshots (attach images)

| Screen | Before (Phase 0) | After (Phase 1+) |
|--------|------------------|------------------|
| Login | | |
| Portfolio List | | |
| Partner Billing | | |
| Watchlist | | |

### 5.3 Parity Checks

| Check | Before | After | Status |
|-------|--------|-------|--------|
| Portfolio CRUD works | ✅ | | [PASS/FAIL] |
| Auth login/logout works | ✅ | | [PASS/FAIL] |
| Partner self-service works | ✅ | | [PASS/FAIL] |
| Watchlist CRUD works | ✅ | | [PASS/FAIL] |
| Real-time ticker works | ✅ | | [PASS/FAIL] |
| Advisory refresh works | ✅ | | [PASS/FAIL] |

---

## 6. Residual Risks

| Risk ID | Description | Likelihood | Impact | Mitigation / Follow-up |
|---------|-------------|------------|--------|------------------------|
| | | [Low/Med/High] | [Low/Med/High] | |

---

## 7. Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Executor | | | |
| Reviewer (Tech Lead) | | | |
| QA | | | |

---

## 8. Checklist Completion Summary

| Checklist | Total Checks | Passed | Failed | Skipped | Overall |
|-----------|--------------|--------|--------|---------|---------|
| A: Routing Correctness | 7 | | | | [PASS/FAIL] |
| B: Constitutional Compliance | 5 | | | | [PASS/FAIL] |
| C: Functional Tests | 8 | | | | [PASS/FAIL] |
| D: Smoke Tests | 7 | | | | [PASS/FAIL] |
| E: Frontend Integration | 6 | | | | [PASS/FAIL] |
| **TOTAL** | **33** | | | | [PASS/FAIL] |

**Gate Decision:** [PROCEED / BLOCK / REWORK]

---

*Part of 12-document handoff pack. See HANDOFF_MASTER for index. One instance per slice/PR.*