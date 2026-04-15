# Kế hoạch xử lý triệt để 429 realtime ticker

## 1. Kết luận ngắn

- Không thể giải quyết bài toán bằng cách chỉ tăng `DRF_REALTIME_TICKER_RATE`.
- Mô hình đúng là: `vnstock -> batch prefetch -> Redis cache -> WebSocket fan-out -> HTTP ticker chỉ đọc cache`.
- Mọi đường fallback khiến request HTTP có thể gọi upstream trực tiếp phải bị loại bỏ khỏi đường nóng.

## 2. Số đo tham chiếu trong repo ngày 2026-04-15

### 2.1 Benchmark provider đơn lẻ

Chạy hàm `run_price_board_provider_benchmark` với:

- symbol: `VNM`
- providers: `KBS`, `VCI`
- concurrency: `2, 4, 8, 16`
- runs: `2`
- timeout: `8s`

Kết quả:

- `KBS @ concurrency=16`: `622.02 requests/min`, `0% rate_limited`, `100% success`
- `VCI`: `0% success` ở toàn bộ mức benchmark trong môi trường hiện tại

Suy ra:

- provider primary thực tế hiện nay phải là `KBS`
- `VCI` chỉ nên giữ vai trò fallback phụ trợ, không được coi là capacity line chính

### 2.2 Benchmark batch price board thực tế

Đo trực tiếp `fetch_price_board_dataframe(..., source='KBS')`:

- batch `60 symbols`
- 3 lần chạy

Kết quả:

- run 1: `685.5 ms`, `60 rows`
- run 2: `693.6 ms`, `60 rows`
- run 3: `666.4 ms`, `60 rows`

Trung bình xấp xỉ:

- `~0.682s / call`
- `~88 calls/phút` nếu chạy tuần tự một worker
- `~5,280 symbol snapshots/phút` với batch `60`

### 2.3 Benchmark cache local

Đo `5000 cache.set` + `5000 cache.get` với payload ticker:

- `set_ops_per_sec`: `565.66`
- `get_ops_per_sec`: `766.67`

Lưu ý:

- đây là benchmark local đồng bộ qua Django cache trên máy dev Windows
- production Redis thực tế thường tốt hơn đáng kể
- ngay cả số local này cũng đã vượt mức `6000 HTTP requests/phút = 100 req/s`

## 3. Tính toán năng lực phục vụ

## 3.1 Nếu giữ mô hình cũ: user polling -> HTTP -> upstream

Giả sử:

- `10,000` user đồng thời
- mỗi user theo dõi `100` mã
- refresh mỗi `5s`

Khi đó nhu cầu là:

$$
10{,}000 \times 100 / 5 = 200{,}000 \text{ quote requests/second}
$$

Hay:

$$
12{,}000{,}000 \text{ quote requests/minute}
$$

Mô hình này không thể tồn tại.

## 3.2 Nếu quy về unique symbol universe

Giả sử toàn thị trường phục vụ `1,600` mã đang được theo dõi thực tế.

Nếu muốn refresh toàn bộ `1,600` mã mỗi `5s` với batch `60`:

$$
\lceil 1600 / 60 \rceil = 27 \text{ upstream calls/cycle}
$$

$$
27 \times 12 = 324 \text{ upstream calls/minute}
$$

Con số `324 calls/minute` vẫn nằm dưới benchmark `KBS ~622 calls/minute`.

Nếu unique universe tăng lên `3,000` mã:

$$
\lceil 3000 / 60 \rceil = 50 \text{ calls/cycle}
$$

$$
50 \times 12 = 600 \text{ calls/minute}
$$

`600 calls/minute` đã chạm sát ngưỡng benchmark hiện tại. Đây là trần thiết kế cần coi là mức đỏ.

## 3.3 Kết luận capacity

- `vnstock/KBS` hiện đủ cho bài toán nếu và chỉ nếu truy vấn được gom theo `unique symbols`, không theo user.
- giới hạn đỏ hiện tại là khoảng `3000 unique symbols @ 5s cadence @ batch 60`.
- với thị trường Việt Nam, unique active symbols thấp hơn nhiều so với `user_count x watchlist_size`, nên hệ thống có thể scale bằng fan-out.

## 4. Redis cần gánh gì

Redis không phải để thay `vnstock`; Redis là lớp snapshot và fan-out metadata.

Mỗi ticker hot path hiện nên chỉ còn:

- `1 cache.get(ticker:<SYMBOL>)`
- không gọi upstream
- nếu miss: trả stale hoặc 503 có chủ đích, không fallback gọi `vnstock` trong request handler

Ở mức `6000 requests/phút`:

$$
6000 / 60 = 100 \text{ cache reads/second}
$$

Ngay benchmark local đã cho khoảng `766 get/s`, tức:

$$
766 \times 60 \approx 45{,}960 \text{ gets/minute}
$$

Vì vậy `6000/min` không phải áp lực đáng kể với Redis. Nút thắt vẫn là upstream và fan-out nếu kiến trúc sai.

## 5. Những thay đổi bắt buộc để hết 429 triệt để

