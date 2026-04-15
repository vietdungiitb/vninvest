# Playbook triển khai triệt để realtime ticker 429

Ngày cập nhật: 2026-04-15

Trạng thái tài liệu: sẵn sàng triển khai

Đối tượng sử dụng:

- đội backend
- đội frontend
- đội DevOps
- QA / release owner

Phạm vi:

- biến `/api/realtime/ticker/<symbol>/` thành cache-only
- thay prefetch hiện tại bằng mô hình shard theo symbol universe với tier hot/warm/cold
- bóc legacy backend theo dependency graph sau khi hot path ổn định

Tài liệu liên quan:

- [docs/REALTIME_TICKER_CAPACITY_PLAN_20260415.md](c:/Mujoco%20Projects/vninvest/docs/REALTIME_TICKER_CAPACITY_PLAN_20260415.md)

## 1. Bối cảnh và quyết định kiến trúc

Hệ thống hiện tại đã có các thành phần nền tảng cần thiết:

- Redis cache riêng ở db=2 trong [backend/config/settings.py](c:/Mujoco%20Projects/vninvest/backend/config/settings.py)
- prefetch ticker trong [backend/portfolio/tasks_prefetch.py](c:/Mujoco%20Projects/vninvest/backend/portfolio/tasks_prefetch.py)
- endpoint ticker trong [backend/portfolio/market_data_service.py](c:/Mujoco%20Projects/vninvest/backend/portfolio/market_data_service.py)
- WebSocket fan-out qua Channels trong [backend/portfolio/realtime/publisher.py](c:/Mujoco%20Projects/vninvest/backend/portfolio/realtime/publisher.py)
- realtime consumer trong [backend/portfolio/consumers.py](c:/Mujoco%20Projects/vninvest/backend/portfolio/consumers.py)

Nhưng hot path hiện vẫn còn sai về kiến trúc ở điểm sau:

- request HTTP `/api/realtime/ticker/<symbol>/` vẫn có thể gọi `vnstock` trực tiếp khi cache miss
- request HTTP vẫn có thể enqueue prefetch từ request thread
- prefetch hiện vẫn là một job quét theo danh sách symbol, chưa có khái niệm tier theo heat và shard theo universe
- nhiều wrapper realtime backend vẫn dùng helper từ `views.py` cũ nên chưa thể xóa legacy trực tiếp

Quyết định kiến trúc chốt cho production:

1. HTTP ticker là cache-only.
2. Upstream `vnstock` chỉ được gọi từ scheduler/prefetch pipeline.
3. Chi phí upstream phải tỷ lệ theo `unique symbols`, không tỷ lệ theo `users x watchlist size`.
4. Legacy backend chỉ được bóc sau khi hot path và scheduler mới đã ổn định.

## 2. Kết quả benchmark dùng làm chuẩn thiết kế

Các số sau đã được đo ngay trong repo ngày 2026-04-15.

### 2.1 Provider benchmark

Nguồn benchmark: `run_price_board_provider_benchmark`

Kết quả thực đo:

- `KBS @ concurrency=16`: `622.02 requests/min`, `0% rate-limited`, `100% success`
- `VCI`: `0% success` trong môi trường benchmark hiện tại

Kết luận:

- production primary provider hiện tại phải là `KBS`
- `VCI` không được dùng để ước tính công suất chính

### 2.2 Batch benchmark thực tế

Đo trực tiếp `fetch_price_board_dataframe(..., source='KBS')` với batch `60` mã:

- run 1: `685.5 ms`, `60 rows`
- run 2: `693.6 ms`, `60 rows`
- run 3: `666.4 ms`, `60 rows`

Suy ra:

- trung bình `~0.682s / batch 60 symbols`
- một worker chạy tuần tự xấp xỉ `~88 calls/min`
- tương đương `~5,280 symbol snapshots/min`

### 2.3 Redis local benchmark

Đo `5000 set` + `5000 get` qua Django cache:

- `set_ops_per_sec`: `565.66`
- `get_ops_per_sec`: `766.67`

Ý nghĩa:

