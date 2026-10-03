# Traceability Matrix - Symbol Engagement Warm-up (2026-04-23)

| Requirement | Design/Spec | Implementation Area | Test Case | Evidence |
|---|---|---|---|---|
| Hanh vi add symbol dong nhat giua tracked/watchlist/holdings | TECH_SPEC section Integration Contract | Engagement service + 3 call sites | TC01, TC02, TC03 | API logs + integration tests |
| Warm-up chi la lop dem den scheduler | IMPLEMENTATION_PLAN section Warm-up Strategy | Warm-up task + scheduler handoff | TC06 | Runtime metrics + schedule logs |
| Skip khi data fresh | TECH_SPEC section Freshness Contract | is_intraday_fresh() | TC03 | skipped_fresh metric |
| Khong duplicate task | TECH_SPEC section Lock Contract | lock key + TTL | TC04 | skipped_lock metric + queue logs |
| Khong lam qua tai he thong | IMPLEMENTATION_PLAN section Idempotency and Load Control | bounded concurrency + retry cap | TC04, TC05 | queue depth + latency dashboard |
| Co the audit va truy vet | AUDIT_PACKAGE + RUNBOOK | metrics + structured logs + ledger | TC08 | dashboard + ledger entries |

## Mapping tai lieu
- Plan: docs/IMPLEMENTATION_PLAN_SYMBOL_ENGAGEMENT_WARMUP_20260423.md
- Spec: docs/TECH_SPEC_SYMBOL_ENGAGEMENT_WARMUP_20260423.md
- Taskboard: docs/TASKBOARD_SYMBOL_ENGAGEMENT_WARMUP_20260423.md
- QA: docs/QA_TEST_MATRIX_SYMBOL_ENGAGEMENT_WARMUP_20260423.md
- Runbook: docs/RUNBOOK_SYMBOL_ENGAGEMENT_WARMUP_20260423.md
- Audit package: docs/AUDIT_PACKAGE_SYMBOL_ENGAGEMENT_WARMUP_20260423.md

## Audit sign-off record
- Backend lead:
- QA lead:
- DevOps lead:
- Product owner:
- Decision date:
