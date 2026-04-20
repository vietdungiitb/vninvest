# IMPLEMENTATION PLAN - VNSTOCK RUNTIME HARDENING (20260420)

## 1. Business objective

Vấn đề cần giải quyết:
- Chặn triệt để việc khởi tạo lặp client/provider `vnstock` trên các tác vụ nền tần suất cao, gây spam log kiểu `Loaded 162 built-in KBS field mappings`, tăng CPU vô ích và làm nhiễu observability.
- Giảm tải tổng thể cho Celery worker/beat, Redis Streams, Channels và Postgres bằng một gói hardening đồng bộ thay vì vá lẻ từng lỗi.
- Thiết lập guardrail vận hành để cùng một lớp sự cố không tái diễn sau mỗi vòng sửa chữa.

KPI/kết quả kỳ vọng:
- Giảm >= 80% số lần bootstrap `vnstock` provider trên mỗi worker process trong các hot path đã scope.
- Giảm >= 35% CPU trung bình của `celery_worker` trong giờ giao dịch so với baseline hiện tại.
- Giảm rõ rệt log spam bootstrap KBS; mục tiêu là log bootstrap chỉ xuất hiện khi worker process khởi động mới, cache entry bị invalidation, hoặc provider thực sự đổi source.
- Không còn `channels over capacity` trong soak test chuẩn 30 phút với cadence mới.
- Giảm write pressure vào Postgres từ pipeline realtime đủ để RAM DB ổn định hơn và tần suất checkpoint không còn bùng cục bộ theo chu kỳ 3 giây.
- Tất cả thay đổi phải rollback được qua feature flag/env/config mà không cần hotfix code lần hai.

## 2. Scope and non-scope

In-scope:
- `backend/portfolio/adapters/vnstock_adapter.py`: cache/reuse root provider và stock client, bootstrap guard, invalidation strategy, logging hygiene.
- `backend/portfolio/tasks_prefetch.py`: giảm tần suất scheduler/distribution, chống enqueue dư, observability cho batch/shard/provider init.
- `backend/portfolio/tasks_realtime.py` và `backend/portfolio/realtime/collector.py`: giảm gọi upstream lặp, phân định rõ vai trò giữa prefetch quote và intraday polling.
- `backend/portfolio/realtime/stream_consumers.py`: giảm áp lực DB writer / WS broadcaster, thêm guardrail pending depth, batch processing và phát hiện lag.
- `backend/config/settings.py`: chuẩn hóa cadence, feature flags, threshold, channel capacity config, stream intervals.
- `docker-compose.yml`, `docker-compose.dev.yml`, `docker-compose.prod.yml`, `compose.dev.env`: bổ sung resource guardrails, restart policy hợp lý, biến môi trường runtime mới.
- Test suite backend và tài liệu runbook/observability liên quan.

Out-of-scope:
- Refactor toàn bộ kiến trúc realtime sang microservice riêng.
- Thay đổi lớn DB schema hoặc thay Postgres/Redis bằng công nghệ khác.
- Thay đổi UI/frontend ngoài phần cần thiết cho smoke test hoặc hiển thị metric debug.
- Tối ưu toàn bộ business logic AI advisory/whale scoring không liên quan trực tiếp đến runtime hardening.

## 3. Current-state assessment

