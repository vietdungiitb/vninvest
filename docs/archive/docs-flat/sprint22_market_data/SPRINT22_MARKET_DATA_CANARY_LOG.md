# Sprint 22 - Market Data canary log (S22-01, S22-02)

Trang thai: REQUIRES OPS EXECUTION

Tai lieu nay la artifact de van hanh canary that su tren staging/production. Trong workspace code hien tai, chi co the chuan bi template va checklist.

## Canary 10% -> 50% (S22-01)

- Target window: ____
- Owner: DevOps + QA
- Feature flag / traffic switch: ENABLE_NEW_MARKET_VIEWS
- KPI theo doi 24h:
  - p95 latency
  - 5xx rate
  - throttle error rate
  - cache hit/miss ratio
  - contract mismatch count

Result:
- Start time: ____
- End time: ____
- p95 delta vs baseline: ____
- 5xx peak: ____
- Contract mismatch: ____
- Decision: GO / NO-GO
- Notes: ____

## Canary 50% -> 100% (S22-02)

- Target window: ____
- Owner: DevOps + QA
- KPI theo doi 24h sau full rollout:
  - p95 latency
  - 5xx rate
  - cache metrics
  - rollback rehearsal status

Result:
- Start time: ____
- End time: ____
- p95 delta vs baseline: ____
- 5xx peak: ____
- Rollback rehearsal: PASS / FAIL
- Decision: GO / NO-GO
- Notes: ____

## Rollback trigger nhac lai

- 5xx > 1.5% / 5 phut
- p95 > 500ms / 5 phut

Neu trigger bi cham:
- Tat ENABLE_NEW_MARKET_VIEWS
- Ghi incident note trong ngay
- Hold rollout cho den khi co RCA + fix
