# [PR-2] Time profile resolver + prefetch task integration

## 1) Summary

Integrate time-based policy resolver into prefetch runtime and publish policy metadata in health payload.

## 2) Scope

In scope:
- Resolve active profile by market window and timezone.
- Support pre_open 30m and post_close 30m windows.
- Apply effective runtime params in prefetch task.
- Skip upstream query when query_enabled is false.
- Expose policy profile metadata.

Out of scope:
- 429 multiplier behavior.
- Frontend admin UI.

## 3) Files touched

- backend/portfolio/tasks.py
- backend/portfolio/views.py (health payload fields if needed)
- backend/portfolio/tests/test_watch_sync.py or dedicated task tests

## 4) Behavior notes

- If resolver fails, use safe fallback profile.
- Task must not crash due to policy data issue.

## 5) Test plan

Automated:
- Unit tests for boundary times.
- Unit tests for weekend offhours mapping.
- Integration test for health metadata fields.

Manual:
- Simulate windows and verify effective profile transitions.

## 6) Risk and rollback

Risks:
- Wrong timezone handling can misclassify active profile.

Mitigation:
- Explicit timezone and edge-case tests.

Rollback:
- Disable resolver usage and revert to static runtime settings.

## 7) Checklist

- [ ] Resolver handles all profiles.
- [ ] Skip logic works when query_enabled=false.
- [ ] Metadata fields are present and consistent.
- [ ] Tests added and passing.

## 8) Evidence

- Resolver test table:
- Health payload sample:
