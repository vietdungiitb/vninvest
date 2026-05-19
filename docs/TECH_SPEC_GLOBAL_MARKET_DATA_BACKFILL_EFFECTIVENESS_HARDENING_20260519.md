# Technical Specification — Global Market Data Backfill Effectiveness Hardening
**Ngày**: 2026-05-19
**Phiên bản**: 1.0
**Status**: Approved
**Parent**: docs/GLOBAL_MARKET_DATA_BACKFILL_EFFECTIVENESS_HARDENING_HANDOFF_MASTER_20260519.md

---

## 1. Phạm vi kỹ thuật

Tài liệu này định nghĩa chi tiết kỹ thuật cho:
- scheduler run truth và observability của backfill jobs
- persistence progress cho manual/scheduled backfill runs
- coverage gap inventory và planner ranking
- execution modes cho backfill
- operator API/UI contracts
- completeness/anomaly monitoring

---

## 2. Core entities

### 2.1 `BackfillExecutionRun`

Một row cho mỗi run manual hoặc scheduled.

**Fields tối thiểu**:
- `run_id` (unique string/uuid)
- `job_key`
- `mode` (`daily_delta`, `repair_missing`, `deep_bootstrap`, `targeted_symbol_repair`)
- `trigger` (`beat_schedule`, `operator_run_now`, `auto_promotion_fast_path`, `repair_guard`)
- `status` (`queued`, `running`, `partial`, `success`, `failed`, `aborted`)
- `requested_days`
- `requested_symbols_count`
- `planned_symbols_count`
- `completed_symbols_count`
- `failed_symbols_count`
- `inserted_rows`
- `updated_rows`
- `skipped_existing_rows`
- `started_at`
- `finished_at`
- `eta_seconds`
- `summary`
- `error_summary`

**Invariant**:
- UI progress phải đọc từ entity này hoặc summary materialized của nó, không suy diễn từ cache-only marker.

### 2.2 `BackfillExecutionBatch`

Persistence cho batch/provider progress.

**Fields tối thiểu**:
- `run` (FK)
- `provider`
- `batch_index`
- `symbols_count`
- `completed_symbols_count`
- `state`
- `current_symbol`
- `inserted_rows`
- `updated_rows`
- `skipped_existing_rows`
- `failed_symbols`
- `latency_p50_ms`
- `latency_p95_ms`
- `started_at`
- `finished_at`

### 2.3 Coverage gap summary per symbol

Có thể reuse hoặc mở rộng từ `GlobalSymbolCoverage`.

**Fields tối thiểu**:
- `expected_history_days`
- `actual_history_days`
- `missing_history_days`
- `gap_score`
- `priority_reason`
- `latest_backfill_at`
- `repair_recommended_mode`
- `sla_bucket`

---

## 3. Planner semantics

### 3.1 Default semantics
- `missing_only = true`
- `overwrite_existing = false`
- `force_refresh = false`
- `repair_conflicts = false`

### 3.2 Priority ordering

Planner phải sort theo tuple:
1. `tier_severity`
2. `missing_history_days`
3. `promotion_recency`
4. `active_demand_weight`
5. `freshness_breach`
6. `symbol`

### 3.3 Priority reasons canonical

Planner phải gắn `priority_reason` thuộc tập sau:
- `hot_tier_missing_critical_history`
- `newly_promoted_hot_symbol`
- `newly_promoted_warm_symbol`
- `active_user_demand_gap`
- `warm_tier_missing_history`
- `cold_backlog_repair`
- `anomaly_guard_repair`

---

## 4. Execution modes

### 4.1 `daily_delta`
- Mục đích: refresh phần gần hiện tại cho toàn universe hoặc tier subset.
- Default window: `days=1..30` theo policy.
- Không được dùng để vá thiếu sâu 1-5 năm.

### 4.2 `repair_missing`
- Mục đích: chỉ đụng vào symbols có gap lớn.
- Input chính: planner preview hoặc anomaly backlog.
- Default: `missing_only=true`.

### 4.3 `deep_bootstrap`
- Mục đích: fill 1-5 năm cho cohort lớn hoặc lần bootstrap nền.
- Phải có quotas, progress, ETA, provider telemetry.

### 4.4 `targeted_symbol_repair`
- Mục đích: vá 1 symbol hoặc một nhóm nhỏ theo yêu cầu operator hoặc promotion fast-path.
- Phải hỗ trợ feedback nhanh và outcome dễ kiểm chứng.

---

## 5. Scheduler truth model

