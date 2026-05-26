# TECH SPEC - SAAS NATIVE PACKAGES WEB AUTH CUTOVER

## 1) System model

1. Public auth surface: packages/web auth pages (no auth required).
2. Protected app surface: existing shell pages requiring token/session.
3. Adapter boundary: all auth HTTP calls via coreApiAdapter.

## 2) Invariants

1. Login endpoint: POST /auth/token/
2. Refresh endpoint: POST /auth/token/refresh/
3. Register endpoint: POST /auth/register/
4. Verify endpoint: POST /auth/verify-email/
5. Resend endpoint: POST /auth/resend-verification/
6. Error envelope fields rendered consistently: detail, code, request_id, field_errors.

## 3) UI routes target

1. /login
2. /register
3. /verify-email
4. /reset-password

## 4) Contracts frontend -> adapter

1. loginUser({username,password}) -> token payload
2. registerUser(payload) -> registration result + verification_required
3. verifyEmailToken(token) -> success message
4. resendVerificationEmail(email) -> accepted message

## 5) Security + abuse assumptions

1. Anti-spam validation owned by backend; frontend only forwards website + turnstile_token.
2. Frontend never persists sensitive plaintext credentials except transient form state.
3. Token persistence only via centralized adapter storage hooks.

## 6) Observability requirements

1. UI error toast must include request_id when available.
2. Login/register failure events tagged by code for dashboarding.
3. Route-level error boundary for public auth pages.

## 7) Non-functional requirements

1. i18n: Vietnamese default with full diacritics.
2. Accessibility: label/input association and keyboard submit.
3. Performance: first paint of login page < 2s on local dev baseline.
