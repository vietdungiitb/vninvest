# RE-AUDIT ĐỘC LẬP — S2 / REQ-BE-M02+M04+Q6+G-3b (2026-11-28)

- **Vai trò:** kiểm toán viên Staff+ độc lập, **không phải tác giả slice**; READ-ONLY (không sửa code của người khác).
- **Phạm vi:** `docs/PLAN_MARKET_DATA_INTEGRITY_1127.md` REV.3 §S2 + `docs/evidence/market-data-integrity/CONSENSUS_1127.md` (G-3b, Q6, M04) — đọc từ worktree `D:\Mujoco Projects\wt\mdi-plan-1127` (plan/consensus **không có** trong worktree này). Bằng chứng tác giả: `docs/evidence/market-data-integrity/s2-gates.md`.
- **Baseline / HEAD:** `origin/dev @ a570cb432` → HEAD slice `d34f4acda` (6 commit). Branch `feat/m02-auction-isolation`, worktree `D:\Mujoco Projects\wt\m02-auction-isolation`.
- **Phương pháp:** đọc `git diff origin/dev...HEAD` toàn bộ, đọc code thật + 2 file test, trace 3 write-path tới consumer, đối chiếu plan↔code (nguyên tắc 2), simulate lại thuật toán cũ bằng **Python thuần** (không pytest/docker/build) để kiểm chứng con số fail-before, đọc `CLAIMS.md` + ledger + chạy gate tĩnh. Mọi kết luận kèm `file:line`; không suy diễn thay bằng chứng.

---

## Verdict

**AGREE (reservations)** — Không có P0/P1. Cốt lõi của S2 đúng và fail-before **đỏ thật đã tự kiểm chứng độc lập** (mô phỏng cũ cho `62.727`, mới cho `50.0`): 3 write-path đều gọi `normalize_tick_side` trước detect; ATO/ATC/PUT_THROUGH bị ép `UNKNOWN`; M04 sửa cả `total` lẫn `whale`; `delta_strength_pct` giữ nguyên; ngưỡng 500M đúng tại runtime. Có thể **mở PR**. Chưa nên **đóng claim ngay** cho tới khi xử lý hoặc ghi rõ 3 reservation: **F-01** (naive timestamp bị hiểu là UTC — trái quy ước vnbroker), **F-02** (phase `UNKNOWN` vẫn trả BUY/SELL — mâu thuẫn docstring SSOT), **F-03** (migration 0007 còn 200M + mẫu số cũ). Entry ledger phải dùng **682** (681 đã thuộc S1).

---

## Trace & kiểm chứng (file:line)

### 1. `resolve_session_phase` — đúng khung giờ, không có lỗi substring với `normalmatch`

| Kiểm tra | Kết quả | Bằng chứng |
|---|---|---|
| ATO `09:00:00–09:14:59` | Đúng, inclusive cả 2 đầu | `session_phase.py:52-53` |
| ATC `14:30:01–14:59:59` | Đúng; bắt đầu **01 giây** saucontinuous `:56` (14:30:00) → không chồng biên | `session_phase.py:54-55` |
| CONTINUOUS | `09:15:00–11:30:00` ∪ `13:00:00–14:30:00` | `session_phase.py:56-57` |
| PUT_THROUGH | `put_through` / `pt*` / `thoa_thuan`; nằm trong `_AUCTION_PHASES` ⇒ ép UNKNOWN | `session_phase.py:25,42-43,68-69` |
| `match_type='normalmatch'` + side BUY, giờ CONTINUOUS | **Không bị nhận diện nhầm là phiên đấu giá** — `:44-46` chỉ `pass`, rơi xuống fallback giờ; `normalize_tick_side(:71-73)` lấy `side='BUY'` ⇒ trả `('BUY', CONTINUOUS)` | `session_phase.py:44-46,71-73` |
| `match_type` legacy chứa aggressor (`buy*`/`sell*`) | `:44` rơi fallback, `:75-79` dùng match_type làm aggressor khi `side` rỗng → đúng live-path cũ | `session_phase.py:44,74-79` |
| Múi giờ aware | `_to_ict(:32)` `astimezone(Asia/Ho_Chi_Minh)`. DNSE backfill trả UTC-aware (`vnbroker_adapter.py:1091-1099`); live trả ICT-aware (`vnbroker/api/quote.py:233-234` + `vnbroker/core/utils/normalizer.py:86-105`) ⇒ cả 2 đúng | `session_phase.py:32` |
| Múi giờ **naive** | `:30-31` coi naive là **UTC** → cộng 7h. Trái quy ước vnbroker (`normalizer.py:89-92`: *"Naive được hiểu là giờ Việt Nam, không phải UTC"*; `explorer/dnse/quote.py:247-248` `tz_localize(None)` sau khi đã convert sang ICT). Xem **F-01** | `session_phase.py:30-31` |

