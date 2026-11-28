# RE-AUDIT ĐỘC LẬP — S5 / REQ-BE-M06/07/08 (2026-11-28)

- **Vai trò:** kiểm toán viên độc lập (Staff+), **không phải tác giả slice**; read-only, không sửa code.
- **Phạm vi:** `docs/PLAN_MARKET_DATA_INTEGRITY_1127.md` REV.3 §S5 + `docs/evidence/market-data-integrity/CONSENSUS_1127.md` (Q5/Q9/G-1) — đọc từ worktree `D:\Mujoco Projects\wt\mdi-plan-1127`; evidence `s5-gates.md`; `git diff origin/dev...HEAD`; code thật trong `market_serving` + `service_ops`.
- **Baseline:** worktree `D:\Mujoco Projects\wt\m05-market-cvd` · branch `feat/m05-market-cvd` · HEAD `b44fd39f2` · base/merge-base `origin/dev @ a468cc2c2`. `origin/dev` hiện đã trôi tới `98c9506742` (ledger head **Entry 681**).
- **Phương pháp:** đọc diff + 8 file thật + 4 file doc, đối chiếu plan↔code có mục CONTRADICTIONS; chạy 2 gate read-only (`check-multi-agent`, `check-system-design --check`); 1 probe Python **tách hàm `_floor_bucket` thật từ source** bằng `ast` để chứng minh lệch khóa bucket (lệnh tái tạo ở §Findings F1). **KHÔNG** chạy pytest / docker / build / deploy, **KHÔNG** ghi staging.

## Verdict

**NEED_REVISION** — 2 blocker correctness (R1, R2) nằm đúng trong "high-risk area" mà yêu cầu audit chỉ định, cộng 3 reservation (R3–R5). Chưa đạt cổng ra B9; **không nên merge PR** khi R1/R2 chưa sửa và chưa có test bắt được chúng.

| # | Mức | Nội dung bắt sửa |
|---|---|---|
| **R1** | P0 | Sai lệch granularity khóa bucket: market/whale/auction/trade_count gắn vào bucket bị **zero hoặc undercount** ở mọi window trừ `15m` (chi tiết F1). |
| **R2** | P1 | Đường history (`_get_cvd_history`) **không truyền metric vào cvd_series**: `?metric=market&period=...` vẫn trả buy/sell của whale + `trade_count: None` (F2). |
| **R3** | P2 | Assertion so sánh chính nó trong test API — control "market ≥ whale" là xanh giả (F3). |
| **R4** | P2 | Không có test nào đi qua `_build_bucket_rows` đa window; fail-before chỉ là TypeError/KeyError ở mức field (F4). |
| **R5** | P3 | Entry ledger chưa ghi; phải **re-check số sau rebase**, không hardcode 684 (F7). |

## Kiểm chứng từng REQ (file:line)

### Q5 — giữ hàm cũ, path mới không đẩy UNKNOWN vào buy/sell: **ĐẠT**
- `compute_cvd_buckets_df` nằm ở `packages/core/backend/src/signal_intelligence/order_flow_engine.py:119`, được `order_flow_engine.py:203` và `signal_intelligence/tasks.py:131,438` gọi. **Không nằm trong danh sách 13 file của `git diff origin/dev...HEAD`** ⇒ nguyên vẹn.
- Path mới `session_facts_engine.py:372-390`: `side in ('BUY','SELL')` mới cộng vào `market_buy_value`/`market_sell_value` (`:380`); mọi side khác (UNKNOWN/auction) đi riêng vào `auction_value` (`:388-390`). `trade_count` chỉ tăng nhánh aggressor (`:386`), ATC bị loại — đúng bẫy đã sửa trong phiên (gates `:25`).
- Parity: `session_facts_engine.py:392-402` trả tổng `buy+sell+auction`; test `test_market_cvd_ssot.py:48-52` assert ≤5% so với `DailyPrice.value` — giá trị thật 10M+5M+20M = 35M = `100000×350`. **Đạt, có số thật.**

