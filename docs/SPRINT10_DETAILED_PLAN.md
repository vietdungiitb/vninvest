# Sprint 10 Detailed Plan - Realtime Event-Driven (WebSockets)

Muc tieu Sprint 10:
- Chuyen luong realtime tu polling API sang event-driven qua Redis Pub/Sub + Django Channels.
- Van hanh an toan voi fallback polling neu websocket gian doan.

Scope:
1. Celery collector polling 5s + proxy rotation.
2. Pandas intraday compute (VWAP + Whale flags).
3. Publish message vao Redis Pub/Sub.
4. Django Channels subscribe va push xuong client qua WebSocket.
5. Frontend websocket client + fallback polling.

Out-of-scope:
1. Backtest engine (Sprint 13).
2. Telegram bot production hardening day du (chi MVP if time permits).

## 1) Team va vai tro

- BE-1: Collector + compute + pub/sub schema.
- BE-2: Django Channels gateway + auth + subscription routing.
- FE-1: WebSocket client, state management, fallback UX.
- DevOps: Redis config, proxy pool, observability, deployment script.
- QA: Realtime test matrix, disconnect/reconnect tests, load smoke.

## 2) Sprint timeline (10 ngay lam viec)

### Day 1 - Architecture freeze
- Chot message schema: ticker update, whale alert, heartbeat.
- Chot channel naming:
  - ticker:{symbol}
  - whale:{symbol}
  - user:{user_id}:alerts
- Chot auth strategy cho websocket (JWT query/header).

Deliverable:
- ADR realtime schema + routing.

### Day 2 - Collector foundation
- Tao Celery collector task poll 5s theo tracked symbols.
- Them proxy rotation policy + healthcheck.
- Retry/backoff/circuit-breaker cho vnstock fetch.

Deliverable:
- Collector logs co thong tin proxy, status, latency.

### Day 3 - Pandas intraday compute
- Xu ly DataFrame intraday.
- Tinh VWAP intraday.
- Detect whale theo threshold user (500tr/1ty).
- Chuan hoa payload output.

Deliverable:
- Fixture tests cho VWAP/whale pass.

### Day 4 - Redis Pub/Sub publish
- Publish ticker payload vao Redis channels.
- Publish whale event vao channels theo symbol va user.
- Add freshness timestamp va sequence id.

Deliverable:
- Redis pub/sub monitor thay message realtime.

### Day 5 - Django Channels setup
- Cau hinh ASGI + Channels.
- WebSocket consumer subscribe theo symbol/watchlist.
- JWT auth gate cho socket connect.

Deliverable:
- Client test co the connect + nhan event push.

### Day 6 - Frontend websocket integration
- Tao websocket service layer (connect/reconnect/backoff).
- Subscribe theo watchlist hien tai.
- Update UI state theo event message.

Deliverable:
- Watchlist update realtime khong can refresh trang.

### Day 7 - Fallback + resilience
- Neu socket down -> fallback polling API 5-10s.
- Neu socket recover -> switch ve websocket.
- Add stale-data indicator tren UI.

Deliverable:
- UX khong bi trang trong khi websocket loi.

### Day 8 - Observability + metrics
- Metrics:
  - publish_to_push_latency_ms
  - ws_connected_clients
  - collector_error_rate
  - message_drop_rate
- Structured logs cho collector/channels.

Deliverable:
- Dashboard metrics + alert thresholds.

### Day 9 - QA full regression
- Test matrix:
  - auth success/fail
  - subscribe/unsubscribe
  - reconnect after disconnect
  - stale fallback
  - whale alert rendering
- Load smoke voi N clients (muc tieu 100-300 local/staging).

Deliverable:
- QA report + bug list.

### Day 10 - Stabilize + release candidate
- Fix bug P0/P1.
- Chay smoke sau fix.
- Chot release checklist + rollback steps.

Deliverable:
- Sprint 10 RC ready.

## 3) Definition of Done (Sprint 10)

Ky thuat:
1. WebSocket push du lieu ticker/whale hoat dong end-to-end.
2. Fallback polling tu dong khi websocket gap loi.
3. Collector co retry/backoff/circuit-breaker.
4. Message schema co version + timestamp + sequence.

Chat luong:
1. Contract tests pass cho realtime payload.
2. Regression test pass cho Dashboard + Watchlist.
3. Khong co crash UI khi mat websocket.

Hieu nang:
1. p95 publish->client < 1.5s (staging).
2. p95 ws fanout < 200ms/node.
3. Worker success rate > 99% trong gio giao dich.

## 4) API va message contract MVP

WebSocket events:
1. ticker_update
2. whale_alert
3. heartbeat

Ticker payload MVP:
- event_type
- symbol
- price
- volume
- vwap
- ts
- seq

Whale payload MVP:
- event_type
- symbol
- matched_value
- side
- threshold
- ts
- seq

Fallback API:
- GET /api/realtime/ticker/{symbol}
- Response kem freshness_seconds + stale flag.

## 5) Risk register (Sprint 10)

Risk 1: vnstock bi throttle/block IP
- Mitigation: proxy rotation + cache stale + rate limiting collector.

Risk 2: WebSocket reconnect storm
- Mitigation: exponential backoff + jitter + connection cap.

Risk 3: Message out-of-order
- Mitigation: sequence id, client ignore message cu hon.

Risk 4: Redis bottleneck
- Mitigation: channel partitioning theo symbol + payload nhe.

## 6) Rollback plan

1. Tat websocket feature flag.
2. Chuyen FE ve polling mode 100%.
3. Disable collector publish, chi giu cache writes.
4. Theo doi error rate va khoi phuc dich vu.

## 7) Sprint 10 checklist (copy/paste)

- [ ] ADR schema/channels duoc sign-off.
- [ ] Collector + proxy rotation chay on dinh.
- [ ] Redis Pub/Sub publish co monitor.
- [ ] Channels auth gate pass.
- [ ] FE websocket + fallback pass.
- [ ] QA matrix pass.
- [ ] Metrics dashboard online.
- [ ] Rollback dry-run pass.