- ở mức `6000 request/phút = 100 request/giây`, Redis không phải nút thắt đầu tiên
- nút thắt chính vẫn là upstream `vnstock` nếu request path còn chạm upstream

## 3. Mục tiêu cuối cùng

Sau khi hoàn tất toàn bộ playbook này, hệ thống phải đạt được các trạng thái sau:

1. `/api/realtime/ticker/<symbol>/` không gọi `vnstock` trong request path.
2. Không enqueue prefetch từ request thread.
3. Mọi ticker response đến từ cache snapshot hoặc stale cache có chủ đích.
4. Prefetch chạy theo symbol universe tổng hợp, có tier hot/warm/cold.
5. Upstream calls/minute được tính và quan sát trực tiếp.
6. Các wrapper legacy realtime không còn phụ thuộc vào `legacy_views` trước khi bị xóa.

## 4. Kiến trúc mục tiêu sau cùng

Luồng dữ liệu mục tiêu:

1. Thu thập symbol universe từ dữ liệu người dùng và hệ thống.
2. Gán heat cho symbol theo subscriber count.
3. Chia symbol thành các tier hot/warm/cold.
4. Chia từng tier thành các shard ổn định.
5. Scheduler enqueue job prefetch cho từng shard theo cadence riêng.
6. Job shard gọi `vnstock` theo batch `40-60` mã.
7. Kết quả ghi vào Redis snapshot `ticker:<SYMBOL>`.
8. HTTP `/api/realtime/ticker/<symbol>/` chỉ đọc snapshot.
9. WebSocket publish đọc snapshot delta hoặc payload mới sinh từ prefetch/realtime stream.

## 5. Phân pha triển khai

Triển khai theo 3 pha bắt buộc, không trộn lẫn.

### Pha 1

Cache-only ticker hot path.

### Pha 2

Universe snapshot + tiering + shard scheduler.

### Pha 3

Service hóa helper realtime rồi bóc legacy backend.

## 6. Pha 1: cache-only ticker hot path

### 6.1 Mục tiêu pha 1

Biến `get_realtime_ticker` thành đường đọc cache thuần túy.

### 6.2 File sẽ chỉnh

- [backend/portfolio/market_data_service.py](c:/Mujoco%20Projects/vninvest/backend/portfolio/market_data_service.py)
- [backend/portfolio/market_views.py](c:/Mujoco%20Projects/vninvest/backend/portfolio/market_views.py)
- [backend/config/settings.py](c:/Mujoco%20Projects/vninvest/backend/config/settings.py)
- test mới trong thư mục tests backend realtime bulk

### 6.3 Những đoạn code phải loại bỏ khỏi hot path

Trong `MarketDataService.get_realtime_ticker` phải bỏ hoàn toàn:

- on-demand lock `ticker:ondemand:lock:*`
- nhánh gọi `fetch_price_board_dataframe([normalized_symbol], ...)`
- nhánh enqueue `prefetch_ticker_price_board`

### 6.4 Hành vi mới của endpoint

`get_realtime_ticker(symbol)` phải hoạt động theo trình tự sau:

1. chuẩn hóa symbol
2. đọc `ticker:<SYMBOL>` từ cache
3. nếu có snapshot còn tươi:
   trả `200`, `stale=false`, `source=cache`
4. nếu snapshot quá ngưỡng freshness nhưng vẫn nằm trong cửa sổ stale cho phép:
   trả `200`, `stale=true`, `source=stale_cache`
5. nếu không có snapshot:
   trả `503` hoặc `200` degraded theo config, nhưng tuyệt đối không gọi upstream

### 6.5 Contract response chuẩn hóa

Payload tối thiểu phải giữ tương thích với frontend hiện tại:

- `symbol`
- `current_price`
- `prev_price`
- `change_value`
- `change_pct`
- `high_price`
- `low_price`
- `open_price`
- `volume`
- `last_date`
- `freshness_seconds`
- `stale`
- `source`

Khuyến nghị thêm trường mới:

- `cache_state`: `fresh|stale|miss`
- `served_at`

### 6.6 Cấu hình mới cần thêm

Trong [backend/config/settings.py](c:/Mujoco%20Projects/vninvest/backend/config/settings.py):