> Ảnh hưởng thực tế của F-01 bị **giảm nhẹ** vì cả 3 write-path hiện tại đều đưa timestamp aware: live → `timestamp.to_pydatetime()` (`vnbroker_adapter.py:152`), backfill → `utc_ts` UTC-aware (`:1099`), hydrate → `parse_datetime` của ISO aware do live phát ra (`tasks.py:339-340` ← `vnbroker_adapter.py:155`). Không có đường nào trong call-chain hiện tại truyền naive — nhưng đây là **hardening gap**, không phải lỗi đã xảy ra.

### 2. Ba write-path & consumer của `session_phase`

| Path | Gọi helper | Ép UNKNOWN trước detect | Bằng chứng |
|---|---|---|---|
| Live `_normalize_intraday_trade_rows` | `normalize_tick_side(row['side'], ts, match_type)` rồi `.lower()` | Có | `vnbroker_adapter.py:149-162` |
| DNSE backfill `fetch_intraday_tape_history` | `normalize_tick_side(row['side'], utc_ts, raw_match)` rồi `.lower()` | Có | `vnbroker_adapter.py:1101-1113` |
| Hydrate `_normalize_intraday_trade_row` | `normalize_tick_side(trade['side'], timestamp, trade['match_type'])` | Có | `tasks.py:350-360` |
| Detect layer (phòng tuyến 2) | `detect_whale_ticks` vẫn lọc `known_side` | Có (giữ nguyên) | `order_flow_engine.py:244-259` (chỉ đọc) |

**Consumer của key `session_phase` mới — không vỡ:**
- Live: output chỉ vào `fetch_intraday_tape` → `result['trades']` + cache Redis (`vnbroker_adapter.py:991-1004`); `_publish_intraday_stream` **pick key rõ ràng**, không `**trade` (`:177-185`). Hydrate nhận lại raw trade, `_normalize_intraday_trade_row` **bỏ** `session_phase` và dựng dict mới đúng 7 field model (`tasks.py:353-361`).
- `IntradayTick(**trade)` tại `tasks.py:509` dùng `normalized_trades` từ helper **số ít** (`tasks.py:466-473`), helper này **không** thêm `session_phase` ⇒ không lỗi `TypeError: unexpected keyword`.
- Backfill: `tasks.py:2591-2602` và `:2704-2715` dựng `IntradayTick(...)` ** truyền field cụ thể**, bỏ qua key thừa ⇒ an toàn (đã kiểm tra cả 2 chỗ, không phải chỉ `:2588-2599`).
- `IntradayTick` model không có field `session_phase` (`market_data/models.py:302-324`) — đúng thiết kế "0 migration" của S2.

### 3. REQ-BE-M04 + Q6

- `bucket['total']` **và** `bucket['whale']` đều nằm trong nhánh `buy`/`sell`; side khác rơi vào comment skip (`session_facts_engine.py:139-150`). **Đúng yêu cầu M04.**
- `delta_strength_pct` vẫn dùng `total_value = total_buy + total_sell` (`:218-224`) — không đổi. `dark_flow_score` cũng dùng cùng mẫu số (`:225`). **Đúng control.**
- `_WHALE_THRESHOLD_VND = 500_000_000` (`:54`), khớp `order_flow_engine.py:31`, `materializers.py:16`, `native_views.py:1553`, `signals.py:19`. **Đúng Q6 tại runtime** — nhưng migration `0007:8` vẫn 200M (F-03).

