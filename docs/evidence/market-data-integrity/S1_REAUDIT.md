# RE-AUDIT ĐỘC LẬP — S1 / REQ-BE-M01 (2026-11-28)

- **Phạm vi:** S1 `REQ-BE-M01` — chặn ghi đè cụt `IntradayBar`; chỉ đọc, không phải tác giả slice.
- **Baseline:** worktree `D:\Mujoco Projects\wt\m01-bar-overwrite`, branch `feat/m01-bar-overwrite`, HEAD `36a3a8781`; `git merge-base origin/dev HEAD` = `d446515b2` (đúng base đã khai). `origin/dev` hiện đã trôi tới `a570cb432` ⇒ phải rebase + chạy lại gate ở B9 (L-003).
- **Nguồn đối chiếu:** `docs/PLAN_MARKET_DATA_INTEGRITY_1127.md` §S1 (đọc trên worktree `docs/mdi-plan-1127`, branch S0 — **file chưa có trên `origin/dev`**), `docs/evidence/market-data-integrity/CONSENSUS_1127.md` (G-1..G-4, R-3), `docs/evidence/market-data-integrity/s1-gates.md`, `git diff origin/dev...HEAD`, code thật + test thật.
- **Phương pháp:** mở từng file, trace `file:line`; `git show` giữa các commit để so sánh test fail-before với test cuối; **không** chạy pytest/docker/build (không có môi trường, không được phép); tự chạy gate tĩnh read-only. Đối chiếu bài học `L-V01..L-V04` (`docs/LESSONS/verification.md`, `false-green.md`) và `L-002/L-003/L-M02/L-007` (`multi-agent.md`).

## Verdict

**AGREE (có reservation)** — 0 blocker, 0 MAJOR; 3 reservation MEDIUM + 2 LOW phải ghi rõ người đóng/điểm đóng trước khi coi B9 hoàn tất. Không có bằng chứng làm sai lệch kết quả nghiệm thu theo hướng "xanh giả"; fix đúng cơ chế và có test dương tính.

| Reservation | Người đóng | Điểm đóng |
|---|---|---|
| R1-S1-01 (path ticks-only chưa được test/ghi nhận) | Tác giả S1 + coordinator | Trước merge PR: bổ sung 1 dòng phạm vi vào `s1-gates.md`; nếu yêu cầu bar refresh ở path `realtime_prefetch` thì mở ticket riêng, **không** mở rộng S1 |
| R1-S1-02 (fail-before ghi ở bản test cũ) | Tác giả S1 | Trước merge PR: đính chính `s1-gates.md` §2 ghi rõ commit/phiên bản test nào được chạy đỏ, và bản cuối chỉ **suy luận** đỏ (chưa chạy lại) |
| R1-S1-03 (hiệu năng query range chưa đo) | Tác giả S1 | Theo dõi sau deploy; nếu đo được trên VPS thì ghi số, nếu không ghi `CHƯA CHẠY` (đã ghi) |
| R1-S1-04 (source label lệch với synthesize path) | Owner/coordinator | Đóng cùng S5 hoặc ticket riêng; không chặn S1 |
| R1-S1-05 (đóng phiên/rebase/ledger) | Tác giả S1 | B9: rebase → gate lại → commit evidence + Entry 679 → PR, bảo đảm Entry 678 (S0) vào `dev` trước |

## Trace fix (file:line)