- `REALTIME_TICKER_CACHE_ONLY=true`
- `TICKER_FRESHNESS_SECONDS=15`
- `TICKER_STALE_SERVE_SECONDS=90`
- `TICKER_CACHE_MISS_STATUS_CODE=503`
- `TICKER_CACHE_MISS_ALLOW_DEGRADED=false`

### 6.7 Test cases bắt buộc

Viết test backend để chứng minh:

1. cache hit trả `200` và không gọi `fetch_price_board_dataframe`
2. stale cache trả `200` với `stale=true`
3. cache miss không gọi `fetch_price_board_dataframe`
4. cache miss không gọi `prefetch_ticker_price_board.apply_async`
5. response miss có shape ổn định, không làm frontend crash
6. throttle hiện tại không còn bị kích hoạt bởi on-demand upstream path

### 6.8 Observability pha 1

Thêm hoặc chuẩn hóa các metric:

- `ticker_cache_hit_total`
- `ticker_cache_stale_total`
- `ticker_cache_miss_total`
- `ticker_cache_hit_ratio`

### 6.9 Điều kiện chấp nhận pha 1

Pha 1 hoàn thành khi:

- grep code không còn on-demand fetch trong `get_realtime_ticker`
- load test `6000 request/phút` vào ticker endpoint không làm tăng upstream calls
- dashboard hoặc log chứng minh cache miss không chạm `vnstock`

## 7. Pha 2: universe snapshot + tier hot/warm/cold + shard scheduler

### 7.1 Mục tiêu pha 2

Chuyển prefetch hiện tại từ quét tuần tự sang mô hình scheduler theo unique symbol universe.

### 7.2 File sẽ chỉnh

- [backend/portfolio/tasks_prefetch.py](c:/Mujoco%20Projects/vninvest/backend/portfolio/tasks_prefetch.py)
- [backend/config/settings.py](c:/Mujoco%20Projects/vninvest/backend/config/settings.py)
- có thể thêm module mới:
  - `backend/portfolio/realtime_universe.py`
  - `backend/portfolio/realtime_tiering.py`
  - `backend/portfolio/realtime_sharding.py`

### 7.3 Nguồn dữ liệu symbol universe

Universe phải hợp nhất từ:

- `TrackedSymbol`
- `WatchlistItem`
- `PriceAlertRule`
- `Transaction`
- tùy chọn `SecuritiesItem`

Output cần tạo ra một snapshot dedup theo symbol gồm:

- `symbol`
- `subscriber_count`
- `tracked_by_watchlist_users`
- `tracked_by_alert_rules`
- `tracked_by_portfolio_holders`
- `is_system_symbol`
- `tier`
- `shard_id`
- `computed_at`

### 7.4 Heat model

Heat model phải đơn giản, dễ quan sát, dễ debug.

Khuyến nghị score:

$$
heat = 5 * watchlist_users + 3 * alert_users + 2 * holding_users + 1 * system_weight
$$

Không cần ML. Chỉ cần deterministic và reproducible.

### 7.5 Quy tắc tier mặc định

Mặc định production ban đầu:

- hot: top `200` symbol theo heat
- warm: top tiếp theo `600`
- cold: phần còn lại đến trần `1800`

Cadence mặc định:

- hot: `3s`
- warm: `5s`
- cold: `15s`

### 7.6 Quy tắc shard mặc định

Mặc định production ban đầu:

- hot: `4` shard
- warm: `6` shard
- cold: `6` shard

Batch size mặc định:

- hot: `50`
- warm: `60`
- cold: `60`

### 7.7 Cách tính trần upstream calls/phút

Với mỗi tier:

$$
calls\_per\_minute = \left\lceil \frac{symbols\_in\_tier}{batch\_size} \right\rceil \times \frac{60}{interval\_seconds}
$$

Tổng system budget:

$$
total\_upstream\_calls\_per\_minute = \sum calls\_per\_minute(tier)
$$

Budget đỏ hiện tại theo benchmark:

- soft cap: `400 calls/min`
- warning cap: `500 calls/min`
- hard cap: `600 calls/min`

