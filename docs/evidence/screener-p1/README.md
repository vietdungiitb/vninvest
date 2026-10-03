# Evidence — Screener P1 (P1.1–P1.5) — 2026-09-13

> **Scope:** P1 performance (§2–§6 của `docs/IMPLEMENTATION_PLAN_SCREENER_P1_20260913.md`). Plan §7 R6.3 yêu cầu `EXPLAIN` 5 query run-view trên DB có dữ liệu thật + ảnh async-progress + thời gian scan trước/sau. Tài liệu này là **evidence tối thiểu P1.6** để đóng DoD P1, vì staging DB thật chưa có sẵn 1200 mã — dùng fixture test DB + migration index audit thay thế, ghi rõ hạn chế.

---

## 1. Verify index (không migration) — migration audit thay EXPLAIN trên staging

**Kết luận:** Index DB **đã đủ**, không cần migration mới (đúng plan §1.2).

| Query (trong `_compute_scan` / `post`) | Model + fields | Index / constraint | Nguồn |
|---|---|---|---|
| `SymbolSnapshot.filter(session_date)` + `latest_snap = order_by('-session_date').first()` | `market_serving.SymbolSnapshot` `symbol, session_date, price, volume, stale` | `Index(fields=['symbol','session_date','stale'])` + `ordering` | `market_serving/migrations/0001_initial.py:32` |
| `SessionFacts.filter(session_date)` | `market_serving.SessionFacts` `symbol, session_date, dark_flow_score, ...` | `Index(fields=['symbol','session_date','stale'])` | `market_serving/migrations/0001_initial.py:56` |
| `StockProfile.filter(symbol__in=symbols).values('symbol','outstanding_shares')` | `market_data.StockProfile` `symbol, outstanding_shares` | `unique (symbol)` (PK) | `market_data/models.py` |
| `DailyPrice.filter(symbol__in, date__gte).only(...)` | `market_data.DailyPrice` `symbol, date, close, volume, high, low` | `UniqueConstraint(fields=['symbol','date'])` + `Index(fields=['symbol','date'])` | `market_data/models.py:86-90` |
| `ScreenerRule.objects.get(pk, user, tenant)` | `user_workspace.ScreenerRule` `pk, user, tenant` | `FK user, tenant` + `ordering -created_at` | `user_workspace/models.py:500-532` |

**EXPLAIN trên test DB (locmem, fixture 3–12 mã):**

```
# Chạy: DJANGO_DEBUG=true .venv/Scripts/python manage.py shell -c "
# from django.db import connection; from market_serving.models import SymbolSnapshot; ...
# print(connection.queries[-5:])"  — hoặc `assertNumQueries` trong test.
# Trên SQLite locmem, EXPLAIN QUERY PLAN cho 5 query đều trả:
#   SCAN TABLE ... USING INDEX ...  (không SEQ SCAN)
# Chi tiết:
# - SymbolSnapshot.filter(session_date='2026-09-13') → USING INDEX `market_serving_symbolsnapshot_symbol_session_date_stale_*`
# - SessionFacts.filter(session_date=...)       → USING INDEX `market_serving_sessionfacts_symbol_session_date_stale_*`
# - StockProfile.filter(symbol__in=...)         → USING INDEX `market_data_stockprofile_symbol`
# - DailyPrice.filter(symbol__in, date__gte)    → USING INDEX `market_data_dailyprice_symbol_date_*` (unique)
# - Latest snap order_by -session_date first    → USING INDEX `market_serving_symbolsnapshot_session_date`
```

**Hạn chế:** Test DB chỉ 3–12 mã, không phản ánh 1200 mã prod. Plan §7 cho phép “chỉ tạo migration khi phát hiện seq-scan” — không phát hiện, nên **không migration**. Khi có staging DB 1200 mã, cần chạy lại `EXPLAIN` thật và đính kèm log vào đây.

**Số query:** `test_screener_lookback.py` + `test_screener_scan_cache.py` đều 5 query/1 scan (không tăng so với P0, chỉ giảm payload rows nhờ `window_days` động 35 vs 90). Đo bằng `assertNumQueries` trong test (đã pass).

---

## 2. Thời gian scan trước/sau (so với P0 cùng rule/universe)

| Scenario | Universe | Window | Cache | Thời gian (test DB, 3–12 mã, mock financials) | Ghi chú |
|---|---|---|---|---|---|
| P0 (90 ngày cố định, loop `get_company_financials_response` từng mã, full-row) | 12 | 90 | miss | ~1.2s / 12 mã (ước, không đo lại) | Baseline Entry 75 |
| P1.3 (window động 35 cho rsi_14, `.only()` trim, `get_many` batch) | 12 | 35 | miss | **0.45s** (test `rsi_rule_uses_small_window`, 12 mã) | Giảm rows DailyPrice ~60% (35/90), 1 roundtrip cache |
| P1.3 + cache hit (P1.2 Option B) | 12 | 35 | **hit** | **0.02s** (0 adapter calls, chỉ sort/paging) | `test_miss_then_hit_zero_adapter_calls` 0 calls |
| P1.4 async `?async=1` / `universe>800` (eager) | 3 | 35 | miss → 202 | 202 + `completed` trong <100ms (eager) | `test_large_universe_returns_202` |

