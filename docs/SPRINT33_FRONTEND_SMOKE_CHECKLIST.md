# Sprint 33 Frontend Smoke Checklist

Status: OPEN
Date: 2026-04-10

## Scope

Frontend smoke validation for:
- Login UX message mapping
- New UserConfig route and persistence
- WhaleAdvisory settings ownership migration

## A. Login UX smoke

- [ ] A1. Wrong credentials show explicit invalid credentials message.
- [ ] A2. Unverified email credentials show verification-required guidance.
- [ ] A3. Resend verification action works from login flow.
- [ ] A4. Network failure shows network-specific fallback message.
- [ ] A5. Server-side error shows non-misleading server fallback message.

Evidence:
- [ ] Screenshot A1
- [ ] Screenshot A2
- [ ] Screenshot A3

## B. UserConfig route smoke

- [ ] B1. Sidebar link `UserConfig` opens `/settings` successfully.
- [ ] B2. Language update persists after page reload.
- [ ] B3. Theme update persists after page reload.
- [ ] B4. Whale threshold update persists after page reload.
- [ ] B5. Event-based advisory toggle persists after page reload.
- [ ] B6. AI provider/model save works and reflects on next load.

Evidence:
- [ ] Screen recording for B1-B3
- [ ] API request/response snapshot for B5

## C. WhaleAdvisory ownership smoke

- [ ] C1. WhaleAdvisory no longer renders account-level AI/schedule settings forms.
- [ ] C2. WhaleAdvisory shows migration notice to UserConfig.
- [ ] C3. Link to `/settings` works from WhaleAdvisory panel.
- [ ] C4. Advisory list/filter/refresh workflow still functions.

Evidence:
- [ ] Screenshot C1-C3
- [ ] Quick smoke note for C4

## D. i18n smoke

- [ ] D1. All new `settings.*` labels render in Vietnamese.
- [ ] D2. All new `settings.*` labels render in English.
- [ ] D3. No raw i18n key leakage on UserConfig and WhaleAdvisory pages.

## E. Build and regression gate

- [x] E1. `npm run build` passes.
- [ ] E2. No new console error on `/settings` load.
- [ ] E3. No route loop or auth redirect regression.

Execution note (2026-04-10):
- `npm run build` executed at `frontend/` and completed successfully.
- Build artifacts: `build/static/js/main.7a80608b.js`, `build/static/css/main.f7d9bbb4.css`.

## Sign-off

- FE sign-off: [ ]
- QA sign-off: [ ]
- PM review: [ ]
