# TASKBOARD: Market Data Service Unification (MDSU)

**Ngày tạo**: 2026-04-21  
**Phạm vi chương trình**: MDSU — Market Data Service Unification  
**Trạng thái tổng**: 🔲 PENDING APPROVAL

---

## Tóm tắt tiến độ

| Phase | Trạng thái | Tasks | Done |
|-------|-----------|:-----:|:----:|
| Phase 0 — Service Skeleton | 🔲 Chưa bắt đầu | 7 | 0 |
| Phase 1 — Backfill + Watchlist | 🔲 Chưa bắt đầu | 8 | 0 |
| Phase 2 — Analytics + Screener | 🔲 Chưa bắt đầu | 7 | 0 |
| Phase 3 — AI Advisory + Cleanup | 🔲 Chưa bắt đầu | 8 | 0 |

---

## Phase 0 — Service Skeleton + Contract Tests

**Mục tiêu**: Dựng `MarketDataService` với 3 API canonical + contract tests. KHÔNG thay code cũ.  
**DoD**: Contract tests 100% pass. Parity tests pass. Không ảnh hưởng code production.

| ID | Task | File | Loại | Trạng thái |
|----|------|------|:----:|:----------:|
| P0-01 | Thêm class `MarketDataService` vào file hiện có | `backend/portfolio/market_data_service.py` | MODIFIED | 🔲 |
| P0-02 | Implement `get_latest_snapshot()` — bulk Max(date) + Q filter | `market_data_service.py` | MODIFIED | 🔲 |
| P0-03 | Implement `get_ohlcv_batch()` — bulk date range + group by symbol | `market_data_service.py` | MODIFIED | 🔲 |
| P0-04 | Implement `get_historical_indicators()` — bulk lookback từ Max(date) | `market_data_service.py` | MODIFIED | 🔲 |
| P0-05 | Thêm Redis cache layer + local context cache dict vào cả 3 methods | `market_data_service.py` | MODIFIED | 🔲 |
| P0-06 | Tạo file contract + parity tests | `tests/test_market_data_service.py` | NEW | 🔲 |
| P0-07 | Chạy `python manage.py test portfolio.tests.test_market_data_service -v 2` | N/A | VERIFY | 🔲 |

**Checklist DoD Phase 0**:
- [ ] `test_get_latest_snapshot_parity` PASS.
- [ ] `test_get_latest_snapshot_empty` PASS.
- [ ] `test_get_latest_snapshot_missing_symbol` PASS.
- [ ] `test_get_historical_indicators_count` PASS.
- [ ] `test_get_historical_indicators_sorted_asc` PASS.
- [ ] `test_local_context_cache` PASS.
- [ ] `get_errors` clean trên `market_data_service.py`.
- [ ] Không có thay đổi nào ở 7 module nghiệp vụ.

---

## Phase 1 — Migrate Backfill + Watchlist Indicators

**Mục tiêu**: Giải quyết timeout Backfill và N+1 Watchlist.  
**Điều kiện bắt đầu**: Phase 0 DoD PASS.  
**Feature flag**: `MDSU_BACKFILL_ENABLED=True` để kích hoạt.

| ID | Task | File | Call-site | Loại | Trạng thái |
|----|------|------|-----------|:----:|:----------:|
| P1-01 | Thêm `MDSU_BACKFILL_ENABLED` vào `settings.py` feature flags | `config/settings.py` | N/A | MODIFIED | 🔲 |
| P1-02 | Migrate `services_backfill.py:44` → `get_latest_snapshot()` với feature flag | `services_backfill.py` | L44 | MODIFIED | 🔲 |
| P1-03 | Migrate `tasks_watchlist_indicators.py:73` → `get_historical_indicators(lookback=60)` + local_cache | `tasks_watchlist_indicators.py` | L73 | MODIFIED | 🔲 |
| P1-04 | Migrate `tasks_watchlist_indicators.py:80` → `get_historical_indicators(lookback=30)` + same local_cache | `tasks_watchlist_indicators.py` | L80 | MODIFIED | 🔲 |
| P1-05 | Migrate `tasks_prefetch.py:1478,1483` → `get_latest_snapshot()` | `tasks_prefetch.py` | L1478,L1483 | MODIFIED | 🔲 |
| P1-06 | Viết/mở rộng parity test: backfill 10 symbols, so sánh prev_close old vs new | `tests/test_market_data_service.py` | N/A | MODIFIED | 🔲 |
| P1-07 | Chạy full test suite liên quan: `test_ticker_prefetch_task`, `test_admin_ops` | N/A | N/A | VERIFY | 🔲 |
| P1-08 | Đo KPI: số SQL query khi chạy Watchlist batch 50 symbols (trước/sau) | N/A | N/A | VERIFY | 🔲 |

