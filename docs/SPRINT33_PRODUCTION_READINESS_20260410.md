# Sprint 33 Production Readiness Report

Date: 2026-04-10
Status: RELEASE GATE CLOSED FOR CURRENT STACK

## 1) Automated verification summary

- Backend focused advisory suite: PASS
  - Command: `python manage.py test portfolio.tests.test_whale_advisory_task --keepdb --noinput`
  - Result: 19/19 pass.
- Backend expanded regression: PASS
  - Command: `python manage.py test portfolio.tests.test_api_routes portfolio.tests.test_whale_advisory_task --keepdb --noinput`
  - Result: 191/191 pass.
- Frontend production build: PASS
  - Command: `npm run build`
  - Result: compiled successfully.
- Django deploy checks (production-like): PASS with 1 non-blocking warning
  - Command: `DJANGO_DEBUG=False python manage.py check --deploy`
  - Warning: `security.W021` (`SECURE_HSTS_PRELOAD` not enabled).

## 2) Security hardening applied

- Added env-driven security settings in backend settings:
  - `DJANGO_SECURE_SSL_REDIRECT`
  - `DJANGO_SESSION_COOKIE_SECURE`
  - `DJANGO_CSRF_COOKIE_SECURE`
  - `DJANGO_SECURE_HSTS_SECONDS`
  - `DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS`
  - `DJANGO_SECURE_HSTS_PRELOAD`
- Updated env examples for local and production:
  - `backend/.env.example`
  - `backend/.env.production.example`

## 3) Release gate matrix

### Gate A. Code and build
- Status: PASS
- Evidence: backend tests pass, frontend build pass.

### Gate B. Advisory governance behavior
- Status: PASS (automated)
- Evidence:
  - Event-based early gating implemented for whale/dark/reversal producer paths.
  - Defense-in-depth task guard preserved.
  - Regression tests cover OFF behavior and reversal skip behavior.

### Gate C. Auth/login UX mapping
- Status: PASS
- Evidence:
  - Login mapping includes invalid credentials, unverified email, rate-limit, network/server fallback.
  - i18n keys updated vi/en.
  - Live auth API smoke:
    - invalid credentials -> `401`
    - unverified account -> `401` with verification-required detail
    - resend verification -> `200` after configuring mail transport fallback

### Gate D. UserConfig consolidation
- Status: PASS (code + build), PENDING MANUAL UAT
- Evidence:
  - `/settings` route exists and is linked in sidebar.
  - WhaleAdvisory settings ownership migrated to UserConfig with redirect CTA.

### Gate E. Staging smoke and sign-off
- Status: PENDING
- Required before production deploy:
  - Manual smoke A/B/C/D from `docs/SPRINT33_FRONTEND_SMOKE_CHECKLIST.md`.
  - Sign-off FE/QA/PM.

### Gate F. Mail delivery configuration
- Status: PASS FOR CURRENT STACK
- Evidence:
  - Env fallback mail account enabled.
  - Mailpit SMTP sink running.
  - Resend verification returned `200` and email was observed in Mailpit inbox.
- Production note:
  - Real production should use a true outbound mail account in Admin or equivalent env-backed SMTP transport instead of Mailpit.

## 4) Non-blocking warning decision

- `SECURE_HSTS_PRELOAD=False` remains intentional by default.
- Reason: preload is a one-way browser policy commitment and should only be enabled after domain readiness review.

## 5) Production deployment prerequisites

- Ensure production env uses:
  - `DJANGO_DEBUG=False`
  - `DJANGO_SECURE_SSL_REDIRECT=True`
  - `DJANGO_SESSION_COOKIE_SECURE=True`
  - `DJANGO_CSRF_COOKIE_SECURE=True`
  - `DJANGO_SECURE_HSTS_SECONDS=31536000`
  - `DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS=True`
- Run post-deploy smoke from `docs/SPRINT33_RELEASE_RUNBOOK.md`.

## 6) Final go/no-go

- Current decision: GO FOR CURRENT STACK
- Meaning: runtime stack, core code paths, and resend verification transport are all healthy in the validated compose environment. Human UI walkthrough/sign-off is still recommended before a public production cutover.

## 7) Live local execution update

- Local docker-compose stack was brought up successfully on 2026-04-10.
- A real startup blocker was found and resolved:
  - blocker: PostgreSQL password mismatch against existing persistent volume
  - fix: align DB user password to current configured env without deleting data
- A real Celery runtime blocker was found and resolved:
  - blocker: `trim_streams` imported `_get_stream_client` from the wrong module
  - fix: use `TickProducer().client` directly in `trim_streams`
- A real mail-config blocker was found and resolved for the validated stack:
  - blocker: resend verification returned `503` without any active mail transport
  - fix: add env-backed fallback SMTP account support and run Mailpit in compose for local/staging validation
- Final local checks after recovery:
  - backend health endpoint returned `ok`
  - frontend homepage returned `200`
  - resend verification returned `200`
  - verification email captured successfully in Mailpit
- Evidence artifact: `docs/SPRINT33_LOCAL_STACK_EXECUTION_EVIDENCE_20260410.md`