1. **Đường nóng** `packages/core/backend/src/data_ingest/tasks.py:511-546`: thay `_build_intraday_bar_payloads(symbol, normalized_trades)` (bản cũ `tasks.py:376-404`, chỉ cộng dồn trong 1 batch tape) bằng: xác định `affected_keys` từ tape → query **toàn bộ `IntradayTick` trong DB** (`tasks.py:532-538`) → gọi helper (`tasks.py:539-546`). Upsert vẫn giữ presence-check + `bulk_create(update_conflicts=True)` tại `tasks.py:547-576`.
2. **Helper** `packages/core/backend/src/data_ingest/intraday_bar_recompute.py:28-81`: `sorted(tick_rows, key='timestamp')` (`:36`), mọi dòng tick trong bucket đều cộng `volume` (`:72`), `high/low/close` lấy theo thời gian (`:68-71`), chỉ trả key thuộc `affected_keys` (`:47-48`) ⇒ bucket không liên quan không bị ghi đè.
3. **G-3a** `tasks.py:520-525`: tape timestamp được `.replace(tzinfo=UTC)` khi naive, `.astimezone(UTC)` khi aware, **trước khi** `_floor_intraday_bucket` (định nghĩa `tasks.py:361-373`). Helper nhận chính hàm floor này qua tham số (`tasks.py:544`; helper `:41`, `:45`), nên 2H/4H dùng cùng múi giờ với `synthesize_intraday_bars_from_ticks` (`tasks.py:2985-3047`, tick DB đọc ra ở UTC do `settings.py:354-356` `USE_TZ=True`). Helper chỉ vá naive→UTC (`intraday_bar_recompute.py:39-40`); với DB Django `USE_TZ=True` trả aware UTC nên không lệch.
4. **Range query** `tasks.py:528-531`: `min(bucket_starts)` .. `max(bucket_starts)+4h` — đủ để chứa mọi tick của mọi bucket đã chọn (4H là khung lớn nhất), kể cả bucket 4H có max start.
5. **Test dương tính/đối chứng:** `tests/test_intraday_bar_no_partial_overwrite.py:85-109` (501000 vs 1000 + tick count + bar 1m), `:111-139` (helper gom 3 tick DB), `:142-174` (6 timeframe, chống lệch múi giờ 2H/4H), `:176-188` (bucket không bị ảnh hưởng giữ nguyên 100000).

## Kiểm chứng fail-before/pass-after & chống xanh giả

- `git show 149fe2f6f` = commit **chỉ có test** (2 test, parent `89e296cc5` = claim). `git diff 149fe2f6f..HEAD -- <test>` cho thấy bản cuối **bổ sung** assert (`tick_count == 3`, `minute_bar.volume == 1000`, helper 501000, G-3a 6 timeframe) chứ **không xoá/yếu đi** assert gốc `assertEqual(bar.volume, 501000)` (`test:109`). Theo `L-V06 (false-green.md)`: số test tăng 2 → 4, không có dấu hiệu xoá test.
- `git show 397ef7d77..HEAD` cho thấy fix G-3a chỉ đổi vòng lặp `affected_keys` sang UTC; không đụng logic aggregate đã đỏ ở bản đầu. Suy luận (chưa chạy lại): chạy test cuối trên base `d446515b2` vẫn đỏ vì (a) `test_batch2...` gặp code cũ ghi `1000`, (b) `test_helper...` import module chưa tồn tại. **Đây là suy luận, không phải output thực đo** — reservation R1-S1-02.
- Bằng chứng VPS trong `s1-gates.md:21-22`: fail-before `FAILED (failures=1)`, `AssertionError: 1000 != 501000`, control xanh, `TEST_EXIT=1`; pass-after `Ran 4 tests ... OK`, `TEST_EXIT=0`. Có đúng con số + lệnh + exit code + phân biệt pre-existing failure ở `s1-gates.md:28-32` (1 fail `'warm' != FRESH` trùng trên `origin/dev`, đã có bằng chứng độc lập tại `docs/evidence/corporate-actions/ALL_SYMBOLS_SYNC_20261121.md:38`). Không thấy mẫu hình "assert rỗng/None", không có `assertTrue(True)` ở bản cuối (các commit diagnostic `a1e86d996`…`612d41532` đã được dọn: `grep DIAG|print(` trên 2 file cuối = 0 hit).
- **Không tự chạy pytest/docker** theo phạm vi auditor; mọi kết quả test ở trên là **đọc evidence**, không phải tái hiện. Ghi `CHƯA CHẠY` cho việc tái thi hành.