Hiện trạng đã xác nhận:
- Hàm `_build_stock_client()` tại `backend/portfolio/adapters/vnstock_adapter.py` luôn tạo mới `vnstock_cls().stock(symbol=symbol, source=source)` cho mỗi lần gọi; không có cache process-local theo `source` hoặc `(source, symbol)`.
- Adapter hiện còn nhiều call-site nóng gọi `_build_stock_client()` lặp lại ở các nhánh `price_board`, `intraday`, `overview`, `financial`, `news context`, benchmark và heatmap snapshot.
- `schedule_realtime_prefetch_shards` đang được beat kích hoạt mỗi 1 giây qua `TICKER_PREFETCH_SCHEDULER_INTERVAL_SECONDS=1`, trong khi các tier `hot/warm/cold` chạy với cadence ngắn (`3/5/15 giây`). Dù có check `skipped_due_to_interval`, beat vẫn liên tục quay scheduler và giữ áp lực orchestration cao.
- `prefetch_realtime_ticker_shard` gọi `fetch_price_board_dataframe()` theo batch và mỗi batch lại bootstrap client mới.
- `collect_and_publish_realtime` vẫn chạy mỗi 5 giây, gọi `collect_intraday_frame()` theo từng symbol và tiếp tục đi qua adapter upstream, tạo thêm một đường gọi `vnstock` song song với prefetch.
- Stream consumers chạy mỗi 3 giây qua Celery beat (`db-writer`, `ws-broadcaster`, `alert-engine`) trong khi `collect-and-publish-realtime` cũng đẩy tick lên stream, tạo ra mô hình polling + streaming chồng lớp.
- `CHANNEL_LAYERS` đang dùng `RedisChannelLayer` nhưng chưa cấu hình explicit `capacity`, `channel_capacity`, `expiry`, `group_expiry`; hiện tượng `channels over capacity` vì vậy khó kiểm soát chủ động.
- Docker compose hiện chưa có giới hạn tài nguyên cứng/mềm cho `celery_worker`, `celery_beat`, `db`, `redis`; dev compose còn `restart: "no"`, không phù hợp cho hardening dài hạn.
- Compose và env hiện thiếu các biến điều khiển cache TTL/provider cache size/bootstrap log suppression/cadence override rõ ràng.

Constraint kỹ thuật/hạ tầng:
- Ứng dụng chạy trong Docker Compose, backend là Django + Celery + Redis + Channels + Postgres.
- User yêu cầu mọi thay đổi lớn phải có plan-first và cập nhật audit/progress tập trung.
- Runtime phải giữ backward compatibility, ưu tiên feature flag và env-driven rollout.
- Không được phá contract hiện có cho API realtime/ticker/feed.

## 4. Target design

Kiến trúc đích:
- Áp dụng một `vnstock provider lifecycle manager` ở adapter layer, chạy process-local, thread-safe, có TTL và invalidation theo lỗi.
- Tách 3 lớp cache rõ ràng:
  - Lớp A: cache class/import `Vnstock`.
  - Lớp B: cache root/provider instance theo `source`.
  - Lớp C: cache stock client theo khóa `(source, symbol)` với LRU/TTL hữu hạn.
- Mọi call-site trong adapter phải đi qua factory/cache manager thống nhất; cấm khởi tạo trực tiếp `Vnstock()` trong code runtime sản xuất.
- Thống nhất lại cadence realtime theo nguyên tắc: scheduler chậm hơn hiện tại, quote prefetch là nguồn chính cho quote board, intraday polling chỉ giữ cho trade stream và các use-case thực sự cần tick-by-tick.
- Bổ sung guardrail cho stream pipeline:
  - channel capacity cấu hình được,
  - pending-depth metrics,
  - broadcast drop/degrade strategy khi lag,
  - giới hạn batch xử lý và reclaim.
- Bổ sung resource guardrail ở Docker để khi có regression vẫn không làm treo host.

Luồng dữ liệu đích:
1. Beat scheduler chạy cadence hợp lý hơn, chỉ enqueue shard khi đến hạn thực sự.
2. Shard task lấy provider/client từ cache manager, gọi upstream batch quote với reuse tối đa.
3. Realtime collector chỉ gọi intraday cho nhóm symbol/phase thật sự cần thiết, có thể degrade theo market phase.
4. Redis Streams và Channels dùng capacity + lag metrics để tránh bùng nổ fanout.
5. Postgres chỉ nhận write path đã được batch hóa đủ, có retention và cleanup rõ ràng.

Ownership logic:
- Adapter là SSOT cho mọi tương tác `vnstock`.
- Settings/env là SSOT cho cadence/flags/capacity/resource limits.
- Metrics endpoint là SSOT cho quyết định canary/rollback.

## 5. Execution phases

### Phase 0 - Baseline, feature flags, and safety rails

Mục tiêu:
- Khóa baseline trước khi đụng runtime.
- Tạo tất cả feature flags/env/config cần thiết để rollout theo phase.

Files dự kiến sửa:
- `backend/config/settings.py`
- `backend/.env.example`
- `backend/.env.production.example`
- `compose.dev.env`
- `docker-compose.yml`
- `docker-compose.dev.yml`
- `docker-compose.prod.yml`

