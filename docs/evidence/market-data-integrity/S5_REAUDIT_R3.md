# RE-AUDIT ĐỘC LẬP VÒNG 3 (FINAL) — S5 (2026-11-28)

- **Vai trò:** cùng auditor độc lập vòng 1 & 2, **không phải tác giả slice**; read-only, **không sửa code**.
- **Phạm vi:** 3 commit fix vòng 3 (`132d8cff5` N1/N2/N3/N4/N5 · `0b81b5438` empty-payload metric + fixture 5m · `5f04afcf5` thêm bucket `1D` vào fixture API), đối chiếu verdict vòng 2 (`S5_REAUDIT_R2.md`) và plan REV.3 §S5 + `CONSENSUS_1127.md` (Q5/Q9/G-1).
- **Baseline:** HEAD `5f04afcf5` · branch `feat/m05-market-cvd` · merge-base `a468cc2c2` · `origin/dev = 4198b6a17` (trôi thêm từ `3a46ddccf` ở vòng 2). Ledger head `origin/dev` giờ **Entry 682** (vòng 2 là 681).
- **Phương pháp:** đọc diff 3 commit + code thật, probe Python tách hàm thật bằng `ast` để kiểm tra assertion mới, 2 gate read-only tự chạy. **KHÔNG** chạy pytest/docker/build/deploy, **KHÔNG** ghi staging. Đây là **vòng cuối** theo limit 3 vòng của plan.

## Verdict

**AGREE (với reservation)** — Mọi blocker P0/P1 của vòng 1 (F1, F2) và vòng 2 (N1) đã được đóng **bằng code inspection**, không còn P0/P1 mới. Cổng ra B4→B5 đạt ở mức re-audit tĩnh. Reservation mang sang B9 gồm: test N1 vẫn xanh giả (P2 — sửa fixture), empty-payload metric hardcode (P3), Entry/rebase chưa làm, và pytest/makemigrations/probe staging **CHƯA CHẠY** bởi auditor.

## Trả lời N1..N5 + F1/F2 vòng 1

### N1 (P1 vòng 2) — candle-day fill KeyError/500: **ĐÃ SỬA THẬT**
Kiểm tra **mọi** nguồn cấp `by_date` và mọi field đọc ở cvd_series:

| Nguồn bucket | File:line | 6 field mới |
|---|---|---|
| DB thật (`select_related`) | `views.py:450-464` | `market_buy_value` `:455`, `market_sell_value` `:456`, `auction_value` `:457`, `trade_count` `:458`, `cvd_source` `:459`, `coverage_ratio` `:460` — đủ |
| Fill candle-day (`DailyPrice`) | `views.py:491-507` | `:498-503` — đủ, giá trị 0 / `'whale_fallback_only'` |
| Cache-hit | `views.py:434` | payload do chính 2 nhánh trên sinh ra — kế thừa đủ |

Field đọc ở cvd_series `views.py:562-570` (`market_buy_value`, `market_sell_value`, `auction_value`, `trade_count`, `cvd_source`) đều có mặt trong **cả 2** dict shape; top-level dùng `.get(..., default)` an toàn (`:547-554`). **Không còn KeyError path.** Với `?window=1D&period=1M&metric=market`: `delta` `:533-536`, `cumulative` `:518-523`, `cvd_series.buy/sell/delta` `:562-567` cùng đọc cặp `market_*`; top-level `metric/source/data_quality` `:544-546` nhất quán; `cvd_source/coverage_ratio/trade_count` lấy từ `buckets[0]` `:547-554`. **Số liệu market history coherent.**

> **Reservation R1 (P2):** test `test_history_with_candle_day_without_buckets_returns_200` (`test_session_facts_api.py:67-85`) tạo `DailyPrice` cho **chính `self.day`** (`:71-73`), trong khi setUp `:33` đã tạo bucket `1D` cho ngày đó ⇒ tại `views.py:489` `candle_day in by_date` → `continue`, **nhánh fill không bao giờ chạy**. Test xanh mà không exercisefix. Cần fixture: bucket `1D` ở `self.day - N` (coverage_from) + `DailyPrice` ở `self.day` (không có bucket) để ép fill, rồi assert 200 + field. Code đã đúng; chỉ là bảo vệ hồi quy yếu.

