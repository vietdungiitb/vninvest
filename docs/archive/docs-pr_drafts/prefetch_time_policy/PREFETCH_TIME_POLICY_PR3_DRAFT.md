# [PR-3] 429 guard + interval multiplier + observability

## 1) Summary

Add adaptive cooldown behavior on 429 and publish policy metrics.

## 2) Scope

In scope:
- Apply cooldown_multiplier_on_429 to effective interval.
- Clamp by max_interval_seconds.
- Add policy metrics for profile hits, skips, multiplier events, effective interval.

Out of scope:
- Admin UI changes.
- Settings schema redesign.

## 3) Files touched

- backend/portfolio/tasks.py
- backend/portfolio/views.py (if metadata expanded)
- backend/portfolio/tests/*

## 4) Metrics

- prefetch_policy_profile_hits_total{profile}
- prefetch_policy_skip_total
- prefetch_policy_429_multiplier_total
- prefetch_policy_effective_interval_seconds

## 5) Test plan

Automated:
- 429 event triggers multiplier correctly.
- Interval never exceeds max_interval_seconds.
- Non-429 path unchanged.

Manual:
- Force 429 from upstream mock and inspect metrics.

## 6) Risk and rollback

Risks:
- Over-throttling may reduce data freshness too much.

Mitigation:
- Clamp and monitor freshness KPI.

Rollback:
- Disable multiplier branch and retain baseline interval.

## 7) Checklist

- [ ] Multiplier logic implemented and clamped.
- [ ] Metrics exposed with stable naming.
- [ ] Regression tests pass.
- [ ] Monitoring notes updated.

## 8) Evidence

- Metric scrape sample:
- Test output snippet:
