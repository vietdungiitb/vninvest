# SAAS-06 Execution Evidence - Legacy Decommission First Alias Removal

## 1. Slice identity

- Slice ID: SAAS-06
- Ngay: 2026-05-03
- Owner: Platform/DevOps Lead
- Req IDs: SAAS-06
- Workstream: decommission
- Loai slice: frontend / audit
- Previous entry IDs / dependencies checked: 2026-05-03bc, 2026-05-03bb, 2026-05-03ba
- Task status khi nhan slice: `not-started`

## 2. Muc tieu slice

- Van de can giai quyet: giam dien tich legacy runtime bang cach loai bo route alias cu va chot legacy reference/comment path dong bo.
- Boundary owner lien quan: frontend router, route comments, regression tests, audit docs.
- Surface bi anh huong: `backend/portfolio/urls.py`, `backend/portfolio/tests/test_api_routes_whale_advisory_access.py`, `backend/portfolio/tests/test_api_routes_whale_advisory_refresh.py`, `backend/portfolio/tests/test_api_routes_whale_advisory_delete_current.py`, `backend/portfolio/tests/test_api_routes_trading_and_p1_13.py`, `backend/portfolio/views_ai_advisory_management.py`, `backend/portfolio/views_ai_runtime_stats.py`, `backend/portfolio/views_stock_order_flow.py`, `frontend/src/App.jsx`, `frontend/src/components/ProtectedRoute.jsx`, `frontend/src/App.adminCoreRoutes.test.jsx`.
- Rollback gate: route cu `/whale-advisory` phai khong con render alias; fallback di qua dashboard catch-all.

## 3. Danh sach file doi

- backend/portfolio/urls.py
- backend/portfolio/tests/test_api_routes_whale_advisory_access.py
- backend/portfolio/tests/test_api_routes_whale_advisory_refresh.py
- backend/portfolio/tests/test_api_routes_whale_advisory_delete_current.py
- backend/portfolio/tests/test_api_routes_trading_and_p1_13.py
- backend/portfolio/views_ai_advisory_management.py
- backend/portfolio/views_ai_runtime_stats.py
- backend/portfolio/views_stock_order_flow.py
- frontend/src/App.jsx
- frontend/src/components/ProtectedRoute.jsx
- frontend/src/App.adminCoreRoutes.test.jsx
- docs/WHALE_ALERTS_DASHBOARD_ROADMAP.md
- docs/WHALE_ADVISORY_AUTO_GENERATION_ROADMAP.md
- docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_SAAS_CUTOVER_TASKBOARD_20260503.md
- docs/CODE_CHANGE_AUDIT_LEDGER.md
- PROGRESS_DASHBOARD.md
- module_tree_full.md
- docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_SAAS_CUTOVER_EXECUTION_EVIDENCE_20260503_SAAS06.md

## 4. Validation commands va ket qua

- `Push-Location ./backend; ..\.venv\Scripts\python.exe manage.py test portfolio.tests.test_api_routes_whale_advisory_access portfolio.tests.test_api_routes_whale_advisory_refresh portfolio.tests.test_api_routes_whale_advisory_delete_current portfolio.tests.test_api_routes_trading_and_p1_13 --keepdb; Pop-Location` -> PASS (46 tests passed)
- `Push-Location ./frontend; $env:CI='true'; $env:REACT_APP_ENABLE_PACKAGE_SHELL_HOST='0'; npm test -- --runInBand --watch=false src/App.adminCoreRoutes.test.jsx; Pop-Location` -> PASS (13 tests passed)
- `grep_search` on backend/frontend code roots -> PASS, no `whale-advisory` matches
- `Push-Location .; .\.venv\Scripts\python.exe scripts/ops/generate_module_tree.py; Pop-Location` -> PASS, module tree regenerated

## 5. Payload snapshots bat buoc neu cham contract

- Capability snapshot: not touched.
- Partner payload snapshot: not touched.
- Commercial payload snapshot: not touched.
- Data-plane payload snapshot: not touched.
- Route snapshot: legacy `/whale-advisory` alias no longer exists in backend or frontend runtime code; canonical `/ai-advisory` route remains.

## 6. UI/runtime proof bat buoc neu cham surface that

- Screenshot/browser proof: not captured; this slice was validated through route regression tests.
- Route/actor da dung de proof: `/whale-advisory` and `/ai-advisory` route fallback through App router, plus package shell disabled path in the same test harness.
- Dev stack refresh command: no new docker refresh was required for this route-removal slice.

## 7. Decommission proof bat buoc neu cham legacy removal

- Route inventory diff: legacy alias `/whale-advisory` removed from backend and frontend runtime code; code grep on backend/frontend returned no matches for `whale-advisory`.
- Compose/CI/workspace diff: no runtime legacy matches in compose/workspace patterns; no additional file edits required.
- Legacy alias removal proof: PASS through backend route tests and `App.adminCoreRoutes.test.jsx` regression.
- Read-only fallback window state: closed.

## 8. Residual risk note

- Runtime code surfaces are clean, but historical audit docs still mention the retired route in context. That is intentional and does not represent live runtime residue.
- Browser screenshot proof was not captured because the slice was verified in Jest and module-tree refresh rather than in a live browser.

## 9. Audit sync checklist

- [x] `docs/TASKBOARD_ENTERPRISE_B2B_MCP_TRANSFORMATION_SAAS_CUTOVER_20260503.md` da cap nhat dung trang thai
- [x] `docs/CODE_CHANGE_AUDIT_LEDGER.md` da cap nhat
- [x] `PROGRESS_DASHBOARD.md` da cap nhat
- [x] `module_tree_full.md` da refresh neu slice cham code files
- [x] `docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_SAAS_CUTOVER_SELF_AUDIT_AND_TEST_PROTOCOL_20260503.md` da duoc doc truoc khi claim slice moi
- [x] Da co handoff packet cho phien sau

## 10. Handoff packet cho phien sau

- Trang thai khi roi slice: completed
- Next recommended task ID: none (board closed)
- Route doc consulted: `docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_SAAS_CUTOVER_TASKBOARD_20260503.md`
- Exact command de resume hoac verify dau tien: `Push-Location ./backend; ..\.venv\Scripts\python.exe manage.py test portfolio.tests.test_api_routes_whale_advisory_access portfolio.tests.test_api_routes_whale_advisory_refresh portfolio.tests.test_api_routes_whale_advisory_delete_current portfolio.tests.test_api_routes_trading_and_p1_13 --keepdb; Pop-Location`
- Blockers / residual risks / immutable guardrails: historical audit docs still mention the retired route; keep single-active-slice rule and audit-sync rule intact.
- Audit entry IDs vua cap nhat: 2026-05-03be
