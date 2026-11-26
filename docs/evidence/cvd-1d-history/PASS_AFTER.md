# PASS-AFTER + REGRESSION — CVD 1D history (BE `cvd-1d-history-be`)

- **Ngày:** 2026-11-26 · **Commit:** `5bee4ea2f` trên `feat/cvd-1d-history-be`
- **Môi trường:** VPS staging `14.225.255.47`, image `vninvest-core-api:staging`, DB tạm `cvd1d_verify`,
  worktree VPS `/tmp/wt-cvd1d`.
- **Lệnh:** xem `FAIL_BEFORE.md` (cùng lệnh, thêm `-e CORE_DB_CONN_MAX_AGE=0`, 3 test labels).

## Kết quả thật

```
Ran 44 tests in 2.031s
OK
```

| Nhóm | Số test | Kết quả |
|---|---|---|
| `tests.test_cvd_1d_history_api` (T-01..T-11, slice mới) | 11 | **OK** |
| `tests.test_session_facts_api` (regression legacy/range/scope) | ? | **OK** (gộp trong 44) |
| `tests.test_market_serving_api_routes` (regression route + envelope) | ? | **OK** (gộp trong 44) |

> Tổng 44 = 11 mới + 33 regression. Không tách số từng file vì lệnh chạy gộp; chỉ khẳng định tổng và
> `OK` — không suy ra con số từng nhóm (L-T02).

Fail-before tại commit `c166374d0`: `Ran 11 tests`, `FAILED (failures=4, errors=1)` → sau fix **11/11 OK**.
Bằng chứng: `docs/evidence/cvd-1d-history/FAIL_BEFORE.md`.

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
