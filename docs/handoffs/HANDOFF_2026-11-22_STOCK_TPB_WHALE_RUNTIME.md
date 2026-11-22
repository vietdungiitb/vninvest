# HANDOFF 2026-11-22 — Stock TPB whale runtime verify

## Phạm vi & trạng thái
- **Ngày**: 2026-11-22 · **Repo**: `vninvest` · **Trạng thái**: `done` (runtime verify + backfill; chờ user test UI).
- **Branch/code**: PR #506 merge vào `dev` @ `3cf85ad5b`; deploy staging qua `bash scripts/deploy-staging.sh`.
- **Evidence doc**: `docs/PLAN_STOCK_TPB_WHALE_DETECT_20261122.md` (mục "Runtime verification") · `docs/CODE_CHANGE_AUDIT_LEDGER.md` Entry 606 · Entry 605 (fix gốc).

## Kết quả đã đo (không suy diễn)
- Worker/beat log sau deploy: task `detect_and_store_global_whale_alerts` nhận và chạy, **không còn `UnboundLocalError`** (`signal_intelligence/tasks.py:101` trước fix).
- `WhaleAlertCanonical`: `max(session_date)` từ `2026-11-06` → `2026-11-20`; 42052 dòng toàn hệ thống.
- Backfill TPB 8 phiên 10→19/11 (`symbol='TPB'`, `session_date` từng ngày): 9/17/13/5/7/8/14/4 whale ticks, tất cả `status='ok'`. Tổng TPB 87 whale ticks (gồm 48 của 06/11 và 10 của 20/11).
- Endpoint `GET /core/v1/workspace/whale-analytics/TPB/?trade_date=...`: HTTP 200, `bubble_series` = 9 (10/11), 8 (17/11), 4 (19/11), 10 (20/11); `resolved trade_date` khớp phiên yêu cầu.
- Đính chính: truy vấn psql đầu trả `(0 rows)` do quoting shell sai, đã chạy lại bằng file SQL — không phải thiếu dữ liệu (L-V02).

## Next steps / owner
1. **User**: mở `https://docker.edusuccess.vn/stocks/TPB`, click nến các ngày 10→20/11; bubble phải đổi theo phiên. Nếu vẫn rỗng, gửi console/network + nhãn "Phiên đang xem" + text chẩn đoán (`vnsc-no-fetch` / `vnsc-widget-error`).
2. **Product**: quyết định TPB lặp 3–4 lần (breadcrumb/hero/card) — giữ chỗ nào.
3. **Product**: quyết định 404 `/core/v1/advisory/latest/TPB/` và `/core/v1/billing/subscription` (chấp nhận fail-closed/gating hay cần endpoint).
4. Không mở rộng sang engine detect/ngưỡng, ingest, FE, hay lỗi celery signal `_b02_mark_run_failed_on_crash()` trong slice này.