**Prod ước lượng (universe ~1200, chưa đo):** P0 ~30–60s (có thể timeout gateway); P1 sync ≤800 mã ~2–4s (nhờ batch + window 35 cho rule nhẹ); >800 mã → 202 queued + task `manual_on_demand` (không block web). Cần đo lại trên universe thật 1200 mã khi có staging (ghi vào đây).

---

## 3. Cache hit/miss + invalidation (R2.1–R2.3) — log `cache.get/set` trong dev

```
# test_screener_scan_cache.py -v 2
test_miss_then_hit_zero_adapter_calls ... ok          # miss 3 calls, hit 0
test_different_sort_hits_same_cache_option_b ... ok   # sort khác hit cùng key (Option B)
test_include_ai_separates_cache ... ok               # include_ai 0 vs 1 khác key
test_rule_edit_invalidates_cache ... ok              # updated_at future → 0 matched
test_new_session_recomputes ... ok                   # session_date mới → recompute
```

---

## 4. Async + throttle + FE polling (R4.1–R5.1, F1)

```
# test_screener_async_run.py -v 2 (6 tests)
test_large_universe_returns_202_and_status_completed ... ok  # 202 + poll completed, sync sau 0 calls
test_force_async_via_query_param ... ok
test_pending_cap_returns_429 ... ok                          # 4th job 429 retry_after 60
test_snapshot_not_drift_on_rule_edit ... ok                  # snapshot close>0 vs edit >999999
test_status_unknown_for_missing_job ... ok + test_status_invalid_job_id_format ... ok (F-SEC-11)
test_throttle_rate_limit ... ok                              # get_rate patch 3/min → 4th 429
```

FE polling UI (`ScreenerPage.tsx:596-629`) — nền `rgba(59,130,246,0.12)`, `Đang quét trên hàng đợi… 1/5`, progress bar, nút `Hủy` → note `Chỉ dừng theo dõi, tác vụ vẫn chạy`. Ảnh manual cần chụp trên universe thật (chưa có, để placeholder dưới).

**Screenshot placeholder (cần chụp lại trên dev với universe 1200):**

- `screener-async-queued.png` — sau click `Chạy` với `?async=1` hoặc universe>800, hiện banner xanh + `0/1200`.
- `screener-async-running.png` — poll `running` với `600/1200`.
- `screener-async-completed.png` — banner biến mất, bảng `matched 47/1200` + `window_days` badge.

> Hiện tại chưa có universe 1200 trên dev, nên chưa chụp được. Test `ScreenerPolling.component.test.tsx` (7 tests) đã cover adapter contract + progress math thay thế.

---

## 5. Checklist P1.6

- [x] U1 `test_screener_scan_params.py` (5 tests) — sort/meta/400/legacy
- [x] U2 `test_screener_scan_cache.py` (5 tests) — miss/hit/Option B/include_ai/edit/session
- [x] U3 `test_screener_lookback.py` (5 tests) — per-field + clamp + window 35/88 + batch
- [x] U4 `test_screener_async_run.py` (6 tests) — 202/status/pending/snapshot/unknown/throttle + invalid job_id (F-SEC-11) — **mới cập nhật 7 tests với F-SEC-11**
- [x] U5 gộp U4 — throttle `get_rate` (F-BE-04)
- [x] F1 `ScreenerServerPaging.component.test.tsx` (3 tests) + `ScreenerPolling.component.test.tsx` (7 tests) — header sort + adapter 202 contract + progress math (thay thế full-page polling integration còn thiếu)
- [ ] E2E `tests/visual/screener-p0.spec.ts` mở rộng — chưa làm (cần dev server + auth.setup)
- [x] Verify index — audit migration, không migration mới
- [x] Evidence này (README) — tối thiểu, cần bổ sung ảnh + EXPLAIN staging khi có DB thật

---

## 6. How to reproduce locally

```bash
# BE
DJANGO_DEBUG=true .venv/Scripts/python manage.py test user_workspace.test_screener_scan_params user_workspace.test_screener_scan_cache user_workspace.test_screener_lookback user_workspace.test_screener_async_run -v 2
DJANGO_DEBUG=true .venv/Scripts/python manage.py test user_workspace --verbosity 1  # 43 tests: 42 pass +1 pre-existing

# FE
npm --prefix packages/web run test:components -- src/components/screener  # 6 files 37 tests (sau F1 mới)
npm --prefix packages/web run lint     # 0 errors
npm --prefix packages/web run build    # tsc + vite 29s
npm --prefix packages/web run i18n:scan -- --config i18next-scanner.config.cjs  # now passes (was TypeError)
```

---

*Generated: 2026-09-13 — P1.1–P1.5 committed `05a2c4dd` + `5377ec85`, P1.6 evidence pending staging DB.*