### 4. Fail-before / pass-after & chống xanh giả (L-V04)

- Tự mô phỏng độc lập thuật toán **cũ** (mọi side cộng vào `total`; threshold 200M) và **mới** trên đúng fixture 2 bucket của test: kết quả `OLD=[50.0, 62.727]`, `NEW=[50.0, 50.0]`. ⇒ assertion `assertEqual(round(polluted['buy_strength'],3), 50.0)` **chắc chắn đỏ trên code cũ** với giá trị đúng như evidence ghi `62.727`. Không phải xanh giả.
- So sánh test tại commit fail-before `6a41a9863` với HEAD: assertion quyết định `assertEqual(round(polluted['buy_strength'],3), 50.0)` **giữ nguyên**, chỉ bỏ `assertNotEqual(polluted, clean)` (vốn luôn đúng trên old) và thêm `assertEqual(clean, 50.0)` (control, đúng trên cả old lẫn new). Việc "chỉnh assertion giữa phiên" **không làm mất tính đỏ**.
- 5 control xanh trên code cũ: ATC match_type (`test_auction_isolation.py:43-49`), continuous BUY (`:63-69`), hydrate continuous (`:81-89`), detect UNKNOWN (`:116-129`), delta control (`test_session_facts_total_denominator.py:41-45`). Khớp evidence `s2-gates.md:22`.
- Fixture đúng **≥2 bucket** theo R-O1 (`test_session_facts_total_denominator.py:14-31`); không rơi vào bẫy 1 bucket (sigmoid luôn 50).

### 5. Regression honesty

- Evidence `s2-gates.md:29`: 1 fail `test_min_value_floor_and_empty_state`; đã tự đọc `market_serving/tests/test_native_views.py:392-400` — test kỳ vọng 400 `MIN_VALUE_BELOW_FLOOR` cho `min_value=100M`, nhưng floor API là 50K (Entry 674) ⇒ 200. **Không liên quan S2** (S2 không đụng `native_views.py`), tái hiện trên base là hợp lý.
- Evidence `:30-31`: 5 fail + 4 error, **chỉ 4** được chạy lại trên `origin/dev`. Nhận xét: `provider_side_from_tick` thuộc `native_views.py:479` (scope market_serving, không phải market_data/data_ingest như evidence ghi nhãn) — sai nhãn scope, nhưng vẫn là pre-existing. Không có bằng chứng nào cho thấy S2 có thể tạo ra `2 != 1` / `101756 != 1`. **Chấp nhận nhưng chưa chứng minh đủ cho 5 fail/error còn lại** (F-04).

### 6. Protocol

- Claim `7cf7b46e4` **trước** dòng code đầu tiên (`d361a6e1f`) — đúng. Agent `m02-auction-isolation` **khớp** branch `feat/m02-auction-isolation` (L-M02). `in-progress` trong `CLAIMS.md:2101`.
- Diff chỉ 7 file, **0 migration**; `docs/evidence/market-data-integrity/s2-gates.md` untracked (chưa commit) nhưng nằm trong claim. Không file deny-list, không staging/deploy script trong diff ⇒ không có dấu tích ghi phá staging.
- **Entry conflict:** `origin/dev` ledger head = **680**; S1 (`m01-bar-overwrite`, commit `aced103d3`, chưa merge vào dev) đã chiếm **681**. ⇒ S2 **phải dùng Entry 682** và re-check head lúc merge. Claim hiện chỉ ghi "Entry sẽ cập nhật sau rebase" — cần cụ thể hoá.

---

## Chống xanh giả

