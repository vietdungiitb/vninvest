# Task 1 — Gates & evidence (BE corporate-actions read API)

## Fail-before (RED) — VPS staging, 2026-11-23

- Lệnh (worktree `/tmp/wt-widget-news-events` tại commit test-only `7c6c1da6b`, DB tạm `wne_t1`, image `vninvest-core-api:staging`):
  `manage.py test market_data.tests.test_corporate_action_read_api --noinput`
- Kết quả: `Ran 9 tests → FAILED (failures=3, errors=5)`. 8/9 đỏ; test còn lại (`unknown_symbol_404`) xanh giả vì route chưa tồn tại cũng 404 — sẽ kiểm lại ở vòng xanh (L-V04).
- Mẫu lỗi (xác nhận đỏ đúng chỗ thiếu route, không phải bug setup): `KeyError: 'count'` tại `test_explicit_range_reaches_old_event` (`test_..._read_api.py:143`) — response 404 không có envelope `count`; `test_route_exists...` FAIL `404 != 200`.
- Log đầy đủ: `/tmp/wne_red.log` trên VPS (đã lấy tóm tắt qua grep `^(Ran|OK|FAILED|FAIL|ERROR):`).

## PASS (GREEN) — VPS staging, 2026-11-23

- Lệnh: cùng worktree cập nhật tới commit implementation `96d297450` (test 10 case), DB tạm `wne_t1`.
- Kết quả: `Ran 10 tests → OK`, `grep FAIL/ERROR = 0`. Bao gồm `test_limit_caps_results` (mới ở commit xanh) và `unknown_symbol_404` — lần này xanh vì view raise `NotFound` thật (không còn xanh giả).
- Quirk môi trường (ghi nhận, không phải fail): runner exit 1 do teardown `DROP DATABASE test_wne_t1` race `ObjectInUse` ("2 other sessions") — xảy ra y hệt ở vòng đỏ; verdict lấy từ log (`Ran/OK`, 0 `FAIL:`/`ERROR:`), không từ exit code.
- Regression cùng worktree/DB: `test_corporate_action_ingest + parser + adjustment + sync_task + models + ohlcv_bars` → `Ran 71 tests → OK`, 0 FAIL/ERROR.
- Dọn (BẮT BUỘC, đã chạy): terminate sessions còn sót + `DROP DATABASE test_wne_t1, wne_t1` + `worktree remove --force /tmp/wt-widget-news-events` + `prune`. Worktree agent khác trên VPS không chạm.
