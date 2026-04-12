# PREFETCH TIME POLICY - PR6 EVIDENCE (2026-04-12)

## Scope

Tai lieu tong hop bang chung test/doc readiness cho PR-6 closure sau khi PR-1..PR-5 da implement.

---

## 1) Focused backend tests - PASS

### 1.1 Adapter fallback + prefetch policy resolver/guard

Command:

```powershell
& "c:/Mujoco Projects/vninvest/.venv/Scripts/python.exe" backend/manage.py test \
  portfolio.tests.test_adapters.VnstockAdapterTests.test_fetch_price_board_dataframe_fallbacks_on_rate_limit \
  portfolio.tests.test_ticker_prefetch_task.PrefetchPolicyGuardAndMetricTests \
  portfolio.tests.test_ticker_prefetch_task.PrefetchTimePolicyResolverTests
```

Observed output:
- Found 6 test(s)
- Ran 6 tests in 0.014s
- OK
- Log confirms fallback path: "price_board source VCI rate-limited, fallback to next source"

Result:
- PASS

---

## 2) Admin API policy tests - BLOCKED in local env

### 2.1 Initial run (without Redis timeout tuning)

Command:

```powershell
& "c:/Mujoco Projects/vninvest/.venv/Scripts/python.exe" backend/manage.py test \
  portfolio.tests.test_system_ai_admin_api...
```

Observed issue:
- Redis probe connection refused at settings bootstrap when local Redis is unavailable.

### 2.2 Retest with Redis socket timeout tuning

Command:

```powershell
$env:CACHE_REDIS_URL='redis://localhost:6379/2?socket_connect_timeout=0.2&socket_timeout=0.2'; \
& "c:/Mujoco Projects/vninvest/.venv/Scripts/python.exe" backend/manage.py test \
  portfolio.tests.test_system_ai_admin_api.SystemAIAdminApiTests.test_get_returns_default_settings_for_admin \
  portfolio.tests.test_system_ai_admin_api.SystemAIAdminApiTests.test_put_updates_prefetch_time_policy \
  portfolio.tests.test_system_ai_admin_api.SystemAIAdminApiTests.test_put_rejects_invalid_prefetch_time_policy
```

Observed issue:
- Process stalls at: "Creating test database for alias 'default'..."
- Local run did not complete inside command timeout window.

Result:
- RESOLVED by forcing local test env to SQLite (`DB_ENGINE=sqlite`) and short Redis timeout.

### 2.3 Consolidated backend evidence run - PASS

Command:

```powershell
$env:DB_ENGINE='sqlite'; \
$env:SQLITE_DB_NAME='db.sqlite3'; \
$env:CACHE_REDIS_URL='redis://localhost:6379/2?socket_connect_timeout=0.2&socket_timeout=0.2'; \
& "c:/Mujoco Projects/vninvest/.venv/Scripts/python.exe" backend/manage.py test \
  portfolio.tests.test_adapters.VnstockAdapterTests.test_fetch_price_board_dataframe_fallbacks_on_rate_limit \
  portfolio.tests.test_ticker_prefetch_task.PrefetchPolicyGuardAndMetricTests \
  portfolio.tests.test_ticker_prefetch_task.PrefetchTimePolicyResolverTests \
  portfolio.tests.test_system_ai_admin_api.SystemAIAdminApiTests.test_get_returns_default_settings_for_admin \
  portfolio.tests.test_system_ai_admin_api.SystemAIAdminApiTests.test_put_updates_prefetch_time_policy \
  portfolio.tests.test_system_ai_admin_api.SystemAIAdminApiTests.test_put_rejects_invalid_prefetch_time_policy
```

Observed output:
- Found 9 test(s)
- Ran 9 tests in 3.013s
- OK
- Destroying test database for alias `default`

Notes:
- Runtime log `opencore.default_license.create_failed ... DPIPlan matching query does not exist` appeared during user creation side effects but did not fail assertions.

---

## 3) Frontend status

- AdminOps prefetch time policy form integrated.
- Advanced validation, field-level error summary, and reset-to-loaded-values UX implemented.
- Editor diagnostics on modified frontend files: no errors found.
- Automated FE tests: PASS.

Command:

```powershell
Set-Location frontend
$env:CI='true'
npm test -- --watchAll=false --runInBand
```

Observed output:
- Test Suites: 7 passed, 7 total
- Tests: 41 passed, 41 total

---

## 4) Release gate interpretation

- Gate A1 (code readiness): satisfied.
- Gate A2 (test readiness): satisfied for current PR scope (backend focused + admin policy API tests + frontend suite).
- Gate A3 (operational readiness): satisfied by default fallback + rollback docs.

---

## 5) Next actions to unblock PR-6

1. Add dedicated AdminOps automated tests for prefetch_time_policy validation/save flow to increase FE coverage depth.
2. Run canary baseline capture for 429/cooldown/freshness metrics before Gate B.
3. Keep using `backend/run_prefetch_policy_pr6_tests.ps1` for deterministic local evidence runs.