Thay đổi chi tiết:
- Thêm các env/flags mới:
  - `VNSTOCK_CLIENT_CACHE_ENABLED=true`
  - `VNSTOCK_PROVIDER_CACHE_ENABLED=true`
  - `VNSTOCK_CLIENT_CACHE_TTL_SECONDS=900`
  - `VNSTOCK_PROVIDER_CACHE_TTL_SECONDS=900`
  - `VNSTOCK_CLIENT_CACHE_MAXSIZE=512`
  - `VNSTOCK_BOOTSTRAP_LOG_SUPPRESS_ENABLED=true`
  - `TICKER_PREFETCH_SCHEDULER_INTERVAL_SECONDS=3`
  - `TICKER_PREFETCH_HOT_INTERVAL_SECONDS=5`
  - `TICKER_PREFETCH_WARM_INTERVAL_SECONDS=10`
  - `TICKER_PREFETCH_COLD_INTERVAL_SECONDS=30`
  - `REALTIME_POLL_INTERVAL=10`
  - `STREAM_CONSUMER_INTERVAL=5`
  - `CHANNEL_LAYER_CAPACITY=500`
  - `CHANNEL_LAYER_GROUP_EXPIRY=300`
  - `CHANNEL_LAYER_EXPIRY=60`
  - `REALTIME_BROADCAST_DEGRADE_ENABLED=true`
  - `REALTIME_BROADCAST_DEGRADE_PENDING_THRESHOLD=2000`
- Chuẩn hóa comment/env docs để đội vận hành hiểu rõ default, safe range, rollback value.
- Đặt resource limits đề xuất trong compose:
  - `celery_worker`: memory reservation 768M, hard limit 1536M, CPU 1.5-2.0.
  - `celery_beat`: hard limit 512M, CPU 0.5.
  - `db`: memory reservation 1024M, hard limit 2048M hoặc theo host capacity.
  - `redis`: hard limit 512M-768M.

Rollback Phase 0:
- Tắt toàn bộ flag cache/degrade mới và đưa cadence về giá trị cũ nếu có blocker trước khi vào phase code sâu hơn.

### Phase 1 - Adapter SSOT and provider/client cache

Mục tiêu:
- Loại bỏ nguyên nhân gốc của bootstrap lặp `vnstock`.

Files dự kiến sửa:
- `backend/portfolio/adapters/vnstock_adapter.py`
- `backend/portfolio/tests/test_adapters.py`
- `backend/portfolio/tasks_news_context.py`
- `backend/portfolio/vnstock_provider_benchmark.py`

Thay đổi chi tiết bắt buộc:
- Tạo cache manager nội bộ trong adapter:
  - `_VNSTOCK_PROVIDER_CACHE: dict[str, ProviderEntry]`
  - `_VNSTOCK_STOCK_CLIENT_CACHE: dict[tuple[str, str], ClientEntry]`
  - lock chung bằng `threading.RLock()`.
- `ProviderEntry` và `ClientEntry` phải chứa ít nhất:
  - `instance`
  - `created_at_epoch`
  - `last_used_epoch`
  - `source`
  - `symbol` cho client cache
  - `generation` hoặc `version` để invalidation an toàn
- Tách factory:
  - `_get_vnstock_provider(source)`
  - `_get_stock_client(symbol, source)`
  - `_invalidate_provider_cache(source, reason)`
  - `_invalidate_stock_client_cache(source, symbol, reason)`
- Refactor `_build_stock_client()` thành wrapper thin gọi cache manager thay vì khởi tạo mới trực tiếp.
- Loại bỏ tất cả khởi tạo trực tiếp `Vnstock().stock(...)` còn sót trong adapter runtime path; heatmap snapshot/overview cũng phải đi qua SSOT mới.
- Thiết lập TTL + maxsize và eviction policy rõ ràng:
  - provider cache TTL 15 phút
  - stock client cache TTL 15 phút
  - maxsize mặc định 512 client entries/process
- Khi gặp lỗi bootstrap/session-related (`vnstock_error`, timeout khi init, payload bootstrap lỗi): invalidation entry rồi retry 1 lần duy nhất nếu policy cho phép.
- Log bootstrap chỉ ở mức `debug` hoặc một lần/mỗi generation; không log lặp trên every reuse.

Acceptance Phase 1:
- Không còn đường runtime nào khởi tạo trực tiếp `Vnstock()` ngoài factory/cache manager đã chuẩn hóa.
- Unit test chứng minh cùng `(source, symbol)` trả về client reuse trong TTL window.
- Unit test chứng minh invalidation khi lỗi sẽ tạo instance mới ở lần sau.
- Benchmark mini cho thấy số lần bootstrap giảm mạnh khi lặp 100 lời gọi cùng source/symbol.