| Dấu hiệu | Kiểm tra | Kết luận |
|---|---|---|
| Assertion đổi giữa chừng | Diff `6a41a9863..d34f4acda` của test M04 | Assertion quyết định **không đổi**; chỉ thêm/bớt control ⇒ không xanh giả |
| Fixture 1 bucket (sigmoid luôn 50) | `_rows()` có `base` + `base+1h` | Đúng 2 bucket |
| Chỉ fix `total`, quên `whale` | `session_facts_engine.py:139-148` | Cả 2 nhánh đều sửa |
| Đổi `delta_strength` ngầm để khớp kỳ vọng | `:218-225` | Giữ nguyên `buy+sell` |
| Ngưỡng 500M chỉ ghi test, không ghi runtime | `:54` | Runtime đúng 500M |
| Test tự So sánh với chính nó (tautology) | `assertEqual(clean, 50.0)` + `assertEqual(polluted, 50.0)` | Có control `clean` độc lập; tự mô phỏng cho thấy `polluted` khác trên old ⇒ không tautology |
| Gate "PASS" chưa chạy | Xem phần dưới | Chỉ báo lại gate đã có output thật + gate tự chạy; phần còn lại ghi `CHƯA CHẠY` |

---

## Findings (ID | mức | file:line | thực tế | tác động | đề xuất)

| ID | Mức | file:line | Thực tế | Tác động | Đề xuất |
|---|---|---|---|---|---|
| **F-01** | **TRUNG BÌNH** | `market_data/session_phase.py:30-31` | Naive timestamp bị coi là UTC (`pytz.utc.localize`), trái quy ước `vnbroker/core/utils/normalizer.py:89-92` và `explorer/dnse/quote.py:247-248` (naive = giờ VN). 14:45 VN naive → 21:45 ICT → phase `UNKNOWN` → `normalize_tick_side:72-73` **vẫn trả BUY** vì phase không thuộc `_AUCTION_PHASES` | Nếu một provider/cache trả timestamp naive, tick ATC **lọt** aggressor ⇒ vi phạm I-3. Hiện 3 path đều aware nên chưa xảy ra | Đổi `:30-31` thành `_VN_TZ.localize(timestamp)` cho khớp vnbroker; thêm 1 test control naive VN 14:45 → `unknown`. Hoặc ghi rõ giả định "mọi caller phải aware" trong docstring + guard fail-closed |
| **F-02** | **TRUNG BÌNH** | `market_data/session_phase.py:66,71-79` | Docstring khẳng định *"Aggressor chỉ tồn tại ở CONTINUOUS"*, nhưng khi `phase == UNKNOWN` (nghỉ trưa 11:30:01–12:59:59, sau 15:00, timestamp lỗi) hàm vẫn trả `('BUY'/'SELL', UNKNOWN)` | Mâu thuẫn SSOT ngay trong module mới; tick ngoài giờ có aggressor đi vào detect (dù detect lọc theo side) ⇒ rủi ro I-3 mở rộng ngoài ATO/ATC | Đổi `:73,77,79` thành `return UNKNOWN, phase` khi `phase != CONTINUOUS`. Nếu cố ý giữ legacy, sửa docstring + ghi reservation Owner |
| **F-03** | **THẤP (tồn nợ)** | `market_serving/migrations/0007_sessionfactsbucket_strength_fields.py:8,45-51` | Migration đã apply vẫn dùng 200M và cộng **mọi side** (unknown → `sell` ở `:47-48`) vào `total`/`whale` | Giá trị `institutional_strength`/`whale_ratio` lịch sử (do migration backfill) **không so sánh được** với giá trị runtime sau S2. S2 thiết kế 0 migration nên không sửa được trong slice này | Mở ticket riêng: rebuild `SessionFactsBucket` strength fields bằng engine mới, hoặc ghi caveat trong `s2-gates.md` + evidence S5 |
| **F-04** | **THẤP** | `s2-gates.md:30-31` | 5 fail + 4 error nhưng chỉ 4 test được chạy lại trên `origin/dev`; nhãn scope ghi `provider_side_from_tick` vào market_data/data_ingest trong khi assertion nằm ở `native_views.py:479` | Tuyên bố "pre-existing" chưa phủ toàn bộ; dù đã kiểm tra thấy các fail rõ ràng không liên quan S2 | Chạy lại full 2 scope trên `origin/dev` (base) hoặc ghi `CHƯA CHẠY` cho 5 test chưa verify |
| **F-05** | **INFO** | `market_data/session_phase.py:36` | Docstring có ký tự Hán sót: `nếu thiếu则用 khung giờ ICT` | Lỗi chính tả/mã hoá, không ảnh hưởng runtime | Sửa thành `nếu thiếu dùng khung giờ ICT` trong commit cuối |
| **F-06** | **INFO / protocol** | `CLAIMS.md:2101`, `docs/CODE_CHANGE_AUDIT_LEDGER.md` head | Claim chưa ghi số Entry; 681 đã bị S1 chiếm (`aced103d3`), dev head còn 680 | Conflict Entry nếu agent lấy 681 | Ghi **Entry 682**, re-check `head` lúc `agent-sync`/merge |

