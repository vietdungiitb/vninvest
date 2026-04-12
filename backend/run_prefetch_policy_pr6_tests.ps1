$ErrorActionPreference = 'Stop'

# Force local deterministic test backend/cache to avoid Postgres provisioning stalls
$env:DB_ENGINE = 'sqlite'
$env:SQLITE_DB_NAME = 'db.sqlite3'
$env:CACHE_REDIS_URL = 'redis://localhost:6379/2?socket_connect_timeout=0.2&socket_timeout=0.2'

& "$PSScriptRoot\..\.venv\Scripts\python.exe" "$PSScriptRoot\manage.py" test `
  portfolio.tests.test_adapters.VnstockAdapterTests.test_fetch_price_board_dataframe_fallbacks_on_rate_limit `
  portfolio.tests.test_ticker_prefetch_task.PrefetchPolicyGuardAndMetricTests `
  portfolio.tests.test_ticker_prefetch_task.PrefetchTimePolicyResolverTests `
  portfolio.tests.test_system_ai_admin_api.SystemAIAdminApiTests.test_get_returns_default_settings_for_admin `
  portfolio.tests.test_system_ai_admin_api.SystemAIAdminApiTests.test_put_updates_prefetch_time_policy `
  portfolio.tests.test_system_ai_admin_api.SystemAIAdminApiTests.test_put_rejects_invalid_prefetch_time_policy
