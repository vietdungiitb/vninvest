# Sprint 11 Detailed Plan - Realtime Backend Core

Muc tieu Sprint 11:
- Hoan tat backend core cho realtime event-driven pipeline.
- Co vertical slice chay duoc tu collector den websocket gateway.

Scope:
1. Celery collector poll 5s theo tracked symbols.
2. Pandas intraday compute (VWAP + whale flags).
3. Redis Pub/Sub publisher voi contract versioned.
4. Django Channels consumer auth + subscription.
5. Feature flag bat/tat realtime.

Out-of-scope:
1. Frontend animation nang.
2. Backtest full engine.

## Timeline (10 ngay)

Day 1:
- Freeze contract payload + channel naming.
- Add feature flags realtime.

Day 2-3:
- Implement collector task + retry/backoff + proxy rotation.

Day 4:
- Implement Pandas compute module + unit tests.

Day 5:
- Implement Redis publish layer + sequence id + ts.

Day 6-7:
- Setup Channels ASGI + auth + subscribe/unsubscribe.
- Implement websocket consumer with JWT query token auth.
- Fan-out ticker/whale events vao channel layer groups de client nhan realtime ngay.

Day 8:
- Integration tests (collector -> redis -> consumer).
- Websocket auth/subscribe test voi ASGI client.

Day 9:
- Error handling, stale strategy, fallback API endpoint.
- Expose `GET /api/realtime/ticker/{symbol}` cho polling fallback voi freshness metadata.

Day 10:
- Hardening + release notes + handoff Sprint 12.

## Deliverables

1. `realtime/collector.py` + celery wiring.
2. `realtime/compute.py` (Pandas).
3. `realtime/publisher.py` (Redis Pub/Sub).
4. `channels` routing + consumers.
5. Integration test suite for event flow.

## DoD

- Event ticker_update va whale_alert push duoc qua websocket.
- p95 publish->push < 1.5s tren local/staging.
- Worker success rate >= 99% trong gio gia lap.
- Co rollback mode ve polling-only.