### 5.1 Xóa legacy trên đường nóng frontend

- bỏ cờ `REACT_APP_ENABLE_REALTIME_CONNECTION_MANAGER`
- mọi page dùng một singleton realtime manager duy nhất
- không cho từng page tự fallback sang polling riêng nữa

### 5.2 HTTP ticker phải là cache-only

Endpoint `/api/realtime/ticker/<symbol>/` hiện vẫn còn logic:

- cache miss -> gọi `fetch_price_board_dataframe`
- enqueue prefetch từ request path

Đây là điểm phải bỏ.

Hot path đúng:

- hit cache: trả `200`
- stale cache còn tồn tại: trả payload stale + metadata freshness
- miss hoàn toàn: trả `503` hoặc payload degraded có `source=cache_miss` và để frontend đợi WS/prefetch

Không gọi `vnstock` trong request thread.

### 5.3 Chuyển từ “collect per user” sang “collect per shard of symbols”

`collect_and_publish_realtime` hiện còn tư duy theo user/symbol collection. Ở quy mô lớn cần chuyển sang:

- tạo symbol shards ổn định, ví dụ `8-16 shards`
- mỗi shard chạy theo chu kỳ `3-5s`
- mỗi shard fetch batch `40-60 symbols`
- update Redis snapshot
- publisher chỉ fan-out event từ snapshot mới

### 5.4 Dùng watchlist union toàn cục

Nguồn symbol cho prefetch phải là hợp nhất toàn cục:

- `TrackedSymbol`
- `WatchlistItem`
- `PriceAlertRule`
- `Transaction`
- có thể cộng `SecuritiesItem` cho market overview

Nhưng cần thêm:

- xếp hạng hot symbols theo số subscriber
- ưu tiên cadence nhanh hơn cho nhóm hot nhất
- nhóm nguội refresh chậm hơn

Ví dụ:

- Tier A: top `200` symbols -> `3s`
- Tier B: next `600` symbols -> `5s`
- Tier C: long tail -> `10-20s`

## 6. Cấu hình production đề xuất

### 6.1 Mục tiêu ban đầu an toàn

- `TICKER_PREFETCH_BATCH_SIZE=60`
- `TICKER_PREFETCH_SYMBOL_LIMIT=1800`
- `TICKER_PREFETCH_INTERVAL=5`
- `VNSTOCK_TRADING_AUTO_PRIMARY=kbs`
- `VNSTOCK_KBS_ADAPTIVE_START_CONCURRENCY=16`
- tắt mọi on-demand upstream fetch trong request path

### 6.2 Mục tiêu rollout lớn hơn

- shard prefetch thành `8-16` tasks nhỏ thay vì một task quét tuần tự toàn bộ universe
- TTL ticker cache `10-15s` thay vì `60s` nếu đã có scheduler ổn định `3-5s`
- WebSocket subscription giới hạn theo plan và theo page state

## 7. Legacy code cần xóa theo thứ tự

### 7.1 Xóa ngay

- fallback frontend bằng cờ `ENABLE_REALTIME_CONNECTION_MANAGER`
- mọi logic page-level tự polling khi manager đã tồn tại

### 7.2 Xóa ở bước 2

Trong backend hiện vẫn có nhiều module kiểu:

- `views_realtime_core.py`
- `views_realtime_advanced.py`
- `views_realtime_depth_financial.py`

Những module này là “new class wrappers” nhưng vẫn gọi helper trong `views.py` cũ. Chưa thể xóa triệt để ngay vì helper business logic vẫn nằm trong `views.py`.

Trình tự đúng:

1. tách helper dùng chung ra `services/adapters/utils`
2. đổi import ở các view mới
3. xóa wrapper legacy bridge
4. cuối cùng thu gọn `views.py`

## 8. Kế hoạch triển khai khuyến nghị

### P1. Trong request path

- bỏ on-demand fetch khỏi `get_realtime_ticker`
- bỏ enqueue prefetch từ HTTP request
- trả stale/cache-only payload

### P2. Trong scheduler

- đổi prefetch thành shard scheduler
- thêm tier hot/warm/cold theo subscriber count
- bảo đảm snapshot toàn cục, không theo user

### P3. Trong WebSocket fan-out

- publish theo symbol group snapshot delta
- không nhân số fetch theo số user
- giữ socket là đường chính, HTTP chỉ là fallback snapshot read

### P4. Trong observability

- dashboard các chỉ số: unique symbols, batches/min, upstream calls/min, cache hit ratio, stale ratio, ws subscribers, per-tier latency
- alert khi `upstream calls/min > 70%` benchmark đỏ

## 9. Quyết định kiến trúc

Muốn phục vụ hàng chục nghìn user với watchlist hàng trăm mã thì hệ thống phải tối ưu theo công thức:

$$
\text{cost} \approx O(\text{unique symbols}) + O(\text{fanout})
$$

chứ không được để:

$$
\text{cost} \approx O(\text{users} \times \text{symbols per user})
$$

Nếu chưa đổi sang mô hình đó, lỗi `429 realtime ticker rate` sẽ quay lại bất kể tăng throttle API bao nhiêu.