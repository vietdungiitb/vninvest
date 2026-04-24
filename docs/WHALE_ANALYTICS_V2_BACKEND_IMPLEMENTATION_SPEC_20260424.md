# BACKEND IMPLEMENTATION SPEC - WHALE ANALYTICS V2

## 1. Mục tiêu

Backend phải trả được snapshot analytics đủ chuẩn để frontend render trực tiếp mà không phải suy diễn về:

- session window,
- bucket semantics,
- price context,
- speed,
- percentile,
- degraded/stale semantics.

## 2. File neo chính

- `backend/portfolio/services_whale_analytics_snapshot.py`
- `backend/portfolio/views_whale_orders.py`
- `backend/portfolio/order_flow.py`
- `backend/portfolio/serializers.py` nếu cần mở rộng serializer contract
- các module helper market data nếu cần lấy `ceiling_price`, `floor_price`, `high_price`, `low_price`

## 3. Quy tắc nền bắt buộc

### 3.1 Time contract

- Timezone chuẩn: `Asia/Ho_Chi_Minh`
- Session intraday chuẩn: `09:00-15:00`
- `bucket_ts` là thời điểm bắt đầu bucket
- weekend/holiday/off-hours phải resolve về phiên gần nhất có dữ liệu

### 3.2 Visual truthfulness support

Backend không được tối ưu payload theo hướng làm frontend mất khả năng hiển thị đủ các lệnh đã vượt ngưỡng lọc.

Nghĩa là:

- bubble snapshot phải giữ đủ event-level records trong window đang yêu cầu,
- không top-N truncate chỉ để payload nhỏ hơn,
- nếu có compact mode thì compact bằng field reduction, không compact bằng event suppression.

### 3.3 Threshold semantics

Threshold phải được surfacing rõ trong metadata để frontend và audit biết chart đang hiển thị theo ngưỡng nào.

## 4. Phân kỳ backend theo giai đoạn

## 4.1 Giai đoạn 1

Backend phải đảm bảo các field hiện có đủ tốt cho frontend làm:

- Information Panel,
- filter bubble tại FE,
- event score surfacing,
- threshold surfacing.

Required fields:

- `meta.threshold_vnd`
- `meta.threshold_source`
- `bubble_series[].event_score`
- `bubble_series[].bucket_ts`
- `bubble_series[].ts`

## 4.2 Giai đoạn 2

Backend phải mở rộng contract cho price context.

Required fields mới:

- `session_levels.reference_price`
- `session_levels.high_price`
- `session_levels.low_price`
- `session_levels.ceiling_price`
- `session_levels.floor_price`

Các field này phải cùng đơn vị giá với `price_series[].price` và `bubble_series[].price`.

## 4.3 Giai đoạn 3

Backend phải mở rộng contract cho tín hiệu chuyên sâu.

Required fields mới:

- `flow_series.speed`
- `bubble_series[].matched_value_percentile_10d`
- `bubble_series[].event_score_percentile_10d`
- `bubble_series[].baseline_sample_size`

Nếu không đủ dữ liệu baseline hoặc speed source chưa tin cậy, backend phải trả semantics thiếu dữ liệu rõ ràng thay vì giá trị 0 giả.

## 5. Snapshot shape bắt buộc

Backend phải tiếp tục duy trì snapshot response thống nhất, nhưng cần mở rộng rõ thành 3 lớp:

1. lớp render hiện tại,
2. lớp price context,
3. lớp advanced analytics.

Suggested top-level shape:

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

## 6. Price context rules

### 6.1 Ref/high/low/trần/sàn

Phải được tính hoặc lấy từ một nguồn chuẩn duy nhất.

Không chấp nhận:

- frontend tự suy ra trần/sàn từ reference,
- frontend tự tổng hợp high/low từ partial response không được backend chuẩn hóa,
- trộn unit `VND` và `thousand VND` giữa các field.

### 6.2 Session high/low

Phải là high/low của phiên đang resolve cho chart, không phải high/low của ngày lịch khác.

## 7. Speed rules

### 7.1 Speed definition

Backend phải chốt một definition duy nhất và version hóa nếu cần.

Cho phép một trong hai hướng:

- `events_per_second`
- `value_velocity_vnd_per_second`

Không được trả cả hai mà không nêu rõ field nào là canonical.

### 7.2 Speed sampling

Khuyến nghị:

- bucket 5 giây hoặc 10 giây,
- giữ linear time semantics,
- degraded nếu source intraday không đủ dày.

## 8. Percentile rules

### 8.1 Baseline

Percentile phải bám trên baseline 10 phiên trước của cùng symbol.

### 8.2 Required metadata

Mỗi record có percentile phải kèm:

- `baseline_sample_size`
- optional `baseline_window_sessions`
- optional `percentile_version`

### 8.3 Fail-safe

Nếu sample size dưới ngưỡng chấp nhận được:

- không trả percentile giả,
- đánh dấu unavailable rõ ràng.

## 9. degraded mode bắt buộc

Response phải có degraded semantics chi tiết cho từng nhóm field:

- `stale_reason`
- `data_state`
- `cache_age_ms`
- optional `missing_fields`

Ví dụ hợp lệ:

- có bubble và flow cơ bản nhưng thiếu session_levels,
- có snapshot cơ bản nhưng thiếu speed,
- có speed nhưng thiếu percentile baseline.

## 10. Cache strategy

### 10.1 Cache key

`whale:analytics:v2:{symbol}:{trade_date}:{timeframe}:{compact}:{contract_version}`

### 10.2 Không được cache sai semantics

Nếu đổi contract price context hoặc percentile version, key phải đổi tương ứng.

### 10.3 Coalescing

Coalescing vẫn là bắt buộc, đặc biệt với Giai đoạn 3 khi baseline queries sẽ nặng hơn.

## 11. Test bắt buộc

### 11.1 Giai đoạn 1

- snapshot giữ đủ threshold ticks trong window,
- threshold metadata hiện đúng,
- event_score không mất trên bubble payload.

### 11.2 Giai đoạn 2

- session_levels có ref/high/low/trần/sàn đúng đơn vị,
- off-hours và holiday không resolve sai price context,
- payload không mâu thuẫn giữa `session_levels` và `price_series`.

### 11.3 Giai đoạn 3

- speed series đúng sampling,
- percentile đúng baseline 10 phiên,
- missing-baseline path degrade đúng.

## 12. Anti-pattern bị cấm

- top-N truncate bubble records trong window,
- trả high/low/trần/sàn không rõ source,
- trả speed hoặc percentile kiểu placeholder `0` khi thực chất thiếu dữ liệu,
- thay đổi contract mà không đổi tài liệu audit tương ứng.

## 13. Definition of done cho backend

Backend chỉ được coi là xong khi:

- snapshot response đủ cho phase đang triển khai,
- event-level bubble không bị suppress sai,
- session_levels đúng source và đúng đơn vị,
- speed/percentile có degraded path rõ ràng,
- test contract pass,
- QA/auditor truy vết được từng field về đúng nguồn và đúng semantics.