### 7.8 Scheduler architecture

Tách thành 3 lớp task:

1. `build_realtime_symbol_universe_snapshot`
2. `schedule_realtime_prefetch_shards`
3. `prefetch_realtime_ticker_shard(tier, shard_id)`

Không giữ mô hình một task quét cả list rồi tự chia batch bên trong nữa.

### 7.9 Cơ chế lock

Mỗi task phải có distributed lock riêng:

- `lock:realtime_universe:snapshot`
- `lock:realtime_prefetch_scheduler`
- `lock:realtime_prefetch:<tier>:<shard_id>`

Nếu lock đang giữ thì skip, không retry chồng chéo.

### 7.10 Cache keys cần chuẩn hóa

Giữ nguyên:

- `ticker:<SYMBOL>`

Thêm mới:

- `ticker:meta:<SYMBOL>`
- `realtime:universe:snapshot`
- `realtime:universe:hot`
- `realtime:universe:warm`
- `realtime:universe:cold`
- `realtime:shard:<tier>:<shard_id>`

### 7.11 Metadata ticker cần lưu

Trong `ticker:meta:<SYMBOL>` lưu tối thiểu:

- `tier`
- `shard_id`
- `upstream_source`
- `fetched_at`
- `last_success_at`
- `failure_count`
- `last_error`

### 7.12 Quy tắc degraded mode

Nếu upstream budget hoặc rate-limit bị chạm:

- hot tier giữ cadence lâu nhất có thể
- warm tier bị giãn trước
- cold tier có thể suspend tạm thời

Ưu tiên degrade theo thứ tự:

1. cold
2. warm
3. hot

### 7.13 Cấu hình mới cần thêm

Trong [backend/config/settings.py](c:/Mujoco%20Projects/vninvest/backend/config/settings.py):

- `TICKER_UNIVERSE_REFRESH_SECONDS=60`
- `TICKER_UNIVERSE_SYMBOL_LIMIT=1800`
- `TICKER_PREFETCH_HOT_LIMIT=200`
- `TICKER_PREFETCH_WARM_LIMIT=600`
- `TICKER_PREFETCH_HOT_INTERVAL_SECONDS=3`
- `TICKER_PREFETCH_WARM_INTERVAL_SECONDS=5`
- `TICKER_PREFETCH_COLD_INTERVAL_SECONDS=15`
- `TICKER_PREFETCH_HOT_SHARDS=4`
- `TICKER_PREFETCH_WARM_SHARDS=6`
- `TICKER_PREFETCH_COLD_SHARDS=6`
- `TICKER_PREFETCH_BATCH_SIZE_HOT=50`
- `TICKER_PREFETCH_BATCH_SIZE_WARM=60`
- `TICKER_PREFETCH_BATCH_SIZE_COLD=60`
- `TICKER_UPSTREAM_SOFT_CAP_PER_MINUTE=400`
- `TICKER_UPSTREAM_WARNING_CAP_PER_MINUTE=500`
- `TICKER_UPSTREAM_HARD_CAP_PER_MINUTE=600`

### 7.14 Metrics bắt buộc pha 2

Phải quan sát được:

- `realtime_unique_symbols_total`
- `realtime_hot_symbols_total`
- `realtime_warm_symbols_total`
- `realtime_cold_symbols_total`
- `realtime_upstream_calls_total`
- `realtime_upstream_calls_per_minute`
- `realtime_prefetch_batch_latency_ms`
- `realtime_prefetch_rows_cached_total`
- `realtime_shard_skipped_lock_total`
- `realtime_shard_error_total`

### 7.15 Test cases bắt buộc pha 2

1. snapshot universe dedup đúng
2. score heat deterministic
3. tier assignment đúng ngưỡng
4. shard assignment ổn định
5. scheduler chỉ enqueue đúng số shard active
6. shard task chỉ fetch symbol thuộc shard đó
7. batch size và interval áp dụng đúng theo tier
8. over-budget làm cold degrade trước

### 7.16 Điều kiện chấp nhận pha 2

Pha 2 hoàn thành khi:

