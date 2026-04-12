# [PR-5] FE validation + save flow + active profile preview

## 1) Summary

Complete AdminOps interaction layer: validation, save path, and active profile preview.

## 2) Scope

In scope:
- Client-side validation for range/time constraints.
- Submit prevention when payload is invalid.
- Save success/error feedback.
- Active profile preview from backend payload.

Out of scope:
- Backend schema changes.
- New metrics instrumentation.

## 3) Files touched

- frontend/src/pages/AdminOps.jsx
- frontend/src/api/client.js
- frontend/src/i18n/vi.js
- frontend/src/i18n/en.js
- frontend tests related files

## 4) Validation rules

- Time windows must be coherent.
- Numeric ranges must satisfy min/max.
- Required fields cannot be empty.

## 5) Test plan

Automated:
- Validation fail cases block submit.
- Validation pass case allows submit.
- Save success and save error flows.
- Preview rendering test.

Manual:
- Enter invalid values and verify field-level errors.

## 6) Risk and rollback

Risks:
- User may lose edits on failed save.

Mitigation:
- Keep local form state intact on API error.

Rollback:
- Revert preview/validation layer and keep read-only form.

## 7) Checklist

- [ ] Validation complete and tested.
- [ ] Save flow stable for success/failure.
- [ ] Preview reflects backend values.
- [ ] No regression on other AdminOps actions.

## 8) Evidence

- Validation test output:
- Save success/failure screenshots:
