# Đề Xuất: Crawling Control Center Tập Trung

## 1) Mục tiêu
Xây dựng một trung tâm điều phối crawling dữ liệu chứng khoán tập trung, bám sát kiến trúc hiện tại của dự án (Django + Celery + Redis + PostgreSQL), nhằm:
1. Điều phối tác vụ crawl vnbroker tự động trong khung giờ thấp tải (off-peak).
2. Cho phép thao tác thủ công theo từng job: chạy ngay, dừng, tạm khóa, mở khóa.
3. Cấu hình lịch chạy định kỳ từ giao diện quản trị.
4. Theo dõi trạng thái thời gian thực: running, queued, success, failed, canceled, timeout.
5. Chuẩn hóa log/audit để truy vết đầy đủ ai chạy, chạy khi nào, lý do gì, kết quả ra sao.

---

## 2) Phạm vi
### Trong phạm vi
1. Điều phối job crawl giá, cơ bản, giao dịch, và các luồng market-data đã có trong hệ thống.
2. Giao diện quản trị nội bộ cho vận hành và kỹ thuật.
3. API quản trị nội bộ cho điều khiển job/schedule và truy vấn lịch sử.
4. Cơ chế an toàn vận hành: chống chạy trùng, timeout, retry/backoff, graceful stop.

### Ngoài phạm vi (giai đoạn này)
1. Thay đổi thuật toán phân tích tín hiệu/khuyến nghị đầu tư.
2. Mở public API cho bên thứ ba.
3. Tái thiết kế toàn bộ UI dashboard người dùng cuối.

---

## 3) Kiến trúc đề xuất (chuẩn theo stack hiện tại)
```text
Admin Frontend (React/Vite, i18n tiếng Việt)
        |
        v
Django Admin APIs (RBAC + Audit)
        |
        +--> PostgreSQL (job definitions, run logs, audit logs)
        |
        +--> Redis (queue, distributed lock, task state cache)
        |
        +--> Celery Beat (lập lịch)
                 |
                 v
             Celery Workers
                 |
                 v
          vnbroker adapters / crawlers
```

### Thành phần chính
1. Django API layer
- Cung cấp endpoint quản trị job, schedule, manual run, stop/revoke, lịch sử chạy.
- Kiểm soát quyền theo role (Admin/Operator/Viewer).

2. Celery Beat + Celery Worker
- Beat đọc lịch chạy từ DB (django-celery-beat hoặc bảng lịch riêng).
- Worker thực thi crawler qua adapter chuẩn hóa, có retry và timeout.

3. Redis control plane
- Làm broker/result backend và lock chống chạy trùng.
- Lưu cờ dừng mềm (soft-stop) theo run id.

4. PostgreSQL persistence
- Lưu metadata job, lịch chạy, run history, error taxonomy, audit trail.

5. Admin UI
- Trang điều hành tập trung: danh sách job, trạng thái, SLA freshness, thao tác điều khiển.
- Polling ngắn hạn trước, có thể nâng cấp WebSocket sau.

---

## 4) Yêu cầu chức năng
1. Quản lý job
- Tạo/sửa/kích hoạt/vô hiệu hóa job.
- Gán mức ưu tiên, timeout, retry policy, cooldown.

2. Điều phối chạy thủ công
- Run Now theo từng job hoặc theo nhóm.
- Bắt buộc nhập lý do khi bypass off-peak.

3. Dừng job
- Soft stop: đặt cờ dừng để worker thoát an toàn tại checkpoint.
- Hard stop: revoke task khi quá thời gian chờ soft stop.

4. Lập lịch
- Cron-style schedule, timezone Asia/Ho_Chi_Minh.
- Hỗ trợ blackout windows (phiên giao dịch cao tải, bảo trì, ngày lễ).

5. Theo dõi và truy vết
- Trạng thái theo run id, duration, records processed, error summary.
- Lưu log thao tác người dùng (ai, khi nào, hành động gì, payload nào).

---

## 5) Yêu cầu phi chức năng
1. Độ tin cậy
- Không chạy trùng cùng job+scope tại cùng thời điểm (single-flight lock).
- Bảo đảm idempotency cho lệnh Run Now.