**Checklist DoD Phase 1**:
- [ ] `services_backfill.py` không còn `DailyPrice.objects.filter/order_by` ngoài write operations (khi flag ON).
- [ ] `tasks_watchlist_indicators.py` dùng 1 local_cache dict cho toàn batch (không còn N+1).
- [ ] Parity test backfill 10 symbols PASS.
- [ ] `test_ticker_prefetch_task` PASS.
- [ ] Backfill 50 symbols không timeout (KPI đo được).
- [ ] `get_errors` clean trên tất cả file thay đổi.

---

## Phase 2 — Migrate Analytics + Screener

**Mục tiêu**: Chuẩn hóa "giá mới nhất" và loại bỏ N+1 trong Analytics endpoint.  
**Điều kiện bắt đầu**: Phase 1 DoD PASS.  
**Feature flag**: `MDSU_ANALYTICS_ENABLED=True`.

| ID | Task | File | Call-site | Loại | Trạng thái |
|----|------|------|-----------|:----:|:----------:|
| P2-01 | Thêm `MDSU_ANALYTICS_ENABLED` vào `settings.py` | `config/settings.py` | N/A | MODIFIED | 🔲 |
| P2-02 | Migrate `analytics.py:93` → `get_ohlcv_batch()` | `analytics.py` | L93 | MODIFIED | 🔲 |
| P2-03 | Migrate `analytics.py:225` — loop filter per symbol → `get_latest_snapshot()` bulk | `analytics.py` | L225 | MODIFIED | 🔲 |
| P2-04 | Migrate `analytics.py:268` → `get_ohlcv_batch()` | `analytics.py` | L268 | MODIFIED | 🔲 |
| P2-05 | Migrate `analytics.py:805` (benchmark) → `get_ohlcv_batch()` | `analytics.py` | L805 | MODIFIED | 🔲 |
| P2-06 | Migrate `views_analytics_extended.py:39,98` — `Max(date)` loop → `get_latest_snapshot()` | `views_analytics_extended.py` | L39,L98 | MODIFIED | 🔲 |
| P2-07 | Migrate `views_analytics_extended.py:108` — single symbol filter → `get_latest_snapshot()` | `views_analytics_extended.py` | L108 | MODIFIED | 🔲 |
| P2-08 | Migrate `views_screener.py:65` — global latest_dates → `get_latest_snapshot()` | `views_screener.py` | L65 | MODIFIED | 🔲 |
| P2-09 | Migrate `views_screener.py:80,106` — chunk filter → `get_ohlcv_batch()` | `views_screener.py` | L80,L106 | MODIFIED | 🔲 |
| P2-10 | Chạy `test_analytics_advanced`, `test_screener_api` | N/A | N/A | VERIFY | 🔲 |
| P2-11 | Đo KPI: query count / Analytics request (trước/sau) | N/A | N/A | VERIFY | 🔲 |

**Checklist DoD Phase 2**:
- [ ] `analytics.py` không còn `DailyPrice.objects.*` (khi flag ON).
- [ ] `views_analytics_extended.py` không còn `Max(date)` loop N+1 (khi flag ON).
- [ ] `views_screener.py` không còn direct DailyPrice query (khi flag ON).
- [ ] `test_analytics_advanced` PASS.
- [ ] `test_screener_api` PASS.
- [ ] Analytics kết quả nhất quán với parity baseline Phase 0.
- [ ] Query count / request giảm rõ rệt so với baseline.

---

## Phase 3 — Migrate AI Advisory Context + Cleanup

**Mục tiêu**: Thống nhất lookback window AI, xóa `legacy_views.DailyPrice`, bật gate test.  
**Điều kiện bắt đầu**: Phase 2 DoD PASS.  
**Feature flag**: `MDSU_AI_ENABLED=True`.

