# Realtime Phase 5-6-7 Runbook (2026-04-15)

## Muc tieu

- Phase 5: Load test ticker hot path o muc 6000 req/min.
- Phase 6: Quan sat metrics realtime bang JSON hoac Prometheus text.
- Phase 7: Van hanh production voi guardrail anti-fat-file de tranh tai dien monolith.

## A. Quy dinh bat buoc anti-fat-file

Quy dinh duoc enforce boi CI workflow large-file-guard:

- Canh bao: file >= 700 dong.
- Chan merge: file >= 1000 dong (neu khong nam trong allowlist).
- Khong them logic moi vao file da vuot nguong.
- Buoc tach module la bat buoc truoc khi them feature.

Lenh check local:

```powershell
./scripts/quality/check_large_files.ps1 -WarnLines 700 -FailLines 1000 -AllowListPath scripts/quality/large_file_allowlist.txt
```

Quy dinh bo sung bat buoc cho audit:

- Sau moi lan hoan tat cong viec, phai cap nhat danh sach tep da sua vao tai lieu audit tap trung.
- Khong duoc chi ghi nhat ky tong quan ma thieu file list.

## B. Phase 5 - Load test 6000 req/min

### 1) Khoi dong stack backend

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python -m daphne --bind 127.0.0.1 --port 8000 --threads 20 config.asgi:application
```

Chay worker + beat o terminal khac:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python -m celery -A config worker -l info -P solo
python -m celery -A config beat -l info
```

### 2) Chay load test

```powershell
cd .
python scripts/ops/realtime_ticker_load_test.py --base-url http://127.0.0.1:8000 --target-rpm 6000 --duration-seconds 180 --concurrency 40 --symbols FPT,HPG,VCB,VIC,VNM,SSI,TPB,MBB,MWG,ACB --token <JWT_NEU_CAN>
```

### 3) Tieu chi pass

- Khong co HTTP 429.
- error_rate <= 1%.
- latency p95 <= 150ms trong local/staging.
- p99 duoc ghi lai de so sanh cac lan chay.

## C. Phase 6 - Observability endpoint

Endpoint staff-only:

- JSON: /api/realtime/ops/metrics/?output=json
- Prometheus: /api/realtime/ops/metrics/?output=prometheus

Vi du goi API (staff JWT):

```powershell
curl -H "Authorization: Bearer <STAFF_JWT>" "http://127.0.0.1:8000/api/realtime/ops/metrics/?output=json"
curl -H "Authorization: Bearer <STAFF_JWT>" "http://127.0.0.1:8000/api/realtime/ops/metrics/?output=prometheus"
```

Metrics chinh:

- cache_hits_total, cache_misses_total, cache_hit_ratio
- realtime_upstream_calls_total{endpoint}
- realtime_upstream_errors_total{endpoint}
- realtime_rate_limit_events_total{endpoint}
- realtime_warmup_started_total, realtime_warmup_completed_total
- realtime_warmup_symbols_cached_total, realtime_warmup_errors_total

## D. Phase 7 - Van hanh production

### 1) Checklist truoc deploy

- large-file-guard PASS.
- test_realtime_ops_metrics_api PASS.
- ticker regression tests PASS.
- warmup task co the trigger va complete.

### 2) Checklist sau deploy

- /api/health/prefetch/ healthy=true
- /api/realtime/ops/metrics/ cho staff tra ve du lieu
- load test 10 phut khong co 429
- cache hit ratio on dinh tren 95% trong khung cao diem

### 3) Trigger rollback neu

- HTTP 429 tang lien tuc > 5 phut
- cache hit ratio < 90% trong 2 chu ky canh bao lien tiep
- upstream_errors_total tang dot bien

Rollback hanh dong:

- Giam load polling tu frontend.
- Kich warmup cache lai.
- Kiem tra worker/beat va policy cadence shards.

## E. Ghi chu dashboard

Nguon dashboard co the scrape truc tiep endpoint Prometheus format.
Neu dung Grafana Agent/Prometheus, tao scrape job vao endpoint:

- /api/realtime/ops/metrics/?output=prometheus

Yeu cau auth:

- Header Authorization bearer token cua staff account.
