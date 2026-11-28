# RE-AUDIT ĐỘC LẬP VÒNG 2 — S5 (2026-11-28)

- **Vai trò:** cùng auditor độc lập vòng 1, **không phải tác giả slice**; read-only, không sửa code.
- **Phạm vi:** fix commit `ec37ee5ff` ("F1 per-window market buckets + F2 history metric + F3 real control + F5 single tick load") trên branch `feat/m05-market-cvd`; đối chiếu verdict vòng 1 `docs/evidence/market-data-integrity/S5_REAUDIT.md`; plan REV.3 §S5 + `CONSENSUS_1127.md` (Q5/Q9/G-1) đọc từ worktree `mdi-plan-1127`.
- **Baseline:** HEAD `ec37ee5ff` (vòng 1 = `b44fd39f2`) · merge-base `a468cc2c2` · `origin/dev` hiện `3a46ddccf` (đã trôi thêm so với `98c9506742` lúc vòng 1). Ledger head `origin/dev` vẫn **Entry 681**.
- **Phương pháp:** đọc diff fix + code thật (`session_facts_engine.py`, `views.py`, 2 file test), 2 gate read-only tự chạy, 1 probe Python tách hàm thật bằng `ast` để đánh giá sức mạnh của test mới. **KHÔNG** chạy pytest/docker/build/deploy; **KHÔNG** ghi staging.

## Verdict

**NEED_REVISION (remaining)** — F1 (code) và F2 (phần lớn) đã sửa thật, F3 sửa thật. Nhưng fix F2 **sinh ra bug mới P1** (KeyError ⇒ HTTP 500 trên đường `?window=1D&period=...`), F5 **chưa được sửa** dù commit message khai đã sửa, và test mới của F1 là control yếu. Chưa đạt cổng ra B9; không merge PR khi chưa đóng N1.

| # | Mức | Nội dung còn lại |
|---|---|---|
| **N1** | **P1 (mới)** | `_get_cvd_history` fill bucket ngày có `DailyPrice` nhưng thiếu bucket bằng dict **7 khóa**, trong khi cvd_series đọc `auction_value`/`trade_count`/`cvd_source` **không điều kiện** ⇒ `KeyError` → 500 cho mọi `window=1D&period=...` có ngày fill (kể cả metric=whale mặc định). |
| **N2** | P2 | Test `test_bucket_keys_follow_each_window` không bắt được bug F1 cũ ở 5m/1h/4h/1D: nhánh `minutes >= 60` là tautology, fixture toàn tick khớp 15m. |
| **N3** | P3 | F5 chưa sửa: tick vẫn load **2 lần/symbol** (`session_facts_engine.py:464` và `:504` qua wrapper). |
| **N4** | P3 | History top-level `coverage_ratio: 0.0` / `trade_count: None` vẫn hardcode (`:541,544`) dù cvd_series đã có số thật; thiếu nhất quán với path chính. |
| **N5** | P3 | Synthetic fallback (không có whale) xây `rows` từ bucket **15m** rồi dùng cho mọi window ⇒ riêng `5m` undercount (xem F1b). |
| **N6** | P3 | Entry ledger chưa ghi; re-check sau rebase, không hardcode 684. |

## Trả lời F1..F7

