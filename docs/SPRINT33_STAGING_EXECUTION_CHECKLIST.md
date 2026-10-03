# Sprint 33 Staging Execution Checklist

Date: 2026-04-10
Status: READY TO EXECUTE
Owner: QA + Release

## 1) Environment preflight

- [ ] P1. Backend and frontend services are running on staging.
- [ ] P2. Celery worker and beat are running.
- [ ] P3. Redis and database are healthy.
- [ ] P4. Staging environment uses production-like flags:
  - [ ] DJANGO_DEBUG=False
  - [ ] DJANGO_SECURE_SSL_REDIRECT=True
  - [ ] DJANGO_SESSION_COOKIE_SECURE=True
  - [ ] DJANGO_CSRF_COOKIE_SECURE=True
  - [ ] DJANGO_SECURE_HSTS_SECONDS >= 3600
- [ ] P5. Default outbound mail account is configured for verification email sending.

Evidence:
- [ ] Screenshot services healthy
- [ ] Config snapshot from staging env

## 2) Auth smoke

- [ ] A1. Wrong credentials show explicit invalid credential message.
- [ ] A2. Unverified account shows verification guidance.
- [ ] A3. Resend verification flow returns success/fallback message correctly.
- [ ] A4. No misleading demo credential hint appears.

Evidence:
- [ ] Screenshot A1
- [ ] Screenshot A2
- [ ] Screenshot A3
- [ ] Mail config proof / admin snapshot

## 3) UserConfig smoke

- [ ] U1. Sidebar opens UserConfig route successfully.
- [ ] U2. Language change persists after reload.
- [ ] U3. Theme change persists after reload.
- [ ] U4. Whale threshold persists after reload.
- [ ] U5. Event-based advisory toggle persists after reload.
- [ ] U6. AI provider/model save is reflected after reload.

Evidence:
- [ ] Screen recording U1-U3
- [ ] API snapshot U5

## 4) Advisory governance smoke

- [ ] G1. Event toggle OFF then trigger whale path: no advisory enqueue for test user.
- [ ] G2. Event toggle OFF then trigger dark flow path: no advisory enqueue for test user.
- [ ] G3. Event toggle OFF then trigger reversal path: no advisory enqueue for test user.
- [ ] G4. Event toggle ON then trigger event path: advisory enqueue/generation can happen.
- [ ] G5. Manual refresh remains functional.
- [ ] G6. Periodic auto-generation remains functional.

Evidence:
- [ ] Worker logs snippet for G1-G4
- [ ] UI/API snapshot for G5-G6

## 5) WhaleAdvisory ownership smoke

- [ ] W1. WhaleAdvisory no longer shows primary account-level settings forms.
- [ ] W2. WhaleAdvisory shows migration notice to UserConfig.
- [ ] W3. Link to UserConfig works from WhaleAdvisory.
- [ ] W4. Advisory list/filter/refresh interaction remains stable.

Evidence:
- [ ] Screenshot W1-W3
- [ ] Quick note W4

## 6) i18n and console sanity

- [ ] I1. New settings labels render correctly in Vietnamese.
- [ ] I2. New settings labels render correctly in English.
- [ ] I3. No raw i18n key leakage.
- [ ] I4. No new console errors on UserConfig and WhaleAdvisory pages.

Evidence:
- [ ] Screenshot I1-I3
- [ ] Console capture I4

## 7) Final gate

- [ ] F1. All P0 checks pass.
- [ ] F2. No open blocker from QA.
- [ ] F3. Release notes finalized.
- [ ] F4. Sign-off collected from FE/BE/QA/PM.

Sign-off:
- FE: [ ]
- BE: [ ]
- QA: [ ]
- PM: [ ]

Evidence form:
- `docs/SPRINT33_LIVE_EVIDENCE_TEMPLATE_20260410.md`