### M06 — Market CVD từ 100% IntradayTick: **CHƯA ĐẠT (R1)**
- Nguồn đúng: `compute_market_cvd_from_ticks` `session_facts_engine.py:335-403` query `IntradayTick` (`:354-358`), 100% tick trong ngày; symbol union cả whale lẫn tick tại `:431-439` ⇒ materialize được symbol không có whale alert. Fallback khi `rows` rỗng `:455-469` tạo `SessionFacts` từ market totals — hướng đúng.
- **Synthetic `rows` fallback `:250-257` — kiểm tra kỹ list comprehension: KHÔNG double-count, KHÔNG mislabel.** Với `B=market_buy_value`, `S=market_sell_value`: phần tử `(B)` → `side='buy'`, `matched_value=B`; phần tử `(-S)` → `side='sell'`, `matched_value=S`; `auction_value` không đưa vào aggressor. Đúng. (Chỉ có góc cosmetic: `value==0` cũng rơi nhánh `'sell'` nhưng `matched_value=0` nên vô hại.)
- **Lỗi nằm ở khóa tra cứu:** `compute_market_cvd_from_ticks` luôn gọi `_floor_bucket(ts, bucket_minutes)` với **default 15 phút** (`:338`, `:377`) ⇒ `market['buckets']` chỉ có khóa 15m. `_build_bucket_rows` lại tra `market_key = _floor_bucket(bucket_ts, bucket_minutes)` với `bucket_minutes` **theo từng window** `5/15/30/60/240/1440` (`:56-63`, `:258`, `:269-270`) rồi gán `market_*` vào `bucket_row` (`:280-285`). Hai bộ khóa không cùng granularity.

### M08 — additive API, default whale (Q9), cache v5/v3: **CHƯA ĐẠT (R2)**
- Parse metric + guard `market|whale` tại `views.py:580-586`; `self._metric` **được gán ở `:586` trước mọi lần đọc**: `_get_cvd_history` (`:424,526-529`) chỉ gọi từ `get` tại `:600/602`, còn path chính đọc tại `:624,660-687`. **Không có chỗ nào đọc `self._metric` trước khi set** — yêu cầu kiểm tra này ĐẠT.
- Cache key: history `core:cvd_series:v5:{...}:{self._metric}:...` (`:423-426`), single-session `core:cvd_series:v3:{...}:{bucket_minutes}:{self._metric}:...` (`:622-625`) — bump đúng `v4→v5`, `v2→v3`, có metric. Legacy không truyền metric → `whale` (Q9) và vẫn trả `buy_volume=sell_volume` cũ (`:674-684` nhánh else); shape top-level giữ nguyên + thêm field (additive).
- Top-level market fields có ở **cả 2 path** (`:526-530`, `:660-667`); cvd_series market fields có ở **path chính** (`:674-687`) nhưng **thiếu ở history** (`:541-544`).

### M07 — retention 365 + validation: **ĐẠT**
- `service_ops/domain_configs/signals.py:36` `bucket_fact_retention_days: int = 365` (từ 90); validate `:59-60` `if < 365: errors.append(...)`. Khớp canonical 365 (`:35`).

### Protocol: phần lớn ĐẠT, 1 reservation (R5)
- Claim `m05-market-cvd` khai ở `docs/CLAIMS.md` (commit `018173a2f`) **trước** test/code (`a95fe7e89`, `3d38e9a41`) — đúng L-002. Tên agent = tên branch bỏ tiền tố `feat/` — khớp.
- Migration `0008_sessionfactsbucket_auction_value_and_more.py:9` dependency `0007_sessionfactsbucket_strength_fields` — đúng head, không tự đặt số, 8 AddField additive/default an toàn (`:12-53`); `makemigrations --check` theo gates `:38` = `No changes detected`.
- System-design sync **trung thực**: `01.01:17` 151→152 migration; `06.02` tổng 151→152 + `market_serving 7→8 migration` + 8 field mới; `claims.json` C-003 expected 151→152; `check-system-design --check` tự chạy = **SACH, exit 0**.
- Không đụng 10 file deny-list: diff chỉ 13 file, không có `package.json`/`package-lock`/`docker-compose*`/`.env*`/`requirements.txt`/`AGENTS.md`. Không có script deploy/staging trong diff; gates `:46` ghi rõ S4 khóa, không ghi staging (phần này **CHƯA XÁC MINH trên VPS** — auditor không SSH).
- Ledger: **không có Entry mới trong diff**; claim ghi "Entry cập nhật sau rebase" — xem R5.

