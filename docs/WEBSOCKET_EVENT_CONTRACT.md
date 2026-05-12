# WebSocket Event Contract (Coding-Ready)

Muc tieu:
- Dinh nghia message contract co the code ngay cho Sprint 10.
- Tranh lech payload giua Collector, Channels va Frontend.

Version:
- contract_version: 1.0

## 1) Channel naming convention

Symbol channels:
- ticker:{symbol}
- whale:{symbol}

User-specific channels:
- user:{user_id}:alerts
- user:{user_id}:system

Guidelines:
1. Symbol viet hoa (VD: FPT, SSI, HPG).
2. Khong publish payload > 8KB/event.
3. Moi payload bat buoc co ts + seq.

## 2) Envelope chung cho moi event

```json
{
  "contract_version": "1.0",
  "event_type": "ticker_update",
  "symbol": "SSI",
  "ts": "2026-04-01T09:30:05.123+07:00",
  "seq": 102934,
  "source": "collector-vnbroker-vci",
  "data": {}
}
```

Bat buoc:
1. ts: ISO-8601 timezone-aware.
2. seq: tang dan theo symbol trong 1 session.
3. event_type nam trong danh sach cho phep.

## 3) Event types

### 3.1 ticker_update

```json
{
  "contract_version": "1.0",
  "event_type": "ticker_update",
  "symbol": "FPT",
  "ts": "2026-04-01T10:15:00.000+07:00",
  "seq": 556,
  "source": "collector",
  "data": {
    "price": 112000,
    "volume": 1250000,
    "vwap": 111450,
    "change_value": 1200,
    "change_pct": 1.08,
    "session": "A"
  }
}
```

### 3.2 whale_alert

```json
{
  "contract_version": "1.0",
  "event_type": "whale_alert",
  "event_id": "whale:SSI:2026-04-01T10:15:03.111+07:00:buy:1250000000:1000000000",
  "config_version": "threshold-v1",
  "symbol": "SSI",
  "ts": "2026-04-01T10:15:03.111+07:00",
  "seq": 557,
  "source": "intraday-engine",
  "matched_value": 1250000000,
  "threshold": 1000000000,
  "side": "buy",
  "size_class": "whale",
  "event_score": 71.25,
  "display_score": 69.82,
  "severity": "high",
  "weights_version": "weights-v1"
}
```

Ghi chu contract:
- Backend WS va REST dung chung scoring contract cho `severity`, `event_score`, `display_score`, `weights_version`.
- `event_id`, `config_version`, `source` la lifecycle fields de dedupe, trace va doi chieu WS/REST.
- Frontend khong tu suy luan `severity` tu `matched_value`; UI render truc tiep tu payload WS.
- Client can tuong thich nguoc voi payload cu co the doc field o root hoac trong `data`, nhung payload chuan hien tai dat cac field scoring o root level.

### 3.3 dark_flow_alert

```json
{
  "contract_version": "1.0",
  "event_type": "dark_flow_alert",
  "event_id": "dark_flow:VNM:2026-04-04T13:00:00Z:iceberg",
  "symbol": "VNM",
  "ts": "2026-04-04T13:00:00Z",
  "signal_type": "iceberg",
  "strength": 72.5,
  "confidence": "high",
  "tick_rate": 18.3,
  "small_order_ratio": 0.82,
  "cvd_at_signal": -1200000000,
  "description": "Phat hien 23 lenh nho lap tai 78,200 VND trong 5 phut"
}
```

Ghi chu contract:
- Event nay duoc publish vao cung symbol group `whale:{symbol}` de frontend hien tai co the nhan ma khong can doi luong subscribe.
- `signal_type` nam trong tap: `absorption | iceberg | twap_bot | mixed`.
- `strength` chuan hoa 0-100, `confidence` la `low | medium | high`.
- `small_order_ratio` va `tick_rate` phuc vu UI order-flow panel va AI grounding context.

### 3.4 heartbeat

```json
{
  "contract_version": "1.0",
  "event_type": "heartbeat",
  "symbol": "SSI",
  "ts": "2026-04-01T10:15:05.000+07:00",
  "seq": 558,
  "source": "channels-gateway",
  "data": {
    "status": "ok"
  }
}
```

## 4) WebSocket endpoint va auth

Endpoint de xuat:
- /ws/realtime/

Handshake auth:
1. JWT bearer trong query param `token` hoac header Authorization.
2. Token khong hop le => close code 4401.

Client subscribe message:

```json
{
  "action": "subscribe",
  "channels": ["ticker:FPT", "whale:FPT", "user:12:alerts"]
}
```

Client unsubscribe message:

```json
{
  "action": "unsubscribe",
  "channels": ["ticker:FPT"]
}
```

Server ack:

```json
{
  "event_type": "subscription_ack",
  "ok": true,
  "channels": ["ticker:FPT", "whale:FPT"]
}
```

## 5) Ordering, dedupe, stale handling

1. Client bo qua event co seq <= last_seq da nhan theo symbol.
2. Neu ts cu hon 15s so voi local clock => hien stale indicator.
3. Neu mat ket noi > 5s => bat fallback polling.

## 6) Error codes

- 4401: unauthorized token
- 4403: forbidden channel access
- 4408: rate limited
- 4500: internal gateway error

## 7) Backward compatibility rule

1. Them field moi: allowed, client bo qua neu khong biet.
2. Xoa/doi field: chi duoc lam khi tang contract_version.
