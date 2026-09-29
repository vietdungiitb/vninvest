# RUN CODE REVIEW - SAAS NATIVE PACKAGES WEB AUTH CUTOVER

## 1) Read-first bootstrap

1. quality/QUALITY.md
2. docs/plans/SAAS_NATIVE_PACKAGES_WEB_AUTH_CUTOVER_HANDOFF_MASTER_20260524.md
3. docs/plans/TECH_SPEC_SAAS_NATIVE_PACKAGES_WEB_AUTH_CUTOVER_20260524.md
4. docs/plans/IMPLEMENTATION_PLAN_SAAS_NATIVE_PACKAGES_WEB_AUTH_CUTOVER_20260524.md
5. docs/plans/TASKBOARD_SAAS_NATIVE_PACKAGES_WEB_AUTH_CUTOVER_20260524.md
6. docs/plans/SAAS_NATIVE_PACKAGES_WEB_AUTH_CUTOVER_TRACEABILITY_MATRIX_20260524.md
7. docs/plans/SAAS_NATIVE_PACKAGES_WEB_AUTH_CUTOVER_SELF_AUDIT_AND_TEST_PROTOCOL_20260524.md

## 2) Grep checks

1. Ensure no direct auth fetch in package pages:
   - grep -R "fetch(.*auth" packages/web/src/pages
2. Ensure no production import from legacy login UI:
   - grep -R "LoginModal\\|VerifyEmail" frontend/src
3. Ensure route ownership moved:
   - inspect frontend/src/App.jsx auth route elements point to package host/pages

## 3) Review focus

1. Correct adapter error handling for envelope.
2. Deterministic redirect behavior.
3. i18n completeness in Vietnamese.
4. No regression on protected routes.

## 4) Reject conditions

1. Any new production auth logic added to frontend legacy components.
2. Missing tests for auth error states.
3. Missing request_id propagation in UI error.