2. Hiệu năng
- Overhead điều phối thấp, không ảnh hưởng pipeline crawl chính.
- API trạng thái phản hồi nhanh, có pagination/filter.

3. Bảo mật
- RBAC bắt buộc cho toàn bộ endpoint điều phối.
- Ghi audit đầy đủ cho thao tác nhạy cảm (run/stop/edit schedule/bypass).

4. Vận hành
- Có cảnh báo khi fail liên tiếp, timeout tăng đột biến, hoặc freshness vi phạm SLA.

---

## 6) Thiết kế dữ liệu (đề xuất)
1. CrawlJob
- code, name, provider, data_type, enabled, priority, config_json.

2. CrawlSchedule
- job_id, cron_expr, timezone, off_peak_only, blackout_policy, active.

3. CrawlRun
- run_id, job_id, trigger_type (scheduled/manual), status, queued_at, started_at, finished_at, duration_ms, rows_processed.

4. CrawlRunError
- run_id, error_type, error_code, message, retry_count, stack_trace_ref.

5. CrawlAuditLog
- actor_id, action, target_type, target_id, reason, request_id, created_at.

6. CrawlControlState
- run_id, stop_requested, stop_requested_at, lock_key, heartbeat_at.

---

## 7) Luồng điều phối chuẩn
1. Scheduled flow
- Beat kích hoạt task theo lịch.
- Worker lấy lock Redis theo khóa job+scope.
- Nếu lock đang tồn tại: drop hoặc requeue theo policy.
- Chạy crawler, ghi heartbeat, cập nhật trạng thái theo tiến trình.
- Kết thúc: release lock, cập nhật CrawlRun và metric.

2. Manual run flow
- User bấm Run Now trong UI.
- API kiểm tra quyền và điều kiện off-peak.
- Nếu bypass off-peak: bắt buộc reason + audit.
- Tạo run record, enqueue Celery task với idempotency key.

3. Stop flow
- User gửi stop cho run đang chạy.
- API đặt stop_requested=true.
- Worker đọc cờ tại checkpoint và thoát graceful.
- Nếu quá ngưỡng chờ: hệ thống revoke task và đánh dấu canceled/terminated.

---

## 8) An toàn vận hành bắt buộc
1. Anti-overlap
- Redis distributed lock (TTL + heartbeat extend).

2. Timeout policy
- soft_time_limit và time_limit theo loại job.

3. Retry policy
- Exponential backoff + jitter.
- Phân loại lỗi để retry có chọn lọc (timeout/429 có retry, lỗi schema nghiêm trọng thì không).

4. Idempotency
- Run Now phải có idempotency token để chống bấm lặp.

5. Circuit breaker cho provider lỗi
- Khi fail rate vượt ngưỡng, tự động tạm ngưng provider và phát cảnh báo.

---

## 9) Giao diện quản trị đề xuất
1. Bảng điều hành chính
- Cột: Job, Provider, Last Success, Freshness SLA, Status, Runtime p95, Action.

2. Thanh điều khiển nhanh
- Run selected, Stop selected, Pause/Resume schedule, Filter theo provider/data type.

3. Drawer chi tiết run
- Timeline event, retry attempts, thông báo lỗi chuẩn hóa, link log.

4. Ngôn ngữ hiển thị
- Mặc định tiếng Việt có dấu, chuẩn i18n của dự án.

---

## 10) Danh sách file dự kiến tác động
| Thành phần | File/Module dự kiến | Hành động |
|---|---|---|
| Models | backend/app_models (Django models) | Bổ sung bảng CrawlJob/CrawlSchedule/CrawlRun/CrawlAuditLog. |
| Tasks | backend/celery tasks modules | Chuẩn hóa task crawl + stop/retry/timeout wrapper. |
| Scheduler | django-celery-beat config + migrations | Đồng bộ lịch từ DB qua Beat. |
| API | backend API views/serializers/routes | Endpoint quản trị job/schedule/run/stop/history. |
| UI | frontend màn hình admin vận hành | Trang Control Center + bảng trạng thái + thao tác điều phối. |
| Observability | metrics/logging modules | Metric + alert rule + correlation id. |

Ghi chú: tên file cụ thể sẽ chốt sau khi rà soát module tree để tránh lệch cấu trúc hiện hữu.