### N2 (P2 vòng 2) — test window tautology/yếu: **ĐÃ SỬA THẬT**
`test_market_cvd_ssot.py:59-70`: bỏ nhánh tautology, dùng `assertEqual(bucket_ts.minute % minutes, 0)` cho `5/15/30/60` (`:62-64`), thêm tick lúc `+7 phút` (`:57-61`) và assertion `assertGreater(len(five['buckets']), len(fifteen['buckets']))` (`:68`), 1D assert `len(daily['buckets']) == 1` + tổng thật (`:70-72`). Probe tách hàm thật: 5m keys `09:15/09:20/14:45` (3) vs 15m `09:15/14:45` (2) → assertion **True**; mô phỏng hành vi cũ fixed-15m → 2 vs 2 → assertion **False**. **Assertion mới thực sự đỏ trên code cũ F1.** (P3 nhỏ: vòng lặp không còn `240`; 4h được code xử lý generic nhưng không còn test riêng.)

### N3 (P3 vòng 2) — tick load 2 lần: **ĐÃ SỬA THẬT**
`session_facts_engine.py:467` là **duy nhất** lời gọi `_load_intraday_tick_values` trong `compute_session_facts_for_all_active`; dòng từng gọi wrapper `:504` cũ nay là `_aggregate_market_from_rows(tick_rows, 15)` — tái dùng `tick_rows`. Grep toàn file: wrapper `compute_market_cvd_from_ticks` chỉ định nghĩa `:413`, không còn gọi trong materialization. **1 query tick / symbol.**

### N4 (P3 vòng 2) — top-level history hardcode: **ĐÃ SỬA THẬT**
`views.py:547-554` thay `coverage_ratio: 0.0` / `trade_count: None` bằng `buckets[0].get(...)` — cùng nguồn thực tế như path chính (`bucket_rows[0]`). `cvd_source` cũng lấy từ bucket thay vì suy từ metric. Đạt.

### N5 (P3 vòng 2) — synthetic fallback dùng 15m cho mọi window: **ĐÃ SỬA THẬT, scope đúng**
`session_facts_engine.py:257` lưu `base_rows = rows` trước vòng lặp `:258`. Trong mỗi window: `:260-261` tính `window_market` và **gán lại** `market_buckets` theo `bucket_minutes`; `:263-269` xây `rows` synthetic từ chính `market_buckets` của window đó; `:270-271` `rows = base_rows` khi có whale (không làm mất dữ liệu gốc). Tra cứu `:282-283` dùng cùng `bucket_minutes`. **`market_buckets` không bị stale 15m** trong path production (tick_rows luôn được truyền); khởi tạo `:253/:256` chỉ là fallback cho caller không truyền tick_rows. Không có thay đổi nguy hiểm mới.

### F1 / F2 vòng 1 (xác nhận lại)
- **F1:** vẫn đóng — `_floor_bucket(ts, bucket_minutes)` `:381`, lookup `:282` cùng granularity; test mới giờ chứng minh được sự khác 5m/15m.
- **F2:** vẫn đóng — history metric-aware toàn diện như mục N1; `self._metric` set tại `views.py:602` trước mọi lần đọc (`:424,518-570,640,676-699`), **không có path unset**.

### F3/F4/F5/F6/F7 vòng 1–2
- F3 (control tự so sánh): đóng (`test_session_facts_api.py:63-65`).
- F4 (test materialization đa window): **vẫn mở mức P3** — test mới vẫn gọi trực tiếp `_aggregate_market_from_rows`, chưa đi qua `_build_bucket_rows`; nhưng assertion `len5>len15` đã đủ bắt lỗi khóa ở mức aggregator.
- F5: đóng (N3).
- F6 (500M hardcode vs hằng 200M; S2 chưa merge): reservation mang sang — `session_facts_engine.py:385` hardcode `500_000_000`, hằng `:54` vẫn 200M; `origin/dev` engine vẫn 200M. Không phải blocker S5 nhưng phải re-verify sau rebase.
- F7 (Entry): vẫn chưa ghi — xem kết luận.

## Findings mới (vòng 3)

| ID | Mức | file:line | Thực tế | Tác động | Đề xuất |
|---|---|---|---|---|---|
| **R1** | P2 | `test_session_facts_api.py:71-73` vs `:33` | DailyPrice trùng ngày với bucket `1D` ⇒ nhánh fill `views.py:489` bị `continue` | Test N1 xanh giả, không bảo vệ hồi quy KeyError | Đặt bucket ở `self.day - N`, DailyPrice ở `self.day` |
| **R2** | P3 | `views.py:123` | `_build_empty_cvd_payload` hardcode `'metric': 'whale'` | No-data response cho `?metric=market` báo metric=whale — sai nhãn, không crash | Truyền `metric` vào helper hoặc override ở 2 callsite no-data |
| **R3** | P3 | `test_market_cvd_ssot.py:59` | Vòng lặp bỏ `240` (4h) | 4h không còn test riêng dù code generic xử lý đúng | Thêm 240 vào tupleassert |
| **R4** | P3 | `session_facts_engine.py:385` | Ngưỡng 500M hardcode, hằng `:54` = 200M | Trôi cấu hình khi S2 merge | Dùng hằng统一 sau rebase |

