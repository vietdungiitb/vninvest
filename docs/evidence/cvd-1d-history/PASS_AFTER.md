# PASS-AFTER + REGRESSION — CVD 1D history (BE `cvd-1d-history-be`)

- **Ngày:** 2026-11-26 · **Commit cuối cùng đã chạy:** `665767ce0` trên `feat/cvd-1d-history-be`
  (lần chạy trước tại `5bee4ea2f`: 44 tests OK — giữ ở đây làm lịch sử).
- **Môi trường:** VPS staging `14.225.255.47`, image `vninvest-core-api:staging`, DB tạm `cvd1d_verify`,
  worktree VPS `/tmp/wt-cvd1d`.
- **Lệnh:** xem `FAIL_BEFORE.md` (cùng lệnh, thêm `-e CORE_DB_CONN_MAX_AGE=0`, 3 test labels).

## Kết quả thật

```
=== BE TEST 665767ce0 ===
Ran 45 tests in 1.878s
OK
TEST_EXIT=1        # teardown ObjectInUse, xem mục bên dưới
CLEANUP_DONE db=cvd1d_verify wt=/tmp/wt-cvd1d
```

| Nhóm | Số test | Kết quả |
|---|---|---|
| `tests.test_cvd_1d_history_api` (T-01..T-12, slice mới) | 12 | **OK** |
| `tests.test_session_facts_api` (regression legacy/range/scope) | ? | **OK** (gộp trong 45) |
| `tests.test_market_serving_api_routes` (regression route + envelope) | ? | **OK** (gộp trong 45) |

> Tổng 45 = 12 mới + 33 regression (số regression suy từ `45−12` tại artifact `665767ce0`, không đo
> riêng từng file — ghi rõ để tránh bịa số, L-T02). Lần trước: `Ran 44 tests … OK` tại `5bee4ea2f`.

Fail-before tại commit `c166374d0`: `Ran 11 tests`, `FAILED (failures=4, errors=1)` → sau fix **12/12 OK**
(T-12 được thêm để khoá biên UTC/local). Bằng chứng: `docs/evidence/cvd-1d-history/FAIL_BEFORE.md`.

### O-1 (re-audit) đã xử lý

- Fixture anchor đổi từ `timezone.localdate()` → `timezone.now().date()` (UTC) để khớp path legacy
  `views.py:81`; history expectations dùng `localdate()` riêng (`views.py:403`). Không sửa logic legacy.
- **T-12** patch `timezone.now()`/`localdate()` về instant `2026-11-26T20:00Z` (= `03:00+07` ngày 27),
  tức khung 00:00–06:59+07 mà re-audit nêu — assert legacy trả session UTC, history trả `date_to`
  local, parity bucket cuối đúng. Chạy cùng VPS `665767ce0` → OK.
- **Trung thực:** khung biên được **mô phỏng bằng patch clock trong T-12**, không phải đổi đồng hồ VPS
  rồi chạy lại 2 lần. Khung thường (08:xx+07) được chạy thật. M-4 (`revision=0` ở history empty) cũng
  đã set lại `revision` thật trong cùng commit `665767ce0`.

## Sự cố teardown (môi trường, KHÔNG phải test fail)

Sau khi in `OK`, Django teardown vẫn báo `psycopg2.errors.ObjectInUse: database "test_cvd1d_verify" is
being accessed by other users` ⇒ tiến trình `manage.py test` trả `TEST_EXIT=1` dù **mọi test đã OK**.
Đã xử lý bằng cleanup `DROP DATABASE ... WITH (FORCE)` trong script. Kiểm chứng sau chạy:

- `SELECT datname FROM pg_database` → **0** database `cvd1d*` (DB tạm + test DB đã xoá)
- `git -C /opt/vninvest worktree list | grep -i cvd1d` → **NONE**

## Gate khác

| Gate | Lệnh | Kết quả |
|---|---|---|
| Python syntax | `python -m py_compile src/market_serving/views.py tests/test_cvd_1d_history_api.py` | exit 0 |
| Django check | `CORE_DATABASE_URL=... DJANGO_DEBUG=1 python manage.py check` | exit 0, "System check identified no issues" |
| EOL | `node scripts/normalize-eol.mjs --fix` (bắt buộc bởi hook L-T01) | đã convert `views.py` LF, commit sau đó sạch |
| Pre-push | `node scripts/pre-push-gate.mjs` (tự chạy lúc push) | **36 PASS / 0 FAIL** |
| Multi-agent | `node packages/web/scripts/check-multi-agent.mjs` | exit 0, 0 lỗi, 0 trùng migration |
| `npx tsc --noEmit` | không chạy riêng (slice không đụa TS; pre-push đã gọi tsc qua node_modules junction) | — |
