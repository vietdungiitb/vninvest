# SPEC API VÀ DATA SHAPE - WHALE ANALYTICS v2.0

## 1. Mục tiêu

Tài liệu này khóa chặt contract dữ liệu giữa backend và frontend cho Whale Analytics v2.0.

Mọi implementation mới phải bám vào contract này. Không được để frontend tự suy diễn dữ liệu bằng cách ghép 2 endpoint cũ.

## 2. Endpoint mục tiêu

### 2.1 Endpoint chính

`GET /portfolio/whale/analytics/{symbol}/?timeframe=15m&compact=1`

### 2.2 Query params được phép

- `timeframe`: `15m | 30m | 1h | morning | afternoon | session`
- `compact`: `1` mặc định cho chart UI
- `trade_date`: optional, chỉ dùng cho chế độ nội bộ hoặc audit replay

Không cho phép frontend truyền cả `start` và `end` để tự điều khiển window trong phase đầu. Window phải được resolve từ contract thống nhất.

## 3. HTTP headers bắt buộc

- `ETag`
- `Last-Modified`
- `Cache-Control`

Kỳ vọng sử dụng:
- client gửi `If-None-Match` nếu có `ETag`
- server có thể trả `304 Not Modified`
- metadata trong body và header phải không mâu thuẫn nhau

## 4. Response shape chuẩn

```json
{
  "symbol": "HPG",
  "trade_date": "2026-04-24",
  "timeframe": "15m",
  "session": {
    "timezone": "Asia/Ho_Chi_Minh",
    "market_open": "09:00",
    "market_close": "15:00",
    "resolved_from": "latest_completed_session",
    "auction_policy": {
      "ato": "bucket_start",
      "atc": "bucket_start"
    }
  },
  "meta": {
    "generated_at": "2026-04-24T14:31:10+07:00",
    "cache_age_ms": 4200,
    "is_stale": false,
    "degraded_mode": false,
    "data_state": "live",
    "stale_reason": null,
    "request_key": "HPG:2026-04-24:15m:compact"
  },
  "axis": {
    "x_mode": "linear_time",
    "show_session_gaps": true,
    "bucket_interval": "15m"
  },
  "price_series": [],
  "bubble_series": [],
  "flow_series": {
    "cvd": [],
    "buy_strength": [],
    "institutional_strength": []
  },
  "summary": {
    "total_buy_value": 0,
    "total_sell_value": 0,
    "net_cvd": 0,
    "whale_order_count": 0,
    "extreme_order_count": 0
  }
}
```

## 5. Quy tắc timestamp

- Tất cả timestamp trong body phải là ISO 8601 kèm offset `+07:00` hoặc epoch millisecond đã được thống nhất trước trong implementation.
- Không trộn nhiều chuẩn timestamp trong cùng payload.
- `generated_at` và `bucket_ts` phải cùng logic timezone `UTC+7`.
- `bucket_ts` đại diện cho thời điểm bắt đầu bucket.

## 6. Quy tắc session resolve

### 6.1 Session live

- Nếu đang trong phiên giao dịch, trả phiên hiện tại.

### 6.2 Off-hours cùng ngày giao dịch

- Nếu ngoài giờ giao dịch nhưng vẫn là ngày giao dịch, trả snapshot của phiên vừa hoàn tất.

### 6.3 Cuối tuần và ngày nghỉ

- Trả snapshot của phiên giao dịch gần nhất có dữ liệu.

Không được giả định ngày lịch gần nhất luôn là ngày giao dịch.

## 7. Quy tắc series

### 7.1 price_series

Mỗi phần tử tối thiểu gồm:

```json
{
  "bucket_ts": "2026-04-24T09:15:00+07:00",
  "price": 25.7,
  "reference_price": 25.4,
  "delta_pct": 1.18
}
```

### 7.2 bubble_series

Mỗi phần tử tối thiểu gồm:

```json
{
  "bucket_ts": "2026-04-24T09:15:00+07:00",
  "ts": "2026-04-24T09:17:23+07:00",
  "side": "BUY",
  "price": 25.7,
  "volume": 120000,
  "matched_value": 3084000000,
  "delta_pct": 1.18,
  "is_whale": true,
  "is_extreme": false,
  "event_score": 87.5
}
```

Quy tắc:
- Bubble là event-level data.
- `bucket_ts` dùng để align với flow/price pane.
- `ts` giữ thời điểm gốc của lệnh để tooltip có thể hiển thị chi tiết.

### 7.3 flow_series.cvd

```json
{
  "bucket_ts": "2026-04-24T09:15:00+07:00",
  "value": 1250000000
}
```

### 7.4 flow_series.buy_strength

```json
{
  "bucket_ts": "2026-04-24T09:15:00+07:00",
  "value": 62.4,
  "baseline_window": 30,
  "confidence": "medium"
}
```

### 7.5 flow_series.institutional_strength

```json
{
  "bucket_ts": "2026-04-24T09:15:00+07:00",
  "value": 55.8,
  "baseline_window": 30,
  "confidence": "medium"
}
```

## 8. Quy tắc empty state và fail-safe semantics

### 8.1 Bubble rỗng, flow có dữ liệu

- `bubble_series` không cần sinh record giả.
- Frontend sẽ hiển thị flow bình thường tại bucket đó.
- Tooltip bubble phải ẩn phần bubble nếu không có event hợp lệ.

### 8.2 Không có dữ liệu cả bucket

- Trả mảng rỗng hoặc bỏ điểm đó khỏi series theo strategy đã thống nhất.
- Không được nội suy dữ liệu chỉ để line đẹp hơn.

### 8.3 degraded_mode

Nếu `degraded_mode = true` thì phải có:
- `data_state`
- `stale_reason`
- `generated_at`
- `cache_age_ms`

Frontend được phép render snapshot cũ, nhưng phải gắn notice dữ liệu chậm.

## 9. Quy tắc ATO/ATC

- ATO/ATC là dữ liệu hợp lệ trong session.
- Với `15m`, `30m`, `1h`, dữ liệu auction phải vào đúng bucket chứa thời điểm đó.
- Không tạo minute giả để kéo đều volume.
- Nếu tooltip đang đứng trên bubble auction, phải có field hoặc label giải thích đây là dữ liệu aggregate auction bucket.

## 10. Quy tắc formula metadata

Nếu response trả strength đã chuẩn hóa theo pipeline mới, backend phải giữ được ít nhất các thông tin sau cho debug/audit nội bộ:
- `baseline_window`
- `confidence`
- version công thức nếu hệ thống có cơ chế version hóa

Không bắt buộc trả toàn bộ biến trung gian ra client nếu `compact=1`, nhưng backend phải có khả năng audit nội bộ.

## 11. Anti-pattern bị cấm

- Trả payload trộn cả session lớn rồi để frontend tự cắt.
- Trả timestamp ở nhiều timezone khác nhau.
- Trả data line theo bucket nhưng bubble lại không có `bucket_ts` để sync.
- Không có metadata stale/degraded nhưng lại phục vụ cache cũ.