---

## 11) Kế hoạch triển khai theo pha
1. Pha 1 - Nền tảng điều phối
- Model + migration + API đọc trạng thái + Celery lock cơ bản.

2. Pha 2 - Điều khiển thủ công và lịch
- Run Now, Stop, CRUD schedule, audit log.

3. Pha 3 - UI vận hành
- Control Center UI, filter/sort, run drawer, cảnh báo cơ bản.

4. Pha 4 - Hardening
- Timeout/retry matrix, circuit breaker, SLA freshness alert, test tải.

---

## 12) Kế hoạch kiểm thử
1. Unit test
- Lock behavior, idempotency, status transitions, permission guard.

2. Integration test
- Beat -> queue -> worker -> DB state end-to-end.
- Off-peak guard và bypass workflow có audit reason.

3. E2E test (UI + API)
- Run Now, Stop, Edit schedule, xem history.

4. Soak test
- Chạy liên tục nhiều giờ để đo fail rate, queue latency, freshness SLA.

---

## 13) KPI chấp nhận
1. Tỷ lệ chạy thành công >= 98% (không tính lỗi upstream bất khả kháng).
2. Không có trường hợp chạy trùng ngoài policy cho phép.
3. Thời gian phản ánh trạng thái UI <= 5 giây.
4. 100% thao tác nhạy cảm có audit log đầy đủ.
5. Có runbook xử lý sự cố và rollback scheduler rõ ràng.

---

## 14) Rủi ro và phương án giảm thiểu
1. Provider thay đổi schema đột ngột
- Mitigation: schema validation + fallback parser + alert sớm.

2. Hàng đợi Celery nghẽn
- Mitigation: tách queue theo nhóm job, giới hạn concurrency, autoscale worker.

3. Lệnh stop không dừng ngay
- Mitigation: checkpoint dày hơn + escalation từ soft stop sang revoke.

4. Vận hành sai quyền
- Mitigation: RBAC cứng, bắt buộc audit reason, review định kỳ quyền truy cập.

---

## 15) Quyết định cần chốt trước khi code
1. Danh sách job chính thức cho phiên bản đầu (MVP).
2. SLA freshness theo từng nhóm dữ liệu.
3. Chính sách retention log (30/60/90 ngày) và chiến lược archive.
4. Danh sách role được phép bypass off-peak.
5. Mức timeout/retry mặc định cho từng provider.

---

## 16) Kết luận
Đề xuất này giữ nguyên stack đang chạy thực tế của dự án, giảm rủi ro tích hợp, đồng thời bổ sung đầy đủ lớp an toàn vận hành và quản trị cần có cho một trung tâm điều phối crawling cấp production. Sau khi chốt 5 quyết định ở mục 15, có thể chuyển sang implementation plan chi tiết theo sprint và bắt đầu triển khai.

## 17) Baseline hệ thống hiện tại (đã kiểm chứng)

1. Runtime stack
- Django 4.2.13, Celery 5.4.0, Redis 5.0.7 (theo `backend/requirements.txt`).
- PostgreSQL là DB chính cho nghiệp vụ.

2. Nền Celery/Task hiện hữu
- Đã có nhiều task module trong `backend/portfolio/tasks_*.py`.
- Các luồng quan trọng đang chạy gồm prefetch, realtime, sync dữ liệu, whale pipeline, news pipeline.

3. Adapter vnbroker hiện hữu
- `backend/portfolio/adapters/vnbroker_adapter.py` đã có cache provider/client (`_VNBROKER_PROVIDER_CACHE`, `_VNBROKER_STOCK_CLIENT_CACHE`).
- Có timeout wrapper `_run_with_timeout` và logic xử lý lỗi rate-limit để tái sử dụng.

4. Admin API hiện hữu
- Có nhóm view admin runtime/sync/benchmark tại `backend/portfolio/views_admin_*.py`.
- Cơ chế phân quyền hiện tại theo plan trong `backend/portfolio/permissions.py`.

5. Frontend API client hiện hữu
- Đã có axios client + JWT interceptor ở `frontend/src/api/client.js`.
- Có cơ chế Bearer token, refresh token và retry khi 401.