Rollback Phase 1:
- Set `VNSTOCK_CLIENT_CACHE_ENABLED=false`, `VNSTOCK_PROVIDER_CACHE_ENABLED=false` để quay về behavior cũ.

### Phase 2 - Rebalance scheduler and background workload model

Mục tiêu:
- Cắt orchestration overhead và loại bỏ chồng lớp polling không cần thiết.

Files dự kiến sửa:
- `backend/config/settings.py`
- `backend/portfolio/tasks_prefetch.py`
- `backend/portfolio/tasks_realtime.py`
- `backend/portfolio/realtime/collector.py`
- `backend/portfolio/tests/test_ticker_prefetch_task.py`

Thay đổi chi tiết bắt buộc:
- Nâng `TICKER_PREFETCH_SCHEDULER_INTERVAL_SECONDS` từ 1 lên 3 giây mặc định.
- Điều chỉnh cadence mặc định:
  - hot: 5 giây
  - warm: 10 giây
  - cold: 30 giây
- Thêm metric cho scheduler churn:
  - `realtime_prefetch_scheduler_runs_total`
  - `realtime_prefetch_scheduler_enqueued_total`
  - `realtime_prefetch_scheduler_skipped_due_to_interval_total`
  - `realtime_prefetch_scheduler_empty_shard_total`
- Trong `schedule_realtime_prefetch_shards`, bổ sung guard để nếu snapshot stale liên tiếp hoặc shard cache rỗng kéo dài thì tránh quay vòng vô ích và emit metric riêng.
- Rà `collect_and_publish_realtime` để phân tách rõ:
  - path quote board ưu tiên dùng cache/prefetch output nếu đủ tươi,
  - path intraday chỉ gọi upstream cho symbol nằm trong tracked set thực sự cần tick stream.
- Nếu cần, thêm flag `REALTIME_INTRADAY_POLL_ENABLED` và `REALTIME_INTRADAY_POLL_SYMBOL_LIMIT` để kìm blast radius.

Acceptance Phase 2:
- Số lần beat/scheduler wakeup không còn là nguồn tải chính.
- Hot path quote không còn vừa prefetch batch vừa polling intraday cho cùng mục đích hiển thị.
- Dev/prod config có thể rollback cadence ngay qua env.

Rollback Phase 2:
- Trả cadence về giá trị cũ qua env và disable guard mới bằng flags nếu có regression thị trường.

### Phase 3 - Stream, WebSocket, and broadcast pressure hardening

Mục tiêu:
- Loại bỏ nguyên nhân tái diễn `channels over capacity` và pipeline chồng tải.

Files dự kiến sửa:
- `backend/config/settings.py`
- `backend/portfolio/realtime/stream_consumers.py`
- `backend/portfolio/consumers.py`
- `backend/portfolio/services_realtime_metrics.py`
- `backend/portfolio/tests/test_realtime_gateway.py`
- `backend/portfolio/tests/test_realtime_ops_metrics_api.py`

Thay đổi chi tiết bắt buộc:
- Thêm explicit config cho `CHANNEL_LAYERS`:
  - `capacity`
  - `expiry`
  - `group_expiry`
  - `channel_capacity` override cho nhóm `ticker_*` nếu cần.
- Trong `WsBroadcastConsumer`, thêm degrade mode:
  - khi pending depth hoặc broadcast lag vượt threshold thì chỉ gửi payload tối thiểu, bỏ field phụ/costly derivation.
- Thêm metrics:
  - `realtime_channel_group_send_errors_total`
  - `realtime_channel_over_capacity_total`
  - `realtime_broadcast_degrade_activations_total`
  - `realtime_stream_pending_depth{group}`
- Rà lại batch size và `STREAM_BLOCK_MS` để giảm churn đọc rỗng và tránh wakeup thừa.
- Xác định rõ chiến lược reclaim và ACK khi backlog cao; không double-ack và không loop reclaim vô hạn.

Acceptance Phase 3:
- Soak test 30 phút không xuất hiện `channels over capacity`.
- Pending depth trở về baseline sau fault injection.
- Khi degrade kích hoạt, payload contract lõi vẫn giữ tương thích frontend.

Rollback Phase 3:
- Tắt `REALTIME_BROADCAST_DEGRADE_ENABLED` và trả channel capacity về default nếu cần.

