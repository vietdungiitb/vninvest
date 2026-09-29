# Sprint 21 execution evidence (staging prefill) - 2026-04-05

Trang thai: PREFILL FOR STAGING

Tai lieu nay la ban prefill de doi Ops/QA dien nhanh khi chay that tren staging.

## A) Metadata

- Date: 2026-04-05
- Environment: staging
- Release window: 22:00 -> 22:00 (+24h)
- Incident channel: #ops-runtime
- Report directory: docs/ops-evidence/sprint21
- Backend commit: ____
- Frontend commit (neu lien quan): ____

### Owner on-duty

- Tech Lead: ____
- DevOps: ____
- QA: ____
- Backend on-call: ____

## B) Timeline board (prefill)

| Moc thoi gian | Hoat dong | Owner | Trang thai | Ghi chu |
| :--- | :--- | :--- | :--- | :--- |
| 21:00 (T-60) | Pre-flight health check | DevOps | TODO | API + auth + realtime health |
| 21:45 (T-15) | Measurement contract lock | Tech Lead + DevOps | TODO | Chot KPI + rollback triggers |
| 22:00 (T0) | Dashboard baseline snapshot | DevOps + QA | TODO | Chup baseline truoc canary |
| 22:30 (T+30m) | Alert fire test | DevOps | TODO | 1 fire test + ack |
| 23:00 (T+1h) | Canary 10% checkpoint 1 | QA | TODO | KPI + mismatch |
| 02:00 (T+4h) | Canary 10% checkpoint 2 | QA | TODO | KPI + mismatch |
| 10:00 (T+12h) | Canary 10% checkpoint 3 | QA | TODO | KPI + mismatch |
| 22:00 (T+24h) | Canary 10% final checkpoint | Tech Lead + QA + DevOps | TODO | Quyết định gate |

## C) S21-01 evidence (measurement contract)

- KPI contract doc link: docs/ops-evidence/sprint21/measurement-contract.txt
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
- [ ] docs/SPRINT21_EXIT_GATE_SIGNOFF_TEMPLATE.md da ky
