# TASKBOARD - SAAS NATIVE PACKAGES WEB AUTH CUTOVER

| Task ID | Title | Owner | Status | Gate | Notes |
|---|---|---|---|---|---|
| A1 | Complete auth adapter methods and tests | Web Platform | DONE | Unit | Added login/reset methods + tests expanded to 51 pass |
| A2 | Build packages/web auth pages | Web Platform | DONE | Component | Auth pages implemented in `packages/web/src/pages/auth/*` with Vietnamese copy, envelope mapping, and component regression tests |
| A3 | Wire route catalog + page registry + host | Web Platform | DONE | Route smoke | Host routes switched to package auth pages (`/login,/register,/verify-email,/reset-password`) |
| A4 | Align auth runtime/token ownership | Web Platform | DONE | Integration | Added centralized `authTokenStorage`; PortfolioContext/Auth guard aligned to package token lifecycle |
| A5 | Detach legacy auth production path | Web Platform | DONE | Regression | `frontend/src/api/auth.js` converted to compatibility shim; production paths no longer depend on legacy auth pages |
| A6 | Run full gates + prepare rollout evidence | QA + Tech Lead | DONE | Release | Unit/component/build/app-test/module-tree/start_dev gates passed; evidence logged |

## Execution evidence (2026-05-25)

1. Unit gate: `cd packages/web && npm test -- coreApiAdapter.test.js` ✅ (`51 passed`).
2. Component gate: `cd packages/web && npm test -- src/pages/auth/AuthPages.test.js src/adapters/coreApiAdapter.test.js` ✅ (`57 passed`).
3. Frontend regression gate: `cd frontend && npm test -- --watchAll=false src/App.test.jsx` ✅ (`2 passed`).
4. Build gate: `cd frontend && npm run build` ✅ compiled successfully.
5. Module tree gate: `./.venv/Scripts/python.exe scripts/ops/generate_module_tree.py` ✅ (`2594` modules).
6. Runtime gate: `./start_dev.ps1 -SkipBuild` ✅ exit `0`, stack ready, smoke checks `Core API health: OK`, `Frontend health: OK`.
7. Audit gate (scoped files): `git diff --check -- packages/web/package.json packages/web/package-lock.json packages/web/src/pages/auth/AuthPages.test.js module_tree_full.md` ✅ no output; no `print(` and no `explorer` string in touched files.

## Block merge conditions

1. Any task marked DONE without evidence section.
2. Missing runbook execution outputs.
3. Detected direct auth fetch from packages/web page layer.
