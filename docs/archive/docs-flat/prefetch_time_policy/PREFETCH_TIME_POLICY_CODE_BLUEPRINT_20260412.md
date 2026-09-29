# PREFETCH TIME POLICY - CODE BLUEPRINT (2026-04-12)

## Muc tieu

Chuyen tai lieu thanh danh sach code-level TODO theo file va ham de dev co the bat dau ngay.

---

## PR-1 Blueprint (Schema + Validator + Settings API)

### backend/portfolio/views.py

Them hoac cap nhat:
- `_default_prefetch_time_policy()`
- `_coerce_prefetch_time_policy(payload)`
- `_prefetch_time_policy_rulebook()`
- Trong handler GET settings: include policy + rulebook.
- Trong handler PUT settings: validate va save policy.

Pseudo:

```python
def _coerce_prefetch_time_policy(payload):
    policy = deep_merge(default_policy, payload or {})
    validate(policy)
    return policy
```

Tests:
- backend/portfolio/tests/test_system_ai_admin_api.py
  - test_get_settings_contains_prefetch_time_policy
  - test_put_prefetch_time_policy_valid
  - test_put_prefetch_time_policy_invalid

---

## PR-2 Blueprint (Resolver + Prefetch task integration)

### backend/portfolio/tasks.py

Them:
- `_resolve_prefetch_time_profile(now_dt, policy)`
- `_resolve_effective_prefetch_settings(now_dt, policy, runtime_defaults)`
- metadata builder cho health payload.

Trong `prefetch_ticker_price_board`:
- doc policy runtime.
- resolve profile.
- neu query_enabled false -> skip + metadata status.
- neu true -> ap interval/batch/symbol/retries.

Tests:
- backend/portfolio/tests (new file if needed)
  - test_profile_pre_open
  - test_profile_market_open
  - test_profile_post_close
  - test_profile_weekend_offhours

---

## PR-3 Blueprint (429 guard + metrics)

### backend/portfolio/tasks.py

Them:
- helper apply multiplier:
  - `_apply_429_multiplier(interval, multiplier, max_interval)`
- metrics emitters tai cac diem profile resolve, skip, fallback, multiplier.

Pseudo:

```python
if got_429:
    interval = min(int(interval * multiplier), max_interval)
```

Tests:
- test_429_multiplier_applied
- test_429_multiplier_clamped
- test_non_429_keeps_interval

---

## PR-4 Blueprint (AdminOps form + i18n)

### frontend/src/pages/AdminOps.jsx

Them state:
- `prefetchPolicyForm`
- `prefetchPolicyStatus`
- `prefetchPolicyMessage`

Them section UI:
- market window fields
- profile cards fields
- rate limit guard fields

### frontend/src/api/client.js

Them API helpers:
- `getPrefetchTimePolicySettings()`
- `updatePrefetchTimePolicySettings(payload)`

### frontend/src/i18n/vi.js + frontend/src/i18n/en.js

Them key namespace:
- `admin.prefetchTimePolicy.*`

---

## PR-5 Blueprint (Validation + Save + Preview)

### frontend/src/pages/AdminOps.jsx

Them:
- `validatePrefetchPolicy(form)` -> field errors
- submit guard neu invalid
- map server `field_errors` vao UI
- active profile preview block

Tests:
- validation fail blocks submit
- successful save updates status
- failed save preserves form state

---

## PR-6 Blueprint (Tests + Docs + Rollout)

Backend tests:
- bo sung test matrix critical.

Frontend tests:
- render + validation + save + preview.

Docs updates:
- cap nhat task tracker status
- cap nhat release gates sign-off/evidence
- cap nhat changelog

---

## Shared constants de xuat

Backend consts:
- `PREFETCH_TIME_POLICY_CACHE_KEY = "admin_ops:prefetch_time_policy"`
- `PREFETCH_TIME_POLICY_VERSION = 1`

Frontend consts:
- field name constants de tranh typo.

---

## Coding order de xuat trong ngay dau

1. PR-1: complete validator + API (de unblock FE)
2. PR-2: complete resolver skeleton
3. PR-4: render UI skeleton voi payload mock
4. PR-5: bat dau validation map theo rulebook