### F1 (P0 vòng 1) — bucket cố định 15m: **CODE ĐÃ SỬA; TEST CHƯA ĐỦ (N2)**
- Cấu trúc mới đúng: `_load_intraday_tick_values` `session_facts_engine.py:345-355` load 1 lần; `_aggregate_market_from_rows(rows, bucket_minutes)` `:358-407` dùng `_floor_bucket(ts, bucket_minutes)` (`:381`); wrapper public `:410-418`.
- `_build_bucket_rows(rows, market, tick_rows)` `:247-299`: trong vòng lặp window `:265`, gọi `_aggregate_market_from_rows(tick_rows, bucket_minutes)` (`:267`) và **gán lại** `market_buckets` (`:268`); tra cứu `market_key = _floor_bucket(bucket_ts, bucket_minutes)` (`:279`) với **cùng `bucket_minutes`** ⇒ khóa khớp. Probe tách hàm thật cho: `5m→09:15/14:45`, `30m→09:00/14:30`, `1h→09:00/14:00`, `4h→08:00/12:00`, `1D→00:00` — không còn miss như vòng 1. **F1 lõi ĐÃ ĐÓNG.**
- **N2 — test yếu:** `test_market_cvd_ssot.py:63` `bucket_ts.minute % minutes == (0 if minutes < 60 else bucket_ts.minute)`. Với `minutes >= 60` vế phải chính là `bucket_ts.minute` ⇒ **tautology** (đúng cả với `1440`); vòng 1 đã hỏi "1440 % 1440 = 0 luôn" — tác giả tránh được phép chia nhưng thay bằng phép so sánh chính nó. Với `minutes=5`, khóa 15m (`15 % 5 == 0`) **vẫn đạt** dù code cũ cố định 15m. Fixture chỉ có tick ở `09:15, 09:16, 14:45` (`test_market_cvd_ssot.py:23-33`) ⇒ aggregate 5m và 15m **trả cùng khóa**, test không thể phân biệt. Probe mô phỏng 15m keys qua assertion: `5m PASS`, `60m/240m/1440m PASS(tautology)`, chỉ `30m FAIL`. Hai assert giá trị `:66-67` đọc **total** (`market_buy_value`, `auction_value`) vốn độc lập granularity ⇒ cũng không bắt được lỗi khóa. Kết luận: test chỉ bảo vệ được 30m.
- **F1b (N5):** khi `rows` rỗng, `rows` synthetic được xây **một lần** từ `market_buckets` 15m tại `:256-264` rồi tái dùng cho mọi window (`:270`). Ở `5m`, cvd_series chỉ có bucket ở ranh giới 15m, market lookup lấy đúng **1 sub-bucket 5m** thay vì 15m ⇒ undercount. Các window ≥15m floor gọn vào khóa window nên không sao. Đây là phần sót lại của F1, mức thấp vì path không-whale là đúng trường hợp S5 hướng tới.

### F2 (P1 vòng 1) — history bỏ qua metric: **SỬA ĐƯỢC PHẦN LỚN, NHƯNG SINH BUG MỚI (N1)**
- `by_date` giờ select đủ 6 field mới: `views.py:454-459`. `delta` (`:526-529`), `cumulative` (`:511-516`) và `cvd_series` (`:552-560`) đều switch theo `self._metric`; series có `auction_volume`, `trade_count`, `cvd_source`. Top-level `metric/source/data_quality/cvd_source` nhất quán (`:537-540`). Với dữ liệu thật (mọi bucket đều có field mới) đường `?window=1D&period=1M&metric=market` **nhất quán** — F2 lõi ĐÃ ĐÓNG.
- **N1 (mới, P1):** nhánh fill candle `views.py:486-500` tạo bucket giả với đúng 7 khóa (`session_date`, `bucket_ts`, `buy_volume`, `sell_volume`, `buy_strength`, `institutional_strength`, `pk`). Các dòng `:554` (`b['auction_value']`), `:559` (`b['trade_count']`), `:560` (`b['cvd_source']`) đọc **không điều kiện** ⇒ `KeyError` ngay cả với `metric=whale` mặc định; `:527/:552` còn đọc `market_buy_value/market_sell_value` khi `metric=market`. `_cvd_history_candle_dates` (`:65-72`) trả **mọi** `DailyPrice` trong khoảng, nên chỉ cần 1 ngày có candle mà thiếu bucket `1D` là endpoint 500 — vi phạm cả Q9 "legacy không vỡ". Cách sửa: bổ sung đủ 6 khóa mới vào dict fill `:490-500` (giá trị 0/`'whale_fallback_only'`) hoặc dùng helper tạo bucket rỗng chung.
- **self._metric unset:** kiểm tra lại — set tại `views.py:602` (`get`), mọi lần đọc `:424,512-540,552-560,640,676-699` đều nằm sau đó; `_get_cvd_history` chỉ gọi từ `get` (`:616/:618`). **Không có path nào đọc trước khi set** — ĐẠT.
- **N4:** top-level `:541 coverage_ratio: 0.0` và `:544 trade_count: None` vẫn hardcode, trong khi series `:559` có `trade_count` thật. Path chính lấy từ `bucket_rows[0]` (`:689/:693`). Nên mirror cùng nguồn.