**Không có P0/P1 mới.** `rows = base_rows` (`:257,:271`) và `market_buckets` scope (`:261`) đã kiểm tra — không mất whale rows, không lẫn bucket 15m ở path có tick_rows. Diff vẫn 13 file, **không file deny-list**, migration `0008→0007` nguyên vẹn, không script deploy/staging.

## Cổng đã chạy / CHƯA CHẠY

| Cổng | Kết quả auditor tự chạy |
|---|---|
| `git status --short` / `git log` | Branch đúng; HEAD `5f04afcf5`; chỉ `?? docs/evidence/market-data-integrity/`; không code/migration chưa commit. |
| `git merge-base origin/dev HEAD` | `a468cc2c2`; `origin/dev = 4198b6a17` (đã trôi thêm 2 commit từ vòng 2). |
| `git diff origin/dev...HEAD --name-only` | 13 file, đúng scope, 0 deny-list. |
| `node packages/web/scripts/check-multi-agent.mjs` | **exit 0** — `0 lỗi, 0 trùng số migration — PASS`. |
| `node docs/system-design/_meta/tools/check-system-design.mjs --check` | **exit 0** — `SACH — exit 0` (44 file/220 citation/1438 route/122 model). |
| Probe `ast` (read-only) | Chạy được; xác nhận assertion mới đỏ trên hành vi fixed-15m cũ. |
| `pytest` / fail-before / regression / `makemigrations --check` / `py_compile` / `pre-push-gate` | **CHƯA CHẠY** (theo lệnh audit). Không khẳng định test xanh — chỉ đánh giá code + thiết kế test. |
| Probe staging `?window=1D&period=1M&metric=market` & deploy | **CHƯA CHẠY** — chờ owner/coordinator (Q8). Không SSH, không ghi staging (Q2=KHÔNG). |

## Kết luận (B9 readiness + Entry)

- **B9 readiness: ĐẠT ở mức re-audit tĩnh, verdict `AGREE`.** Toàn bộ blocker kỹ thuật đã đóng: F1 (per-window bucketing + test thực sự phân biệt 5m/15m), F2 (history metric-aware không KeyError), F3/F5/N4/N5. Không còn P0/P1; 4 finding mới đều P2/P3. Đây là vòng cuối — **không xin thêm vòng sửa**.
- **Reservation bắt buộc trước/khi B9:**
  1. **Owner / quy trình:** `agent-sync.ps1` rebase lên `origin/dev 4198b6a17`, **re-verify mọi `file:line`** và chạy lại toàn bộ gate sau rebase (R-3/L-003), sau đó xin Owner chốt Entry + PR. Không báo PASS trên code cũ sau rebase.
  2. **Entry number:** `git show origin/dev:docs/CODE_CHANGE_AUDIT_LEDGER.md` head hiện **Entry 682** (vòng 2 là 681); **re-check lại lúc merge**, khai số kế tiếp thực tế — **không hardcode 684** (các slice MDI khác có thể chiếm số). Auditor read-only, không tự ghi Entry.
  3. **Gates chưa chạy:** pytest trên Postgres riêng, `makemigrations --check --dry-run`, `pre-push-gate`, probe staging đọc `/session-facts/cvd/?window=1D&period=1M&metric=...` — ghi rõ **CHƯA CHẠY**, không suy ra xanh. Đặc biệt cần kiểm chứng R1 bằng staging/probe thực tế.
  4. **Test hồi quy:** sửa fixture N1 (R1) để nhánh fill candle-day thực sự chạy; bổ sung 4h (R3) nếu muốn phủ toàn 6 window.
  5. **F6:** re-verify ngưỡng whale sau khi S2 merge; `metric: 'whale'` hardcode ở empty payload (R2) nên đổi trước cutover widget (Q9).
- File verdict này là evidence B8 vòng 3 (final). Chuyển coordinator quyết định merge theo điều kiện trên; S4 vẫn khóa chờ Q2/Owner dry-run.
