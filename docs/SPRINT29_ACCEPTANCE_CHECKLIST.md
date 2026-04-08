# Sprint 29 Acceptance Checklist — AI Advisory + Kline Chart Context

## A. Backend contract
- [ ] Endpoint generate components nhan duoc `chart_context` optional.
- [ ] Payload invalid khong crash request, co fallback.
- [ ] Response co `chart_context_used`.
- [ ] Response co `chart_context_warnings` khi can.

## B. Prompt integration
- [ ] Prompt co chart context block khi payload hop le.
- [ ] Prompt khong co chart block khi payload khong hop le/khong gui.
- [ ] Clamp ohlcv point count dung gioi han.

## C. Frontend integration
- [ ] FE build duoc chart_context tu Kline chart hien tai.
- [ ] FE gui payload moi khi bam tao AI tab.
- [ ] FE fallback ve payload cu neu collector loi.
- [ ] Badge/warning UI hien dung theo response flags.

## D. Regression
- [ ] Toggle tat ca indicator (MA/EMA/BOLL/MACD/RSI/KDJ/STOCH/SAR/ATR/OBV/VOL) hoat dong dung.
- [ ] Screenshot/fullscreen/drawing tools khong bi anh huong.
- [ ] Stock detail khong crash khi khong co chart data.

## E. QA matrix
- [ ] VNM / VCB / FPT pass API + E2E.
- [ ] 3 timeframe pass (15m/30m/1h hoac set duoc support).
- [ ] Co case payload invalid, oversize, missing fields.

## F. Performance & reliability
- [ ] p95 latency tang <=15%.
- [ ] failure rate tang <=1% absolute.
- [ ] telemetry du de phan tich chart-context usage.

## G. Release gate
- [ ] Feature flag co the bat/tat runtime.
- [ ] Canary 10% pass 24-48h.
- [ ] Rollback plan da dry-run.
- [ ] PM/QA/BE/FE sign-off.
