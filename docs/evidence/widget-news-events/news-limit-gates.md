# RQ-B2 — News endpoint `limit` — Gates & evidence

> Nguồn yêu cầu: `docs/REQ_BACKEND_FOR_WIDGET_NEWS_EVENTS_20261123.md` (đội widget gửi 2026-11-23).
> RQ-B1 (corporate-actions) + RQ-B3 (wiring adapter) đã xong ở PR #518; slice này chỉ RQ-B2.

## Thay đổi
- `StockManagementNewsView.get`: parse `limit` (default 20, cap 1..100, giá trị hỏng → 20), cache key `stock_news:{symbol}:{limit}`, cắt `news_list[:limit]`.
- `@extend_schema` bổ sung `OpenApiParameter(name='limit')`.
- Không migration, không đổi shape envelope `{symbol, news, note}`, không đụng ingest/adjustment.

## Fail-before (RED) — VPS, worktree `/tmp/wt-news-limit` @ `e972e1fe4`, DB `nlimit_t1`
- Lệnh: `manage.py test market_data.tests.test_stock_news_limit_api --noinput`
- Kết quả: `Ran 5 tests → FAILED (failures=4)` — đỏ đúng 4 case (limit không được áp dụng, cache key không có hậu tố, 2 limit dùng chung cache, cap 100). Log: `/tmp/nlimit_red.log`.

## PASS (GREEN) — cùng worktree @ `422370ba2`
- `Ran 5 tests → OK`, `grep FAIL/ERROR = 0`. Log: `/tmp/nlimit_green.log`.
- Regression `market_data.tests.test_stock_management_native_api` (50 test): `FAILED (failures=1)` — `test_stock_management_technicals_bulk_returns_compatible_technical_payload` (`rsi_14` None). **Pre-existing đã chứng minh**: checkout base `1cb3a767d` (trước slice) chạy riêng test đó → vẫn `FAILED (failures=1)` (`/tmp/nlimit_pre.log`). Slice không đụng file test hay đường technicals.
- Quirk VPS: teardown `DROP DATABASE test_nlimit_t1` race `ObjectInUse` ⇒ exit code 1 dù log `Ran/OK`; verdict đọc từ log (bài học từ Task 1).
- Static: pre-push-gate 36 PASS / 0 FAIL; `py_compile` 0 lỗi; diff 14/2 đúng 3 hunk, EOL LF.

## Dọn
- `docker exec ... DROP DATABASE IF EXISTS test_nlimit_t1, nlimit_t1` + terminate backend; `git worktree remove --force /tmp/wt-news-limit` + prune.

## Kết luận cho widget
RQ-B1 ✅ · RQ-B2 ✅ (slice này) · RQ-B3 ✅. Đủ điều kiện UAT staging; vẫn cần `GITHUB_TOKEN` transient nếu muốn chạy full FE suite/build (đã ghi blocker ở `task3-gates.md`).
