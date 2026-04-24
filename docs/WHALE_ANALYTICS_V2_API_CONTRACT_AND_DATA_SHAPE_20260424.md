# SPEC API VA DATA SHAPE - WHALE ANALYTICS V2

## 1. Mục tiêu

Tài liệu này khóa contract dữ liệu cho từng giai đoạn triển khai để:

- đội frontend không phải suy diễn,
- đội backend không trả thiếu context,
- auditor đối chiếu được yêu cầu UX với payload thực tế.

## 2. Endpoint chính

`GET /portfolio/whale/analytics/{symbol}/?timeframe=15m&compact=1`

Query params được phép:

- `timeframe`: `15m | 30m | 1h | morning | afternoon | session`
- `compact`: `1` mặc định
- `trade_date`: optional cho replay/audit nội bộ

## 3. Headers bắt buộc

- `ETag`
- `Last-Modified`
- `Cache-Control`

## 4. Contract top-level chuẩn

```json
{
  "symbol": "HPG",
  "trade_date": "2026-04-24",
  "timeframe": "15m",
  "session": {},
  "meta": {},
  "axis": {},
  "session_levels": {},
  "price_series": [],
  "bubble_series": [],
  "flow_series": {
    "cvd": [],
    "buy_strength": [],
    "institutional_strength": [],
    "speed": []
  },
  "summary": {}
}
```

## 5. Timestamp rules

- toàn bộ timestamp phải cùng một chuẩn timezone `+07:00` hoặc cùng một chuẩn epoch đã được khóa,
- không trộn nhiều chuẩn timestamp trong cùng payload,
- `bucket_ts` luôn là đầu bucket,
- `ts` ở bubble là thời điểm gốc của event.

## 6. Phase contract matrix

### 6.1 Phase 1 - UI va tiện ích

Required:

- `meta.generated_at`
- `meta.cache_age_ms`
- `meta.is_stale`
- `meta.degraded_mode`
- `meta.stale_reason`
- `meta.threshold_vnd`
- `meta.threshold_source`
- `bubble_series[].bucket_ts`
- `bubble_series[].ts`
- `bubble_series[].side`
- `bubble_series[].price`
- `bubble_series[].volume`
- `bubble_series[].matched_value`
- `bubble_series[].delta_pct`
- `bubble_series[].is_whale`
- `bubble_series[].is_extreme`
- `bubble_series[].event_score`

### 6.2 Phase 2 - Price context

Required additions:

```json
"session_levels": {
  "reference_price": 25700,
  "high_price": 26150,
  "low_price": 25450,
  "ceiling_price": 27100,
  "floor_price": 23900
}
```

Rules:

- cùng đơn vị với `price_series[].price`,
- cùng phiên với chart đang render,
- không optional một nửa nếu source thực tế có đủ toàn bộ.

### 6.3 Phase 3 - Advanced analytics

Required additions:

```json
"bubble_series": [
  {
    "matched_value_percentile_10d": 95.4,
    "event_score_percentile_10d": 91.8,
    "baseline_sample_size": 284
  }
],
"flow_series": {
  "speed": [
    {
      "bucket_ts": "2026-04-24T10:20:00+07:00",
      "value": 4.7,
      "unit": "events_per_second"
    }
  ]
}
```

## 7. Bubble record canonical shape

```json
{
  "bucket_ts": "2026-04-24T09:15:00+07:00",
  "ts": "2026-04-24T09:17:23+07:00",
  "side": "BUY",
  "price": 25700,
  "volume": 120000,
  "matched_value": 3084000000,
  "delta_pct": 1.18,
  "is_whale": true,
  "is_extreme": false,
  "event_score": 87.5,
  "matched_value_percentile_10d": null,
  "event_score_percentile_10d": null,
  "baseline_sample_size": null
}
```

Rules:

- event-level data phải còn đầy đủ trong window,
- không top-N truncate,
- percentile fields có thể `null` trước Phase 3 nhưng key semantics phải được tài liệu hóa rõ.

## 8. Flow series canonical shape

### 8.1 CVD

```json
{
  "bucket_ts": "2026-04-24T09:15:00+07:00",
  "value": 1250000000
}
```

### 8.2 Buy strength

```json
{
  "bucket_ts": "2026-04-24T09:15:00+07:00",
  "value": 62.4,
  "baseline_window": 30,
  "confidence": "medium"
}
```

### 8.3 Institutional strength

```json
{
  "bucket_ts": "2026-04-24T09:15:00+07:00",
  "value": 55.8,
  "baseline_window": 30,
  "confidence": "medium"
}
```

### 8.4 Speed

```json
{
  "bucket_ts": "2026-04-24T10:20:00+07:00",
  "value": 4.7,
  "unit": "events_per_second",
  "confidence": "medium"
}
```

## 9. Empty va degraded semantics

### 9.1 Bubble rỗng nhưng flow có dữ liệu

- `bubble_series` được để rỗng ở bucket đó,
- frontend không được tự sinh bubble,
- panel hover line chỉ hiển thị flow context.

### 9.2 Thiếu price context Phase 2

Nếu thiếu `session_levels`, backend phải đánh dấu trong `meta`:

```json
{
  "degraded_mode": true,
  "stale_reason": "missing_session_levels",
  "missing_fields": ["session_levels.reference_price", "session_levels.high_price"]
}
```

### 9.3 Thiếu speed hoặc percentile Phase 3

Không trả `0` giả.

Phải trả một trong hai cách:

- field `null`,
- hoặc bỏ field nhưng có `missing_fields` rõ ràng.

## 10. Audit assertions bắt buộc

Auditor phải kiểm các assertion sau trên payload thật:

1. Toàn bộ bubble vượt ngưỡng trong window đều có mặt.
2. `threshold_vnd` và `threshold_source` khớp thực tế đang dùng.
3. `session_levels` nếu có thì đúng đơn vị và đúng phiên.
4. `speed.unit` chỉ có một canonical definition.
5. percentile không xuất hiện khi baseline chưa đủ.

## 11. Anti-pattern bị cấm

- payload compact bằng cách cắt bớt event-level records,
- timestamp lệch timezone giữa series,
- bubble không có `bucket_ts`,
- price context trả nửa vời mà không degrade,
- speed/percentile placeholder 0 để UI dễ render hơn.
