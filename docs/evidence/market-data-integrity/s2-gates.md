# BẰNG CHỨNG CỔNG S2 — REQ-BE-M02 + M04 + Q6 + G-3b

- **Ngày:** 2026-11-28 · **Branch:** `feat/m02-auction-isolation` · **Base:** `origin/dev @ a570cb432`
- **Claim:** `m02-auction-isolation` (khai trước dòng code đầu tiên, commit `7cf7b46e4`) · **Plan/Consensus:** `docs/PLAN_MARKET_DATA_INTEGRITY_1127.md` S2 + `CONSENSUS_1127.md` G-3b.

## 1. Thay đổi

| File | Thay đổi |
|---|---|
| `packages/core/backend/src/market_data/session_phase.py` | **Mới** — SSOT `resolve_session_phase` + `normalize_tick_side`: match_type thật **và** fallback giờ ICT (09:00–09:14:59 ATO, 14:30:01–14:59:59 ATC); auction ⇒ `UNKNOWN` |
| `market_data/vnbroker_adapter.py` | 2 write-path (live `_normalize_intraday_trade_rows` `:149+`, backfill `fetch_intraday_tape_history` `:1103+`) dùng helper; lưu `session_phase`, side lowercase |
| `data_ingest/tasks.py` | `_normalize_intraday_trade_row` (`:338+`) dùng helper; fill `match_type` bằng phase khi provider trống |
| `market_serving/session_facts_engine.py` | `:144-146` bỏ side lạ khỏi **cả** `total` lẫn `whale`; `_WHALE_THRESHOLD_VND` `200M → 500M` |
| 2 file test mới | `market_data/tests/test_auction_isolation.py` (9 test) · `market_serving/tests/test_session_facts_total_denominator.py` (3 test) |

> **Không sửa** `signal_intelligence/tasks.py:281-282` — guard `UNKNOWN→sell` đã đúng từ `6e50418a9` (C-1). Không migration, không đụng staging ghi.

## 2. Fail-before / pass-after (VPS, DB tạm `s2_auction_m02`, dọn sau mỗi lần)

| Lần | Commit | Kết quả |
|---|---|---|
| **Fail-before** | `6a41a9863` (chỉ test) | `FAILED (failures=6)`, `TEST_EXIT=1`: backfill `'buy' != 'unknown'` · hydrate `'BUY' != 'UNKNOWN'` · live ATC fallback `'buy' != 'unknown'` · live ATO fallback `'sell' != 'unknown'` · M04 `62.727 != 50.0` · threshold `200000000 != 500000000`. 5 control xanh (ATC match_type, detect UNKNOWN, delta control, hydrate positive). |
| **Pass-after** | `d34f4acda` | `Ran 11 tests ... OK`, `TEST_EXIT=0` |

## 3. Regression (VPS, DB tạm, `--keepdb`)

| Scope | Branch | Kết quả |
|---|---|---|
| `market_serving` + `signal_intelligence` (120 test) | slice | 1 fail: `test_min_value_floor_and_empty_state` (`200 != 400`) — **chạy lại trên `origin/dev` cũng fail cùng giá trị** ⇒ pre-existing |
| `market_data` + `data_ingest` (376 test) | slice | 5 fail + 4 error (import price-integrity, cafef, whale full-tf) |
| 4 test tiêu biểu trong 5 fail/error đó | **`origin/dev` gốc** | **cùng 4 fail** (`'provider_side_from_tick' != 'truncated'`, `2 != 1`, `101756 != 1`) ⇒ pre-existing, không phải regression S2 |

## 4. Gate tĩnh

| Gate | Kết quả |
|---|---|
| `python -m py_compile` 4 file runtime + 2 test | exit 0 |
| `python manage.py makemigrations --check --dry-run` | `No changes detected`, exit 0 |
| `node packages/web/scripts/check-multi-agent.mjs` | `0 lỗi, 0 trùng số migration — PASS`, exit 0 |
| `node scripts/pre-push-gate.mjs` | `36 PASS / 0 SKIP / 0 FAIL`, exit 0 |
| EOL | 2 lần `normalize-eol.mjs --fix` (L-T01), fix đúng, **không** `--no-verify` |

## 4b. Reservation từ re-audit độc lập (`S2_REAUDIT.md`, verdict `AGREE`)

| ID | Mức | Xử lý |
|---|---|---|
| F-01 | TRUNG BÌNH | **ĐÃ SỬA** commit `5abcb5d1d`: naive timestamp giờ hiểu là giờ VN (không phải UTC) — khớp `normalizer.py:89-92`; thêm test control 14:45 naive → `ATC`/`UNKNOWN` |
| F-02 | TRUNG BÌNH | **ĐÃ SỬA** cùng commit: aggressor `BUY`/`SELL` chỉ trả khi `phase == CONTINUOUS`; `UNKNOWN` (nghỉ trưa/sau 15h) trả `UNKNOWN`; thêm test control 15:30 |
| F-03 | THẤP | **Nợ** — migration `market_serving/0007:8` vẫn 200M + mẫu số cũ; dữ liệu lịch sử không so sánh được với runtime. Không sửa trong S2 (0 migration) → ticket riêng |
| F-04 | THẤP | **ĐÃ GHI** — 4/9 fail được chạy lại trên `origin/dev`; nhãn scope `provider_side_from_tick` thuộc `native_views.py:479` (`market_serving`), không phải `market_data`; mọi fail đều pre-existing theo đối chiếu trực tiếp |
| F-06 | Protocol | S2 dùng **Entry 682** (678–680 bị chiếm; S1 dùng 681) |

Sau F-01/F-02: `Ran 13 tests ... OK`, `TEST_EXIT=0`.

## 5. `CHƯA CHẠY`

- Deploy staging / probe read-only `/whale-feed/`, `/session-facts/cvd/` — chờ PR + Q8.
- Full BE suite tất cả app — đã chạy 4 app liên quan; phần khác không chạy.
- `npx tsc --noEmit` riêng — pre-push-gate đã tự chạy tsc trong 36 gate.

## 6. Kết luận

Fail-before đỏ thật 6/6, pass-after xanh 11/11, regression không thêm lỗi mới (mọi fail đều tái hiện trên base). I-3 (0 whale buy/sell giờ ATC) được đảm bảo ở 3 write-path + detect layer; M04 sửa đúng mẫu số (`total` ô nhiễm chỉ vào buy/inst strength, `delta_strength` làm control); Q6 thống nhất 500M.