- upstream calls/minute được tính và log ra rõ ràng
- ticker cache hit ratio tăng rõ rệt
- number of upstream calls không còn phụ thuộc trực tiếp vào số request HTTP
- system vận hành ổn định với cadence theo tier

## 8. Pha 3: bóc legacy backend theo dependency graph

### 8.1 Mục tiêu pha 3

Loại bỏ dependency `legacy_views` khỏi các wrapper realtime trước khi xóa legacy code.

### 8.2 Tại sao chưa xóa thẳng được

Các file sau vẫn gọi helper nằm trong `views.py` cũ:

- [backend/portfolio/views_realtime_core.py](c:/Mujoco%20Projects/vninvest/backend/portfolio/views_realtime_core.py)
- [backend/portfolio/views_realtime_advanced.py](c:/Mujoco%20Projects/vninvest/backend/portfolio/views_realtime_advanced.py)
- [backend/portfolio/views_realtime_depth_financial.py](c:/Mujoco%20Projects/vninvest/backend/portfolio/views_realtime_depth_financial.py)

Vì vậy nếu xóa ngay sẽ gây vỡ import chain.

### 8.3 Nguyên tắc bóc legacy

Không bóc theo file name.
Phải bóc theo dependency group.

### 8.4 Nhóm helper cần tách khỏi `views.py`

Nhóm 1, ưu tiên cao:

- cache helper
- rate limit helper
- ticker/intraday parsing helper

Nhóm 2:

- whale helpers
- threshold helpers
- scoring helper glue

Nhóm 3:

- depth/financial formatter helpers

### 8.5 Service modules đề xuất

Tạo các module mới:

- `backend/portfolio/services_realtime_cache.py`
- `backend/portfolio/services_realtime_ticker.py`
- `backend/portfolio/services_realtime_intraday.py`
- `backend/portfolio/services_realtime_whale.py`
- `backend/portfolio/services_realtime_depth.py`
- `backend/portfolio/services_realtime_financials.py`

### 8.6 Trình tự refactor cụ thể

#### Bước 1

Chuyển các helper chung từ `views.py` sang service modules, giữ nguyên hành vi.

#### Bước 2

Đổi import trong:

- [backend/portfolio/views_realtime_core.py](c:/Mujoco%20Projects/vninvest/backend/portfolio/views_realtime_core.py)
- [backend/portfolio/views_realtime_advanced.py](c:/Mujoco%20Projects/vninvest/backend/portfolio/views_realtime_advanced.py)
- [backend/portfolio/views_realtime_depth_financial.py](c:/Mujoco%20Projects/vninvest/backend/portfolio/views_realtime_depth_financial.py)

từ `legacy_views.*` sang service mới.

#### Bước 3

Thêm regression tests để so output cũ và mới tương đương.

#### Bước 4

Khi grep không còn `from . import views as legacy_views` trong nhóm realtime target, mới bắt đầu xóa wrapper thừa hoặc merge vào [backend/portfolio/market_views.py](c:/Mujoco%20Projects/vninvest/backend/portfolio/market_views.py).

### 8.7 Test cases bắt buộc pha 3

1. ticker parity test
2. intraday parity test
3. whale feed parity test
4. rvol parity test
5. depth chart parity test
6. financial metrics parity test

### 8.8 Điều kiện chấp nhận pha 3

Pha 3 hoàn thành khi:

- group realtime target không còn import `legacy_views`
- test parity pass
- không còn route active nào dùng helper nằm trong `views.py` cũ cho path realtime target

## 9. Phân công chi tiết theo vai trò

### 9.1 Backend engineer A

Phụ trách pha 1:

- cache-only ticker
- response contract
- tests cho hit/stale/miss

### 9.2 Backend engineer B

Phụ trách pha 2:

- universe snapshot
- heat scoring
- shard scheduler
- metrics prefetch

### 9.3 Backend engineer C

Phụ trách pha 3:

- tách helper khỏi `views.py`
- parity tests
- xóa legacy import chain

### 9.4 Frontend engineer

Phối hợp:

- kiểm tra response `cache_miss` không làm UI crash
- dùng `stale`/`cache_state` để hiển thị trạng thái dữ liệu
- giữ WebSocket là nguồn ưu tiên cho live refresh

### 9.5 DevOps

Phụ trách:

- cấu hình env mới
- monitor Redis/Channels/Celery queue depth
- alert upstream calls/minute

### 9.6 QA

Phụ trách:

- smoke test dashboard, watchlist, stock detail
- verify stale behavior
- verify cache-only mode không sinh 429 do request path

## 10. Danh sách việc theo thứ tự commit

### Commit group A

Cache-only ticker:

- sửa `get_realtime_ticker`
- thêm env settings mới
- thêm tests hit/stale/miss

### Commit group B

Universe snapshot:

- module build snapshot
- score heat
- cache snapshot

### Commit group C

Shard scheduler:

- task scheduler
- task shard worker
- cadence theo tier

### Commit group D

Observability:

- metrics upstream budget
- shard latency
- cache ratios

### Commit group E

Legacy extraction:

- tách helper sang service modules
- đổi import wrappers
- parity tests

### Commit group F

Legacy cleanup:

- xóa wrappers/bridge không còn reach được
- cập nhật docs và changelog

## 11. Rollout production chi tiết

### Giai đoạn 0

Chuẩn bị:

- merge code sau khi tests pass
- bật metrics nhưng chưa bật cache-only nếu dùng feature flag

### Giai đoạn 1

Bật `REALTIME_TICKER_CACHE_ONLY=true` cho staging.

Theo dõi:

- cache hit ratio
- cache miss ratio
- 429 rate
- frontend error rate

### Giai đoạn 2

Deploy production với cache-only nhưng vẫn dùng prefetch cũ.

Mục tiêu:

- cắt đứt on-demand fetch trong hot path càng sớm càng tốt

### Giai đoạn 3

Deploy universe snapshot + shard scheduler song song với prefetch cũ nhưng chưa switch traffic.

### Giai đoạn 4

Chuyển traffic sang shard scheduler, tắt prefetch cũ.

### Giai đoạn 5

Ổn định 3-5 ngày rồi mới bắt đầu bóc legacy backend.

## 12. Tiêu chí thành công cuối cùng

Hệ thống được coi là hoàn tất khi đồng thời đạt đủ các điều kiện sau:

1. `/api/realtime/ticker/<symbol>/` là cache-only.
2. Upstream calls/minute được budget và quan sát được.
3. Hot/warm/cold tier vận hành đúng cadence.
4. Cache hit ratio cao, miss ratio thấp và có giải thích được.
5. Không còn import `legacy_views` trong nhóm realtime target.
6. Không còn lỗi `429` do request path gọi trực tiếp `vnstock`.

## 13. Phụ lục: checklist triển khai nhanh

### Checklist pha 1

- [ ] bỏ on-demand fetch trong `get_realtime_ticker`
- [ ] bỏ enqueue prefetch từ request thread
- [ ] thêm `REALTIME_TICKER_CACHE_ONLY`
- [ ] thêm tests hit/stale/miss
- [ ] log/metric cache ratios

### Checklist pha 2

- [ ] build snapshot unique symbol universe
- [ ] tính heat score
- [ ] assign tier
- [ ] assign shard
- [ ] scheduler enqueue per shard
- [ ] metrics upstream budget
- [ ] degrade cold before warm before hot

### Checklist pha 3

- [ ] tách helper khỏi `views.py`
- [ ] đổi import wrappers
- [ ] parity tests pass
- [ ] grep không còn `legacy_views` trong realtime target
- [ ] xóa bridge thừa

## 14. Chốt quyết định thực thi

Thứ tự triển khai bắt buộc là:

1. cache-only ticker
2. shard prefetch + hot/warm/cold
3. service hóa helper realtime
4. xóa legacy backend

Không đảo thứ tự này.

Nếu đảo, khả năng cao sẽ rơi vào một trong ba lỗi:

- 429 vẫn còn vì hot path chưa bị cắt upstream
- scheduler mới chưa ổn định nhưng stale handling chưa đủ tốt
- xóa legacy quá sớm làm vỡ import chain trong realtime wrappers