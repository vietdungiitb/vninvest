# Kế hoạch triển khai Whale Service theo proposal

Ngày cập nhật: 2026-04-23  
Trạng thái: Draft để review trước khi code  
Phạm vi: Backend model, service/task, API, frontend tooltip, migration, test và rollout

## 1) Mục tiêu nghiệp vụ

1. Chuẩn hóa ngưỡng theo dõi trên từng mã: không còn trạng thái null cho ngưỡng của mã đã theo dõi.
2. Tách rõ 2 lớp vận hành:
- Lớp hệ thống (admin): chạy global/backfill cho toàn hệ thống.
- Lớp người dùng (user): refresh theo mã của chính họ.
3. Tooltip hiển thị đúng số lệnh raw theo ngưỡng user.
4. Có cơ chế job registry để theo dõi tiến độ, lock idempotency, log lỗi và retry an toàn.
5. Backfill có thể cấu hình trên admin UI, mặc định 3 tháng để phục vụ AI phân tích.

## 2) Quyết định kiến trúc cần khóa trước khi code

1. Quy tắc ngưỡng realtime so với tooltip:
- Tooltip và thống kê theo ngưỡng user.
- Realtime advisory hệ thống vẫn bám ngưỡng hệ thống.
- Nếu ngưỡng user < ngưỡng hệ thống, UI phải cảnh báo rõ phạm vi hiệu lực.

2. Quy tắc ngưỡng khi tạo mới mã theo dõi:
- Khi user thêm mã theo dõi, gán ngưỡng mặc định = ngưỡng hệ thống tại thời điểm tạo.
- Không để null.

3. Quy tắc phân quyền trigger:
- Admin: BACKFILL, GLOBAL_RECOMPUTE.
- User: USER_REFRESH chỉ cho mã user đang theo dõi.

4. Quy tắc lock:
- Cùng scope job không được chạy song song.
- Scope đề xuất:
  - GLOBAL_RECOMPUTE: lock theo ngày + tập symbol.
  - BACKFILL: lock theo date_range + tập symbol.
  - USER_REFRESH: lock theo user_id + symbol.

5. Quy tắc chống spam refresh:
- Một user chỉ được trigger USER_REFRESH cho cùng một symbol theo cửa sổ cooldown (đề xuất 60-120 giây).
- Nếu job cùng scope đang RUNNING/PENDING thì API trả về trạng thái locked hoặc in_progress, không tạo job mới.
- Cho phép tùy chọn force=false mặc định; chỉ admin mới có quyền force=true để bỏ qua cooldown (không bỏ qua lock đang RUNNING).

## 2.1) Cơ chế chống chạy nhiều services cùng lúc (bắt buộc)

Áp dụng 5 lớp bảo vệ để chống spam và chống trùng tác vụ:

1. API rate limit (edge gate)
- USER_REFRESH: giới hạn theo key user_id:symbol.
- GLOBAL/BACKFILL: giới hạn theo key admin_id:service_type.
- Khi vượt hạn mức trả HTTP 429 với retry_after.

2. Idempotency key (request dedupe)
- Chuẩn hóa params và tạo idempotency_key (hash của service_type + scope + date_range).
- Trong cooldown window, request trùng key trả về job hiện hữu thay vì tạo mới.

3. Redis distributed lock (runtime lock)
- Acquire lock trước khi enqueue/run.
- Lock key ví dụ:
  - whale:lock:user_refresh:{user_id}:{symbol}
  - whale:lock:global_recompute:{date}:{symbols_hash}
  - whale:lock:backfill:{from}:{to}:{symbols_hash}
- Lock TTL > thời gian chạy batch kỳ vọng và được heartbeat gia hạn khi task còn chạy.

4. DB unique running guard (last defense)
- Duy trì lock_key unique trong WhaleServiceJob để ngăn race condition khi nhiều request cùng lúc qua API.
- Nếu vi phạm unique constraint thì đọc và trả job đã tồn tại.

5. Queue dedupe + cooldown response
- Worker nhận task phải kiểm tra trạng thái lock/job trước khi thực thi.
- Nếu phát hiện duplicate task trong queue thì đánh dấu SKIPPED_DUPLICATE hoặc join vào job đang chạy.

Chuẩn response đề xuất cho API trigger:
- accepted: tạo job mới thành công.
- in_progress: đã có job đang chạy cùng scope.
- throttled: vượt rate limit/cooldown.
- duplicate: request trùng idempotency key, trả về existing job_id.

## 3) Phạm vi thay đổi theo module

### 3.1 Data model hardening

A. Cập nhật TrackedSymbol
- Đổi whale_alert_threshold_million sang null=False sau migration dữ liệu.
- Thêm is_stale (Boolean, default=False) để đánh dấu cần recompute.
- Khi user đổi ngưỡng per-symbol hoặc user-level, set is_stale=True cho các bản ghi liên quan.

