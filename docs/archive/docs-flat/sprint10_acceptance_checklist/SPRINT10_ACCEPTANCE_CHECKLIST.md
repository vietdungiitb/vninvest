# Sprint 10 Acceptance Checklist

Dung checklist nay khi review va chot Sprint 10.

## A. Architecture & Contract

- [ ] Da co ADR cho realtime schema va channel naming.
- [ ] WebSocket contract theo docs/WEBSOCKET_EVENT_CONTRACT.md.
- [ ] Message envelope co contract_version, ts, seq.

## B. Backend Pipeline

- [ ] Celery collector poll 5s hoat dong.
- [ ] Proxy rotation duoc bat va co healthcheck.
- [ ] Retry/backoff/circuit-breaker da active.
- [ ] Pandas compute VWAP + whale pass fixture tests.
- [ ] Redis Pub/Sub publish ticker/whale events on dinh.

## C. Gateway & Frontend

- [ ] Django Channels ws connect/auth pass.
- [ ] FE subscribe/unsubscribe channel dung logic.
- [ ] FE fallback polling khi ws disconnect.
- [ ] Stale-data indicator hien thi dung.

## D. Quality & Performance

- [ ] QA test matrix da chay va pass.
- [ ] p95 publish->client < 1.5s tren staging.
- [ ] p95 ws fanout < 200ms/node.
- [ ] Worker success rate > 99% trong gio giao dich.

## E. Operations

- [ ] Monitoring dashboard da online.
- [ ] Alert rules da cau hinh cho error burst/disconnect.
- [ ] Rollback dry-run pass (ws off -> polling mode).

## F. Release Sign-off

- [ ] BE Lead sign-off.
- [ ] FE Lead sign-off.
- [ ] QA sign-off.
- [ ] DevOps sign-off.