## Findings (ID | mức | file:line | thực tế | tác động | đề xuất)

| ID | Mức | file:line | Thực tế | Tác động | Đề xuất |
|---|---|---|---|---|---|
| R1-S1-01 | MEDIUM | `tasks.py:511` (`if 'intraday_bars' in target_dataset_set`) vs `market_serving/realtime_prefetch.py:440-445`, `market_data/global_symbol_coverage.py:680-691`, `global_symbol_planner.py:215-235` | Fix chỉ chạy khi plan item có `dataset='intraday_bars'`; scheduler hydrate 5 phút của `realtime_prefetch` chỉ gửi `dataset='intraday_ticks'` ⇒ path đó không recompute bar (đúng thiết kế cũ, **không phải regression do S1**). Planner `global_symbol_planner` có thể gửi cả 2 dataset nên test fail-before đại diện được đường gây cụt nến. | Nếu kỳ vọng bar được làm mới trong mọi lần hydrate tick, bug vẫn còn ở path scheduler; evidence dùng chữ "đường nóng" dễ hiểu nhầm. | Ghi rõ phạm vi trong `s1-gates.md`; thêm test plan ticks-only nếu muốn bảo đảm; nếu cần đổi hành vi thì ticket riêng, không mở rộng S1. |
| R1-S1-02 | MEDIUM | `s1-gates.md:21-22` vs `test_intraday_bar_no_partial_overwrite.py:24-30, 85-109, 142-174` | Log đỏ được chụp ở commit `149fe2f6f` với bản test 114 dòng (dùng `pytz` + `django.make_aware`); bản cuối 188 dòng đổi `_local()` sang fixed UTC−7 và thêm 2 test. Không có log đỏ của **bản test cuối** trên base. | Bằng chứng fail-before không khớp 1-1 với artifact cuối; dễ bị auditor sau hỏi lại. Kết luận đỏ vẫn đúng về mặt suy luận. | Đính chính §2: ghi commit đã chạy đỏ + nêu rõ bản cuối chưa chạy lại trên base (`CHƯA CHẠY`), hoặc chạy lại trên VPS DB tạm. |
| R1-S1-03 | MEDIUM | `tasks.py:528-537`; `intraday_bar_recompute.py:36, 45-72` | Query không có `limit`, phạm vi `min..max+4h`; helper lặp `len(tick_rows) × 6` timeframe. Không có số đo số tick/độ trễ. | Warm chạy mỗi 5 phút; nếu tape trải dài cả ngày, chi phí tăng so với bản cũ (chỉ xử lý 1 batch). Chưa có bằng chứng gây chậm. | Đo `EXPLAIN`/số row trên VPS staging (read-only) hoặc ghi `CHƯA CHẠY` như hiện tại; cân nhắc chặn range bằng ngày giao dịch nếu số đo lớn. |
| R1-S1-04 | LOW | `intraday_bar_recompute.py:16-21` vs `tasks.py:3040-3045` | Helper: source rỗng ⇒ `vnbroker_intraday`, có `dnse` ⇒ `dnse_backfill`; synthesize: rỗng ⇒ `backfill`, nhiều source ⇒ `next(iter(set))` không xác định. | Hai đường cùng viết 1 bar có thể đẩy `source` qua lại ⇒ presence-check `tasks.py:563` báo `updated` dù OHLCV không đổi. Không mất volume. | Thống nhất policy source ở S5 hoặc rút helper dùng chung; hiện tại chỉ ghi nhận. |
| R1-S1-05 | LOW | `git status --short`, `git log --oneline -1 origin/dev`, `docs/CLAIMS.md:2097` | `docs/evidence/market-data-integrity/` **chưa track**; Entry 679 chưa prepend; `origin/dev` đã trôi `a570cb432`; S0 (`docs/mdi-plan-1127`, Entry 678) chưa merge vào `dev` (`cat-file -e origin/dev:docs/PLAN_MARKET_DATA_INTEGRITY_1127.md` = 128). | B9 chưa hoàn tất nếu commit queue sai thứ tự (679 trước 678) hoặc quên commit evidence. | Rebase → gate lại → đảm bảo S0 merge trước → prepend Entry 679 → commit evidence (kể cả file này) → PR. |

