# Sprint 11 Acceptance Checklist

## A. Realtime Contract

- [x] Payload contract dong bo voi docs/WEBSOCKET_EVENT_CONTRACT.md
- [x] Envelope co contract_version, ts, seq

## B. Collector and Compute

- [x] Collector poll 5s hoat dong
- [ ] Retry/backoff/circuit breaker active
- [x] Pandas VWAP tests pass
- [x] Whale detection tests pass

## C. PubSub and Gateway

- [ ] Redis publisher push ticker_update on dinh
- [ ] Redis publisher push whale_alert on dinh
- [x] Channels websocket auth pass
- [x] Subscribe/unsubscribe pass

## D. Reliability

- [x] Fallback ticker API available
- [x] Feature flag realtime on/off pass
- [ ] Error logs co correlation id/sequence

## E. Verification

- [x] Integration test local collector -> channel layer -> websocket UI pass o mode local dev (`REALTIME_CHANNEL_LAYER=inmemory`)
- [ ] Integration test collector -> redis -> websocket pass
- [ ] p95 publish->push < 1.5s
- [x] Dashboard va Watchlist da co vertical slice websocket + fallback polling de test truc quan local
- [x] Sprint 12 handoff package complete

## Ghi chu chot Sprint 11 (2026-04-01)

- Da bo sung local dev mode bang `REALTIME_CHANNEL_LAYER=inmemory` de chay websocket fan-out khi may local chua bat Redis.
- Dashboard da co panel realtime rieng cho market breadth + whale alerts.
- Watchlist da co websocket + polling fallback + connection status.
- Redis-backed end-to-end van la hang muc can chot tren staging/local co Redis that su.

## Delta validation local Redis (2026-04-03)

- `REALTIME_CHANNEL_LAYER=redis`, `REALTIME_ENABLED=true`, Redis local `localhost:6379` reachable.
- `manage.py test portfolio.tests.test_api_routes portfolio.tests.test_realtime_compute portfolio.tests.test_realtime_gateway` PASS.
- `manage.py realtime_tick --sync` tra ve `symbols=4, published=4` trong mode Redis.
- `/api/health/realtime/` tra ve `redis_ok=true`, `/api/health/streams/` tra ve 4 stream keys va `total_ticks=400`.
- `run_stream_consumer_batch(group='all')` xu ly `processed=1200`, ghi `400` ban ghi `IntradayTick` vao DB.
- Khi ha `whale_alert_threshold` cua demo user xuong `1` trieu, collect cycle tra ve `published=7`, xac nhan co phat sinh them whale signal.
- AI advisory task da duoc sua lazy import `httpx`; local path khong co `OPENCLAW_API_KEY` se tra placeholder thay vi crash.