B. Tạo model WhaleServiceJob mới
- Trường bắt buộc:
  - service_type: BACKFILL | GLOBAL_RECOMPUTE | USER_REFRESH
  - params: JSONField
  - status: PENDING | RUNNING | COMPLETED | FAILED | PARTIAL
  - progress_pct: Float
  - log: Text
  - started_at, finished_at
- Trường khuyến nghị thêm:
  - lock_key: CharField unique để idempotency
  - created_by: FK user (nullable cho scheduler)
  - retry_count: Integer
  - total_items, processed_items, failed_items

### 3.2 Service layer

A. WhaleSignalEngine.resolve_threshold_vnd
- Bỏ semantics null-check cũ khi đã harden dữ liệu.
- Ưu tiên TrackedSymbol threshold trước, fallback user-level trong tình huống an toàn migration.

B. WhaleJobManager mới
- Chức năng:
  - Tạo job + validate params.
  - Acquire/release Redis lock.
  - Chuyển trạng thái job theo vòng đời.
  - Ghi progress theo batch.
  - Chuẩn hóa lỗi và update log.
- Quy ước trạng thái:
  - PENDING -> RUNNING -> COMPLETED
  - PENDING/RUNNING -> FAILED
  - RUNNING -> PARTIAL khi có lỗi từng phần

### 3.3 Task logic

A. Refactor detect_and_store_order_flow
- Bổ sung callback report tiến độ vào WhaleServiceJob (nếu có job context).
- Không thay đổi hành vi detect cốt lõi nếu không liên quan phạm vi proposal.

B. Tạo recompute_whale_stats_task
- Input scope:
  - USER_REFRESH: user_id + symbol.
  - GLOBAL_RECOMPUTE: list symbols hoặc all.
- Output:
  - Cập nhật snapshot/count theo ngưỡng phù hợp.
  - Đặt lại is_stale=False khi hoàn tất.

C. Tạo whale_backfill_service.py
- Chunking theo khoảng ngày và batch symbol (20-50).
- Checkpoint theo batch để resume.
- Mặc định backfill 3 tháng nếu không truyền.
- Ghi nhận processed_dates để phân biệt:
  - no_data: không có dữ liệu đầu vào.
  - zero_count: có dữ liệu nhưng không có lệnh vượt ngưỡng.

### 3.4 API và controller

A. Cập nhật whale_advisory_symbol_stats_api
- Trả về buy_count_raw, sell_count_raw.
- Trả thêm is_stale.
- Trả thêm cờ threshold_warning khi user_threshold < system_threshold.

B. Tạo whale_service_trigger_api
- Endpoint: POST /api/portfolio/whale-service/trigger/
- Payload chính:
  - service_type
  - symbol hoặc symbols
  - date_range (cho BACKFILL)
  - user_id chỉ cho admin (nếu cần)
- Permission:
  - Admin: BACKFILL, GLOBAL_RECOMPUTE
  - User: USER_REFRESH cho own tracked symbols
- Rate limit:
  - USER_REFRESH theo user+symbol
  - GLOBAL/BACKFILL theo admin request window

### 3.5 Frontend

A. WhaleBubbleChart và vùng tooltip liên quan
- Hiển thị count raw theo ngưỡng user.
- Thêm nút Manual Refresh cho mã hiện tại.
- Cảnh báo rõ khi user_threshold < system_threshold.
- Hiển thị spinner/progress nếu USER_REFRESH đang chạy.

B. Admin UI
- Form cấu hình backfill window (default 3 tháng).
- Danh sách job registry và filter theo status/service_type/date.

## 4) Kế hoạch migration

## 4.1 Migration dữ liệu

Tạo migration 0XXX_migrate_tracked_symbol_thresholds.py:
1. Với TrackedSymbol có threshold null:
- Lấy UserConfig.whale_alert_threshold nếu có.
- Nếu không có UserConfig thì dùng 500 (triệu VND).
2. Ghi kết quả vào whale_alert_threshold_million.
3. Validate hậu migration: không còn null.

## 4.2 Migration schema

1. Tạo model WhaleServiceJob.
2. Thêm cột is_stale cho TrackedSymbol.
3. Đổi whale_alert_threshold_million -> null=False.
4. Thêm index cần thiết:
- TrackedSymbol(user, symbol)
- WhaleServiceJob(status, service_type, started_at)
- WhaleServiceJob(lock_key)

## 5) Thứ tự triển khai theo pha

### Phase 0: Chuẩn bị và guardrail
1. Chốt rule nghiệp vụ và permission matrix.
2. Chốt lock strategy + key convention.
3. Chốt API contract response và payload.

### Phase 1: Data model + migration
1. Tạo WhaleServiceJob model.
2. Tạo migration dữ liệu threshold null -> default.
3. Thêm is_stale.
4. Đổi threshold sang null=False.
5. Chạy verify script hậu migration.

