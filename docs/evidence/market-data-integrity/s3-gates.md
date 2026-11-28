# BẰNG CHỨNG CỔNG S3 — REQ-BE-M03 + G-2: Idempotency IntradayTick

- **Ngày:** 2026-11-28 · **Branch:** `feat/m03-tick-dedup` · **Base:** `origin/dev @ 4f9c99dd0`
- **Claim:** `m03-tick-dedup` (`fa8141cf0`, khai trước code).

## 1. Probe G-2 (read-only, staging Postgres, 2026-11-28)

```sql
WITH d AS (SELECT max(date(timestamp)) d FROM market_data_intraday_tick WHERE symbol IN ('VIC','FPT'))
SELECT t.symbol, count(*) total_ticks,
       count(*) - count(DISTINCT (t.timestamp,t.price,t.volume,t.side,t.match_type)) dup_exact,
       count(DISTINCT date_trunc('second', t.timestamp)) distinct_seconds
FROM market_data_intraday_tick t, d
WHERE t.symbol IN ('VIC','FPT') AND date(t.timestamp)=d.d GROUP BY t.symbol;
```

| Mã | total_ticks | dup_exact | distinct_seconds |
|---|---:|---:|---:|
| VIC | 120 | 0 | 110 |
| FPT | 368 | 0 | 304 |

Provider DNSE: `inspect.getsource(DNSEQuote)` → `HITS = ['EmptyProviderResult', 'provider', 'side']` — **không có `matchId`/`trade_id`/`seq`**. Vì vậy theo Owner decision Q3 dùng **`seq_in_key`** (đánh số theo thứ tự xuất hiện của tuple giống nhau trong 1 fetch đủ ngày).

## 2. Thay đổi

| File | Nội dung |
|---|---|
| `market_data/tick_dedup.py` (mới) | `build_dedup_key` (sha256 64 ký tự, gồm `seq_in_key`) + `assign_dedup_keys` |
| `market_data/models.py` | `IntradayTick.dedup_key` CharField(64) + **partial** `UniqueConstraint(..., condition=Q(dedup_key__gt=''))` |
| `market_data/migrations/0015_intradaytick_dedup_key_and_more.py` | AddField → **RunPython backfill Python `sha256` theo cùng chuẩn hóa với runtime** (`row_number()` partition làm tie-break) → AddConstraint partial (backfill trước khi unique) |
| `data_ingest/tasks.py` | 3 write-path: warm in-memory dedup đổi sang `dedup_key`; `backfill_*_system`/`_user` truyền `dedup_key=t['dedup_key']` |
| `docs/system-design/**` | sync generated catalog: 152 migration (từ 151), model catalog, inventory/freshness; `--check` exit 0 |

## 3. Fail-before / pass-after (VPS, DB tạm `s3_dedup_m03`)

| Lần | Commit | Kết quả |
|---|---|---|
| Fail-before | test-only | `ModuleNotFoundError: No module named 'market_data.tick_dedup'`, `FAILED (errors=1)`, `TEST_EXIT=1` |
| Pass-after (bản cuối) | fix + test (sau O1–O4) | `Ran 7 tests ... OK`, `TEST_EXIT=0` (DB tạm `s3_dedup_m03`) |

**Chống xanh giả (L-V04):** (a) `test_g2_same_second_orders_get_different_keys` assert 2 tuple giống hệt cho 2 key **khác nhau** — nếu hash phẳng như RFC cũ thì fail; (b) `test_duplicate_insert_without_ignore_conflicts_raises` assert `IntegrityError` thật → chứng minh UniqueConstraint có tác dụng; (c) `test_duplicate_insert_is_ignored` assert **số row không tăng** (không dùng `len(created)==0` vì Django 6 trả object dù bỏ qua insert — đã ghi rõ trong test); (d) positive control: tick khác timestamp → count tăng đúng 1.

> Django 6 `bulk_create(ignore_conflicts=True)` trả danh sách đầy đủ object, không phản ánh insert thật — assert đã được điều chỉnh theo API thật, không phải hạ assert để xanh giả.

## 4. Migration end-to-end (VPS DB tạm `s3_mig_m03e` — bản cuối sau O2)

