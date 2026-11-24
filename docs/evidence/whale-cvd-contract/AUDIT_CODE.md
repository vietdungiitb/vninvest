# RE-AUDIT CODE — Whale/CVD contract BE (độc lập, read-only)

- **Vòng:** 1 · **Ref:** `feat/whale-cvd-contract-be` @ `569f120ba`, tree sạch.
- **Auditor:** agent độc lập, tự mở code, không tin evidence doc.

## VERDICT: `NEED_REVISION` — 3 objection, 0 blocker kiến trúc

### Verify đúng

AC1/AC3 (builder lọc `whale_tick:` + 8-field summary + ngưỡng 500M/1B/5B), alias `/core/v1/whale-feed` (envelope, `signals:read`, `?session_date=`, side HOA, test cũ `:81-114` không đổi), AC2 (UNKNOWN skip ở `order_flow_engine.py:256-259` + `tasks.py:280-283`), AC6–AC8 (scope gate, strict window, fields mới cả 2 nhánh, cache key kẹp revision, engine lọc aggregate + bỏ `else:sell`), AC9 (501 body), AC10 helper additive (`ws_ticket.py:96-108`, hàm cũ `:78-93` nguyên vẹn, `MarketTickerConsumer` vẫn dùng hàm cũ), AC11 (override_settings đúng, env VPS ghi CHƯA CHẠY). Không migration, không deny-list, không assertion cũ bị nới, không `print()` tiếng Việt, không số bịa.

### Objections đã fix ở vòng này

1. **`delta` thiếu ở empty CVD payload** (`market_serving/views.py:91-111`) và top-level nhánh 200. → Thêm `'delta': 0` vào empty payload; top-level `delta = Σ(bucket.buy_volume - bucket.sell_volume)`; bổ sung assertion ở cả 2 test.
2. **`alerts[]` regression** — builder mới trả `[]`, tham số `alert_limit` chết. → Populate lại từ `UnifiedAlert` (max 50, shape cũ, `triggered_at.isoformat()` giữ `+00:00` cho alias tương thích); regression test assert `len(alerts)==2`.
3. **AC10 chỉ test helper, chưa test consumer** → Thêm `RealtimeConsumerEventsTests` dùng `WebsocketCommunicator`: subscribe `events:["whale_order"]` → ack `subscribed` + event `not_provisioned`; token connection bị bỏ qua.

### Reservation

- `session_facts_engine.py:136` `total += value` vẫn cộng side lạ vào `total` → pre-existing, ngoài slice, rủi ro thấp, ghi nhận không sửa.

### Gate

Sau 3 fix → chạy lại 14 test trên VPS + re-audit vòng 2 rồi mới B9 bàn giao.