| ID | Task | File | Call-site | Loại | Trạng thái |
|----|------|------|-----------|:----:|:----------:|
| P3-01 | Thêm `MDSU_AI_ENABLED` vào `settings.py` | `config/settings.py` | N/A | MODIFIED | 🔲 |
| P3-02 | Migrate `ai_advisory_helpers.py:957` → `get_historical_indicators()` | `ai_advisory_helpers.py` | L957 | MODIFIED | 🔲 |
| P3-03 | Migrate `ai_advisory_helpers.py:1038` → `get_historical_indicators()` | `ai_advisory_helpers.py` | L1038 | MODIFIED | 🔲 |
| P3-04 | Migrate `ai_context.py:55` → `get_historical_indicators(lookback=30)` | `ai_context.py` | L55 | MODIFIED | 🔲 |
| P3-05 | Migrate `views_ai_advisory_session.py:79,83` — xóa `legacy_views.DailyPrice` → `get_latest_snapshot()` | `views_ai_advisory_session.py` | L79,L83 | MODIFIED | 🔲 |
| P3-06 | Migrate `tasks_signal_verification.py:43,50` → `get_latest_snapshot()` | `tasks_signal_verification.py` | L43,L50 | MODIFIED | 🔲 |
| P3-07 | Tạo gate test `test_mdsu_gate.py` — scan 10 migrated files, cấm direct DailyPrice query | `tests/test_mdsu_gate.py` | N/A | NEW | 🔲 |
| P3-08 | Chạy full gate test + AI advisory tests (`test_ai_context`, `test_api_routes_stock_ai_advisory_session`) | N/A | N/A | VERIFY | 🔲 |
| P3-09 | Production stable 48h → xóa feature flag branches (legacy code paths) | 3 files | N/A | CLEANUP | 🔲 |
| P3-10 | Update audit ledger + PROGRESS_DASHBOARD với file list + KPI evidence | `docs/CODE_CHANGE_AUDIT_LEDGER.md`, `PROGRESS_DASHBOARD.md` | N/A | DOCS | 🔲 |

**Checklist DoD Phase 3**:
- [ ] Không còn `legacy_views.DailyPrice` bất kỳ đâu trong 10 module migrated.
- [ ] Gate test `test_mdsu_gate.py` PASS (scan 10 files, 0 forbidden pattern match).
- [ ] AI advisory contract tests PASS.
- [ ] AI advisory kết quả không lệch so với baseline (manual smoke test VNM/VCB).
- [ ] Tất cả 3 feature flags đã được xóa sau stable 48h.
- [ ] Audit ledger + progress dashboard đã cập nhật đầy đủ KPI evidence.

---

## Release Gate Tổng Thể

Chỉ được tuyên bố MDSU v1 COMPLETE khi:

| Gate | Điều kiện | Đạt chưa |
|------|-----------|:--------:|
| G1 | Gate test `test_mdsu_gate.py` PASS trên CI | 🔲 |
| G2 | Parity test 5 symbols chuẩn PASS | 🔲 |
| G3 | Backfill 50 symbols không timeout | 🔲 |
| G4 | Query count Analytics ≤ 3 per request | 🔲 |
| G5 | Không còn direct `DailyPrice.objects.*` trong 10 module mục tiêu | 🔲 |
| G6 | AI advisory smoke test VNM/VCB không lệch | 🔲 |
| G7 | Audit ledger entry MDSU final hoàn chỉnh | 🔲 |

---

## Danh sách file thay đổi toàn bộ MDSU v1

### Files mới (NEW)
- `backend/portfolio/tests/test_market_data_service.py`
- `backend/portfolio/tests/test_mdsu_gate.py`

### Files thay đổi (MODIFIED)
- `backend/portfolio/market_data_service.py`
- `backend/config/settings.py`
- `backend/portfolio/services_backfill.py`
- `backend/portfolio/tasks_watchlist_indicators.py`
- `backend/portfolio/tasks_prefetch.py`
- `backend/portfolio/analytics.py`
- `backend/portfolio/views_analytics_extended.py`
- `backend/portfolio/views_screener.py`
- `backend/portfolio/ai_advisory_helpers.py`
- `backend/portfolio/ai_context.py`
- `backend/portfolio/views_ai_advisory_session.py`
- `backend/portfolio/tasks_signal_verification.py`

### Files docs
- `docs/IMPLEMENTATION_PLAN_MARKET_DATA_SERVICE_UNIFICATION_20260421.md` (NEW)
- `docs/TECH_SPEC_MARKET_DATA_SERVICE_UNIFICATION_20260421.md` (NEW)
- `docs/TASKBOARD_MARKET_DATA_SERVICE_UNIFICATION_20260421.md` (NEW)
- `docs/CODE_CHANGE_AUDIT_LEDGER.md` (MODIFIED)
- `PROGRESS_DASHBOARD.md` (MODIFIED)

---

*Tài liệu này thuộc Mandatory Triad MDSU. Tham chiếu:*
- *Implementation Plan: `IMPLEMENTATION_PLAN_MARKET_DATA_SERVICE_UNIFICATION_20260421.md`*
- *Tech Spec: `TECH_SPEC_MARKET_DATA_SERVICE_UNIFICATION_20260421.md`*
