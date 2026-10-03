# [PR-1] Backend schema + validator + settings API

## 1) Summary

Implement runtime configuration contract for prefetch_time_policy via admin settings API.

## 2) Scope

In scope:
- Add default prefetch_time_policy object.
- Add payload coercion and validation.
- Extend GET/PUT admin settings to read/write prefetch_time_policy.
- Return prefetch_time_policy_rulebook for frontend guidance.

Out of scope:
- Time profile resolver logic in task runtime.
- 429 multiplier and metrics.
- Frontend form and preview.

## 3) Files touched

- backend/portfolio/views.py
- backend/portfolio/tasks.py (only shared policy helpers if needed)
- backend/portfolio/tests/test_system_ai_admin_api.py

## 4) API contract

GET admin settings returns:
- prefetch_time_policy
- prefetch_time_policy_rulebook

PUT admin settings accepts:
- prefetch_time_policy

Validation errors:
- HTTP 400 with field-level message map.

## 5) Test plan

Automated:
- Unit test valid payload accepted.
- Unit test invalid payload rejected with 400.
- Integration test GET/PUT roundtrip.

Manual:
- Open admin settings endpoint and verify new keys present.

## 6) Risk and rollback

Risks:
- Invalid payload may break downstream readers.

Mitigation:
- Strict coercion with safe defaults.

Rollback:
- Revert settings extension; keep default-only behavior.

## 7) Checklist

- [ ] Scope is limited to schema/validator/settings API.
- [ ] Backward compatibility verified.
- [ ] Tests added and passing.
- [ ] Changelog/docs updated.

## 8) Evidence

- Test output snippet:
- Sample GET response snippet:
- Sample PUT error snippet:
