# Prefetch Health Remediation - Patch Blueprint (Code-ready)

## 1) Blueprint PR-1 (Health semantics)

File: backend/config/health.py

### Thay doi bat buoc
- Result payload them 2 field: status, reason.
- Rule idle/no-meta => healthy=true.
- Rule throttled_by_policy => healthy=true.
- Rule ok + symbols=0 => healthy=true.
- Rule parse_zero_cached/error/retrying/backoff => healthy=false.

### Pseudo-code
```
if not meta:
    return {healthy: true, status: "idle", reason: "no_prefetch_meta_yet"}

status = meta.status
if status == "throttled_by_policy" or policy.query_enabled == false:
    healthy = true
elif status == "ok" and symbols == 0:
    healthy = true
elif status == "ok":
    healthy = freshness_ok and (sample_total == 0 or sample_hits > 0)
else:
    healthy = false
```

## 2) Blueprint PR-2/3 (Parser + status)

File: backend/portfolio/tasks_prefetch.py

### Thay doi bat buoc
- Tach helper parser:
  - _extract_symbol_from_row
  - _extract_ref_price
  - _extract_match_price
  - _extract_high_low_open
  - _extract_volume
- Support 2 shape:
  - MultiIndex tuple key
  - Flat key
- Neu cached_count == 0 trong khi symbols > 0:
  - status = parse_zero_cached
  - reason = no_rows_parsed_from_provider_payload

### Mapping keys de ho tro
- Symbol:
  - ('listing','symbol'), ('symbol',''), 'symbol', 'listing_symbol'
- Ref:
  - ('listing','ref_price'), ('match','reference_price'), 'ref_price', 'reference_price'
- Match:
  - ('match','match_price'), 'match_price'
- High/Low/Open:
  - ('match','highest'), ('match','lowest'), ('match','open_price')
  - 'highest', 'lowest', 'open_price'
- Volume:
  - ('match','accumulated_volume'), 'accumulated_volume', 'match_volume'

## 3) Blueprint PR-4 (Queue dedup + fallback semantics)

Files:
- backend/portfolio/market_data_service.py
- backend/portfolio/views_realtime_core.py

### Thay doi bat buoc
- Trước apply_async prefetch:
  - cache.add('prefetch:enqueue:lock', 1, timeout=15)
  - chi enqueue khi add thanh cong.
- Payload fallback ticker:
  - source = db_fallback
  - fallback_reason = cache_miss_no_realtime_tick
  - stale = true

## 4) Blueprint PR-5 (Tests)

Files:
- backend/portfolio/tests/test_ticker_prefetch_task.py
- backend/portfolio/tests/test_admin_ops.py

### Test case toi thieu
- parse multiindex success
- parse flat success
- symbols>0 cached=0 => status parse_zero_cached
- no-meta => health healthy true + status idle
- throttled_by_policy => health healthy true
- parse_zero_cached => health degraded

## 5) Command pack cho dev

```
cd backend
.venv\Scripts\python.exe manage.py check
.venv\Scripts\python.exe manage.py test portfolio.tests.test_ticker_prefetch_task -v 2
.venv\Scripts\python.exe manage.py test portfolio.tests.test_admin_ops -v 2
```

## 6) Smoke check sau deploy

- GET /api/health/prefetch/
  - idle/offhours: healthy=true
  - market_open: status ok va sample_cache_hits > 0
- GET /api/realtime/ticker/FPT/
  - source uu tien prefetch
  - fallback thi phai la db_fallback (khong danh dong la realtime)
