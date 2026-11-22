# PLAN: Backfill whale toàn thị trường 10→20/11/2026 (tiếp nối Entry 605/606)

## 1. Mục tiêu
- Sau fix `UnboundLocalError datetime` (PR #506), beat chỉ hồi phục phiên hiện tại (20/11);
  8 phiên 10→19/11 vẫn thiếu whale toàn thị trường (trừ TPB đã backfill ở Entry 606).
- Slice này: gọi `detect_and_store_global_whale_alerts(session_date=...)` **không** `symbol`
  (chế độ global, top 500 symbol/phiên — `tasks.py:106-111`) cho từng phiên thiếu + top-up 20/11,
  rồi verify `WhaleAlertCanonical` và endpoint `whale-analytics`.

## 2. Bằng chứng đã tự mở đọc (file:line)
- `packages/core/backend/src/signal_intelligence/tasks.py:3` — `from datetime import datetime, time, timedelta` (module-level, sau fix).
- `tasks.py:51-55` — chữ ký `detect_and_store_global_whale_alerts(self, symbol=None, session_date=None)`.
- `tasks.py:84-97` — resolve `session_date` (str → date; None → `_get_latest_session_date()`).
- `tasks.py:100-111` — khi `symbol=None`, lấy top 500 symbol theo tick count trong ngày.
- `tasks.py:122-125` — `detect_whale_ticks` → `_bulk_write_whale_canonical` (idempotent qua unique `source_ref`).
- `models.py:76-103` — `WhaleAlertCanonical` (`symbol`, `session_date:88`, `executed_at:95`).
- `portfolio_analytics_views.py:2677-2816` — `PortfolioWhaleAnalyticsView` (param `trade_date`, resolve + trả `bubble_series`; query canonical rows `:2811-2816`).

## 3. Baseline đo bằng lệnh thật (VPS staging, 2026-11-22)
- Whale theo phiên (`WhaleAlertCanonical`, từ 01/11):
  `02/11: 2037/130 symbols · 03: 1726/126 · 04: 2050/127 · 05: 1755/120 · 06: 2031/129 ·
  10: 11/1 · 11: 19/1 · 12: 15/1 · 13: 7/1 · 16: 9/1 · 17: 10/1 · 18: 16/1 · 19: 6/1 · 20: 443/110`
  (10→19/11 chỉ có TPB — do Entry 606 backfill riêng TPB).
- Tick (`market_data_intraday_tick`): 14 phiên đều có data, 140–154 symbols/phiên
  (10/11: 23278/146 · 11: 24543/148 · 12: 14019/145 · 13: 20236/151 · 16: 64779/147 ·
  17: 60978/148 · 18: 78644/147 · 19: 24158/145 · 20: 20385/152).
- Probe 19/11 global (trước backfill full): `detect... (session_date='2026-11-19')` →
  `{'status': 'ok', 'whale_ticks_written': 526, 'order_flow_events': 280}` (chạy trong
  `vninvest-core-api`, `manage.py shell`, xong trong vài phút).

## 4. Tiêu chí nghiệm thu (Given/When/Then)
- AC1: Given beat đã fix, When gọi global detect cho mỗi ngày 10,11,12,13,16,17,18,(19 done),20,
  Then mỗi ngày trả `status='ok'` và `whale_ticks_written > 0` (phiên có tick;
  chạy lại idempotent không trùng nhờ dedupe qua `UnifiedAlert.source_ref` + FK OneToOne).
- AC2: When query `GROUP BY session_date` + control `max(price*volume)` vs ngưỡng 500M sau backfill,
  Then **over_threshold_missing = 0** mọi phiên 10→20/11 (mọi symbol-ngày có tick ≥ ngưỡng
  đều có whale rows). Ghi chú: tiêu chí nháp `symbols >= 120` đã bị bác bằng đối chứng §8.2
  (symbol không có rows là thật sự không có tick cá mập) — số symbols/phiên chỉ để tham khảo.
- AC3: When probe `GET /core/v1/workspace/whale-analytics/<SYM>/?trade_date=...` với 2–3 mã
  không phải TPB (vd VCB/HPG), Then HTTP 200 và `bubble_series` khớp số dòng DB cùng phiên.
- AC4: Không đổi code, không migration, không đụng file agent khác; chỉ thêm plan + claim + ledger + handoff.

## 5. SCOPE / LIMIT / non-goals / rollback
- SCOPE (chỉ docs + ops trên VPS): `docs/PLAN_STOCK_WHALE_BACKFILL_ALL_20261122.md` (new),
  `docs/CLAIMS.md` (append 1 dòng), `docs/CODE_CHANGE_AUDIT_LEDGER.md` (append Entry),
  `docs/handoffs/HANDOFF_2026-11-22_STOCK_WHALE_BACKFILL_ALL.md` (new). Chạy detect trong
  container `vninvest-core-api` trên VPS staging. KHÔNG sửa `tasks.py`/FE.
- LIMIT: tối đa 3 vòng chạy lại/phiên nếu lỗi; quá thì ghi `blocker`, giữ partial state.
- Non-goals: không sửa engine detect/ngưỡng (`order_flow_engine`), không đụng ingest/celery signal
  `_b02_mark_run_failed_on_crash` (pre-existing, ticket riêng), không backfill trước 10/11
  (02→06/11 đã đủ), không đụng TPB lặp/advisory-404/billing (chờ product).
- Rollback: detect idempotent (unique `source_ref` — chạy lại không nhân dòng);
  nếu số liệu bất thường, đối chiếu `GROUP BY` trước/sau trong plan và báo, không xóa data tay.

## 6. Lessons áp dụng
- Lessons áp dụng: [L-B01, L-V01, L-V02, L-T01]
- Checklist:
  - [x] Mọi con số kèm lệnh tái tạo (L-V01: control SQL + output 9 phiên paste nguyên văn ở §8.2; vụ psql `(0 rows)` giả ở Entry 606).
  - [x] Root cause kế thừa (`UnboundLocalError`) đã tái hiện fail-before ở Entry 605 (L-V02).
  - [x] Ops chạy trên VPS staging, không local Docker (L-B01 biến thể).
  - [x] Sau ghi file: `git diff --numstat` + `normalize-eol` trước commit (L-T01) — output ở §7.
  - [x] Không commit thẳng `dev`; claim commit riêng trước (`22f8e6617`), PR docs sau B8.

## 7. Gates (chạy 2026-11-22, trước B8)
- `node packages/web/scripts/check-multi-agent.mjs` → `0 lỗi, 0 trùng số migration — PASS`.
- `node scripts/normalize-eol.mjs --fix` → `OK (0 file thay doi, tat ca khop dang blob goc)`; `git diff --check` sạch (không output).
- Verify DB + endpoint (AC2/AC3) bằng lệnh trong §8 (GROUP BY + control + probe); kết quả điền vào §8.
- CHƯA CHẠY: BE/FE suite (không đổi code).

## 8. Kết quả chạy (VPS staging, 2026-11-22)

Lệnh tái tạo (VPS staging, chạy trong `vninvest-core-api` / DB `vninvest_core`):
- Backfill: `docker exec vninvest-core-api sh -c "cd /app/src && python manage.py shell < /tmp/backfill_all.py"`
  (nội dung: `detect_and_store_global_whale_alerts(session_date=<ngày>)` cho từng ngày).
- GROUP BY: `SELECT session_date, count(*), count(DISTINCT symbol) FROM signal_intelligence_whalealertcanonical
  WHERE session_date >= '2026-11-01' GROUP BY session_date ORDER BY session_date;`
- Probe: `GET /core/v1/workspace/whale-analytics/<SYM>/?trade_date=<ngày>` (Client force_login,
  `HTTP_HOST=docker.edusuccess.vn`), đọc `bubble_series` + `resolved trade_date`.

### 8.1 BACKFILL_ALL (toàn thị trường, `symbol=None`)
- 19/11 (chạy thử trước): `{'status': 'ok', 'whale_ticks_written': 526, 'order_flow_events': 280}`.
- 10/11: `ok`, 548 / 342 · 11/11: `ok`, 650 / 309 · 12/11: `ok`, 442 / 280 · 13/11: `ok`, 611 / 314.
- 16/11: `ok`, 527 / 339 · 17/11: `ok`, 1013 / 346 · 18/11: `ok`, 2011 / 356.
- 20/11 (top-up): `ok`, **0 new** / 317 — beat sau deploy đã phủ đủ, rerun idempotent chỉ update `OrderFlowEvent`.
- AC1: PASS (mọi phiên `status='ok'`; 20/11 ghi 0 dòng mới vì đã đủ — đúng semantics idempotent).

### 8.1b Đối chiếu số học: `baseline + written` vs `GROUP BY` (ground truth là GROUP BY)
- `whale_ticks_written` = `len(canonical_to_create)` (`tasks.py:387`) — số **attempted** sau khi lọc
  `existing_refs` (`:300-308`) và canonical đã có (`:346-351`); `bulk_create(..., ignore_conflicts=True)`
  (`:375`) drop im lặng các dòng xung đột PK (`alert` là OneToOne primary_key — `models.py:81-86):
  trùng `source_ref` nội batch gộp về 1 `UnifiedAlert` nhưng append 2 canonical cùng `alert_id` → dòng
  thứ 2 rớt; cộng writer song song (beat) và 2 dòng synthetic của pipeline `native_order_flow_events`
  (xem §8.3). Hướng lệch luôn âm, độ lớn 0.6–6.6%:
- `10: 11+548=559 vs 552 (−7) · 11: 19+650=669 vs 651 (−18) · 12: 15+442=457 vs 439 (−18) ·
  13: 7+611=618 vs 614 (−4) · 16: 9+527=536 vs 530 (−6) · 17: 10+1013=1023 vs 955 (−68) ·
  18: 16+2011=2027 vs 2003 (−24) · 19: 6+526=532 vs 528 (−4) · 20: 443+0=443 vs 443 (0)`.
- Δ68 ở 17/11 (6.6%) là gộp nhiều intra-batch dup + xung đột beat cùng khung giờ; không có exception,
  không mất dòng thật (đối chứng §8.2 cho thấy mọi symbol-ngày có tick ≥ ngưỡng đều có rows).

### 8.2 GROUP BY sau backfill (AC2 — ĐÍNH CHÍNH tiêu chí)
- `10: 552/109 · 11: 651/103 · 12: 439/101 · 13: 614/109 · 16: 530/76 · 17: 955/100 ·
  18: 2003/106 · 19: 528/99 · 20: 443/110` (so nền 02→06/11: ~1700–2000 / 120–130).
- Tiêu chí `symbols >= 120` (R-2) KHÔNG đạt — nhưng đối chứng cho thấy tiêu chí sai, không phải data thiếu.
  Control nguyên văn (ngưỡng `WHALE_VALUE_MIN_VND = 500_000_000`, `order_flow_engine.py:31`;
  engine tính `value = price×volume`, `:101` + `:256` — metric control khớp semantics engine):
```sql
WITH tick_stats AS (
  SELECT ((timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) AS d, symbol,
         max((price * volume)) AS max_val
  FROM market_data_intraday_tick
  WHERE timestamp >= '2026-11-09 17:00:00+00' AND timestamp < '2026-11-20 17:00:00+00'
  GROUP BY d, symbol
),
whale_stats AS (
  SELECT DISTINCT session_date AS d, symbol
  FROM signal_intelligence_whalealertcanonical
  WHERE session_date BETWEEN '2026-11-10' AND '2026-11-20'
)
SELECT t.d, count(*) AS symbols_no_whale,
       sum(CASE WHEN t.max_val >= 500000000 THEN 1 ELSE 0 END) AS over_threshold_missing
FROM tick_stats t LEFT JOIN whale_stats w ON t.d = w.d AND t.symbol = w.symbol
WHERE w.symbol IS NULL
GROUP BY t.d ORDER BY t.d;
```
  Output đủ 9 phiên:
```
     d      | symbols_no_whale | over_threshold_missing
------------+------------------+------------------------
 2026-11-10 |               37 |                      0
 2026-11-11 |               45 |                      0
 2026-11-12 |               44 |                      0
 2026-11-13 |               42 |                      0
 2026-11-16 |               71 |                      0
 2026-11-17 |               48 |                      0
 2026-11-18 |               41 |                      0
 2026-11-19 |               46 |                      0
 2026-11-20 |               42 |                      0
```
  (Chi tiết 16/11: top-30 symbol theo max tick đều có whale rows; 71 symbol thiếu rows thì
  **0** symbol nào có tick ≥ 500M, max nhóm thiếu = 486M.)
- Kết luận: mọi symbol-ngày có tick cá mập đều đã có whale rows; symbol không có rows là
  thật sự không có tick ≥ ngưỡng. AC2 sửa thành: **over_threshold_missing = 0 mọi phiên** — PASS.

### 8.3 Probe non-TPB (AC3) — PASS
- Endpoint (`resolved trade_date` khớp phiên yêu cầu, HTTP 200):
  `VCB 18/11 → 53 bubbles · HPG 18/11 → 49 · VIC 16/11 → 38 · TPB 18/11 → 14`.
- Đối chiếu DB (`SELECT symbol, session_date, count(*) ... GROUP BY`, cùng 4 cặp):
  `VCB 18/11 → 53 · HPG 18/11 → 49 · VIC 16/11 → 38 · TPB 18/11 → 16`.
- 3/4 khớp tuyệt đối. TPB 18/11 lệch 16 vs 14: 2 dòng DB dư có
  `source_ref LIKE 'tick_session:%'`, metadata `source='native_order_flow_events'`,
  `matched_value` tròn 5B, `executed_at = 2026-11-22 07:21 UTC` (giờ chạy backfill, không phải giờ phiên) —
  dòng synthetic của pipeline native khác, ngoài scope slice này; view lọc đúng qua
  time-bounds (`portfolio_analytics_views.py:2835-2840`) nên bubble vẫn đúng 14 dòng phiên thật.
