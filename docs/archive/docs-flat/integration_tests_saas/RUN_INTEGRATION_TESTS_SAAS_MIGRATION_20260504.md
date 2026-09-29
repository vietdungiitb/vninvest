# RUN INTEGRATION TESTS — SaaS Production Migration & Legacy Monolith Decommission

**Ngày**: 2026-05-04  
**Mục tiêu**: Danh sách đầy đủ integration tests phải pass trước khi mark slice DONE.

---

## 1. Bootstrap — Đọc trước khi chạy tests

```
1. docs/SAAS_MIGRATION_HANDOFF_MASTER_20260504.md  (khóa kỹ mục "Evidence obligations")
2. docs/SAAS_MIGRATION_SELF_AUDIT_AND_TEST_PROTOCOL_20260504.md  (validation commands per slice type)
3. docs/SAAS_MIGRATION_TRACEABILITY_MATRIX_20260504.md  (Req ID → task mapping)
```

---

## 2. Test environment setup

```powershell
# 1. Start test stack
docker compose -f docker-compose.dev.yml up -d postgres redis

# 2. Apply all migrations
Push-Location ./backend
../.venv/Scripts/python.exe manage.py migrate --run-syncdb
Pop-Location

Push-Location ./packages/core/backend
../.venv/Scripts/python.exe manage.py migrate --database=default
Pop-Location

# 3. Load test fixtures
Push-Location ./backend
../.venv/Scripts/python.exe manage.py loaddata tests/fixtures/sm_test_data.json
Pop-Location
```

---

## 3. Phase 0 — Infrastructure baseline tests

### 3.1 Materializer parity tests

**File**: `packages/core/backend/tests/test_saas_materializers.py`

```powershell
Push-Location ./packages/core/backend
../.venv/Scripts/python.exe manage.py test tests.test_saas_materializers -v 2
Pop-Location
```

**Expected output**:
```
test_materialize_symbol_snapshot_reads_correct_table ... ok
test_materialize_symbol_snapshot_upsert_non_empty ... ok
test_materialize_session_facts_from_jsonb ... ok
test_materialize_unified_alerts_from_whale_events ... ok
test_materializer_handles_empty_legacy_gracefully ... ok
----------------------------------------------------------------------
Ran 5 tests in X.Xs
OK
```

**Nếu test file chưa tồn tại**: Tạo theo template:

```python
# packages/core/backend/tests/test_saas_materializers.py
from django.test import TestCase
from market_serving.materializers import (
    materialize_symbol_snapshot,
    materialize_session_facts,
    materialize_unified_alerts,
)

class TestMaterializeSymbolSnapshot(TestCase):
    """SM-P0.1: Verify materializer reads from portfolio_tickersessionclose."""
    
    fixtures = ['sm_test_data.json']
    
    def test_upsert_non_empty(self):
        result = materialize_symbol_snapshot()
        self.assertIn('upserted', result)
        self.assertGreater(result['upserted'], 0)
        self.assertEqual(result['status'], 'ok')
    
    def test_reads_from_tickersessionclose(self):
        """Verify SQL uses portfolio_tickersessionclose."""
        import unittest.mock as mock
        with mock.patch('django.db.connection.cursor') as mock_cursor:
            mock_cursor.return_value.__enter__ = mock.Mock(return_value=mock_cursor.return_value)
            mock_cursor.return_value.__exit__ = mock.Mock(return_value=False)
            mock_cursor.return_value.fetchall.return_value = []
            materialize_symbol_snapshot()
            sql = mock_cursor.return_value.execute.call_args[0][0]
            self.assertIn('portfolio_tickersessionclose', sql)
```

### 3.2 Connection pooling test

```powershell
Push-Location ./backend
../.venv/Scripts/python.exe -c "
from django.conf import settings
assert settings.DATABASES['default'].get('CONN_MAX_AGE', 0) >= 60, 'FAIL: CONN_MAX_AGE < 60'
print('PASS: CONN_MAX_AGE =', settings.DATABASES['default'].get('CONN_MAX_AGE'))
"
Pop-Location
```

