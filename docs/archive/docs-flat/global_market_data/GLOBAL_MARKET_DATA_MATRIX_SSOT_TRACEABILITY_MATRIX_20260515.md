# Traceability Matrix — Global Market Data Matrix SSOT
**Ngày**: 2026-05-15  
**Parent**: `docs/GLOBAL_MARKET_DATA_MATRIX_SSOT_HANDOFF_MASTER_20260515.md`

---

| Req ID | Requirement | Source | Planned Tasks | Validation |
|--------|-------------|--------|---------------|------------|
| R1 | Global symbol matrix là SSOT duy nhất | Hard rule | T02, T08 | model tests, read-path audit |
| R2 | Matrix là hợp nhất persistent của mọi demand source hợp lệ | Hard rule | T02, T03 | demand-source integration tests |
| R3 | User không sở hữu market-data copy riêng | Hard rule | T03, T08 | API/path review, negative tests |
| R4 | Watchlist/tracked/holding/alert chỉ promote demand, không tạo crawl silo | Hard rule | T03, T05, T06 | event-flow tests, queue dedup tests |
| R5 | `ScrapeMatrix` chỉ là execution tracking | Hard rule | T02, T05, T09 | architecture review, model boundaries |
| R6 | Read paths phải facts-first từ global layer | Hard rule | T08, T09 | endpoint/browser regression tests |
| R7 | Planner phải coverage-gap/freshness-gap driven | Hard rule | T04, T05, T06 | planner tests, evidence payload |
| R8 | Symbol chỉ hạ ưu tiên sau khi hết demand + decay window | Hard rule | T03, T07 | lifecycle tests |
| R9 | Không overwrite mù quáng dữ liệu đã có | User request | T04, T05, T06 | ingest result counters, negative overwrite tests |
| R10 | SOC Data Ops là operator surface thống nhất | Existing repo direction | T09 | API/UI contract tests |