### Phase 4 - Docker and runtime resource governance

Mục tiêu:
- Khi có bug tái phát, hệ thống degrade an toàn thay vì treo host hoặc ăn hết RAM.

Files dự kiến sửa:
- `docker-compose.yml`
- `docker-compose.dev.yml`
- `docker-compose.prod.yml`
- `compose.dev.env`
- `docs/PORTAINER_DEPLOY_GUIDE.md` hoặc runbook tương đương nếu đang được dùng

Thay đổi chi tiết bắt buộc:
- Bổ sung resource limits/reservations rõ ràng cho các service nóng.
- Chuẩn hóa restart policy:
  - dev vẫn có thể giữ `restart: "no"` nếu user cần, nhưng phải có profile/tùy chọn hardening riêng cho soak test.
  - prod phải có restart policy bền vững + healthcheck không gây self-DDOS.
- Nếu Redis đang `appendonly yes`, tài liệu phải ghi rõ tác động RAM/IO và giới hạn snapshot/retention.
- Bổ sung runbook xử lý container conflict/network drift mà user đã gặp trong dev stack.

Acceptance Phase 4:
- Compose validate pass.
- Tài nguyên được giới hạn cứng/mềm theo profile môi trường.
- Có lệnh rollback rõ ràng nếu giới hạn quá chặt làm task fail.

Rollback Phase 4:
- Revert resource limit block hoặc chuyển về profile không giới hạn theo file compose backup.

### Phase 5 - Observability, release gates, and anti-regression controls

Mục tiêu:
- Biến hardening thành cơ chế bền vững, không phụ thuộc vào việc “đợi hỏng rồi sửa”.

Files dự kiến sửa:
- `backend/portfolio/views_admin_runtime.py` hoặc metrics endpoint liên quan
- `docs/CODE_CHANGE_AUDIT_LEDGER.md`
- `PROGRESS_DASHBOARD.md`
- runbook/soak checklist docs liên quan

Thay đổi chi tiết bắt buộc:
- Tạo dashboard metrics tối thiểu cho:
  - provider bootstrap count
  - cache hit/miss theo provider/client
  - shard enqueue/skipped ratios
  - stream pending depth
  - over-capacity count
  - DB writer throughput
  - intraday poll calls per minute
- Thiết lập release gates:
  - Gate A: unit/integration pass
  - Gate B: benchmark bootstrap/cadence improvement pass
  - Gate C: soak 30 phút pass
  - Gate D: canary 10% pass
  - Gate E: full rollout sign-off

Acceptance Phase 5:
- Có thể chứng minh bằng metric rằng root-cause cũ đã giảm, không chỉ “cảm giác đỡ hơn”.
- Runbook đủ để on-call xử lý mà không cần đọc lại source code.

Rollback Phase 5:
- Nếu metric không đủ hoặc gate fail, dừng rollout ở phase trước, không merge tiếp code tối ưu sâu hơn.

## 6. API and data contract changes

API/public contract:
- Không đổi schema chính của các API realtime/ticker/feed.
- Không đổi payload contract bắt buộc của websocket event `ticker_update`, `whale`, `dark_flow`.

Data contract nội bộ được phép bổ sung:
- metadata cache/provider usage cho observability nội bộ.
- metric labels và debug counters.

Schema/migration:
- Không có migration DB bắt buộc trong đợt hardening này.
- Nếu sau benchmark xác định cần aggregate table/materialized view mới, đó sẽ là một plan phụ riêng, không gộp vào rollout hiện tại.

Backward compatibility:
- Tất cả thay đổi runtime phải bọc qua feature flag/env.
- Default values phải an toàn và có documented fallback.

## 7. Scheduling and operations

Lịch auto sau hardening đề xuất:
- `schedule-realtime-prefetch-shards`: 3 giây
- `prefetch hot`: 5 giây
- `prefetch warm`: 10 giây
- `prefetch cold`: 30 giây
- `stream consumers`: 5 giây
- `collect-and-publish-realtime`: 10 giây hoặc disable theo market phase nếu đã đủ stream source

Manual trigger/admin:
- Giữ endpoint/health check hiện có.
- Nếu cần thêm warmup/flush cache/admin action, phải đi qua admin runtime tools hiện có, không mở endpoint công khai mới.