---

## 4. Phase 1 — Security tests

### 4.1 JWT blacklist test

**File**: `backend/portfolio/tests/test_jwt_blacklist.py`

```powershell
Push-Location ./backend
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_jwt_blacklist -v 2
Pop-Location
```

**Expected test cases**:
- `test_refresh_after_rotation_returns_401`
- `test_new_token_after_rotation_is_valid`
- `test_logout_blacklists_refresh_token`

### 4.2 PAT HMAC test

```powershell
Push-Location ./backend
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_pat_auth -v 2
Pop-Location
```

**Expected test cases**:
- `test_pat_hash_uses_hmac_not_plain_sha256`
- `test_pat_hash_requires_pepper_env_var`
- `test_pat_compare_uses_constant_time`
- `test_auth_fails_with_invalid_pat`
- `test_auth_succeeds_with_valid_pat`

### 4.3 ALLOWED_HOSTS production check

```bash
# Verify production mode raises without ALLOWED_HOSTS
docker run --rm \
    -e DEBUG=0 \
    -e DJANGO_SECRET_KEY=test-secret-abc123 \
    vninvest-core-api:test \
    python -c "
import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')
try:
    django.setup()
    print('FAIL: Should have raised ImproperlyConfigured')
except Exception as e:
    if 'ALLOWED_HOSTS' in str(e) or 'ImproperlyConfigured' in type(e).__name__:
        print('PASS: Raised', type(e).__name__, str(e)[:100])
    else:
        print('FAIL: Wrong exception:', e)
"
```

---

## 5. Phase 2 — Core infrastructure tests

### 5.1 DB router tests

**File**: `packages/core/backend/tests/test_db_router.py`

```powershell
Push-Location ./packages/core/backend
../.venv/Scripts/python.exe manage.py test tests.test_db_router -v 2
Pop-Location
```

**Expected test cases**:
- `test_core_models_route_to_default`
- `test_legacy_models_route_to_legacy_for_read`
- `test_write_to_legacy_from_core_raises_error`
- `test_migration_only_for_core_db`

```python
# packages/core/backend/tests/test_db_router.py
from django.test import TestCase
from vninvest_core.routers import CoreRouter

class TestCoreRouter(TestCase):
    """SM-P2.1: Verify core cannot write to legacy DB."""
    
    def setUp(self):
        self.router = CoreRouter()
    
    def test_core_models_route_to_default(self):
        class FakeModel:
            class _meta:
                app_label = 'market_serving'
        result = self.router.db_for_read(FakeModel)
        self.assertEqual(result, 'default')
    
    def test_write_to_legacy_from_core_raises_error(self):
        class FakeLegacyModel:
            class _meta:
                app_label = 'portfolio'
        with self.assertRaises(RuntimeError):
            self.router.db_for_write(FakeLegacyModel)
```

### 5.2 Real Celery worker test

```bash
# Verify workers are running (not stub)
docker compose exec core-worker \
    celery -A vninvest_core inspect active 2>&1 | head -5
# Expected: Shows worker info, NOT "Error: empty"

# Check beat is scheduling
docker compose logs core-beat --tail=10 2>&1
# Expected: "Sending due task" entries, NOT just startup logs
```

---

## 6. Phase 3 — Domain migration tests

### 6.1 Template: domain migration parity test

Tạo cho mỗi domain theo pattern:

**File**: `packages/core/backend/tests/test_<domain>_migration_parity.py`