## Chống xanh giả

| Kiểm tra | Kết luận |
|---|---|
| Test assert số thật (`10M/5M/20M`, `trade_count=2`, parity ±5%) — `test_market_cvd_ssot.py:39-52` | Có, giá trị thật — **nhưng chỉ ở mức hàm `compute_market_cvd_from_ticks` default 15m**, không chạm materialization đa window. |
| API 2 metric cho 2 payload khác nhau — `test_session_facts_api.py:65-69` | Control thật: nếu cache key không có metric thì GET thứ 2 trả payload cache của GET thứ 1 ⇒ assert đỏ. Đạt. |
| Default whale giữ shape cũ — `test_session_facts_api.py:46-50` | Có. Positive control Q9present. |
| `market ≥ whale` — `test_session_facts_api.py:63` | **XANH GIẢ**: `first['buy_volume']` so với chính `payload['cvd_series'][0]['buy_volume']` (cùng một đối tượng). Xem F3. |
| Regression 1 fail `test_min_value_floor_and_empty_state` (`200!=400`) — gates `:31` | Đã đối chiếu S2 trên `origin/dev` gốc (theo evidence); scope S5 không đụng `native_views.py` ⇒ chấp nhận pre-existing. Auditor **không tự chạy lại pytest** ⇒ `CHƯA TỰ XÁC MINH`. |
| Fail-before `TypeError` (gates `:22`) | Yếu (chỉ thiếu field), đúng như R4; behavior-level chỉ có ở test unit path 15m. |

## Findings (ID | mức | file:line | thực tế | tác động | đề xuất)