1. Full migrate → reverse `market_data` về `0014`.
2. Seed **3 row trùng hoàn toàn** `(VIC, 2026-11-25 03:00 UTC, 100000, 100, BUY, NormalMatch, vnbroker_intraday)` → `dup_rows_before = 3`.
3. `manage.py migrate market_data 0015` → **OK**.
4. Kiểm tra: `total=3, distinct_keys=3, min_len=64` — **sha256 y hệt runtime** (bản đầu dùng md5 32 đã bị thay).
5. Partial index: `CREATE UNIQUE INDEX uniq_intraday_tick_dedup_key ... WHERE ((dedup_key)::text > ''::text)`; 2 row `dedup_key=''` insert OK; duplicate key thật → `ERROR: duplicate key value violates unique constraint`.
6. **R2 (reservation):** migration tie-break theo `id` (ổn định trên DB), runtime tie-break theo thứ tự provider trong cùng timestamp — giả định provider giữ thứ tự khi retry. Đã sort theo timestamp ở `assign_dedup_keys`; nếu provider đổi thứ tự *trong cùng giây* thì seq có thể đổi — ghi nhận là nợ theo dõi, không chặn S3.

## 4b. Sửa theo re-audit v1 (`S3_REAUDIT.md`, verdict `NEED_REVISION`)

| ID | Mức | Fix |
|---|---|---|
| O1 | BLOCKER | **ĐÃ SỬA**: `UniqueConstraint(..., condition=Q(dedup_key__gt=''))` — Django sinh **partial unique index** `WHERE dedup_key > ''`. Verify VPS: 2 row `dedup_key=''` insert OK; 2 row cùng key `real_key_123` → `ERROR: duplicate key value violates unique constraint`. Fixture cũ không vỡ. |
| O2 | MAJOR | **ĐÃ SỬA**: migration backfill giờ dùng **Python `sha256` + cùng chuẩn hóa** với `tick_dedup.build_dedup_key` (đã sửa `_norm_price` trong helper để key ổn định giữa float provider và Decimal DB). Verify: 3 row trùng → 3 key, `min_len=64` (không còn md5 32). |
| O3 | MED | **ĐÃ SỬA**: `assign_dedup_keys` tự sort theo timestamp (Python sort ổn định giữ thứ tự provider khi cùng giây). |
| O4 | MED | **ĐÃ SỬA**: import helper chuyển vào `setUp`; thêm `IntradayTickDedupConstraintTests` chạy được trên code cũ, assert trực tiếp constraint tồn tại (tín hiệu đỏ hành vi thay vì chỉ `ModuleNotFoundError`). |
| O5 | Reservation | B9 rebase + chạy lại gate, Entry **683** (re-check head lúc merge). |

## 5. Gate tĩnh

| Gate | Kết quả |
|---|---|
| `py_compile` (helper/model/migration/tasks/test) | exit 0 (chạy đúng cwd backend) |
| `makemigrations --check --dry-run` | `No changes detected`, exit 0 |
| `node packages/web/scripts/check-multi-agent.mjs` | `0 lỗi, 0 trùng số migration — PASS` |
| `node scripts/pre-push-gate.mjs` | `36 PASS / 0 SKIP / 0 FAIL` |
| `check-system-design --check` | `SACH — exit 0` (sau khi chạy `--write` + sửa C-003 151→152 bằng tay) |
| EOL | `normalize-eol.mjs --fix` 2 lần, fix đúng, không `--no-verify` |

## 6. `CHƯA CHẠY`

- Regression full `market_data` + `data_ingest`: **CHƯA CHẠY ĐƯỢC** — image `vninvest-core-api:staging` trên VPS thiếu module `vninvest_core.utils.encryption` khi chạy migration `user_workspace/0017` (`ModuleNotFoundError`); lỗi môi trường image, không phải diff S3. Đã chạy riêng scope S3 (5/5 OK) + migration end-to-end (3 trùng → 3 key).
- Deploy/probe staging ghi — **bị khóa Q2**, không thực hiện.
- FE build/tsc — pre-push-gate đã tự chạy tsc.

## 7. Kết luận

S3 đạt REQ-BE-M03 + G-2: không nuốt lệnh trùng giây (`seq_in_key`), backfill ×2 không tăng row, migration chạy được trên DB có sẵn bản trùng. Entry sẽ cập nhật sau rebase (678–682 đã bị chiếm).