```python
# Template — copy và thay <domain> và model names
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.db import connections

class Test<Domain>MigrationParity(TestCase):
    """SM-P3.x.2: Verify <domain> migration parity >= 99%."""
    
    def test_parity_at_least_99_pct(self):
        from io import StringIO
        from django.core.management import call_command
        
        out = StringIO()
        call_command('migrate_<domain>_from_legacy', 
                     verify_parity=True,
                     stdout=out)
        output = out.getvalue()
        
        # Parse parity from output: "Parity: 99.5% (N/M)"
        import re
        match = re.search(r'Parity: (\d+\.?\d*)%', output)
        self.assertIsNotNone(match, f'No parity output found: {output}')
        
        parity_pct = float(match.group(1))
        self.assertGreaterEqual(parity_pct, 99.0,
            f'Parity {parity_pct:.1f}% below 99% threshold. Output: {output}')
```

### 6.2 UnifiedAlert event_id parity

```python
# packages/core/backend/tests/test_unified_alert_parity.py
class TestUnifiedAlertParity(TestCase):
    """SM-P3.3.2: Verify UnifiedAlert preserves event_id from WhaleAlertEvent."""
    
    def test_event_id_preserved(self):
        from django.db import connections
        
        with connections['legacy'].cursor() as cursor:
            cursor.execute("SELECT external_id FROM portfolio_whalealertevent LIMIT 100")
            legacy_ids = {row[0] for row in cursor.fetchall()}
        
        from signal_intelligence.models import UnifiedAlert
        core_ids = set(UnifiedAlert.objects.filter(
            event_id__in=legacy_ids
        ).values_list('event_id', flat=True))
        
        coverage = len(core_ids) / len(legacy_ids) * 100 if legacy_ids else 0
        self.assertGreaterEqual(coverage, 99.0,
            f'event_id coverage {coverage:.1f}% below threshold')
```

### 6.3 Shadow parity analysis script

**File**: `scripts/analyze_shadow_parity.py`

```python
#!/usr/bin/env python
"""
Analyze shadow run parity logs from core-worker.
Usage: python scripts/analyze_shadow_parity.py --task=detect_whale_alerts --days=3
"""
import argparse
import subprocess
import json
import sys
from datetime import datetime, timedelta

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--task', required=True)
    parser.add_argument('--days', type=int, default=3)
    parser.add_argument('--min-parity', type=float, default=99.0)
    args = parser.parse_args()
    
    # Get logs from docker
    result = subprocess.run(
        ['docker', 'compose', 'logs', 'core-worker', 
         f'--since={args.days * 24}h'],
        capture_output=True, text=True
    )
    
    parity_points = []
    for line in result.stdout.split('\n'):
        if 'SHADOW_PARITY' in line and args.task in line:
            try:
                data = json.loads(line.split('SHADOW_PARITY')[1].strip())
                parity_points.append(data['parity_pct'])
            except (IndexError, json.JSONDecodeError, KeyError):
                continue
    
    if not parity_points:
        print(f'FAIL: No parity logs found for {args.task} in last {args.days} days')
        sys.exit(1)
    
    avg_parity = sum(parity_points) / len(parity_points)
    min_parity = min(parity_points)
    
    print(f'Task: {args.task}')
    print(f'Data points: {len(parity_points)}')
    print(f'Average parity: {avg_parity:.2f}%')
    print(f'Min parity: {min_parity:.2f}%')
    
    if avg_parity < args.min_parity:
        print(f'FAIL: Average {avg_parity:.2f}% below {args.min_parity}% threshold')
        sys.exit(1)
    
    print(f'PASS: Shadow parity OK')

if __name__ == '__main__':
    main()
```

---

## 7. Phase 4 — Frontend tests

### 7.1 Build test

```powershell
Push-Location ./packages/web
npm run build 2>&1
if ($LASTEXITCODE -ne 0) { Write-Error "FAIL: Frontend build failed" }
else { Write-Host "PASS: Frontend build OK" }
Pop-Location
```

### 7.2 API adapter coverage test

```powershell
Push-Location ./packages/web
npm test -- --watchAll=false --coverage --testPathPattern="coreApiAdapter"
Pop-Location
```

### 7.3 i18n completeness test

