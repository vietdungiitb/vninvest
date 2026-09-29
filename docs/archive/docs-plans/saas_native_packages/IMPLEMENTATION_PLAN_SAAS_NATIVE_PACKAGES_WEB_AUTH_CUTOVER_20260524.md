# IMPLEMENTATION PLAN - SAAS NATIVE PACKAGES WEB AUTH CUTOVER

- Program: SAAS_NATIVE_PACKAGES_WEB_AUTH_CUTOVER
- Date stamp: 20260524
- Owner lane: Web Platform + Identity Access

## 1) Scope in

1. Login page production migration sang packages/web.
2. Register, verify-email, resend-verification pages production migration sang packages/web.
3. Reset password page migration sang packages/web (UI + adapter calls).
4. Route host migration tu frontend legacy sang packages/web auth pages.
5. Auth token lifecycle dong nhat trong packages/web adapter/runtime.

## 2) Scope out

1. SSO/Social login moi.
2. Thay doi chinh sach anti-abuse backend.
3. Refactor tong the dashboard/workspace ngoai auth flow.

## 3) Dependency graph

1. D0: packages/web adapter readiness
2. D1: packages/web auth pages
3. D2: route catalog + page registry + host integration
4. D3: deprecate legacy auth route usage
5. D4: test gates + rollout + cleanup

## 4) Task breakdown chi tiet

### A1 - Adapter completion
- Files:
  - packages/web/src/adapters/coreApiAdapter.js
  - packages/web/src/adapters/coreApiAdapter.test.js
- Work:
  - Add loginUser(username,password) via /auth/token/
  - Normalize success/error envelope cho auth endpoints
  - Keep refresh behavior idempotent
- DoD:
  - Unit tests pass for login/register/resend/verify

### A2 - Auth page module in packages/web
- Files:
  - packages/web/src/pages/auth/AuthLoginPage.js
  - packages/web/src/pages/auth/AuthRegisterPage.js
  - packages/web/src/pages/auth/AuthVerifyEmailPage.js
  - packages/web/src/pages/auth/AuthResetPasswordPage.js
  - packages/web/src/pages/auth/index.js
- Work:
  - Implement public auth UI with full vi i18n
  - Handle field_errors + request_id mapping from envelope
  - Add route guard behavior for authenticated users
- DoD:
  - Component tests pass all major states (idle/loading/success/error)

### A3 - Route + registry integration
- Files:
  - packages/web/src/app/routeCatalog.js
  - packages/web/src/pages/pageRegistry.js
  - frontend/src/App.jsx (temporary host wiring only)
- Work:
  - Register auth routes: /login, /register, /verify-email, /reset-password
  - Wire legacy host to package pages behind flag then default on
- DoD:
  - Manual route smoke pass for all 4 routes

### A4 - Auth runtime alignment
- Files:
  - packages/web/src/context/authRuntime.js
  - packages/web/src/context/authReact.js
  - (if needed) packages/web/src/context/bootstrapClient.js
- Work:
  - Unify token read/write/clear ownership in package layer
  - Remove duplicate redirect loop with legacy context
- DoD:
  - 401 redirect deterministic, no infinite loop

### A5 - Legacy detach
- Files:
  - frontend/src/components/LoginModal.jsx
  - frontend/src/pages/VerifyEmail.jsx
  - frontend/src/api/auth.js
  - frontend/src/context/PortfolioContext.jsx
- Work:
  - Mark deprecated path, remove production references
  - Keep compatibility shim only for rollback window
- DoD:
  - No production import path depends on legacy auth UI

### A6 - QA gates and rollout
- Files:
  - test files + docs evidence
- Work:
  - Unit/integration/e2e + runbooks execution
  - start_dev runtime refresh and smoke check
- DoD:
  - All mandatory gates pass with evidence

## 5) Merge gates

1. Code review runbook pass.
2. Integration runbook pass.
3. Spec audit runbook pass.
4. No direct fetch auth in packages/web pages.
5. No new feature development in frontend legacy.
