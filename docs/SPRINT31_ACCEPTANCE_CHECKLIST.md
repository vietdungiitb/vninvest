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
- [x] B7 FE locale vi khong lo key i18n tren Whale Alerts Hub (threshold source/abnormality/timestamp labels).

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

## Gate G - Phase 1 closure hardening (2026-04-11)

- [x] G1 Symbol investigation grouping payload compatibility (`correlated_campaigns`, `correlated_signals`, `grouped_timeline`) merged.
- [x] G2 Explainability text layer merged (`why_triggered`, `next_checks`) and rendered in Whale Hub.
- [x] G3 P1-13 smoke tests merged: campaign board, symbol modal payload, window backward-compat.
- [x] G4 Whale regression gate rerun green after final hardening fixes: `ApiRouteSmokeTests -k whale` = 56/56 PASS.

### Gate G evidence (commits)

- `2138939e` feat(sprint31-p1-11): symbol investigation endpoint grouping, FE payload alignment, param aliases
- `c0294850` feat(sprint31-p1-9/10/12): explainability layer BE+FE, co-observation timeline panel
- `88e8fa66` test(sprint31-p1-13): E2E smoke tests for campaign board, symbol modal, window filter backward compat
- `9788d6f0` fix(sprint31): stabilize whale aggregate windows and make whale regression tests time-safe

### Closure note (Gate E3)

- Decision: GO full.
- Debt lane da dong sau hotfix nhanh trong ngay:
	- `test_refactored_whale_feed_response_contains_scoring_contract` -> PASS
	- `test_refactored_whale_feed_aggregate_prefers_redis_stream_over_intraday_tick_db` -> PASS
	- `test_whale_feed_aggregate_prefers_redis_stream_over_intraday_tick_db` -> PASS
	- `test_whale_feed_aggregate_falls_back_to_vnbroker_after_stream_and_db_miss` -> PASS
- Regression evidence moi: bo whale scope `ApiRouteSmokeTests -k whale` dat 51/51 PASS (SQLite mode).

## Gate H - Re-audit remediation closure (2026-04-11)

- [x] H1 P0 resolved: realtime publish path honor per-symbol threshold override with fallback to user threshold.
- [x] H2 P1-A resolved: stock order-flow API propagate selected window to dark-flow detector internals.
- [x] H3 P1-B resolved: duplicate whale events collapsed to one signal per trade using highest matched threshold.
- [x] H4 Full whale gate rerun green after remediation:
	- `ApiRouteSmokeTests -k whale` = 56/56 PASS (SQLite mode)
	- Regression block (`test_whale_advisory_task`, `test_order_flow`, `test_realtime_compute`) = 71 PASS

### Gate H evidence (code + tests)

- `backend/portfolio/tasks.py`: per-symbol threshold override map in `collect_and_publish_realtime`.
- `backend/portfolio/order_flow.py`: `detect_dark_flow(..., window_minutes=...)` and internal propagation.
- `backend/portfolio/views.py`: `stock_order_flow_api` passes parsed `window_minutes` to detector.
- `backend/portfolio/realtime/compute.py`: highest-threshold-only duplicate policy.
- `backend/portfolio/tests/test_whale_advisory_task.py`: realtime threshold override/fallback coverage.
- `backend/portfolio/tests/test_order_flow.py`: window propagation assertion coverage.
- `backend/portfolio/tests/test_api_routes.py`: API->detector window argument assertion.
- `backend/portfolio/tests/test_realtime_compute.py`: duplicate policy expectation and highest-threshold test.

## Sign-off

- [x] BE Lead
- [x] FE Lead
- [x] QA Lead
- [x] DevOps Lead
- [x] PM/Product