Guardrails bắt buộc:
- Per-shard lock giữ nguyên nhưng phải đo metric lock contention.
- Retry upstream tối đa 1 lần sau invalidation bootstrap, không retry vô hạn.
- Timeout phải tách theo channel (`price_board`, `intraday`, `overview`, `financial`).
- Circuit breaker phải có cooldown rõ ràng nếu upstream báo rate-limit hoặc timeout liên tiếp.
- Khi lag cao, degrade thay vì tiếp tục full-fidelity broadcast.

## 8. Testing and verification

Unit tests bắt buộc:
- Adapter cache reuse cho provider theo `source`.
- Adapter cache reuse cho stock client theo `(source, symbol)`.
- TTL expiry tạo instance mới đúng lúc.
- Invalidation khi bootstrap error/session error.
- Scheduler test xác nhận cadence mới và `skipped_due_to_interval` logic không enqueue dư.
- Realtime collector test xác nhận không gọi upstream quote path dư khi cache/prefetch đủ tươi.
- Channel layer config test nếu project đang có smoke settings tests.

Integration tests bắt buộc:
- `prefetch_realtime_ticker_shard` chạy nhiều batch liên tiếp nhưng bootstrap count giảm mạnh.
- `collect_and_publish_realtime` với nhiều symbol không bùng upstream calls vượt budget.
- Stream consumer pipeline vẫn ACK đúng khi bật degrade/pending reclaim.
- WebSocket receive path vẫn nhận payload hợp lệ khi capacity guard bật.

Benchmark/verification steps:
1. Baseline trước thay đổi:
   - CPU/RAM containers
   - số log bootstrap/phút
   - upstream calls/phút
   - pending depth
   - `channels over capacity` count
2. Chạy benchmark adapter bootstrap reuse.
3. Chạy test suite focused.
4. Chạy soak dev 30 phút.
5. Chạy canary staging/prod theo gate.

Mandatory commands checklist:
```powershell
cd backend
python manage.py test portfolio.tests.test_adapters -v 2
python manage.py test portfolio.tests.test_ticker_prefetch_task -v 2
python manage.py test portfolio.tests.test_realtime_gateway -v 2
python manage.py test portfolio.tests.test_realtime_ops_metrics_api -v 2

rg "Vnstock\(|from vnstock import Vnstock" backend/portfolio
rg "_build_stock_client\(" backend/portfolio

# Sau khi code xong va build image moi
cd "C:\Mujoco Projects\vninvest"
docker compose --env-file compose.dev.env -p vninvest-dev -f docker-compose.yml -f docker-compose.dev.yml build backend frontend
docker compose --env-file compose.dev.env -p vninvest-dev -f docker-compose.yml -f docker-compose.dev.yml up -d backend celery_worker celery_beat frontend
```

Exit criteria:
- Focused tests pass.
- Bootstrap log count giảm rõ rệt theo metric/log sample.
- Không có regression hợp đồng payload.
- Soak test pass không có over-capacity mới.

## 9. Observability and alerting

Metrics bắt buộc bổ sung:
- `vnstock_provider_bootstrap_total{source}`
- `vnstock_provider_cache_hit_total{source}`
- `vnstock_provider_cache_miss_total{source}`
- `vnstock_stock_client_cache_hit_total{source}`
- `vnstock_stock_client_cache_miss_total{source}`
- `vnstock_cache_invalidation_total{source,reason}`
- `realtime_prefetch_scheduler_runs_total`
- `realtime_prefetch_scheduler_skipped_due_to_interval_total`
- `realtime_upstream_calls_per_minute`
- `realtime_stream_pending_depth{group}`
- `realtime_channel_over_capacity_total`
- `realtime_broadcast_degrade_activations_total`

Logs bắt buộc:
- Bootstrap log chuyển về structured log với rate-limit hoặc one-shot per generation.
- Invalidation log phải có `source`, `symbol` (nếu có), `reason`, `generation_id`.
- Scheduler log không spam mỗi vòng; chỉ log aggregate theo interval lớn hơn hoặc khi trạng thái thay đổi.

Alerts đề xuất:
- `vnstock_provider_bootstrap_total` tăng đột biến so với baseline.
- `realtime_channel_over_capacity_total > 0` trong 5 phút.
- `realtime_stream_pending_depth{ws-broadcaster}` vượt threshold 5 phút.
- `realtime_upstream_calls_per_minute` vượt soft cap bền vững.

