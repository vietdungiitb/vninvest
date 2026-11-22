# HANDOFF 2026-11-22 — Stock whale backfill toàn thị trường

## Phạm vi & trạng thái
- **Ngày**: 2026-11-22 · **Repo**: `vninvest` · **Trạng thái**: `ops-done, chờ B8/PR (backfill + verify xong staging; B8 r2 PASS; chờ merge PR docs rồi user test UI)`
- **Branch/code**: `feat/stock-whale-backfill-all` → `dev` (PR docs-only, KHÔNG đổi source).
- **Evidence**: `docs/PLAN_STOCK_WHALE_BACKFILL_ALL_20261122.md` (§8 kết quả) ·
  `docs/evidence/stock-whale-backfill-all/audit-plan.md` (B3 AGREE) · ledger Entry 607.

## Kết quả đã đo (không suy diễn)
- Backfill global 9 phiên (`detect_and_store_global_whale_alerts`, `symbol=None`):
  10/11 → 548, 11 → 650, 12 → 442, 13 → 611, 16 → 527, 17 → 1013, 18 → 2011,
  19 → 526, 20/11 → 0 dòng mới (beat đã phủ đủ). Tất cả `status='ok'`.
- GROUP BY sau backfill: `10: 552/109 · 11: 651/103 · 12: 439/101 · 13: 614/109 ·
  16: 530/76 · 17: 955/100 · 18: 2003/106 · 19: 528/99 · 20: 443/110`.
- Đối chứng ngưỡng 500M (`order_flow_engine.py:31`): cả 9 phiên `over_threshold_missing = 0` —
  mọi symbol-ngày có tick cá mập đều đã có whale rows; symbol thiếu rows là thật sự không có tick ≥ ngưỡng.
- Probe `GET /core/v1/workspace/whale-analytics/<SYM>/?trade_date=...`: VCB 18/11 → 53,
  HPG 18/11 → 49, VIC 16/11 → 38, TPB 18/11 → 14 bubbles (HTTP 200).

## Next steps / owner
1. **User**: mở `https://docker.edusuccess.vn/stocks/<SYM>` (TPB và thêm VCB/HPG/VIC),
   click nến các ngày 10→20/11; bubble phải đổi theo phiên. Nếu vẫn rỗng, gửi console/network +
   nhãn "Phiên đang xem" + text chẩn đoán (`vnsc-no-fetch` / `vnsc-widget-error`).
2. **Product**: TPB lặp 3–4 lần (breadcrumb/hero/card) và 404 advisory/billing — chờ quyết định, ngoài scope slice này.
3. Không mở rộng sang engine detect/ngưỡng, ingest, hay lỗi celery signal `_b02_mark_run_failed_on_crash()`.
