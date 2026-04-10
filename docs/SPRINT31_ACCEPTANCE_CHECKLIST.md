# Sprint 31 Acceptance Checklist

Ngay: 2026-04-10
Trang thai: GO - All whale regression gates green

## Gate A - Threshold and time semantics

- [x] A1 Threshold override consistency pass tren realtime feed.
- [x] A2 Threshold override consistency pass tren aggregate feed.
- [x] A3 Threshold override consistency pass tren whale advisory generation.
- [x] A4 Order-flow windows 5m/15m/30m/1h theo local market time.

## Gate B - Event metadata and UX trust

- [x] B1 Whale event payload co `source_layer`.
- [x] B2 Whale event payload co `threshold_source`.
- [x] B3 Whale event payload co `freshness_bucket`.
- [x] B4 Whale event payload co `recovered` marker.
- [x] B5 FE hien chips live/recovered dung semantics.
- [x] B6 FE hien chips threshold source dung semantics.

## Gate C - Observability

- [x] C1 Co metric freshness median/p95.
- [x] C2 Co metric dedup hit ratio.
- [x] C3 Co metric snapshot recovery ratio.
- [x] C4 Co metric source mix ratio.
- [x] C5 Co health summary endpoint cho whale pipeline.

## Gate D - Aggregate window filter v2 kickoff

- [x] D1 API aggregate nhan `window=5m|15m|1h|session|5d`.
- [x] D2 Cursor/sort semantics deterministic cho moi window.
- [x] D3 FE co control chon window va refetch dung contract.

## Gate E - Release readiness

- [x] E1 Regression suites whale/order-flow pass (51/51 whale feed tests pass sau hotfix debt lane).
- [x] E2 Co evidence test + metrics luu duoc trong sprint artifacts (SQLite fast-path test evidence collected).
- [x] E3 Co closure note GO/NO-GO cho sprint. GO: debt lane da duoc xu ly va dong trong ngay.

## Gate F - Phase 1 D1 Campaign Intelligence

- [x] F1 Campaign grouping engine deterministic va API contract V1 da publish.
- [x] F2 Whale Hub tab Campaigns co modal/filter/cursor load-more + FE tests pass.
- [x] F3 Abnormality baseline cache service skeleton da co interface fetch/cache/enrich.

### Closure note (Gate E3)

- Decision: GO full.
- Debt lane da dong sau hotfix nhanh trong ngay:
	- `test_refactored_whale_feed_response_contains_scoring_contract` -> PASS
	- `test_refactored_whale_feed_aggregate_prefers_redis_stream_over_intraday_tick_db` -> PASS
	- `test_whale_feed_aggregate_prefers_redis_stream_over_intraday_tick_db` -> PASS
	- `test_whale_feed_aggregate_falls_back_to_vnstock_after_stream_and_db_miss` -> PASS
- Regression evidence moi: bo whale scope `ApiRouteSmokeTests -k whale` dat 51/51 PASS (SQLite mode).

## Sign-off

- [x] BE Lead
- [x] FE Lead
- [x] QA Lead
- [x] DevOps Lead
- [x] PM/Product