## 10. Security and governance

Permission model:
- Không mở rộng quyền user/admin ngoài surface hiện tại.
- Runtime flags chỉ cấu hình qua env/admin runtime tools hiện có.

Audit trail:
- Mỗi phase merge phải cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md` với file list, lệnh verify, kết quả.
- `PROGRESS_DASHBOARD.md` phải đồng bộ audit file list sau mỗi phase.

Secrets/config management:
- Không commit secrets thật vào repo.
- Chỉ cập nhật `.example` files và docs; giá trị thực được set ngoài runtime.

Governance rule:
- Cấm thêm call trực tiếp `Vnstock()` mới vào runtime path ngoài factory/cache manager.
- Cấm thêm beat task cadence < 3 giây nếu không có benchmark + phê duyệt riêng.
- Cấm sửa hot path mà không thêm metric tương ứng.

## 11. Release plan

Canary/phased rollout:
- Pha 1: enable cache manager + bootstrap metrics trên dev.
- Pha 2: enable cadence mới + capacity guard trên dev soak.
- Pha 3: canary staging/10% symbol cohort hoặc môi trường prod giới hạn.
- Pha 4: 50% rollout nếu sau 1 phiên metric ổn định.
- Pha 5: 100% rollout sau 2-3 phiên không phát sinh regression.

Backout plan:
- Backout level 1: tắt cache flags và degrade flags.
- Backout level 2: trả cadence env về giá trị cũ.
- Backout level 3: bỏ resource limits mới nếu gây restart loop không mong muốn.
- Backout level 4: rollback commit phase gần nhất.

Post-release checklist:
- So sánh bootstrap log count trước/sau.
- Kiểm tra CPU/RAM của `celery_worker`, `celery_beat`, `db`, `redis`.
- Kiểm tra health endpoints và dashboard metrics.
- Kiểm tra không có `channels over capacity` mới.
- Kiểm tra `prefetch` health endpoint và sample ticker freshness.

## 12. Ownership and timeline

Ownership đề xuất:
- Owner chính: Backend/Platform hardening lead.
- Reviewer kỹ thuật: Tech Lead backend.
- Reviewer vận hành: DevOps lead.
- Approver: Engineering owner / PM kỹ thuật.

Timeline đề xuất:
- Day 0: baseline + chốt env flags + compose profile.
- Day 1-2: Phase 1 adapter cache SSOT.
- Day 3: Phase 2 scheduler/polling rebalance.
- Day 4: Phase 3 stream/channels hardening.
- Day 5: Phase 4 docker resource governance.
- Day 6: Phase 5 metrics dashboard + soak.
- Day 7-8: canary + rollback rehearsal + sign-off.

Execution board tối thiểu:
- W1: Adapter cache SSOT and direct-call removal.
- W2: Cadence rebalancing and hot-path dedup.
- W3: Stream + Channels capacity hardening.
- W4: Docker guardrails and runtime docs.
- W5: Tests, soak, canary, sign-off.

---

## Definition of Ready (DoR)
- Plan này được review và chốt.
- Baseline metrics/log sample đã được chụp trước coding.
- Owner + reviewer + approver đã được gán.
- Feature flags/env mới đã thống nhất naming.

## Definition of Done (DoD)
- Hoàn tất các phase đã commit trong scope được duyệt.
- Tests/baseline/soak/canary evidence đầy đủ.
- Audit ledger và progress dashboard được cập nhật.
- Có rollback notes và release decision rõ ràng.

## Danh sách file/module dự kiến tác động mạnh
- `backend/portfolio/adapters/vnstock_adapter.py`
- `backend/portfolio/tasks_prefetch.py`
- `backend/portfolio/tasks_realtime.py`
- `backend/portfolio/realtime/collector.py`
- `backend/portfolio/realtime/stream_consumers.py`
- `backend/config/settings.py`
- `backend/portfolio/services_realtime_metrics.py`
- `backend/portfolio/tests/test_adapters.py`
- `backend/portfolio/tests/test_ticker_prefetch_task.py`
- `backend/portfolio/tests/test_realtime_gateway.py`
- `backend/portfolio/tests/test_realtime_ops_metrics_api.py`
- `docker-compose.yml`
- `docker-compose.dev.yml`
- `docker-compose.prod.yml`
- `compose.dev.env`
- `backend/.env.example`
- `backend/.env.production.example`