---

## Cổng đã chạy / CHƯA CHẠY

| Cổng | Kết quả | Ai chạy |
|---|---|---|
| `git status --short` | `?? docs/evidence/market-data-integrity/` (file evidence của slice, untracked); không file lạ | **Auditor tự chạy** |
| `git log --oneline -5` | `d34f4acda`, `680f54fab`, `6a41a9863`, `8a7f22e47`, `d361a6e1f` | **Auditor tự chạy** |
| `git diff origin/dev...HEAD` | 7 file / +286 −25, 0 migration | **Auditor tự chạy** |
| `node packages/web/scripts/check-multi-agent.mjs` | `0 lỗi, 0 trùng số migration — PASS` (kèm ~19 dòng warning claim stale, không chặn) | **Auditor tự chạy** |
| Mô phỏng fail-before M04 (Python thuần) | `OLD=[50.0, 62.727]`, `NEW=[50.0, 50.0]` ⇒ đỏ thật | **Auditor tự chạy** |
| Fail-before / pass-after pytest trên VPS | `FAILED (failures=6)`, `TEST_EXIT=1` @ `6a41a9863` → `Ran 11 tests ... OK`, `TEST_EXIT=0` @ `d34f4acda` | Tác giả (`s2-gates.md:18-23`) — auditor **không tự chạy** (theo lệnh READ-ONLY, cấm pytest) |
| Regression 4 app | 1 fail + 5 fail/4 error, 4/9 tái hiện trên base | Tác giả (`s2-gates.md:25-31`) — auditor **không tự chạy** |
| `makemigrations --check --dry-run` / `py_compile` / `pre-push-gate` | `No changes detected` / exit 0 / `36 PASS 0 SKIP 0 FAIL` | Tác giả (`s2-gates.md:37-40`) — auditor **không tự chạy** |
| Probe staging `/intraday-tape/`, `/whale-feed/`, I-3 = 0 row | **CHƯA CHẠY** — chờ PR + Q8 (Q2 = KHÔNG ghi staging) | — |
| Full BE suite tất cả app / `npx tsc --noEmit` riêng | **CHƯA CHẠY** | — |

---

## Kết luận

**Có mở PR: CÓ.** S2 đạt cổng ra B9 ở mức `AGREE (reservations)`: 3 write-path được bảo vệ, M04/Q6/G-3b đúng, fail-before đỏ thật đã tự kiểm chứng, control đầy đủ, không regression quy về S2.

**Đóng claim: CHƯA vội.** Trước khi đóng cần:
1. Quyết định F-01/F-02: dùng `Asia/Ho_Chi_Minh.localize` cho naive + test control, hoặc sửa docstring để `UNKNOWN ⇒ UNKNOWN side`; nếu giữ nguyên hành vi, ghi reservation có Owner chốt.
2. Ghi rõ F-03 thành ticket riêng (sửa migration đã apply = nợ S5, không làm trong S2).
3. Bổ sung F-04 hoặc ghi `CHƯA CHẠY` cho 5 test chưa tái hiện trên base.
4. Commit file evidence `s2-gates.md` + **`S2_REAUDIT.md` này**, cập nhật claim `done` với **Entry 682** (không dùng 681 — S1 đã chiếm), rồi `agent-sync.ps1` → push → PR.

**Không có blocker P0/P1** chặn merge; F-01/F-02 là hardening gap (đã có evidence không xảy ra trên call-chain hiện tại) nhưng đáng xử lý trong cùng slice vì chi phí rất nhỏ.
