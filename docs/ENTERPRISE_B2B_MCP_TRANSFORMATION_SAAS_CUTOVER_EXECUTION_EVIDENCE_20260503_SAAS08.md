# SAAS-08 Execution Evidence - Core Package Smoke Proof and Prod Wiring

## 1. Slice identity

- Slice ID: SAAS-08
- Ngay: 2026-05-03
- Owner: Core Lead
- Task status when claimed: in-progress
- Task status when closed: in-progress
- Scope: core package adoption smoke proof and production adoption wiring

## 2. Objective

- Prove that `packages/core` is not just a directory scaffold but an executable runtime baseline with manifest, capability bootstrap, and heartbeat behavior.
- Wire the prod manifest so the package-shell frontend actually has a `core-api` runtime behind `/core/v1`.
- Keep the slice narrow: baseline proof first, broader adoption and truth migration later.

## 3. Files changed

- packages/core/backend/tests/__init__.py
- packages/core/backend/tests/test_runtime_baseline.py
- docker-compose.prod.yml
- docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_SAAS_CUTOVER_TASKBOARD_20260503.md
- docs/CODE_CHANGE_AUDIT_LEDGER.md
- PROGRESS_DASHBOARD.md
- module_tree_full.md

## 4. Validation

- PASSED: `Push-Location "c:/Mujoco Projects/vninvest/packages/core/backend"; $env:PYTHONPATH = "$PWD/src"; & "c:/Mujoco Projects/vninvest/.venv/Scripts/python.exe" -m unittest discover -s tests -p "test_*.py"; Pop-Location` -> 3 tests passed.
- PASSED: `Push-Location "c:/Mujoco Projects/vninvest"; docker compose -f ./docker-compose.yml -f ./docker-compose.prod.yml config; Pop-Location` -> production compose resolves `core-db`, `core-redis`, `core-api`, `core-worker`, `core-beat` and the frontend `core_shell_upstream` route.
- PASSED: `Push-Location "c:/Mujoco Projects/vninvest"; & ".\.venv\Scripts\python.exe" "scripts/ops/generate_module_tree.py"; Pop-Location` -> module tree regenerated successfully (596 modules).

## 5. Payload snapshots

- Manifest snapshot: `vninvest-core` exposes `core-api`, `core-worker`, and `core-beat` topology entries.
- Capability snapshot: `snapshot_version` remains `2026-05-03`, and `visible_routes` includes `ai-advisory` and `whale-alerts` for the SAAS build target.
- Heartbeat snapshot: `write_heartbeat()` creates a fresh health file and `run_healthcheck()` returns exit code `0` while the file is still fresh.

## 6. UI/runtime proof

- Route/actor used to prove: package-local unittest smoke coverage for `vninvest_core`.
- Dev stack refresh command: not required for this slice because the runtime baseline already existed in `docker-compose.dev.yml`; production adoption wiring was verified through compose config after adding core services to `docker-compose.prod.yml`.

## 7. Residual risk note

- This slice proves the package baseline and production topology wiring, but it still does not migrate control-plane truth away from the legacy backend service.
- The next follow-up should move beyond wiring into truth migration if the board wants the slice fully closed.

## 8. Handoff packet

- Trang thai khi roi slice: in-progress
- Next recommended task ID: SAAS-08 follow-up / truth migration
- Route doc consulted: `docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_SAAS_CUTOVER_FINAL_PLAN_20260503.md`
- Exact command de resume hoac verify dau tien: `Push-Location "c:/Mujoco Projects/vninvest"; docker compose -f ./docker-compose.yml -f ./docker-compose.prod.yml config; Pop-Location`
- Blockers / residual risks / immutable guardrails: control-plane truth migration is still pending; keep package-track-only rule and avoid bulk-copying legacy backend into `packages/core`.
- Audit entry IDs vua cap nhat: 2026-05-03bh