### 5.1 `run_now`
- Action `run_now` chỉ tạo dispatch request nếu có task_path hợp lệ.
- `accepted=True` không đồng nghĩa `success`; chỉ là queue accepted.
- UI phải đọc `queued/running/success/failed` từ run state mới.

### 5.2 Inflight marker
- Cache inflight chỉ được xem là accelerator tạm thời cho UX.
- Không được là source-of-truth dài hạn.
- Khi run vào terminal state (`success`, `failed`, `aborted`, `partial`) phải clear inflight marker.

### 5.3 History mapping
- `daily-backfill-prices-1700` và `deep-history-bootstrap-weekly` phải có `service_key` rõ ràng trong scheduler catalog.
- Scheduled runs và manual runs phải cùng xuất hiện trong history endpoint với `trigger` khác nhau.

---

## 6. API contracts mục tiêu

Namespace khuyến nghị: `/core/v1/operator/scraping/dataops/`

### 6.1 `GET /scheduler/jobs/<job_key>/history/`
**Response fields bắt buộc**:
- `id`
- `run_id`
- `status`
- `trigger`
- `mode`
- `started_at`
- `finished_at`
- `duration_seconds`
- `planned_symbols_count`
- `completed_symbols_count`
- `inserted_rows`
- `updated_rows`
- `skipped_existing_rows`
- `error_detail`

### 6.2 `GET /scheduler/jobs/<job_key>/progress/`
**Response fields bắt buộc**:
- `job_key`
- `run_id`
- `status`
- `mode`
- `progress_pct`
- `planned_symbols_count`
- `completed_symbols_count`
- `failed_symbols_count`
- `eta_seconds`
- `current_provider`
- `current_batch_index`
- `providers`
- `latest_error`

### 6.3 `POST /dataops/backfill/preview/`
**Request**:
- `mode`
- `tier_filter`
- `symbol_filter`
- `limit`
- `force_refresh`

**Response**:
- `mode`
- `planned_symbols`
- `top_priority_reasons`
- `estimated_batches`
- `estimated_cost`
- `preview_items[]`

### 6.4 `POST /dataops/backfill/run/`
**Request**:
- `mode`
- `reason`
- `symbol_filter` optional
- `tier_filter` optional
- `force_refresh` optional

**Response**:
- `accepted`
- `run_id`
- `job_key`
- `mode`
- `queued_at`
- `message`

### 6.5 Error envelope
Mọi lỗi phải theo chuẩn:
```json
{
  "detail": "...",
  "code": "...",
  "timestamp": "...",
  "request_id": "...",
  "field_errors": {}
}
```

---

## 7. Frontend contract requirements

1. `SchedulerBoard` và `DataOpsPanel` phải đọc progress/history từ API backend, không đoán từ last_run/freshness đơn thuần.
2. Trạng thái phải có text label ngoài màu sắc.
3. Nếu progress chưa sẵn sàng, UI phải hiển thị `Đang khởi tạo run state` thay vì giả định `ĐANG CHẠY` lâu vô hạn.
4. Tất cả text mới qua i18n.
5. Không direct fetch; dùng `socApi.js` hoặc adapter tương ứng.

---

## 8. OpenAPI requirements

1. Mọi endpoint mới phải có request/response schema rõ ràng.
2. List/history endpoint phải có pagination.
3. `run` endpoint phải có auth + permission gate admin/operator.
4. Nếu endpoint có thể gây heavy execution, phải mô tả rate/usage warnings trong metadata hoặc docs kèm.
5. Không trả `200` cho lỗi nghiệp vụ như invalid mode, run conflict hoặc permission denial.

---

## 9. Observability metrics bắt buộc

Per run:
- `planned_symbols_count`
- `completed_symbols_count`
- `failed_symbols_count`
- `inserted_rows`
- `updated_rows`
- `skipped_existing_rows`
- `duration_seconds`
- `provider_latency_p50_ms`
- `provider_latency_p95_ms`

Per backlog:
- `critical_gap_symbols`
- `hot_tier_breach_count`
- `newly_promoted_pending_bootstrap_count`
- `repair_backlog_age_hours`
- `coverage_completeness_ratio_by_tier`

---

## 10. Success metrics

1. Hot promoted symbol đạt coverage tối thiểu trong SLA đã cấu hình.
2. Manual targeted repair của 1 symbol hoàn tất đủ nhanh cho operator validation.
3. Operator không cần đọc container logs để biết task có đang sống hay không.
4. Số symbol `<=10` ngày giảm mạnh sau rollout.
5. Không tái diễn UI `ĐANG CHẠY` kéo dài do stale inflight cache.
