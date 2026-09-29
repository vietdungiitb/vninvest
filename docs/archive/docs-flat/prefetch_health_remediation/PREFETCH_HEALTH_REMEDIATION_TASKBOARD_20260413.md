# Prefetch Health Remediation - Taskboard and Execution Pack (2026-04-13)

## 1) Muc tieu quan ly thuc thi
- Bien ke hoach remediation thanh danh sach cong viec co owner, deadline, output ro rang.
- Dam bao moi PR co checklist review, test, deploy gate.

## 2) Bang cong viec chi tiet

| ID | Workstream | Cong viec | File chinh | Owner goi y | ETA | Output bat buoc |
|---|---|---|---|---|---|---|
| A1 | Health | Refactor health semantics (idle/throttled/no-symbols) | backend/config/health.py | Backend-1 | 0.5d | status/reason moi + test pass |
| A2 | Health | Cap nhat API contract docs cho prefetch health | backend/config/health.py | Backend-1 | 0.25d | payload example moi |
| B1 | Parser | Tao helper parse symbol/price/volume robust | backend/portfolio/tasks_prefetch.py | Backend-2 | 0.5d | helper function + unit tests |
| B2 | Parser | Ho tro MultiIndex + flat columns KBS/VCI | backend/portfolio/tasks_prefetch.py | Backend-2 | 0.5d | parse success cho 2 schema |
| B3 | Parser | Them status parse_zero_cached + warning logs | backend/portfolio/tasks_prefetch.py | Backend-2 | 0.25d | no-status-ok-when-cached-0 |
| C1 | Queue | Them dedup lock khi apply_async prefetch | backend/portfolio/market_data_service.py | Backend-3 | 0.5d | lock key + timeout + tests |
| C2 | Fallback | Chuan hoa source=db_fallback va fallback_reason | backend/portfolio/market_data_service.py | Backend-3 | 0.25d | payload ticker minh bach |
| D1 | Test | Bo sung test health semantics | backend/portfolio/tests/test_admin_ops.py | QA/Backend | 0.25d | test cases green |
| D2 | Test | Bo sung test parser va status prefetch | backend/portfolio/tests/test_ticker_prefetch_task.py | QA/Backend | 0.5d | test cases green |
| D3 | Observability | Them metric counters canh bao regress | backend/portfolio/tasks_prefetch.py | SRE/Backend | 0.5d | metric emit + verify |
| D4 | Rollout | Soak test dev, release deploy, monitor 24h | N/A | Tech Lead | 1d | report sau rollout |

## 3) Checklist cho tung PR

### 3.1 Checklist coding
- [ ] Khong pha vo API contract hien tai (neu co doi, cap nhat docs).
- [ ] Co log context de triage (symbol, provider, status).
- [ ] Co guard rails cho exception branch.
- [ ] Co test case cho happy path va failure path.

### 3.2 Checklist review
- [ ] Reviewer 1: logic dung theo runbook.
- [ ] Reviewer 2: khong co queue-flood side effect.
- [ ] Kiem tra backward compatibility voi frontend hien tai.

### 3.3 Checklist test truoc merge
- [ ] python manage.py check
- [ ] python manage.py test portfolio.tests.test_ticker_prefetch_task -v 2
- [ ] python manage.py test portfolio.tests.test_admin_ops -v 2
- [ ] Smoke API: /api/health/prefetch/, /api/realtime/ticker/FPT/

## 4) Gate truoc khi push deploy

## Gate-1: Functional
- [ ] /api/health/prefetch/ khong do gia trong idle/offhours.
- [ ] market_open co sample_cache_hits > 0 trong da so chu ky.

## Gate-2: Performance
- [ ] Khong tang dot bien queue depth.
- [ ] Khong tang p95 /realtime/ticker/* qua baseline +20%.

## Gate-3: Reliability
- [ ] Khong co exception spike trong tasks_prefetch.
- [ ] Metric prefetch_cached_zero_total giam ro.

## 5) Playbook van hanh sau deploy

### 5.1 Kiem tra nhanh (15 phut dau)
1. GET /api/health/prefetch/
2. GET /api/admin-ops/runtime-kpi/
3. Truy cap /stocks/FPT, quan sat source va freshness.

### 5.2 Kiem tra theo chu ky (24h)
- Moi 30 phut:
  - rate prefetch.status = ok/throttled/error
  - sample_cache_hits ratio
  - ticker_db_fallback_total

### 5.3 Dieu kien rollback
- prefetch_cached_zero_total tang lien tuc > 2h.
- ticker endpoint stale ratio tang manh trong market_open.
- queue backlog tang bat thuong va co xu huong tich luy.

## 6) Mau bao cao sau moi dot

### Daily report template
- Ngay:
- Commit da release:
- Health summary:
  - healthy ratio:
  - top reason:
- Prefetch summary:
  - avg symbols:
  - avg cached:
  - parse_zero_cached count:
- Ticker summary:
  - db_fallback ratio:
  - stale ratio:
- Action tiep theo:

## 7) Nhan su de xuat
- Backend-1: owner health semantics + API contract.
- Backend-2: owner parser/prefetch.
- Backend-3: owner queue dedup + ticker fallback semantics.
- QA: owner test matrix va smoke/soak.
- Tech Lead: gate deploy va rollback decision.