| ID | Mức | file:line | Thực tế | Tác động | Đề xuất |
|---|---|---|---|---|---|
| **F1** | **P0** | `session_facts_engine.py:338,377` vs `:56-63,269-285` | Market bucket sinh ở **15m**, tra cứu ở **5/30/60/240/1440m**. Probe tách hàm `_floor_bucket` thật (`ast`, lệnh: `python <temp>/s5_floor_probe.py`) cho: `5m 09:07→09:05 MISS`; `15m 09:07→09:00 HIT`; `30m/1h` HIT nhưng chỉ lấy **1 bucket 15m** (undercount 2×/4×); `4h→08:00` HIT nhưng cũng 1 bucket; `1D→00:00 MISS` (không có tick nửa đêm) ⇒ `market_*` = 0 cả ngày. | M06 bị vô hiệu ở mọi window trừ 15m: `?metric=market&window=1h/4h/1D` trả buy/sell/auction/trade_count **sai hoặc bằng 0** dù `DailyPrice` parity ở mức aggregate đúng. Bucket lưu DB sai ⇒ S4 backfill sau này cũng thừa kế dữ liệu sai. | Sinh market buckets **theo từng window** (gọi `compute_market_cvd_from_ticks(symbol, date, bucket_minutes=minutes)` trong vòng lặp `:258`, hoặc aggregate từ bucket 15m lên đúng cửa sổ), rồi tra bằng đúng khóa đã sinh. Thêm test materialization assert market totals **bằng nhau** qua `5m/15m/30m/1h/4h/1D` cho cùng 1 ngày tick. |
| **F2** | **P1** | `views.py:447-457,533-547` (so `:674-687`) | `_get_cvd_history` dựng `by_date` chỉ với `buy_volume/sell_volume/buy_strength/institutional_strength/pk`; `cvd_series` luôn dùng `b['buy_volume']`/`b['sell_volume']` (whale) và hardcode `trade_count: None`, không có `auction_volume`/`cvd_source` — **bất kể `self._metric`**. Top-level thì lại báo `metric=market`, `source=market_tick_aggregate`, `data_quality=verified` (`:526-530`). | `GET ?window=1D&period=1M&metric=market` trả payload **tự mâu thuẫn**: nhãn market nhưng số liệu whale; widget cutover (Q9) sẽ vẽ nhầm. Không test nào phủ path có `period`. | Đưa `market_buy_value/market_sell_value/auction_value/trade_count/cvd_source/coverage_ratio` vào `by_date` (`:449`) và switch cvd_series theo `self._metric` y hệt path chính; thay `trade_count: None` bằng giá trị thực. Thêm test history `metric=market` vs `whale` cho 2 payload khác nhau. |
| **F3** | P2 | `test_session_facts_api.py:63` | `assertGreaterEqual(first['buy_volume'], payload['cvd_series'][0]['buy_volume'])` — hai vế là **cùng một giá trị**; assertion luôn đúng. Gates `:25` mô tả đây là control "market ≥ whale". | Mất positive control; nếu market < whale vẫn xanh. | Đổi vế phải thành payload của request `metric=whale` (gọi riêng tại test này), hoặc dùng `whale['cvd_series'][0]['buy_volume']`. |
| **F4** | P2 | `test_market_cvd_ssot.py:54-61`; `test_session_facts_api.py:33-44` | Test materialization chỉ assert `cvd_source` + `trade_count>0` (không assert số market_bucket); test API **tự tạo row DB** với `market_buy_value=100M` sẵn ⇒ path đọc `bucket_row[...]` luôn đúng dù `_build_bucket_rows` gán sai. | F1/F2 lọt qua 6 test xanh — đúng dạng "test chỉ đọc DB row, không exercise materialization" đã từng trả giá ở slice trước. | Thêm test chạy `compute_session_facts_for_all_active` với fixture tick thực rồi đọc lại `SessionFactsBucket` cho **mọi window**; giữ test API hiện tại làm regression path đọc. |
| **F5** | P3 | `session_facts_engine.py:449` **và** `:488` | `compute_market_cvd_from_ticks(symbol, target_date)` bị gọi **2 lần/symbol** (lần 2 ghi đè biến `market`). | Query `IntradayTick` nhân đôi cho mỗi symbol — tốn DB đúng đường nóng backfill S4. | Tính 1 lần rồi tái dùng; nếu cần tách do fallback, đặt tên biến rõ ràng. |
| **F6** | P3 | `session_facts_engine.py:381` vs `:54` | Ngưỡng whale `500_000_000` bị **hardcode** trong path mới, trong khi `_WHALE_THRESHOLD_VND = 200_000_000` vẫn là hằng dùng ở `_compute_session_facts_from_rows:145`. Q6 (đổi 500M) **chưa có trên `origin/dev`** (`git show origin/dev:...engine.py` vẫn 200M) ⇒ S2 chưa merge vào base này. Ngoài ra field `whale_*` ở đây là tick ≥500M, không phải `WhaleAlertCanonical` — khác ngữ nghĩa với tên field. | Hai nguồn ngưỡng có thể trôi; auction isolation của S5 phụ thuộc S2 đưa `side='UNKNOWN'` ở write-path — test `test_market_cvd_ssot.py:29-32` tự gán UNKNOWN nên **không chứng minh integration**. | Dùng `self` hằng đã unify sau khi S2 merge (rebase → re-verify L-003); nếu giữ ngưỡng riêng thì ghi rõ docstring `whale_*` = "tick-equivalent ≥500M, không phải whale alert". |
| **F7** | P3 (protocol) | `docs/CLAIMS.md` dòng claim S5; `git show origin/dev:docs/CODE_CHANGE_AUDIT_LEDGER.md` | Ledger head trên `origin/dev` = **Entry 681**; không có Entry 682/683/684 trên `origin/dev`; diff S5 **không append Entry**. Claim ghi "Entry cập nhật sau rebase". | Prompt gợi ý "684 nếu S0–S3 đã merge" — **không đúng tại thời điểm audit**: S2 (MDI) chưa merge (threshold vẫn 200M). Hardcode 684 có thể trùng号 sau rebase. | Sau `agent-sync.ps1` rebase, đọc lại head ledger rồi prepend Entry **số kế tiếp thực tế** (hiện là 682, nhưng phải re-check ngày merge); không dùng số cứng. |

