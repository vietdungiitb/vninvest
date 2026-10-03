# Run Spec Audit: Django API Routing Cleanup — `/core/v1/` Standardization

**Program:** DJANGO_API_ROUTING_CLEANUP  
**Date Stamp:** 20260616  
**Version:** 1.0  

---

## 1. Audit Purpose

Verify that the **implemented routing changes** conform to:
1. **Strategy Document** — `DJANGO_API_ROUTING_AND_MIGRATION_STRATEGY_20260615.md`
2. **Audit Baseline** — `AUDIT_DJANGO_API_ROUTING_CORE_V1_VS_API_20260615.md`
3. **Implementation Plan** — `IMPLEMENTATION_PLAN_DJANGO_API_ROUTING_CLEANUP_20260616.md`
4. **Tech Spec** — `TECH_SPEC_DJANGO_API_ROUTING_CLEANUP_20260616.md`
5. **Constitutional Invariants** — `CODE_QUALITY_CONSTITUTION_DJANGO_API_ROUTING_CLEANUP_20260616.md`

**Output:** `SPEC_AUDIT_FINDINGS_DJANGO_API_ROUTING_CLEANUP_20260616.md` with PASS/FAIL per question.

---

## 2. Audit Questions

### 2.1 Strategy Alignment

| Q-ID | Question | Expected Answer | Verification Method |
|------|----------|-----------------|---------------------|
| SA-01 | Are all SaaS Core APIs under `/core/v1/` only? | Yes | Route diff: zero `/core/v1/` functionality under `/api/` |
| SA-02 | Is `/api/` limited to public/bootstrap/compat only? | Yes | Only `commercial_public`, `market_data_public` (decision), `advertising_api`, `service_ops` remain |
| SA-03 | Is `/api/admin-ops/` returning 410 Gone? | Yes | `curl /api/admin-ops/anything` → 410 |
| SA-04 | Is `/api/soc/` untouched (operator only)? | Yes | Mount present, no changes in diff |
| SA-05 | Is `/admin/` (Django admin) untouched? | Yes | Mount present, no changes in diff |
| SA-06 | Was migration done in 3 phases per strategy? | Yes | Git history shows Phase 0 → 1 → 2 commits |
| SA-07 | Was shadow rollout used (both paths in staging 1 sprint)? | Yes/No | Deployment logs / staging config |
| SA-08 | Was log audit done before decommissioning `/api/` routes? | Yes/No | Nginx/Core-API log analysis artifact |

### 2.2 Audit Baseline Resolution