**Đã kiểm chứng đúng (không nằm trong objection):** (1) aggregate từ toàn bộ tick DB — `tasks.py:532-546` + helper `:36-72`; (2) G-3a nhất quán giữa hot path và synthesize — `tasks.py:520-525, 361-373, 3024-3047`; (3) `affected_keys` lọc đúng bucket, bucket khác giữ nguyên (`test:176-188`); (4) idempotency: presence-check `tasks.py:563-565` + helper kết quả xác định ⇒ warm pass lặp lại không giảm volume (suy luận từ code; evidence `s1-gates.md:30` ghi test cũ xanh); (5) empty bucket: `affected_keys` rỗng ⇒ `bar_payloads={}`, không upsert (`tasks.py:526-527`); (6) claim/commit/branch: `89e296cc5` khai claim trước `149fe2f6f` (code/test) và trước mọi fix; tên agent `m01-bar-overwrite` = branch bỏ tiền tố; (7) không migration (`git diff --stat` 4 file, không có `migrations/`; `makemigrations --check` ghi exit 0); (8) không staging destructive write trong diff; (9) source label của tape vẫn `vnbroker_intraday` như cũ (`tasks.py:357`).

## Cổng đã chạy / CHƯA CHẠY

| Cổng | Kết quả (auditor tự chạy nếu có thể) |
|---|---|
| `git status --short` (worktree) | `?? docs/evidence/market-data-integrity/` — chỉ evidence chưa track, không file lạ |
| `git log --oneline -5` | `36a3a8781`, `612d41532`, `8b7b0d182`, `9fe252e44`, `a1e86d996` |
| `node packages/web/scripts/check-multi-agent.mjs` | **exit 0**, in `0 lỗi, 0 trùng số migration — PASS` (kèm ~warning claim stale cũ, không chặn) |
| `node scripts/check-lessons.mjs` | **exit 0**, `14 file | 60/60 lesson ... sach` |
| `git diff origin/dev...HEAD --stat` | 4 file: `CLAIMS.md +1`, `tasks.py +34/-1`, helper mới `+82`, test mới `+188` — đúng SCOPE, 0 migration |
| `git merge-base origin/dev HEAD` | `d446515b2` — khớp base đã khai |
| `cat-file -e origin/dev:<plan>/<consensus>` | 128 — plan/consensus chỉ nằm ở branch S0, chưa lên `dev` |
| BE pytest / VPS staging | **CHƯA CHẠY** (auditor không có env; chỉ đọc evidence của tác giả) |
| `python -m py_compile`, `makemigrations --check`, `pre-push-gate`, tsc/build, deploy staging | **CHƯA CHẠY** bởi auditor; evidence ghi lần lượt exit 0 / 0 changes / 36 PASS / pre-push tự tsc / chờ PR — không tự báo PASS thay cho người khác |

## Kết luận (có thể đóng claim/mở PR không?)

**Có thể đi B9 sau khi đóng 2 reservation bắt buộc:** R1-S1-02 (đính chính bằng chứng fail-before cho khớp artifact cuối) và R1-S1-05 (commit evidence + Entry 679 sau rebase/gate, S0/Entry 678 vào `dev` trước). R1-S1-01/03/04 ghi nhận thành nợ theo dõi, **không** yêu cầu sửa code production trong S1. Chưa được đóng claim ngay lúc này vì evidence vẫn untracked và Entry 679 chưa tồn tại; sau khi làm đủ các mục trên, auditor không có objection chặn PR.
