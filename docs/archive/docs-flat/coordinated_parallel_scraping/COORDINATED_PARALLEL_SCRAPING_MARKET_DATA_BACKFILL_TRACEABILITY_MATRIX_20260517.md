# Traceability Matrix - Coordinated Parallel Scraping Market Data Backfill
**Ngay**: 2026-05-17

---

| Req ID | Requirement | Planned Tasks | Validation |
|---|---|---|---|
| R1 | Missing symbol daily phai bootstrap theo days-window | P01, P02 | test_global_symbol_coverage |
| R2 | Planner phai missing-only by default | P02 | planner preview/run tests |
| R3 | CPS phai co tier-based dispatch quota | P03 | test_soc_tasks + runtime logs |
| R4 | Daily scraping phai provider-bucket parallel | P04 | test_tasks + ingest metrics |
| R5 | Intraday depth phai theo tier policy | P05 | planner/intraday tests |
| R6 | Operator phai nhin thay backlog/fail-rate/starvation | P06 | DataOps API/UI tests |
| R7 | Cutover phai co shadow/parity evidence | P07 | evidence template + run logs |
| R8 | Rollback phai verified truoc closeout | P08 | rollback drill checklist |
