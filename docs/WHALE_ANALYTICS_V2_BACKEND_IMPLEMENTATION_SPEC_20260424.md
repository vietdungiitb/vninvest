# BACKEND IMPLEMENTATION SPEC - WHALE ANALYTICS v2.0

## 1. Mục tiêu

Backend phải cung cấp một snapshot analytics đáng tin cậy, đủ nhanh để frontend chỉ việc render, không phải suy diễn thêm về session, bucket hay strength semantics.

## 2. File neo chính

- `backend/portfolio/views_whale_orders.py`
- `backend/portfolio/views_dark_money_history.py`
- `backend/portfolio/order_flow.py`
- `backend/portfolio/services/` cho service snapshot/cache mới

Khuyến nghị tạo service mới thay vì nhồi thêm logic vào view:
- `backend/portfolio/services/whale_analytics_snapshot.py`

## 3. Trách nhiệm theo lớp

### 3.1 View layer

- validate request
- resolve symbol/timeframe
- gọi snapshot service
- set headers `ETag`, `Last-Modified`, `Cache-Control`
- trả response đã chuẩn hóa

### 3.2 Snapshot service

- resolve session theo `UTC+7`
- resolve `trade_date`
- load dữ liệu nguồn cần thiết
- aggregate theo bucket
- build `price_series`, `bubble_series`, `flow_series`, `summary`
- set metadata `generated_at`, `cache_age_ms`, `is_stale`, `degraded_mode`

### 3.3 Formula layer

- tính CVD
- tính buy strength
- tính institutional strength
- áp low-volume penalty hoặc confidence band

## 4. Quy tắc thời gian bắt buộc

- Timezone chuẩn: `Asia/Ho_Chi_Minh`
- Session intraday: `09:00-15:00`
- Off-hours: trả phiên gần nhất có dữ liệu
- Weekend/holiday: trả phiên gần nhất có dữ liệu
- `bucket_ts` là thời điểm bắt đầu bucket

## 5. Quy tắc bucket

### 5.1 Timeframes hỗ trợ

- `15m`
- `30m`
- `1h`
- `morning`
- `afternoon`
- `session`

### 5.2 ATO/ATC

- Auction orders phải thuộc bucket chứa thời gian của chúng.
- Không được phân bổ sang các phút giả để làm trơn.
- Nếu timeframe dài hơn `1m`, aggregate theo `bucket_start`.

## 6. Công thức strength bắt buộc

### 6.1 Raw intensity

$$
x = w_1 \cdot \left|\frac{buy\_value - sell\_value}{buy\_value + sell\_value + \epsilon}\right| + w_2 \cdot \log\left(1 + \frac{bucket\_value}{baseline\_value + \epsilon}\right)
$$

Mặc định đề xuất:
- $w_1 = 0.6$
- $w_2 = 0.4$

### 6.2 Rolling baseline window

- `N = 30` bucket cho `15m`, `30m`, `1h`
- `N = 60` bucket cho session live hoặc chế độ cần baseline dài hơn

### 6.3 Soft saturation

$$
Strength = \frac{100}{1 + e^{-k \cdot (x - m)}}
$$

Trong đó:
- $m$ là điểm uốn từ rolling baseline
- $k$ đề xuất benchmark trong khoảng `0.8 - 1.2`

### 6.4 Rule nghiệp vụ

- Chỉ bucket thật sự bất thường mới được tiến gần vùng `90-100`.
- Bucket volume thấp không được chạm 100 chỉ vì lệch buy/sell quá sạch.
- Nếu bucket quá nhỏ, phải giảm trọng số hoặc gắn confidence thấp.

## 7. Công thức institutional strength

$$
Institutional\_Raw = \alpha \cdot whale\_ratio + \beta \cdot dark\_flow\_ratio + \gamma \cdot \log(1 + institutional\_value\_multiple)
$$

Sau đó chạy pipeline:
- rolling baseline riêng
- percentile window riêng
- sigmoid soft-saturation riêng

Không dùng lại trực tiếp output raw strength.

## 8. degraded mode

Backend phải bật `degraded_mode = true` khi:
- thiếu reference price nhưng vẫn muốn trả snapshot an toàn
- cache/source dữ liệu chưa kịp refresh nhưng còn snapshot gần nhất
- có data gap ngoài dự kiến khiến không thể khẳng định realtime tuyệt đối

Khi đó response bắt buộc phải có:
- `generated_at`
- `cache_age_ms`
- `data_state`
- `stale_reason`

## 9. Cache strategy

### 9.1 Cache key

Đề xuất:

`whale:analytics:v2:{symbol}:{trade_date}:{timeframe}:{profile}`

### 9.2 TTL

- Trong giờ giao dịch: `5-15s`
- Nghỉ trưa: `60s`
- Ngoài giờ: `15-60 phút`

### 9.3 Coalescing

- Khi nhiều request cùng key bị miss cache, chỉ một worker build snapshot.
- Request còn lại chờ cache hoặc đọc kết quả đã được build xong.

## 10. Response consistency rules

- Bubble, price, flow phải dùng cùng logic `trade_date` và `bucket_ts`.
- Không để bubble thuộc phiên trước còn flow thuộc phiên sau.
- Nếu một phần dữ liệu thiếu, phải degrade rõ ràng thay vì ghép hai phiên khác nhau.

## 11. Test bắt buộc cho backend

### 11.1 Unit tests

- resolve session live
- off-hours fallback
- weekend/holiday fallback
- ATO/ATC bucket mapping
- strength sparse volume
- strength abnormal bucket
- institutional strength baseline riêng

### 11.2 Integration tests

- snapshot endpoint trả đúng schema
- header `ETag` và `Last-Modified` tồn tại
- conditional request nhận `304` khi phù hợp
- degraded mode response có đủ metadata

## 12. Anti-pattern bị cấm ở backend

- build response bằng cách ghép “tạm” từ 2 endpoint cũ ngay tại frontend contract mà không normalize chung.
- để frontend tự sửa timezone mismatch.
- giữ công thức `max(strength_sources)` như hiện tại nếu còn gây bão hòa giả.
- bỏ qua metadata stale/degraded vì “UI không dùng tới”.

## 13. Definition of done cho backend

Backend chỉ được coi là xong khi:
- snapshot endpoint hoạt động đúng spec
- formulas mới có test
- session/timezone rules nhất quán
- cache headers và coalescing tối thiểu đã có
- QA verify payload thật khớp contract