### F3 (P2) — control tự so sánh: **ĐÃ SỬA THẬT**
`test_session_facts_api.py:63-66` giờ gọi riêng `?metric=whale` và assert `first['buy_volume'] (100M) > whale['cvd_series'][0]['buy_volume'] (10M)`. Control có nghĩa, giá trị thật, không tự so sánh. Đạt.

### F4 (P2) — thiếu test materialization đa window: **CHƯA ĐÓNG**
Test mới `test_bucket_keys_follow_each_window` gọi trực tiếp `_aggregate_market_from_rows`, **không đi qua `_build_bucket_rows`** ⇒ không kiểm tra được khâu tra cứu (chính là chỗ F1 xảy ra). `test_materialization_writes_new_fields` `:69-76` vẫn chỉ assert `cvd_source` + `trade_count>0`. Đây là lý do N2/N5 lọt. Đề xuất: test chạy `compute_session_facts_for_all_active` với tick trải nhiều sub-bucket (vd 09:07/09:22/14:37) rồi đọc lại `SessionFactsBucket` cho cả 6 window, assert `sum(market_buy_value)` bằng nhau giữa các window.

### F5 (P3) — load tick 2 lần: **CHƯA SỬA (dù commit message khai đã sửa)**
`session_facts_engine.py:464` load `tick_rows` 1 lần; nhưng `:504` vẫn gọi `compute_market_cvd_from_ticks(symbol, target_date)` — wrapper `:416-418` lại gọi `_load_intraday_tick_values` lần 2. Biến `market` ở `:465` bị ghi đè bằng giá trị 15m **giống hệt** ⇒ hoàn toàn thừa. Sửa bằng cách dùng lại `market` từ `:465` và bỏ dòng `:504`.

### F6 (P3) — ngưỡng 500M hardcode / S2 chưa merge: **GIỮ NGUYÊN**
`_aggregate_market_from_rows:385` vẫn hardcode `500_000_000` trong khi hằng `:54` = 200M; `origin/dev` engine vẫn 200M ⇒ S2 chưa merge. Reservation mang sang vòng sau, không phải blocker S5.

### F7 (P3) — Entry ledger: **CHƯA GHI, ĐÚNG QUY TRÌNH**
`git show origin/dev:docs/CODE_CHANGE_AUDIT_LEDGER.md` head = **Entry 681** (không có 682/683/684 trên `origin/dev`); diff S5 không append Entry; claim ghi "cập nhật sau rebase". Gợi ý "684" trong đề bài **không còn đúng** (`origin/dev` giờ `3a46ddccf`). Phải re-check số kế tiếp lúc merge.

## Findings mới

| ID | Mức | file:line | Thực tế | Tác động | Đề xuất |
|---|---|---|---|---|---|
| **N1** | **P1** | `views.py:486-500` vs `:554,559,560,527,552` | Bucket fill cho ngày có `DailyPrice` thiếu 6 khóa mới; cvd_series đọc 3 khóa **unconditional** | `?window=1D&period=1M` → `KeyError`, HTTP 500 cả metric mặc định `whale`; vỡ Q9 | Điền đủ khóa mới vào dict fill `:490-500` |
| **N2** | P2 | `test_market_cvd_ssot.py:59-67` | `minutes>=60` tautology; 5m không phân biệt được 15m; fixture chỉ tick 15m-aligned | F1 có thể tái phát mà test vẫn xanh | Assert `len(buckets_5m) > len(buckets_15m)` với fixture tick trải sub-bucket; assert 1D bucket `hour==0` chứ không so `minute` |
| **N3/N5** | P3 | `session_facts_engine.py:504`, `:256-264` | Tick load lần 2; synthetic rows lấy từ 15m cho mọi window | Hiệu năng backfill S4; 5m no-whale undercount | Dùng `market` từ `:465`; xây synthetic `rows` riêng theo `window_market` |
| **N4** | P3 | `views.py:541,544` | `coverage_ratio=0.0`, `trade_count=None` hardcode | Top-level history không khớp series/khác path chính | Mirror `bucket_rows[0]` như `:689/:693` |
| **N6** | P3 | `docs/CLAIMS.md` (claim S5) | Entry chưa ghi, head `origin/dev` 681 | Sai số nếu hardcode | Re-check sau rebase |

