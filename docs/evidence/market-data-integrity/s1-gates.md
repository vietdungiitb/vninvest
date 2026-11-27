# BẰNG CHỨNG CỔNG S1 — REQ-BE-M01: Chặn ghi đè cụt `IntradayBar`

- **Ngày:** 2026-11-27 → 2026-11-28 · **Branch:** `feat/m01-bar-overwrite` · **Base:** `origin/dev @ d446515b2`
- **Claim:** `m01-bar-overwrite` (khai trước dòng code đầu tiên; Entry **681** — Entry 678/679/680 đã bị SSOT/vnbroker chiếm trên `dev` sau khi PR #586 còn mở) · **Worktree:** `D:\Mujoco Projects\wt\m01-bar-overwrite`
- **Plan:** `docs/PLAN_MARKET_DATA_INTEGRITY_1127.md` S1 · **Owner decisions:** `CONSENSUS_1127.md` (mở khóa S1→S2→S3→S5; S4 khóa)

## 1. Thay đổi

| File | Thay đổi |
|---|---|
| `packages/core/backend/src/data_ingest/tasks.py` | `_hydrate_intraday_symbols` (`:511+`): thay `_build_intraday_bar_payloads(symbol, normalized_trades)` bằng recompute từ **toàn bộ `IntradayTick` DB** cho các bucket bị ảnh hưởng; chuẩn hóa tape timestamp về **UTC** trước khi floor (G-3a) |
| `packages/core/backend/src/data_ingest/intraday_bar_recompute.py` | **Mới**, 82 dòng — helper thuần, nhận `floor_bucket` từ `tasks.py` ⇒ dùng chung `_floor_intraday_bucket`, không phình file 3846 dòng |
| `packages/core/backend/src/data_ingest/tests/test_intraday_bar_no_partial_overwrite.py` | **Mới** — 4 test: fail-before cộng dồn, control bucket, helper aggregate, G-3a đủ 6 timeframe |

## 2. Fail-before / pass-after (chạy THẬT trên VPS, DB tạm, không đụng dữ liệu staging)

Lệnh theo `docs/STAGING_VPS_RUNBOOK.md` §12.3: worktree tạm `/tmp/wt-m01-bar-overwrite`, container `vninvest-core-api:staging` mount code nhánh, `CORE_DATABASE_URL=postgresql://vninvest:***@vninvest-core-db:5432/s1_bar_m01`, `DJANGO_DEBUG=1`, `manage.py test ... --noinput`, dọn DB + worktree sau khi chạy (kể cả khi đỏ).

| Lần | Commit / phiên bản test | Kết quả |
|---|---|---|
| **Fail-before (output thật)** | `149fe2f6f` — bản test **114 dòng** (`pytz` + `django.make_aware`) | `FAIL: test_batch2_must_accumulate_not_overwrite` — `AssertionError: 1000 != 501000` · control bucket xanh · `Ran 2 tests`, `FAILED (failures=1)`, `TEST_EXIT=1` |
| **Bản test cuối (188 dòng)** | `36a3a8781` — đổi `_local()` sang fixed UTC−7, bổ sung 2 test | **CHƯA CHẠY lại trên base** (R1-S1-02). Kết luận vẫn đỏ là **suy luận từ code**: assert gốc `assertEqual(bar.volume, 501000)` không bị xoá/yếu đi, chỉ được bổ sung assert (`tick_count==3`, `minute_bar.volume==1000`, helper 501000, G-3a 6 timeframe) — auditor đã đối chiếu `git diff 149fe2f6f..HEAD`; base dùng code cũ ghi `1000` nên assert gốc vẫn nổ. Không tự báo PASS giả. |
| **Pass-after (output thật)** | `36a3a8781` (fix + test) | `Ran 4 tests ... OK` · `TEST_EXIT=0` |

**Phạm vi path (R1-S1-01):** fix chạy khi plan item có `dataset='intraday_bars'` (`tasks.py:511`). Scheduler 5 phút `market_serving/realtime_prefetch.py:440-445` chỉ gửi `intraday_ticks` ⇒ path đó **không recompute bar** — đây là thiết kế cũ, **không phải regression do S1**. Planner `global_symbol_planner` có thể gửi cả 2 dataset nên fail-before đại diện đúng đường gây cụt nến. Nếu cần bar refresh ở mọi hydrate tick → mở ticket riêng, không mở rộng S1.

**Nợ theo dõi (không chặn S1):** R1-S1-03 — chưa đo hiệu năng query `min..max+4h` & vòng lặp `N tick × 6 timeframe` (ghi `CHƯA CHẠY`); R1-S1-04 — source label của helper lệch nhẹ với `synthesize` path, thống nhất ở S5/ticket riêng.

## 3. Regression

| Scope | Branch | Kết quả |
|---|---|---|
| `data_ingest` (56 test) | `feat/m01-bar-overwrite` | `FAILED (failures=1)` — 1 fail: `GlobalSymbolCoverage.FreshnessChoices.FRESH` nhận `'warm'` (time-dependent) |
| `data_ingest` (52 test) | **`origin/dev` gốc** | **cùng 1 fail** `'warm' != FRESH` ⇒ **pre-existing, KHÔNG phải do S1** |
| Test cũ `test_warm_intraday_universe_consumes_plan_items_and_persists_rows` | nhánh S1 | Sau khi sửa G-3a đã xanh (trong 56 test chỉ còn 1 fail coverage kể trên) |

> Trước khi sửa G-3a, test cũ này từng fail `bar_counts['inserted'] = 5 < 7` — nguyên nhân **không phải** helper sai mà là tape timestamp `+07` floor 2H/4H ra `22:00+07 = 15:00 UTC`, khác bucket DB UTC `16:00 UTC` (đúng cảnh báo G-3a của Owner). Đã chuẩn hóa về UTC trước khi floor.

## 4. Gate tĩnh

| Gate | Kết quả |
|---|---|
| `python -m py_compile` (tasks.py, helper, test) | exit 0 |
| `python manage.py makemigrations --check --dry-run` (`DJANGO_DEBUG=1`) | `No changes detected`, exit 0 |
| `node packages/web/scripts/check-multi-agent.mjs` | `0 lỗi, 0 trùng số migration — PASS`, exit 0 |
| `node scripts/pre-push-gate.mjs` | `36 PASS / 0 SKIP / 0 FAIL — cho phep push`, exit 0 |
| Commit claim + test + fix | pre-commit `gate-credential-split` / `worktree-check` / `claim` PASS; 2 lần phải chạy `normalize-eol.mjs --fix` do LF→CRLF (L-T01), đã fix đúng cách, **không** `--no-verify` |

## 5. `CHƯA CHẠY`

- BE full suite (`market_data`, `market_serving`, `signal_intelligence`) — chỉ chạy scope `data_ingest`.
- FE build / `tsc --noEmit` — slice không sửa FE (pre-push-gate đã tự chạy tsc).
- Probe staging read-only `/bars/` — không thực hiện (Owner Q2 chỉ cho phép đọc, đã đọc đủ bằng test DB tạm).
- Deploy staging — chờ PR + coordinator (Q8).

## 6. Kết luận

S1 đạt tiêu chí REQ-BE-M01: fail-before đỏ thật (`1000 != 501000`), pass-after xanh 4/4, regression không thêm lỗi mới (1 fail trùng base), gate tĩnh xanh. G-3a được phát hiện và sửa trong chính slice này thay vì để dư nợ sang S2.
