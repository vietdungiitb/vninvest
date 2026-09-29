# Sprint 26 - Day 4 Execution Log (2026-04-07)

## Status
- Sprint: 26 (OpenCore License & Billing)
- Day: 4
- Overall: IN PROGRESS
- Objective: Mo rong test matrix role/trial-grace + regression matrix endpoint P1

## Done Today
- [x] Mo rong matrix test cho endpoint P0 bo sung case `expired`:
  - order-flow
  - ai-advisory-session
  - ai-advisory-components/generate
- [x] Xac nhan voi license `expired`, 3 endpoint P0 deu bi khoa bang `feature_locked` (HTTP 403).
- [x] Mo rong regression matrix sang endpoint P1:
  - `POST /api/stock-management/ai-advisory-components/<id>/refresh/`
  - `POST /api/stock-management/stocks/<symbol>/ai-advisory-summary/regenerate/`
- [x] Hook OpenCore gating + quota cho nhom endpoint P1 component lifecycle:
  - `POST /api/stock-management/ai-advisory-components/<id>/refresh/`
  - `POST /api/stock-management/stocks/<symbol>/ai-advisory-summary/regenerate/`
  - `POST /api/stock-management/ai-advisory-components/<id>/toggle-include/`
  - `DELETE /api/stock-management/ai-advisory-components/<id>/`
  - `POST /api/stock-management/ai-advisory-components/<id>/restore/`
- [x] Policy da chot:
  - feature key: `sentiment_score`
  - quota key: `ai_regenerate_per_day` (refresh/regenerate)
  - quota key: `api_calls_per_day` (toggle/delete/restore)
- [x] Mo rong usage tracking toi thieu qua `track_api_call` cho toan bo endpoint P1 tren.
- [x] Bo sung test 403/429 + tracking cho P1 va pass.
- [x] Cap nhat regression matrix P1 theo policy moi (free lock, role duoc cap quyen thi pass).

## Validation
- Test command:
  - `python manage.py test portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_stock_workspace_p0_role_matrix_blocks_expired_license portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_stock_workspace_p1_regression_matrix_no_feature_lock_for_current_flow`
- Result:
  - `Ran 2 tests in 2.559s`
  - `OK`

- Test command (P1 gating/quota/tracking):
  - `python manage.py test portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_stock_ai_advisory_component_refresh_returns_403_when_feature_locked_for_free_dpi_license portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_stock_ai_advisory_component_refresh_returns_429_when_ai_regenerate_quota_exceeded portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_stock_ai_advisory_component_refresh_usage_tracking_calls_track_api_call portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_stock_ai_advisory_summary_regenerate_returns_403_when_feature_locked_for_free_dpi_license portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_stock_ai_advisory_summary_regenerate_returns_429_when_ai_regenerate_quota_exceeded portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_stock_ai_advisory_summary_regenerate_usage_tracking_calls_track_api_call`
- Result:
  - `Ran 6 tests in 7.244s`
  - `OK`

- Test command (P1 toggle/delete/restore):
  - `python manage.py test ... (9 tests)`
- Result:
  - `Ran 9 tests in 10.611s`
  - `OK`

- Test command (matrix tong hop P0 + toan bo P1):
  - `python manage.py test ... (19 tests)`
- Result:
  - `Ran 19 tests in 23.359s`
  - `OK`

## Notes
- Day 4 nay tap trung matrix va baseline regression de giam rui ro truoc khi mo rong gating/quota P1.
- P1 regression matrix duoc giu nhu baseline hien tai; khi gate P1 o batch tiep theo can cap nhat expectation test tuong ung.

## In Progress
- [ ] Mo rong usage tracking tu P0/P1 sang metric tong hop.
- [ ] Chot format reporting/dashboard cho metric usage theo endpoint premium.

## Risks
- Risk: Khi bat dau gate P1 se phat sinh thay doi behavior va can dong bo frontend expectation.
- Mitigation: Giu baseline test P1 + rollout theo batch nho, cap nhat contract song hanh docs/frontend.

## Plan Next
1. Mo rong tracking metric tong hop va dashboard usage.
2. Chuan bi package handoff runbook/checklist theo state moi.
3. Chot Sprint26 signoff checklist cho batch integration da hoan tat.
