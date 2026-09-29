# TECH SPEC: SSOT Whale Alert - Bubble Sync

**Ngày tạo**: 2026-04-22  
**Trạng thái**: READY FOR IMPLEMENTATION

---

## 1. Module Targets

Backend:
- `backend/portfolio/market_data_service.py`
- `backend/portfolio/views_realtime_advanced.py`
- `backend/portfolio/views_whale_orders.py`
- `backend/portfolio/tests/test_api_routes_stock_workspace_realtime_bulk.py`
- `backend/portfolio/tests/test_whale_orders_ssot_parity.py` (new)

Frontend:
- `frontend/src/components/WhaleBubbleChart.jsx`
- `frontend/src/api/client.js` (chỉ nếu cần parse metadata mới)
- `frontend/src/i18n/vi.js`

---

## 2. Canonical Domain Model

## 2.1 WhaleEvent (canonical)

```python
from dataclasses import dataclass
from typing import Literal

@dataclass
class WhaleEvent:
    event_id: str
    symbol: str
    ts: str
    side: Literal['buy', 'sell', 'unknown']
    price_vnd: float
    volume: float
    matched_value_vnd: float
    threshold_vnd: float
    source: Literal['redis_stream', 'intraday_tick_db', 'vnbroker']
    has_ref_price: bool
    price_unit_normalized: bool
    degraded_mode: bool
```

## 2.2 Summary model

```python
{
  "event_count": int,
  "buy_count": int,
  "sell_count": int,
  "unknown_count": int,
  "buy_value_vnd": float,
  "sell_value_vnd": float,
  "source": "redis_stream|intraday_tick_db|vnbroker",
  "degraded_mode": bool,
  "degraded_mode_reason": "missing_ref_price|empty_source|none"
}
```

---

## 3. Service Contract

## 3.1 New service entrypoint

```python
def get_whale_events_by_symbol(
    user,
    symbol: str,
    timeframe: str = 'session',
    start: str | None = None,
    end: str | None = None,
) -> dict:
    """
    Returns canonical whale events + summary + metadata.
    This function is the only data provider for whale feed and bubble endpoints.
    """
```

## 3.2 Response payload (canonical service)

```json
{
  "ok": true,
  "symbol": "DGC",
  "timeframe": "session",
  "source": "redis_stream",
  "degraded_mode": false,
  "degraded_mode_reason": null,
  "quality_flags": {
    "has_ref_price": true,
    "price_unit_normalized": true
  },
  "threshold_vnd": 500000000,
  "events": [],
  "summary": {}
}
```

---

## 4. Mapping Rules

## 4.1 Side normalization

Input aliases -> Output:
- `BUY|bu|b|buy` -> `buy`
- `SELL|sd|s|sell` -> `sell`
- else -> `unknown`

## 4.2 Price unit normalization

Rule:
- Nếu raw price >= 1000 và source cần scale thì normalize về VND canonical trước khi tính matched value.
- `matched_value_vnd = price_vnd * volume`

## 4.3 Event ID

Ưu tiên:
1. Stream ID nếu có.
2. Tick primary key nếu có.
3. Deterministic hash từ `symbol|ts|side|matched_value_vnd`.

## 4.4 Dedupe

Dedupe key: `event_id`.
Fallback key: `symbol|ts(second-rounded)|side|round(matched_value_vnd)`.

---

## 5. Endpoint Refactor Details

## 5.1 Whale feed endpoint

File: `views_realtime_advanced.py`

Thay đổi:
- Bỏ transform riêng theo pipeline cũ.
- Gọi `get_whale_events_by_symbol()`.
- Build payload feed từ canonical events.

## 5.2 Whale orders endpoint (bubble)

File: `views_whale_orders.py`

Thay đổi:
- Bỏ query trực tiếp `IntradayTick` + empty cứng khi thiếu ref_price.
- Gọi `get_whale_events_by_symbol()`.
- Map events thành cấu trúc buy/sell/internal cho chart.
- Nếu thiếu ref_price: vẫn trả events với `degraded_mode=true`.

---

## 6. Bubble Mapping Specification

Input: canonical events.

Output cho ECharts:
- `x`: phút từ đầu phiên.
- `y_vnd`: `price_vnd - ref_price` nếu có ref.
- `y_pct`: `% delta` nếu có ref.
- fallback khi không có ref:
  - `y_vnd = 0`
  - `y_pct = 0`
  - thêm marker `fallback_visual=true` để UI gắn banner.

Size:
- `symbol_size = sqrt(matched_value_vnd) / K`
- K giữ tương thích với scale hiện hữu.

---

## 7. Frontend Behavior Contract

Trong `WhaleBubbleChart`:

1. Nếu `degraded_mode=true` và có events:
- Render chart bình thường.
- Hiển thị banner cảnh báo dữ liệu dự phòng.

2. Empty state chỉ hiển thị khi:
- `events.length == 0` thật sự.

3. Không được hiển thị thông điệp "không có lệnh" khi backend trả `events > 0`.

---

## 8. Observability Hooks

## 8.1 Metrics

- `whale_ssot_event_count_total{source=...}`
- `whale_ssot_degraded_mode_total{reason=...}`
- `whale_ssot_ref_price_missing_total{symbol=...}`
- `whale_ssot_parity_delta_total{symbol,timeframe}`

## 8.2 Log fields

Mỗi request endpoint whale phải log:
- `symbol`
- `timeframe`
- `source`
- `event_count`
- `degraded_mode`
- `degraded_mode_reason`

---

## 9. Test Specification

## 9.1 Unit tests

- Side normalization.
- Price unit normalization.
- Dedupe correctness.

## 9.2 Integration tests

1. Stream-only event available -> feed + bubble parity.
2. DB-only event available -> parity.
3. Missing ref_price -> bubble returns non-empty events with degraded mode.
4. Mixed price unit -> matched value bounded correctly.

## 9.3 Contract tests

- Snapshot payload cho cả 2 endpoint.
- Xác nhận cùng symbol/timeframe thì event_count bằng nhau.

---

## 10. Backward Compatibility

- Route giữ nguyên.
- Field cũ không xóa trong phase đầu.
- Field mới thêm theo additive contract.

---

## 11. Rollback Design

Feature flag:
- `WHALE_BUBBLE_USE_SSOT_EVENTS=false` -> quay lại implementation cũ.

Điều kiện rollback:
- p95 tăng > 30% kéo dài > 30 phút.
- parity delta xuất hiện liên tục trên canary.
