# Run Code Review — Global Market Data Backfill Effectiveness Hardening
**Ngày**: 2026-05-19

---

## 1. Review focus

1. Scheduler truth correctness.
2. Planner ranking correctness.
3. Execution mode integrity.
4. OpenAPI compliance.
5. Frontend truth rendering only.

---

## 2. Mandatory review checklist

- [ ] backfill jobs có `service_key` và history mapping đúng
- [ ] inflight marker được clear ở terminal state
- [ ] planner không còn alphabet-first cho repair path
- [ ] `priority_reason` trả về và test bao phủ
- [ ] newly promoted fast-path không tạo duplicate crawl item
- [ ] no direct provider import ngoài adapter
- [ ] endpoints mới/chỉnh sửa có envelope + pagination + auth đúng
- [ ] governance docs updated

---

## 3. High-risk hotspots

1. `packages/core/backend/src/service_ops/views/scheduler.py`
2. `packages/core/backend/src/service_ops/scheduler_catalog.py`
3. `packages/core/backend/src/data_ingest/tasks.py`
4. `packages/core/backend/src/market_data/global_symbol_planner.py`
5. `frontend/src/components/soc/SchedulerBoard.jsx`
6. `frontend/src/components/soc/DataOpsPanel.jsx`

---

## 4. Suggested verification commands

```powershell
# bare except ban
rg "except:\s*$|except Exception:\s*pass" packages/core/backend/src/service_ops packages/core/backend/src/data_ingest packages/core/backend/src/market_data

# provider import outside adapter
rg "from vnbroker|import vnbroker|DNSEQuote|Vnbroker\(" packages/core/backend/src -g "*.py"

# scheduler service_key mapping
rg "daily-backfill-prices-1700|deep-history-bootstrap-weekly|service_key" packages/core/backend/src/service_ops/scheduler_catalog.py

# progress/history contracts
rg "progress_pct|planned_symbols_count|completed_symbols_count|priority_reason" packages/core/backend/src frontend/src
```
