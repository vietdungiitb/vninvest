# Slice D Gates — IC-SSOT-20260924

**Date:** 2026-09-24  
**Plan:** `docs/IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_SSAOT_20260924.md` Slice D  
**Ledger:** Entry 200  
**Audit findings closed:** F-C3 (D1), F-C4 (D2)

## Files changed

```
packages/core/backend/src/ai_analytics/views.py            | removed IsCoreOperator; self-scope
packages/core/backend/src/ai_agents/views.py               | ownership checks list/detail/patch/delete
packages/core/backend/src/ai_agents/models.py              | unique → UniqueConstraint(name, created_by)
packages/core/backend/src/ai_agents/migrations/0002_...py  | AlterField + AddConstraint
packages/core/backend/src/vninvest_core/db_router.py       | + ai_agents, ai_analytics → _CORE_APPS
packages/core/backend/src/ai_analytics/tests/__init__.py   | new
packages/core/backend/src/ai_analytics/tests/test_usage_permissions.py | 10 tests
packages/core/backend/src/ai_agents/tests/__init__.py      | new
packages/core/backend/src/ai_agents/tests/test_agent_ownership.py      | 12 tests
```

## D1 — Usage self-scope (F-C3)

| Current (before) | Target (after) |
|------------------|----------------|
| `permission_classes = [IsAuthenticated, IsCoreOperator]` ×3 | `[IsAuthenticated]` only |
| `AIUsageRecord.objects.all()` | non-staff: `filter(user=request.user)`; staff: all + optional `user_id` |
| Summary/Aggregate: all rows | same self-scope (both models have `user` FK) |
| POST `user=request.user if authenticated else None` | always `user=request.user` |

**SOC impact:** `IsCoreOperator` only removed on `ai_analytics/*`.  
`ops_audit`, `signal_intelligence/admin_views`, `service_ops` staff views **untouched**.

## D2 — Agent ownership (F-C4)

| Op | Before | After |
|----|--------|-------|
| GET list | `objects.all()` | staff→all; else `created_by=request.user` |
| POST | `created_by=request.user` | unchanged |
| GET detail | no check | staff or owner → else **404** |
| PATCH | no check | staff or owner → else **403** |
| DELETE | no check | staff or owner → else **403** |
| Model name | `unique=True` global | `UniqueConstraint(name, created_by)` + migration 0002 |

## Infrastructure fix (pre-existing latent bug)

`db_router.CoreRouter._CORE_APPS` **missing** `ai_agents` + `ai_analytics`  
→ `db_for_write` raised `RuntimeError` for every AgentRegistry/AIUsageRecord write  
(production POST would 500; tests could not seed).  
**Fix:** both app labels added to `_CORE_APPS`.  
Also discovered: local `migrate` post_migrate hook fails on stale `service_ops_servicehealth.slo_target`  
(pre-existing DB drift, unrelated to Slice D; `manage.py check` + test suite green).

## G1 — manage.py check

```
System check identified no issues (0 silenced).
```

## G2 — makemigrations

```
No changes detected in app 'ai_agents'
```
(`0002_agent_name_per_creator` applied: `Applying ai_agents.0002_agent_name_per_creator... OK`)

## G3 — BE tests

```
python manage.py test ai_analytics.tests ai_agents.tests --keepdb
Found 22 test(s).
Ran 22 tests in 79.206s
OK
```

| Suite | Tests | AC coverage |
|-------|-------|-------------|
| `ai_analytics.tests.test_usage_permissions` | 10 | D-AC1, D-AC2 (×4), D-AC6 (×2), D-AC7, unauth |
| `ai_agents.tests.test_agent_ownership` | 12 | D-AC3 (×4), D-AC4 (×5), D-AC5 (×2), post created_by, unauth |

## D-AC checklist

| ID | Result |
|----|--------|
| D-AC1 | PASS — non-staff GET usage 200 |
| D-AC2 | PASS — self-scope list/summary/aggregate; `user_id` filter ignored for non-staff |
| D-AC3 | PASS — list excludes other users; detail other → 404; staff list all |
| D-AC4 | PASS — PATCH/DELETE other → 403; own → 200/204; staff patch any → 200 |
| D-AC5 | PASS — same name different creators OK; same creator IntegrityError |
| D-AC6 | PASS — staff sees all users + `user_id` filter works |
| D-AC7 | PASS — both non-staff users can list (no more 403) |
| D-AC8 | PASS — check 0 + makemigrations clean + tests 22 OK |

## Next

Slice B.4 — migrate `usage.*` / `agentFederation.*` call sites → `aiUsageAnalytics.*` / `aiAgentFederation.*`.
