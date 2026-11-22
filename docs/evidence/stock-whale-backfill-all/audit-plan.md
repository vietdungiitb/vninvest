# Audit plan — stock-whale-backfill-all (B3, auditor độc lập read-only)

- **Ngày**: 2026-11-22 · **Plan**: `docs/PLAN_STOCK_WHALE_BACKFILL_ALL_20261122.md`
- **Verdict**: **AGREE** (có reservation, không chặn).

## Đối chiếu file:line — PASS hết
- `tasks.py:3` import module-level; `:51-55` chữ ký `(symbol=None, session_date=None)`;
  `:84-97` resolve session_date; `:100-111` global top 500 theo tick đúng phiên (`_TICK_MAX_SYMBOLS_PER_RUN:25`);
  `:122-125` detect → `_bulk_write_whale_canonical`.
- `models.py:76-103` `WhaleAlertCanonical` (`symbol:87`, `session_date:88`, `executed_at:95`).
- `portfolio_analytics_views.py:2677-2816` (class `:2677`, param `trade_date`, query canonical `:2811-2816`).

## Logic & baseline
- Global backfill per-session_date là đúng cách (top-N tính trên tick đúng phiên).
- Pattern thiếu 10→19/11 (chỉ 1 symbol = TPB, khớp Entry 606) vs tick đủ 140+ symbols/phiên: hợp lý.
- 20/11 `443/110` = phục hồi một phần → top-up hợp lý.
- Idempotent: dedupe qua `UnifiedAlert.source_ref` (unique `:60-66` + `ignore_conflicts` + check canonical);
  `WhaleAlertCanonical` không có unique riêng nhưng không nhân dòng nhờ FK OneToOne; `OrderFlowEvent` rerun thì update.

## Reservations (đã đưa vào plan)
- R-1: AC1 `>= 0` vacuous → đã sửa thành `> 0` (phiên có tick).
- R-2: AC2 `>= 100` lỏng → đã sửa thành `>= 120` (hoặc `>= tick_symbols`).
- R-3: range views → đã sửa `2677-2816`.
- R-4: §7 "mục 8" → đã sửa + bổ sung lệnh tái tạo trong §8.
- R-5: số §3 kèm lệnh tái tạo khi chạy (L-V01) → §8 đã có lệnh; điền kết quả sau job.

## Scope
- Docs-only + ops VPS; không migration, không deny-list, không đụng file agent khác.