## Cổng đã chạy / CHƯA CHẠY

| Cổng | Kết quả (auditor tự chạy) |
|---|---|
| `git status --short` / `git rev-parse --abbrev-ref HEAD` | `feat/m05-market-cvd`; chỉ `?? docs/evidence/market-data-integrity/` (file evidence của tác giả + file re-audit này) — **không có code/migration chưa commit**. |
| `git diff origin/dev...HEAD --name-only` | 13 file, đúng scope; không file deny-list. |
| `git merge-base origin/dev HEAD` | `a468cc2c2` — xác nhận base như đề bài; `origin/dev` đã trôi `98c9506742`. |
| `node packages/web/scripts/check-multi-agent.mjs` | **exit 0** — `0 lỗi, 0 trùng số migration — PASS` (kèm ~130 dòng warning claim stale, không chặn). |
| `node docs/system-design/_meta/tools/check-system-design.mjs --check` | **exit 0** — `check-system-design --check: SACH — exit 0` (44 file/220 citation/1438 route/122 model khớp). |
| Probe `_floor_bucket` (ast, read-only) | Chạy được; output như F1 — **bằng chứng trực tiếp từ source**, không suy luận. |
| `pytest` BE / fail-before / regression 123 test | **CHƯA CHẠY** (theo lệnh audit: cấm; chỉ đọc evidence `s5-gates.md:18-32`). |
| `makemigrations --check --dry-run` / `py_compile` / `pre-push-gate` | **CHƯA TỰ CHẠY** — chỉ đọc kết quả tác giả ghi ở `s5-gates.md:37-42`; không tin `PASS` của người khác thay cho tự chạy. |
| Probe staging `/session-facts/cvd/?metric=` | **CHƯA CHẠY** — chờ deploy (Q8); không SSH VPS. |
| Ghi/xóa staging (S4) | **KHÔNG** — đúng Q2=KHÔNG; không có script deploy trong diff. |

## Kết luận (B9 readiness + Entry)

- **B9 readiness: CHƯA SẴN SÀNG.** `NEED_REVISION` với 2 blocker: F1 (P0 — sai số liệu market CVD ở 5/30m/1h/4h/1D) và F2 (P1 — history path trả nhãn market nhưng số whale). Đây không phải reservations mang tính thủ tục — chúng làm sai đúng REQ-BE-M06/M08 mà slice này tuyên bố đóng, và **bị test xanh giả che phủ** (F3/F4).
- Thứ tự xử lý đề xuất: sửa F1 → thêm test đa-window bắt đỏ trước khi sửa; sửa F2 + test history; sửa F3/F4; rebase `origin/dev` (kéo S2 nếu đã merge) → chạy lại **mọi** gate pytest/makemigrations/pre-push → **re-audit vòng 2** mới xét `AGREE`.
- Phần đạt được ghi nhận rõ ràng: Q5 giữ nguyên `compute_cvd_buckets_df`; Q9 default `whale` + cache `v5/v3` có metric; M07 `365` + validate; migration additive `0007→0008`; system-design sync trung thực; protocol claim/branch/deny-list sạch; 2 gate read-only PASS.
- **Entry:** chưa có Entry S5 trong ledger; **KHÔNG** tự ghi 684 trong re-audit này (auditor read-only). Sau rebase, tác giả/coordinator re-check head `origin/dev` rồi prepend Entry kế tiếp (xem F7). File verdict này là evidence B8 của riêng auditor; bàn giao cho coordinator quyết định merge/chặn PR.
