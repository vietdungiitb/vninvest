# Sprint 33 Release Notes

Date: 2026-04-10
Release scope: UserConfig Consolidation and Advisory Governance
Release type: Feature + UX hardening

## 1) User-facing changes

### Login UX improvements
- Login error handling now maps common failure states to clearer messages:
  - Invalid credentials
  - Unverified email
  - Rate-limited attempts
  - Network and server fallback errors
- Login flow no longer displays demo credential hints in failure messages.

### New UserConfig page
- Added a dedicated UserConfig route for account-level persistent settings.
- Consolidated settings into a single page:
  - Language and theme
  - Whale threshold
  - AI provider, model, API key
  - Advisory policy controls

### WhaleAdvisory ownership update
- WhaleAdvisory now focuses on advisory usage workflows.
- Account-level settings ownership moved to UserConfig.
- Added migration notice and direct link to UserConfig.

## 2) Advisory policy behavior changes

- Event-based auto advisory is now explicitly user-controlled in UserConfig.
- V1 semantics use existing field advisory_whale_signal_enabled as shared toggle for:
  - Whale event pipeline
  - Dark flow merge pipeline
  - Reversal auto-queue pipeline
- Manual refresh and periodic auto-generation remain supported by existing controls.

## 3) Backend behavior and performance

- Added early gating in event producer paths to avoid unnecessary advisory queueing when event-based toggle is OFF.
- Kept defense-in-depth guard at advisory task level.
- Result: reduced background workload and less advisory noise for users who disabled event-based mode.

## 4) Verification summary

- Backend focused advisory suite: PASS (19/19)
- Backend expanded regression: PASS (191/191)
- Frontend production build: PASS
- Django deploy check (DEBUG=False): PASS with one non-blocking warning (HSTS preload)

## 5) Deployment notes

- Required production flags:
  - DJANGO_DEBUG=False
  - DJANGO_SECURE_SSL_REDIRECT=True
  - DJANGO_SESSION_COOKIE_SECURE=True
  - DJANGO_CSRF_COOKIE_SECURE=True
  - DJANGO_SECURE_HSTS_SECONDS recommended 31536000
- HSTS preload is intentionally optional and must be enabled only after domain readiness review.

## 6) Known follow-up items

- Complete manual staging smoke evidence and attach screenshots/logs.
- Final sign-off from FE/BE/QA/PM before production rollout.