Ghi chú quan trọng:
- Không giả định trước mô hình vai trò Operator/Viewer nếu chưa map chính thức với plan hiện có.
- Không ràng buộc vào thư mục `frontend/src/auth/` vì codebase đang tập trung ở `frontend/src/api/` và `frontend/src/context/`.

---

## 18) Contract API chi tiết (MVP)

### 18.1 Danh sách endpoint
1. `GET /api/admin/crawl/jobs/`
- Mục đích: liệt kê job + trạng thái tổng quan.
- Query params: `provider`, `data_type`, `enabled`, `status`, `page`, `page_size`, `q`.

2. `POST /api/admin/crawl/jobs/`
- Mục đích: tạo job mới.

3. `PATCH /api/admin/crawl/jobs/{job_id}/`
- Mục đích: cập nhật metadata, retry policy, timeout, bật/tắt job.

4. `POST /api/admin/crawl/jobs/{job_id}/run/`
- Mục đích: chạy thủ công.
- Bắt buộc gửi `idempotency_key`; nếu bypass off-peak phải gửi `reason`.

5. `POST /api/admin/crawl/runs/{run_id}/stop/`
- Mục đích: yêu cầu dừng run đang chạy (soft stop trước, escalate sau).

6. `GET /api/admin/crawl/runs/`
- Mục đích: lịch sử chạy theo bộ lọc thời gian/trạng thái/job.

7. `GET /api/admin/crawl/runs/{run_id}/`
- Mục đích: chi tiết run (timeline, retries, lỗi, metric).

8. `POST /api/admin/crawl/jobs/{job_id}/schedule/`
- Mục đích: tạo/cập nhật lịch chạy (cron, timezone, blackout window).

### 18.2 Mẫu payload chuẩn
1. Manual run request
```json
{
  "scope": {"symbols": ["VCB", "FPT"]},
  "bypass_off_peak": true,
  "reason": "Khẩn cấp theo yêu cầu vận hành",
  "idempotency_key": "manual-20260422-vcb-fpt-001"
}
```

2. Manual run response
```json
{
  "run_id": "cr_20260422_000123",
  "task_id": "9f4c3f5d-2f3f-49f2-9b0c-6f8f4f8d7771",
  "status": "queued",
  "queued_at": "2026-04-22T08:31:20Z"
}
```

3. Stop response
```json
{
  "run_id": "cr_20260422_000123",
  "stop_requested": true,
  "mode": "soft_stop",
  "requested_at": "2026-04-22T08:33:45Z"
}
```

### 18.3 Error contract
- `409 overlap_running`: job đang chạy và policy không cho overlap.
- `409 duplicate_idempotency_key`: lệnh run đã được ghi nhận trước đó.
- `422 off_peak_violation`: chạy ngoài khung giờ và không đủ điều kiện bypass.
- `423 job_disabled`: job đang bị khóa.
- `403 insufficient_permission`: không đủ quyền thao tác.

---

## 19) State machine cho CrawlRun

### 19.1 Trạng thái chuẩn
`queued -> running -> success`
`queued -> running -> failed`
`queued -> canceled`
`running -> stop_requested -> canceled`
`running -> timeout`

### 19.2 Rule chuyển trạng thái
1. Chỉ worker được chuyển `queued` sang `running`.
2. Chỉ hệ thống điều phối được set `stop_requested`.
3. `success/failed/canceled/timeout` là terminal states.
4. Không cho phép sửa terminal state bằng API thủ công.

### 19.3 Event timeline tối thiểu
- `queued_at`, `started_at`, `heartbeat_at`, `finished_at`.
- `retry_index`, `attempt_no`, `last_error_code`.

---

## 20) Retry, timeout, concurrency matrix (đề xuất mặc định)

1. Nhóm job quote/ticker
- `soft_time_limit`: 30s
- `time_limit`: 45s
- `max_retries`: 3
- `backoff`: 2^n + jitter (200-800ms)
- `concurrency`: cao, queue riêng

2. Nhóm job fundamentals/profile
- `soft_time_limit`: 120s
- `time_limit`: 180s
- `max_retries`: 2
- `backoff`: 2^n + jitter (1-3s)
- `concurrency`: trung bình

