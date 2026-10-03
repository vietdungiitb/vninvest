# Prefetch Health Remediation - Implementation Guide (2026-04-13)

## 1) Muc tieu va pham vi

### 1.1 Muc tieu chinh
- Loai bo tinh trang Prefetch health bi DEGRADED gia.
- Dam bao luong du lieu realtime cho trang stocks/{symbol} khi thi truong dang mo.
- Loai bo duong fallback gay nham lan ve tinh chat realtime.
- Tang observability de khoanh vung nhanh nguyen nhan (provider, parser, queue, cache).

### 1.2 Pham vi code
- backend/config/health.py
- backend/portfolio/tasks_prefetch.py
- backend/portfolio/market_data_service.py
- backend/portfolio/views_realtime_core.py
- backend/portfolio/tests/test_ticker_prefetch_task.py
- backend/portfolio/tests/test_admin_ops.py

### 1.3 Out-of-scope
- Khong doi schema DB.
- Khong thay doi giao dien lon o frontend ngoai tru thong diep can thiet.
- Khong doi luong benchmark KBS/VCI trong tai lieu nay.

## 2) Hien trang va root-cause da xac nhan

### 2.1 Trieu chung production
- /api/health/prefetch/ tra 503.
- prefetch.status = ok, freshness_seconds nho, nhung sample_cache_hits = 0.
- prefetch.cached = 0 du symbols > 0.

### 2.2 Root-cause
1. Health rule qua cung:
   - healthy chi true khi sample_cache_hits > 0.
   - truong hop idle/policy-throttled/no-symbols van bi coi xau.
2. Task prefetch co kha nang parse dataframe khong khop schema provider (dac biet KBS), dan den cached = 0.
3. Endpoint ticker fallback ve DailyPrice khi cache miss, tao cam giac co realtime trong khi thuc te la DB snapshot.
4. Co rui ro queue fan-out khi nhieu cache miss lien tiep.

## 3) Thiet ke giai phap

## 3.1 Workstream A - Health semantics dung

### Muc tieu
- Khong bao do gia trong cac trang thai hop le: idle, throttled_by_policy, no_symbols.

### Code changes
File: backend/config/health.py

Thay doi ham build_prefetch_health_snapshot:
- Them truong status va reason.
- Neu khong co meta:
  - healthy = true
  - status = idle
  - reason = no_prefetch_meta_yet
- Neu prefetch.status in [throttled_by_policy] hoac policy.query_enabled = false:
  - healthy = true
  - reason = policy_throttled
- Neu status = ok va symbols = 0:
  - healthy = true
  - reason = no_symbols_to_prefetch
- Chi degraded khi:
  - status in [error, retrying, backoff, payload_invalid, parse_zero_cached]
  - hoac stale that su vuot freshness threshold.

### Acceptance criteria
- /api/health/prefetch/ tra 200 trong offhours va khi chua co metadata.
- reason/status phan biet ro logic health.

## 3.2 Workstream B - Fix parser prefetch triet de

### Muc tieu
- Loai bo truong hop symbols > 0 nhung cached = 0 trong market_open.

### Code changes
File: backend/portfolio/tasks_prefetch.py

Buoc 1: Tao helper parser robust
- _extract_symbol_from_row(row)
- _extract_price_fields_from_row(row)
- _extract_volume_from_row(row)

Buoc 2: Ho tro ca 2 schema
- MultiIndex (listing/match/bid_ask)
- Flat column (symbol, match_price, reference_price, ...)

Buoc 3: Rule status moi
- Neu symbols > 0 va processed_batches > 0 va cached_count = 0:
  - status = parse_zero_cached
  - reason = no_rows_parsed_from_provider_payload

Buoc 4: Logging chi tiet
- log warning 1 dong cho moi batch parse fail:
  - provider
  - batch_symbols
  - dataframe_columns snapshot

### Acceptance criteria
- Trong khung market_open: cached_count > 0 voi bo symbol hop le.
- Khong con status = ok khi cached_count = 0 va symbols > 0.

