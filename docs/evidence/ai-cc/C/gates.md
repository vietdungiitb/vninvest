# Slice C Gates — IC-SSOT-20260924

**Date:** 2026-09-24  
**Plan:** `docs/IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_SSAOT_20260924.md` Slice C  
**Ledger:** Entry 202  
**Audit findings closed:** F-C5 (UserAICredential 5 fields + GET/PUT self-scope)

## Files changed

```
packages/core/backend/src/advisory/models.py              | +5 fields UserAICredential
packages/core/backend/src/advisory/migrations/0007_...py  | AddField ×5
packages/core/backend/src/advisory/serializers.py         | sanitize: stop masking max_tokens as secret
packages/core/backend/src/user_workspace/portfolio_analytics_views.py | GET/PUT user-first policy
packages/core/backend/tests/test_ai_cc_config_isolation.py | 8 tests (2-user matrix)
```

## C.1 Requirements checklist

| Step | Task | Status |
|------|------|--------|
| C.1.1 | AddField 5 field: `temperature`, `max_tokens_per_day`, `refresh_interval_hours`, `max_auto_refreshes_per_day`, `prompt_config` | ☑ |
| C.1.2 | Migration `0007_useraicredential_max_auto_refreshes_per_day_and_more` | ☑ applied |
| C.1.3 | GET: prefer user field, fallback system metadata/config | ☑ |
| C.1.4 | PUT: only UserAICredential for per-user fields; **no** SystemAISettings write | ☑ |
| C.1.5 | Lazy default (NULL → system; no mass backfill) | ☑ |
| C.1.6 | Audit before/after reflects user rows | ☑ (+ sanitize fix) |
| C.1.7 | BE tests 2-user isolation ≥4 | ☑ 8 tests |

## C.2 AC

| ID | Criteria | Status |
|----|----------|--------|
| C-AC1 | UserA temp ≠ UserB | ☑ PASS |
| C-AC2 | UserA tokens ≠ UserB | ☑ PASS |
| C-AC3 | UserA prompt ≠ UserB | ☑ PASS |
| C-AC4 | PUT không đổi SystemAISettings | ☑ PASS |
| C-AC5 | FE shape cũ (18 keys) | ☑ PASS |
| C-AC6 | check + migration | ☑ check 0; makemigrations --check clean |
| C-AC7 | G6–G7 | ☑ check + tests |

## Design notes

- Policy fields on `UserAICredential` are **NULL = system default** (lazy; no backfill).
- GET resolves: user field if not None → else system metadata / `config.max_tokens` / `config.temperature`.
- PUT no longer writes `config.temperature`, `config.max_tokens`, `config.metadata`,
  or `config.ai_model` from user payload — all go to `UserAICredential` only.
- Side fix: `sanitize_sensitive_fields` previously matched any key containing `token`
  → masked `advisory_max_tokens_per_day` to `••••••••` in audit after_json. Now uses
  precise token-secret pattern and excludes `max_token*` / `tokens_per*`.

## Gates

| Gate | Command | Result |
|------|---------|--------|
| G6 check | `manage.py check` | **0 issues** |
| G2 migration | `makemigrations --check --dry-run` | **No changes detected** |
| G7 isolation | `manage.py test tests.test_ai_cc_config_isolation --keepdb` | **8/8 OK** |
| G7 regression | `tests.test_ai_management_center tests.test_ai_audit_logs` | **53/53 OK** |
| G7 advisory | `tests.test_advisory_tasks tests.test_advisory_ssot tests.test_advisory_api_routes` | **8/8 OK** |

**Total this slice: 69 BE tests OK** (8 new + 61 regression).

## Test coverage (8 new)

| Test | AC |
|------|-----|
| `test_c_ac1_user_a_temperature_isolated_from_user_b` | C-AC1 |
| `test_c_ac2_user_a_max_tokens_isolated_from_user_b` | C-AC2 |
| `test_c_ac3_user_a_prompt_config_isolated_from_user_b` | C-AC3 |
| `test_c_ac4_put_does_not_mutate_system_ai_settings` | C-AC4 |
| `test_c_ac5_response_shape_keys_stable` | C-AC5 |
| `test_lazy_default_null_fields_fall_back_to_system` | C.1.5 |
| `test_put_does_not_leak_user_b_values_to_user_a` | isolation |
| `test_audit_after_snapshot_reflects_user_rows` | C.1.6 |