**Không có thay đổi denying:** diff vẫn 13 file, không file deny-list, không script deploy/staging; migration `0008` dependency `0007` nguyên vẹn; system-design vẫn đồng bộ 152 migration.

## Cổng đã chạy / CHƯA CHẠY

| Cổng | Kết quả auditor tự chạy |
|---|---|
| `git status --short` / `git log` | Branch `feat/m05-market-cvd`, HEAD `ec37ee5ff`; chỉ `?? docs/evidence/market-data-integrity/` (evidence vòng 1 + file này). Không code/migration chưa commit. |
| `git diff origin/dev...HEAD --name-only` | 13 file, đúng scope; 0 file deny-list. |
| `git merge-base origin/dev HEAD` | `a468cc2c2`; `origin/dev = 3a46ddccf` (trôi thêm từ `98c9506742`). |
| `node packages/web/scripts/check-multi-agent.mjs` | **exit 0** — `0 lỗi, 0 trùng số migration — PASS` (kèm warning claim stale, không chặn). |
| `node docs/system-design/_meta/tools/check-system-design.mjs --check` | **exit 0** — `SACH — exit 0` (44 file/220 citation/1438 route/122 model khớp). |
| Probe `ast` (read-only) | Chạy được; chứng minh assertion yếu của test mới (5m/60m/240m/1440m đạt dù khóa 15m). |
| pytest / fail-before / regression / `makemigrations --check` / `py_compile` / `pre-push-gate` | **CHƯA CHẠY** (theo lệnh audit); đọc evidence `s5-gates.md` nhưng **không tin PASS của tác giả thay cho tự chạy**. Đặc biệt N1 là lỗi runtime mà unit test hiện tại **không phủ**, nên không thể khẳng định đã xanh. |
| Probe staging `/session-facts/cvd/?window=1D&period=1M` | **CHƯA CHẠY** — cần để xác nhận N1 trên dữ liệu thật. |

## Kết luận (B9 readiness + Entry)

- **B9 readiness: CHƯA.** Vòng 2 đã đóng đúng F1-lõi (per-window bucketing), F2-lõi (history metric-aware) và F3 (control thật) — ghi nhận rõ ràng. Nhưng fix F2 mang theo **N1 (P1)**: đường 1D history trả 500 khi có ngày `DailyPrice` thiếu bucket, tức chính payload mà slice này tuyên bố hỗ trợ; và F5 vẫn chưa sửa dù commit message khai đã sửa (sự không khớp giữa tuyên bố và code cần được sửa trước khi báo PASS).
- **Cổng ra tối thiểu để xét AGREE:** sửa N1 + thêm test history `window=1D&period=1M` có fixture candle-day thiếu bucket (phải assert 200, không phải 500) cho cả 2 metric; sửa N3 (bỏ load tick thứ 2); củng cố N2 (assert số bucket 5m > 15m); sau đó rebase `origin/dev` → chạy lại **toàn bộ** pytest/makemigrations/pre-push → re-audit vòng 3.
- **Entry:** auditor read-only, **không tự ghi**. Re-check head ledger trên `origin/dev` lúc merge (hiện 681, `origin/dev = 3a46ddccf`); không dùng số cứng 684.
- Verdict này là evidence B8 vòng 2; chuyển coordinator quyết định chặn/cho sửa tiếp PR. Giới hạn 3 vòng sửa của plan: vòng 1 `NEED_REVISION` → vòng 2 `NEED_REVISION`; vòng 3 là vòng cuối.
