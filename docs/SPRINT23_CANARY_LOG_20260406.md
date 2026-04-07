# Sprint 23 Canary Log (2026-04-06)

Trang thai: LOCAL RUNTIME DRILL COMPLETED

## 1) Baseline before canary

- Time: 2026-04-05T19:34:21+07:00
- Intraday p95: N/A (khong co traffic trong local drill) ms
- PriceBoard p95: N/A (khong co traffic trong local drill) ms
- Whale aggregate p95: N/A (khong co traffic trong local drill) ms
- HTTP 5xx ratio: 0.0 %
- Fallback ratio: 0.0 %
- External timeout ratio: 0.0 %

## 2) Canary 10%

- Start: 2026-04-05T19:34:21+07:00
- End: 2026-04-05T19:35:18+07:00
- Traffic split method: ENABLE_NEW_MARKET_VIEWS=true + MARKET_VIEWS_CANARY_PERCENT=10 (deterministic by user/ip)
- KPI snapshot:
  - Intraday p95: N/A ms
  - PriceBoard p95: N/A ms
  - Whale aggregate p95: N/A ms
  - HTTP 5xx ratio: 0.0 %
  - Fallback ratio: 0.0 %
  - External timeout ratio: 0.0 %
  - Realtime ticker p95 (observed): 120.53 ms
- Trigger crossed: NO
- Decision: GO 50%
- Owners confirm: Copilot local drill (auto evidence)

## 3) Canary 50%

- Start: 2026-04-05T19:35:18+07:00
- End: 2026-04-05T19:35:49+07:00
- KPI snapshot:
  - Intraday p95: N/A ms
  - PriceBoard p95: N/A ms
  - Whale aggregate p95: N/A ms
  - HTTP 5xx ratio: 0.0 %
  - Fallback ratio: 0.0 %
  - External timeout ratio: 0.0 %
  - Realtime ticker p95 (observed): 106.59 ms
- Trigger crossed: NO
- Decision: GO 100%
- Owners confirm: Copilot local drill (auto evidence)

## 4) Canary 100%

- Start: 2026-04-05T19:35:49+07:00
- End: 2026-04-05T19:36:33+07:00
- KPI snapshot:
  - Intraday p95: N/A ms
  - PriceBoard p95: N/A ms
  - Whale aggregate p95: N/A ms
  - HTTP 5xx ratio: 0.0 %
  - Fallback ratio: 0.0 %
  - External timeout ratio: 0.0 %
  - Realtime ticker p95 (observed): 120.08 ms
- Trigger crossed: NO
- Decision: STAY 100% (truoc khi chay rollback rehearsal)
- Owners confirm: Copilot local drill (auto evidence)

## 5) Notes

- Incident/alerts: Khong co incident trong local drill.
- Contract mismatch: Khong phat hien mismatch tren ticker endpoint duoc smoke.
- Additional follow-up: Can chay lai tren staging voi traffic thuc cho intraday/price-board/whale-aggregate de chot KPI day du.
