# Self Audit and Test Protocol - Coordinated Parallel Scraping Market Data Backfill
**Ngay**: 2026-05-17

---

## 1. Muc tieu audit

Dam bao CPS implementation:
1. Dung SSOT global matrix.
2. Dung missing-only semantics.
3. Dung coordination-tier + parallel-provider architecture.
4. Co kha nang quan sat va rollback.

---

## 2. Checklist bat buoc

### A. Planner semantics
- [ ] daily missing -> days-window
- [ ] stale gap -> start_date/end_date
- [ ] force_refresh explicit only

### B. Scheduler coordination
- [ ] co lock + cooldown
- [ ] co dispatch quota per tier
- [ ] khong duplicate inflight run

### C. Parallel execution
- [ ] provider bucket split active
- [ ] retry/backoff bounded
- [ ] counters day du va nhat quan

### D. Observability
- [ ] backlog by tier visible
- [ ] fail-rate trend visible
- [ ] starvation indicator visible

### E. Governance
- [ ] start_dev run after runtime/code changes
- [ ] module tree regenerated
- [ ] audit/progress/modified-files docs updated

---

## 3. Test categories bat buoc

1. market_data planner/coverage tests
2. service_ops scheduler tests
3. data_ingest tasks tests
4. DataOps API contract tests
5. frontend DataOps UI tests
6. smoke runtime checks

---

## 4. Block merge conditions

1. planner quay lai trade_date-only cho missing daily coverage.
2. queue-tier scheduler khong co quota gate.
3. provider bucket parallel bi bypass.
4. khong co evidence shadow/parity cho giai doan cutover.
