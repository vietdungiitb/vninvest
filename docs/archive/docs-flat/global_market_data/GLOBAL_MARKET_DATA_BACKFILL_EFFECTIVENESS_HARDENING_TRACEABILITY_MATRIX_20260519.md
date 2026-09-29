# Traceability Matrix — Global Market Data Backfill Effectiveness Hardening
**Ngày**: 2026-05-19
**Parent**: docs/GLOBAL_MARKET_DATA_BACKFILL_EFFECTIVENESS_HARDENING_HANDOFF_MASTER_20260519.md

---

| Req ID | Requirement | Source | Planned Tasks | Validation |
|---|---|---|---|---|
| R1 | Scheduler `run_now` phải phản ánh trạng thái thật, không cache-only illusion | User issue + scheduler audit | B01, B03 | scheduler action tests, UI smoke |
| R2 | Hai backfill jobs phải có history đúng và query được từ operator surface | User issue + scheduler audit | B01, B03 | history endpoint tests |
| R3 | Planner phải coverage-gap/freshness-gap driven | SSOT hard rule | B04, B05 | planner tests, preview payload |
| R4 | Không được quét alphabet-first như priority mặc định | User issue | B04, B05 | regression tests, ranking evidence |
| R5 | Symbol newly promoted/hot phải có fast-path bootstrap | User requirement | B06, B07 | promotion-flow tests |
| R6 | Manual repair phải hỗ trợ mode targeted/missing-only | User requirement | B07 | API tests, task tests |
| R7 | Không overwrite mù quáng dữ liệu đã có | SSOT hard rule | B04, B05, B07 | negative overwrite tests, counters |
| R8 | Coverage anomaly hot tier phải lộ diện ở DataOps | User issue | B08 | API/UI tests |
| R9 | Endpoint/operator surfaces phải tuân thủ OpenAPI constitution | OpenAPI policy | B03, B07, B08 | schema review, API tests |
| R10 | Frontend không được tự tính business truth thay backend | SaaS/native architecture | B03 | FE review, adapter tests |
| R11 | Governance artifacts phải hoàn tất mỗi slice | Project discipline | B01-B09 | audit ledger + progress + modified files updates |
| R12 | Rollout phải có shadow/completeness evidence và rollback path | Quality/governance | B09 | evidence template, cutover checklist |
