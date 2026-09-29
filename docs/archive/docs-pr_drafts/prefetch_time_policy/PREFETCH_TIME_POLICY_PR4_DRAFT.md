# [PR-4] AdminOps policy form + i18n

## 1) Summary

Add AdminOps UI section for prefetch time policy configuration.

## 2) Scope

In scope:
- Render policy section and field groups.
- Load data from settings API.
- Add i18n labels/messages for vi/en.

Out of scope:
- Save validation hard rules (handled in PR-5).
- Backend resolver logic.

## 3) Files touched

- frontend/src/pages/AdminOps.jsx
- frontend/src/api/client.js
- frontend/src/i18n/vi.js
- frontend/src/i18n/en.js

## 4) UX requirements

- Clear grouping: market window, profiles, guard params.
- Stable layout desktop and mobile.
- Loading and error states visible.

## 5) Test plan

Automated:
- Render tests for policy section.
- Basic data binding test from API payload.

Manual:
- Verify fields render correctly in vi/en.

## 6) Risk and rollback

Risks:
- UI complexity may confuse admin users.

Mitigation:
- Grouped form and inline hints.

Rollback:
- Hide policy section behind feature flag or revert UI patch.

## 7) Checklist

- [ ] Form section renders and loads data.
- [ ] i18n keys complete for vi/en.
- [ ] Responsive checks passed.
- [ ] Existing AdminOps sections unaffected.

## 8) Evidence

- UI screenshots desktop/mobile:
- i18n key diff summary:
