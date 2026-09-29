# HANDOFF - PREFLIGHT KPI LANE (2026-04-13)

## Trang thai hien tai

- Lane `admin_runtime_kpi_whale_preflight_metrics_api` da dat muc production-ready cho dashboard/admin-ops.
- Da hoan tat lien tuc tu slice 56 den slice 62.
- Nhanh `dev` da duoc push day du toi commit `925d41d1`.

## Pham vi da hoan tat

- Chuan hoa metric naming contract va helper doc metrics dung chung.
- Them fallback an toan khi cache/reader loi.
- Ho tro trend theo `window_days=1..30`.
- Ho tro totals va rates de dashboard khong phai tu tinh.
- Them summary card fields: `top_signal_*`, `decision_volume_total`.
- Them `schema_version` va `updated_at` de frontend cache contract an toan.
- Ho tro `compact=true` de polling tan suat cao bo qua `trend` nhung van giu `totals/rates/summary`.
- Validate strict cho `date` va `window_days`.

## Files lien quan chinh

- `backend/portfolio/views_admin_runtime.py`
- `backend/portfolio/tasks_whale_preflight_cache.py`
- `backend/portfolio/tests/test_observability.py`
- `backend/portfolio/tests/test_whale_preflight_refactor.py`

## Test xac nhan cuoi cung

- Suite da pass: `portfolio.tests.test_observability.AdminRuntimeKPITests`
- Suite da pass: `portfolio.tests.test_whale_preflight_refactor`
- Tong: `32 tests PASS`

## API contract hien tai

- Endpoint: `/api/admin-ops/runtime-kpi/whale-preflight-metrics/`
- Query params:
  - `date=YYYY-MM-DD`
  - `window_days=1..30`
  - `compact=true|false`
- Payload chinh:
  - `schema_version`
  - `updated_at`
  - `date`
  - `window_days`
  - `compact`
  - `whale_preflight_metrics`
  - `whale_preflight_metrics_totals`
  - `whale_preflight_metrics_rates`
  - `whale_preflight_metrics_summary`
  - `whale_preflight_metrics_trend` (chi co khi `compact=false`)

## Diem dung de quay lai

- Phan KPI preflight khong can mo rong them neu muc tieu la production readiness.
- Neu quay lai lane nay, uu tien tiep theo chi nen la:
  1. Tach helper parse/query contract khoi endpoint neu endpoint tiep tuc phinh ra.
  2. Them compact payload mode chuyen biet hon nua neu frontend can polling nhanh hon.
  3. Them metrics aggregate cao hon neu dashboard can card business-level moi.

## Uu tien tiep theo ngoai lane nay

1. Tach `backend/portfolio/services.py`
2. Tach `backend/portfolio/models.py`
3. Tach `views_ai_advisory.py`

## Luu y worktree

- File `docs/VNINVEST_AUDIT_REPORT_20260413.md` dang co thay doi cuc bo ngoai pham vi lane nay, chua duoc stage/commit.