3. Nhóm job batch lịch sử lớn
- `soft_time_limit`: 600s
- `time_limit`: 900s
- `max_retries`: 1
- `backoff`: tuyến tính có jitter
- `concurrency`: thấp, ưu tiên ổn định

4. Chính sách lỗi
- Retry: timeout, network transient, HTTP 429, HTTP 503.
- No-retry: lỗi schema không tương thích, dữ liệu đầu vào sai, lỗi quyền truy cập.

---

## 21) Scheduling semantics và off-peak policy

1. Timezone chuẩn
- Lưu DB ở UTC.
- Hiển thị UI theo `Asia/Ho_Chi_Minh`.

2. Off-peak
- Mặc định chỉ chạy trong cửa sổ cấu hình.
- Manual run ngoài giờ yêu cầu `bypass_off_peak=true` + `reason` + quyền phù hợp.

3. Misfire handling
- Nếu Beat bỏ lỡ cửa sổ:
  - `skip` cho job thời gian thực.
  - `catch-up once` cho job đồng bộ profile/fundamental.

4. Anti-thundering herd
- Thêm random jitter khởi chạy 5-30 giây cho job cùng nhóm.

---

## 22) SLO, metric và cảnh báo vận hành

1. SLI/SLO đề xuất
- `Job success rate (24h) >= 98%`.
- `P95 queue latency <= 10s`.
- `P95 run duration` theo baseline từng nhóm job.
- `Freshness breach` theo SLA từng loại dữ liệu.

2. Bộ metric tối thiểu
- `crawl_runs_total{job,status}`
- `crawl_run_duration_seconds{job}`
- `crawl_queue_latency_seconds{job}`
- `crawl_freshness_seconds{data_type}`
- `crawl_stop_requests_total{mode}`

3. Alert rule đề xuất
- Critical: fail liên tiếp >= 5 lần trong 15 phút cho cùng 1 job.
- Warning: success rate 1h < 95%.
- Warning: freshness vượt SLA > 2 chu kỳ liên tiếp.
- Info: stop_requested không hoàn tất sau ngưỡng escalation.

---

## 23) Retention, archive và dọn dẹp dữ liệu

1. Retention mặc định
- `CrawlRun`: 90 ngày.
- `CrawlRunError`: 90 ngày.
- `CrawlAuditLog`: 180 ngày.

2. Cơ chế archive
- Job định kỳ hàng ngày chuyển dữ liệu cũ sang bảng/archive storage.
- Chỉ giữ aggregate KPI dài hạn ở bảng chính để tối ưu truy vấn.

3. Index đề xuất
- `(job_id, started_at desc)` cho lịch sử theo job.
- `(status, started_at desc)` cho dashboard vận hành.
- `(request_id)` cho truy vết audit.

---

## 24) Kế hoạch triển khai chi tiết theo giai đoạn

1. Giai đoạn A - Data contract + migration
- Chốt schema model, tạo migration, seed dữ liệu cấu hình tối thiểu.

2. Giai đoạn B - Worker orchestration
- Tạo task runner chung, lock Redis, state transition guard, retry/timeout policy.

3. Giai đoạn C - Admin APIs
- CRUD job/schedule, manual run, stop, history, chi tiết run.

4. Giai đoạn D - UI vận hành
- Trang điều phối, bảng job, run timeline, stop/run actions, filter/paging.

5. Giai đoạn E - Hardening + observability
- Alert rules, load test, chaos test stop/retry, tuning concurrency.

---

## 25) Rollout, rollback và runbook sự cố

1. Rollout
- Bật feature flag cho nhóm admin nội bộ trước.
- Canary theo 10-20% job non-critical trong 48h.
- Mở rộng dần sang job quan trọng khi SLO ổn định.

2. Rollback
- Tắt feature flag Control Center.
- Trả quyền điều phối về scheduler cũ.
- Giữ nguyên bảng log để hậu kiểm, không xóa dữ liệu run.

3. Runbook tối thiểu
- Tình huống queue backlog tăng đột biến.
- Tình huống provider rate-limit diện rộng.
- Tình huống stop không hiệu lực trong ngưỡng kỳ vọng.
- Tình huống schedule drift giữa DB và Beat.

---

