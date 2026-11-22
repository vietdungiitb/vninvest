# HANDOFF 2026-11-22 — stock-tpb-whale-detect

- **Scope/date**: 2026-11-22 · fix whale-detect chết toàn hệ thống từ ~06/11 (biểu hiện: `/stocks/TPB` các phiên gần đây không có bubble mua/bán cá mập).
- **Branch/commit**: `feat/stock-tpb-whale-detect` (từ `dev` @ `fd4338f2e`) · claim `stock-tpb-whale-detect` → done · Entry 605.
- **Status**: `done` (code + test + B8 PASS); **S3 deploy/backfill CHƯA CHẠY** tại thời điểm viết.

## Kết quả + evidence

- Root cause: `packages/core/backend/src/signal_intelligence/tasks.py:86` import local `datetime` trong nhánh `if` → `UnboundLocalError` ở `:101` trên đường beat (`session_date=None`). DB staging `WhaleAlertCanonical` max `session_date=2026-11-06`, 0 dòng 8 ngày gần nhất; TPB intraday ticks vẫn 9364 dòng/30 ngày (tới 20/11). `PortfolioWhaleAnalyticsView` trả đúng 48 bubbles cho 06/11 khi gọi với `trade_date` → chứng minh FE/adapter/view không lỗi.
- Fix: xóa 1 dòng import local; T-D3 trong `tests/test_detect_historical.py` đổi thành fail-before thật (mock latest trả `date` + qs rỗng, assert `status='ok'`).
- Gates chạy thật trên VPS (DB riêng `ag_stock_tpb_whale`, đã DROP): fail-before `Ran 4 tests — FAILED (errors=1)` đúng `UnboundLocalError tasks.py:101` → pass-after 4/4 OK → full app `signal_intelligence` 77 tests OK. `check-multi-agent` PASS, `check-lessons` 60/60 sạch, `git diff --check` 0. Auditor độc lập: B3 r1 NEED_REVISION → r2 PASS; B8 r1 NEED_REVISION (thiếu evidence) → r2 PASS.
- Ngoài scope, ghi nhận không sửa: `_b02_mark_run_failed_on_crash() missing 1 required positional argument: 'exc'` (`data_ingest/tasks.py:31,62`) — celery signal pre-existing.

## Next steps / owner

1. Merge PR vào `dev`, deploy staging (`bash scripts/deploy-staging.sh`), verify beat log hết `UnboundLocalError` + có whale rows mới.
2. Backfill 9 phiên 10→20/11 (TPB có snapshot) qua `detect_and_store_global_whale_alerts(session_date='YYYY-MM-DD')`, kiểm count/`bubble_series` qua endpoint whale-analytics.
3. User test lại `/stocks/TPB`: click nến phiên gần đây → bubble hiển thị.
4. Ticket riêng: celery signal handler `exc`; TPB lặp 3–4 lần (breadcrumb/hero/card) chờ product quyết định giữ chỗ nào.
