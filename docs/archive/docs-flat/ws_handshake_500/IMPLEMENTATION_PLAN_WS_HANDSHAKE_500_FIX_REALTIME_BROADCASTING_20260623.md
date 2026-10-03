# Implementation Plan — WebSocket Handshake 500 Fix and Real-time Broadcasting

**Date:** 2026-06-23
**Feature pack:** SFI-B7 (WebSocket), Whale Alerts Broadcasting, Real-time Ticker Feed

## 1. Problem

Frontend `useRealtimeFeedCore.js` connects to `ws://<host>/ws/realtime/?token=<pat>` but no ASGI route exists for `/ws/realtime/`. Only `/ws/market/<str:symbol>/` is registered. Result: HTTP 500 handshake failure, WebSocket never opens, fallback polling only.

## 2. Solution Architecture

| Component | File | Change |
|---|---|---|
| ASGI Route | `asgi.py` | Add `/ws/realtime/` → `RealtimeConsumer` |
| Multiplexed Consumer | `consumers.py` | New `RealtimeConsumer` class with subscribe/unsubscribe |
| Broadcasting Module | `broadcasting.py` (NEW) | Alert + ticker serialization and channel layer publish |
| Whale Alert Broadcast | `tasks.py` | Call `broadcast_unified_alert` after `_bulk_write_whale_canonical` |
| Materializer Broadcast | `materializers.py` | Call `broadcast_unified_alert` after alert create/update |
| Ticker Broadcast | `realtime_prefetch.py` | Publish `ticker_update` events after price fetch |
| Event Contract | `WEBSOCKET_EVENT_CONTRACT.md` | **No change** — plan diverges intentionally (see §5) |

### 2.1 Protocol Summary

```
Client → Server:  { "action": "subscribe", "symbols": ["FPT", "SSI", "market_discovery"] }
Server → Client:  { "event_type": "subscribed", "symbols": ["FPT", "SSI", "market_discovery"] }

Client → Server:  { "action": "unsubscribe", "symbols": ["FPT"] }
Server → Client:  { "event_type": "unsubscribed", "symbols": ["FPT"] }

Client → Server:  { "event_type": "ping" }
Server → Client:  { "event_type": "heartbeat", "ts": "2026-06-23T10:00:00.000+07:00" }

Server → Client:  { "contract_version": "1.0", "event_type": "ticker_update", "symbol": "FPT",
                     "ts": "...", "seq": 123, "source": "channels-gateway",
                     "data": { "price": 112000, "change_value": 1200, "change_pct": 1.08, ... } }
Server → Client:  { "contract_version": "1.0", "event_type": "whale_alert", ... }
Server → Client:  { "contract_version": "1.0", "event_type": "dark_flow_alert", ... }
```

### 2.2 Group Naming Convention

- Symbol-specific: `market_{symbol}` (e.g., `market_FPT`)
- Discovery channel: `market_discovery`

**Note:** This diverges from `WEBSOCKET_EVENT_CONTRACT.md` §1 which specifies `ticker:{symbol}` / `whale:{symbol}`. The `market_` prefix is inherited from the existing `MarketTickerConsumer` and matched by the frontend `useRealtimeFeedCore.js`. Contract doc update is deferred to a follow-up tech-debt ticket.

## 3. Prerequisites & Compliance

### 3.1 Required Reading (AGENTS.md §2)

- [x] `quality/QUALITY.md`
- [x] `docs/SAAS_FULL_INDEPENDENCE_HANDOFF_MASTER_20260504.md` (§6: B7 WebSocket)
- [x] `docs/SAAS_FULL_INDEPENDENCE_TECH_SPEC_20260504.md` (§9: WebSocket sanitize, no body logging)
- [x] `docs/WEBSOCKET_EVENT_CONTRACT.md`

### 3.2 Hard Constraints

- **SFI-B7.9**: WebSocket symbol parameter must be sanitized before use as Redis channel key — enforced via `_sanitize_symbol()`
- **SFI-B7.2**: Hop-by-hop headers stripped (N/A — ASGI, no proxy)
- **SFI-B7.8**: `legacy_proxy.py` not modified
- **No body logging**: Broadcasting module logs only event type + symbol, never payload
- **No direct fetch**: Frontend uses `coreApiAdapter.js` — not modified

## 4. Proposed Changes

### 4.1 [MODIFY] `asgi.py`

- Import `RealtimeConsumer` from `signal_intelligence.consumers`
- Add route: `path('ws/realtime/', RealtimeConsumer.as_asgi())` before the existing market route

### 4.2 [MODIFY] `consumers.py`

- Add `RealtimeConsumer(AsyncWebsocketConsumer)`:
  - **`connect`**: Auth via `?token=<pat>`, reject 4401 if invalid. Init `self.subscribed_groups = set()`.
  - **`disconnect`**: Leave all subscribed groups via `channel_layer.group_discard`.
  - **`receive`**:
    - `{ "event_type": "ping" }` → respond `{ "event_type": "heartbeat", "ts": ... }`
    - `{ "action": "subscribe", "symbols": [...] }` → validate + group_add each, respond `{ "event_type": "subscribed", "symbols": [...] }`
    - `{ "action": "unsubscribe", "symbols": [...] }` → group_discard each, respond `{ "event_type": "unsubscribed", "symbols": [...] }`
  - **`market_update`**: Forward `event['data']` to WS client (same as existing `MarketTickerConsumer`)