```powershell
# Find all t() calls in pages
Push-Location ./packages/web/src/pages
$keys = (Get-ChildItem -Recurse -Filter "*.jsx" | 
    Select-String -Pattern "t\('([^']+)'\)" | 
    ForEach-Object { $_.Matches[0].Groups[1].Value } | 
    Sort-Object -Unique)

# Load i18n file
$i18n = Get-Content "../locales/vi/translation.json" | ConvertFrom-Json

# Check all keys exist
$missing = @()
foreach ($key in $keys) {
    $parts = $key.Split('.')
    $obj = $i18n
    foreach ($part in $parts) {
        if ($null -eq $obj.$part) {
            $missing += $key
            break
        }
        $obj = $obj.$part
    }
}

if ($missing.Count -gt 0) {
    Write-Error "FAIL: Missing i18n keys: $($missing -join ', ')"
} else {
    Write-Host "PASS: All i18n keys exist"
}
Pop-Location
```

---

## 8. Phase 5 — Load tests

### 8.1 k6 load test — Core API

**File**: `infra/load-tests/api-load.js`

```javascript
// infra/load-tests/api-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const p95Latency = new Trend('p95_latency');

export const options = {
  vus: 500,
  duration: '2m',
  thresholds: {
    http_req_failed: ['rate<0.01'],       // <1% error rate
    'p(95)': ['p(95)<200'],               // p95 < 200ms
    p95_latency: ['p(95)<200'],
  },
};

const BASE_URL = __ENV.CORE_API_URL || 'http://localhost:8100';
const PAT = __ENV.TEST_PAT;

export default function () {
  const headers = { Authorization: `Bearer ${PAT}` };
  
  const symbols = ['VNM', 'VIC', 'HPG', 'MSN', 'VHM'];
  const symbol = symbols[Math.floor(Math.random() * symbols.length)];
  
  const res = http.get(
    `${BASE_URL}/core/v1/market/symbol-snapshot/?symbol=${symbol}`,
    { headers }
  );
  
  check(res, {
    'status 200': (r) => r.status === 200,
    'has meta.source': (r) => r.json('meta.source') !== undefined,
    'data not empty': (r) => Object.keys(r.json('data') || {}).length > 0,
  });
  
  p95Latency.add(res.timings.duration);
  sleep(0.1);
}
```

```powershell
# Run load test
Push-Location ./infra/load-tests
$env:CORE_API_URL = "http://localhost:8100"
$env:TEST_PAT = (Get-Content "../../.env.test" | Select-String "TEST_PAT=" | ForEach-Object { $_.Line.Split("=")[1] })
k6 run api-load.js
Pop-Location
```

**Expected output**:
```
✓ status 200           (rate≥99%)
✓ has meta.source      (rate=100%)
✓ data not empty       (rate=100%)
p(95)=185ms ✓ < 200ms
http_req_failed=0.00% ✓ < 1%
```

---

## 9. Phase 6 — Pre-decommission gates

### 9.1 Comprehensive parity check

**File**: `scripts/verify_migration_parity.py`

