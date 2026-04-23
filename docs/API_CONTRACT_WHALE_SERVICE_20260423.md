# API Contract - Whale Service

Ngay cap nhat: 2026-04-23

## Re-audit delta 2026-04-23ak

1. POST /api/portfolio/whale-service/trigger/
- accepted: HTTP 201
- duplicate: HTTP 409
- in_progress: HTTP 409
- forbidden: HTTP 403

2. Request payload contract runtime
- payload su dung dang:
{
  "service_type": "USER_REFRESH | GLOBAL_RECOMPUTE | BACKFILL",
  "params": {
    "symbol": "FPT",
    "symbols": ["FPT", "VNM"],
    "start_date": "2026-01-01",
    "end_date": "2026-04-23"
  }
}

3. Endpoint status detail
- GET /api/portfolio/whale-service/jobs/{job_id}/
- Khong su dung /job/{job_id}/

## 1. POST /api/portfolio/whale-service/trigger/

### Request

{
  "service_type": "USER_REFRESH | GLOBAL_RECOMPUTE | BACKFILL",
  "symbol": "FPT",
  "symbols": ["FPT","VNM"],
  "from_date": "2026-01-01",
  "to_date": "2026-04-23",
  "force": false
}

### Response states

1. accepted (201)
{
  "status": "accepted",
  "message": "Job registered and queued successfully.",
  "job": {
    "id": 123,
    "service_type": "USER_REFRESH"
  }
}

2. in_progress (409)
{
  "status": "in_progress",
  "message": "A job with the same scope is currently in progress.",
  "job": {
    "id": 123
  }
}

3. duplicate (409)
{
  "status": "duplicate",
  "message": "An identical job is already pending or running.",
  "job": {
    "id": 123
  }
}

4. throttled (429)
{
  "status": "throttled",
  "retry_after": 60
}

5. forbidden (403)
{
  "status": "forbidden",
  "message": "Khong du quyen"
}

## 2. GET /api/portfolio/whale-service/jobs/{job_id}/

Response:
{
  "id": 123,
  "service_type": "USER_REFRESH",
  "status": "RUNNING",
  "progress_pct": 42.5,
  "processed_items": 17,
  "total_items": 40,
  "failed_items": 0,
  "started_at": "...",
  "finished_at": null,
  "log": "..."
}

## 3. GET /api/portfolio/whale-service/jobs/

Query:
- service_type
- status
- created_by
- from_date
- to_date
- page

## 4. GET /api/portfolio/whale-advisory-symbol-stats/

Response fields bat buoc:
- symbol
- threshold_vnd
- threshold_source
- threshold_warning
- buy_count_raw
- sell_count_raw
- buy_value_total
- sell_value_total
- is_stale
- data_state (no_data|zero_count|has_signal)
- last_computed_at

## 5. Permission matrix

1. USER_REFRESH:
- role user/admin
- user chi duoc trigger cho symbol minh track
2. GLOBAL_RECOMPUTE:
- admin only
3. BACKFILL:
- admin only

## 6. Error code matrix

1. INVALID_PAYLOAD -> 400
2. NOT_TRACKED_SYMBOL -> 400
3. FORBIDDEN_SCOPE -> 403
4. THROTTLED -> 429
5. LOCK_CONFLICT_OR_IN_PROGRESS -> 409
6. INTERNAL_ERROR -> 500
