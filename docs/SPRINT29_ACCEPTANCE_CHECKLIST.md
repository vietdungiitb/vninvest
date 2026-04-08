# Sprint 29 Acceptance Checklist — AI Advisory + Kline Chart Context

## A. Backend contract
- [x] Endpoint generate components nhan duoc `chart_context` optional.
- [x] Payload invalid khong crash request, co fallback.
- [x] Response co `chart_context_used`.
- [x] Response co `chart_context_warnings` khi can.

## B. Prompt integration
- [x] Prompt co chart context block khi payload hop le.
- [x] Prompt khong co chart block khi payload khong hop le/khong gui.
- [x] Clamp ohlcv point count dung gioi han.

## C. Frontend integration
- [x] FE build duoc chart_context tu Kline chart hien tai.
- [x] FE gui payload moi khi bam tao AI tab.
- [x] FE fallback ve payload cu neu collector loi.
- [x] Badge/warning UI hien dung theo response flags.

## D. Regression
- [x] Toggle tat ca indicator (MA/EMA/BOLL/MACD/RSI/KDJ/STOCH/SAR/ATR/OBV/VOL) hoat dong dung.
- [x] Screenshot/fullscreen + timeframe toolbar hoat dong dung sau khi bo drawing tools.
- [x] Stock detail khong crash khi khong co chart data.

## E. QA matrix
- [ ] VNM / VCB / FPT pass API + E2E.
- [ ] 3 timeframe pass (15m/30m/1h hoac set duoc support).
- [x] Co case payload invalid, oversize, missing fields.

## F. Performance & reliability
- [ ] p95 latency tang <=15%.
- [ ] failure rate tang <=1% absolute.
- [x] telemetry du de phan tich chart-context usage.

## G. Release gate
- [ ] Feature flag co the bat/tat runtime.
- [ ] Canary 10% pass 24-48h.
- [ ] Rollback plan da dry-run.
- [ ] PM/QA/BE/FE sign-off.
