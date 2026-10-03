# Celery Runtime Incident 2026-04-13

## Tóm tắt

Realtime background pipeline bị lỗi âm thầm sau khi task được tách từ `portfolio.tasks` sang các module con như `portfolio.tasks_prefetch`, `portfolio.tasks_order_flow`, `portfolio.tasks_realtime`.

Celery Beat vẫn phát message với tên task cũ dạng `portfolio.tasks.*`, nhưng Celery Worker chỉ đăng ký tên mặc định theo module mới. Kết quả là Beat tiếp tục enqueue đều đặn nhưng Worker discard message với lỗi `Received unregistered task`.

Sau khi fix xong lỗi task-name mismatch, một lỗi runtime thứ hai lộ ra: stream pipeline dùng fallback `STREAM_REDIS_URL=redis://localhost:6379/1` trong container vì compose chưa truyền biến môi trường này. Điều đó làm `run_stream_consumer_batch` và `TickProducer` không đọc/ghi được Redis Streams, dù task đã chạy.

## Triệu chứng quan sát được

- `Prefetch health` thường xuyên `DEGRADED` dù Beat vẫn chạy.
- Metadata cũ có thể vẫn báo `status=ok`, nhưng `freshness_seconds` tăng và `sample_cache_hits=0`.
- Worker log có lỗi `Received unregistered task of type 'portfolio.tasks.prefetch_ticker_price_board'` và tương tự cho order-flow, reversal, realtime publish, stream consumer.
- Sau khi sửa task name, worker log chuyển sang lỗi `Error 111 connecting to localhost:6379` ở stream consumers và tick producer.

## Root Cause

1. Task name public của Celery không được cố định khi refactor module.
2. Lịch Beat và các caller vẫn dùng namespace công khai `portfolio.tasks.*`.
3. `STREAM_REDIS_URL` không được inject vào compose runtime, còn fallback trong settings trỏ về `localhost`, không phù hợp bên trong container.

## Sửa chữa đã áp dụng

### 1. Cố định task name public

Thêm `name='portfolio.tasks.<task_name>'` vào các Celery task được re-export qua `portfolio.tasks`, bao gồm:

- prefetch
- order flow detection
- whale reversal detection
- realtime publish
- stream consumer / trim / cleanup / benchmark
- rollout / lifecycle / watch sync
- advisory auto generation / advisory generation / advisory flush
- news digest

Điều này giữ nguyên contract công khai cho Beat, API async trigger, và mọi external caller dùng task name string cũ.

### 2. Thêm regression test

Tạo `backend/portfolio/tests/test_celery_task_names.py` để khóa contract `task.name == 'portfolio.tasks.*'` cho các task công khai quan trọng.

### 3. Sửa cấu hình Redis Streams

- `backend/config/settings.py`: `STREAM_REDIS_URL` nay tự suy ra từ `REALTIME_REDIS_URL` theo cùng host nhưng db=1 nếu biến môi trường chưa được set.
- `docker-compose.yml` và `docker-compose.dev.yml`: inject rõ `REALTIME_REDIS_URL` và `STREAM_REDIS_URL` cho backend/celery services.

## Xác minh sau fix

- `celery inspect registered` trong dev stack trả về đúng các task `portfolio.tasks.*`.
- Beat log phát đúng task `portfolio.tasks.run_stream_consumer_batch`, `portfolio.tasks.collect_and_publish_realtime`, `portfolio.tasks.prefetch_ticker_price_board`, `portfolio.tasks.detect_and_store_order_flow`, `portfolio.tasks.detect_whale_reversal`.
- Worker log nhận và hoàn thành task thành công, không còn `unregistered task`, không còn `localhost:6379 connection refused` cho stream pipeline.
- `GET /api/health/` trả `200`.
- `GET /api/health/prefetch/` trả `healthy=true`; ngoài giờ giao dịch thì trạng thái đúng là `throttled_by_policy`, không phải `degraded`.

## Ghi chú vận hành

- Khi kiểm tra runtime dev, luôn dùng explicit compose invocation:
  - `docker compose --env-file compose.dev.env -p vninvest-dev -f docker-compose.yml -f docker-compose.dev.yml ...`
- Tránh chạy `docker compose up` chỉ với file base trong repo này, vì dễ dựng nhầm stack mặc định với env production/fallback và gây runtime drift.