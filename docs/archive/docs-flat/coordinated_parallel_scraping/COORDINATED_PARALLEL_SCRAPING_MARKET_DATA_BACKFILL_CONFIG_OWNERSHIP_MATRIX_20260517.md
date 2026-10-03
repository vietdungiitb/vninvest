# Config Ownership Matrix - Coordinated Parallel Scraping Market Data Backfill
**Ngay**: 2026-05-17

---

| Config | Purpose | Owner | Writer | Runtime Surface |
|---|---|---|---|---|
| GLOBAL_MARKET_DATA_DAILY_BOOTSTRAP_DAYS | Do sau bootstrap daily cho symbol missing | Tech Lead Backend | Backend only | settings + env |
| Queue tier poll intervals | Cadence scheduler theo tier | Service Ops Lead | service_ops only | DataOps runtime config |
| Max dispatch per tier | Gioi han dispatch moi cycle | Service Ops Lead | service_ops only | Scheduler summary |
| Provider bucket workers | Do song song daily ingestion | Data Ingest Lead | data_ingest only | ingest task output |
| Intraday depth policy | Do sau intraday theo tier | Data Ingest Lead | data_ingest only | planner requested_window |
| Retry/backoff budget | Bound for provider failures | Data Ingest Lead | data_ingest only | ingest metrics |

---

## Ownership rules

1. Frontend khong duoc ghi runtime crawl policy.
2. Operator UI chi duoc thay doi config qua endpoint co audit trail.
3. Moi thay doi config co owner, reason, expiry neu la temporary override.