- Fix `MarketTickerConsumer.receive` to also handle `event_type: "ping"` (currently only checks `type: "ping"`).

### 4.3 [NEW] `broadcasting.py`

Module `signal_intelligence.broadcasting`:

```
serialize_unified_alert(alert: UnifiedAlert) -> dict
  → Builds WEBSOCKET_EVENT_CONTRACT.md-compliant payload with envelope fields

broadcast_unified_alert(alert: UnifiedAlert) -> None
  → Sends to market_{symbol} group + market_discovery group via channel_layer

broadcast_ticker_update(symbol: str, ticker_data: dict) -> None
  → Sends ticker_update event to market_{symbol} group
```

- Envelope: `{ contract_version, event_type, symbol, ts, seq, source, data }`
- Seq: Redis counter `ws:seq:{symbol}` (INCR, 24h TTL)
- Uses `async_to_sync(channel_layer.group_send)` pattern

### 4.4 [MODIFY] `tasks.py`

In `detect_and_store_global_whale_alerts`, after the symbol loop:

```
for sym in symbols:
    ...
    whale_count = _bulk_write_whale_canonical(...)
    → After bulk_create, collect newly created UnifiedAlert PKs
    → Broadcast each via broadcast_unified_alert()
```

### 4.5 [MODIFY] `materializers.py`

In `materialize_unified_alerts`:
- After each alert create/update where `alert_created or dirty_fields` → `broadcast_unified_alert(alert)`

In `materialize_stale_quote_alerts`:
- After each alert create/update where `alert_created or dirty_fields` → `broadcast_unified_alert(alert)`

### 4.6 [MODIFY] `realtime_prefetch.py`

In `prefetch_realtime_ticker_shard`:
- After `fetch_realtime_price(symbol)`, compute change_value/change_pct from `reference_price`
- Call `broadcast_ticker_update(symbol, payload)` to push to WS group

## 5. Divergence from WEBSOCKET_EVENT_CONTRACT.md

| Contract § | Contract Spec | Implementation | Reason |
|---|---|---|---|
| §1 Groups | `ticker:{symbol}`, `whale:{symbol}` | `market_{symbol}` | Legacy compat with `MarketTickerConsumer` + frontend |
| §4 Subscribe | `"channels": ["ticker:FPT"]` | `"symbols": ["FPT"]` | Frontend `useRealtimeFeedCore.js` sends `symbols` |
| §4 Ack | `"event_type": "subscription_ack"` | `"event_type": "subscribed"` | Frontend checks `event_type === "subscribed"` |

**Resolution**: Deferred. Tech-debt ticket to align contract doc with actual implementation.

## 6. File Change List

| # | Action | File |
|---|---|---|
| 1 | MODIFY | `packages/core/backend/src/vninvest_core/asgi.py` |
| 2 | MODIFY | `packages/core/backend/src/signal_intelligence/consumers.py` |
| 3 | CREATE | `packages/core/backend/src/signal_intelligence/broadcasting.py` |
| 4 | MODIFY | `packages/core/backend/src/signal_intelligence/tasks.py` |
| 5 | MODIFY | `packages/core/backend/src/signal_intelligence/materializers.py` |
| 6 | MODIFY | `packages/core/backend/src/market_serving/realtime_prefetch.py` |

## 7. Verification Plan

### 7.1 Unit Tests
```powershell
pytest packages/core/backend/src/signal_intelligence/tests/ -x -q
pytest packages/core/backend/src/market_serving/tests/ -x -q
```

### 7.2 Type Check (Frontend — if packages/web changed)
```powershell
Push-Location ./packages/web; npx tsc --noEmit; Pop-Location
```

### 7.3 Build Check
```powershell
Push-Location ./packages/core; docker compose build core-api; Pop-Location
```

### 7.4 Runtime Refresh
```powershell
.\start_dev.ps1
```

### 7.5 Manual Check
1. Open Chrome DevTools → Network tab → filter "ws"
2. Navigate to `/dashboard`
3. Verify WebSocket to `/ws/realtime/` shows status `101` (Switching Protocols)
4. Verify `ticker_update` events appear in WS frame list
5. Trigger a whale alert → verify `whale_alert` event in WS frames

## 8. Residual Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Broadcast flood on ticker prefetch (3s cycle x hundreds symbols) | Medium | Throttled via `requestAnimationFrame` on frontend; backend publish is non-blocking |
| Redis channel layer backpressure | Medium | Channel layer uses Redis pub/sub; if Redis is down, `broadcast_unified_alert` silently fails via `async_to_sync` |
| `MarketTickerConsumer` remains operational (two code paths) | Low | No active frontend uses `/ws/market/<symbol>/`; to be removed in B8 decommission |
| `_bulk_write_whale_canonical` sync broadcast N calls per symbol | Low | `broadcast_unified_alert` uses `async_to_sync`; N is small (1-5 per symbol per cycle) |

## 9. Evidence Obligations (AGENTS.md §7)

After execution:
1. List files changed (see §6)
2. Run validation commands (see §7) — capture output
3. Screenshot Chrome DevTools WebSocket connection
4. Payload snapshot of ticker_update and whale_alert events
5. Update `docs/CODE_CHANGE_AUDIT_LEDGER.md` and `PROGRESS_DASHBOARD.md`

## 10. Post-Execution Updates

- [ ] Update `docs/CODE_CHANGE_AUDIT_LEDGER.md`
- [ ] Update `PROGRESS_DASHBOARD.md`
- [ ] Run `.\start_dev.ps1` for runtime refresh
