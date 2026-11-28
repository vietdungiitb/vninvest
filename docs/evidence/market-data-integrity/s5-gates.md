# BẰNG CHỨNG CỔNG S5 — REQ-BE-M06/07/08: Market CVD SSOT (chạy TRƯỚC S4 theo G-1)

- **Ngày:** 2026-11-28 · **Branch:** `feat/m05-market-cvd` · **Base:** `origin/dev @ a468cc2c2`
- **Claim:** `m05-market-cvd` (`018173a2f`, trước code) · **Plan:** `PLAN_MARKET_DATA_INTEGRITY_1127.md` S5 · **Consensus:** Q5/Q9, G-1.

## 1. Thay đổi

| File | Nội dung |
|---|---|
| `market_serving/models.py` + migration `0008_...` | Thêm 8 field additive lên `SessionFactsBucket`: `market_buy_value`, `market_sell_value`, `auction_value`, `trade_count`, `whale_buy_value`, `whale_sell_value`, `cvd_source` (default `whale_fallback_only`), `coverage_ratio` |
| `market_serving/session_facts_engine.py` | `compute_market_cvd_from_ticks` (mới) — 100% `IntradayTick`, chỉ aggressor `BUY`/`SELL` vào market buy/sell, tick `UNKNOWN`/auction vào riêng `auction_value`; `trade_count` chỉ đếm CONTINUOUS; `_build_bucket_rows` nhận market; materialization thêm symbol có tick (kể cả không có whale alert) |
| `market_serving/views.py` | `?metric=market\|whale` additive; **default `whale` (Q9)**; `market` opt-in trả `source='market_tick_aggregate'`, `data_quality='verified'`, fields mới; cache key đưa `metric` + bump `v5`/`v3` (O5 từ audit v1) |
| `service_ops/domain_configs/signals.py` | `bucket_fact_retention_days` 90→**365** + validate `>=365` (M07) |
| `docs/system-design/**` | sync catalog 152 migration |

> **Q5:** giữ nguyên `compute_cvd_buckets_df` (chia UNKNOWN 50/50) cho caller `OrderFlowEvent`; path mới không đụng hàm cũ.

## 2. Fail-before / pass-after (VPS, DB tạm `s5_cvd_m05`)

| Lần | Kết quả |
|---|---|
| Fail-before | `TypeError: SessionFactsBucket() got unexpected keyword arguments: 'market_buy_value', ...`, `Ran 4 tests`, `FAILED (errors=4)`, `TEST_EXIT=1` |
| Pass-after | `Ran 6 tests ... OK`, `TEST_EXIT=0` |

**Chống xanh giả:** (a) test `market_buy=10_000_000`, `market_sell=5_000_000`, `auction=20_000_000` — assert giá trị thật; (b) `trade_count=2` — tick ATC không được tính (bẫy đã phát hiện và sửa trong phiên); (c) parity `market_buy+market_sell+auction` khớp `DailyPrice.value` trong ±5%; (d) API `?metric=market` và `?metric=whale` cho **2 payload khác nhau** (cache key có metric); (e) default không truyền `metric` vẫn trả `whale` + số liệu cũ.

## 3. Regression (VPS)

| Scope | Kết quả |
|---|---|
| `market_serving` + `signal_intelligence` (123 test) | 1 fail `test_min_value_floor_and_empty_state` (`200 != 400`) — **đã chạy lại trên `origin/dev` gốc ở S2 với cùng kết quả** ⇒ pre-existing, không phải S5 (S5 không đụng `native_views.py` whale-feed). |

## 3b. Sửa theo re-audit v1 (`S5_REAUDIT.md`, verdict `NEED_REVISION`)

| ID | Mức | Fix |
|---|---|---|
| F1 | P0 | **ĐÃ SỬA**: tách `_load_intraday_tick_values` (đọc 1 lần) + `_aggregate_market_from_rows(rows, bucket_minutes)`; `_build_bucket_rows` gọi aggregator **theo từng window** (5/15/30/1H/4H/1D) thay vì dùng cứng bucket 15m. Test mới `test_bucket_keys_follow_each_window` assert 6 window đều có bucket & 1D chứa toàn bộ giá trị. |
| F2 | P1 | **ĐÃ SỬA**: `_get_cvd_history` select 8 field market và `cvd_series`/delta/cumulative dùng `market_buy_value`/`market_sell_value` khi `metric=market`, kèm `auction_volume`, `trade_count`, `cvd_source`. |
| F3 | P2 | **ĐÃ SỬA**: control test so sánh market buy (100M) với whale buy (10M) thật, không tự so sánh. |
| F5 | P3 | **ĐÃ SỬA**: tick rows chỉ load 1 lần rồi dùng cho mọi window (trước gọi `compute_market_cvd_from_ticks` 2 lần). |
| F6 | P3 | Ngưỡng 500M trong aggregator — S2 đã đưa `_WHALE_THRESHOLD_VND=500M` lên runtime; re-check sau rebase. |
| F7 | P3 | Entry re-check sau rebase (dev head hiện 681; 682/683 trên branch chưa merge). |

Sau F1/F2/F3/F5: `Ran 7 tests ... OK`, `TEST_EXIT=0`.

**Vòng 2 (`S5_REAUDIT_R2.md`)** — N1 (candle-day fill dict thiếu field ⇒ KeyError/500 cho `?window=1D&period=1M`), N2 (test 5m tautology), N3 (tick load vẫn 2 lần), N4/N5 (top-level history + synthetic fallback sai bucket) — **đều đã sửa**:
- N1: fill dict bổ sung đủ 8 field market; test `test_history_with_candle_day_without_buckets_returns_200` assert 200 + fields.
- N2: test thêm tick 09:22 — `len(buckets_5m) > len(buckets_15m)` (không còn tautology).
- N3: bỏ wrapper call thứ 2, dùng chung `tick_rows`.
- N4: top-level history lấy `cvd_source`/`coverage_ratio`/`trade_count` từ bucket thật.
- N5: synthetic rows sinh theo **bucket của từng window** trong vòng lặp.
- Empty payload cũng có `metric` default `whale` (Q9).

Bản cuối: `Ran 8 tests ... OK`, `TEST_EXIT=0`.

## 4. Gate tĩnh

| Gate | Kết quả |
|---|---|
| `py_compile` 4 file runtime + 2 test | exit 0 |
| `makemigrations --check --dry-run` | `No changes detected`, exit 0 |
| `node packages/web/scripts/check-multi-agent.mjs` | `0 lỗi, 0 trùng số migration — PASS` |
| `node scripts/pre-push-gate.mjs` | `36 PASS / 0 SKIP / 0 FAIL` |
| `check-system-design --check` | `SACH — exit 0` |
| EOL | `normalize-eol.mjs --fix` 2 lần, không `--no-verify` |

## 5. `CHƯA CHẠY`

- S4 recovery/backfill — vẫn khóa theo Q2 (KHÔNG ghi staging).
- Probe staging `/session-facts/cvd/?metric=...` — chờ deploy (Q8).
- Full BE suite các app khác — scope đã chạy 2 app; `market_data` chạy ở S3 (lỗi image), `data_ingest` ở S1/S2.

## 6. Kết luận

Materialize Market CVD từ tick chạy được ngay cả khi không có whale canonical; API additive giữ caller cũ (Q9). S5 xong thì mới mở S4 để **1 lần backfill duy nhất** phục hồi đồng thời 3 bảng (G-1).