## 26) Definition of Done (DoD) cho phiên bản đầu

1. API contract ổn định, có test contract cho endpoint chính.
2. Không xảy ra overlap ngoài policy trên môi trường staging soak >= 24h.
3. Tất cả thao tác nhạy cảm có audit log đầy đủ actor/action/reason/request_id.
4. Dashboard vận hành hiển thị chính xác trạng thái run trong <= 5 giây.
5. Có tài liệu runbook + rollback đã được diễn tập ít nhất 1 lần.
6. Tài liệu bàn giao gồm: implementation plan, test evidence, metric baseline, alert config.

---

## 27) Tổng kết cập nhật

Bản proposal này đã được nâng cấp theo hướng implementation-ready, bám sát cấu trúc repo hiện tại, đồng thời bổ sung đầy đủ các phần mà đội triển khai thường thiếu ở giai đoạn chuyển từ thiết kế sang code: API contract cụ thể, state machine rõ ràng, chính sách retry/timeout, SLO/alert, retention, rollout/rollback và DoD.

---

## 28) Nâng cấp thành giải pháp tổng thể cho mọi dịch vụ chạy ngầm

### 28.1 Mục tiêu mở rộng
1. Không chỉ quản lý backfill IntradayTick.side, mà quản lý thống nhất toàn bộ dịch vụ chạy nền liên quan dữ liệu thị trường.
2. Giải được 4 rủi ro vận hành phổ biến:
- Job bị dừng giữa chừng nhưng không ai biết.
- Có nhiều phiên bản worker chạy song song, gây kết quả không nhất quán.
- Chạy chồng job trên cùng phạm vi dữ liệu.
- Chạy lại vô tình ghi đè dữ liệu đã có mà không kiểm soát policy.

### 28.2 Nhóm dịch vụ áp dụng
1. Data crawling/ingestion jobs.
2. Backfill/repair jobs.
3. Prefetch/realtime enrichment jobs.
4. Sync/profile/fundamental jobs.
5. Advisory/analytics background jobs có ghi DB hoặc cache.

---

## 29) Kiến trúc Control Plane dùng chung

### 29.1 Các lớp chính
1. Service Registry
- Danh mục chuẩn hóa mọi job chạy nền với metadata bắt buộc.
- Trường tối thiểu: `service_code`, `service_type`, `owner_team`, `criticality`, `default_queue`, `write_policy`.

2. Execution Orchestrator
- Nhận lệnh run/stop/pause/resume/retry.
- Áp policy concurrency, idempotency, off-peak, rate-limit budget.

3. Run Ledger
- Lưu mọi phiên chạy như sự kiện bất biến (immutable run log).
- Mỗi run có `run_id`, `task_id`, `service_code`, `scope_hash`, `state`, `release_sha`, `worker_host`.

4. Lease + Heartbeat Manager
- Cấp lease lock để chống chạy chồng.
- Cập nhật heartbeat định kỳ để phát hiện stalled/zombie run.

5. Policy Engine
- Quy tắc retry, timeout, write mode, escalation, approval gate.

6. Observability & Alerting
- Chuẩn metric/log/tracing thống nhất cho mọi dịch vụ.

### 29.2 Mẫu kiến trúc logic
```text
Admin UI / Ops API
  |
  v
Control Plane API (Django)
  |
  +--> Service Registry (PostgreSQL)
  +--> Run Ledger (PostgreSQL)
  +--> Policy Engine
  +--> Lock + Heartbeat (Redis)
  +--> Celery Orchestrator / Beat
        |
        v
      Workers (multiple versions possible)
        |
        v
  Data Services (crawl/backfill/prefetch/realtime/...)
```

---

## 30) Chuẩn nhận diện phiên bản chạy ngầm (version drift control)

### 30.1 Metadata bắt buộc cho mỗi run
1. `release_sha`.
2. `image_tag` hoặc `build_id`.
3. `worker_hostname`.
4. `started_by` (scheduler/manual/api).
5. `config_fingerprint` (hash của config quan trọng).

### 30.2 Rule phát hiện drift
1. Nếu cùng `service_code` đang có 2 run active với `release_sha` khác nhau, raise cảnh báo `version_drift_detected`.
2. Nếu worker active dùng `image_tag` không thuộc allowlist release hiện hành, tự động gắn cờ `outdated_worker`.
3. Tùy criticality, có thể block run mới khi phát hiện drift chưa được phê duyệt.