## 3.3 Workstream C - Chong queue storm va fallback ro nghia

### Muc tieu
- Giam enqueue trung lap tu ticker miss.
- Tach bach data source realtime vs fallback.

### Code changes
File: backend/portfolio/market_data_service.py
File: backend/portfolio/views_realtime_core.py

Buoc 1: Dedup lock truoc apply_async
- key: prefetch:enqueue:lock
- timeout: 10-20s
- Neu lock da ton tai thi bo qua enqueue moi.

Buoc 2: Chuan hoa payload fallback ticker
- source = db_fallback
- stale = true
- freshness_seconds tinh tu last_date neu co, nguoc lai de null

Buoc 3: Them truong fallback_reason
- fallback_reason = cache_miss_no_realtime_tick

### Acceptance criteria
- Tan suat apply_async giam ro tren log khi traffic ticker cao.
- UI va API phan biet ro du lieu fallback.

## 3.4 Workstream D - Test + observability + rollout

### Muc tieu
- Co test bao ve cho parser/health semantics.
- Co metric canh bao som neu regress.

### Test changes
File: backend/portfolio/tests/test_ticker_prefetch_task.py
- test_prefetch_parse_multiindex_vci_success
- test_prefetch_parse_flat_kbs_success
- test_prefetch_status_parse_zero_cached_when_symbols_exist
- test_prefetch_throttled_policy_status

File: backend/portfolio/tests/test_admin_ops.py
- test_prefetch_health_idle_is_healthy
- test_prefetch_health_policy_throttled_is_healthy
- test_prefetch_health_parse_zero_cached_is_degraded

### Observability changes
- prefetch_cached_zero_total
- prefetch_parse_error_total
- ticker_db_fallback_total

### Rollout
1. Merge len dev.
2. Soak test 2-4h trong gio thi truong.
3. Merge len deploy.
4. Theo doi 24h voi dashboard runtime KPI.

## 4) Ke hoach chia PR nho (code-ready)

### PR-1 (A)
- health semantics + tests health.
- Risk: thap.
- Estimated: 0.5 ngay.

### PR-2 (B1)
- parser helper cho MultiIndex + flat schema.
- tests parser co ban.
- Risk: trung binh.
- Estimated: 0.5 ngay.

### PR-3 (B2)
- status parse_zero_cached + log detail.
- tests tinh huong zero cached.
- Risk: trung binh.
- Estimated: 0.5 ngay.

### PR-4 (C)
- dedup enqueue lock + fallback payload semantics.
- Risk: trung binh.
- Estimated: 0.5 ngay.

### PR-5 (D)
- metrics + dashboard wiring + them runbook check.
- Risk: trung binh.
- Estimated: 0.5-1 ngay.

## 5) Runbook xac minh sau moi PR

Chay local:
- python manage.py check
- python manage.py test portfolio.tests.test_ticker_prefetch_task -v 2
- python manage.py test portfolio.tests.test_admin_ops -v 2

Smoke API:
- GET /api/health/prefetch/
- GET /api/admin-ops/runtime-kpi/
- GET /api/realtime/ticker/FPT/

Ky vong:
- health status hop ly theo context (idle/throttled/market_open).
- ticker source ro rang (prefetch hoac db_fallback).
- khong co queue flood trong log.

## 6) Rollback plan

Neu su co sau deploy:
1. Revert PR moi nhat tren deploy.
2. Uu tien giu PR-1 (health semantics) neu khong gay loi.
3. Neu parser thay doi gay loi data:
   - rollback PR-2/PR-3
   - giu dedup lock neu on dinh.

## 7) Definition of Done

- Prefetch health khong con DEGRADED gia trong idle/offhours.
- Trong market_open, sample_cache_hits/sample_cache_total >= 60% on dinh.
- prefetch.cached > 0 trong da so chu ky beat.
- stocks/FPT hien thi source minh bach, khong fake realtime.
- Team co test + runbook va co the triage nhanh khi loi tai dien.