| Q-ID | Question | Expected Answer | Verification Method |
|------|----------|-----------------|---------------------|
| AB-01 | `identity_access.api_urls` deleted? | Yes | File not exist |
| AB-02 | `signal_intelligence.api_urls` deleted? | Yes | File not exist |
| AB-03 | `market_data` duplicate mount removed? | Yes | Single mount in root urls.py |
| AB-04 | `support` duplicate mount removed? | Yes | Single mount under `/core/v1/` only |
| AB-05 | `user_workspace` legacy stubs removed? | Yes | `grep LegacyWatchlist\|GenericEmpty` → 0 |
| AB-06 | `user_workspace` portfolio/* duplicates removed? | Yes | `grep portfolio/` → 0 in urls.py |
| AB-07 | `market_serving.api_urls` deleted? | Yes | File not exist |
| AB-08 | `realtime/symbol-investigation` preserved in `market_serving/urls.py`? | Yes | Route present |
| AB-09 | `market_data.public_urls` decision documented? | Yes/No | Product sign-off record |
| AB-10 | `advertising.api_urls` kept (public tracking)? | Yes | Mount present under `/api/` |
| AB-11 | `commercial.public_urls` kept (legal pages)? | Yes | Mount present under `/api/` |

### 2.3 Implementation Plan Compliance

| Q-ID | Question | Expected Answer | Verification Method |
|------|----------|-----------------|---------------------|
| IP-01 | All Phase 0 tasks (T-001 to T-006) complete? | Yes | Taskboard status + git diff |
| IP-02 | All Phase 1 tasks (T-101 to T-108) complete? | Yes | Taskboard status + git diff |
| IP-03 | All Phase 2 tasks (T-201 to T-206) complete? | Yes | Taskboard status + git diff |
| IP-04 | All Phase 3 tasks (T-301 to T-306) complete? | Yes | Taskboard status + git diff |
| IP-05 | Phase 0 Gate passed before Phase 1 start? | Yes | Gate sign-off record |
| IP-06 | Phase 1 Gate passed before Phase 2 start? | Yes | Gate sign-off record |
| IP-07 | Phase 2 Gate passed before Phase 3 start? | Yes | Gate sign-off record |
| IP-08 | Rollback procedures documented and tested? | Yes | `RUN_INTEGRATION_TESTS` rollback section |

### 2.4 Tech Spec Conformance

| Q-ID | Question | Expected Answer | Verification Method |
|------|----------|-----------------|---------------------|
| TS-01 | All `/core/v1/` routes match routing matrix in Tech Spec §3.1? | Yes | Route diff vs matrix |
| TS-02 | All `/api/` routes match Tech Spec §3.2 (post-cleanup)? | Yes | Route diff vs matrix |
| TS-03 | No deprecated routes from §3.3 accessible? | Yes | Crawl returns 404/410 |
| TS-04 | Response shapes follow standard envelope (§3.4)? | Yes | Sample responses match |
| TS-05 | Pagination uses cursor-based envelope? | Yes | List endpoint responses |
| TS-06 | Error responses use standard envelope? | Yes | 4xx/5xx responses |
| TS-07 | Observability: Prometheus metrics exposed? | Yes | `/metrics` has http_request_* |
| TS-08 | Swagger UI loads at `/core/v1/schema/swagger-ui/`? | Yes | Smoke test D-07 |
| TS-09 | Frontend base URL = `/core/v1/`? | Yes | Env + adapter config |
| TS-10 | Compatibility matrix (Tech Spec §8) honored? | Yes | External webhooks still work |

### 2.5 Constitutional Invariants (Code Quality Constitution)

| Q-ID | Question | Expected Answer | Verification Method |
|------|----------|-----------------|---------------------|
| CI-01 | All `/core/v1/` views enforce tenant isolation (INV-01)? | Yes | `grep permission_classes` check |
| CI-02 | All `/core/v1/` endpoints have OpenAPI schemas (INV-02)? | Yes | `spectacular --validate` |
| CI-03 | All list endpoints use cursor pagination (INV-04)? | Yes | Response shape audit |
| CI-04 | Error envelope standard (INV-03)? | Yes | 4xx/5xx response audit |
| CI-05 | Health endpoints unauthenticated (INV-07)? | Yes | Smoke test D-01, D-02 |
| CI-06 | Swagger UI loads (INV-08)? | Yes | Smoke test D-07 |
| CI-07 | Coverage targets met (Code Quality Constitution §1)? | Yes | `coverage report` |
| CI-08 | No coverage theater (CTP-01 to CTP-05)? | Yes | Grep checks + CI |
| CI-09 | All Fitness-to-Purpose scenarios have tests (FTP-01 to FTP-12)? | Yes | Test inventory |
| CI-10 | Architecture rules (AR-01 to AR-08) satisfied? | Yes | Grep checks |
| CI-11 | Zero technical debt introduced (Debt Budget)? | Yes | No new duplicates, stubs, dead files |

---

## 3. Audit Execution Procedure

### 3.1 Preparation
1. Checkout final implementation commit (post-Phase 3)
2. Start Django + Frontend in staging-like environment
3. Run full test suite to establish baseline
4. Generate OpenAPI schema: `python manage.py spectacular --file schema.yml`

### 3.2 Automated Checks (Run All)
```bash
# Strategy Alignment
./scripts/audit/route_diff.py --baseline=AUDIT_DJANGO_API_ROUTING_CORE_V1_VS_API_20260615.md

# Audit Baseline Resolution
./scripts/audit/verify_baseline_resolution.py

# Implementation Plan Compliance
./scripts/audit/verify_taskboard_completion.py

# Tech Spec Conformance
./scripts/audit/verify_routing_matrix.py --spec=TECH_SPEC_DJANGO_API_ROUTING_CLEANUP_20260616.md

# Constitutional Invariants
./scripts/smoke/curl_smoke.sh --phase=3
python manage.py spectacular --validate
coverage report --fail-under=80
grep -r "api_urls" packages/core/backend/src/ && echo "FAIL" || echo "PASS"
grep -E "LegacyWatchlist|GenericEmpty" packages/core/backend/src/user_workspace/urls.py && echo "FAIL" || echo "PASS"
```

### 3.3 Manual Checks
- Review Fitness-to-Purpose test coverage (FTP-01 to FTP-12)
- Verify Execution Evidence Templates complete for all slices
- Confirm governance artifacts updated
- Interview Product Owner on `market_data.public_urls` decision

### 3.4 Output Format

Generate `SPEC_AUDIT_FINDINGS_DJANGO_API_ROUTING_CLEANUP_20260616.md`:

```markdown
# Spec Audit Findings: DJANGO_API_ROUTING_CLEANUP

**Date:** 2026-06-16
**Auditor:** [Name]
**Commit:** [SHA]

## Summary
- Total Questions: 42
- PASS: XX
- FAIL: XX
- N/A: XX
- **Overall: [PASS / CONDITIONAL PASS / FAIL]**

## Detailed Findings

### Strategy Alignment (SA-01 to SA-08)
| Q-ID | Status | Evidence | Notes |
|------|--------|----------|-------|
| SA-01 | PASS | Route diff output | |
| SA-02 | PASS | Root urls.py diff | |
| ... | ... | ... | |

### Audit Baseline Resolution (AB-01 to AB-11)
| Q-ID | Status | Evidence | Notes |
|------|--------|----------|-------|
| AB-01 | PASS | File not found | |
| ... | ... | ... | |

### Implementation Plan Compliance (IP-01 to IP-08)
| Q-ID | Status | Evidence | Notes |
|------|--------|----------|-------|
| IP-01 | PASS | Taskboard + git log | |
| ... | ... | ... | |

### Tech Spec Conformance (TS-01 to TS-10)
| Q-ID | Status | Evidence | Notes |
|------|--------|----------|-------|
| TS-01 | PASS | Route matrix diff | |
| ... | ... | ... | |

### Constitutional Invariants (CI-01 to CI-11)
| Q-ID | Status | Evidence | Notes |
|------|--------|----------|-------|
| CI-01 | PASS | Permission grep | |
| ... | ... | ... | |

## Blockers for Release
- [List any FAIL items that block release]

## Recommendations
- [Any follow-up items]
```

---

## 4. Pass/Fail Criteria

| Overall Result | Criteria |
|----------------|----------|
| **PASS** | All 42 questions PASS |
| **CONDITIONAL PASS** | ≤ 3 FAIL, all non-blocking (e.g., SA-07 shadow rollout not done but logs show low risk) |
| **FAIL** | Any blocker FAIL (SA-01, SA-02, AB-01 to AB-08, CI-01 to CI-06, IP-01 to IP-04) |

**Blocker FAILs require remediation before release.**

---

## 5. Auditor Independence

- Auditor must not be implementer of any phase
- Auditor must have read access to all 12 handoff documents
- Auditor must have run access to staging environment
- Findings published to all stakeholders

---

*Part of 12-document handoff pack. See HANDOFF_MASTER for index.*