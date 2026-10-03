# Sprint 21 execution evidence template (2026-04-05)

Trang thai: TEMPLATE - READY TO FILL

Tai lieu nay dung trong ngay van hanh de ghi nhan bang chung runtime cho S21-01, S21-04, S21-12.

## A) Metadata

- Date: 2026-04-05
- Environment: staging / production
- Release window: ____
- Incident channel: ____
- Report directory: docs/ops-evidence/sprint21

### Owner on-duty

- Tech Lead: ____
- DevOps: ____
- QA: ____
- Backend on-call: ____

## B) Timeline board

| Moc thoi gian | Hoat dong | Owner | Trang thai | Ghi chu |
| :--- | :--- | :--- | :--- | :--- |
| T-60 | Pre-flight health check | ____ | TODO | ____ |
| T-15 | Measurement contract lock | ____ | TODO | ____ |
| T0 | Dashboard baseline snapshot | ____ | TODO | ____ |
| T+30m | Alert fire test | ____ | TODO | ____ |
| T+1h | Canary 10% checkpoint 1 | ____ | TODO | ____ |
| T+4h | Canary 10% checkpoint 2 | ____ | TODO | ____ |
| T+12h | Canary 10% checkpoint 3 | ____ | TODO | ____ |
| T+24h | Canary 10% final checkpoint | ____ | TODO | ____ |

## C) S21-01 evidence (measurement contract)

- KPI contract doc link: ____
- Rollback trigger agreed:
  - 5xx > 1.5% / 5 phut: YES / NO
  - p95 > 500ms / 5 phut: YES / NO
- Benchmark acceptance (p95 delta <= +10%): YES / NO
- Tech Lead signed at: ____
- DevOps signed at: ____

## D) S21-04 evidence (dashboard + alert)

### D1. Baseline KPI truoc canary

- p95 baseline: ____
- 5xx baseline: ____
- throttle baseline: ____
- cache hit/miss baseline: ____
- Dashboard screenshot/link: ____

### D2. Alert fire test

- Rule tested: ____
- Fire test result: PASS / FAIL
- Time-to-alert: ____
- Ack by: ____
- Alert event link: ____

## E) S21-12 evidence (canary 10% + benchmark)

### E1. Canary config

- ENABLE_NEW_MARKET_VIEWS canary scope: ON / OFF
- Canary start time: ____
- Canary end time: ____

### E2. Checkpoint summary

| Checkpoint | p95 | 5xx | Throttle | Cache hit ratio | Contract mismatch | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| T+1h | ____ | ____ | ____ | ____ | ____ | PASS/FAIL |
| T+4h | ____ | ____ | ____ | ____ | ____ | PASS/FAIL |
| T+12h | ____ | ____ | ____ | ____ | ____ | PASS/FAIL |
| T+24h | ____ | ____ | ____ | ____ | ____ | PASS/FAIL |

### E3. Rollback rehearsal

- Rehearsal executed: YES / NO
- Time to rollback: ____
- Recovery verification: PASS / FAIL
- Note link: ____

## F) Gate decision

- Sprint 21 Exit Gate: GO / NO-GO
- Decision rationale:
  - ____

## G) Residual risks and actions

1. Risk: ____
   - Owner: ____
   - ETA: ____
2. Risk: ____
   - Owner: ____
   - ETA: ____

## H) Signatures

- Tech Lead: ____  Date/Time: ____
- DevOps Lead: ____  Date/Time: ____
- QA Lead: ____  Date/Time: ____
- Backend Lead: ____  Date/Time: ____

## I) Artifact checklist

- [ ] measurement-contract.txt
- [ ] baseline.tests.txt
- [ ] alert-fire-evidence.txt
- [ ] canary-checkpoints.txt
- [ ] _artifact-index.txt
- [ ] Sprint 21 gate sign-off doc updated