---

## 31) Chuẩn trạng thái vòng đời chung cho mọi service

### 31.1 Unified state machine
`queued -> dispatching -> running -> succeeded`
`queued -> dispatching -> running -> failed`
`queued -> canceled`
`running -> stop_requested -> stopping -> canceled`
`running -> stalled`
`running -> timeout`

### 31.2 Quy tắc stalled/zombie
1. `stalled`: heartbeat không cập nhật quá ngưỡng `stalled_after_seconds`.
2. `zombie`: lock/heartbeat còn nhưng worker không còn trong worker registry.
3. `orphan`: task thực tế còn chạy nhưng ledger thiếu state tương ứng.

### 31.3 Chính sách tự phục hồi
1. Stalled lần đầu: auto retry nếu job idempotent.
2. Stalled lặp lại: chuyển manual intervention + freeze service.
3. Zombie/orphan: chạy playbook reconcile state trước khi cho phép run mới.

---

## 32) Chính sách ghi dữ liệu an toàn (không ghi đè ngoài ý muốn)

### 32.1 Write mode chuẩn hóa
1. `append_only`
- Chỉ thêm mới, không sửa dữ liệu cũ.

2. `fill_missing`
- Chỉ cập nhật trường còn trống/null/unknown.

3. `upsert_if_newer`
- Chỉ update nếu bản mới có `event_time` hoặc `version` mới hơn.

4. `reconcile`
- Cho phép chỉnh sửa có điều kiện và bắt buộc log diff trước/sau.

5. `force_overwrite`
- Chế độ nguy cơ cao, cần approval + audit reason + ticket id.

### 32.2 Guardrail bắt buộc
1. Dry-run preview trước apply cho job critical.
2. Giới hạn `max_rows_to_mutate` mỗi run.
3. Mọi run mutation ghi `mutation_summary` và sample diff.
4. Hỗ trợ `manual_lock` trên record để bảo vệ dữ liệu chỉnh tay.

---

## 33) Concurrency, idempotency và chống chạy chồng toàn cục

### 33.1 Lock key strategy
`lock:{service_code}:{scope_hash}`

### 33.2 Scope hash
Hash từ bộ tham số xác định phạm vi dữ liệu (symbols, date range, threshold, source, tenant).

### 33.3 Idempotency key
1. Bắt buộc cho manual run API.
2. Nếu key đã tồn tại và run còn active/recent, trả về run hiện hữu thay vì tạo run mới.

### 33.4 Overlap policy
1. `reject_new`.
2. `queue_after_current`.
3. `replace_if_same_initiator` (chỉ cho job non-critical).

---

## 34) API điều hành tổng thể (service-agnostic)

### 34.1 Endpoint đề xuất
1. `GET /api/admin-ops/services/`
- Danh sách service, trạng thái hiện hành, version active.

2. `POST /api/admin-ops/services/{service_code}/run/`
- Chạy service theo `scope`, `idempotency_key`, `write_mode`, `reason`.

3. `POST /api/admin-ops/runs/{run_id}/stop/`
4. `POST /api/admin-ops/runs/{run_id}/retry/`
5. `GET /api/admin-ops/runs/active/`
6. `GET /api/admin-ops/runs/{run_id}/`
7. `POST /api/admin-ops/services/{service_code}/pause/`
8. `POST /api/admin-ops/services/{service_code}/resume/`

### 34.2 Trường response chuẩn
1. `run_id`, `service_code`, `state`.
2. `release_sha`, `image_tag`, `worker_hostname`.
3. `progress` (`rows_processed`, `rows_total`, `completion_pct`).
4. `write_mode`, `scope_hash`, `idempotency_key`.
5. `last_heartbeat_at`, `stalled`.

---

## 35) Alerting và dashboard vận hành tổng hợp

### 35.1 Dashboard lớp điều hành
1. Active runs theo service type.
2. Heatmap fail rate theo service/release.
3. Drift board: worker version matrix.
4. Mutation board: số bản ghi thay đổi theo write_mode.

