# Run Code Review - Coordinated Parallel Scraping Market Data Backfill
**Ngay**: 2026-05-17

---

## 1. Review focus

1. Planner correctness and missing-only integrity.
2. Queue-tier coordination and anti-flood controls.
3. Parallel bucket execution safety.
4. Data integrity and idempotent upsert behavior.

---

## 2. Mandatory review checklist

- [ ] requested_window semantics dung voi spec
- [ ] force_refresh khong bi implicit enable
- [ ] scheduler co quota lock cooldown
- [ ] retry/backoff bounded and audited
- [ ] no direct vnbroker import outside adapter
- [ ] governance docs updated

---

## 3. High-risk hotspots

1. market_data/global_symbol_coverage.py
2. service_ops/tasks.py
3. data_ingest/tasks.py
4. service_ops/views/dataops.py