### Phase 2: Service/job orchestration
1. Tạo WhaleJobManager.
2. Tích hợp lock + progress + status transitions.
3. Refactor task hiện hữu để nhận job context.

### Phase 3: Recompute/backfill engine
1. Tạo recompute_whale_stats_task theo scope.
2. Tạo whale_backfill_service với chunking/checkpoint.
3. Bổ sung no_data vs zero_count semantics.

### Phase 4: API layer
1. Nâng cấp stats API với raw count + stale + warning.
2. Tạo trigger API + permission + rate limit.
3. Trả lỗi chuẩn hóa cho UI (validation, forbidden, locked, in_progress).

### Phase 5: Frontend
1. Tooltip đổi sang raw count theo ngưỡng user.
2. Nút Manual Refresh + trạng thái pending/running/completed/failed.
3. Warning ngưỡng user thấp hơn ngưỡng hệ thống.
4. Admin backfill config + job registry view.

### Phase 6: Test và rollout
1. Unit/integration tests theo danh sách bên dưới.
2. Dry-run tại môi trường dev với dữ liệu thật rút gọn.
3. Canary rollout cho subset user.
4. Full rollout + monitor.

## 6) Test plan chi tiết

### 6.1 Automated tests
1. test_whale_service_jobs.py
- Job state transitions.
- Lock conflict/idempotency.
- PARTIAL khi lỗi theo batch.
- Duplicate enqueue trả existing job thay vì tạo mới.
- Lock TTL heartbeat không hết hạn giữa chừng khi job dài.

2. test_threshold_logic.py
- Tooltip theo threshold user.
- Realtime advisory theo threshold hệ thống.
- Cảnh báo khi user_threshold < system_threshold.

3. test_backfill_chunking.py
- Chunk/batch/checkpoint.
- Resume từ checkpoint.
- no_data vs zero_count.
- Không chạy song song 2 backfill cùng scope.

4. test_migration_threshold_fill.py
- Fill null đúng ưu tiên UserConfig rồi 500.
- Không còn null sau migration.

### 6.2 Manual verification
1. Đặt user threshold = 200M, system = 500M.
2. Vào Stock Details:
- Có warning threshold mismatch.
- Tooltip hiển thị count lệnh >200M.
3. Theo dõi realtime advisory:
- Chỉ có cảnh báo >500M.
4. Bấm Manual Refresh:
- Tạo USER_REFRESH job.
- Job hiển thị tiến độ và trạng thái.
5. Vào Admin Panel:
- Trigger BACKFILL 3 tháng.
- Kiểm tra job registry và log.
6. Spam Manual Refresh liên tục (10-20 lần trong <30 giây):
- Chỉ có 1 job USER_REFRESH được tạo cho cùng user+symbol.
- Các request còn lại trả in_progress hoặc throttled.
- Không có nhiều worker chạy trùng scope.

## 7) Rủi ro và biện pháp giảm thiểu

1. DB load tăng khi backfill:
- Giảm bằng batching, off-peak schedule, giới hạn concurrency.

2. Queue storm do user spam refresh:
- Rate limit + idempotency key + Redis lock + transactional DB guard/create-gate + queue dedupe.

3. Sai lệch hiểu biết người dùng do 2 ngưỡng:
- Cảnh báo rõ trên UI và mô tả trong help text.

4. Migration lock bảng lâu:
- Chạy migration ngoài giờ, chia bước data/schema, có rollback plan.

## 8) Tiêu chí nghiệm thu

1. Không còn TrackedSymbol threshold null.
2. Tooltip trả raw count theo threshold user.
3. USER_REFRESH chạy đúng scope và có progress.
4. Admin trigger BACKFILL/GLOBAL_RECOMPUTE thành công theo quyền.
5. Có phân biệt no_data và zero_count.
6. Có warning khi user threshold thấp hơn system threshold.
7. Bộ test mới pass đầy đủ.

## 9) Danh sách file dự kiến tác động (để chuẩn bị)

Backend:
- backend/portfolio/models.py
- backend/portfolio/services.py
- backend/portfolio/tasks_order_flow.py
- backend/portfolio/whale_backfill_service.py (new)
- backend/portfolio/views_stock_order_flow.py
- backend/portfolio/migrations/0XXX_migrate_tracked_symbol_thresholds.py (new)
- backend/portfolio/tests/test_whale_service_jobs.py (new)
- backend/portfolio/tests/test_threshold_logic.py (new/modify)
- backend/portfolio/tests/test_backfill_chunking.py (new)

Frontend:
- frontend/src/components/WhaleBubbleChart.jsx
- các component tooltip/job status liên quan

## 10) Gợi ý thực thi ngay sau khi duyệt tài liệu

1. Chốt chính thức rule threshold mismatch (tooltip vs realtime advisory).
2. Chốt payload API trigger và contract response stats.
3. Thực hiện Phase 1 trước để khóa nền dữ liệu.
4. Sau Phase 1 mới chuyển sang task/service để tránh code workaround cho null.
