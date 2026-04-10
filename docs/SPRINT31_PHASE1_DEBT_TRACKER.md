# Sprint 31 Phase 1 Debt Tracker (Option B)

Ngay: 2026-04-10
Trang thai: Closed (all debt tests cleared)
Owner chinh: BE Lead

## Muc tieu

Theo doi va xu ly 4 loi pre-existing duoc chap nhan tai Gate E3 de khong chan kickoff Phase 1.

## Debt items

| Debt ID | Test failing | Impact | Root-cause hypothesis | Owner | Priority | ETA | Status |
|---|---|---|---|---|---|---|---|
| DEBT-001 | test_refactored_whale_feed_response_contains_scoring_contract | Thieu truong threshold_source trong payload scoring contract | Mapping metadata chua unify giua service va response adapter | BE | P0 | D1-01 | Done |
| DEBT-002 | test_refactored_whale_feed_aggregate_prefers_redis_stream_over_intraday_tick_db | Sai source preference (redis_stream bi mat uu tien) | Session window filtering loai stream fixtures qua chat | BE | P0 | D1-01 | Done |
| DEBT-003 | test_whale_feed_aggregate_prefers_redis_stream_over_intraday_tick_db | Sai source preference tren legacy path | Session window filtering loai stream fixtures qua chat | BE | P0 | D1-02 | Done |
| DEBT-004 | test_whale_feed_aggregate_falls_back_to_vnstock_after_stream_and_db_miss | Fallback chain khong xuong vnstock nhu ky vong | Session window filtering loai vnstock fixtures qua chat | BE | P0 | D1-02 | Done |

## Execution lane result

1. D1-01: Da fix DEBT-001 + DEBT-002 va pass targeted tests.
2. D1-02: Da fix DEBT-003 + DEBT-004 va pass targeted tests.
3. D1-03: Da chay lai whale regression gate va dat 51/51 PASS.

## Validation commands

- Targeted:
  - DB_ENGINE=sqlite python backend/manage.py test portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_refactored_whale_feed_response_contains_scoring_contract --verbosity=2
  - DB_ENGINE=sqlite python backend/manage.py test portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_refactored_whale_feed_aggregate_prefers_redis_stream_over_intraday_tick_db --verbosity=2
  - DB_ENGINE=sqlite python backend/manage.py test portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_whale_feed_aggregate_prefers_redis_stream_over_intraday_tick_db --verbosity=2
  - DB_ENGINE=sqlite python backend/manage.py test portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_whale_feed_aggregate_falls_back_to_vnstock_after_stream_and_db_miss --verbosity=2
- Gate run:
  - DB_ENGINE=sqlite python backend/manage.py test portfolio.tests.test_api_routes.ApiRouteSmokeTests -k whale --verbosity=1

## Exit criteria

- 4/4 debt tests pass. (Done)
- Whale regression pass rate >= 51/51 tren bo test da scope. (Done: 51/51)
- Khong mo rong regression sang window filter v2 contract. (Done)

## Closure summary

- Targeted test run (4 tests): PASS.
- Full whale regression run (51 tests): PASS.
- Debt lane closed; Phase 1 execution tiep tuc khong blocker.