```python
#!/usr/bin/env python
"""
Full domain parity check before decommission.
Usage: python scripts/verify_migration_parity.py --domain=all --sample-size=1000
"""
import argparse
import sys
import django
import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')
django.setup()

DOMAIN_CHECKS = {
    'identity_access': ('portfolio_customuser', 'identity_access_userprofile', 'user_id', 'core_user_id'),
    'commercial': ('portfolio_userconfig', 'commercial_subscription', 'id', 'legacy_id'),
    'signal_intelligence': ('portfolio_whalealertevent', 'signal_intelligence_unifiedalert', 'external_id', 'event_id'),
    'market_serving': ('portfolio_tickersessionclose', 'market_serving_symbolsnapshot', 'symbol', 'symbol'),
}

def check_domain(domain, sample_size):
    legacy_table, core_table, legacy_key, core_key = DOMAIN_CHECKS[domain]
    from django.db import connections
    
    with connections['legacy'].cursor() as cursor:
        cursor.execute(f"SELECT {legacy_key} FROM {legacy_table} ORDER BY RANDOM() LIMIT %s", [sample_size])
        legacy_ids = {row[0] for row in cursor.fetchall()}
    
    with connections['default'].cursor() as cursor:
        cursor.execute(f"SELECT {core_key} FROM {core_table} WHERE {core_key} = ANY(%s)", [list(legacy_ids)])
        core_ids = {row[0] for row in cursor.fetchall()}
    
    parity = len(core_ids) / len(legacy_ids) * 100 if legacy_ids else 0
    return parity, len(legacy_ids), len(core_ids)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--domain', default='all')
    parser.add_argument('--sample-size', type=int, default=1000)
    args = parser.parse_args()
    
    domains = list(DOMAIN_CHECKS.keys()) if args.domain == 'all' else [args.domain]
    all_pass = True
    
    for domain in domains:
        parity, legacy_count, core_count = check_domain(domain, args.sample_size)
        status = 'PASS' if parity >= 99.0 else 'FAIL'
        if status == 'FAIL':
            all_pass = False
        print(f'{status}: {domain}: {parity:.1f}% ({core_count}/{legacy_count})')
    
    sys.exit(0 if all_pass else 1)

if __name__ == '__main__':
    main()
```

### 9.2 Smoke test all core API endpoints

**File**: `scripts/smoke_test_core_api.sh`

```bash
#!/bin/bash
# Gate B: Verify all API endpoints respond correctly

BASE_URL="${CORE_API_URL:-http://localhost:8100}"
PAT="${TEST_PAT}"
PASS=0
FAIL=0

check_endpoint() {
    local method=$1
    local path=$2
    local expected_status=$3
    
    actual=$(curl -s -o /dev/null -w "%{http_code}" \
        -X "$method" \
        -H "Authorization: Bearer $PAT" \
        "${BASE_URL}${path}")
    
    if [ "$actual" = "$expected_status" ]; then
        echo "PASS: $method $path -> $actual"
        PASS=$((PASS + 1))
    else
        echo "FAIL: $method $path -> expected $expected_status got $actual"
        FAIL=$((FAIL + 1))
    fi
}

# Auth endpoints
check_endpoint GET /core/v1/auth/profile/ 200
check_endpoint GET /core/v1/auth/pat/list/ 200

# Market endpoints
check_endpoint GET "/core/v1/market/symbol-snapshot/?symbol=VNM" 200
check_endpoint GET "/core/v1/market/session-facts/?symbol=VNM" 200
check_endpoint GET "/core/v1/market/whale-alerts/?symbol=VNM" 200

# Signal intelligence endpoints  
check_endpoint GET /core/v1/signals/screener/ 200
check_endpoint GET /core/v1/signals/whale-map/ 200

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ $FAIL -eq 0 ]
```

---

## 10. Test run order (recommended)

```
Phase 0 → Phase 1 → Phase 2 → (Phase 3 per domain) → Phase 4 → Phase 5 → Phase 6
```

Chạy integration tests **sau mỗi slice** (không đợi phase complete).

---

## 11. Reporting format

```markdown
## Integration Test Run — SM-<SLICE_ID> — <date>

### Environment
- Branch: sm/<slice-id>
- Stack: docker compose dev (or staging)
- DB: vninvest_core (test) + vninvest_legacy (read-only)

### Results

| Suite | Tests | Pass | Fail | Skip | Duration |
|---|---|---|---|---|---|
| test_saas_materializers | 5 | 5 | 0 | 0 | 2.3s |
| test_db_router | 4 | 4 | 0 | 0 | 0.8s |
| test_jwt_blacklist | 3 | 3 | 0 | 0 | 1.2s |

### Overall: PASS / FAIL

### Failures (if any)
...
```