### 35.2 Alert policy tối thiểu
1. `service_stalled`.
2. `version_drift_detected`.
3. `unexpected_force_overwrite`.
4. `lock_contention_abnormal`.
5. `success_rate_drop`.

---

## 36) Lộ trình migrate từ hệ hiện tại sang giải pháp tổng thể

### 36.1 Giai đoạn 1 - Chuẩn hóa observability và run ledger
1. Áp metadata version + heartbeat cho các task ưu tiên cao.
2. Tạo run ledger chung và UI active runs.

### 36.2 Giai đoạn 2 - Thêm control policy lớp chung
1. Đưa lock/idempotency/scope hash vào API run hiện hữu.
2. Chuẩn hóa state machine và stop flow.

### 36.3 Giai đoạn 3 - Chuẩn hóa write_mode
1. Backfill/sync jobs bắt buộc khai báo write_mode.
2. Bật dry-run gate cho nhóm job có rủi ro ghi đè cao.

### 36.4 Giai đoạn 4 - Service registry full
1. Onboard tất cả task nền vào service registry.
2. Dùng chung endpoint điều hành service-agnostic.

### 36.5 Giai đoạn 5 - Governance & compliance
1. Approval workflow cho force modes.
2. Quarterly review về policy, SLA, ownership.

---

## 37) Áp dụng cụ thể cho Backfill IntradayTick Side (trường hợp mẫu)

1. Gán `service_code = intraday_side_backfill`.
2. Scope hash từ `symbols + start_date + end_date + threshold`.
3. Mặc định `write_mode = reconcile`.
4. Cho phép `fill_missing` để tránh ghi đè dữ liệu đã có.
5. Bổ sung metadata `release_sha`, `worker_hostname`, `last_heartbeat_at` vào status payload.
6. Khi run mới trùng scope đang active thì `reject_new`.

---

## 38) Tiêu chí thành công cho giải pháp tổng thể

1. 100% service nền quan trọng có run ledger + heartbeat.
2. Không còn run chồng ngoài policy cho phép.
3. Mọi run đều truy vết được version và worker nguồn.
4. Mọi thao tác mutation có write_mode rõ ràng và audit được.
5. Thời gian phát hiện stalled/zombie dưới ngưỡng 2 phút.

---

## 39) Quyết định cần chốt để triển khai toàn diện

1. Danh sách service ưu tiên onboard phase đầu.
2. Bảng mapping service -> write_mode mặc định.
3. Ngưỡng stalled/timeout chuẩn theo từng service type.
4. Chính sách overlap mặc định cho từng service.
5. Danh sách hành động cần approval (force_overwrite, bypass off-peak, emergency rerun).

---

## 40) Bộ tài liệu companion để chuyển giao team code

1. `docs/IMPLEMENTATION_PLAN_BACKGROUND_SERVICES_CONTROL_PLANE_20260422.md`
2. `docs/TECH_SPEC_BACKGROUND_SERVICES_CONTROL_PLANE_20260422.md`
3. `docs/TASKBOARD_BACKGROUND_SERVICES_CONTROL_PLANE_20260422.md`
4. `docs/WALKTHROUGH_BACKGROUND_SERVICES_CONTROL_PLANE_20260422.md`
5. `docs/RUNBOOK_BACKGROUND_SERVICES_CONTROL_PLANE_20260422.md`
6. `docs/GO_NO_GO_BACKGROUND_SERVICES_CONTROL_PLANE_20260422.md`
7. `docs/BACKGROUND_SERVICES_CONTROL_PLANE_INDEX_20260422.md`
8. `docs/PILOT_SERVICE_SELECTION_BACKGROUND_CONTROL_PLANE_20260422.md`
9. `docs/CODING_KICKOFF_PHASE0_PHASE1_BACKGROUND_CONTROL_PLANE_20260422.md`

Thứ tự đọc khuyến nghị:
1. Proposal này để nắm bối cảnh và kiến trúc tổng thể.
2. Implementation Plan để nắm thứ tự triển khai.
3. Tech Spec để code theo contract.
4. Taskboard để chia việc.
5. Walkthrough/Handoff để kickoff.
6. Runbook + Go/No-Go để chuẩn bị vận hành và release.
